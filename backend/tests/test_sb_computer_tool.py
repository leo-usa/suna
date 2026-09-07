import asyncio
import base64
import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image

from core.tools import sb_computer_tool
from core.tools.sb_computer_tool import (
    SCREENSHOT_BUCKETS,
    SCREEN_OBSERVATION_TEXT,
    SandboxComputerTool,
    format_action_log,
    is_page_scroll,
    prepare_screenshot_b64,
    screen_observation_text,
    screenshot_url_for_ui,
    upload_computer_screenshot,
)


@pytest.fixture(autouse=True)
def _reset_resolved_bucket():
    sb_computer_tool._resolved_bucket = None
    yield
    sb_computer_tool._resolved_bucket = None


def _png_b64(width: int = 40, height: int = 30, color=(12, 80, 200)) -> str:
    image = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def test_prepare_screenshot_returns_jpeg():
    encoded = prepare_screenshot_b64(_png_b64())
    raw = base64.b64decode(encoded)
    with Image.open(io.BytesIO(raw)) as img:
        assert img.format == "JPEG"
        assert img.size[0] <= 40
        assert img.size[1] <= 30


def test_prepare_screenshot_shrinks_large_images():
    encoded = prepare_screenshot_b64(_png_b64(2200, 1800))
    raw = base64.b64decode(encoded)
    with Image.open(io.BytesIO(raw)) as img:
        assert max(img.size) <= 1280
    assert len(raw) < 2200 * 1800


def test_prepare_screenshot_empty():
    assert prepare_screenshot_b64("") == ""


@pytest.mark.asyncio
async def test_capture_reports_resized_image_dimensions():
    computer = MagicMock()
    computer.screenshot = AsyncMock(return_value={
        "png_b64": _png_b64(1600, 1039),
        "width": 1600,
        "height": 1039,
        "screen_width": 1512,
        "screen_height": 982,
        "scale": 2,
    })
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    with patch("core.local_runner.screenshots.save_computer_screenshots_enabled", new_callable=AsyncMock, return_value=True):
        with patch("core.tools.sb_computer_tool.screenshot_url_for_ui", new_callable=AsyncMock) as upload:
            upload.return_value = "https://cdn.example/shot.jpg"
            result = await tool._capture("Screenshot captured.")
    payload = json.loads(result.output)
    assert payload["width"] == 1280
    assert payload["height"] == 831
    assert payload["screen_width"] == 1512


def test_screenshot_buckets_fall_back_to_existing_public_bucket():
    assert SCREENSHOT_BUCKETS[0] == "browser-screenshots"
    assert "share" in SCREENSHOT_BUCKETS


@pytest.mark.asyncio
async def test_upload_uses_first_working_bucket():
    with patch("core.tools.sb_computer_tool.upload_base64_image", new_callable=AsyncMock) as upload:
        upload.side_effect = [RuntimeError("Bucket not found"), "https://cdn.example/shot.jpg"]
        url = await upload_computer_screenshot("abc")
        assert url == "https://cdn.example/shot.jpg"
        assert upload.await_count == 2
        assert upload.await_args_list[0].args[1] == "browser-screenshots"
        assert upload.await_args_list[1].args[1] == "share"


@pytest.mark.asyncio
async def test_upload_falls_back_to_none_when_all_buckets_fail():
    with patch("core.tools.sb_computer_tool.upload_base64_image", new_callable=AsyncMock) as upload:
        upload.side_effect = RuntimeError("Bucket not found")
        url = await upload_computer_screenshot("abc123")
        assert url is None


@pytest.mark.asyncio
async def test_capture_skips_upload_by_default():
    computer = MagicMock()
    computer.screenshot = AsyncMock(return_value={"png_b64": _png_b64(), "width": 40, "height": 30, "screen_width": 40, "screen_height": 30, "scale": 1})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    with patch("core.local_runner.screenshots.save_computer_screenshots_enabled", new_callable=AsyncMock, return_value=False):
        with patch("core.tools.sb_computer_tool.screenshot_url_for_ui", new_callable=AsyncMock) as upload:
            result = await tool._capture("Opened WeChat.")
    assert result.success is True
    payload = json.loads(result.output)
    assert "image_url" not in payload
    assert payload["screenshots_saved"] is False
    context = payload["_image_context_data"]
    assert context["persist"] is False
    assert context["persist_message_content"] is None
    assert context["message_content"]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    upload.assert_not_awaited()


