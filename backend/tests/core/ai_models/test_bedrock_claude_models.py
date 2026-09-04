from unittest.mock import patch

from core.agentpress.error_processor import (
    ContentPolicyViolationError,
    ContextWindowExceededError,
)
from core.ai_models.models import ModelCapability, ModelProvider
from core.ai_models.registry import BedrockConfig, ModelFactory, registry
from core.services.llm import (
    _params_for_openrouter_fallback,
    _register_bedrock_gpt_litellm_models,
    _sanitize_llm_params,
    _should_fallback_from_bedrock,
)


def test_sonnet_5_and_fable_5_stay_openrouter_when_bedrock_off():
    with patch("core.ai_models.registry._bedrock_claude_gpt_enabled", return_value=False):
        sonnet = ModelFactory.create_claude_sonnet_5()
        fable = ModelFactory.create_claude_fable_5()

    assert sonnet.provider == ModelProvider.OPENROUTER
    assert fable.provider == ModelProvider.OPENROUTER
    assert sonnet.litellm_model_id == "openrouter/anthropic/claude-sonnet-5"
    assert fable.litellm_model_id == "openrouter/anthropic/claude-fable-5.1"
    assert sonnet.fallback_litellm_model_id is None
    assert fable.fallback_litellm_model_id is None
    assert fable.name == "Claude Fable 5.1"


def test_claude_and_gpt_use_bedrock_geo_ids_when_enabled():
    with patch("core.ai_models.registry._bedrock_claude_gpt_enabled", return_value=True):
        haiku = ModelFactory.create_anthropic_haiku(use_bedrock=True)
        sonnet = ModelFactory.create_claude_sonnet_5()
        opus = ModelFactory.create_claude_opus_5()
        fable = ModelFactory.create_claude_fable_5()
        gpt = ModelFactory.create_gpt_5_5()
        luna = ModelFactory.create_gpt_5_6_luna()
        terra = ModelFactory.create_gpt_5_6_terra()
        sol = ModelFactory.create_gpt_5_6_sol()

    assert haiku.provider == ModelProvider.BEDROCK
    assert haiku.litellm_model_id == BedrockConfig.get_haiku_geo_id()
    assert haiku.fallback_litellm_model_id == "openrouter/anthropic/claude-haiku-4.5"

    assert sonnet.provider == ModelProvider.BEDROCK
    assert sonnet.litellm_model_id == BedrockConfig.get_sonnet_5_id()
    assert sonnet.fallback_litellm_model_id == "openrouter/anthropic/claude-sonnet-5"

    assert opus.litellm_model_id == BedrockConfig.get_opus_5_id()
    assert fable.litellm_model_id == BedrockConfig.get_fable_5_1_id()
    assert gpt.litellm_model_id == BedrockConfig.build_geo_id("gpt_5_5")
    assert luna.litellm_model_id == BedrockConfig.build_geo_id("gpt_5_6_luna")
    assert terra.litellm_model_id == BedrockConfig.build_geo_id("gpt_5_6_terra")
    assert sol.litellm_model_id == BedrockConfig.build_geo_id("gpt_5_6_sol")
    assert ModelCapability.PROMPT_CACHING not in gpt.capabilities
    assert gpt.fallback_litellm_model_id == "openrouter/openai/gpt-5.5"


def test_unmatched_models_stay_on_openrouter():
    with patch("core.ai_models.registry._bedrock_claude_gpt_enabled", return_value=True):
        opus_47 = ModelFactory.create_claude_opus_4_7()
        gpt_pro = ModelFactory.create_gpt_5_5_pro()
        luna_pro = ModelFactory.create_gpt_5_6_luna_pro()
        mini = ModelFactory.create_gpt4o_mini()

    assert opus_47.provider == ModelProvider.OPENROUTER
    assert opus_47.litellm_model_id == "openrouter/anthropic/claude-opus-4.7"
    assert gpt_pro.litellm_model_id == "openrouter/openai/gpt-5.5-pro"
    assert luna_pro.litellm_model_id == "openrouter/openai/gpt-5.6-luna-pro"
    assert mini.litellm_model_id == "openrouter/openai/gpt-4o-mini"


