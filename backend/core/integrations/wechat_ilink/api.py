"""
HTTP API for per-user WeChat iLink connect (JWT) and multi-session bridge (shared secret).

Each basejump account may connect exactly one WeChat via dashboard QR scan. The bridge
worker loads active sessions from the backend and long-polls iLink per account.
"""

from __future__ import annotations

import asyncio
import hmac
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from core.integrations.bridge_reply_format import (
    BRIDGE_POST_RUN_SETTLE_SEC,
    append_thread_workspace_link,
    compose_bridge_turn_plain_text,
    latest_bridge_reply_plain_text_via_poll,
)
from core.integrations.bridge_thread_commands import (
    build_help_reply,
    handle_thread_slash_command,
    is_help_command,
    parse_bridge_slash_command,
)
from core.agents import repo as agents_repo
from core.integrations.wechat_ilink.ilink_client import ILINK_DEFAULT_BASE, fetch_bot_qrcode, fetch_qrcode_status
from core.integrations.wechat_ilink.token_crypto import decrypt_bot_token, encrypt_bot_token
from core.services.db import execute_one, execute_one_read, execute_read
from core.threads import repo as threads_repo
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.config import config
from core.utils.logger import logger

router = APIRouter(tags=["wechat-ilink"])

_CONNECT_TTL_MINUTES = 5
_MAX_POLL_SECONDS = 120
_POLL_INTERVAL_SEC = 1.5

MSG_NOT_CONNECTED = "请先在 Dobby 网页端：用户菜单 → 微信，扫码绑定你的微信。"
MSG_RUN_FAILED = "Dobby 暂时无法完成请求，请稍后再试。"
MSG_SESSION_EXPIRED = "微信登录已过期，请在 Dobby 网页端重新扫码连接。"


class ConnectStartRequest(BaseModel):
    account_id: str = Field(..., description="Workspace (basejump account) to bind WeChat to.")


class ConnectStartResponse(BaseModel):
    session_id: str
    qrcode_url: str
    expires_at: str
    status: str = "pending"


class ConnectStatusResponse(BaseModel):
    session_id: str
    status: str
    connected: bool = False


class LinkStatusResponse(BaseModel):
    account_id: str
    connected: bool
    status: Optional[str] = None
    connected_at: Optional[str] = None


class BridgeSessionRow(BaseModel):
    account_id: str
    bot_token: str
    baseurl: str
    ilink_bot_id: str = ""
    get_updates_buf: str = ""


class BridgeSessionsResponse(BaseModel):
    sessions: List[BridgeSessionRow]


class BridgeCursorRequest(BaseModel):
    get_updates_buf: str = ""


class BridgeChatRequest(BaseModel):
    account_id: str = Field(..., min_length=1, max_length=80)
    ilink_peer_id: str = Field(..., min_length=1, max_length=256)
    message: str = Field(..., min_length=1, max_length=32000)


class BridgeChatResponse(BaseModel):
    ok: bool
    reply: str
    thread_id: Optional[str] = None
    agent_run_id: Optional[str] = None
    thread_browser_url: Optional[str] = None


class BridgeChatStartResponse(BaseModel):
    ok: bool
    reply: str = ""
    agent_run_id: Optional[str] = None
    thread_id: Optional[str] = None
    message: str = ""


class BridgeChatSessionRequest(BaseModel):
    account_id: str = Field(..., min_length=1, max_length=80)
    ilink_peer_id: str = Field(..., min_length=1, max_length=256)
    agent_run_id: str = Field(..., min_length=1, max_length=80)
    thread_id: str = Field(..., min_length=1, max_length=80)
    message: str = Field(..., min_length=1, max_length=32000)


class BridgeChatSnapshotResponse(BaseModel):
    ok: bool
    run_status: str
    reply: str
    terminal: bool


def _require_bridge_secret(x_wechat_ilink_bridge_secret: Optional[str]) -> None:
    expected = (config.WECHAT_ILINK_BRIDGE_SECRET or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="WeChat iLink bridge is not configured")
    got = (x_wechat_ilink_bridge_secret or "").strip()
    if not got or not hmac.compare_digest(got, expected):
        raise HTTPException(status_code=401, detail="Invalid bridge secret")


