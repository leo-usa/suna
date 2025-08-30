import logging

# Master model configuration - single source of truth
MODELS = {
    # Free tier models

    "anthropic/claude-sonnet-4-20250514": {
        "aliases": ["claude-sonnet-4"],
        "pricing": {
            "input_cost_per_million_tokens": 3.00,
            "output_cost_per_million_tokens": 15.00
        },
        "tier_availability": ["free", "paid"],
        "max_output_tokens": 64000,
        "recommended_safe_limit": 50000
    },
    # "openrouter/deepseek/deepseek-chat": {
    #     "aliases": ["deepseek"],
    #     "pricing": {
    #         "input_cost_per_million_tokens": 0.38,
    #         "output_cost_per_million_tokens": 0.89
    #     },
    #     "tier_availability": ["free", "paid"],
    #     "max_output_tokens": 8192,
    #     "recommended_safe_limit": 7000
    # },
    # "openrouter/qwen/qwen3-235b-a22b": {
    #     "aliases": ["qwen3"],
    #     "pricing": {
    #         "input_cost_per_million_tokens": 0.13,
    #         "output_cost_per_million_tokens": 0.60
    #     },
    #     "tier_availability": ["free", "paid"],
    #     "max_output_tokens": 8192,
    #     "recommended_safe_limit": 7000
    # },
    # "openrouter/google/gemini-2.5-flash-preview-05-20": {
    #     "aliases": ["gemini-flash-2.5"],
    #     "pricing": {
    #         "input_cost_per_million_tokens": 0.15,
    #         "output_cost_per_million_tokens": 0.60
    #     },
    #     "tier_availability": ["free", "paid"],
    #     "max_output_tokens": 64000,
    #     "recommended_safe_limit": 50000
    # },
    # "openrouter/deepseek/deepseek-chat-v3-0324": {
    #     "aliases": ["deepseek/deepseek-chat-v3-0324"],
    #     "pricing": {
    #         "input_cost_per_million_tokens": 0.38,
    #         "output_cost_per_million_tokens": 0.89
    #     },
    #     "tier_availability": ["free", "paid"],
    #     "max_output_tokens": 8192,
    #     "recommended_safe_limit": 7000
    # },
    "openrouter/moonshotai/kimi-k2": {
        "aliases": ["moonshotai/kimi-k2"],
        "pricing": {
            "input_cost_per_million_tokens": 1.00,
            "output_cost_per_million_tokens": 3.00
        },
        "tier_availability": ["free", "paid"],
        "max_output_tokens": 128000,
        "recommended_safe_limit": 100000
    },
    "openrouter/z-ai/glm-4.5": {
        "aliases": ["z-ai/glm-4.5"],
        "pricing": {
            "input_cost_per_million_tokens": 0.60,
            "output_cost_per_million_tokens": 2.20
        },
        "tier_availability": ["free", "paid"],
        "max_output_tokens": 8192,
        "recommended_safe_limit": 7000
    },
    "openrouter/openai/gpt-5-chat": {
        "aliases": ["gpt-5-chat"],
        "pricing": {
            "input_cost_per_million_tokens": 1.25,
            "output_cost_per_million_tokens": 10.00
        },
        "tier_availability": ["free", "paid"],
        "max_output_tokens": 4096,
        "recommended_safe_limit": 3000
    },
    "openrouter/openai/gpt-5": {
        "aliases": ["gpt-5"],
        "pricing": {
            "input_cost_per_million_tokens": 1.25,
            "output_cost_per_million_tokens": 10.00
        },
        "tier_availability": ["free", "paid"],
        "max_output_tokens": 4096,
        "recommended_safe_limit": 3000
    },
    "openrouter/openai/gpt-5-mini": {
        "aliases": ["gpt-5-mini"],
        "pricing": {
            "input_cost_per_million_tokens": 0.25,
            "output_cost_per_million_tokens": 2.00
        },
        "tier_availability": ["free", "paid"],
        "max_output_tokens": 4096,
        "recommended_safe_limit": 3000
    },
    "openrouter/openai/gpt-5-nano": {
        "aliases": ["gpt-5-nano"],
        "pricing": {
            "input_cost_per_million_tokens": 0.05,
            "output_cost_per_million_tokens": 0.40
        },
        "tier_availability": ["free", "paid"],
        "max_output_tokens": 4096,
        "recommended_safe_limit": 3000
    },
    "openrouter/xai/grok-4": {
        "aliases": ["grok-4"],
        "pricing": {
            "input_cost_per_million_tokens": 5.00,
            "output_cost_per_million_tokens": 15.00
        },
        "tier_availability": ["paid"],
        "max_output_tokens": 8192,
        "recommended_safe_limit": 7000
    },
    
    # Paid tier only models
    "openrouter/google/gemini-2.5-pro": {
        "aliases": ["google/gemini-2.5-pro"],
        "pricing": {
            "input_cost_per_million_tokens": 1.25,
            "output_cost_per_million_tokens": 10.00
        },
        "tier_availability": ["paid"],
        "max_output_tokens": 66000,
        "recommended_safe_limit": 52000
    },
    "openai/gpt-4o": {
        "aliases": ["gpt-4o"],
        "pricing": {
            "input_cost_per_million_tokens": 2.50,
            "output_cost_per_million_tokens": 10.00
        },
        "tier_availability": ["paid"],
        "max_output_tokens": 4096,
        "recommended_safe_limit": 3000
    },
    "openai/gpt-4.1": {
        "aliases": ["gpt-4.1"],
        "pricing": {
            "input_cost_per_million_tokens": 15.00,
            "output_cost_per_million_tokens": 60.00
        },
        "tier_availability": ["paid"],
        "max_output_tokens": 4096,
        "recommended_safe_limit": 3000
    },
    "openai/gpt-4.1-mini": {
        "aliases": ["gpt-4.1-mini"],
        "pricing": {
            "input_cost_per_million_tokens": 1.50,
            "output_cost_per_million_tokens": 6.00
        },
        "tier_availability": ["paid"],
        "max_output_tokens": 4096,
        "recommended_safe_limit": 3000
    },
    "anthropic/claude-3-7-sonnet-latest": {
        "aliases": ["sonnet-3.7"],
        "pricing": {
            "input_cost_per_million_tokens": 3.00,
            "output_cost_per_million_tokens": 15.00
        },
        "tier_availability": ["paid"],
        "max_output_tokens": 64000,
        "recommended_safe_limit": 50000
    },
    "anthropic/claude-3-5-sonnet-latest": {
        "aliases": ["sonnet-3.5"],
        "pricing": {
            "input_cost_per_million_tokens": 3.00,
            "output_cost_per_million_tokens": 15.00
        },
        "tier_availability": ["paid"],
        "max_output_tokens": 8192,
        "recommended_safe_limit": 7000
    },
    
    # Latest OpenAI Open Source and Anthropic Models
    "openrouter/openai/gpt-oss-120b": {
        "aliases": ["gpt-oss-120b"],
        "pricing": {
            "input_cost_per_million_tokens": 0.09,
            "output_cost_per_million_tokens": 0.45
        },
        "tier_availability": ["free", "paid"],
        "max_output_tokens": 8192,
        "recommended_safe_limit": 7000
    },
    "openrouter/openai/gpt-oss-20b": {
        "aliases": ["gpt-oss-20b"],
        "pricing": {
            "input_cost_per_million_tokens": 0.04,
            "output_cost_per_million_tokens": 0.16
        },
        "tier_availability": ["free", "paid"],
        "max_output_tokens": 8192,
        "recommended_safe_limit": 7000
    },
    "openrouter/anthropic/claude-opus-4.1": {
        "aliases": ["claude-opus-4.1"],
        "pricing": {
            "input_cost_per_million_tokens": 15.00,
            "output_cost_per_million_tokens": 75.00
        },
        "tier_availability": ["paid"],
        "max_output_tokens": 32000,
        "recommended_safe_limit": 25000
    },   
}

