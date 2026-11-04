from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.tools.computer_cost_controls import (
    COMPUTER_HISTORY_PLACEHOLDER,
    COMPUTER_MODEL_ID,
    compress_ax_payload,
    is_computer_tool_name,
    is_expensive_for_computer,
    maybe_computer_model,
    should_route_computer_to_cheap_model,
)


def test_is_computer_tool_name():
    assert is_computer_tool_name("computer_screenshot") is True
    assert is_computer_tool_name("computer_ui_click") is True
    assert is_computer_tool_name("ask") is False
    assert is_computer_tool_name(None) is False


def test_compress_ax_payload_caps_elements_and_tree():
    elements = [{"ref": f"@{i}", "name": f"item-{i}"} for i in range(80)]
    tree = "x" * 9000
    out = compress_ax_payload(elements, tree)
    assert len(out["elements"]) == 40
    assert len(out["tree"]) <= 4000
    assert out["truncated"] is True
    assert out["tree"].endswith("…")


def test_compress_ax_payload_small_unchanged():
    elements = [{"ref": "@1", "name": "Ok"}]
    out = compress_ax_payload(elements, "short tree")
    assert out["elements"] == elements
    assert out["tree"] == "short tree"
    assert out["truncated"] is False


def test_expensive_model_detection_for_sol_and_luna():
    assert is_expensive_for_computer("dobby/gpt-6.1-sol") is True
    assert is_expensive_for_computer("dobby/gpt-6-luna") is False
    assert maybe_computer_model("dobby/gpt-6.1-sol") == COMPUTER_MODEL_ID
    assert maybe_computer_model("dobby/gpt-6-luna") is None


def test_should_route_only_when_computer_already_used():
    assert should_route_computer_to_cheap_model(
        "dobby/gpt-6.1-sol",
        thread_has_computer=False,
    ) is False
    assert should_route_computer_to_cheap_model(
        "dobby/gpt-6.1-sol",
        thread_has_computer=True,
    ) is True

    state = MagicMock()
    result = MagicMock()
    result.tool_name = "computer_ui_click"
    state._tool_results = {"tc1": result}
    state._messages = []
    assert should_route_computer_to_cheap_model(
        "dobby/gpt-6.1-sol",
        state=state,
        thread_has_computer=False,
    ) is True

    # Cheap model never routes.
    assert should_route_computer_to_cheap_model(
        "dobby/gpt-6-luna",
        thread_has_computer=True,
    ) is False


@pytest.mark.asyncio
async def test_omit_previous_computer_tool_results_keeps_latest():
    from core.tools.computer_cost_controls import omit_previous_computer_tool_results

    rows = [
        {"message_id": "new"},
        {"message_id": "old1"},
        {"message_id": "old2"},
    ]
    execute = AsyncMock(return_value=rows)
    execute_mutate = AsyncMock()
    invalidate = AsyncMock()

    with patch("core.services.db.execute", execute), patch(
        "core.services.db.execute_mutate", execute_mutate
    ), patch(
        "core.cache.runtime_cache.invalidate_message_history_cache", invalidate
    ):
        omitted = await omit_previous_computer_tool_results("thread-1", keep_latest=1)

    assert omitted == 2
    execute_mutate.assert_awaited()
    sql = execute_mutate.await_args.args[0]
    params = execute_mutate.await_args.args[1]
    assert "computer_history_omitted" in sql
    assert params["placeholder"] == COMPUTER_HISTORY_PLACEHOLDER
    assert set(params[k] for k in params if k.startswith("id_")) == {"old1", "old2"}
    invalidate.assert_awaited_with("thread-1")


@pytest.mark.asyncio
async def test_ui_payload_uses_compressed_ax():
    from core.tools.sb_computer_tool import SandboxComputerTool

    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    elements = [{"ref": f"@{i}", "name": f"n{i}"} for i in range(90)]
    payload = tool._ui_payload(
        "snap",
        {
            "app": "WeChat",
            "snapshot_id": "ss1",
            "complete": True,
            "truncated": False,
            "ref_count": 90,
            "elements": elements,
            "text": "y" * 5000,
        },
    )
    assert len(payload["elements"]) == 40
    assert len(payload["tree"]) <= 4000
    assert payload["truncated"] is True