async def _get_active_session(account_id: str) -> Optional[Dict[str, Any]]:
    sql = """
    SELECT
        account_id::text AS account_id,
        encrypted_bot_token,
        ilink_bot_id,
        ilink_user_id,
        baseurl,
        get_updates_buf,
        thread_id::text AS thread_id,
        status
    FROM public.wechat_ilink_sessions
    WHERE account_id = CAST(:aid AS uuid) AND status = 'active'
    """
    return await execute_one_read(sql, {"aid": account_id})


async def _update_session_thread(account_id: str, thread_id: str) -> None:
    sql = """
    UPDATE public.wechat_ilink_sessions
    SET thread_id = CAST(:tid AS uuid), updated_at = timezone('utc', now())
    WHERE account_id = CAST(:aid AS uuid)
    RETURNING 1
    """
    await execute_one(sql, {"aid": account_id, "tid": thread_id}, commit=True)


async def _clear_session_thread(account_id: str) -> None:
    sql = """
    UPDATE public.wechat_ilink_sessions
    SET thread_id = NULL, updated_at = timezone('utc', now())
    WHERE account_id = CAST(:aid AS uuid)
    RETURNING 1
    """
    await execute_one(sql, {"aid": account_id}, commit=True)


async def _update_session_thread_resilient(account_id: str, thread_id: str) -> None:
    for attempt in range(24):
        try:
            await _update_session_thread(account_id, thread_id)
            return
        except Exception as e:
            msg = str(e).lower()
            if ("foreign key" in msg or "violates foreign key" in msg) and attempt < 23:
                await asyncio.sleep(0.25)
                continue
            raise


async def _mark_session_expired(account_id: str) -> None:
    sql = """
    UPDATE public.wechat_ilink_sessions
    SET status = 'expired', updated_at = timezone('utc', now())
    WHERE account_id = CAST(:aid AS uuid)
    RETURNING 1
    """
    await execute_one(sql, {"aid": account_id}, commit=True)


async def _delete_session(account_id: str) -> None:
    sql = """
    DELETE FROM public.wechat_ilink_sessions
    WHERE account_id = CAST(:aid AS uuid)
    RETURNING 1
    """
    await execute_one(sql, {"aid": account_id}, commit=True)


async def _upsert_session_from_token(
    account_id: str,
    bot_token: str,
    baseurl: str,
    ilink_bot_id: str,
    ilink_user_id: str = "",
) -> None:
    encrypted = encrypt_bot_token(bot_token)
    sql = """
    INSERT INTO public.wechat_ilink_sessions (
        account_id, encrypted_bot_token, ilink_bot_id, ilink_user_id, baseurl,
        get_updates_buf, thread_id, status, connected_at, last_seen_at, created_at, updated_at
    )
    VALUES (
        CAST(:aid AS uuid), :enc, :bot_id, :user_id, :baseurl,
        '', NULL, 'active', timezone('utc', now()), timezone('utc', now()),
        timezone('utc', now()), timezone('utc', now())
    )
    ON CONFLICT (account_id) DO UPDATE SET
        encrypted_bot_token = EXCLUDED.encrypted_bot_token,
        ilink_bot_id = EXCLUDED.ilink_bot_id,
        ilink_user_id = EXCLUDED.ilink_user_id,
        baseurl = EXCLUDED.baseurl,
        get_updates_buf = '',
        status = 'active',
        connected_at = timezone('utc', now()),
        last_seen_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    RETURNING 1
    """
    await execute_one(
        sql,
        {
            "aid": account_id,
            "enc": encrypted,
            "bot_id": ilink_bot_id or "",
            "user_id": ilink_user_id or "",
            "baseurl": baseurl or ILINK_DEFAULT_BASE,
        },
        commit=True,
    )


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

    async def fetch_rows():
        return await threads_repo.get_thread_messages(
            thread_id,
            order="desc",
            optimized=True,
            allowed_types=["user", "tool", "assistant", "status"],
        )

    return await latest_bridge_reply_plain_text_via_poll(started, user_prompt, fetch_rows)