# Image generation pricing configuration
IMAGE_PRICING = {
    "gpt-image-1": {
        "generation_cost_per_image": 0.040,  # $0.040 per image generation
        "editing_cost_per_image": 0.080,     # $0.080 per image editing
        "sizes": {
            "1024x1024": 1.0,      # Base multiplier
            "1024x1536": 1.0,      # Same cost
            "1536x1024": 1.0       # Same cost
        }
    }
}

# Derived structures (auto-generated from MODELS)
def _generate_model_structures():
    """Generate all model structures from the master MODELS dictionary."""
    
    # Generate tier lists
    free_models = []
    paid_models = []
    
    # Generate aliases
    aliases = {}
    
    # Generate pricing
    pricing = {}
    
    for model_name, config in MODELS.items():
        # Add to tier lists
        if "free" in config["tier_availability"]:
            free_models.append(model_name)
        if "paid" in config["tier_availability"]:
            paid_models.append(model_name)
        
        # Add aliases
        for alias in config["aliases"]:
            aliases[alias] = model_name
        
        # Add pricing
        pricing[model_name] = config["pricing"]
        
        # Also add pricing for legacy model name variations
        if model_name.startswith("openrouter/deepseek/"):
            legacy_name = model_name.replace("openrouter/", "")
            pricing[legacy_name] = config["pricing"]
        elif model_name.startswith("openrouter/qwen/"):
            legacy_name = model_name.replace("openrouter/", "")
            pricing[legacy_name] = config["pricing"]
        elif model_name.startswith("openrouter/google/"):
            legacy_name = model_name.replace("openrouter/", "")
            pricing[legacy_name] = config["pricing"]
        elif model_name.startswith("anthropic/"):
            # Add anthropic/claude-sonnet-4 alias for claude-sonnet-4-20250514
            if "claude-sonnet-4-20250514" in model_name:
                pricing["anthropic/claude-sonnet-4"] = config["pricing"]
    
    return free_models, paid_models, aliases, pricing

