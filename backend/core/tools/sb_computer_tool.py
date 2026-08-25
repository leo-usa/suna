import asyncio
import base64
import io
import uuid
from datetime import datetime
from typing import Optional, Tuple

from PIL import Image

from core.agentpress.thread_manager import ThreadManager
from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.utils.logger import logger
from core.utils.s3_upload_utils import upload_base64_image

# Staging/prod may not have browser-screenshots. `share` exists and is public.
SCREENSHOT_BUCKETS = ("browser-screenshots", "share")
SCREEN_OBSERVATION_TEXT = (
    "Current Mac screen after the last action (observation only, not a new user request). "
    "Continue the original task from this screenshot. "
    "If a computer action failed, do not retry that same action. "
    "Ignore the Dobby window if it appears."
)


def prepare_screenshot(b64: str) -> Tuple[str, int, int]:
    """Return the JPEG the model will see, plus its pixel size."""
    if not b64:
        return "", 0, 0
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[1]
    raw = base64.b64decode(b64)
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    image.thumbnail((1280, 1280))
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=60, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii"), image.width, image.height


def prepare_screenshot_b64(b64: str) -> str:
    return prepare_screenshot(b64)[0]


_resolved_bucket: Optional[str] = None
_background_uploads: set = set()


async def _upload_to(bucket: str, b64: str, filename: Optional[str] = None) -> str:
    return await asyncio.wait_for(
        upload_base64_image(b64, bucket, content_type="image/jpeg", filename=filename),
        timeout=5.0,
    )


async def upload_computer_screenshot(b64: str) -> Optional[str]:
    global _resolved_bucket
    buckets = (_resolved_bucket,) if _resolved_bucket else SCREENSHOT_BUCKETS
    last_error: Optional[Exception] = None
    for bucket in buckets:
        try:
            url = await _upload_to(bucket, b64)
            _resolved_bucket = bucket
            return url
        except Exception as e:
            last_error = e
            logger.warning(f"[COMPUTER] Upload to {bucket} failed: {e}")
    _resolved_bucket = None
    if last_error:
        logger.warning(f"[COMPUTER] Skipping screenshot URL after upload failure: {last_error}")
    return None


def _observation_message(url: str) -> dict:
    return {
        "role": "user",
        "content": [
            {"type": "text", "text": SCREEN_OBSERVATION_TEXT},
            {"type": "image_url", "image_url": {"url": url}},
        ],
    }


def _screenshot_filename() -> str:
    return f"image_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"


async def _public_url(bucket: str, filename: str) -> str:
    from core.services.supabase import DBConnection

    client = await DBConnection().client
    return await client.storage.from_(bucket).get_public_url(filename)


def _watch_upload(task: asyncio.Task, url: str) -> None:
    _background_uploads.add(task)

    def _done(t: asyncio.Task) -> None:
        _background_uploads.discard(t)
        error = t.exception() if not t.cancelled() else None
        if error:
            logger.warning(f"[COMPUTER] Background screenshot upload failed for {url}: {error}")

    task.add_done_callback(_done)


async def screenshot_url_for_ui(b64: str) -> Optional[str]:
    """Public URL for the Computer panel.

    The model is handed the image inline, so this upload only exists for the UI and
    for thread history. Once we know which bucket works we can hand back the URL the
    object will land at and let the upload finish in the background.
    """
    if not _resolved_bucket:
        return await upload_computer_screenshot(b64)

    filename = _screenshot_filename()
    url = await _public_url(_resolved_bucket, filename)
    _watch_upload(asyncio.create_task(_upload_to(_resolved_bucket, b64, filename)), url)
    return url