@pytest.mark.asyncio
async def test_capture_succeeds_after_upload():
    computer = MagicMock()
    computer.screenshot = AsyncMock(return_value={"png_b64": _png_b64(), "width": 40, "height": 30, "screen_width": 40, "screen_height": 30, "scale": 1})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    tool._omit_previous_computer_screenshots = AsyncMock()
    with patch("core.local_runner.screenshots.save_computer_screenshots_enabled", new_callable=AsyncMock, return_value=True):
        with patch("core.tools.sb_computer_tool.screenshot_url_for_ui", new_callable=AsyncMock) as upload:
            upload.return_value = "https://cdn.example/shot.jpg"
            result = await tool._capture("Screenshot captured.")
    assert result.success is True
    payload = json.loads(result.output)
    assert payload["image_url"] == "https://cdn.example/shot.jpg"
    assert payload["screenshots_saved"] is True
    assert payload["width"] == 40
    context = payload["_image_context_data"]
    assert context["message_content"]["content"][0]["text"] == SCREEN_OBSERVATION_TEXT
    assert context["message_content"]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert context["persist"] is True
    assert context["persist_message_content"]["content"][1]["image_url"]["url"] == "https://cdn.example/shot.jpg"


@pytest.mark.asyncio
async def test_capture_still_shows_model_the_screen_when_upload_fails():
    computer = MagicMock()
    computer.screenshot = AsyncMock(return_value={"png_b64": _png_b64(), "width": 40, "height": 30})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    with patch("core.local_runner.screenshots.save_computer_screenshots_enabled", new_callable=AsyncMock, return_value=True):
        with patch("core.tools.sb_computer_tool.screenshot_url_for_ui", new_callable=AsyncMock) as upload:
            upload.return_value = None
            result = await tool._capture("Screenshot captured.")
    assert result.success is True
    payload = json.loads(result.output)
    assert "image_url" not in payload
    context = payload["_image_context_data"]
    assert context["persist"] is False
    assert context["message_content"]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert context["persist_message_content"] is None


@pytest.mark.asyncio
async def test_screenshot_url_awaits_first_upload_then_backgrounds_the_rest():
    with patch("core.tools.sb_computer_tool.upload_base64_image", new_callable=AsyncMock) as upload:
        upload.return_value = "https://cdn.example/first.jpg"
        assert await screenshot_url_for_ui("abc") == "https://cdn.example/first.jpg"
        assert upload.await_count == 1

        with patch("core.tools.sb_computer_tool._public_url", new_callable=AsyncMock) as public_url:
            public_url.return_value = "https://cdn.example/browser-screenshots/predicted.jpg"
            url = await screenshot_url_for_ui("def")
            assert url == "https://cdn.example/browser-screenshots/predicted.jpg"
            assert public_url.await_args.args[0] == "browser-screenshots"

        await asyncio.gather(*list(sb_computer_tool._background_uploads))
        assert upload.await_count == 2
        # The background upload must write to the object name we already handed out.
        assert upload.await_args.kwargs["filename"] == public_url.await_args.args[1]


@pytest.mark.asyncio
async def test_upload_sends_jpeg_content_type():
    with patch("core.tools.sb_computer_tool.upload_base64_image", new_callable=AsyncMock) as upload:
        upload.return_value = "https://cdn.example/shot.jpg"
        url = await upload_computer_screenshot("abc")
        assert url == "https://cdn.example/shot.jpg"
        assert upload.await_args.kwargs.get("content_type") == "image/jpeg"


def test_strip_image_context_from_tool_output():
    from core.agents.pipeline.stateless.coordinator.tool_executor import _split_image_context_output

    original = json.dumps({
        "success": True,
        "image_url": "https://cdn.example/shot.jpg",
        "_image_context_data": {"thread_id": "t"},
    })
    stripped, full = _split_image_context_output(original)
    assert json.loads(stripped) == {"success": True, "image_url": "https://cdn.example/shot.jpg"}
    assert json.loads(full)["_image_context_data"]["thread_id"] == "t"


@pytest.mark.asyncio
async def test_open_completes_even_if_screenshot_fails():
    computer = MagicMock()
    computer.open = AsyncMock(return_value={"ok": True})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    tool._capture = AsyncMock(side_effect=TimeoutError("screenshot timed out"))
    with patch("core.tools.sb_computer_tool.asyncio.sleep", new_callable=AsyncMock):
        result = await tool.computer_open("WeChat")
    assert result.success is True
    assert "Opened WeChat" in result.output


