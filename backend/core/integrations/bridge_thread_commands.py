"""
Slash commands shared by WeChat, Feishu, and Telegram: /help, /list, /use, /new, /master.
Natural phrases such as 「回到总助理」, 「切进去」, and a bare list number switch the same way.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from core.threads import repo as threads_repo

BRIDGE_THREAD_LIST_PAGE_SIZE = 10
_TITLE_MAX_LEN = 48

_LIST_CMDS = frozenset({"list", "chats", "threads"})
_USE_CMDS = frozenset({"use", "switch"})
_NEW_CMDS = frozenset({"new", "newchat"})
_HELP_CMDS = frozenset({"help", "commands"})
_MASTER_CMDS = frozenset({"master", "assistant"})
_ENTER_CMDS = frozenset({"enter"})

_BACK_TO_MASTER_RE = re.compile(
    r"^(?:请|帮我)?(?:回到|切换到|切换回|切回|返回|回)(?:到)?(?:dobby)?(?:总助理|总助手|助理)(?:吧|啦)?$"
)
_ENTER_RE = re.compile(
    r"^(?:请|帮我)?(?:切进去|进入这个项目|进入刚才的项目|进入刚才那个|进这个项目)(?:吧|啦)?$"
)
_INDEX_RE = re.compile(
    r"^(?:切到|切换到|进入)?第?(\d{1,2})(?:个|号)?(?:对话|项目|线程)?$"
)
_TITLE_RE = re.compile(r"^(?:请|帮我)?(?:切到|切换到)(.+)$")
_TITLE_FILLER_RE = re.compile(r"^(?:那个|这个|一下)")

ENTER_REPLY_MARKUP = {"inline_keyboard": [[{"text": "切进去", "callback_data": "enter"}]]}


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


def _compact_phrase(message: str) -> str:
    return re.sub(r"\s+", "", (message or "").strip().lower()).strip("。.!！~～?？")


def parse_navigation(message: str) -> Optional[Dict[str, str]]:
    """Map a short phrase to a slash command, or a title query.

    Returns None when the message should go to the assistant as written.
    A title query is switched only when exactly one conversation matches.
    """
    compact = _compact_phrase(message)
    if not compact or compact.startswith("/") and not compact.startswith("/master"):
        return None
    if compact in {"0", "/master", "master"} or _BACK_TO_MASTER_RE.match(compact):
        return {"command": "/master"}
    if _ENTER_RE.match(compact):
        return {"command": "/enter"}
    index = _INDEX_RE.match(compact)
    if index:
        number = int(index.group(1))
        if number == 0:
            return {"command": "/master"}
        return {"command": f"/use {number}"}
    title = _TITLE_RE.match(compact)
    if not title:
        return None
    query = _TITLE_FILLER_RE.sub("", title.group(1))
    query = re.sub(r"(?:对话|项目|线程)$", "", query)
    if query in {"", "刚才", "刚才的", "刚才那个"}:
        return {"command": "/enter"}
    if len(query) < 2:
        return None
    return {"title": query}


def _row_title(row: Dict[str, Any]) -> str:
    project = row.get("project") or {}
    return _truncate_title(str(project.get("name") or row.get("name") or "New Chat"))


def _normalize_title(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").lower())


async def match_thread_title(account_id: str, query: str) -> Optional[Dict[str, Any]]:
    """Return the one conversation whose title contains the query, plus its /list index."""
    needle = _normalize_title(query)
    if len(needle) < 2:
        return None
    found: List[Dict[str, Any]] = []
    page = 1
    seen = 0
    while page <= 3:
        threads, total = await _fetch_threads_page(account_id, page)
        if not threads:
            break
        for offset, row in enumerate(threads):
            title = _row_title(row)
            hay = _normalize_title(title)
            if needle in hay or hay in needle:
                found.append({
                    "thread_id": str(row.get("thread_id") or ""),
                    "title": title,
                    "index": seen + offset + 1,
                })
        seen += len(threads)
        if seen >= total:
            break
        page += 1
    exact = [row for row in found if _normalize_title(row["title"]) == needle]
    chosen = exact or found
    if len(chosen) != 1 or not chosen[0]["thread_id"]:
        return {"ambiguous": True} if len(chosen) > 1 else None
    return chosen[0]


async def rewrite_navigation(account_id: str, message: str) -> Tuple[str, Optional[str]]:
    """Return (message to handle, direct reply). A direct reply skips the assistant."""
    parsed = parse_navigation(message)
    if not parsed:
        return message, None
    if parsed.get("command"):
        return parsed["command"], None
    match = await match_thread_title(account_id, parsed.get("title") or "")
    if not match:
        return message, None
    if match.get("ambiguous"):
        return message, (
            "有多个相似对话。发送 /list 查看编号，回复编号进入，回复 0 回总助理。\n\n"
            "Several chats match. Send /list, reply with a number to enter, or 0 to go back to the master assistant."
        )
    return f"/use {match['index']}", None


def where_line_for(*, is_master: bool, title: Optional[str] = None) -> str:
    if is_master or not (title or "").strip():
        return "现在：总助理"
    return f"现在：{_truncate_title(title or '')} · 发 /master 回总助理"


def append_where_line(text: str, line: str) -> str:
    body = (text or "").rstrip()
    where = (line or "").strip()
    if not where:
        return body
    if body.endswith(where):
        return body
    last = body.splitlines()[-1].strip() if body else ""
    if last.startswith("现在："):
        return body
    return f"{body}\n\n{where}" if body else where


async def append_where(text: str, account_id: str, thread_id: Optional[str]) -> str:
    return append_where_line(text, await where_line(account_id, thread_id))


async def where_line(account_id: str, thread_id: Optional[str]) -> str:
    if not thread_id:
        return where_line_for(is_master=True)
    thread_id = str(thread_id)
    from core.services.db import execute_one_read

    try:
        row = await execute_one_read(
            """
            SELECT COALESCE(NULLIF(p.name, ''), NULLIF(t.name, ''), 'New Chat') AS title,
                   EXISTS (
                       SELECT 1 FROM public.master_assistants m
                       WHERE m.thread_id = t.thread_id
                   ) AS is_master
            FROM public.threads t
            LEFT JOIN public.projects p ON p.project_id = t.project_id
            WHERE t.thread_id = CAST(:tid AS uuid) AND t.account_id = CAST(:aid AS uuid)
            """,
            {"tid": thread_id, "aid": account_id},
        )
    except Exception:
        return where_line_for(is_master=True)
    if not row or row.get("is_master"):
        return where_line_for(is_master=True)
    return where_line_for(is_master=False, title=str(row.get("title") or "New Chat"))


async def create_blank_thread(account_id: str, title: str = "New Chat") -> Dict[str, str]:
    from core.threads import repo as threads_repo

    project_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())
    await threads_repo.create_project_and_thread(
        project_id=project_id,
        thread_id=thread_id,
        account_id=account_id,
        project_name=title,
        thread_name=title,
    )
    return {"thread_id": thread_id, "project_id": project_id, "title": title, "name": title}


async def child_started_during_run(account_id: str, thread_id: str, agent_run_id: str) -> bool:
    from core.agents import repo as agents_repo
    from core.services.db import execute_one_read

    try:
        run = await agents_repo.get_agent_run_by_id(agent_run_id)
    except Exception:
        return False
    started = (run or {}).get("started_at") or (run or {}).get("created_at")
    if not started:
        return False
    try:
        row = await execute_one_read(
            """
            SELECT 1 AS ok
            FROM public.master_child_runs
            WHERE account_id = CAST(:aid AS uuid)
              AND master_thread_id = CAST(:tid AS uuid)
              AND created_at >= :started
            LIMIT 1
            """,
            {"aid": account_id, "tid": thread_id, "started": started},
        )
    except Exception:
        return False
    return bool(row)


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
        title = _row_title(row)
        when = _relative_time_label(row.get("updated_at") or row.get("created_at"), now)
        is_active = active is not None and tid == active
        marker = "→" if is_active else " "
        zh_lines.append(f"{marker} {global_index}. {title} · {when}")
        en_lines.append(f"{marker} {global_index}. {title} · {when}")

        if tid:
            btn_label = f"{global_index}. {title[:28]}{'…' if len(title) > 28 else ''}"
            keyboard_rows.append([{"text": btn_label, "callback_data": f"use:{global_index}"}])

    if keyboard_rows:
        keyboard_rows.append([{"text": "回总助理", "callback_data": "master"}])

    zh_lines.extend(
        [
            "",
            "回复编号进入（如 2），回复 0 回总助理。/new 新开对话。",
            f"/list {page + 1} 查看下一页（共 {total_pages} 页）。" if page < total_pages else "",
        ]
    )
    en_lines.extend(
        [
            "",
            "Reply with a number to enter (for example 2), or 0 to go back to the master assistant. /new starts a new chat.",
            f"/list {page + 1} for next page ({total_pages} pages)." if page < total_pages else "",
        ]
    )

    reply = "\n".join(zh_lines + [""] + en_lines).strip()
    reply_markup = {"inline_keyboard": keyboard_rows} if keyboard_rows else None
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


def is_master_command(cmd: Optional[str]) -> bool:
    return cmd in _MASTER_CMDS


def is_enter_command(cmd: Optional[str]) -> bool:
    return cmd in _ENTER_CMDS


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
    "/use <编号> — 切换到某条对话（编号见 /list），也可以直接回复编号\n"
    "/new — 新开一条对话并进入\n"
    "/master — 回到总助理（也可以说「回到总助理」，或回复 0）\n"
    "切进去 — 进入总助理最近开的那个项目\n"
    "直接发消息 — 在当前对话中与 Dobby 聊天\n"
    "（也可用 /chats、/threads、/switch、/newchat 等别名。）\n\n"
    "Dobby commands:\n"
    "/help — show this help\n"
    "/list — all chats in your workspace (→ = active)\n"
    "/list 2 — next page\n"
    "/use <number> — switch to a chat (numbers from /list); you can also reply with just the number\n"
    "/new — start a new chat and enter it\n"
    "/master — back to the master assistant (or say 回到总助理, or reply 0)\n"
    "切进去 — enter the latest project the master assistant started\n"
    "Send any message — chat with Dobby in the current thread\n"
    "(Aliases: /chats, /threads, /switch, /newchat, /commands.)"
)

MSG_SWITCHED_MASTER = (
    "已切换回总助理。下一条消息发给总助理。\n\n"
    "Back with the master assistant. Your next message goes there."
)

MSG_NO_PROJECT = (
    "还没有项目。直接告诉我要做什么，我会在总助理里开工。你现在还在总助理。\n\n"
    "No project yet. Tell me what to do and I will start it from here. You are still with the master assistant."
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

    if is_master_command(cmd):
        from core.master_assistant.service import master_thread_for_new_channel

        tid = await master_thread_for_new_channel(account_id)
        await set_active_thread(tid)
        return BridgeCommandResult(MSG_SWITCHED_MASTER, thread_id=tid)

    if is_enter_command(cmd):
        from core.master_assistant.service import list_children

        children = await list_children(account_id, 1)
        if not children:
            return BridgeCommandResult(MSG_NO_PROJECT, thread_id=active_thread_id)
        child = children[0]
        tid = str(child.get("thread_id") or "")
        if not tid:
            return BridgeCommandResult(MSG_NO_PROJECT, thread_id=active_thread_id)
        await set_active_thread(tid)
        return BridgeCommandResult(build_switch_reply(str(child.get("title") or "New Chat")), thread_id=tid)

    if is_new_thread_command(cmd):
        created = await create_blank_thread(account_id)
        await set_active_thread(created["thread_id"])
        return BridgeCommandResult(BRIDGE_MSG_NEW_THREAD, thread_id=created["thread_id"])

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