@tool_metadata(
    display_name="This computer",
    description="See the screen and control the mouse and keyboard on this Mac",
    icon="Monitor",
    color="bg-zinc-100 dark:bg-zinc-800/50",
    weight=55,
    visible=True,
    usage_guide="""
## This computer — local screen, mouse, and keyboard

Use these tools when the user asked Dobby to run on this computer. You are looking at the real Mac desktop, not a cloud browser.

- computer_screenshot: capture the current screen
- computer_click: click screenshot-pixel coordinates from the last screenshot
- computer_type: type or replace text in the focused field
- computer_key: press keys such as return, tab, escape, cmd+a, cmd+c, cmd+space
- computer_scroll: scroll at a point
- computer_open: open a URL or macOS app (WeChat, 微信, Safari, etc.)

Every click, type, key, scroll, and open already returns a screenshot. That screenshot is the current screen for the next action. Click using x/y from it.

Rules:
- Call these tools one at a time. Never open, click, and type in the same turn.
- Computer tools are already loaded. Do not call initialize_tools.
- Never call computer_screenshot before a click or type. The previous action already gave you the screen. computer_screenshot is only for the first look, when you have no screenshot yet.
- After each action, look at the screenshot that came back, then click or type. Do not recapture.
- Typing always goes to whatever holds keyboard focus. Click the exact field you want to fill right before every computer_type, even if the app looks ready.
- To send a WeChat message or submit a form, call computer_type once with submit true. That types and presses return together. Never computer_type then computer_key return.
- If a field already has text (WeChat search, filters, message drafts), also set replace true.
- If the user only asked for a screenshot, take one and stop. Do not recapture.
- Ignore the Dobby window; it is this app, not the user's task.
- For WeChat/Messages: computer_open the app, click the search box, computer_type the name with replace true (do not submit — search results are a list). Click the matching result to open the conversation, then click the message box at the bottom and computer_type the message with submit true. Opening a conversation leaves focus in the search panel, so the click on the message box is required.
""",
)
class SandboxComputerTool(SandboxToolsBase):
    """Control the user's Mac when the project is running locally."""

    def __init__(self, project_id: str, thread_manager: ThreadManager, thread_id: Optional[str] = None):
        super().__init__(project_id, thread_manager)
        self.thread_id = thread_id
        self._last_screen: dict = {}
        self._fresh_capture = False
        self._consecutive_failures = 0

    def _fail(self, msg: str) -> ToolResult:
        self._consecutive_failures += 1
        if self._consecutive_failures >= 2:
            return self.fail_response(
                f"{msg} Stop. Do not call any more computer tools. Tell the user to enable Screen Recording and Accessibility for Dobby, then fully quit (Cmd+Q) and reopen the app."
            )
        return self.fail_response(msg)

    async def _require_local_computer(self):
        await self._ensure_sandbox()
        if not str(self.sandbox_id or "").startswith("local:"):
            return None, self.fail_response(
                "Computer use is only available when this project is set to run on this computer."
            )
        computer = getattr(self.sandbox, "computer", None)
        if computer is None:
            return None, self.fail_response("This computer is not connected. Open the Dobby desktop app and try again.")
        return computer, None

    async def _capture(self, message: str) -> ToolResult:
        computer, error = await self._require_local_computer()
        if error:
            return error
        result = await asyncio.wait_for(computer.screenshot(), timeout=8) or {}
        png_b64, image_width, image_height = prepare_screenshot(result.get("png_b64") or "")
        if not png_b64:
            return self.fail_response("Screenshot failed. Grant Screen Recording permission to Dobby, then fully quit (Cmd+Q) and reopen the desktop app.")

        # width/height must describe the image the model actually sees, since clicks
        # are mapped back to the screen using that ratio.
        self._last_screen = {
            "width": image_width or int(result.get("width") or 0),
            "height": image_height or int(result.get("height") or 0),
            "screen_width": int(result.get("screen_width") or 0),
            "screen_height": int(result.get("screen_height") or 0),
            "scale": float(result.get("scale") or 1),
        }

        from core.local_runner.screenshots import save_computer_screenshots_enabled

        save_screenshots = await save_computer_screenshots_enabled(self.project_id)
        image_url = None
        if save_screenshots:
            try:
                image_url = await screenshot_url_for_ui(png_b64)
            except Exception as e:
                logger.error(f"[COMPUTER] Failed to upload screenshot: {e}")
                image_url = None

        payload = {
            "success": True,
            "message": message,
            "screenshots_saved": bool(image_url),
            **self._last_screen,
        }
        if image_url:
            payload["image_url"] = image_url
        if self.thread_id:
            # Inline the image instead of the hosted URL: the model never has to fetch
            # a URL it has not seen before, which is the slowest part of each step.
            # Thread history keeps the hosted URL so rows stay small — and only
            # when the user opted in to saving screenshots.
            payload["_image_context_data"] = {
                "thread_id": self.thread_id,
                "message_content": _observation_message(f"data:image/jpeg;base64,{png_b64}"),
                "persist": bool(image_url),
                "persist_message_content": _observation_message(image_url) if image_url else None,
                "metadata": {"kind": "computer_screenshot"},
            }
        logger.info(f"[COMPUTER] Capture ready: {message}")
        self._fresh_capture = True
        self._consecutive_failures = 0
        return self.success_response(payload)

    async def _omit_previous_computer_screenshots(self) -> None:
        if not self.thread_id:
            return
        try:
            await asyncio.wait_for(self._omit_previous_computer_screenshots_inner(), timeout=2.0)
        except Exception as e:
            logger.warning(f"[COMPUTER] Failed to omit previous screenshots: {e}")

    async def _omit_previous_computer_screenshots_inner(self) -> None:
        from core.cache.runtime_cache import invalidate_message_history_cache
        from core.services.db import execute_mutate
        await execute_mutate(
            """
            UPDATE messages
            SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"omitted": true}'::jsonb,
                updated_at = NOW()
            WHERE thread_id = :thread_id
              AND type = 'image_context'
              AND metadata->>'kind' = 'computer_screenshot'
              AND (metadata->>'omitted' IS NULL OR metadata->>'omitted' != 'true')
            """,
            {"thread_id": self.thread_id},
        )
        await invalidate_message_history_cache(self.thread_id)

    def _screen_meta(self) -> dict:
        return {k: v for k, v in self._last_screen.items() if v}

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_screenshot",
            "description": "Capture the Mac screen only when you do not already have one. Click, type, key, scroll, and open already return a screenshot — use that instead of calling this. If the user only asked for a screenshot, take exactly one and stop.",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
    })
    async def computer_screenshot(self) -> ToolResult:
        try:
            if self._fresh_capture:
                self._fresh_capture = False
                logger.info("[COMPUTER] Reusing last screenshot instead of recapturing")
                return self.success_response({
                    "success": True,
                    "message": "The last computer action already returned the current screen. Use that screenshot's coordinates for the next click or type. Do not recapture.",
                    **self._last_screen,
                    "reused": True,
                })
            result = await self._capture("Screenshot captured.")
            if not result.success:
                return self._fail(result.output)
            return result
        except Exception as e:
            logger.error(f"[COMPUTER] screenshot failed: {e}")
            return self._fail(str(e))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_click",
            "description": "Click the Mac screen at screenshot-pixel coordinates from the last computer_* screenshot (the one the previous click/type/open already returned). Do not call computer_screenshot first. Use the cursor tip on the target.",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X coordinate in screenshot pixels"},
                    "y": {"type": "number", "description": "Y coordinate in screenshot pixels"},
                    "button": {"type": "string", "enum": ["left", "right"], "description": "Mouse button. Default left."},
                    "count": {"type": "integer", "description": "Click count. 2 for double-click. Default 1.", "minimum": 1, "maximum": 3},
                },
                "required": ["x", "y"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_click(self, x: float, y: float, button: str = "left", count: int = 1) -> ToolResult:
        try:
            computer, error = await self._require_local_computer()
            if error:
                return error
            await computer.click(x=x, y=y, button=button or "left", count=int(count or 1), **self._screen_meta())
            await asyncio.sleep(0.7)
            return await self._capture(f"Clicked ({int(x)}, {int(y)}).")
        except Exception as e:
            logger.error(f"[COMPUTER] click failed: {e}")
            return self._fail(str(e))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_type",
            "description": "Type text into the focused field on this Mac. Always click the target field with computer_click first. Set replace true to overwrite existing text in one step (select-all then paste) — use this for WeChat search and any field that is not empty. Set submit true to type and press return in the same step (send a message or submit a form). Do not follow this with computer_key return.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to type"},
                    "replace": {"type": "boolean", "description": "If true, select all existing text and replace it. Use this instead of backspacing or clicking a clear button."},
                    "submit": {"type": "boolean", "description": "If true, type and press return in one step, then screenshot once. Use this to send a message or submit a form. Do not use this for WeChat contact search, and do not call computer_key return afterward."},
                },
                "required": ["text"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_type(self, text: str, replace: bool = False, submit: bool = False) -> ToolResult:
        try:
            computer, error = await self._require_local_computer()
            if error:
                return error
            await computer.type(text=str(text or ""), replace=bool(replace), submit=bool(submit))
            await asyncio.sleep(0.35)
            if submit:
                return await self._capture("Typed and submitted.")
            return await self._capture("Replaced field text." if replace else "Typed text.")
        except Exception as e:
            logger.error(f"[COMPUTER] type failed: {e}")
            return self._fail(str(e))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_key",
            "description": "Press a key or key combo on this Mac. Examples: tab, escape, space, cmd+c, cmd+v, cmd+space, cmd+tab. To type text and press return, use computer_type with submit true — do not type and then call this with return. To replace field text, prefer computer_type with replace true instead of cmd+a plus a second type.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Key name or combo such as return, tab, escape, cmd+c"},
                },
                "required": ["key"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_key(self, key: str) -> ToolResult:
        try:
            computer, error = await self._require_local_computer()
            if error:
                return error
            await computer.key(key=str(key or ""))
            await asyncio.sleep(0.35)
            return await self._capture(f"Pressed {key}.")
        except Exception as e:
            logger.error(f"[COMPUTER] key failed: {e}")
            return self._fail(str(e))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_scroll",
            "description": "Scroll at screenshot-pixel coordinates. Positive dy scrolls down.",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X coordinate in screenshot pixels"},
                    "y": {"type": "number", "description": "Y coordinate in screenshot pixels"},
                    "dy": {"type": "number", "description": "Vertical scroll in lines. Positive is down. Default 3."},
                    "dx": {"type": "number", "description": "Horizontal scroll in lines. Default 0."},
                },
                "required": ["x", "y"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_scroll(self, x: float, y: float, dy: float = 3, dx: float = 0) -> ToolResult:
        try:
            computer, error = await self._require_local_computer()
            if error:
                return error
            await computer.scroll(x=x, y=y, dy=dy, dx=dx, **self._screen_meta())
            await asyncio.sleep(0.3)
            return await self._capture("Scrolled.")
        except Exception as e:
            logger.error(f"[COMPUTER] scroll failed: {e}")
            return self._fail(str(e))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_open",
            "description": "Open or activate a URL or macOS app on this computer, then return a screenshot. Examples: WeChat, 微信, Safari, Google Chrome, https://example.com. Call this by itself before clicking or typing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "App name or URL to open"},
                },
                "required": ["target"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_open(self, target: str) -> ToolResult:
        try:
            computer, error = await self._require_local_computer()
            if error:
                return error
            await computer.open(target=str(target or ""))
            await asyncio.sleep(0.8)
            try:
                captured = await asyncio.wait_for(self._capture(f"Opened {target}."), timeout=15)
                if captured.success:
                    return captured
                logger.warning(f"[COMPUTER] open succeeded but screenshot failed: {captured.output}")
            except Exception as e:
                logger.warning(f"[COMPUTER] open succeeded but screenshot failed: {e}")
            return self.success_response({"success": True, "message": f"Opened {target}."})
        except Exception as e:
            logger.error(f"[COMPUTER] open failed: {e}")
            return self.fail_response(str(e))