@pytest.mark.asyncio
async def test_open_succeeds_when_screenshot_returns_failure():
    computer = MagicMock()
    computer.open = AsyncMock(return_value={"ok": True})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    tool._capture = AsyncMock(return_value=tool.fail_response("Screenshot failed."))
    with patch("core.tools.sb_computer_tool.asyncio.sleep", new_callable=AsyncMock):
        result = await tool.computer_open("WeChat")
    assert result.success is True
    assert "Opened WeChat" in result.output


def test_computer_screen_observation_does_not_match_user_text():
    from core.agents.pipeline.stateless.state import _is_computer_screen_observation

    assert _is_computer_screen_observation({
        "role": "user",
        "content": [
            {"type": "text", "text": SCREEN_OBSERVATION_TEXT},
            {"type": "image_url", "image_url": {"url": "https://x"}},
        ],
    })
    assert _is_computer_screen_observation({
        "role": "user",
        "content": [
            {"type": "text", "text": "Actions so far (this text is the memory).\n\n" + SCREEN_OBSERVATION_TEXT},
            {"type": "image_url", "image_url": {"url": "https://x"}},
        ],
    })
    assert _is_computer_screen_observation({
        "role": "user",
        "content": [
            {"type": "text", "text": "[Screenshot of this computer]"},
            {"type": "image_url", "image_url": {"url": "https://x"}},
        ],
    })
    assert not _is_computer_screen_observation({
        "role": "user",
        "content": "[Screenshot of this computer]",
    })


@pytest.mark.asyncio
async def test_computer_type_submit_presses_return():
    computer = MagicMock()
    computer.type = AsyncMock(return_value={"ok": True})
    computer.key = AsyncMock(return_value={"ok": True})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    tool._capture = AsyncMock(return_value=tool.success_response({"message": "Typed and submitted."}))
    with patch("core.tools.sb_computer_tool.asyncio.sleep", new_callable=AsyncMock):
        result = await tool.computer_type("hello", submit=True, intent="Send reply in the message box")
    assert result.success is True
    computer.type.assert_awaited_once_with(text="hello", replace=False, submit=True)
    computer.key.assert_not_called()
    assert "Typed and submitted" in result.output


@pytest.mark.asyncio
async def test_computer_type_replace_overwrites_field():
    computer = MagicMock()
    computer.type = AsyncMock(return_value={"ok": True})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    tool._capture = AsyncMock(return_value=tool.success_response({"message": "Replaced field text."}))
    with patch("core.tools.sb_computer_tool.asyncio.sleep", new_callable=AsyncMock):
        result = await tool.computer_type("斯坦福", replace=True, intent="Search field")
    assert result.success is True
    computer.type.assert_awaited_once_with(text="斯坦福", replace=True, submit=False)
    computer.key.assert_not_called()
    assert "Replaced field text" in result.output


@pytest.mark.asyncio
async def test_computer_screenshot_reuses_fresh_capture():
    computer = MagicMock()
    computer.screenshot = AsyncMock(return_value={
        "png_b64": _png_b64(40, 30),
        "width": 40,
        "height": 30,
        "screen_width": 40,
        "screen_height": 30,
        "scale": 1,
    })
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    with patch("core.local_runner.screenshots.save_computer_screenshots_enabled", new_callable=AsyncMock, return_value=False):
        first = await tool._capture("Clicked (10, 10).")
        reused = await tool.computer_screenshot()
        second = await tool.computer_screenshot()
    assert first.success is True
    assert reused.success is True
    payload = json.loads(reused.output)
    assert payload["reused"] is True
    assert computer.screenshot.await_count == 2
    assert "already returned" not in json.loads(second.output).get("message", "")


@pytest.mark.asyncio
async def test_two_screenshot_failures_tell_the_model_to_stop():
    computer = MagicMock()
    computer.screenshot = AsyncMock(return_value={"png_b64": "", "width": 0, "height": 0})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    first = await tool.computer_screenshot()
    second = await tool.computer_screenshot()
    assert first.success is False
    assert second.success is False
    assert "Stop." in second.output
    assert "Do not call any more computer tools" in second.output


def test_large_or_missing_dy_is_one_page():
    assert is_page_scroll(None) is True
    assert is_page_scroll(520) is True
    assert is_page_scroll(3) is False


