from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from core.services.credits import credit_service
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.config import config, EnvMode
from core.utils.logger import logger
from ..shared.config import (
    TOKEN_PRICE_MULTIPLIER, 
    get_tier_by_name,
    TIERS,
    CREDITS_PER_DOLLAR,
    get_tier_limits
)
from ..shared.models import TokenUsageRequest
from ..credits.calculator import calculate_token_cost
from ..credits.manager import credit_manager
from ..shared.cache_utils import invalidate_account_state_cache

router = APIRouter(tags=["billing-core"])


@router.post("/deduct")
async def deduct_token_usage(
    usage: TokenUsageRequest,
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> Dict:
    cost = calculate_token_cost(usage.prompt_tokens, usage.completion_tokens, usage.model)
    
    if cost <= 0:
        balance = await credit_manager.get_balance(account_id)
        return {'success': True, 'cost': 0, 'new_balance': balance['total'] * CREDITS_PER_DOLLAR}

    result = await credit_manager.deduct_credits(
        account_id=account_id,
        amount=cost,
        description=f"AI usage: {usage.model} ({usage.prompt_tokens}+{usage.completion_tokens} tokens)",
        type='usage',
        message_id=usage.message_id,
        thread_id=usage.thread_id
    )
    
    await invalidate_account_state_cache(account_id)
    
    return {
        'success': result['success'],
        'cost': float(cost) * CREDITS_PER_DOLLAR,
        'new_balance': float(result['new_balance']) * CREDITS_PER_DOLLAR,
        'usage': {
            'prompt_tokens': usage.prompt_tokens,
            'completion_tokens': usage.completion_tokens,
            'model': usage.model
        }
    }


@router.get("/tier-configurations") 
async def get_tier_configurations() -> Dict:
    try:
        tier_configs = []
        for tier_key, tier in TIERS.items():
            if tier_key == 'none':
                continue
                
            tier_config = {
                'tier_key': tier_key,  
                'name': tier.name,
                'display_name': tier.display_name,
                'monthly_credits': float(tier.monthly_credits),
                'can_purchase_credits': tier.can_purchase_credits,
                'project_limit': tier.project_limit,
                'price_ids': tier.price_ids,
            }
            tier_configs.append(tier_config)
        
        return {
            'success': True,
            'tiers': tier_configs,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting tier configurations: {e}")
        raise HTTPException(status_code=500, detail="Failed to get tier configurations")


# Mode wrappers / test models — not useful in the public pricing table
_MODEL_PRICING_EXCLUDED_IDS = frozenset({
    'dobby/basic',
    'dobby/power',
    'dobby/test',
})


@router.get("/model-pricing")
async def get_model_pricing() -> Dict:
    """Public list of billed model token prices (provider cost × platform markup)."""
    try:
        from core.ai_models import model_manager

        models_out = []
        for model_info in model_manager.list_available_models(include_disabled=False):
            model_id = model_info.get('id')
            if not model_id or model_id in _MODEL_PRICING_EXCLUDED_IDS:
                continue

            model = model_manager.get(model_id)
            if not model or not model.pricing:
                continue

            pricing = model.pricing
            multiplier = float(TOKEN_PRICE_MULTIPLIER)

            input_cost = float(pricing.input_cost_per_million_tokens) * multiplier
            output_cost = float(pricing.output_cost_per_million_tokens) * multiplier

            if pricing.cached_read_cost_per_million_tokens is not None:
                cache_read_cost = float(pricing.cached_read_cost_per_million_tokens) * multiplier
            else:
                # Matches calculator fallback: cache read billed at input rate
                cache_read_cost = input_cost

            models_out.append({
                'id': model.id,
                'name': model.name,
                'priority': model.priority,
                'requires_subscription': not model.is_free_tier,
                'input_cost_per_million_tokens': round(input_cost, 4),
                'output_cost_per_million_tokens': round(output_cost, 4),
                'cached_read_cost_per_million_tokens': round(cache_read_cost, 4),
            })

        models_out.sort(
            key=lambda m: (
                not m['requires_subscription'],  # paid first
                -m['priority'],
                m['name'].lower(),
            )
        )

        return {
            'success': True,
            'models': models_out,
            'markup_multiplier': float(TOKEN_PRICE_MULTIPLIER),
            'credits_per_dollar': float(CREDITS_PER_DOLLAR),
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Error getting model pricing: {e}")
        raise HTTPException(status_code=500, detail="Failed to get model pricing")


@router.get("/credit-breakdown")
async def get_credit_breakdown(
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> Dict:
    from core.billing import repo as billing_repo
    
    try:
        balance_result = await credit_service.get_balance(account_id)
        if isinstance(balance_result, dict):
            current_balance = float(balance_result.get('total', 0))
        else:
            current_balance = float(balance_result)
        
        total_purchased, purchases = await billing_repo.get_purchases(account_id)
        
        return {
            "balance": current_balance * CREDITS_PER_DOLLAR,
            "total_purchased": total_purchased * CREDITS_PER_DOLLAR,
            "breakdown": purchases
        }
    except Exception as e:
        logger.error(f"[BILLING] Error getting credit breakdown: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage-history")
async def get_usage_history(
    days: int = 30,
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> Dict:
    from core.billing import repo as billing_repo
    from datetime import timedelta
    
    try:
        total_usage, usage_history = await billing_repo.get_usage_history(account_id, days)
        
        since_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        return {
            'usage_history': usage_history,
            'total_usage': total_usage * CREDITS_PER_DOLLAR,
            'period_days': days,
            'period_start': since_date.isoformat()
        }
    except Exception as e:
        logger.error(f"[BILLING] Error getting usage history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/track-pricing-view")
async def track_pricing_view(
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> Dict:
    """Track when a user views the pricing modal (for funnel analytics)."""
    from core.services.supabase import DBConnection

    try:
        db = DBConnection()
        client = await db.client

        await client.rpc('track_pricing_view', {
            'p_user_id': account_id
        }).execute()

        return {'success': True}
    except Exception as e:
        logger.error(f"[BILLING] Error tracking pricing view: {e}")
        # Don't fail the request - tracking is non-critical
        return {'success': False}


@router.post("/track-checkout-click")
async def track_checkout_click(
    tier: str = Query(None, description="Tier being subscribed to"),
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> Dict:
    """Track when a user clicks subscribe/checkout (before going to Stripe)."""
    from core.services.supabase import DBConnection

    try:
        db = DBConnection()
        client = await db.client

        await client.rpc('track_checkout_click', {
            'p_user_id': account_id,
            'p_tier': tier
        }).execute()

        return {'success': True}
    except Exception as e:
        logger.error(f"[BILLING] Error tracking checkout click: {e}")
        # Don't fail the request - tracking is non-critical
        return {'success': False}
