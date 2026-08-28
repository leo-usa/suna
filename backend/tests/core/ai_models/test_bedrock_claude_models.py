from core.ai_models.models import ModelProvider
from core.ai_models.registry import registry


def test_sonnet_5_and_fable_5_use_openrouter():
    sonnet = registry.get("dobby/claude-sonnet-5")
    fable = registry.get("dobby/claude-fable-5")

    assert sonnet is not None
    assert fable is not None
    assert sonnet.provider == ModelProvider.OPENROUTER
    assert fable.provider == ModelProvider.OPENROUTER
    assert sonnet.litellm_model_id == "openrouter/anthropic/claude-sonnet-5"
    assert fable.litellm_model_id == "openrouter/anthropic/claude-fable-5"
