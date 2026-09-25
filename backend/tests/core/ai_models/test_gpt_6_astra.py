from unittest.mock import patch

from core.ai_models.models import ModelCapability, ModelProvider
from core.ai_models.registry import BedrockConfig, ModelFactory, registry


def test_gpt_6_astra_is_paid():
    model = registry.get("dobby/gpt-6-astra")
    alias = registry.get("openai/gpt-6-astra")

    assert model is not None
    assert alias is model
    assert model.name == "GPT-6 Astra"
    assert model.context_window == 1_000_000
    assert model.tier_availability == ["paid"]
    assert ModelCapability.FUNCTION_CALLING in model.capabilities
    assert ModelCapability.VISION in model.capabilities
    assert ModelCapability.PROMPT_CACHING in model.capabilities
    assert model.pricing is not None
    assert model.pricing.input_cost_per_million_tokens == 10.00
    assert model.pricing.output_cost_per_million_tokens == 50.00
    assert model.pricing.cached_read_cost_per_million_tokens == 1.00


def test_gpt_6_family_routes_through_bedrock_when_enabled():
    with patch("core.ai_models.registry._bedrock_claude_gpt_enabled", return_value=False):
        astra = ModelFactory.create_gpt_6_astra()
        sol = ModelFactory.create_gpt_6_sol()
        luna = ModelFactory.create_gpt_6_luna()

    assert astra.provider == ModelProvider.OPENROUTER
    assert astra.litellm_model_id == "openrouter/openai/gpt-6-astra"
    assert astra.fallback_litellm_model_id is None
    assert sol.litellm_model_id == "openrouter/openai/gpt-6-sol"
    assert luna.litellm_model_id == "openrouter/openai/gpt-6-luna"

    with patch("core.ai_models.registry._bedrock_claude_gpt_enabled", return_value=True):
        astra = ModelFactory.create_gpt_6_astra()
        sol = ModelFactory.create_gpt_6_sol()
        luna = ModelFactory.create_gpt_6_luna()

    assert astra.provider == ModelProvider.BEDROCK
    assert astra.litellm_model_id == BedrockConfig.build_geo_id("gpt_6_astra")
    assert astra.fallback_litellm_model_id == "openrouter/openai/gpt-6-astra"
    assert sol.litellm_model_id == BedrockConfig.build_geo_id("gpt_6_sol")
    assert sol.fallback_litellm_model_id == "openrouter/openai/gpt-6-sol"
    assert sol.pricing.input_cost_per_million_tokens == 2.00
    assert sol.pricing.output_cost_per_million_tokens == 10.00
    assert luna.litellm_model_id == BedrockConfig.build_geo_id("gpt_6_luna")
    assert luna.fallback_litellm_model_id == "openrouter/openai/gpt-6-luna"
    assert luna.pricing.input_cost_per_million_tokens == 0.10
    assert luna.pricing.output_cost_per_million_tokens == 0.50
    assert luna.tier_availability == ["free", "paid"]
    assert sol.tier_availability == ["paid"]
