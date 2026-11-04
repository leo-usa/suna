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
    "Current screen after the last action (observation only, not a new user request). "
    "The image is only for choosing the next unused control and its coordinates. "
    "If a computer action failed, do not retry that same action. "
    "Ignore the Dobby window if it appears."
)
_MAX_ACTION_LOG = 30
_MAX_TARGETS = 40

# Post-action settle times before the follow-up snapshot/screenshot.
# Keep these short: LLM round-trips already dominate latency, and long sleeps
# stack with every click/type in a computer-use loop.
_SETTLE_CLICK_S = 0.25
_SETTLE_UI_CLICK_S = 0.15
_SETTLE_TYPE_S = 0.15
_SETTLE_SUBMIT_S = 0.2
_SETTLE_SCROLL_S = 0.25
_SETTLE_OPEN_S = 0.45


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
    description="See the screen and control the mouse and keyboard on this computer",
    icon="Monitor",
    color="bg-zinc-100 dark:bg-zinc-800/50",
    weight=55,
    visible=True,
    usage_guide="""
## This computer — local screen, mouse, and keyboard

These tools control the real desktop on this computer. They are already loaded. Do not call initialize_tools.

When agent-desktop is available (default on current Mac/Windows builds), prefer the UI-tree path for named controls:
- computer_open: open an app/URL, then returns a UI tree (refs) when accessibility works
- computer_ui_snapshot: re-read the app UI tree. Pass app. Use root to drill into a region with children_count
- computer_ui_click: click a ref. Requires intent
- computer_ui_set_value: set a field by ref. Requires intent. For chat apps (WeChat), set submit true to send with Return — do not click Send
- computer_ui_type: type into a ref. Requires intent. Prefer submit true to send a chat message

Use screenshot + coordinates when the UI tree lacks the visual content you need (very common for WeChat video/message cards, thumbnails, and unlabeled bubbles):
- computer_screenshot / computer_click (button right for context menus) / computer_type / computer_key / computer_scroll
- computer_screenshot always returns a real image — it does not redirect to the UI tree.

Computer-use is generic. Follow the user's steps for whatever app is on screen. Do not assume a search-first chat workflow.

Rules:
- One tool per turn. Never open, click, and type together.
- Prefer UI refs for named controls (search fields, checkboxes, Send To, composer). Prefer screenshots when you must see thumbnails, video cards, or unlabeled message bodies.
- WeChat File Transfer / chat bubbles often omit video-card details from accessibility. If computer_ui_snapshot shows chrome but no identifiable video/message card, call computer_screenshot immediately, then computer_click with button right on the visible card and choose Forward. Do not ask the user to scroll or right-click for you.
- After Forward opens WeChat `Send To` (or any named picker/dialog), switch BACK to computer_ui_snapshot. Use computer_ui_set_value for Search / Attach a message and computer_ui_click for group checkboxes and Send To (N). Do not stay on the screenshot path for those named controls.
- Screenshot-path click/type/key/scroll already return a screenshot. Do not call computer_screenshot again after them.
- To send a WeChat/chat message: computer_ui_set_value on the composer with submit true. Do not click the Send button — its accessibility click often fails.
- If computer_ui_snapshot returns few/empty elements or fails, fall back to computer_screenshot + computer_click.
- UI actions return an updated text tree, not a screenshot. Call computer_screenshot when you need pixels.
- Before click/type/set_value, set intent to a short sentence: what you are about to do, and which control you will use.
- Read Actions so far / targets after every step — that is the progress ledger. Do not repeat a listed action. Do not refuse to continue only because older observations were compressed.
- AUTHORIZED LOCAL FORWARDING: a recipient file/list (e.g. group_names.txt) plus a forward/send request on this computer is consent for the full remaining list. Select up to ~9 per batch, click Send To (N)/Send, then continue until done. Do not refuse as spam/mass-message, do not ask to cancel the dialog, and do not ask the user to narrow to a small set. Only stop for a wrong source video, a blocked UI, or an explicit user stop.
- Click the field you will type into immediately before computer_type.
- To send a message or submit a form, computer_type once with submit true. Do not type then computer_key return.
- If a field already has text, set replace true (screenshot path) or computer_ui_set_value (UI path).
- If the next item is not visible, computer_scroll over that list (put x/y on the list itself, omit dy). One call is one page. Do not pass a large dy. Then continue. Do not stop just because the current screenshot ends.
- If the user only asked for a screenshot, take one and stop.
- Ignore the Dobby window.
""",
)
class SandboxComputerTool(SandboxToolsBase):
    """Control the user's computer when the project is running locally."""

    def __init__(self, project_id: str, thread_manager: ThreadManager, thread_id: Optional[str] = None):
        super().__init__(project_id, thread_manager)
        self.thread_id = thread_id
        self._last_screen: dict = {}
        self._action_log: List[str] = []
        self._targets: List[str] = []
        self._fresh_capture = False
        self._consecutive_failures = 0
        self._last_app: Optional[str] = None
        self._ax_available: Optional[bool] = None

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

    async def _ensure_ax_available(self, computer) -> bool:
        if self._ax_available is not None:
            return self._ax_available
        try:
            status = await asyncio.wait_for(computer.ax_status(), timeout=8) or {}
            self._ax_available = bool(status.get("available"))
        except Exception as e:
            logger.info(f"[COMPUTER] ax_status probe failed: {e}")
            self._ax_available = False
        logger.info(f"[COMPUTER] agent-desktop available={self._ax_available}")
        return self._ax_available

    def _ui_tree_usable(self, result: dict) -> bool:
        elements = result.get("elements") or []
        text = str(result.get("text") or "")
        if len(elements) >= 3:
            return True
        # Named controls even in a tiny tree are enough to act.
        named = [e for e in elements if (e.get("name") or e.get("value"))]
        return bool(named) or ("name=" in text)

    def _ui_tree_visual_gap_hint(self, result: dict, app: Optional[str] = None) -> str:
        """Hint when AX chrome exists but visual content (e.g. WeChat cards) is missing."""
        app_l = str(app or result.get("app") or self._last_app or "").lower()
        if "wechat" not in app_l and "微信" not in app_l:
            return ""
        blob_parts = [str(result.get("text") or "")]
        for el in result.get("elements") or []:
            blob_parts.append(str(el.get("name") or ""))
            blob_parts.append(str(el.get("role") or ""))
            blob_parts.append(str(el.get("value") or ""))
        blob = " ".join(blob_parts).lower()
        markers = (
            "chat_bubble",
            "bubble_item",
            "video",
            "forward",
            "转发",
            "send to",
            "wechat send",
            "attach a message",
            "附件",
        )
        if any(m in blob for m in markers):
            return ""
        return (
            " This WeChat accessibility tree has no message/video card details. "
            "Call computer_screenshot next, then computer_click with button=\"right\" on the visible video card "
            "and choose Forward. Do not ask the user to scroll or right-click for you."
        )

    async def _observe_ui(self, message: str, app: Optional[str] = None, root: Optional[str] = None) -> Optional[ToolResult]:
        """Return a UI-tree observation when agent-desktop works; otherwise None."""
        computer, error = await self._require_local_computer()
        if error:
            return error
        if not await self._ensure_ax_available(computer):
            return None
        try:
            result = await computer.ax_snapshot(
                app=app or self._last_app,
                root=root,
                skeleton=not bool(root),
            )
        except Exception as e:
            logger.warning(f"[COMPUTER] ax_snapshot failed, will fall back to screenshot: {e}")
            self._ax_available = False
            return None
        if not self._ui_tree_usable(result):
            logger.info("[COMPUTER] UI tree empty/useless; falling back to screenshot")
            return None
        self._fresh_capture = False
        self._consecutive_failures = 0
        hint = self._ui_tree_visual_gap_hint(result, app=app)
        return self.success_response(self._ui_payload(f"{message}{hint}", result))

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
        self._omit_previous_computer_history()
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

    def _ui_payload(self, message: str, result: dict) -> dict:
        from core.tools.computer_cost_controls import compress_ax_payload

        compressed = compress_ax_payload(result.get("elements"), result.get("text"))
        payload = {
            "success": True,
            "mode": "ax",
            "message": message,
            "app": result.get("app"),
            "snapshot_id": result.get("snapshot_id"),
            "complete": result.get("complete", True),
            "truncated": bool(result.get("truncated")) or bool(compressed["truncated"]),
            "ref_count": result.get("ref_count") if result.get("ref_count") is not None else compressed["ref_count"],
            "elements": compressed["elements"],
            "tree": compressed["tree"],
        }
        if self._action_log:
            payload["actions"] = list(self._action_log)
        if self._targets:
            payload["targets"] = list(self._targets)
        return payload

    def _omit_previous_computer_history(self) -> None:
        """Compress prior computer history in the background — never block the click path."""
        if not self.thread_id:
            return

        async def _run() -> None:
            try:
                from core.tools.computer_cost_controls import omit_previous_computer_tool_results

                await asyncio.wait_for(
                    omit_previous_computer_tool_results(self.thread_id),
                    timeout=2.0,
                )
            except Exception as e:
                logger.warning(f"[COMPUTER] Failed to omit previous computer tool history: {e}")
            try:
                await self._omit_previous_computer_screenshots()
            except Exception as e:
                logger.warning(f"[COMPUTER] Failed to omit previous screenshots: {e}")

        asyncio.create_task(_run())

    async def _ui_snapshot_after(
        self,
        message: str,
        app: Optional[str] = None,
        root: Optional[str] = None,
    ) -> ToolResult:
        computer, error = await self._require_local_computer()
        if error:
            return error
        result = await computer.ax_snapshot(app=app, root=root, skeleton=not bool(root))
        if not result.get("ok") and result.get("available") is False:
            return self.fail_response(
                "Accessibility UI tree is not available. Install agent-desktop (`npm install -g agent-desktop`), "
                "grant Accessibility to Dobby, then quit and reopen. Until then use computer_screenshot."
            )
        self._fresh_capture = False
        self._consecutive_failures = 0
        self._omit_previous_computer_history()
        return self.success_response(self._ui_payload(message, result))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_ui_snapshot",
            "description": "Read this computer app's accessibility UI tree (refs) via agent-desktop. Prefer this over computer_screenshot when named controls are enough. For WeChat video/message cards, thumbnails, or unlabeled bubbles, AX often lacks details — then call computer_screenshot. Pass app (e.g. Finder, Calculator, WeChat). Pass root to drill into a region that showed children_count. Returns text refs — no screenshot.",
            "parameters": {
                "type": "object",
                "properties": {
                    "app": {"type": "string", "description": "App name to snapshot, e.g. Finder, Calculator, WeChat, 微信"},
                    "root": {"type": "string", "description": "Optional ref from a prior snapshot to drill into that region"},
                    "skeleton": {"type": "boolean", "description": "If true (default), shallow map only. Ignored when root is set."},
                },
                "additionalProperties": False,
            },
        },
    })
    async def computer_ui_snapshot(
        self,
        app: Optional[str] = None,
        root: Optional[str] = None,
        skeleton: bool = True,
    ) -> ToolResult:
        try:
            computer, error = await self._require_local_computer()
            if error:
                return error
            result = await computer.ax_snapshot(
                app=app,
                root=root,
                skeleton=bool(skeleton) if not root else False,
            )
            if result.get("available") is False or (
                not result.get("ok") and not result.get("elements") and not result.get("text")
            ):
                return self.fail_response(
                    "Accessibility UI tree unavailable or empty. Fall back to computer_screenshot + computer_click. "
                    "If agent-desktop is missing, install it with `npm install -g agent-desktop` and reopen Dobby."
                )
            self._fresh_capture = False
            self._consecutive_failures = 0
            msg = self._note(
                f"UI snapshot of {app or result.get('app') or 'app'}"
                + (f" root {root}" if root else "")
            )
            hint = self._ui_tree_visual_gap_hint(result, app=app)
            self._omit_previous_computer_history()
            return self.success_response(self._ui_payload(f"{msg}{hint}", result))
        except Exception as e:
            logger.error(f"[COMPUTER] ui_snapshot failed: {e}")
            return self._fail(
                f"{e}. Fall back to computer_screenshot if the accessibility tree is unavailable."
            )

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_ui_click",
            "description": "Click a UI-tree ref from computer_ui_snapshot. Prefer this over computer_click when you have a ref. For sending a chat message, prefer computer_ui_set_value with submit true instead of clicking Send. Returns an updated UI tree, not a screenshot.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ref": {"type": "string", "description": "Ref from the last computer_ui_snapshot, e.g. @ss0…:e3"},
                    "intent": {"type": "string", "description": "Required. What you are about to do and which control this ref is."},
                    "app": {"type": "string", "description": "App name for the follow-up snapshot"},
                    "target": {"type": "string", "description": "Alias for intent"},
                },
                "required": ["ref", "intent"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_ui_click(
        self,
        ref: str,
        intent: Optional[str] = None,
        app: Optional[str] = None,
        target: Optional[str] = None,
    ) -> ToolResult:
        try:
            name = self._intent_or_fail(intent, target)
            if not name:
                return self.fail_response(
                    "computer_ui_click needs intent: what you are about to do and which control this ref is."
                )
            computer, error = await self._require_local_computer()
            if error:
                return error
            app_name = app or self._last_app
            result = await computer.ax_click(
                ref=str(ref or ""),
                intent=name,
                app=app_name,
                submit_fallback=True,
            )
            await asyncio.sleep(_SETTLE_UI_CLICK_S)
            self._remember_target(name)
            used_return = bool(result.get("submit_fallback") == "return")
            line = (
                f"Intent: {name}. UI-clicked {ref} failed; pressed Return to submit"
                if used_return
                else f"Intent: {name}. UI-clicked {ref}"
            )
            return await self._ui_snapshot_after(self._note(line), app=app_name)
        except Exception as e:
            logger.error(f"[COMPUTER] ui_click failed: {e}")
            return self._fail(
                f"{e}. If the ref is stale, call computer_ui_snapshot again. "
                "For chat send, use computer_ui_set_value with submit true instead of clicking Send. "
                "If accessibility fails, fall back to computer_screenshot + computer_click."
            )

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_ui_set_value",
            "description": "Set a field's value by UI-tree ref from computer_ui_snapshot. For WeChat/chat, set submit true to press Return and send — do not click the Send button.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ref": {"type": "string", "description": "Ref of the field from computer_ui_snapshot"},
                    "value": {"type": "string", "description": "Text to set"},
                    "intent": {"type": "string", "description": "Required. Which field and why."},
                    "submit": {"type": "boolean", "description": "If true, press Return after setting the value (send chat / submit form). Prefer this over clicking Send."},
                    "app": {"type": "string", "description": "App name for the follow-up snapshot"},
                    "target": {"type": "string", "description": "Alias for intent"},
                },
                "required": ["ref", "value", "intent"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_ui_set_value(
        self,
        ref: str,
        value: str,
        intent: Optional[str] = None,
        submit: bool = False,
        app: Optional[str] = None,
        target: Optional[str] = None,
    ) -> ToolResult:
        try:
            name = self._intent_or_fail(intent, target)
            if not name:
                return self.fail_response(
                    "computer_ui_set_value needs intent: which field you are filling and why."
                )
            computer, error = await self._require_local_computer()
            if error:
                return error
            app_name = app or self._last_app
            await computer.ax_set_value(ref=str(ref or ""), value=str(value or ""))
            await asyncio.sleep(_SETTLE_TYPE_S)
            if submit:
                await computer.ax_press(key="return", app=app_name, headed=True)
                await asyncio.sleep(_SETTLE_SUBMIT_S)
            preview = _clean_label(value, 40)
            self._remember_target(name)
            line = (
                f'Intent: {name}. UI set-value "{preview}" on {ref} and submitted'
                if submit
                else f'Intent: {name}. UI set-value "{preview}" on {ref}'
            )
            return await self._ui_snapshot_after(self._note(line), app=app_name)
        except Exception as e:
            logger.error(f"[COMPUTER] ui_set_value failed: {e}")
            return self._fail(
                f"{e}. Fall back to computer_click + computer_type if accessibility cannot fill this field."
            )

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_ui_type",
            "description": "Type into a UI-tree ref from computer_ui_snapshot. Prefer computer_ui_set_value for replacing a whole field. Set submit true to press Return after typing (send chat).",
            "parameters": {
                "type": "object",
                "properties": {
                    "ref": {"type": "string", "description": "Ref of the field from computer_ui_snapshot"},
                    "text": {"type": "string", "description": "Text to type"},
                    "intent": {"type": "string", "description": "Required. Which field and why."},
                    "submit": {"type": "boolean", "description": "If true, press Return after typing to send/submit."},
                    "app": {"type": "string", "description": "App name for the follow-up snapshot"},
                    "target": {"type": "string", "description": "Alias for intent"},
                },
                "required": ["ref", "text", "intent"],
                "additionalProperties": False,
            },
        },
    })
    async def computer_ui_type(
        self,
        ref: str,
        text: str,
        intent: Optional[str] = None,
        submit: bool = False,
        app: Optional[str] = None,
        target: Optional[str] = None,
    ) -> ToolResult:
        try:
            name = self._intent_or_fail(intent, target)
            if not name:
                return self.fail_response(
                    "computer_ui_type needs intent: which field you are typing into and why."
                )
            computer, error = await self._require_local_computer()
            if error:
                return error
            app_name = app or self._last_app
            await computer.ax_type(ref=str(ref or ""), text=str(text or ""))
            await asyncio.sleep(_SETTLE_TYPE_S)
            if submit:
                await computer.ax_press(key="return", app=app_name, headed=True)
                await asyncio.sleep(_SETTLE_SUBMIT_S)
            preview = _clean_label(text, 40)
            self._remember_target(name)
            line = (
                f'Intent: {name}. UI typed "{preview}" into {ref} and submitted'
                if submit
                else f'Intent: {name}. UI typed "{preview}" into {ref}'
            )
            return await self._ui_snapshot_after(self._note(line), app=app_name)
        except Exception as e:
            logger.error(f"[COMPUTER] ui_type failed: {e}")
            return self._fail(
                f"{e}. Fall back to computer_click + computer_type if accessibility cannot type here."
            )

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_screenshot",
            "description": "Capture a real screenshot of this computer. Use when the accessibility UI tree lacks the visual content you need (WeChat video cards, thumbnails, unlabeled bubbles) or when you need pixel coordinates for computer_click. Click/type/key/scroll already return a screenshot after they run — reuse that instead of recapturing. If the user only asked for a screenshot, take exactly one and stop.",
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
            # Always capture pixels. AX trees often omit WeChat video/message cards;
            # redirecting screenshot→AX left the agent unable to right-click the card.
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
            "description": "Click this computer's screen at screenshot-pixel coordinates from the last computer_* screenshot. Do not call computer_screenshot first. Set intent to what you are about to do and which visible control you will click. That sentence is kept after the screenshot is discarded.",
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
            await asyncio.sleep(_SETTLE_CLICK_S)
            self._remember_target(name)
            return await self._capture(self._note(f'Intent: {name}. Clicked ({int(x)}, {int(y)})'))
        except Exception as e:
            logger.error(f"[COMPUTER] click failed: {e}")
            return self._fail(str(e))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "computer_type",
            "description": "Type text into the focused field on this computer. Always click that field first. Set intent to the field and why you are typing. Set replace true to overwrite existing text. Set submit true to type and press return in one step. Do not follow this with computer_key return.",
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
            await asyncio.sleep(_SETTLE_TYPE_S)
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
            "description": "Press a key or key combo on this computer. On Mac use cmd (cmd+c, cmd+v, cmd+space). On Windows use ctrl (ctrl+c, ctrl+v, ctrl+a), not cmd. To type text and press return, use computer_type with submit true — do not type and then call this with return. To replace field text, prefer computer_type with replace true instead of select-all plus a second type.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Key name or combo such as return, tab, escape, cmd+c on Mac, ctrl+c on Windows"},
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
            await asyncio.sleep(_SETTLE_TYPE_S)
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
            await asyncio.sleep(_SETTLE_SCROLL_S)
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
            "description": "Open or activate a URL or an app on this computer. When accessibility is available it returns a UI tree (refs) — then use computer_ui_click / computer_ui_set_value. Otherwise it returns a screenshot. Examples: WeChat, 微信, Safari, Notepad, Google Chrome, https://example.com. Call this by itself before clicking or typing.",
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
            opened = str(target or "").strip()
            await computer.open(target=opened)
            # Remember app name for follow-up UI snapshots (skip raw URLs/paths).
            if opened and "://" not in opened and not opened.startswith("/"):
                self._last_app = opened
            await asyncio.sleep(_SETTLE_OPEN_S)
            note = self._note(f"Opened {target}")
            ui = await self._observe_ui(note, app=self._last_app)
            if ui is not None:
                if ui.success:
                    logger.info(f"[COMPUTER] open returned UI tree for {self._last_app}")
                    return ui
                return ui
            try:
                captured = await asyncio.wait_for(self._capture(note), timeout=15)
                if captured.success:
                    return captured
                logger.warning(f"[COMPUTER] open succeeded but screenshot failed: {captured.output}")
            except Exception as e:
                logger.warning(f"[COMPUTER] open succeeded but screenshot failed: {e}")
            return self.success_response({"success": True, "message": f"Opened {target}."})
        except Exception as e:
            logger.error(f"[COMPUTER] open failed: {e}")
            return self.fail_response(str(e))
