from core.ai_models.models import ModelCapability, ModelProvider
from core.ai_models.registry import registry


def test_gpt_6_astra_is_openrouter_paid():
    model = registry.get("dobby/gpt-6-astra")
    alias = registry.get("openai/gpt-6-astra")

    assert model is not None
    assert alias is model
    assert model.name == "GPT-6 Astra"
    assert model.provider == ModelProvider.OPENROUTER
    assert model.litellm_model_id == "openrouter/openai/gpt-6-astra"
    assert model.fallback_litellm_model_id is None
    assert model.context_window == 1_000_000
    assert model.tier_availability == ["paid"]
    assert ModelCapability.FUNCTION_CALLING in model.capabilities
    assert ModelCapability.VISION in model.capabilities
    assert ModelCapability.PROMPT_CACHING in model.capabilities
    assert model.pricing is not None
    assert model.pricing.input_cost_per_million_tokens == 10.00
    assert model.pricing.output_cost_per_million_tokens == 50.00
    assert model.pricing.cached_read_cost_per_million_tokens == 1.00
