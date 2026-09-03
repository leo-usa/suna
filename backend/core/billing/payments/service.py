from fastapi import HTTPException
from typing import Dict, Optional
from decimal import Decimal
from datetime import datetime, timezone
import stripe
from core.utils.logger import logger
from ..external.stripe import generate_credit_purchase_idempotency_key, StripeAPIWrapper
from .interfaces import PaymentProcessorInterface
from ..shared.config import (
    get_annual_prepaid_price_usd,
    get_tier_by_name,
    ANNUAL_PREPAID_TIER_KEYS,
    compute_credit_purchase_grant,
)
from core.utils.config import config
from core.billing import repo as billing_repo

MIN_CREDIT_PURCHASE_AMOUNT = Decimal("1.00")
MAX_CREDIT_PURCHASE_AMOUNT = Decimal("5000.00")
SUPPORTED_CREDIT_PAYMENT_METHODS = {"card", "alipay", "wechat_pay"}
SUPPORTED_ANNUAL_PREPAID_PAYMENT_METHODS = {"alipay", "wechat_pay"}

class PaymentService(PaymentProcessorInterface):
    def __init__(self):
        self.stripe = stripe
        stripe.api_key = config.STRIPE_SECRET_KEY

    async def validate_payment_eligibility(self, account_id: str) -> bool:
        from ..subscriptions import subscription_service
        tier = await subscription_service.get_user_subscription_tier(account_id)
        return tier.get('can_purchase_credits', False)

    async def create_checkout_session(
        self, 
        account_id: str, 
        amount: Decimal, 
        success_url: str, 
        cancel_url: str
    ) -> Dict:
        return await self.create_credit_purchase_checkout(
            account_id, amount, success_url, cancel_url,
            get_user_subscription_tier_func=self._get_user_subscription_tier,
            payment_method="card",
            locale=None
        )
    
    async def _get_user_subscription_tier(self, account_id: str):
        from ..subscriptions import subscription_service
        return await subscription_service.get_user_subscription_tier(account_id)

    async def create_credit_purchase_checkout(
        self, 
        account_id: str, 
        amount: Decimal, 
        success_url: str, 
        cancel_url: str,
        get_user_subscription_tier_func=None,
        payment_method: str = "card",
        locale: Optional[str] = None
    ) -> Dict:
        amount = Decimal(str(amount))
        payment_method = payment_method or "card"

        if amount < MIN_CREDIT_PURCHASE_AMOUNT:
            raise HTTPException(status_code=400, detail=f"Minimum credit purchase is ${MIN_CREDIT_PURCHASE_AMOUNT}")
        if amount > MAX_CREDIT_PURCHASE_AMOUNT:
            raise HTTPException(status_code=400, detail=f"Maximum credit purchase is ${MAX_CREDIT_PURCHASE_AMOUNT}")
        if payment_method not in SUPPORTED_CREDIT_PAYMENT_METHODS:
            raise HTTPException(status_code=400, detail="Unsupported credit purchase payment method")
        if not config.STRIPE_SECRET_KEY:
            raise HTTPException(status_code=500, detail="Stripe is not configured")

        from ..subscriptions.handlers.customer import CustomerHandler

        customer_id = await CustomerHandler.get_or_create_stripe_customer(account_id)
        
        try:
            await StripeAPIWrapper.safe_stripe_call(
                stripe.Customer.retrieve_async,
                customer_id
            )
            logger.info(f"[PAYMENT] Verified Stripe customer {customer_id} for account {account_id}")
        except stripe.error.InvalidRequestError as e:
            if 'No such customer' in str(e):
                logger.error(f"[PAYMENT] Customer {customer_id} not found in Stripe for account {account_id}")
                raise HTTPException(
                    status_code=400, 
                    detail="Your billing customer record is invalid. Please contact support or try subscribing again."
                )
            raise
        
        purchase_id = None
        grant = compute_credit_purchase_grant(amount)
        purchase_metadata = {
            'amount': float(amount),
            'payment_method': payment_method,
            'credits_granted': float(grant['total']),
            'bonus_percent': float(grant['bonus_percent']),
            'bonus_credits': float(grant['bonus']),
        }
        try:
            purchase_record = await billing_repo.create_credit_purchase(
                account_id=account_id,
                amount_dollars=float(amount),
                status='pending',
                stripe_payment_intent_id=None,
                metadata=purchase_metadata
            )
            
            if purchase_record:
                purchase_id = purchase_record['id']
                logger.info(f"[PAYMENT] Created purchase record {purchase_id} for account {account_id}")
            else:
                raise Exception("No purchase record returned")
        except Exception as e:
            logger.error(f"[PAYMENT FAILURE] Failed to create purchase record: {e}")
            raise HTTPException(status_code=500, detail="Failed to initialize payment")
        
        import hashlib
        idempotency_key = hashlib.sha256(f"{account_id}_{purchase_id}_{amount}".encode()).hexdigest()[:40]
        
        try:
            payment_method_params = self._build_payment_method_params(payment_method)
            metadata = {
                'type': 'credit_purchase',
                'account_id': account_id,
                'credit_amount': str(grant['total']),
                'amount_paid': str(amount),
                'bonus_percent': str(grant['bonus_percent']),
                'purchase_id': str(purchase_id),
                'payment_method': payment_method,
            }
            product_name = f'${amount} Credits'
            if grant['bonus_percent'] > 0:
                product_name = f'${amount} Credits (+{grant["bonus_percent"]}% extra)'
            session_params = {
                'customer': customer_id,
                **payment_method_params,
                'line_items': [{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {'name': product_name},
                        'unit_amount': int(amount * 100),
                    },
                    'quantity': 1,
                }],
                'mode': 'payment',
                'success_url': success_url,
                'cancel_url': cancel_url,
                'allow_promotion_codes': True,
                'metadata': metadata,
                'idempotency_key': idempotency_key
            }
            if locale:
                session_params['locale'] = locale

            session = await StripeAPIWrapper.create_checkout_session(**session_params)
            
            payment_intent_id = session.payment_intent if session.payment_intent else None
            
            if not payment_intent_id:
                logger.warning(f"[PAYMENT] No payment_intent in session {session.id} for account {account_id} - will track by session_id")
            
            await billing_repo.update_purchase_by_id(
                purchase_id=purchase_id,
                status='pending',
                stripe_payment_intent_id=payment_intent_id,
                metadata={
                    'session_id': session.id,
                    'amount': float(amount),
                    'purchase_id': str(purchase_id),
                    'payment_method': payment_method,
                    'credits_granted': float(grant['total']),
                    'bonus_percent': float(grant['bonus_percent']),
                    'bonus_credits': float(grant['bonus']),
                }
            )
            
            logger.info(f"[PAYMENT SUCCESS] Created checkout session {session.id} for purchase {purchase_id}")
            return {'checkout_url': session.url}
            
        except Exception as e:
            logger.critical(
                f"[PAYMENT FAILURE - ORPHAN RISK] Stripe checkout failed! "
                f"account_id={account_id}, purchase_id={purchase_id}, amount=${amount}, error={e}"
            )
            
            try:
                await billing_repo.update_purchase_by_id(
                    purchase_id=purchase_id,
                    status='failed',
                    metadata={'error': str(e), 'failed_at': datetime.now(timezone.utc).isoformat()}
                )
            except Exception as log_error:
                logger.error(f"[PAYMENT FAILURE] Failed to update purchase record: {log_error}")
            
            raise HTTPException(status_code=500, detail="Failed to create payment session")

    async def validate_annual_prepaid_eligibility(self, account_id: str) -> None:
        credit_account = await billing_repo.get_credit_account(account_id) or {}
        stripe_subscription_id = credit_account.get('stripe_subscription_id')
        stripe_status = credit_account.get('stripe_subscription_status')
        provider = credit_account.get('provider', 'stripe')

        if stripe_status == 'prepaid_active':
            raise HTTPException(
                status_code=400,
                detail="You already have an active prepaid annual plan. Upgrades will be available in a future update.",
            )

        if stripe_subscription_id and stripe_status in ('active', 'trialing', 'past_due'):
            raise HTTPException(
                status_code=400,
                detail="You already have an active card subscription. Cancel it first or manage billing via the subscription portal.",
            )

        if provider == 'revenuecat' and credit_account.get('revenuecat_subscription_id'):
            raise HTTPException(
                status_code=400,
                detail="You have an active mobile subscription. Manage billing in the mobile app.",
            )

    async def create_annual_prepaid_checkout(
        self,
        account_id: str,
        tier_key: str,
        success_url: str,
        cancel_url: str,
        payment_method: str = "alipay",
        locale: Optional[str] = None,
    ) -> Dict:
        if tier_key not in ANNUAL_PREPAID_TIER_KEYS:
            raise HTTPException(status_code=400, detail="Invalid annual plan tier")
        if payment_method not in SUPPORTED_ANNUAL_PREPAID_PAYMENT_METHODS:
            raise HTTPException(status_code=400, detail="Annual prepaid plans support Alipay and WeChat Pay only")
        if not config.STRIPE_SECRET_KEY:
            raise HTTPException(status_code=500, detail="Stripe is not configured")

        amount = get_annual_prepaid_price_usd(tier_key)
        if not amount:
            raise HTTPException(status_code=400, detail="Unknown annual plan price")

        tier_info = get_tier_by_name(tier_key)
        if not tier_info:
            raise HTTPException(status_code=400, detail="Invalid tier")

        await self.validate_annual_prepaid_eligibility(account_id)

        from ..subscriptions.handlers.customer import CustomerHandler

        customer_id = await CustomerHandler.get_or_create_stripe_customer(account_id)

        purchase_metadata = {
            'purchase_kind': 'annual_prepaid',
            'tier_key': tier_key,
            'payment_method': payment_method,
            'amount': float(amount),
        }
        purchase_record = await billing_repo.create_credit_purchase(
            account_id=account_id,
            amount_dollars=float(amount),
            status='pending',
            stripe_payment_intent_id=None,
            metadata=purchase_metadata,
        )
        if not purchase_record:
            raise HTTPException(status_code=500, detail="Failed to initialize payment")

        purchase_id = purchase_record['id']

        import hashlib
        idempotency_key = hashlib.sha256(
            f"annual_{account_id}_{purchase_id}_{tier_key}_{amount}".encode()
        ).hexdigest()[:40]

        payment_method_params = self._build_payment_method_params(payment_method)
        metadata = {
            'type': 'annual_prepaid',
            'account_id': account_id,
            'tier_key': tier_key,
            'purchase_id': str(purchase_id),
            'payment_method': payment_method,
            'amount_usd': str(amount),
        }

        try:
            session_params = {
                'customer': customer_id,
                **payment_method_params,
                'line_items': [{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': f'{tier_info.display_name} — 1 Year (Annual Prepaid)',
                        },
                        'unit_amount': int(amount * 100),
                    },
                    'quantity': 1,
                }],
                'mode': 'payment',
                'success_url': success_url,
                'cancel_url': cancel_url,
                'metadata': metadata,
                'idempotency_key': idempotency_key,
            }
            if locale:
                session_params['locale'] = locale

            session = await StripeAPIWrapper.create_checkout_session(**session_params)

            payment_intent_id = session.payment_intent if session.payment_intent else None
            await billing_repo.update_purchase_by_id(
                purchase_id=purchase_id,
                status='pending',
                stripe_payment_intent_id=payment_intent_id,
                metadata={
                    **purchase_metadata,
                    'session_id': session.id,
                    'purchase_id': str(purchase_id),
                },
            )

            logger.info(
                f"[PREPAID ANNUAL] Created checkout session {session.id} for "
                f"{account_id[:8]}... tier={tier_key} amount=${amount}"
            )
            return {'checkout_url': session.url}
        except Exception as e:
            logger.critical(
                f"[PREPAID ANNUAL FAILURE] Stripe checkout failed account_id={account_id} "
                f"purchase_id={purchase_id} error={e}"
            )
            try:
                await billing_repo.update_purchase_by_id(
                    purchase_id=purchase_id,
                    status='failed',
                    metadata={'error': str(e), 'failed_at': datetime.now(timezone.utc).isoformat()},
                )
            except Exception as log_error:
                logger.error(f"[PREPAID ANNUAL] Failed to update purchase record: {log_error}")
            raise HTTPException(status_code=500, detail="Failed to create payment session")

    @staticmethod
    def _build_payment_method_params(payment_method: str) -> Dict:
        if payment_method == "wechat_pay":
            return {
                "payment_method_types": ["wechat_pay"],
                "payment_method_options": {
                    "wechat_pay": {
                        "client": "web"
                    }
                }
            }
        if payment_method == "alipay":
            return {"payment_method_types": ["alipay"]}
        return {"payment_method_types": ["card"]}


payment_service = PaymentService() 
