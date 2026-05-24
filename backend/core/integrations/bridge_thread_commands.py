"""
Slash commands shared by Telegram and Feishu IM bridges: /help, /list, /use, /new.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from core.integrations.bridge_reply_format import public_http_url_for_im_linkify
from core.threads import repo as threads_repo

BRIDGE_THREAD_LIST_PAGE_SIZE = 10
_TITLE_MAX_LEN = 48

_LIST_CMDS = frozenset({"list", "chats", "threads"})
_USE_CMDS = frozenset({"use", "switch"})
_NEW_CMDS = frozenset({"new", "newchat"})
_HELP_CMDS = frozenset({"help", "commands"})


def parse_bridge_slash_command(message: str) -> Tuple[Optional[str], List[str]]:
    """Return (command, args) for `/cmd arg1 arg2`, ignoring @bot suffix."""
    s = (message or "").strip()
    if not s.startswith("/"):
        return None, []
    parts = s.split()
    if not parts:
        return None, []
    first = parts[0].split("@", 1)[0].lower()
    if not first.startswith("/") or len(first) <= 1:
        return None, []
    return first[1:], parts[1:]


def _truncate_title(name: str) -> str:
    title = (name or "").strip() or "New Chat"
    if len(title) <= _TITLE_MAX_LEN:
        return title
    return title[: _TITLE_MAX_LEN - 1].rstrip() + "…"


def _parse_page_arg(args: List[str]) -> int:
    if not args:
        return 1
    try:
        page = int(args[0])
    except ValueError:
        return 1
    return max(1, page)


def _parse_index_arg(args: List[str]) -> Optional[int]:
    if not args:
        return None
    try:
        return int(args[0])
    except ValueError:
        return None


def _relative_time_label(dt: Any, now: datetime) -> str:
    if dt is None:
        return "—"
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except ValueError:
            return dt[:10] if len(dt) >= 10 else dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = now - dt.astimezone(timezone.utc)
    secs = int(delta.total_seconds())
    if secs < 60:
        return "just now"
    if secs < 3600:
        m = max(1, secs // 60)
        return f"{m}m ago"
    if secs < 86400:
        h = max(1, secs // 3600)
        return f"{h}h ago"
    days = max(1, secs // 86400)
    if days == 1:
        return "yesterday"
    if days < 14:
        return f"{days}d ago"
    return dt.strftime("%Y-%m-%d")


def _thread_browser_url(thread_id: str, project_id: Optional[str], frontend_url: str) -> Optional[str]:
    if not thread_id or not project_id:
        return None
    base = (frontend_url or "").strip().rstrip("/")
    if not base:
        return None
    url = f"{base}/projects/{project_id}/thread/{thread_id}"
    return public_http_url_for_im_linkify(url)


async def _fetch_threads_page(
    account_id: str,
    page: int,
    *,
    page_size: int = BRIDGE_THREAD_LIST_PAGE_SIZE,
) -> Tuple[List[Dict[str, Any]], int]:
    offset = (page - 1) * page_size
    return await threads_repo.list_user_threads(
        account_id,
        limit=page_size,
        offset=offset,
        order_by="updated_at",
    )


def _build_list_reply(
    threads: List[Dict[str, Any]],
    *,
    active_thread_id: Optional[str],
    page: int,
    total: int,
    frontend_url: str,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    now = datetime.now(timezone.utc)
    active = str(active_thread_id) if active_thread_id else None
    page_size = BRIDGE_THREAD_LIST_PAGE_SIZE
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1

    if not threads:
        return (
            "暂无对话。发送任意消息即可开始，或使用 /new 新开对话。\n\n"
            "No chats yet. Send a message to start, or use /new for a new chat.",
            None,
        )

    zh_lines = ["你的对话（工作区内全部线程，按最近更新）：", ""]
    en_lines = ["Your chats (all threads, most recent first):", ""]
    keyboard_rows: List[List[Dict[str, str]]] = []

    for i, row in enumerate(threads, start=1):
        global_index = (page - 1) * page_size + i
        tid = str(row.get("thread_id") or "")
        title = _truncate_title(str(row.get("name") or "New Chat"))
        when = _relative_time_label(row.get("updated_at") or row.get("created_at"), now)
        is_active = active is not None and tid == active
        marker = "→" if is_active else " "
        zh_lines.append(f"{marker} {global_index}. {title} · {when}")
        en_lines.append(f"{marker} {global_index}. {title} · {when}")

        url = _thread_browser_url(tid, row.get("project_id"), frontend_url)
        if url:
            btn_label = f"{global_index}. {title[:28]}{'…' if len(title) > 28 else ''}"
            keyboard_rows.append([{"text": btn_label, "url": url}])

    zh_lines.extend(
        [
            "",
            "回复 /use <编号> 切换对话，/new 新开对话。",
            f"/list {page + 1} 查看下一页（共 {total_pages} 页）。" if page < total_pages else "",
        ]
    )
    en_lines.extend(
        [
            "",
            "Reply /use <number> to switch, /new for a new chat.",
            f"/list {page + 1} for next page ({total_pages} pages)." if page < total_pages else "",
        ]
    )

    reply = "\n".join(zh_lines + [""] + en_lines).strip()
    reply_markup = {"inline_keyboard": keyboard_rows[:10]} if keyboard_rows else None
    return reply, reply_markup


async def build_thread_list_reply(
    account_id: str,
    *,
    active_thread_id: Optional[str],
    page: int = 1,
    frontend_url: str,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    threads, total = await _fetch_threads_page(account_id, page)
    return _build_list_reply(
        threads,
        active_thread_id=active_thread_id,
        page=page,
        total=total,
        frontend_url=frontend_url,
    )


async def resolve_thread_switch(
    account_id: str,
    index: int,
    *,
    page: int = 1,
) -> Optional[Dict[str, Any]]:
    """Resolve 1-based global index to thread row on the same sorted list as /list."""
    if index < 1:
        return None
    page_size = BRIDGE_THREAD_LIST_PAGE_SIZE
    target_page = ((index - 1) // page_size) + 1
    offset_in_page = (index - 1) % page_size
    threads, total = await _fetch_threads_page(account_id, target_page)
    if index > total or offset_in_page >= len(threads):
        return None
    return threads[offset_in_page]


def build_switch_reply(title: str) -> str:
    safe = _truncate_title(title)
    return (
        f"已切换到：{safe}\n下一条消息将继续该对话。\n\n"
        f"Switched to: {safe}\nYour next message continues that chat."
    )


def is_new_thread_command(cmd: Optional[str]) -> bool:
    return cmd in _NEW_CMDS


def is_list_thread_command(cmd: Optional[str]) -> bool:
    return cmd in _LIST_CMDS


def is_use_thread_command(cmd: Optional[str]) -> bool:
    return cmd in _USE_CMDS


def is_help_command(cmd: Optional[str]) -> bool:
    return cmd in _HELP_CMDS


def parse_list_page(args: List[str]) -> int:
    return _parse_page_arg(args)


def parse_use_index(args: List[str]) -> Optional[int]:
    return _parse_index_arg(args)


INVALID_USE_REPLY = (
    "请发送 /use <编号>，例如 /use 2。先用 /list 查看对话列表。\n\n"
    "Send /use <number>, e.g. /use 2. Use /list to see your chats."
)

INVALID_INDEX_REPLY = (
    "编号无效。请发送 /list 查看可用对话。\n\n"
    "Invalid number. Send /list to see available chats."
)

BRIDGE_MSG_NEW_THREAD = (
    "已开始新对话。下一条消息会在新的线程里进行（仍属于当前绑定的工作区）。\n"
    "发送 /list 查看全部对话，/use <编号> 切换，/new 再开新线程。\n\n"
    "New thread started. Your next message opens a fresh conversation in the same workspace.\n"
    "Use /list to see all chats, /use <number> to switch, /new for another new thread."
)

BRIDGE_MSG_HELP = (
    "Dobby 命令：\n"
    "/help — 显示本帮助\n"
    "/list — 列出工作区内的全部对话（→ 为当前对话）\n"
    "/list 2 — 下一页\n"
    "/use <编号> — 切换到某条对话（编号见 /list）\n"
    "/new — 新开一条对话\n"
    "直接发消息 — 在当前对话中与 Dobby 聊天\n"
    "（也可用 /chats、/threads、/switch、/newchat 等别名。）\n\n"
    "Dobby commands:\n"
    "/help — show this help\n"
    "/list — all chats in your workspace (→ = active)\n"
    "/list 2 — next page\n"
    "/use <number> — switch to a chat (numbers from /list)\n"
    "/new — start a new chat\n"
    "Send any message — chat with Dobby in the current thread\n"
    "(Aliases: /chats, /threads, /switch, /newchat, /commands.)"
)

BRIDGE_MSG_HELP_UNLINKED_SUFFIX = (
    "——\n"
    "绑定后以上命令可用。请先在 Dobby 网页端生成验证码并完成绑定。\n\n"
    "After linking, the commands above work. Generate a verification code on the web dashboard first."
)


def build_help_reply(*, linked: bool = True) -> str:
    if linked:
        return BRIDGE_MSG_HELP
    return f"{BRIDGE_MSG_HELP}\n\n{BRIDGE_MSG_HELP_UNLINKED_SUFFIX}"


class BridgeCommandResult:
    __slots__ = ("reply", "reply_markup", "thread_id")

    def __init__(
        self,
        reply: str,
        *,
        reply_markup: Optional[Dict[str, Any]] = None,
        thread_id: Optional[str] = None,
    ) -> None:
        self.reply = reply
        self.reply_markup = reply_markup
        self.thread_id = thread_id


async def handle_thread_slash_command(
    raw: str,
    *,
    account_id: str,
    active_thread_id: Optional[str],
    frontend_url: str,
    set_active_thread,
    clear_active_thread,
) -> Optional[BridgeCommandResult]:
    cmd, args = parse_bridge_slash_command(raw)
    if cmd is None:
        return None

    if is_help_command(cmd):
        return BridgeCommandResult(build_help_reply(linked=True))

    if is_new_thread_command(cmd):
        await clear_active_thread()
        return BridgeCommandResult(BRIDGE_MSG_NEW_THREAD)

    if is_list_thread_command(cmd):
        page = parse_list_page(args)
        reply, reply_markup = await build_thread_list_reply(
            account_id,
            active_thread_id=active_thread_id,
            page=page,
            frontend_url=frontend_url,
        )
        return BridgeCommandResult(reply, reply_markup=reply_markup)

    if is_use_thread_command(cmd):
        idx = parse_use_index(args)
        if idx is None:
            return BridgeCommandResult(INVALID_USE_REPLY)
        row = await resolve_thread_switch(account_id, idx)
        if not row:
            return BridgeCommandResult(INVALID_INDEX_REPLY)
        tid = str(row.get("thread_id") or "")
        if not tid:
            return BridgeCommandResult(INVALID_INDEX_REPLY)
        await set_active_thread(tid)
        title = str(row.get("name") or "New Chat")
        return BridgeCommandResult(build_switch_reply(title), thread_id=tid)

    return None
