"""
HTTP API for Telegram bot pairing (JWT) and bridge chat (shared secret).

Each basejump account may link one or more Telegram users; pairing ties a
Telegram user id to the workspace selected when generating the code.
"""

from __future__ import annotations

import asyncio
import hmac
import re
import secrets
import string
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from core.integrations.bridge_reply_format import (
    BRIDGE_POST_RUN_SETTLE_SEC,
    BRIDGE_REPLY_POLL_DELAYS,
    append_thread_workspace_link,
    best_bridge_reply_from_snapshots,
    bridge_turn_assistant_body,
    compose_bridge_turn_plain_text,
)
from core.agents import repo as agents_repo
from core.services.db import execute_one, execute_one_read
from core.threads import repo as threads_repo
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.config import config
from core.utils.logger import logger

router = APIRouter(tags=["telegram-bot"])

_PAIRING_CODE_ALPHABET = string.ascii_uppercase + string.digits
_PAIRING_CODE_PATTERN = re.compile(r"^[A-Z0-9]{6}$")
_MAX_POLL_SECONDS = 120
_POLL_INTERVAL_SEC = 1.5

MSG_BIND_OK = "已成功绑定当前工作区。请继续在 Telegram 中与 Dobby 对话。"
MSG_BIND_INVALID = "验证码无效或已过期。请在本页重新生成验证码，并在 Telegram 中单独发送该 6 位码。"
MSG_BIND_NEEDED = "请先在 Dobby 网页端：用户菜单 → Telegram，选择工作区并生成验证码，然后在 Telegram 中单独发送该 6 位码完成绑定。"
MSG_RUN_FAILED = "Dobby 暂时无法完成请求，请稍后再试。"
MSG_NEW_THREAD = (
    "已开始新对话。下一条消息会在新的线程里进行（仍属于当前绑定的工作区）。\n"
    "发送 /newchat 或 /new 可随时再开新线程。\n\n"
    "New thread started. Your next message opens a fresh conversation in the same workspace.\n"
    "Use /newchat or /new any time to start another new thread."
)


def _reraise_if_missing_telegram_tables(exc: Exception) -> None:
    """Clear 503 when migration was not applied to the DB this API uses."""
    msg = str(exc).lower()
    if "does not exist" in msg and "telegram_bot" in msg:
        raise HTTPException(
            status_code=503,
            detail=(
                "Telegram tables are missing on this database. "
                "Apply migration 20260513120000_telegram_bot_integration.sql "
                "(same Postgres as DATABASE_POOLER_URL / this API), then reload."
            ),
        ) from exc


class PairingCodeRequest(BaseModel):
    account_id: str = Field(..., description="Workspace (basejump account) to bind this Telegram user to.")


class PairingCodeResponse(BaseModel):
    code: str
    expires_at: str


class BridgeChatRequest(BaseModel):
    telegram_user_id: str = Field(..., min_length=1, max_length=32)
    message: str = Field(..., min_length=1, max_length=32000)


class BridgeChatResponse(BaseModel):
    ok: bool
    reply: str
    thread_id: Optional[str] = None
    agent_run_id: Optional[str] = None
    paired: bool = False
    thread_browser_url: Optional[str] = None


class LinkStatusResponse(BaseModel):
    account_id: str
    linked_peer_count: int


