from typing import Dict, List, Optional, Tuple, Any
from .models import Model, ModelProvider, ModelCapability, ModelPricing, ModelConfig, ReasoningSettings
from .providers import provider_registry
from .providers.anthropic import BedrockProvider
from core.utils.config import config, EnvMode
from core.utils.logger import logger


class BedrockConfig:
    REGION = "us-west-2"
    ACCOUNT_ID = "935064898258"
    
    PROFILE_IDS = {
        "haiku_4_5": "heol2zyy5v48",
        "sonnet_4_5": "few7z4l830xh",
        "kimi_k2": "hfgufmm5fgcq",
        "minimax_m2": "zix3khptbyoe",
    }
    
    @classmethod
    def build_arn(cls, profile_id: str) -> str:
        return f"bedrock/converse/arn:aws:bedrock:{cls.REGION}:{cls.ACCOUNT_ID}:application-inference-profile/{profile_id}"
    
    @classmethod
    def get_haiku_arn(cls) -> str:
        return cls.build_arn(cls.PROFILE_IDS["haiku_4_5"])
    
    @classmethod
    def get_sonnet_arn(cls) -> str:
        return cls.build_arn(cls.PROFILE_IDS["sonnet_4_5"])


class PricingPresets:
    HAIKU_4_5 = ModelPricing(
        input_cost_per_million_tokens=1.00,
        output_cost_per_million_tokens=5.00,
        cached_read_cost_per_million_tokens=0.10,
        cache_write_5m_cost_per_million_tokens=1.25,
        cache_write_1h_cost_per_million_tokens=2.00,
    )
    
    MINIMAX_M2 = ModelPricing(
        input_cost_per_million_tokens=0.30,
        output_cost_per_million_tokens=1.20,
        cached_read_cost_per_million_tokens=0.03,
        cache_write_5m_cost_per_million_tokens=0.375,
    )
    
    GROK_4_1_FAST = ModelPricing(
        input_cost_per_million_tokens=0.20,
        output_cost_per_million_tokens=0.50,
        cached_read_cost_per_million_tokens=0.05,
    )
    
    GPT_4O_MINI = ModelPricing(
        input_cost_per_million_tokens=0.15,
        output_cost_per_million_tokens=0.60,
        cached_read_cost_per_million_tokens=0.075,
    )

    MIMO_V2_FLASH = ModelPricing(
        input_cost_per_million_tokens=0.10,
        output_cost_per_million_tokens=0.30,
        cached_read_cost_per_million_tokens=0.02,
    )

    KIMI_K2 = ModelPricing(
        input_cost_per_million_tokens=0.40,
        output_cost_per_million_tokens=1.75,
        cached_read_cost_per_million_tokens=0.15,
    )

    KIMI_K2_5 = ModelPricing(
        input_cost_per_million_tokens=0.60,
        output_cost_per_million_tokens=3.00,
        cached_read_cost_per_million_tokens=0.095,
    )

    HAIKU_3_5 = ModelPricing(
        input_cost_per_million_tokens=0.80,
        output_cost_per_million_tokens=4.00,
        cached_read_cost_per_million_tokens=0.08,
    )

    DEEPSEEK_V3 = ModelPricing(
        input_cost_per_million_tokens=0.14,
        output_cost_per_million_tokens=0.28,
        cached_read_cost_per_million_tokens=0.014,
    )

    DEEPSEEK_V4_FLASH = ModelPricing(
        input_cost_per_million_tokens=0.14,
        output_cost_per_million_tokens=0.28,
        cached_read_cost_per_million_tokens=0.028,
    )

    DEEPSEEK_V4_PRO = ModelPricing(
        input_cost_per_million_tokens=0.435,
        output_cost_per_million_tokens=0.87,
        cached_read_cost_per_million_tokens=0.003625,
    )

    CLAUDE_SONNET_5 = ModelPricing(
        input_cost_per_million_tokens=2.00,
        output_cost_per_million_tokens=10.00,
        cached_read_cost_per_million_tokens=0.20,
        cache_write_5m_cost_per_million_tokens=2.50,
    )

    CLAUDE_OPUS_4_7 = ModelPricing(
        input_cost_per_million_tokens=5.00,
        output_cost_per_million_tokens=25.00,
        cached_read_cost_per_million_tokens=0.50,
        cache_write_5m_cost_per_million_tokens=6.25,
    )

    CLAUDE_OPUS_5 = ModelPricing(
        input_cost_per_million_tokens=5.00,
        output_cost_per_million_tokens=25.00,
        cached_read_cost_per_million_tokens=0.50,
        cache_write_5m_cost_per_million_tokens=6.25,
    )

    CLAUDE_FABLE_5 = ModelPricing(
        input_cost_per_million_tokens=10.00,
        output_cost_per_million_tokens=50.00,
        cached_read_cost_per_million_tokens=1.00,
        cache_write_5m_cost_per_million_tokens=12.50,
    )

    GEMINI_2_5_PRO = ModelPricing(
        input_cost_per_million_tokens=1.25,
        output_cost_per_million_tokens=10.00,
        cached_read_cost_per_million_tokens=0.125,
        cache_write_5m_cost_per_million_tokens=0.375,
    )

    GEMINI_3_1_PRO = ModelPricing(
        input_cost_per_million_tokens=2.00,
        output_cost_per_million_tokens=12.00,
        cached_read_cost_per_million_tokens=0.20,
        cache_write_5m_cost_per_million_tokens=0.375,
    )

    GEMINI_3_5_FLASH_LITE = ModelPricing(
        input_cost_per_million_tokens=0.30,
        output_cost_per_million_tokens=2.50,
        cached_read_cost_per_million_tokens=0.03,
        cache_write_5m_cost_per_million_tokens=0.0833,
    )

    GEMINI_3_6_FLASH = ModelPricing(
        input_cost_per_million_tokens=1.50,
        output_cost_per_million_tokens=7.50,
        cached_read_cost_per_million_tokens=0.15,
        cache_write_5m_cost_per_million_tokens=0.0833,
    )

    GEMMA_4_31B = ModelPricing(
        input_cost_per_million_tokens=0.13,
        output_cost_per_million_tokens=0.38,
    )

    GROK_4 = ModelPricing(
        input_cost_per_million_tokens=5.00,
        output_cost_per_million_tokens=15.00,
    )

    GROK_4_5 = ModelPricing(
        input_cost_per_million_tokens=2.00,
        output_cost_per_million_tokens=6.00,
        cached_read_cost_per_million_tokens=0.30,
    )

    KIMI_K2_6 = ModelPricing(
        input_cost_per_million_tokens=0.55,
        output_cost_per_million_tokens=2.50,
        cached_read_cost_per_million_tokens=0.11,
    )

    KIMI_K3 = ModelPricing(
        input_cost_per_million_tokens=3.00,
        output_cost_per_million_tokens=15.00,
        cached_read_cost_per_million_tokens=0.30,
    )

    GLM_5_2 = ModelPricing(
        input_cost_per_million_tokens=1.40,
        output_cost_per_million_tokens=4.40,
        cached_read_cost_per_million_tokens=0.13,
    )

    QWEN_3_8_MAX = ModelPricing(
        input_cost_per_million_tokens=2.00,
        output_cost_per_million_tokens=6.00,
        cached_read_cost_per_million_tokens=0.25,
        cache_write_5m_cost_per_million_tokens=2.50,
    )

    MINIMAX_M2_7 = ModelPricing(
        input_cost_per_million_tokens=0.30,
        output_cost_per_million_tokens=1.20,
        cached_read_cost_per_million_tokens=0.05,
    )

    GPT_5_5 = ModelPricing(
        input_cost_per_million_tokens=5.00,
        output_cost_per_million_tokens=30.00,
        cached_read_cost_per_million_tokens=0.50,
    )

    GPT_5_5_PRO = ModelPricing(
        input_cost_per_million_tokens=30.00,
        output_cost_per_million_tokens=180.00,
    )

    GPT_5_6_LUNA = ModelPricing(
        input_cost_per_million_tokens=0.20,
        output_cost_per_million_tokens=1.20,
        cached_read_cost_per_million_tokens=0.02,
        cache_write_5m_cost_per_million_tokens=0.25,
    )

    GPT_5_6_TERRA = ModelPricing(
        input_cost_per_million_tokens=2.50,
        output_cost_per_million_tokens=15.00,
        cached_read_cost_per_million_tokens=0.25,
        cache_write_5m_cost_per_million_tokens=3.125,
    )

    GPT_5_6_SOL = ModelPricing(
        input_cost_per_million_tokens=5.00,
        output_cost_per_million_tokens=30.00,
        cached_read_cost_per_million_tokens=0.50,
        cache_write_5m_cost_per_million_tokens=6.25,
    )


