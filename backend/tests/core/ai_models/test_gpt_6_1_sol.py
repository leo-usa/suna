from unittest.mock import patch

from core.ai_models.models import ModelCapability, ModelProvider
from core.ai_models.registry import BedrockConfig, ModelFactory, registry


def test_gpt_6_1_sol_is_paid():
    model = registry.get("dobby/gpt-6.1-sol")
    alias = registry.get("openai/gpt-6.1-sol")

    assert model is not None
    assert alias is model
    assert model.name == "GPT-6.1 Sol"
    assert model.context_window == 1_050_000
    assert model.tier_availability == ["paid"]
    assert ModelCapability.FUNCTION_CALLING in model.capabilities
    assert ModelCapability.VISION in model.capabilities
    assert model.pricing is not None
    assert model.pricing.input_cost_per_million_tokens == 2.00
    assert model.pricing.output_cost_per_million_tokens == 10.00
    assert model.pricing.cached_read_cost_per_million_tokens == 0.10


def test_gpt_6_1_sol_routes_through_bedrock_when_enabled():
    with patch("core.ai_models.registry._bedrock_claude_gpt_enabled", return_value=False):
        sol = ModelFactory.create_gpt_6_1_sol()

    assert sol.provider == ModelProvider.OPENROUTER
    assert sol.litellm_model_id == "openrouter/openai/gpt-6.1-sol"
    assert sol.fallback_litellm_model_id is None

    with patch("core.ai_models.registry._bedrock_claude_gpt_enabled", return_value=True):
        sol = ModelFactory.create_gpt_6_1_sol()

    assert sol.provider == ModelProvider.BEDROCK
    assert sol.litellm_model_id == BedrockConfig.build_geo_id("gpt_6_1_sol")
    assert sol.fallback_litellm_model_id == "openrouter/openai/gpt-6.1-sol"