def _require_bridge_secret(x_telegram_bridge_secret: Optional[str]) -> None:
    expected = (config.TELEGRAM_BRIDGE_SECRET or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Telegram bridge is not configured")
    got = (x_telegram_bridge_secret or "").strip()
    if not got or not hmac.compare_digest(got, expected):
        raise HTTPException(status_code=401, detail="Invalid bridge secret")


def _generate_pairing_code() -> str:
    return "".join(secrets.choice(_PAIRING_CODE_ALPHABET) for _ in range(6))


async def _clear_link_thread(telegram_user_id: str) -> None:
    sql = """
    UPDATE public.telegram_bot_links
    SET thread_id = NULL, updated_at = timezone('utc', now())
    WHERE telegram_user_id = :telegram_user_id
    RETURNING 1
    """
    await execute_one(sql, {"telegram_user_id": telegram_user_id}, commit=True)


def _telegram_slash_command(message: str) -> Optional[str]:
    """Return base command without leading slash and without @bot suffix, or None."""
    s = (message or "").strip()
    if not s.startswith("/"):
        return None
    first = s.split()[0]
    base = first.split("@", 1)[0].lower()
    if not base.startswith("/"):
        return None
    return base[1:]


async def _get_link(telegram_user_id: str) -> Optional[Dict[str, Any]]:
    sql = """
    SELECT telegram_user_id, account_id::text AS account_id, thread_id::text AS thread_id
    FROM public.telegram_bot_links
    WHERE telegram_user_id = :telegram_user_id
    """
    return await execute_one_read(sql, {"telegram_user_id": telegram_user_id})


async def _upsert_link(telegram_user_id: str, account_id: str) -> None:
    sql = """
    INSERT INTO public.telegram_bot_links (telegram_user_id, account_id, thread_id, created_at, updated_at)
    VALUES (:telegram_user_id, CAST(:account_id AS uuid), NULL, timezone('utc', now()), timezone('utc', now()))
    ON CONFLICT (telegram_user_id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        thread_id = NULL,
        updated_at = timezone('utc', now())
    RETURNING 1
    """
    await execute_one(sql, {"telegram_user_id": telegram_user_id, "account_id": account_id}, commit=True)


async def _update_link_thread(telegram_user_id: str, thread_id: str) -> None:
    sql = """
    UPDATE public.telegram_bot_links
    SET thread_id = CAST(:thread_id AS uuid), updated_at = timezone('utc', now())
    WHERE telegram_user_id = :telegram_user_id
    RETURNING 1
    """
    await execute_one(sql, {"telegram_user_id": telegram_user_id, "thread_id": thread_id}, commit=True)


async def _update_link_thread_resilient(telegram_user_id: str, thread_id: str) -> None:
    """Retry when threads row is not committed yet (FK telegram_bot_links.thread_id → threads)."""
    for attempt in range(24):
        try:
            await _update_link_thread(telegram_user_id, thread_id)
            return
        except Exception as e:
            msg = str(e).lower()
            if ("foreign key" in msg or "violates foreign key" in msg) and attempt < 23:
                await asyncio.sleep(0.25)
                continue
            raise


async def _consume_pairing_code(code: str) -> Optional[str]:
    sql = """
    DELETE FROM public.telegram_bot_pairing_codes
    WHERE code = :code AND expires_at > timezone('utc', now())
    RETURNING account_id::text AS account_id
    """
    row = await execute_one(sql, {"code": code}, commit=True)
    return row["account_id"] if row else None


async def _poll_run_for_terminal(agent_run_id: str) -> Dict[str, Any]:
    from core.agents.repo import get_agent_run_status

    deadline = time.monotonic() + _MAX_POLL_SECONDS
    while time.monotonic() < deadline:
        row = await get_agent_run_status(agent_run_id)
        if not row:
            return {"status": "missing", "error": None}
        status = (row.get("status") or "").lower()
        if status in ("completed", "failed", "cancelled", "stopped"):
            return {"status": status, "error": row.get("error")}
        await asyncio.sleep(_POLL_INTERVAL_SEC)
    return {"status": "timeout", "error": None}


async def _latest_assistant_reply(thread_id: str, agent_run_id: str, user_prompt: str) -> str:
    run_row = await agents_repo.get_agent_run_by_id(agent_run_id)
    started = None
    if run_row:
        started = run_row.get("started_at") or run_row.get("created_at")

    snapshots: List[tuple[str, str]] = []
    for delay in BRIDGE_REPLY_POLL_DELAYS:
        if delay > 0:
            await asyncio.sleep(delay)
        rows = await threads_repo.get_thread_messages(
            thread_id,
            order="desc",
            optimized=True,
            allowed_types=["user", "tool", "assistant", "status"],
        )
        snapshots.append(
            (
                compose_bridge_turn_plain_text(rows, started, user_prompt),
                bridge_turn_assistant_body(rows, started, user_prompt),
            )
        )
    return best_bridge_reply_from_snapshots(snapshots)


@router.post("/pairing-code", response_model=PairingCodeResponse)
async def create_pairing_code(
    body: PairingCodeRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    if not await threads_repo.check_account_user_access(user_id, body.account_id):
        raise HTTPException(status_code=403, detail="No access to this workspace")

    try:
        await execute_one(
            "DELETE FROM public.telegram_bot_pairing_codes WHERE account_id = CAST(:aid AS uuid) RETURNING 1",
            {"aid": body.account_id},
            commit=True,
        )
    except Exception as e:
        _reraise_if_missing_telegram_tables(e)
        raise

    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    last_err: Optional[Exception] = None
    for _ in range(6):
        code = _generate_pairing_code()
        try:
            await execute_one(
                """
                INSERT INTO public.telegram_bot_pairing_codes (code, account_id, expires_at)
                VALUES (:code, CAST(:account_id AS uuid), :expires_at)
                RETURNING code
                """,
                {"code": code, "account_id": body.account_id, "expires_at": expires},
                commit=True,
            )
            return PairingCodeResponse(code=code, expires_at=expires.isoformat())
        except Exception as e:
            _reraise_if_missing_telegram_tables(e)
            last_err = e
            msg = str(e).lower()
            if "duplicate key" in msg or "unique constraint" in msg:
                continue
            raise

    logger.exception("[telegram_bot] failed to generate unique pairing code", exc_info=last_err)
    raise HTTPException(status_code=500, detail="Failed to generate pairing code")


@router.get("/link-status", response_model=LinkStatusResponse)
async def link_status(
    account_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    if not await threads_repo.check_account_user_access(user_id, account_id):
        raise HTTPException(status_code=403, detail="No access to this workspace")
    try:
        # Primary session: avoids read-replica lag right after migrations.
        row = await execute_one(
            """
            SELECT COUNT(*)::int AS c FROM public.telegram_bot_links
            WHERE account_id = CAST(:aid AS uuid)
            """,
            {"aid": account_id},
        )
    except Exception as e:
        _reraise_if_missing_telegram_tables(e)
        raise
    n = int(row["c"]) if row else 0
    return LinkStatusResponse(account_id=account_id, linked_peer_count=n)


@router.post("/bridge/chat", response_model=BridgeChatResponse)
async def bridge_chat(
    body: BridgeChatRequest,
    x_telegram_bridge_secret: Optional[str] = Header(None, alias="X-Telegram-Bridge-Secret"),
):
    _require_bridge_secret(x_telegram_bridge_secret)
    peer = body.telegram_user_id.strip()
    raw = (body.message or "").strip()
    if not peer or not raw:
        return BridgeChatResponse(ok=False, reply=MSG_BIND_NEEDED)

    link = await _get_link(peer)
    if not link:
        candidate = re.sub(r"\s+", "", raw).upper()
        if _PAIRING_CODE_PATTERN.match(candidate):
            account_id = await _consume_pairing_code(candidate)
            if not account_id:
                return BridgeChatResponse(ok=False, reply=MSG_BIND_INVALID)
            await _upsert_link(peer, account_id)
            return BridgeChatResponse(ok=True, reply=MSG_BIND_OK, paired=True)
        return BridgeChatResponse(ok=False, reply=MSG_BIND_NEEDED)

    cmd = _telegram_slash_command(raw)
    if cmd in ("newchat", "new"):
        await _clear_link_thread(peer)
        return BridgeChatResponse(ok=True, reply=MSG_NEW_THREAD, paired=False)

    account_id = link["account_id"]
    thread_id = link.get("thread_id")
    if thread_id is not None:
        thread_id = str(thread_id)

    from core.agents.api import start_agent_run

    try:
        result = await start_agent_run(
            account_id=account_id,
            prompt=raw,
            agent_id=None,
            model_name=None,
            thread_id=thread_id,
            project_id=None,
            metadata={"source": "telegram_bot", "telegram_user_id": peer},
            skip_limits_check=False,
            memory_enabled=None,
            is_optimistic=False,
            emit_timing=False,
            mode=None,
            files_data=None,
        )
    except HTTPException as e:
        detail = e.detail
        if isinstance(detail, dict):
            msg = detail.get("message") or str(detail)
        else:
            msg = str(detail)
        logger.warning(f"[telegram_bot] start_agent_run HTTPException: {msg}")
        return BridgeChatResponse(ok=False, reply=f"{MSG_RUN_FAILED} ({msg})")
    except Exception:
        logger.exception("[telegram_bot] start_agent_run failed")
        return BridgeChatResponse(ok=False, reply=MSG_RUN_FAILED)

    agent_run_id = result.get("agent_run_id")
    tid = result.get("thread_id")
    if not agent_run_id or not tid:
        return BridgeChatResponse(ok=False, reply=MSG_RUN_FAILED)

    try:
        terminal = await _poll_run_for_terminal(str(agent_run_id))
        status = terminal.get("status")
        if status == "failed":
            err = terminal.get("error") or "failed"
            return BridgeChatResponse(ok=False, reply=f"{MSG_RUN_FAILED} ({err})")
        if status == "timeout":
            return BridgeChatResponse(
                ok=True,
                reply="处理时间较长，请稍后在 Dobby 网页端查看该对话的完整回复。",
                thread_id=str(tid),
                agent_run_id=str(agent_run_id),
            )

        await asyncio.sleep(BRIDGE_POST_RUN_SETTLE_SEC)
        reply_text = await _latest_assistant_reply(str(tid), str(agent_run_id), raw)
        if not reply_text:
            reply_text = "（暂无文本回复，请在网页端查看详情。）"
        if len(reply_text) > 3400:
            reply_text = reply_text[:3390] + "…"
        reply_text, thread_browser_url = await append_thread_workspace_link(
            reply_text,
            str(tid),
            threads_repo=threads_repo,
            frontend_url=config.FRONTEND_URL,
        )
        if len(reply_text) > 4090:
            reply_text = reply_text[:4078] + "…"

        await _update_link_thread_resilient(peer, str(tid))
        return BridgeChatResponse(
            ok=True,
            reply=reply_text,
            thread_id=str(tid),
            agent_run_id=str(agent_run_id),
            thread_browser_url=thread_browser_url,
        )
    except Exception:
        logger.exception("[telegram_bot] bridge_chat after start_agent_run failed")
        return BridgeChatResponse(ok=False, reply=MSG_RUN_FAILED)
