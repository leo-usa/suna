from unittest.mock import patch

from core.ai_models.models import ModelCapability, ModelProvider
from core.ai_models.registry import BedrockConfig, ModelFactory, registry


def test_gpt_6_2_astra_is_paid():
    model = registry.get("dobby/gpt-6.2-astra")
    alias = registry.get("openai/gpt-6.2-astra")

    assert model is not None
    assert alias is model
    assert model.name == "GPT-6.2 Astra"
    assert model.context_window == 1_050_000
    assert model.tier_availability == ["paid"]
    assert ModelCapability.FUNCTION_CALLING in model.capabilities
    assert ModelCapability.VISION in model.capabilities
    assert ModelCapability.PROMPT_CACHING in model.capabilities
    assert model.pricing is not None
    assert model.pricing.input_cost_per_million_tokens == 8.00
    assert model.pricing.output_cost_per_million_tokens == 40.00
    assert model.pricing.cached_read_cost_per_million_tokens == 0.40


def test_gpt_6_2_family_routes_through_bedrock_when_enabled():
    with patch("core.ai_models.registry._bedrock_claude_gpt_enabled", return_value=False):
        astra = ModelFactory.create_gpt_6_2_astra()
        sol = ModelFactory.create_gpt_6_2_sol()

    assert astra.provider == ModelProvider.OPENROUTER
    assert astra.litellm_model_id == "openrouter/openai/gpt-6.2-astra"
    assert astra.fallback_litellm_model_id is None
    assert sol.litellm_model_id == "openrouter/openai/gpt-6.2-sol"

    with patch("core.ai_models.registry._bedrock_claude_gpt_enabled", return_value=True):
        astra = ModelFactory.create_gpt_6_2_astra()
        sol = ModelFactory.create_gpt_6_2_sol()

    assert astra.provider == ModelProvider.BEDROCK
    assert astra.litellm_model_id == BedrockConfig.build_geo_id("gpt_6_2_astra")
    assert astra.fallback_litellm_model_id == "openrouter/openai/gpt-6.2-astra"
    assert sol.litellm_model_id == BedrockConfig.build_geo_id("gpt_6_2_sol")
    assert sol.fallback_litellm_model_id == "openrouter/openai/gpt-6.2-sol"
    assert sol.pricing.input_cost_per_million_tokens == 2.00
    assert sol.pricing.output_cost_per_million_tokens == 10.00
    assert astra.pricing.input_cost_per_million_tokens == 8.00
    assert astra.pricing.output_cost_per_million_tokens == 40.00
    assert astra.tier_availability == ["paid"]
    assert sol.tier_availability == ["paid"]
