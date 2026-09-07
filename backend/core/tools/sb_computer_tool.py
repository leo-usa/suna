import asyncio
import base64
import io
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

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
    "The image is only for choosing the next unused control and its coordinates. "
    "If a computer action failed, do not retry that same action. "
    "Ignore the Dobby window if it appears."
)
_MAX_ACTION_LOG = 30
_MAX_TARGETS = 40


# Models often invent a half-screen dy (400–700) thinking it is pixels. WeChat
# treats one huge line-wheel event as a single row, so treat those as one page.
_PAGE_SCROLL_DY = 16


def is_page_scroll(dy: Optional[float] = None) -> bool:
    if dy is None:
        return True
    try:
        return abs(float(dy)) >= _PAGE_SCROLL_DY
    except (TypeError, ValueError):
        return True


def page_scroll_sign(dy: Optional[float] = None) -> int:
    try:
        return -1 if dy is not None and float(dy) < 0 else 1
    except (TypeError, ValueError):
        return 1


def _clean_label(value: Optional[str], limit: int = 80) -> str:
    name = " ".join(str(value or "").split())
    if len(name) > limit:
        return name[: limit - 1] + "…"
    return name


def format_action_log(actions: Optional[List[str]] = None, targets: Optional[List[str]] = None) -> str:
    actions = [str(item).strip() for item in (actions or []) if str(item).strip()]
    targets = [str(item).strip() for item in (targets or []) if str(item).strip()]
    if not actions and not targets:
        return ""
    parts = [
        "Actions so far (this text is the memory; older screenshots were discarded). "
        "Do not repeat a listed action. Follow the user's steps; do not invent a search-first workflow."
    ]
    if targets:
        parts.append("Already done: " + " · ".join(targets) + ".")
    if actions:
        parts.append("\n".join(f"{i}. {item}" for i, item in enumerate(actions, 1)))
    return "\n".join(parts)


def screen_observation_text(
    actions: Optional[List[str]] = None,
    targets: Optional[List[str]] = None,
) -> str:
    log = format_action_log(actions, targets)
    if not log:
        return SCREEN_OBSERVATION_TEXT
    return f"{log}\n\n{SCREEN_OBSERVATION_TEXT}"


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


