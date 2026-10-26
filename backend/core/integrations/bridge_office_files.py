"""
Office files from one IM turn, for WeChat and Telegram to send as chat files.

Only .pptx, .docx, .xlsx, and .pdf. Paths come from this turn's assistant and
tool messages. The sandbox is not created if the thread does not already have one.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from fastapi import HTTPException, Response
from pydantic import BaseModel

from core.integrations.bridge_reply_format import (
    _coerce_dict,
    _message_event_time,
    _parse_ts,
    bridge_turn_content_anchor,
)
from core.sandbox.sandbox import download_sandbox_file_bytes
from core.utils.files_utils import clean_path
from core.utils.logger import logger

OFFICE_EXTENSIONS = {".pptx", ".docx", ".xlsx", ".pdf"}
MAX_OFFICE_FILES = 3
MAX_OFFICE_BYTES = 20 * 1024 * 1024

_MIME = {
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pdf": "application/pdf",
}

_PATH_RE = re.compile(
    r"(?<![\w./-])((?:/workspace/)?(?:[^\s\"'`<>|*?\\:]+/)*[^\s\"'`<>|*?/\\:]+\.(?:pptx|docx|xlsx|pdf))",
    re.IGNORECASE,
)


class BridgeOfficeFile(BaseModel):
    name: str
    path: str
    size: int = 0


def workspace_office_path(raw: str) -> Optional[str]:
    """Workspace-relative office path, or None when the string is not one."""
    text = (raw or "").strip().strip("\"'`")
    if not text or "://" in text or text.startswith("http"):
        return None
    cleaned = clean_path(text)
    parts = [part for part in cleaned.split("/") if part and part != "."]
    if not parts or any(part == ".." for part in parts):
        return None
    relative = "/".join(parts)
    ext = os.path.splitext(relative)[1].lower()
    stem = os.path.splitext(os.path.basename(relative))[0]
    if ext not in OFFICE_EXTENSIONS or not stem:
        return None
    return relative


def _add_match(text: str, priority: int, found: Dict[str, tuple]) -> None:
    for match in _PATH_RE.finditer(text or ""):
        window = text[max(0, match.start() - 12) : match.start() + 3]
        if "://" in window:
            continue
        relative = workspace_office_path(match.group(1))
        if not relative:
            continue
        index = found[relative][1] if relative in found else len(found)
        previous = found.get(relative)
        if previous is None or priority < previous[0]:
            found[relative] = (priority, index)


def _walk(value: Any, priority: int, found: Dict[str, tuple]) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            _walk(item, 0 if key == "attachments" else priority, found)
        return
    if isinstance(value, list):
        for item in value:
            _walk(item, priority, found)
        return
    if not isinstance(value, str):
        return
    stripped = value.strip()
    if stripped[:1] in "{[":
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, (dict, list)):
            _walk(parsed, priority, found)
            return
    _add_match(value, priority, found)


def office_paths_from_turn(
    rows: List[Dict[str, Any]],
    run_started_at: Any,
    user_prompt: str,
) -> List[str]:
    """Office paths mentioned by the assistant or tools during this turn."""
    anchor_dt = _parse_ts(bridge_turn_content_anchor(rows, run_started_at, user_prompt))
    found: Dict[str, tuple] = {}
    for msg in rows:
        if msg.get("type") not in ("assistant", "tool"):
            continue
        event_time = _message_event_time(msg)
        if anchor_dt is not None and (event_time is None or event_time < anchor_dt):
            continue
        _walk(_coerce_dict(msg.get("content")) or msg.get("content"), 1, found)
        _walk(_coerce_dict(msg.get("metadata")), 1, found)
    ranked = sorted(found.items(), key=lambda item: (item[1][0], item[1][1]))
    return [path for path, _meta in ranked[:MAX_OFFICE_FILES]]


def _info_size(info: Any) -> int:
    if info is None:
        return 0
    if isinstance(info, dict):
        if info.get("is_dir"):
            return -1
        return int(info.get("size") or 0)
    if getattr(info, "is_dir", False):
        return -1
    return int(getattr(info, "size", 0) or 0)


async def _sandbox_for_thread(account_id: str, thread_id: str):
    from core.sandbox.resolver import resolve_sandbox
    from core.services.supabase import DBConnection
    from core.threads import repo as threads_repo

    owner = await threads_repo.get_thread_account_id(thread_id)
    if not owner or str(owner) != str(account_id):
        return None
    project_id = await threads_repo.get_thread_project_id(thread_id)
    if not project_id:
        return None
    client = await DBConnection().client
    return await resolve_sandbox(str(project_id), str(account_id), client, require_started=True, create=False)


async def list_turn_office_files(
    account_id: str,
    thread_id: str,
    agent_run_id: str,
    user_prompt: str,
) -> List[BridgeOfficeFile]:
    """Files from this turn that already exist in the thread sandbox."""
    from core.agents import repo as agents_repo
    from core.threads import repo as threads_repo

    run_row = await agents_repo.get_agent_run_by_id(agent_run_id)
    started = None
    if run_row:
        started = run_row.get("started_at") or run_row.get("created_at")
    rows = await threads_repo.get_thread_messages(
        thread_id,
        order="asc",
        optimized=True,
        allowed_types=["user", "tool", "assistant"],
    )
    paths = office_paths_from_turn(rows, started, user_prompt)
    return await _existing_office_files(account_id, thread_id, paths)


async def list_thread_office_files(account_id: str, thread_id: str) -> List[BridgeOfficeFile]:
    """Office files mentioned anywhere in the conversation that still exist."""
    from core.threads import repo as threads_repo

    rows = await threads_repo.get_thread_messages(
        thread_id,
        order="asc",
        optimized=True,
        allowed_types=["user", "tool", "assistant"],
    )
    paths = office_paths_from_turn(rows, None, "")
    return await _existing_office_files(account_id, thread_id, paths)


async def _existing_office_files(
    account_id: str,
    thread_id: str,
    paths: List[str],
) -> List[BridgeOfficeFile]:
    if not paths:
        return []
    try:
        sandbox_info = await _sandbox_for_thread(account_id, thread_id)
    except Exception:
        logger.warning("[bridge] office file sandbox lookup failed", exc_info=True)
        return []
    if not sandbox_info or not getattr(sandbox_info, "sandbox", None):
        return []

    found: List[BridgeOfficeFile] = []
    for relative in paths:
        full_path = f"/workspace/{relative}"
        try:
            info = await sandbox_info.sandbox.fs.get_file_info(full_path)
        except Exception:
            logger.info("[bridge] office file missing: %s", relative)
            continue
        size = _info_size(info)
        if size < 0 or size > MAX_OFFICE_BYTES:
            logger.info("[bridge] office file skipped size=%s path=%s", size, relative)
            continue
        found.append(BridgeOfficeFile(name=os.path.basename(relative), path=relative, size=size))
    if found:
        logger.info("[bridge] %s office file(s) for thread %s", len(found), thread_id)
    return found


async def read_thread_office_file(account_id: str, thread_id: str, raw_path: str) -> tuple[bytes, str]:
    relative = workspace_office_path(raw_path)
    if not relative:
        raise HTTPException(status_code=400, detail="Not an office file")
    try:
        sandbox_info = await _sandbox_for_thread(account_id, thread_id)
    except Exception:
        logger.warning("[bridge] office file download lookup failed", exc_info=True)
        raise HTTPException(status_code=404, detail="File not found")
    if not sandbox_info or not getattr(sandbox_info, "sandbox", None):
        raise HTTPException(status_code=404, detail="File not found")
    full_path = f"/workspace/{relative}"
    try:
        data = await download_sandbox_file_bytes(sandbox_info.sandbox, full_path, timeout=120)
    except Exception:
        logger.warning("[bridge] office file download failed: %s", relative, exc_info=True)
        raise HTTPException(status_code=404, detail="File not found")
    if not data:
        raise HTTPException(status_code=404, detail="File not found")
    if len(data) > MAX_OFFICE_BYTES:
        raise HTTPException(status_code=413, detail="File is too large to send in chat")
    return data, os.path.basename(relative)


def office_file_response(data: bytes, name: str) -> Response:
    ext = os.path.splitext(name)[1].lower()
    quoted = quote(name)
    return Response(
        content=data,
        media_type=_MIME.get(ext, "application/octet-stream"),
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quoted}",
            "Cache-Control": "no-store",
        },
    )
