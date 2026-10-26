from typing import Optional

from core.agentpress.thread_manager import ThreadManager
from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata
from core.master_assistant import service
from core.utils.logger import logger


def _http_error_message(e: Exception) -> str:
    detail = getattr(e, "detail", None)
    if isinstance(detail, dict):
        return str(detail.get("message") or detail)
    if detail:
        return str(detail)
    return str(e)


@tool_metadata(
    display_name="Master Assistant",
    description="Start, track and share Dobby conversations on behalf of the user",
    icon="Sparkles",
    color="bg-amber-100 dark:bg-amber-800/50",
    weight=5,
    visible=False,
)
class MasterAssistantTool(Tool):
    def __init__(self, thread_manager: ThreadManager, thread_id: str, account_id: str):
        super().__init__()
        self.thread_manager = thread_manager
        self.thread_id = thread_id
        self.account_id = account_id

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "start_conversation",
            "description": "Start a new Dobby conversation that works on a task in the background. The user gets a card with an Open button, and you will be notified automatically when it finishes. Use for any substantial task (research, coding, documents, files, browsing).",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Complete, self-contained instructions for the new conversation, including all context the user gave."},
                    "title": {"type": "string", "description": "Short title for the card (a few words, in the user's language)."},
                    "execution_target": {"type": "string", "enum": ["cloud", "local", "dedicated"], "description": "Where to run: 'cloud' (default), 'local' (user's own computer via Dobby desktop; check list_local_devices first), or 'dedicated' (user's dedicated cloud computer)."},
                    "model": {"type": "string", "description": "Optional model id from list_models, e.g. 'dobby/basic' or 'dobby/power'. Omit for Basic."},
                },
                "required": ["prompt", "title"],
            },
        },
    })
    async def start_conversation(
        self,
        prompt: str,
        title: str,
        execution_target: str = "cloud",
        model: Optional[str] = None,
    ) -> ToolResult:
        try:
            target = (execution_target or "cloud").lower()
            if target == "local":
                devices = await service.list_local_devices(self.account_id)
                if not any(d["online"] for d in devices):
                    return self.fail_response(
                        "No local computer is online. Ask the user to open the Dobby desktop app "
                        f"(download: {service.absolute_url(service.PAGE_PATHS['local_runner_download'])}) or run in the cloud."
                    )
            result = await service.spawn_child(
                self.account_id, self.thread_id, prompt, title, target, model
            )
            return self.success_response(result)
        except Exception as e:
            logger.warning(f"[master] start_conversation failed: {e}")
            return self.fail_response(f"Could not start the conversation: {_http_error_message(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_conversations",
            "description": "List conversations recently started by the master assistant with their status.",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "description": "Max items (default 10)."}},
            },
        },
    })
    async def list_conversations(self, limit: int = 10) -> ToolResult:
        try:
            items = await service.list_children(self.account_id, limit)
            for item in items:
                item["url"] = service.absolute_url(item["path"])
            return self.success_response({"conversations": items})
        except Exception as e:
            return self.fail_response(f"Could not list conversations: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_recent_conversations",
            "description": "List ALL of the user's recent Dobby conversations (same as the /list command), newest first, with 1-based index numbers. Use when the user asks to see their chats/conversations or refers to one by number or name.",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "description": "Max items (default 10, max 30)."}},
            },
        },
    })
    async def list_recent_conversations(self, limit: int = 10) -> ToolResult:
        try:
            return self.success_response({"conversations": await service.list_recent_threads(self.account_id, limit)})
        except Exception as e:
            return self.fail_response(f"Could not list conversations: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "switch_conversation",
            "description": "Switch the user to another conversation (same as /use) or to a fresh new one (same as /new). In QQ, the user's following messages go to that conversation instead of you; on the web, the user gets a button to open it. Resolve names/numbers with list_recent_conversations first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "thread_id": {"type": "string", "description": "Conversation id from list_recent_conversations, or 'new' for a fresh conversation."},
                },
                "required": ["thread_id"],
            },
        },
    })
    async def switch_conversation(self, thread_id: str) -> ToolResult:
        target = (thread_id or "").strip()
        if target.lower() in ("new", "none", ""):
            target = None
        try:
            return self.success_response(
                await service.switch_channel_conversation(self.account_id, self.thread_id, target)
            )
        except ValueError as e:
            return self.fail_response(str(e))
        except Exception as e:
            return self.fail_response(f"Could not switch conversation: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "send_files",
            "description": "Look up PowerPoint, Word, Excel, and PDF files from a conversation you started and send them again to the user's WeChat or Telegram. Use when they ask if a file is ready, ask you to send it, or ask you to send it again. Omit thread_id to use the latest conversation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "thread_id": {"type": "string", "description": "Conversation id from list_conversations. Omit for the latest one."},
                },
            },
        },
    })
    async def send_files(self, thread_id: Optional[str] = None) -> ToolResult:
        try:
            result = await service.deliver_child_files(self.account_id, thread_id)
            if not result.get("found"):
                if result.get("reason") == "no_conversation":
                    return self.fail_response("No conversation has been started yet.")
                return self.fail_response("Conversation not found among those started by the master assistant.")
            return self.success_response(result)
        except Exception as e:
            return self.fail_response(f"Could not send the files: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "check_conversation",
            "description": "Get the status and latest reply of a conversation started by the master assistant. Also shows the user a card with an Open button.",
            "parameters": {
                "type": "object",
                "properties": {"thread_id": {"type": "string"}},
                "required": ["thread_id"],
            },
        },
    })
    async def check_conversation(self, thread_id: str) -> ToolResult:
        try:
            result = await service.check_child(self.account_id, thread_id)
            if not result:
                return self.fail_response("Conversation not found among those started by the master assistant.")
            return self.success_response(result)
        except Exception as e:
            return self.fail_response(f"Could not check the conversation: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "send_to_conversation",
            "description": "Send a follow-up instruction to a finished conversation started by the master assistant. It runs again in the background and you will be notified when done.",
            "parameters": {
                "type": "object",
                "properties": {
                    "thread_id": {"type": "string"},
                    "message": {"type": "string"},
                },
                "required": ["thread_id", "message"],
            },
        },
    })
    async def send_to_conversation(self, thread_id: str, message: str) -> ToolResult:
        try:
            result = await service.send_to_child(self.account_id, thread_id, message)
            return self.success_response(result)
        except Exception as e:
            return self.fail_response(f"Could not send the message: {_http_error_message(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "stop_conversation",
            "description": "Stop a running conversation started by the master assistant.",
            "parameters": {
                "type": "object",
                "properties": {"thread_id": {"type": "string"}},
                "required": ["thread_id"],
            },
        },
    })
    async def stop_conversation(self, thread_id: str) -> ToolResult:
        try:
            return self.success_response(await service.stop_child(self.account_id, thread_id))
        except Exception as e:
            return self.fail_response(f"Could not stop the conversation: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_local_devices",
            "description": "List the user's computers connected through the Dobby desktop app and whether each is online. Check before running a task locally.",
            "parameters": {"type": "object", "properties": {}},
        },
    })
    async def list_local_devices(self) -> ToolResult:
        try:
            devices = await service.list_local_devices(self.account_id)
            return self.success_response({
                "devices": devices,
                "download_url": service.absolute_url(service.PAGE_PATHS["local_runner_download"]),
            })
        except Exception as e:
            return self.fail_response(f"Could not list devices: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_models",
            "description": "List the AI models this account can use (available or locked by plan), with a short description of each.",
            "parameters": {"type": "object", "properties": {}},
        },
    })
    async def list_models(self) -> ToolResult:
        try:
            return self.success_response(await service.list_models_for_account(self.account_id))
        except Exception as e:
            return self.fail_response(f"Could not list models: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "get_account_status",
            "description": "Get the user's plan, credit balance and credits used in the last 7 days.",
            "parameters": {"type": "object", "properties": {}},
        },
    })
    async def get_account_status(self) -> ToolResult:
        try:
            return self.success_response(await service.get_account_status(self.account_id))
        except Exception as e:
            return self.fail_response(f"Could not read account status: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "open_dobby_page",
            "description": "Show the user a button that opens a Dobby page. It does not navigate by itself; the user clicks it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "page": {"type": "string", "enum": list(service.PAGE_PATHS.keys())},
                    "label": {"type": "string", "description": "Button text in the user's language, e.g. '打开使用记录'."},
                },
                "required": ["page", "label"],
            },
        },
    })
    async def open_dobby_page(self, page: str, label: str) -> ToolResult:
        path = service.PAGE_PATHS.get(page)
        if not path:
            return self.fail_response(f"Unknown page '{page}'.")
        return self.success_response({
            "page": page,
            "label": (label or page).strip()[:40],
            "path": path,
            "url": service.absolute_url(path),
        })

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "share_conversation",
            "description": "Make a conversation public and return its share link (or turn sharing off). Only call after the user has explicitly confirmed they want to share it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "thread_id": {"type": "string"},
                    "public": {"type": "boolean", "description": "true to share, false to stop sharing."},
                },
                "required": ["thread_id", "public"],
            },
        },
    })
    async def share_conversation(self, thread_id: str, public: bool = True) -> ToolResult:
        if isinstance(public, str):
            public = public.strip().lower() in ("true", "1", "yes")
        try:
            return self.success_response(await service.share_thread(self.account_id, thread_id, bool(public)))
        except Exception as e:
            return self.fail_response(f"Could not update sharing: {e}")
