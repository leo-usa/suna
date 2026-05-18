from typing import Dict, List, Optional
from core.utils.cache import Cache
from core.utils.logger import logger
from core.billing.shared.config import TIERS, TRIAL_TIER, PREPAID_UNLOCK_TIER_NAME
from core.billing import repo as billing_repo


def _tier_to_info(tier_obj, trial_status: Optional[str]) -> Dict:
    return {
        'name': tier_obj.name,
        'display_name': tier_obj.display_name,
        'credits': float(tier_obj.monthly_credits),
        'can_purchase_credits': tier_obj.can_purchase_credits,
        'models': tier_obj.models,
        'project_limit': tier_obj.project_limit,
        'thread_limit': tier_obj.thread_limit,
        'concurrent_runs': tier_obj.concurrent_runs,
        'custom_workers_limit': tier_obj.custom_workers_limit,
        'scheduled_triggers_limit': tier_obj.scheduled_triggers_limit,
        'app_triggers_limit': tier_obj.app_triggers_limit,
        'dedicated_computer_limit': tier_obj.dedicated_computer_limit,
        'agent_limit': tier_obj.custom_workers_limit,
        'is_trial': trial_status == 'active',
    }


def _cached_tier_needs_prepaid_recheck(cached: Dict) -> bool:
    """Free-tier cache entries may be stale after a credit purchase."""
    if cached.get('prepaid_unlock'):
        return False
    return cached.get('name') in ('free', 'none')


class TierHandler:
    @staticmethod
    async def get_user_subscription_tier(account_id: str, skip_cache: bool = False) -> Dict:
        import time
        t_start = time.time()
        
        if not skip_cache:
            try:
                from core.cache.runtime_cache import get_cached_tier_info
                redis_cached = await get_cached_tier_info(account_id)
                if redis_cached and not _cached_tier_needs_prepaid_recheck(redis_cached):
                    logger.info(f"[TIER] Cache hit for {account_id[:8]}... tier={redis_cached.get('name')} thread_limit={redis_cached.get('thread_limit')} project_limit={redis_cached.get('project_limit')}")
                    return redis_cached
            except Exception:
                pass
            
            cache_key = f"subscription_tier:{account_id}"
            cached = await Cache.get(cache_key)
            if cached and not _cached_tier_needs_prepaid_recheck(cached):
                return cached
        
        credit_result = await billing_repo.get_credit_account_subscription_info(account_id)
        
        tier_name = 'none'
        trial_status = None
        
        if credit_result:
            tier_name = credit_result.get('tier', 'none')
            trial_status = credit_result.get('trial_status')
        
        if trial_status == 'active' and tier_name == 'none':
            tier_name = TRIAL_TIER
            logger.info(f"[TIER] Trial active but tier=none for {account_id}, using TRIAL_TIER: {TRIAL_TIER}")
        
        tier_obj = TIERS.get(tier_name, TIERS['none'])
        tier_info = _tier_to_info(tier_obj, trial_status)

        if tier_name in ('free', 'none'):
            balances = await billing_repo.get_credit_account_balances(account_id)
            non_expiring = float((balances or {}).get('non_expiring_credits') or 0)
            if non_expiring > 0:
                unlock_tier = TIERS.get(PREPAID_UNLOCK_TIER_NAME, TIERS['tier_2_20'])
                tier_info = _tier_to_info(unlock_tier, trial_status)
                tier_info['prepaid_unlock'] = True
                tier_info['billing_tier'] = tier_name
                logger.info(
                    f"[TIER] Prepaid unlock for {account_id[:8]}... "
                    f"billing_tier={tier_name} effective={unlock_tier.name} "
                    f"non_expiring=${non_expiring:.2f}"
                )

        logger.info(
            f"[TIER] Fresh fetch for {account_id[:8]}... tier={tier_info['name']} "
            f"thread_limit={tier_info['thread_limit']} project_limit={tier_info['project_limit']}"
        )
        
        try:
            from core.cache.runtime_cache import set_cached_tier_info
            await set_cached_tier_info(account_id, tier_info)
        except Exception:
            pass
        
        cache_key = f"subscription_tier:{account_id}"
        await Cache.set(cache_key, tier_info, ttl=60)
        return tier_info

    @staticmethod
    async def get_allowed_models_for_user(user_id: str, client=None) -> List[str]:
        try:
            from core.ai_models import model_manager
            from core.billing.shared.config import is_model_allowed

            tier_info = await TierHandler.get_user_subscription_tier(user_id)
            tier_name = tier_info['name']
            
            logger.debug(f"[ALLOWED_MODELS] User {user_id} tier: {tier_name}")

            if tier_info.get('models'):
                all_models = model_manager.list_available_models(include_disabled=False)
                allowed_model_ids = []
                
                for model_data in all_models:
                    model_id = model_data["id"]
                    if is_model_allowed(tier_name, model_id):
                        allowed_model_ids.append(model_id)
                
                logger.debug(f"[ALLOWED_MODELS] User {user_id} has access to {len(allowed_model_ids)} models: {[m for m in allowed_model_ids]}")
                return allowed_model_ids
            
            else:
                logger.debug(f"[ALLOWED_MODELS] User {user_id} has no model access (tier: {tier_name})")
                return []
                
        except Exception as e:
            logger.error(f"[ALLOWED_MODELS] Error getting allowed models for user {user_id}: {e}")
            return []