@pytest.mark.asyncio
async def test_scroll_defaults_to_one_page():
    computer = MagicMock()
    computer.scroll = AsyncMock(return_value={"ok": True})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    tool._last_screen = {"height": 831, "screen_height": 982}
    tool._capture = AsyncMock(return_value=tool.success_response({"message": "Scrolled one page."}))
    with patch("core.tools.sb_computer_tool.asyncio.sleep", new_callable=AsyncMock):
        result = await tool.computer_scroll(180, 400, intent="Reveal the next unused chats")
    assert result.success is True
    computer.scroll.assert_awaited_once()
    kwargs = computer.scroll.await_args.kwargs
    assert kwargs["dy"] == 1
    assert kwargs["unit"] == "page"
    assert "Scrolled one page" in tool._capture.await_args.args[0]


@pytest.mark.asyncio
async def test_scroll_treats_model_pixel_dy_as_one_page():
    computer = MagicMock()
    computer.scroll = AsyncMock(return_value={"ok": True})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    tool._capture = AsyncMock(return_value=tool.success_response({"message": "Scrolled one page."}))
    with patch("core.tools.sb_computer_tool.asyncio.sleep", new_callable=AsyncMock):
        await tool.computer_scroll(180, 400, dy=520, intent="Reveal the next unused chats")
    kwargs = computer.scroll.await_args.kwargs
    assert kwargs["unit"] == "page"
    assert kwargs["dy"] == 1


def test_format_action_log_names_clicked_targets():
    text = format_action_log(
        ['Intent: Focus search box. Clicked (120, 64)', 'Intent: Open left-list row 家庭群. Clicked (412, 280)'],
        ["Focus search box", "Open left-list row 家庭群"],
    )
    assert "Already done: Focus search box · Open left-list row 家庭群." in text
    assert "1. Intent: Focus search box. Clicked (120, 64)" in text
    assert "this text is the memory" in text
    observation = screen_observation_text(
        ['Intent: Focus search box. Clicked (120, 64)'],
        ["Focus search box"],
    )
    assert observation.startswith("Actions so far")
    assert "Current Mac screen" in observation
    assert screen_observation_text() == SCREEN_OBSERVATION_TEXT


@pytest.mark.asyncio
async def test_click_without_intent_is_rejected():
    computer = MagicMock()
    computer.click = AsyncMock(return_value={"ok": True})
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    result = await tool.computer_click(120, 64)
    assert result.success is False
    assert "needs intent" in result.output
    computer.click.assert_not_awaited()


@pytest.mark.asyncio
async def test_click_keeps_named_actions_after_screenshot_is_replaced():
    computer = MagicMock()
    computer.click = AsyncMock(return_value={"ok": True})
    computer.screenshot = AsyncMock(return_value={
        "png_b64": _png_b64(),
        "width": 40,
        "height": 30,
        "screen_width": 40,
        "screen_height": 30,
        "scale": 1,
    })
    tool = SandboxComputerTool("proj", MagicMock(), "thread")
    tool._require_local_computer = AsyncMock(return_value=(computer, None))
    with patch("core.local_runner.screenshots.save_computer_screenshots_enabled", new_callable=AsyncMock, return_value=False):
        with patch("core.tools.sb_computer_tool.asyncio.sleep", new_callable=AsyncMock):
            first = await tool.computer_click(120, 64, intent="Focus search box")
            second = await tool.computer_click(412, 280, intent="Open left-list row 家庭群")
    first_payload = json.loads(first.output)
    second_payload = json.loads(second.output)
    assert first_payload["targets"] == ["Focus search box"]
    assert "Intent: Focus search box. Clicked (120, 64)" in first_payload["message"]
    assert second_payload["targets"] == ["Focus search box", "Open left-list row 家庭群"]
    assert second_payload["actions"] == [
        "Intent: Focus search box. Clicked (120, 64)",
        "Intent: Open left-list row 家庭群. Clicked (412, 280)",
    ]
    observation = second_payload["_image_context_data"]["message_content"]["content"][0]["text"]
    assert observation.startswith("Actions so far")
    assert "Already done: Focus search box · Open left-list row 家庭群." in observation
    assert "1. Intent: Focus search box. Clicked (120, 64)" in observation
    computer.click.assert_awaited()
    assert "intent" not in computer.click.await_args.kwargs
    assert "target" not in computer.click.await_args.kwargs


def test_estimate_cached_prompt_tokens_leaves_fresh_image_room():
    from core.billing.credits.calculator import estimate_cached_prompt_tokens, cached_tokens_from_usage

    assert estimate_cached_prompt_tokens(18000, 0) == 0
    assert estimate_cached_prompt_tokens(18300, 18000) == 16000
    assert cached_tokens_from_usage({"prompt_tokens_details": {"cached_tokens": 7903}}) == 7903