def _observation_message(url: str, text: Optional[str] = None) -> dict:
    return {
        "role": "user",
        "content": [
            {"type": "text", "text": text or SCREEN_OBSERVATION_TEXT},
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

These tools control the real Mac desktop. They are already loaded. Do not call initialize_tools.

- computer_screenshot: first look only, when you have no screenshot yet
- computer_click: click screenshot-pixel coordinates. Requires intent.
- computer_type: type into the focused field. Requires intent. replace overwrites a field; submit types and presses return
- computer_key: press keys such as tab, escape, cmd+c
- computer_scroll: scroll at a point on the list you want to move. Omit dy. One call already scrolls one page (last visible item to the top).
- computer_open: open an app or URL, then screenshot

Computer-use is generic. Follow the user's steps for whatever app is on screen. Do not assume a search-first chat workflow.

Rules:
- One tool per turn. Never open, click, and type together.
- Every click, type, key, scroll, and open already returns the current screenshot. Do not recapture.
- Before computer_click or computer_type, set intent to a short sentence: what you are about to do, and which visible control you will use. That sentence is the memory after the screenshot is discarded.
- Read Actions so far after every step. Do not repeat a listed action.
- Click the field you will type into immediately before computer_type.
- To send a message or submit a form, computer_type once with submit true. Do not type then computer_key return.
- If a field already has text, set replace true.
- If the next item is not visible, computer_scroll over that list (put x/y on the list itself, omit dy). One call is one page. Do not pass a large dy. Then continue. Do not stop just because the current screenshot ends.
- If the user only asked for a screenshot, take one and stop.
- Ignore the Dobby window.
""",
)
class SandboxComputerTool(SandboxToolsBase):
    """Control the user's Mac when the project is running locally."""

    def __init__(self, project_id: str, thread_manager: ThreadManager, thread_id: Optional[str] = None):
        super().__init__(project_id, thread_manager)
        self.thread_id = thread_id
        self._last_screen: dict = {}
        self._action_log: List[str] = []
        self._targets: List[str] = []
        self._fresh_capture = False
        self._consecutive_failures = 0

    def _note(self, line: str) -> str:
        line = str(line or "").strip().rstrip(".")
        if line:
            self._action_log.append(line)
            if len(self._action_log) > _MAX_ACTION_LOG:
                self._action_log = self._action_log[-_MAX_ACTION_LOG:]
        return self._message_with_log(f"{line}.")

    def _remember_target(self, name: str) -> None:
        if name and name not in self._targets:
            self._targets.append(name)
            if len(self._targets) > _MAX_TARGETS:
                self._targets = self._targets[-_MAX_TARGETS:]

    def _message_with_log(self, message: str) -> str:
        log = format_action_log(self._action_log, self._targets)
        if not log:
            return message
        return f"{message}\n\n{log}"

    def _intent_or_fail(self, intent: Optional[str], target: Optional[str]) -> Optional[str]:
        return _clean_label(intent) or _clean_label(target) or None

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

        observation = screen_observation_text(self._action_log, self._targets)
        payload = {
            "success": True,
            "message": message,
            "screenshots_saved": bool(image_url),
            **self._last_screen,
        }
        if self._action_log:
            payload["actions"] = list(self._action_log)
        if self._targets:
            payload["targets"] = list(self._targets)
        if image_url:
            payload["image_url"] = image_url
        if self.thread_id:
            # Inline the image instead of the hosted URL: the model never has to fetch
            # a URL it has not seen before, which is the slowest part of each step.
            # Thread history keeps the hosted URL so rows stay small — and only
            # when the user opted in to saving screenshots.
            payload["_image_context_data"] = {
                "thread_id": self.thread_id,
                "message_content": _observation_message(f"data:image/jpeg;base64,{png_b64}", observation),
                "persist": bool(image_url),
                "persist_message_content": _observation_message(image_url, observation) if image_url else None,
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
                payload = {
                    "success": True,
                    "message": self._message_with_log(
                        "The last computer action already returned the current screen. Use that screenshot's coordinates for the next click or type. Do not recapture."
                    ),
                    **self._last_screen,
                    "reused": True,
                }
                if self._action_log:
                    payload["actions"] = list(self._action_log)
                if self._targets:
                    payload["targets"] = list(self._targets)
                return self.success_response(payload)
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
            "description": "Click the Mac screen at screenshot-pixel coordinates from the last computer_* screenshot. Do not call computer_screenshot first. Set intent to what you are about to do and which visible control you will click. That sentence is kept after the screenshot is discarded.",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X coordinate in screenshot pixels"},
                    "y": {"type": "number", "description": "Y coordinate in screenshot pixels"},
                    "button": {"type": "string", "enum": ["left", "right"], "description": "Mouse button. Default left."},
                    "count": {"type": "integer", "description": "Click count. 2 for double-click. Default 1.", "minimum": 1, "maximum": 3},
                    "intent": {"type": "string", "description": "Required. What you are about to do and which visible control you will click, e.g. 'Open the next unused left-list row 家庭群' or 'Focus the message box'."},
                    "target": {"type": "string", "description": "Alias for intent if you already named the on-screen control."},
                },
                "required": ["x", "y", "intent"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_click(
        self,
        x: float,
        y: float,
        button: str = "left",
        count: int = 1,
        target: Optional[str] = None,
        intent: Optional[str] = None,
    ) -> ToolResult:
        try:
            name = self._intent_or_fail(intent, target)
            if not name:
                return self.fail_response(
                    "computer_click needs intent: a short sentence of what you are about to do and which visible control you will click. Then retry with intent set."
                )
            computer, error = await self._require_local_computer()
            if error:
                return error
            await computer.click(x=x, y=y, button=button or "left", count=int(count or 1), **self._screen_meta())
            await asyncio.sleep(0.7)
            self._remember_target(name)
            return await self._capture(self._note(f'Intent: {name}. Clicked ({int(x)}, {int(y)})'))
        except Exception as e:
            logger.error(f"[COMPUTER] click failed: {e}")
            return self._fail(str(e))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_type",
            "description": "Type text into the focused field on this Mac. Always click that field first. Set intent to the field and why you are typing. Set replace true to overwrite existing text. Set submit true to type and press return in one step. Do not follow this with computer_key return.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to type"},
                    "intent": {"type": "string", "description": "Required. What you are typing into and why, e.g. 'Type a reply in the message box' or 'Search for the next unused group'."},
                    "target": {"type": "string", "description": "Alias for intent if you already named the field."},
                    "replace": {"type": "boolean", "description": "If true, select all existing text and replace it. Use this instead of backspacing or clicking a clear button."},
                    "submit": {"type": "boolean", "description": "If true, type and press return in one step, then screenshot once. Use this to send a message or submit a form. Do not call computer_key return afterward."},
                },
                "required": ["text", "intent"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_type(
        self,
        text: str,
        replace: bool = False,
        submit: bool = False,
        target: Optional[str] = None,
        intent: Optional[str] = None,
    ) -> ToolResult:
        try:
            name = self._intent_or_fail(intent, target)
            if not name:
                return self.fail_response(
                    "computer_type needs intent: which field you are typing into and why. Then retry with intent set."
                )
            computer, error = await self._require_local_computer()
            if error:
                return error
            await computer.type(text=str(text or ""), replace=bool(replace), submit=bool(submit))
            await asyncio.sleep(0.35)
            preview = _clean_label(text, 40)
            self._remember_target(name)
            if submit:
                line = f'Intent: {name}. Typed and submitted "{preview}"'
            elif replace:
                line = f'Intent: {name}. Replaced field with "{preview}"'
            else:
                line = f'Intent: {name}. Typed "{preview}"'
            return await self._capture(self._note(line))
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
            return await self._capture(self._note(f"Pressed {key}"))
        except Exception as e:
            logger.error(f"[COMPUTER] key failed: {e}")
            return self._fail(str(e))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_scroll",
            "description": "Scroll at screenshot-pixel coordinates on the list you want to move. Omit dy. One call already scrolls one page so the last visible item moves to the top. Only pass dy 1-8 for a small nudge. Set intent or target to the area you are scrolling.",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X coordinate on the list you want to move, in screenshot pixels. Do not use the other pane."},
                    "y": {"type": "number", "description": "Y coordinate on the list you want to move, in screenshot pixels"},
                    "dy": {"type": "number", "description": "Optional small nudge in lines (1-8). Omit this. Do not pass a large number."},
                    "dx": {"type": "number", "description": "Horizontal scroll in lines. Default 0."},
                    "intent": {"type": "string", "description": "What you are scrolling and why, e.g. 'Reveal the next unused chats in the left list'."},
                    "target": {"type": "string", "description": "Alias for intent if you already named the scroll area."},
                },
                "required": ["x", "y"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_scroll(
        self,
        x: float,
        y: float,
        dy: Optional[float] = None,
        dx: float = 0,
        target: Optional[str] = None,
        intent: Optional[str] = None,
    ) -> ToolResult:
        try:
            computer, error = await self._require_local_computer()
            if error:
                return error
            if is_page_scroll(dy):
                await computer.scroll(
                    x=x, y=y, dy=page_scroll_sign(dy), dx=dx, unit="page", **self._screen_meta()
                )
                label = "one page"
            else:
                await computer.scroll(x=x, y=y, dy=dy, dx=dx, **self._screen_meta())
                label = f"{int(dy)} lines"
            await asyncio.sleep(0.45)
            name = self._intent_or_fail(intent, target)
            if name:
                self._remember_target(name)
                line = f"Intent: {name}. Scrolled {label}"
            else:
                line = f"Scrolled {label}"
            return await self._capture(self._note(line))
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
                captured = await asyncio.wait_for(self._capture(self._note(f"Opened {target}")), timeout=15)
                if captured.success:
                    return captured
                logger.warning(f"[COMPUTER] open succeeded but screenshot failed: {captured.output}")
            except Exception as e:
                logger.warning(f"[COMPUTER] open succeeded but screenshot failed: {e}")
            return self.success_response({"success": True, "message": f"Opened {target}."})
        except Exception as e:
            logger.error(f"[COMPUTER] open failed: {e}")
            return self.fail_response(str(e))
