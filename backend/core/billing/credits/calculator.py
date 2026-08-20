from decimal import Decimal
from core.ai_models import model_manager
from core.utils.logger import logger
from ..shared.config import TOKEN_PRICE_MULTIPLIER


def calculate_token_cost(prompt_tokens: int, completion_tokens: int, model: str) -> Decimal:
    """Calculate token cost for a model.
    
    Args:
        prompt_tokens: Number of input/prompt tokens
        completion_tokens: Number of output/completion tokens
        model: Model identifier (registry ID, alias, or LiteLLM model ID)
    
    Returns:
        Total cost in dollars with markup applied
    """
    try:
        logger.debug(f"[COST_CALC] Calculating cost for model '{model}' with {prompt_tokens} prompt + {completion_tokens} completion tokens")
        
        # Skip cost calculation for test harness mock model
        if model == "mock-ai":
            logger.debug(f"[COST_CALC] Skipping cost calculation for mock-ai (test harness)")
            return Decimal('0')
        
        # Use get_pricing which handles registry models, aliases, and fallback LiteLLM IDs
        # Also handles model ID normalization (e.g., minimax/minimax-m2.1 -> openrouter/minimax/minimax-m2.1)
        pricing = model_manager.get_pricing(model)
        
        if pricing:
            input_cost = Decimal(prompt_tokens) / Decimal('1000000') * Decimal(str(pricing.input_cost_per_million_tokens))
            output_cost = Decimal(completion_tokens) / Decimal('1000000') * Decimal(str(pricing.output_cost_per_million_tokens))
            total_cost = (input_cost + output_cost) * TOKEN_PRICE_MULTIPLIER
            
            logger.debug(f"[COST_CALC] Model '{model}' pricing: input=${pricing.input_cost_per_million_tokens}/M, output=${pricing.output_cost_per_million_tokens}/M")
            logger.debug(f"[COST_CALC] Calculated: input=${input_cost:.6f}, output=${output_cost:.6f}, total with {TOKEN_PRICE_MULTIPLIER}x markup=${total_cost:.6f}")
            
            return total_cost
        
        # Log which model ID failed to resolve - helpful for debugging
        logger.warning(f"[COST_CALC] No pricing found for model '{model}'. Check if model is registered in ai_models/registry.py")
        return Decimal('0.01')
    except Exception as e:
        logger.error(f"[COST_CALC] Error calculating token cost for model '{model}': {e}")
        return Decimal('0.01')

def calculate_cached_token_cost(cached_tokens: int, model: str) -> Decimal:
    """Calculate cost for cached token reads (cache hits).
    
    Uses cached_read_cost_per_million_tokens if available, otherwise falls back to regular input pricing.
    
    Args:
        cached_tokens: Number of tokens read from cache
        model: Model identifier (registry ID, alias, or LiteLLM model ID)
    
    Returns:
        Cost in dollars with markup applied
    """
    try:
        # Skip cost calculation for test harness mock model
        if model == "mock-ai":
            return Decimal('0')
        
        pricing = model_manager.get_pricing(model)
        
        if pricing:
            cached_read_cost_per_token = pricing.cached_read_cost_per_token
            cost = Decimal(cached_tokens) * Decimal(str(cached_read_cost_per_token)) * TOKEN_PRICE_MULTIPLIER
            logger.debug(f"[COST_CALC] Cached read cost for {cached_tokens} tokens @ ${pricing.cached_read_cost_per_million_tokens}/M: ${cost:.6f}")
            return cost
        
        # Fall back to regular input pricing if no cached pricing available
        logger.debug(f"[COST_CALC] No cached read pricing for model '{model}', using regular input pricing")
        return calculate_token_cost(cached_tokens, 0, model)
    except Exception as e:
        logger.error(f"[COST_CALC] Error calculating cached token cost for model '{model}': {e}")
        return calculate_token_cost(cached_tokens, 0, model)

def calculate_cache_write_cost(cache_creation_tokens: int, model: str, cache_ttl: str = "5m") -> Decimal:
    """Calculate cost for cache creation (cache writes).
    
    Uses cache_write_5m_cost_per_million_tokens or cache_write_1h_cost_per_million_tokens based on TTL.
    Defaults to 5-minute cache pricing.
    
    Args:
        cache_creation_tokens: Number of tokens written to cache
        model: Model identifier (registry ID, alias, or LiteLLM model ID)
        cache_ttl: Cache time-to-live ("5m" or "1h")
    
    Returns:
        Cost in dollars with markup applied
    """
    try:
        # Skip cost calculation for test harness mock model
        if model == "mock-ai":
            return Decimal('0')
        
        pricing = model_manager.get_pricing(model)
        
        if pricing:
            if cache_ttl == "1h":
                cache_write_cost_per_token = pricing.cache_write_1h_cost_per_token
                cost_per_million = pricing.cache_write_1h_cost_per_million_tokens
            else:
                # Default to 5-minute cache pricing
                cache_write_cost_per_token = pricing.cache_write_5m_cost_per_token
                cost_per_million = pricing.cache_write_5m_cost_per_million_tokens
            
            cost = Decimal(cache_creation_tokens) * Decimal(str(cache_write_cost_per_token)) * TOKEN_PRICE_MULTIPLIER
            logger.debug(f"[COST_CALC] Cache write cost for {cache_creation_tokens} tokens @ ${cost_per_million}/M (TTL: {cache_ttl}): ${cost:.6f}")
            return cost
        
        # Fall back to regular input pricing if no cache write pricing available
        logger.debug(f"[COST_CALC] No cache write pricing for model '{model}', using regular input pricing")
        return calculate_token_cost(cache_creation_tokens, 0, model)
    except Exception as e:
        logger.error(f"[COST_CALC] Error calculating cache write cost for model '{model}': {e}")
        return calculate_token_cost(cache_creation_tokens, 0, model)


def cached_tokens_from_usage(usage) -> int:
    if not usage:
        return 0
    direct = getattr(usage, "cache_read_input_tokens", None)
    if direct:
        return int(direct)
    details = getattr(usage, "prompt_tokens_details", None)
    if isinstance(details, dict):
        return int(details.get("cached_tokens") or details.get("cache_read_input_tokens") or 0)
    if details is not None:
        return int(getattr(details, "cached_tokens", 0) or 0)
    if isinstance(usage, dict):
        nested = usage.get("prompt_tokens_details") or {}
        return int(nested.get("cached_tokens") or usage.get("cache_read_input_tokens") or 0)
    return 0


def estimate_cached_prompt_tokens(prompt_tokens: int, previous_prompt_tokens: int) -> int:
    """When the provider omits cache stats on the stream, reuse the prior prompt prefix.

    Subtract a small allowance for the new screenshot and tool result so we do not
    treat those fresh tokens as cached.
    """
    if prompt_tokens <= 0 or previous_prompt_tokens <= 0:
        return 0
    return max(0, min(prompt_tokens, previous_prompt_tokens - 2000))