# Generate all structures
FREE_TIER_MODELS, PAID_TIER_MODELS, MODEL_NAME_ALIASES, HARDCODED_MODEL_PRICES = _generate_model_structures()

MODEL_ACCESS_TIERS = {
    "free": FREE_TIER_MODELS,
    "tier_2_20": PAID_TIER_MODELS,
    "tier_6_50": PAID_TIER_MODELS,
    "tier_12_100": PAID_TIER_MODELS,
    "tier_25_200": PAID_TIER_MODELS,
    "tier_50_400": PAID_TIER_MODELS,
    "tier_125_800": PAID_TIER_MODELS,
    "tier_200_1000": PAID_TIER_MODELS,
}

logger = logging.getLogger(__name__)

def get_model_token_limits(model_name: str) -> dict:
    """Get token limits for a specific model.
    
    Args:
        model_name: The name of the model (can be full name or alias)
        
    Returns:
        Dict with max_output_tokens, recommended_safe_limit, and model_id
    """
    # Find the model by name or alias
    for model_id, model_config in MODELS.items():
        # Check if model_name matches the model_id
        if model_name.lower() in model_id.lower():
            return {
                "max_output_tokens": model_config.get("max_output_tokens", 4096),
                "recommended_safe_limit": model_config.get("recommended_safe_limit", 3000),
                "model_id": model_id
            }
        
        # Check if model_name matches any aliases
        aliases = model_config.get("aliases", [])
        for alias in aliases:
            if model_name.lower() in alias.lower():
                return {
                    "max_output_tokens": model_config.get("max_output_tokens", 4096),
                    "recommended_safe_limit": model_config.get("recommended_safe_limit", 3000),
                    "model_id": model_id
                }
    
    # Default fallback for unknown models
    logger.warning(f"Unknown model '{model_name}', using default token limits")
    return {
        "max_output_tokens": 4096,
        "recommended_safe_limit": 3000,
        "model_id": "unknown"
    }