def test_bedrock_count_tokens_model_id_extracts_geo_ids():
    from core.agentpress.context_manager import _bedrock_count_tokens_model_id

    assert (
        _bedrock_count_tokens_model_id("bedrock/converse/us.anthropic.claude-sonnet-5")
        == "us.anthropic.claude-sonnet-5"
    )
    assert (
        _bedrock_count_tokens_model_id("bedrock/converse/us.openai.gpt-5.6-luna")
        == "us.openai.gpt-5.6-luna"
    )


def test_fable_legacy_alias_still_resolves():
    fable = registry.get("dobby/claude-fable-5.1")
    fable_legacy = registry.get("dobby/claude-fable-5")
    assert fable is not None
    assert fable_legacy is fable


def test_bedrock_geo_pricing_maps():
    assert registry.get_pricing_for_litellm_id(BedrockConfig.get_sonnet_5_id()) is not None
    assert registry.get_pricing_for_litellm_id(BedrockConfig.get_fable_5_1_id()) is not None
    assert registry.get_pricing_for_litellm_id("us.anthropic.claude-sonnet-5") is not None
    assert registry.get_pricing_for_litellm_id(BedrockConfig.build_geo_id("gpt_5_6_luna")) is not None


def test_should_fallback_from_bedrock_skips_non_retryable():
    assert _should_fallback_from_bedrock(Exception("throttled")) is True
    assert _should_fallback_from_bedrock(Exception("not authorized for this model")) is True
    ctx = ContextWindowExceededError("too long", "dobby/claude-sonnet-5", "bedrock")
    policy = ContentPolicyViolationError("blocked", "dobby/claude-sonnet-5", "bedrock")
    assert _should_fallback_from_bedrock(ctx) is False
    assert _should_fallback_from_bedrock(policy) is False


def test_sanitize_strips_temperature_for_bedrock_claude():
    params = {
        "model": "bedrock/converse/us.anthropic.claude-sonnet-5",
        "temperature": 0,
        "top_p": 0.9,
    }
    _sanitize_llm_params(params, "dobby/claude-sonnet-5")
    assert "temperature" not in params
    assert "top_p" not in params


def test_sanitize_and_openrouter_fallback_params():
    params = {
        "model": "bedrock/converse/us.openai.gpt-5.6-luna",
        "temperature": 0,
        "frequency_penalty": 0.2,
        "aws_region_name": "us-west-2",
        "messages": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "You are helpful",
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            },
            {"role": "user", "content": "hi"},
        ],
        "tools": [
            {
                "type": "function",
                "function": {"name": "ping"},
                "cache_control": {"type": "ephemeral"},
            }
        ],
    }
    _sanitize_llm_params(params, "dobby/gpt-5.6-luna")
    assert "frequency_penalty" not in params
    assert "temperature" not in params
    assert "cache_control" not in params["messages"][0]["content"][0]
    assert "cache_control" not in params["tools"][0]
    assert params["reasoning"] == {"effort": "low"}
    assert params["drop_params"] is False

    fallback = _params_for_openrouter_fallback(params, "openrouter/openai/gpt-5.6-luna")
    assert fallback["model"] == "openrouter/openai/gpt-5.6-luna"
    assert "aws_region_name" not in fallback
    assert fallback["extra_body"].get("app")


def test_bedrock_gpt_converse_ids_advertise_tools():
    from litellm.llms.bedrock.chat.converse_transformation import AmazonConverseConfig
    from litellm.utils import get_optional_params

    _register_bedrock_gpt_litellm_models()
    params = AmazonConverseConfig().get_supported_openai_params(
        BedrockConfig.build_geo_id("gpt_5_6_luna")
    )
    assert "tools" in params
    assert "tool_choice" in params
    assert "thinking" not in params

    tools = [
        {
            "type": "function",
            "function": {"name": "ping", "parameters": {"type": "object", "properties": {}}},
        }
    ]
    # LiteLLM strips bedrock/converse/us.openai.* to this provider/model pair.
    optional = get_optional_params(
        model="converse/us.openai.gpt-5.6-luna",
        custom_llm_provider="bedrock",
        tools=tools,
        tool_choice="auto",
        drop_params=True,
    )
    assert "tools" in optional
    assert "tool_choice" in optional