async def _compose_live_reply(thread_id: str, agent_run_id: str, user_prompt: str) -> str:
    run_row = await agents_repo.get_agent_run_by_id(agent_run_id)
    started = None
    if run_row:
        started = run_row.get("started_at") or run_row.get("created_at")
    rows = await threads_repo.get_thread_messages(
        thread_id,
        order="desc",
        optimized=True,
        allowed_types=["user", "tool", "assistant", "status"],
    )
    return (compose_bridge_turn_plain_text(rows, started, user_prompt) or "").strip()


async def _verify_wechat_bridge_run(account_id: str, agent_run_id: str, thread_id: str) -> Dict[str, Any]:
    session = await _get_active_session(account_id)
    if not session:
        raise HTTPException(status_code=403, detail="WeChat is not connected for this workspace")
    run_row = await agents_repo.get_agent_run_by_id(agent_run_id)
    if not run_row:
        raise HTTPException(status_code=404, detail="Agent run not found")
    if str(run_row.get("thread_id") or "") != str(thread_id):
        raise HTTPException(status_code=400, detail="Thread mismatch for this run")
    if str(run_row.get("thread_account_id") or "") != str(account_id):
        raise HTTPException(status_code=403, detail="Workspace mismatch for this run")
    return run_row


async def _bridge_build_success_reply(
    account_id: str,
    tid: str,
    agent_run_id: str,
    raw: str,
) -> BridgeChatResponse:
    await asyncio.sleep(BRIDGE_POST_RUN_SETTLE_SEC)
    reply_text = await _latest_assistant_reply(str(tid), str(agent_run_id), raw)
    if not reply_text:
        reply_text = "（暂无文本回复，请在网页端查看详情。）"
    reply_text, thread_browser_url = await append_thread_workspace_link(
        reply_text,
        str(tid),
        threads_repo=threads_repo,
        frontend_url=config.FRONTEND_URL,
    )
    _max = 180_000
    if len(reply_text) > _max:
        reply_text = reply_text[: _max - 1] + "…"

    await _update_session_thread_resilient(account_id, str(tid))
    return BridgeChatResponse(
        ok=True,
        reply=reply_text,
        thread_id=str(tid),
        agent_run_id=str(agent_run_id),
        thread_browser_url=thread_browser_url,
    )


async def _bridge_start_agent_for_chat(account_id: str, peer: str, raw: str) -> BridgeChatStartResponse:
    session = await _get_active_session(account_id)
    if not session:
        cmd, _ = parse_bridge_slash_command(raw)
        if is_help_command(cmd):
            return BridgeChatStartResponse(ok=True, reply=build_help_reply(linked=False))
        return BridgeChatStartResponse(ok=False, reply=MSG_NOT_CONNECTED)

    handled = await handle_thread_slash_command(
        raw,
        account_id=account_id,
        active_thread_id=session.get("thread_id"),
        frontend_url=config.FRONTEND_URL,
        set_active_thread=lambda tid: _update_session_thread(account_id, tid),
        clear_active_thread=lambda: _clear_session_thread(account_id),
    )
    if handled is not None:
        return BridgeChatStartResponse(
            ok=True,
            reply=handled.reply,
            thread_id=handled.thread_id,
        )

    thread_id = session.get("thread_id")
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
            metadata={"source": "wechat_ilink", "ilink_peer_id": peer, "account_id": account_id},
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
        logger.warning(f"[wechat_ilink] start_agent_run HTTPException: {msg}")
        return BridgeChatStartResponse(ok=False, reply=f"{MSG_RUN_FAILED} ({msg})")
    except Exception:
        logger.exception("[wechat_ilink] start_agent_run failed")
        return BridgeChatStartResponse(ok=False, reply=MSG_RUN_FAILED)

    agent_run_id = result.get("agent_run_id")
    tid = result.get("thread_id")
    if not agent_run_id or not tid:
        return BridgeChatStartResponse(ok=False, reply=MSG_RUN_FAILED)

    return BridgeChatStartResponse(
        ok=True,
        reply="",
        agent_run_id=str(agent_run_id),
        thread_id=str(tid),
        message=raw,
    )


async def _require_account_access(user_id: str, account_id: str) -> None:
    if not await threads_repo.check_account_user_access(user_id, account_id):
        raise HTTPException(status_code=403, detail="No access to this workspace")