FREE_MODEL_ID = "dobby/gpt-5.6-luna"
PREMIUM_MODEL_ID = "dobby/power"
IMAGE_MODEL_ID = "dobby/haiku"


def _create_anthropic_model_config() -> ModelConfig:
    return ModelConfig()


def _create_minimax_model_config() -> ModelConfig:
    return ModelConfig(
        reasoning=ReasoningSettings(enabled=True, split_output=True),
        extra_body={"app": "Dobby.now"},
    )

def _create_kimi_model_config() -> ModelConfig:
    
    
    return ModelConfig(
        reasoning=ReasoningSettings(enabled=True)
        # reasoning always
        # reasoning=ReasoningSettings(enabled=True)

    )



def _should_use_bedrock() -> bool:
    return config.ENV_MODE in (EnvMode.STAGING, EnvMode.PRODUCTION) and config.MAIN_LLM == "bedrock"


def _get_main_llm() -> str:
    return getattr(config, 'MAIN_LLM', 'anthropic')


def _get_main_llm_model() -> Optional[str]:
    return getattr(config, 'MAIN_LLM_MODEL', None)

class ModelFactory:
    @staticmethod
    def create_anthropic_haiku(use_bedrock: bool = False) -> Model:
        if use_bedrock:
            litellm_id = BedrockConfig.get_haiku_arn()
            provider = ModelProvider.BEDROCK
        else:
            litellm_id = "anthropic/claude-haiku-4-5-20251001"
            provider = ModelProvider.ANTHROPIC
        
        return Model(
            id="dobby/haiku",
            name="Claude Haiku 4.5",
            litellm_model_id=litellm_id,
            provider=provider,
            aliases=[litellm_id],
            context_window=200_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.HAIKU_4_5,
            tier_availability=["free", "paid"],
            priority=50,
            recommended=False,
            enabled=True,
            config=_create_anthropic_model_config(),
        )
    
    @staticmethod
    def create_minimax_m2(use_openrouter: bool = True) -> Model:
        if use_openrouter:
            litellm_id = "openrouter/minimax/minimax-m2.1"
            provider = ModelProvider.OPENROUTER
        else:
            litellm_id = "minimax/MiniMax-M2.1"
            provider = ModelProvider.MINIMAX
        
        return Model(
            id="dobby/minimax",
            name="MiniMax M2.1",
            litellm_model_id=litellm_id,
            provider=provider,
            aliases=["minimax-m2", "minimax-m2.1"],
            context_window=200_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.MINIMAX_M2,
            tier_availability=["free", "paid"],
            priority=100,
            recommended=False,
            enabled=True,
            config=_create_minimax_model_config(),
        )
    
    @staticmethod
    def create_basic_model(main_llm: str, custom_model: Optional[str] = None) -> Model:
        # Default models per provider
        default_models = {
            "bedrock": BedrockConfig.get_haiku_arn(),
            "anthropic": "openrouter/anthropic/claude-sonnet-5",
            "grok": "openrouter/x-ai/grok-4.1-fast",
            "openai": "openrouter/openai/gpt-4o-mini",
            "minimax": "openrouter/minimax/minimax-m2.1",
            "kimi": "openrouter/moonshotai/kimi-k2.5",
        }

        if main_llm == "kimi":
            return Model(
                id="dobby/basic",
                name="Dobby Basic",
                litellm_model_id=custom_model or default_models["kimi"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-basic", "Dobby Basic"],
                context_window=262_144,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.PROMPT_CACHING,
                    ModelCapability.THINKING,
                ],
                pricing=PricingPresets.KIMI_K2_5,
                tier_availability=["free", "paid"],
                priority=102,
                recommended=True,
                enabled=True,
                config=_create_kimi_model_config(),
            )
        elif main_llm == "bedrock":
            return Model(
                id="dobby/basic",
                name="Dobby Basic",
                litellm_model_id=custom_model or default_models["bedrock"],
                provider=ModelProvider.BEDROCK,
                aliases=["kortix-basic", "Dobby Basic"],
                context_window=200_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.PROMPT_CACHING,
                ],
                pricing=PricingPresets.HAIKU_4_5,
                tier_availability=["free", "paid"],
                priority=102,
                recommended=True,
                enabled=True,
                config=_create_anthropic_model_config(),
            )
        elif main_llm == "anthropic":
            return Model(
                id="dobby/basic",
                name="Dobby Basic",
                litellm_model_id=custom_model or default_models["anthropic"],
                provider=ModelProvider.ANTHROPIC,
                aliases=["kortix-basic", "Dobby Basic"],
                context_window=200_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.PROMPT_CACHING,
                ],
                pricing=PricingPresets.HAIKU_4_5,
                tier_availability=["free", "paid"],
                priority=102,
                recommended=True,
                enabled=True,
                config=_create_anthropic_model_config(),
            )
        elif main_llm == "grok":
            return Model(
                id="dobby/basic",
                name="Dobby Basic",
                litellm_model_id=custom_model or default_models["grok"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-basic", "Dobby Basic"],
                context_window=2_000_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.PROMPT_CACHING,
                ],
                pricing=PricingPresets.GROK_4_1_FAST,
                tier_availability=["free", "paid"],
                priority=102,
                recommended=True,
                enabled=True,
            )
        elif main_llm == "openai":
            return Model(
                id="dobby/basic",
                name="Dobby Basic",
                litellm_model_id=custom_model or default_models["openai"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-basic", "Dobby Basic"],
                context_window=128_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                ],
                pricing=PricingPresets.GPT_4O_MINI,
                tier_availability=["free", "paid"],
                priority=102,
                recommended=True,
                enabled=True,
            )
        elif main_llm == "openrouter":
            # Generic OpenRouter - use custom model or fallback to minimax
            return Model(
                id="dobby/basic",
                name="Dobby Basic",
                litellm_model_id=custom_model or default_models["minimax"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-basic", "Dobby Basic"],
                context_window=200_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                ],
                tier_availability=["free", "paid"],
                priority=102,
                recommended=True,
                enabled=True,
            )
        else:  # minimax or unknown
            return Model(
                id="dobby/basic",
                name="Dobby Basic",
                litellm_model_id=custom_model or default_models["minimax"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-basic", "Dobby Basic"],
                context_window=200_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.THINKING,
                    ModelCapability.PROMPT_CACHING,
                ],
                pricing=PricingPresets.MINIMAX_M2,
                tier_availability=["free", "paid"],
                priority=102,
                recommended=True,
                enabled=True,
                config=_create_minimax_model_config(),
            )
    
    @staticmethod
    def create_power_model(main_llm: str, custom_model: Optional[str] = None) -> Model:
        # Default models per provider (same as basic for now)
        default_models = {
            "bedrock": BedrockConfig.get_haiku_arn(),
            "anthropic": "openrouter/anthropic/claude-sonnet-5",
            "grok": "openrouter/x-ai/grok-4.1-fast",
            "openai": "openrouter/openai/gpt-4o-mini",
            "minimax": "openrouter/minimax/minimax-m2.1",
            "kimi": "openrouter/moonshotai/kimi-k2.5",
        }

        if main_llm == "kimi":
            return Model(
                id="dobby/power",
                name="Dobby Advanced Mode",
                litellm_model_id=custom_model or default_models["kimi"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-power", "Dobby POWER Mode", "Dobby Power", "Dobby Advanced Mode"],
                context_window=262_144,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.THINKING,
                    ModelCapability.PROMPT_CACHING,
                ],
                pricing=PricingPresets.KIMI_K2_5,
                tier_availability=["paid"],
                priority=101,
                recommended=True,
                enabled=True,
                config=_create_kimi_model_config(),
            )
        elif main_llm == "bedrock":
            return Model(
                id="dobby/power",
                name="Dobby Advanced Mode",
                litellm_model_id=custom_model or default_models["bedrock"],
                provider=ModelProvider.BEDROCK,
                aliases=["kortix-power", "Dobby POWER Mode", "Dobby Power", "Dobby Advanced Mode"],
                context_window=200_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.THINKING,
                    ModelCapability.PROMPT_CACHING,
                ],
                pricing=PricingPresets.HAIKU_4_5,
                tier_availability=["paid"],
                priority=101,
                recommended=True,
                enabled=True,
                config=_create_anthropic_model_config(),
            )
        elif main_llm == "anthropic":
            return Model(
                id="dobby/power",
                name="Dobby Advanced Mode",
                litellm_model_id=custom_model or default_models["anthropic"],
                provider=ModelProvider.ANTHROPIC,
                aliases=["kortix-power", "Dobby POWER Mode", "Dobby Power", "Dobby Advanced Mode"],
                context_window=200_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.THINKING,
                    ModelCapability.PROMPT_CACHING,
                ],
                pricing=PricingPresets.HAIKU_4_5,
                tier_availability=["paid"],
                priority=101,
                recommended=True,
                enabled=True,
                config=_create_anthropic_model_config(),
            )
        elif main_llm == "grok":
            return Model(
                id="dobby/power",
                name="Dobby Advanced Mode",
                litellm_model_id=custom_model or default_models["grok"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-power", "Dobby POWER Mode", "Dobby Power", "Dobby Advanced Mode"],
                context_window=2_000_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.THINKING,
                    ModelCapability.PROMPT_CACHING,
                ],
                pricing=PricingPresets.GROK_4_1_FAST,
                tier_availability=["paid"],
                priority=101,
                recommended=True,
                enabled=True,
            )
        elif main_llm == "openai":
            return Model(
                id="dobby/power",
                name="Dobby Advanced Mode",
                litellm_model_id=custom_model or default_models["openai"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-power", "Dobby POWER Mode", "Dobby Power", "Dobby Advanced Mode"],
                context_window=128_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                ],
                pricing=PricingPresets.GPT_4O_MINI,
                tier_availability=["paid"],
                priority=101,
                recommended=True,
                enabled=True,
            )
        elif main_llm == "openrouter":
            # Generic OpenRouter - use custom model or fallback to minimax
            return Model(
                id="dobby/power",
                name="Dobby Advanced Mode",
                litellm_model_id=custom_model or default_models["minimax"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-power", "Dobby POWER Mode", "Dobby Power", "Dobby Advanced Mode"],
                context_window=200_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                ],
                tier_availability=["paid"],
                priority=101,
                recommended=True,
                enabled=True,
            )
        else:  # minimax or unknown
            return Model(
                id="dobby/power",
                name="Dobby Advanced Mode",
                litellm_model_id=custom_model or default_models["minimax"],
                provider=ModelProvider.OPENROUTER,
                aliases=["kortix-power", "Dobby POWER Mode", "Dobby Power", "Dobby Advanced Mode"],
                context_window=200_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.THINKING,
                    ModelCapability.PROMPT_CACHING,
                ],
                pricing=PricingPresets.MINIMAX_M2,
                tier_availability=["paid"],
                priority=101,
                recommended=True,
                enabled=True,
                config=_create_minimax_model_config(),
            )
    
    @staticmethod
    def create_test_model() -> Model:
        return Model(
            id="dobby/test",
            name="Dobby Test",
            litellm_model_id="openrouter/minimax/minimax-m2.1",
            provider=ModelProvider.OPENROUTER,
            aliases=["kortix-test", "Dobby Test"],
            context_window=200_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.MINIMAX_M2,
            tier_availability=["free", "paid"],
            priority=100,
            recommended=False,
            enabled=True,
            config=_create_minimax_model_config(),
        )
    
    @staticmethod
    def create_grok_4_1_fast() -> Model:
        return Model(
            id="dobby/grok-4-1-fast",
            name="Grok 4.1 Fast",
            litellm_model_id="openrouter/x-ai/grok-4.1-fast",
            provider=ModelProvider.OPENROUTER,
            aliases=["grok-4.1-fast", "grok-4-1-fast", "x-ai/grok-4.1-fast"],
            context_window=2_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.GROK_4_1_FAST,
            tier_availability=["paid"],
            priority=90,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_grok_4() -> Model:
        return Model(
            id="dobby/grok-4",
            name="Grok 4",
            litellm_model_id="openrouter/x-ai/grok-4",
            provider=ModelProvider.OPENROUTER,
            aliases=["grok-4", "x-ai/grok-4"],
            context_window=256_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=PricingPresets.GROK_4,
            tier_availability=["paid"],
            priority=91,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_grok_4_5() -> Model:
        return Model(
            id="dobby/grok-4.5",
            name="Grok 4.5",
            litellm_model_id="openrouter/x-ai/grok-4.5",
            provider=ModelProvider.OPENROUTER,
            aliases=["grok-4.5", "grok-4-5", "x-ai/grok-4.5"],
            context_window=500_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=PricingPresets.GROK_4_5,
            tier_availability=["free", "paid"],
            priority=92,
            recommended=False,
            enabled=True,
        )
    
    @staticmethod
    def create_gpt4o_mini() -> Model:
        return Model(
            id="dobby/gpt4o-mini",
            name="GPT-4o Mini",
            litellm_model_id="openrouter/openai/gpt-4o-mini",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-4o-mini", "gpt4o-mini", "openai/gpt-4o-mini"],
            context_window=128_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=PricingPresets.GPT_4O_MINI,
            tier_availability=["free", "paid"],
            priority=95,
            recommended=True,
            enabled=True,
        )

    @staticmethod
    def create_gpt5_mini() -> Model:
        return Model(
            id="dobby/gpt-5-mini",
            name="GPT-5 Mini",
            litellm_model_id="openrouter/openai/gpt-4o-mini",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-4o-mini", "gpt4o-mini", "openai/gpt-4o-mini"],
            context_window=128_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=PricingPresets.GPT_4O_MINI,
            tier_availability=["free", "paid"],
            priority=95,
            recommended=True,
            enabled=True,
        )

    @staticmethod
    def create_mimo_v2_flash() -> Model:
        return Model(
            id="dobby/mimo-v2-flash",
            name="MiMo Flash",
            litellm_model_id="openrouter/xiaomi/mimo-v2-flash",
            provider=ModelProvider.OPENROUTER,
            aliases=["mimo-v2-flash", "xiaomi/mimo-v2-flash", "mimo"],
            context_window=262_144,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.MIMO_V2_FLASH,
            tier_availability=["free", "paid"],
            priority=80,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_deepseek_v3() -> Model:
        return Model(
            id="dobby/deepseek-v3",
            name="DeepSeek V3",
            litellm_model_id="openrouter/deepseek/deepseek-chat-v3-0324",
            provider=ModelProvider.OPENROUTER,
            aliases=["deepseek-v3", "deepseek", "deepseek/deepseek-chat-v3-0324"],
            context_window=128_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.DEEPSEEK_V3,
            tier_availability=["free", "paid"],
            priority=90,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_deepseek_v4_flash() -> Model:
        return Model(
            id="dobby/deepseek-v4-flash",
            name="DeepSeek V4 Flash",
            litellm_model_id="openrouter/deepseek/deepseek-v4-flash",
            provider=ModelProvider.OPENROUTER,
            aliases=["deepseek-v4-flash", "deepseek/deepseek-v4-flash"],
            context_window=1_048_576,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
            ],
            pricing=PricingPresets.DEEPSEEK_V4_FLASH,
            tier_availability=["free", "paid"],
            priority=94,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_deepseek_v4_pro() -> Model:
        return Model(
            id="dobby/deepseek-v4-pro",
            name="DeepSeek V4 Pro",
            litellm_model_id="openrouter/deepseek/deepseek-v4-pro",
            provider=ModelProvider.OPENROUTER,
            aliases=["deepseek-v4-pro", "deepseek/deepseek-v4-pro"],
            context_window=1_048_576,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
            ],
            pricing=PricingPresets.DEEPSEEK_V4_PRO,
            tier_availability=["free", "paid"],
            priority=93,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_claude_sonnet_5() -> Model:
        return Model(
            id="dobby/claude-sonnet-5",
            name="Claude Sonnet 5",
            litellm_model_id="openrouter/anthropic/claude-sonnet-5",
            provider=ModelProvider.OPENROUTER,
            aliases=[
                "claude-sonnet-5",
                "anthropic/claude-sonnet-5",
                "dobby/claude-sonnet-4.6",
                "claude-sonnet-4.6",
                "claude-sonnet-4-6",
                "anthropic/claude-sonnet-4.6",
            ],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.CLAUDE_SONNET_5,
            tier_availability=["free", "paid"],
            priority=103,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_claude_opus_4_7() -> Model:
        return Model(
            id="dobby/claude-opus-4.7",
            name="Claude Opus 4.7",
            litellm_model_id="openrouter/anthropic/claude-opus-4.7",
            provider=ModelProvider.OPENROUTER,
            aliases=["claude-opus-4.7", "claude-opus-4-7", "anthropic/claude-opus-4.7"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.CLAUDE_OPUS_4_7,
            tier_availability=["paid"],
            priority=98,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_claude_opus_5() -> Model:
        return Model(
            id="dobby/claude-opus-5",
            name="Claude Opus 5",
            litellm_model_id="openrouter/anthropic/claude-opus-5",
            provider=ModelProvider.OPENROUTER,
            aliases=["claude-opus-5", "anthropic/claude-opus-5"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.CLAUDE_OPUS_5,
            tier_availability=["paid"],
            priority=104,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_claude_fable_5() -> Model:
        return Model(
            id="dobby/claude-fable-5",
            name="Claude Fable 5",
            litellm_model_id="openrouter/anthropic/claude-fable-5",
            provider=ModelProvider.OPENROUTER,
            aliases=["claude-fable-5", "anthropic/claude-fable-5"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.CLAUDE_FABLE_5,
            tier_availability=["paid"],
            priority=105,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gemini_2_5_pro() -> Model:
        return Model(
            id="dobby/gemini-2.5-pro",
            name="Gemini 2.5 Pro",
            litellm_model_id="openrouter/google/gemini-2.5-pro",
            provider=ModelProvider.OPENROUTER,
            aliases=["gemini-2.5-pro", "google/gemini-2.5-pro"],
            context_window=1_048_576,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
            ],
            pricing=PricingPresets.GEMINI_2_5_PRO,
            tier_availability=["paid"],
            priority=96,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gemini_3_1_pro() -> Model:
        return Model(
            id="dobby/gemini-3.1-pro-preview",
            name="Gemini 3.1 Pro Preview",
            litellm_model_id="openrouter/google/gemini-3.1-pro-preview",
            provider=ModelProvider.OPENROUTER,
            aliases=["gemini-3.1-pro-preview", "google/gemini-3.1-pro-preview"],
            context_window=1_048_576,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.GEMINI_3_1_PRO,
            tier_availability=["free", "paid"],
            priority=92,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gemini_3_5_flash_lite() -> Model:
        return Model(
            id="dobby/gemini-3.5-flash-lite",
            name="Gemini 3.5 Flash Lite",
            litellm_model_id="openrouter/google/gemini-3.5-flash-lite",
            provider=ModelProvider.OPENROUTER,
            aliases=["gemini-3.5-flash-lite", "google/gemini-3.5-flash-lite"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.GEMINI_3_5_FLASH_LITE,
            tier_availability=["free", "paid"],
            priority=94,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gemini_3_6_flash() -> Model:
        return Model(
            id="dobby/gemini-3.6-flash",
            name="Gemini 3.6 Flash",
            litellm_model_id="openrouter/google/gemini-3.6-flash",
            provider=ModelProvider.OPENROUTER,
            aliases=["gemini-3.6-flash", "google/gemini-3.6-flash"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.GEMINI_3_6_FLASH,
            tier_availability=["free", "paid"],
            priority=93,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gemma_4_31b() -> Model:
        return Model(
            id="dobby/gemma-4-31b",
            name="Gemma 4 31B",
            litellm_model_id="openrouter/google/gemma-4-31b-it",
            provider=ModelProvider.OPENROUTER,
            aliases=["gemma-4-31b", "google/gemma-4-31b-it"],
            context_window=128_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
            ],
            pricing=PricingPresets.GEMMA_4_31B,
            tier_availability=["free", "paid"],
            priority=89,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_kimi_k2_6() -> Model:
        return Model(
            id="dobby/kimi-k2.6",
            name="Kimi K2.6",
            litellm_model_id="openrouter/moonshotai/kimi-k2.6",
            provider=ModelProvider.OPENROUTER,
            aliases=["kimi-k2.6", "moonshotai/kimi-k2.6"],
            context_window=256_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.PROMPT_CACHING,
                ModelCapability.THINKING,
            ],
            pricing=PricingPresets.KIMI_K2_6,
            tier_availability=["free", "paid"],
            priority=106,
            recommended=False,
            enabled=True,
            config=_create_kimi_model_config(),
        )

    @staticmethod
    def create_kimi_k3() -> Model:
        return Model(
            id="dobby/kimi-k3",
            name="Kimi K3",
            litellm_model_id="openrouter/moonshotai/kimi-k3",
            provider=ModelProvider.OPENROUTER,
            aliases=["kimi-k3", "moonshotai/kimi-k3"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.PROMPT_CACHING,
                ModelCapability.THINKING,
            ],
            pricing=PricingPresets.KIMI_K3,
            tier_availability=["free", "paid"],
            priority=108,
            recommended=False,
            enabled=True,
            config=_create_kimi_model_config(),
        )

    @staticmethod
    def create_glm_5_2() -> Model:
        return Model(
            id="dobby/glm-5.2",
            name="GLM 5.2",
            litellm_model_id="openrouter/z-ai/glm-5.2",
            provider=ModelProvider.OPENROUTER,
            aliases=[
                "glm-5.2",
                "z-ai/glm-5.2",
                "dobby/glm-5-turbo",
                "glm-5-turbo",
                "z-ai/glm-5-turbo",
                "z-ai/glm-5",
            ],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.THINKING,
            ],
            pricing=PricingPresets.GLM_5_2,
            tier_availability=["free", "paid"],
            priority=88,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_qwen_3_8_max() -> Model:
        return Model(
            id="dobby/qwen3.8-max",
            name="Qwen3.8 Max",
            litellm_model_id="openrouter/qwen/qwen3.8-max",
            provider=ModelProvider.OPENROUTER,
            aliases=["qwen3.8-max", "qwen/qwen3.8-max", "qwen3.8", "qwen"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.QWEN_3_8_MAX,
            tier_availability=["free", "paid"],
            priority=92,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_minimax_m2_7() -> Model:
        return Model(
            id="dobby/minimax-m2.7",
            name="MiniMax M2.7",
            litellm_model_id="openrouter/minimax/minimax-m2.7",
            provider=ModelProvider.OPENROUTER,
            aliases=["minimax-m2.7", "minimax/minimax-m2.7", "minimax-m2.5", "minimax/minimax-m2.5"],
            context_window=200_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.THINKING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.MINIMAX_M2_7,
            tier_availability=["free", "paid"],
            priority=99,
            recommended=False,
            enabled=True,
            config=_create_minimax_model_config(),
        )

    @staticmethod
    def create_gpt_5_5() -> Model:
        return Model(
            id="dobby/gpt-5.5",
            name="GPT-5.5",
            litellm_model_id="openrouter/openai/gpt-5.5",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-5.5", "openai/gpt-5.5"],
            context_window=1_050_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
            ],
            pricing=PricingPresets.GPT_5_5,
            tier_availability=["paid"],
            priority=100,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gpt_5_5_pro() -> Model:
        return Model(
            id="dobby/gpt-5.5-pro",
            name="GPT-5.5 Pro",
            litellm_model_id="openrouter/openai/gpt-5.5-pro",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-5.5-pro", "openai/gpt-5.5-pro"],
            context_window=1_050_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
            ],
            pricing=PricingPresets.GPT_5_5_PRO,
            tier_availability=["paid"],
            priority=99,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gpt_5_6_luna() -> Model:
        return Model(
            id="dobby/gpt-5.6-luna",
            name="GPT-5.6 Luna",
            litellm_model_id="openrouter/openai/gpt-5.6-luna",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-5.6-luna", "openai/gpt-5.6-luna"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
            ],
            pricing=PricingPresets.GPT_5_6_LUNA,
            tier_availability=["free", "paid"],
            priority=110,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gpt_5_6_luna_pro() -> Model:
        return Model(
            id="dobby/gpt-5.6-luna-pro",
            name="GPT-5.6 Luna Pro",
            litellm_model_id="openrouter/openai/gpt-5.6-luna-pro",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-5.6-luna-pro", "openai/gpt-5.6-luna-pro"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.THINKING,
            ],
            pricing=PricingPresets.GPT_5_6_LUNA,
            tier_availability=["free", "paid"],
            priority=111,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gpt_5_6_terra() -> Model:
        return Model(
            id="dobby/gpt-5.6-terra",
            name="GPT-5.6 Terra",
            litellm_model_id="openrouter/openai/gpt-5.6-terra",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-5.6-terra", "openai/gpt-5.6-terra"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
            ],
            pricing=PricingPresets.GPT_5_6_TERRA,
            tier_availability=["free", "paid"],
            priority=112,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gpt_5_6_terra_pro() -> Model:
        return Model(
            id="dobby/gpt-5.6-terra-pro",
            name="GPT-5.6 Terra Pro",
            litellm_model_id="openrouter/openai/gpt-5.6-terra-pro",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-5.6-terra-pro", "openai/gpt-5.6-terra-pro"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.THINKING,
            ],
            pricing=PricingPresets.GPT_5_6_TERRA,
            tier_availability=["free", "paid"],
            priority=113,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gpt_5_6_sol() -> Model:
        return Model(
            id="dobby/gpt-5.6-sol",
            name="GPT-5.6 Sol",
            litellm_model_id="openrouter/openai/gpt-5.6-sol",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-5.6-sol", "openai/gpt-5.6-sol"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
            ],
            pricing=PricingPresets.GPT_5_6_SOL,
            tier_availability=["paid"],
            priority=114,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_gpt_5_6_sol_pro() -> Model:
        return Model(
            id="dobby/gpt-5.6-sol-pro",
            name="GPT-5.6 Sol Pro",
            litellm_model_id="openrouter/openai/gpt-5.6-sol-pro",
            provider=ModelProvider.OPENROUTER,
            aliases=["gpt-5.6-sol-pro", "openai/gpt-5.6-sol-pro"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.THINKING,
            ],
            pricing=PricingPresets.GPT_5_6_SOL,
            tier_availability=["paid"],
            priority=115,
            recommended=False,
            enabled=True,
        )

    @staticmethod
    def create_haiku_3_5() -> Model:
        return Model(
            id="dobby/haiku-3.5",
            name="Claude Haiku 3.5",
            litellm_model_id="bedrock/anthropic.claude-3-5-haiku-20241022-v1:0",
            provider=ModelProvider.BEDROCK,
            aliases=["haiku-3.5", "claude-3.5-haiku", "claude-3-5-haiku"],
            context_window=200_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.HAIKU_3_5,
            tier_availability=["paid"],
            priority=70,
            recommended=False,
            enabled=True,
            config=_create_anthropic_model_config(),
        )

    @staticmethod
    def create_kimi_k2() -> Model:
        return Model(
            id="dobby/kimi-k2",
            name="Kimi K2",
            litellm_model_id="openrouter/moonshotai/kimi-k2",
            provider=ModelProvider.OPENROUTER,
            aliases=["kimi-k2", "moonshotai/kimi-k2"],
            context_window=262_144,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.PROMPT_CACHING,
            ],
            pricing=PricingPresets.KIMI_K2,
            tier_availability=["free", "paid"],
            priority=104,
            recommended=False,
            enabled=True,
            config=_create_kimi_model_config(),
        )

    @staticmethod
    def create_kimi_k2_5() -> Model:
        return Model(
            id="dobby/kimi-k2.5",
            name="Kimi K2.5",
            litellm_model_id="openrouter/moonshotai/kimi-k2.5",
            provider=ModelProvider.OPENROUTER,
            aliases=["kimi-k2.5", "kimi", "moonshotai/kimi-k2.5"],
            context_window=262_144,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.PROMPT_CACHING,
                ModelCapability.THINKING
            ],
            pricing=PricingPresets.KIMI_K2_5,
            tier_availability=["free", "paid"],
            priority=105,
            recommended=True,
            enabled=True,
            config=_create_kimi_model_config(),
        )

class ModelRegistry:
    
    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._aliases: Dict[str, str] = {}
        self._litellm_id_to_pricing: Dict[str, ModelPricing] = {}
        self._initialize_providers()
        self._initialize_models()
    
    def _initialize_providers(self):
        bedrock_provider = BedrockProvider(
            region=BedrockConfig.REGION,
            account_id=BedrockConfig.ACCOUNT_ID,
        )
        provider_registry.register("bedrock", bedrock_provider)
    
    def _initialize_models(self):
        self._register_pricing_mappings()

        main_llm = _get_main_llm()
        custom_model = _get_main_llm_model()
        use_bedrock = _should_use_bedrock()

        self.register(ModelFactory.create_basic_model(main_llm, custom_model))
        self.register(ModelFactory.create_power_model(main_llm, custom_model))
        self.register(ModelFactory.create_anthropic_haiku(use_bedrock))
        self.register(ModelFactory.create_grok_4_1_fast())
        self.register(ModelFactory.create_grok_4())
        self.register(ModelFactory.create_grok_4_5())
        self.register(ModelFactory.create_gpt4o_mini())
        self.register(ModelFactory.create_mimo_v2_flash())
        self.register(ModelFactory.create_kimi_k2())
        self.register(ModelFactory.create_kimi_k2_5())
        self.register(ModelFactory.create_kimi_k2_6())
        self.register(ModelFactory.create_kimi_k3())
        self.register(ModelFactory.create_minimax_m2())
        self.register(ModelFactory.create_minimax_m2_7())
        self.register(ModelFactory.create_haiku_3_5())
        self.register(ModelFactory.create_deepseek_v3())
        self.register(ModelFactory.create_deepseek_v4_flash())
        self.register(ModelFactory.create_deepseek_v4_pro())
        self.register(ModelFactory.create_claude_sonnet_5())
        self.register(ModelFactory.create_claude_opus_4_7())
        self.register(ModelFactory.create_claude_opus_5())
        self.register(ModelFactory.create_claude_fable_5())
        self.register(ModelFactory.create_gemini_2_5_pro())
        self.register(ModelFactory.create_gemini_3_1_pro())
        self.register(ModelFactory.create_gemini_3_5_flash_lite())
        self.register(ModelFactory.create_gemini_3_6_flash())
        self.register(ModelFactory.create_gemma_4_31b())
        self.register(ModelFactory.create_glm_5_2())
        self.register(ModelFactory.create_qwen_3_8_max())
        self.register(ModelFactory.create_gpt_5_5())
        self.register(ModelFactory.create_gpt_5_5_pro())
        self.register(ModelFactory.create_gpt_5_6_luna())
        self.register(ModelFactory.create_gpt_5_6_luna_pro())
        self.register(ModelFactory.create_gpt_5_6_terra())
        self.register(ModelFactory.create_gpt_5_6_terra_pro())
        self.register(ModelFactory.create_gpt_5_6_sol())
        self.register(ModelFactory.create_gpt_5_6_sol_pro())

        if config.ENV_MODE != EnvMode.PRODUCTION:
            self.register(ModelFactory.create_test_model())

        # Keep Basic mode wrapper aligned with the free-tier engine so the
        # mode picker "powered by" subtitle matches what free users actually run.
        self._align_basic_with_free_model()

    def _align_basic_with_free_model(self) -> None:
        free_model = self.get(FREE_MODEL_ID)
        basic_model = self.get("dobby/basic")
        if not free_model or not basic_model or free_model.id == basic_model.id:
            return

        basic_model.litellm_model_id = free_model.litellm_model_id
        basic_model.provider = free_model.provider
        basic_model.pricing = free_model.pricing
        basic_model.context_window = free_model.context_window
        basic_model.capabilities = list(free_model.capabilities)
        basic_model.config = free_model.config
    
    def _register_pricing_mappings(self):
        self._litellm_id_to_pricing[BedrockConfig.get_haiku_arn()] = PricingPresets.HAIKU_4_5
        self._litellm_id_to_pricing["minimax/minimax-m2.1"] = PricingPresets.MINIMAX_M2
        self._litellm_id_to_pricing["openrouter/minimax/minimax-m2.1"] = PricingPresets.MINIMAX_M2
        self._litellm_id_to_pricing["openrouter/x-ai/grok-4.1-fast"] = PricingPresets.GROK_4_1_FAST
        self._litellm_id_to_pricing["openrouter/openai/gpt-4o-mini"] = PricingPresets.GPT_4O_MINI
        self._litellm_id_to_pricing["openrouter/xiaomi/mimo-v2-flash"] = PricingPresets.MIMO_V2_FLASH
        self._litellm_id_to_pricing["openrouter/moonshotai/kimi-k2"] = PricingPresets.KIMI_K2
        self._litellm_id_to_pricing["openrouter/moonshotai/kimi-k2.5"] = PricingPresets.KIMI_K2_5
        self._litellm_id_to_pricing["openrouter/moonshotai/kimi-k2.6"] = PricingPresets.KIMI_K2_6
        self._litellm_id_to_pricing["openrouter/moonshotai/kimi-k3"] = PricingPresets.KIMI_K3
        self._litellm_id_to_pricing["bedrock/anthropic.claude-3-5-haiku-20241022-v1:0"] = PricingPresets.HAIKU_3_5
        self._litellm_id_to_pricing["openrouter/deepseek/deepseek-chat-v3-0324"] = PricingPresets.DEEPSEEK_V3
        self._litellm_id_to_pricing["openrouter/deepseek/deepseek-v4-flash"] = PricingPresets.DEEPSEEK_V4_FLASH
        self._litellm_id_to_pricing["openrouter/deepseek/deepseek-v4-pro"] = PricingPresets.DEEPSEEK_V4_PRO
        self._litellm_id_to_pricing["openrouter/anthropic/claude-sonnet-5"] = PricingPresets.CLAUDE_SONNET_5
        self._litellm_id_to_pricing["openrouter/anthropic/claude-opus-4.7"] = PricingPresets.CLAUDE_OPUS_4_7
        self._litellm_id_to_pricing["openrouter/anthropic/claude-opus-5"] = PricingPresets.CLAUDE_OPUS_5
        self._litellm_id_to_pricing["openrouter/anthropic/claude-fable-5"] = PricingPresets.CLAUDE_FABLE_5
        self._litellm_id_to_pricing["openrouter/google/gemini-2.5-pro"] = PricingPresets.GEMINI_2_5_PRO
        self._litellm_id_to_pricing["openrouter/google/gemini-3.1-pro-preview"] = PricingPresets.GEMINI_3_1_PRO
        self._litellm_id_to_pricing["openrouter/google/gemini-3.5-flash-lite"] = PricingPresets.GEMINI_3_5_FLASH_LITE
        self._litellm_id_to_pricing["openrouter/google/gemini-3.6-flash"] = PricingPresets.GEMINI_3_6_FLASH
        self._litellm_id_to_pricing["openrouter/google/gemma-4-31b-it"] = PricingPresets.GEMMA_4_31B
        self._litellm_id_to_pricing["openrouter/x-ai/grok-4"] = PricingPresets.GROK_4
        self._litellm_id_to_pricing["openrouter/x-ai/grok-4.5"] = PricingPresets.GROK_4_5
        self._litellm_id_to_pricing["openrouter/z-ai/glm-5.2"] = PricingPresets.GLM_5_2
        self._litellm_id_to_pricing["openrouter/qwen/qwen3.8-max"] = PricingPresets.QWEN_3_8_MAX
        self._litellm_id_to_pricing["openrouter/minimax/minimax-m2.7"] = PricingPresets.MINIMAX_M2_7
        self._litellm_id_to_pricing["openrouter/openai/gpt-5.5"] = PricingPresets.GPT_5_5
        self._litellm_id_to_pricing["openrouter/openai/gpt-5.5-pro"] = PricingPresets.GPT_5_5_PRO
        self._litellm_id_to_pricing["openrouter/openai/gpt-5.6-luna"] = PricingPresets.GPT_5_6_LUNA
        self._litellm_id_to_pricing["openrouter/openai/gpt-5.6-luna-pro"] = PricingPresets.GPT_5_6_LUNA
        self._litellm_id_to_pricing["openrouter/openai/gpt-5.6-terra"] = PricingPresets.GPT_5_6_TERRA
        self._litellm_id_to_pricing["openrouter/openai/gpt-5.6-terra-pro"] = PricingPresets.GPT_5_6_TERRA
        self._litellm_id_to_pricing["openrouter/openai/gpt-5.6-sol"] = PricingPresets.GPT_5_6_SOL
        self._litellm_id_to_pricing["openrouter/openai/gpt-5.6-sol-pro"] = PricingPresets.GPT_5_6_SOL
    
    def register(self, model: Model) -> None:
        self._models[model.id] = model
        for alias in model.aliases:
            self._aliases[alias] = model.id
    
    def get(self, model_id: str) -> Optional[Model]:
        if not model_id:
            return None
        
        if model_id in self._models:
            return self._models[model_id]
        
        if model_id in self._aliases:
            actual_id = self._aliases[model_id]
            return self._models.get(actual_id)
        
        return None
    
    def get_model(self, model_id: str) -> Optional[Model]:
        return self.get(model_id)
    
    def get_all(self, enabled_only: bool = True) -> List[Model]:
        models = list(self._models.values())
        if enabled_only:
            models = [m for m in models if m.enabled]
        return models
    
    def get_by_tier(self, tier: str, enabled_only: bool = True) -> List[Model]:
        models = self.get_all(enabled_only)
        return [m for m in models if tier in m.tier_availability]
    
    def get_by_provider(self, provider: ModelProvider, enabled_only: bool = True) -> List[Model]:
        models = self.get_all(enabled_only)
        return [m for m in models if m.provider == provider]
    
    def get_by_capability(self, capability: ModelCapability, enabled_only: bool = True) -> List[Model]:
        models = self.get_all(enabled_only)
        return [m for m in models if capability in m.capabilities]
    
    def resolve_model_id(self, model_id: str) -> Optional[str]:
        resolved = self.get(model_id)
        if resolved:
            return resolved.id
        
        reverse_resolved = self.resolve_from_litellm_id(model_id)
        if reverse_resolved != model_id:
            return reverse_resolved
        
        return model_id
    
    def get_litellm_model_id(self, model_id: str) -> str:
        model = self.get(model_id)
        if model:
            return model.litellm_model_id
        return model_id
    
    def supports_vision(self, model_id: str) -> bool:
        model = self.get(model_id)
        if model:
            return model.supports_vision
        return False
    
    def get_litellm_params(self, model_id: str, **override_params) -> Dict[str, Any]:
        model = self.get(model_id)
        if not model:
            return {
                "model": model_id,
                "num_retries": 5,
                **override_params
            }
        
        params = model.get_litellm_params(**override_params)
        params["model"] = self.get_litellm_model_id(model_id)
        
        return params
    
    def _normalize_model_id(self, model_id: str) -> str:
        if not model_id:
            return model_id
        
        provider_prefixes = ['openrouter/', 'anthropic/', 'bedrock/', 'openai/', 'minimax/']
        
        for prefix in provider_prefixes:
            if model_id.startswith(prefix):
                return model_id
        
        return f"openrouter/{model_id}"
    
    def resolve_from_litellm_id(self, litellm_model_id: str) -> str:
        for model in self._models.values():
            if model.litellm_model_id == litellm_model_id:
                return model.id
        
        normalized_id = self._normalize_model_id(litellm_model_id)
        if normalized_id != litellm_model_id:
            for model in self._models.values():
                if model.litellm_model_id == normalized_id:
                    return model.id
        
        if self.get(litellm_model_id):
            return litellm_model_id
        
        return litellm_model_id
    
    def get_pricing_for_litellm_id(self, litellm_model_id: str) -> Optional[ModelPricing]:
        resolved_id = self.resolve_from_litellm_id(litellm_model_id)
        model = self.get(resolved_id)
        if model and model.pricing:
            return model.pricing
        
        if litellm_model_id in self._litellm_id_to_pricing:
            return self._litellm_id_to_pricing[litellm_model_id]
        
        normalized_id = self._normalize_model_id(litellm_model_id)
        if normalized_id in self._litellm_id_to_pricing:
            return self._litellm_id_to_pricing[normalized_id]
        
        if "application-inference-profile" in litellm_model_id:
            profile_id = litellm_model_id.split("/")[-1] if "/" in litellm_model_id else None
            if profile_id == BedrockConfig.PROFILE_IDS["haiku_4_5"]:
                return PricingPresets.HAIKU_4_5
        
        return None
    
    def get_aliases(self, model_id: str) -> List[str]:
        model = self.get(model_id)
        return model.aliases if model else []
    
    def enable_model(self, model_id: str) -> bool:
        model = self.get(model_id)
        if model:
            model.enabled = True
            return True
        return False
    
    def disable_model(self, model_id: str) -> bool:
        model = self.get(model_id)
        if model:
            model.enabled = False
            return True
        return False
    
    def get_context_window(self, model_id: str, default: int = 31_000) -> int:
        model = self.get(model_id)
        if model:
            return model.context_window
        return default
    
    def get_pricing(self, model_id: str) -> Optional[ModelPricing]:
        model = self.get(model_id)
        if model and model.pricing:
            return model.pricing
        
        return self.get_pricing_for_litellm_id(model_id)
    
    def validate_model(self, model_id: str) -> Tuple[bool, str]:
        model = self.get(model_id)
        
        if not model:
            return False, f"Model '{model_id}' not found"
        
        if not model.enabled:
            return False, f"Model '{model.name}' is currently disabled"
        
        return True, ""
    
    def select_best_model(
        self,
        tier: str,
        required_capabilities: Optional[List[ModelCapability]] = None,
        min_context_window: Optional[int] = None,
        prefer_cheaper: bool = False
    ) -> Optional[Model]:
        models = self.get_by_tier(tier, enabled_only=True)
        
        if required_capabilities:
            models = [
                m for m in models
                if all(cap in m.capabilities for cap in required_capabilities)
            ]
        
        if min_context_window:
            models = [m for m in models if m.context_window >= min_context_window]
        
        if not models:
            return None
        
        if prefer_cheaper and any(m.pricing for m in models):
            models_with_pricing = [m for m in models if m.pricing]
            if models_with_pricing:
                models = sorted(
                    models_with_pricing,
                    key=lambda m: m.pricing.input_cost_per_million_tokens
                )
        else:
            models = sorted(
                models,
                key=lambda m: (-m.priority, not m.recommended)
            )
        
        return models[0] if models else None
    
    def get_default_model(self, tier: str = "free") -> Optional[Model]:
        models = self.get_by_tier(tier, enabled_only=True)
        
        recommended = [m for m in models if m.recommended]
        if recommended:
            recommended = sorted(recommended, key=lambda m: -m.priority)
            return recommended[0]
        
        if models:
            models = sorted(models, key=lambda m: -m.priority)
            return models[0]
        
        return None
    
    async def get_default_model_for_user(self, client, user_id: str) -> str:
        try:
            if config.ENV_MODE == EnvMode.LOCAL:
                return PREMIUM_MODEL_ID
            
            from core.billing.subscriptions import subscription_service
            
            subscription_info = await subscription_service.get_subscription(user_id)
            subscription = subscription_info.get('subscription')
            
            is_paid_tier = False
            if subscription:
                tier_info = subscription_info.get('tier', {})
                if tier_info and tier_info.get('name') not in ('free', 'none'):
                    is_paid_tier = True
            
            return PREMIUM_MODEL_ID if is_paid_tier else FREE_MODEL_ID
            
        except Exception as e:
            logger.warning(f"Failed to determine user tier for {user_id}: {e}")
            return FREE_MODEL_ID
    
    def check_token_limit(
        self,
        model_id: str,
        token_count: int,
        is_input: bool = True
    ) -> Tuple[bool, int]:
        model = self.get(model_id)
        if not model:
            return False, 0
        
        max_allowed = model.context_window
        return token_count <= max_allowed, max_allowed
    
    def format_model_info(self, model_id: str) -> Dict[str, Any]:
        model = self.get(model_id)
        if not model:
            return {"error": f"Model '{model_id}' not found"}
        
        return {
            "id": model.id,
            "name": model.name,
            "aliases": model.aliases,
            "litellm_model_id": model.litellm_model_id,
            "context_window": model.context_window,
            "capabilities": [cap.value for cap in model.capabilities],
            "enabled": model.enabled,
            "tier_availability": model.tier_availability,
            "priority": model.priority,
            "recommended": model.recommended,
        }
    
    def list_available_models(
        self,
        tier: Optional[str] = None,
        include_disabled: bool = False
    ) -> List[Dict[str, Any]]:
        if tier:
            models = self.get_by_tier(tier, enabled_only=not include_disabled)
        else:
            models = self.get_all(enabled_only=not include_disabled)
        
        if not models:
            logger.warning(f"No models found for tier '{tier}'")
        
        models = sorted(
            models,
            key=lambda m: (not m.is_free_tier, -m.priority, m.name)
        )
        
        return [self.format_model_info(m.id) for m in models]


registry = ModelRegistry()


HAIKU_BEDROCK_ARN = BedrockConfig.get_haiku_arn()
SONNET_BEDROCK_ARN = BedrockConfig.get_sonnet_arn()
HAIKU_PRICING = PricingPresets.HAIKU_4_5
HAIKU_4_5_PROFILE_ID = BedrockConfig.PROFILE_IDS["haiku_4_5"]
