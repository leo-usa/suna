from core.ai_models.models import ModelCapability, ModelProvider
from core.ai_models.registry import registry


def test_gemini_3_8_flash_replaces_3_6():
    model = registry.get("dobby/gemini-3.8-flash")
    legacy = registry.get("dobby/gemini-3.6-flash")

    assert model is not None
    assert legacy is model
    assert model.name == "Gemini 3.8 Flash"
    assert model.provider == ModelProvider.OPENROUTER
    assert model.litellm_model_id == "openrouter/google/gemini-3.8-flash"
    assert model.context_window == 1_000_000
    assert ModelCapability.THINKING in model.capabilities
    assert model.pricing is not None
    assert model.pricing.input_cost_per_million_tokens == 0.75
    assert model.pricing.output_cost_per_million_tokens == 3.75
    assert model.pricing.cached_read_cost_per_million_tokens == 0.075


def test_muse_spark_1_3_is_registered():
    model = registry.get("dobby/muse-spark-1.3")
    alias = registry.get("meta/muse-spark-1.3")

    assert model is not None
    assert alias is model
    assert model.name == "Muse Spark 1.3"
    assert model.provider == ModelProvider.OPENROUTER
    assert model.litellm_model_id == "openrouter/meta/muse-spark-1.3"
    assert model.context_window == 1_000_000
    assert ModelCapability.THINKING in model.capabilities
    assert ModelCapability.VISION in model.capabilities
    assert model.pricing is not None
    assert model.pricing.input_cost_per_million_tokens == 1.25
    assert model.pricing.output_cost_per_million_tokens == 4.25
    assert model.pricing.cached_read_cost_per_million_tokens == 0.15