async def _get_connect_session(session_id: str, account_id: str) -> Optional[Dict[str, Any]]:
    sql = """
    SELECT session_id::text AS session_id, account_id::text AS account_id,
           qrcode, qrcode_url, status, expires_at
    FROM public.wechat_ilink_connect_sessions
    WHERE session_id = CAST(:sid AS uuid) AND account_id = CAST(:aid AS uuid)
    """
    return await execute_one_read(sql, {"sid": session_id, "aid": account_id})


@router.post("/connect/start", response_model=ConnectStartResponse)
async def connect_start(
    body: ConnectStartRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    await _require_account_access(user_id, body.account_id)

    try:
        qr = await fetch_bot_qrcode()
    except Exception as e:
        logger.exception("[wechat_ilink] fetch_bot_qrcode failed")
        raise HTTPException(status_code=502, detail=f"WeChat QR unavailable: {e}") from e

    await execute_one(
        """
        DELETE FROM public.wechat_ilink_connect_sessions
        WHERE account_id = CAST(:aid AS uuid)
        RETURNING 1
        """,
        {"aid": body.account_id},
        commit=True,
    )

    session_id = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(minutes=_CONNECT_TTL_MINUTES)
    await execute_one(
        """
        INSERT INTO public.wechat_ilink_connect_sessions
            (session_id, account_id, qrcode, qrcode_url, status, expires_at)
        VALUES
            (CAST(:sid AS uuid), CAST(:aid AS uuid), :qrcode, :qrcode_url, 'pending', :expires_at)
        RETURNING session_id
        """,
        {
            "sid": session_id,
            "aid": body.account_id,
            "qrcode": qr["qrcode"],
            "qrcode_url": qr["qrcode_img_content"],
            "expires_at": expires,
        },
        commit=True,
    )

    return ConnectStartResponse(
        session_id=session_id,
        qrcode_url=qr["qrcode_img_content"],
        expires_at=expires.isoformat(),
        status="pending",
    )


@router.get("/connect/status", response_model=ConnectStatusResponse)
async def connect_status(
    account_id: str,
    session_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    await _require_account_access(user_id, account_id)
    row = await _get_connect_session(session_id, account_id)
    if not row:
        raise HTTPException(status_code=404, detail="Connect session not found")

    now = datetime.now(timezone.utc)
    expires_at = row["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if row["status"] == "confirmed":
        return ConnectStatusResponse(session_id=session_id, status="confirmed", connected=True)

    if now >= expires_at:
        await execute_one(
            """
            UPDATE public.wechat_ilink_connect_sessions
            SET status = 'expired'
            WHERE session_id = CAST(:sid AS uuid)
            RETURNING 1
            """,
            {"sid": session_id},
            commit=True,
        )
        return ConnectStatusResponse(session_id=session_id, status="expired", connected=False)

    try:
        status_data = await fetch_qrcode_status(row["qrcode"])
    except Exception as e:
        logger.warning(f"[wechat_ilink] get_qrcode_status failed: {e}")
        return ConnectStatusResponse(session_id=session_id, status=row["status"], connected=False)

    new_status = row["status"]
    if status_data.get("status") == "scanned":
        new_status = "scanned"
    elif status_data.get("status") == "expired":
        new_status = "expired"
    elif status_data.get("status") == "confirmed" or status_data.get("bot_token"):
        new_status = "confirmed"
        bot_token = status_data.get("bot_token") or ""
        if not bot_token:
            return ConnectStatusResponse(session_id=session_id, status="pending", connected=False)
        await _upsert_session_from_token(
            account_id,
            bot_token,
            status_data.get("baseurl") or ILINK_DEFAULT_BASE,
            status_data.get("bot_id") or "",
            status_data.get("ilink_user_id") or "",
        )
        await execute_one(
            """
            UPDATE public.wechat_ilink_connect_sessions SET status = 'confirmed'
            WHERE session_id = CAST(:sid AS uuid)
            RETURNING 1
            """,
            {"sid": session_id},
            commit=True,
        )
        return ConnectStatusResponse(session_id=session_id, status="confirmed", connected=True)

    if new_status != row["status"]:
        await execute_one(
            """
            UPDATE public.wechat_ilink_connect_sessions SET status = :st
            WHERE session_id = CAST(:sid AS uuid)
            RETURNING 1
            """,
            {"sid": session_id, "st": new_status},
            commit=True,
        )

    return ConnectStatusResponse(session_id=session_id, status=new_status, connected=False)


@router.delete("/connect")
async def disconnect_wechat(
    account_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    await _require_account_access(user_id, account_id)
    await execute_one(
        """
        DELETE FROM public.wechat_ilink_connect_sessions
        WHERE account_id = CAST(:aid AS uuid)
        RETURNING 1
        """,
        {"aid": account_id},
        commit=True,
    )
    await _delete_session(account_id)
    return {"ok": True}


@router.get("/link-status", response_model=LinkStatusResponse)
async def link_status(
    account_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    await _require_account_access(user_id, account_id)
    row = await execute_one_read(
        """
        SELECT status, connected_at
        FROM public.wechat_ilink_sessions
        WHERE account_id = CAST(:aid AS uuid)
        """,
        {"aid": account_id},
    )
    if not row:
        return LinkStatusResponse(account_id=account_id, connected=False)
    connected = row.get("status") == "active"
    connected_at = row.get("connected_at")
    if connected_at is not None and hasattr(connected_at, "isoformat"):
        connected_at = connected_at.isoformat()
    return LinkStatusResponse(
        account_id=account_id,
        connected=connected,
        status=row.get("status"),
        connected_at=connected_at,
    )


@router.get("/bridge/sessions", response_model=BridgeSessionsResponse)
async def bridge_list_sessions(
    x_wechat_ilink_bridge_secret: Optional[str] = Header(None, alias="X-Wechat-Ilink-Bridge-Secret"),
):
    _require_bridge_secret(x_wechat_ilink_bridge_secret)
    rows = await execute_read(
        """
        SELECT account_id::text AS account_id, encrypted_bot_token, baseurl,
               COALESCE(ilink_bot_id, '') AS ilink_bot_id,
               COALESCE(get_updates_buf, '') AS get_updates_buf
        FROM public.wechat_ilink_sessions
        WHERE status = 'active'
        """,
        {},
    )
    sessions: List[BridgeSessionRow] = []
    for row in rows or []:
        try:
            token = decrypt_bot_token(row["encrypted_bot_token"])
        except ValueError as e:
            logger.error(f"[wechat_ilink] skip session {row.get('account_id')}: {e}")
            continue
        sessions.append(
            BridgeSessionRow(
                account_id=row["account_id"],
                bot_token=token,
                baseurl=row.get("baseurl") or ILINK_DEFAULT_BASE,
                ilink_bot_id=row.get("ilink_bot_id") or "",
                get_updates_buf=row.get("get_updates_buf") or "",
            )
        )
    return BridgeSessionsResponse(sessions=sessions)


@router.patch("/bridge/sessions/{account_id}/cursor")
async def bridge_update_cursor(
    account_id: str,
    body: BridgeCursorRequest,
    x_wechat_ilink_bridge_secret: Optional[str] = Header(None, alias="X-Wechat-Ilink-Bridge-Secret"),
):
    _require_bridge_secret(x_wechat_ilink_bridge_secret)
    await execute_one(
        """
        UPDATE public.wechat_ilink_sessions
        SET get_updates_buf = :buf, last_seen_at = timezone('utc', now()), updated_at = timezone('utc', now())
        WHERE account_id = CAST(:aid AS uuid) AND status = 'active'
        RETURNING 1
        """,
        {"aid": account_id, "buf": body.get_updates_buf or ""},
        commit=True,
    )
    return {"ok": True}


@router.post("/bridge/sessions/{account_id}/expired")
async def bridge_mark_expired(
    account_id: str,
    x_wechat_ilink_bridge_secret: Optional[str] = Header(None, alias="X-Wechat-Ilink-Bridge-Secret"),
):
    _require_bridge_secret(x_wechat_ilink_bridge_secret)
    await _mark_session_expired(account_id)
    return {"ok": True}


@router.post("/bridge/chat/start", response_model=BridgeChatStartResponse)
async def bridge_chat_start(
    body: BridgeChatRequest,
    x_wechat_ilink_bridge_secret: Optional[str] = Header(None, alias="X-Wechat-Ilink-Bridge-Secret"),
):
    _require_bridge_secret(x_wechat_ilink_bridge_secret)
    account_id = body.account_id.strip()
    peer = body.ilink_peer_id.strip()
    raw = (body.message or "").strip()
    if not account_id or not peer or not raw:
        return BridgeChatStartResponse(ok=False, reply=MSG_NOT_CONNECTED)
    try:
        return await _bridge_start_agent_for_chat(account_id, peer, raw)
    except Exception:
        logger.exception("[wechat_ilink] bridge_chat_start failed")
        return BridgeChatStartResponse(ok=False, reply=MSG_RUN_FAILED)


@router.post("/bridge/chat/snapshot", response_model=BridgeChatSnapshotResponse)
async def bridge_chat_snapshot(
    body: BridgeChatSessionRequest,
    x_wechat_ilink_bridge_secret: Optional[str] = Header(None, alias="X-Wechat-Ilink-Bridge-Secret"),
):
    _require_bridge_secret(x_wechat_ilink_bridge_secret)
    account_id = body.account_id.strip()
    raw = (body.message or "").strip()
    if not account_id or not raw:
        return BridgeChatSnapshotResponse(ok=False, run_status="error", reply=MSG_NOT_CONNECTED, terminal=True)
    try:
        await _verify_wechat_bridge_run(account_id, body.agent_run_id.strip(), body.thread_id.strip())
        row = await agents_repo.get_agent_run_status(body.agent_run_id.strip())
        if not row:
            return BridgeChatSnapshotResponse(ok=True, run_status="missing", reply="", terminal=True)
        st = (row.get("status") or "").lower()
        reply = await _compose_live_reply(body.thread_id.strip(), body.agent_run_id.strip(), raw)
        terminal = st in ("completed", "failed", "cancelled", "stopped", "error")
        return BridgeChatSnapshotResponse(ok=True, run_status=st, reply=reply, terminal=terminal)
    except HTTPException:
        raise
    except Exception:
        logger.exception("[wechat_ilink] bridge_chat_snapshot failed")
        return BridgeChatSnapshotResponse(ok=False, run_status="error", reply=MSG_RUN_FAILED, terminal=True)


@router.post("/bridge/chat/finalize", response_model=BridgeChatResponse)
async def bridge_chat_finalize(
    body: BridgeChatSessionRequest,
    x_wechat_ilink_bridge_secret: Optional[str] = Header(None, alias="X-Wechat-Ilink-Bridge-Secret"),
):
    _require_bridge_secret(x_wechat_ilink_bridge_secret)
    account_id = body.account_id.strip()
    raw = (body.message or "").strip()
    tid = body.thread_id.strip()
    rid = body.agent_run_id.strip()
    if not account_id or not raw:
        return BridgeChatResponse(ok=False, reply=MSG_NOT_CONNECTED)
    try:
        await _verify_wechat_bridge_run(account_id, rid, tid)
        row = await agents_repo.get_agent_run_status(rid)
        if not row:
            return BridgeChatResponse(
                ok=True,
                reply="（运行记录缺失，请在网页端查看该对话。）",
                thread_id=tid,
                agent_run_id=rid,
            )
        st = (row.get("status") or "").lower()
        if st in ("failed", "error"):
            err = row.get("error") or "failed"
            return BridgeChatResponse(ok=False, reply=f"{MSG_RUN_FAILED} ({err})")
        if st in ("running", "queued", "pending"):
            live = await _compose_live_reply(tid, rid, raw)
            hint = "处理尚未结束，请稍后。"
            reply = f"{live}\n\n{hint}" if live else hint
            return BridgeChatResponse(ok=True, reply=reply, thread_id=tid, agent_run_id=rid)
        if st == "timeout":
            return BridgeChatResponse(
                ok=True,
                reply="处理时间较长，请稍后在 Dobby 网页端查看该对话的完整回复。",
                thread_id=tid,
                agent_run_id=rid,
            )

        return await _bridge_build_success_reply(account_id, tid, rid, raw)
    except HTTPException:
        raise
    except Exception:
        logger.exception("[wechat_ilink] bridge_chat_finalize failed")
        return BridgeChatResponse(ok=False, reply=MSG_RUN_FAILED)
