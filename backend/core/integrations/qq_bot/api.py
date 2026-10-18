"""
HTTP API for the official Dobby QQ bot: pairing (JWT) and bridge chat (shared secret).

A linked QQ user talks to the account's master assistant by default; /new, /list
and /use switch to other conversations, /master switches back.
"""

from __future__ import annotations

import asyncio
import hmac
import re
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from core.agents import repo as agents_repo
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
from core.integrations.qq_bot import outbox
from core.services.db import execute_one, execute_one_read
from core.threads import repo as threads_repo
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.config import config
from core.utils.logger import logger

def _require_qq_enabled() -> None:
    if not config.QQ_BOT_ENABLED:
        raise HTTPException(status_code=503, detail="QQ bot is temporarily disabled.")


router = APIRouter(tags=["qq-bot"], dependencies=[Depends(_require_qq_enabled)])

_PAIRING_CODE_ALPHABET = string.ascii_uppercase + string.digits
_PAIRING_CODE_PATTERN = re.compile(r"^[A-Z0-9]{6}$")
_MASTER_CMDS = frozenset({"master", "assistant", "总助理"})

MSG_BIND_OK = "已成功绑定 Dobby。现在可以直接给我发消息，我是你的 Dobby 总助理。发送 /help 查看命令。"
MSG_BIND_INVALID = "验证码无效或已过期。请在 Dobby 网页端重新生成验证码，然后单独发送该 6 位码。"
MSG_BIND_NEEDED = "请先在 Dobby 网页端：左下角头像菜单 → QQ，生成验证码，然后在这里单独发送该 6 位码完成绑定。"
MSG_RUN_FAILED = "Dobby 暂时无法完成请求，请稍后再试。"
MSG_MASTER_SWITCH = "已切换回 Dobby 总助理。"
MSG_MASTER_HELP = (
    "/master — 切换回 Dobby 总助理（默认对话），也可以直接说「回到总助理」\n\n"
    "不用记命令：直接跟总助理说就行，比如「看看我的对话」「切换到第 2 个」「开个新对话」。"
)
_BACK_TO_MASTER_RE = re.compile(
    r"^(请|帮我)?(回到|切换到|切换回|切回|返回|回)(到)?(dobby)?(总助理|总助手|助理)(吧|啦)?[。.!！~～]*$"
)


def _is_back_to_master(raw: str) -> bool:
    return bool(_BACK_TO_MASTER_RE.match(re.sub(r"\s+", "", raw or "").lower()))


def _reraise_if_missing_tables(exc: Exception) -> None:
    msg = str(exc).lower()
    if "does not exist" in msg and "qq_bot" in msg:
        raise HTTPException(
            status_code=503,
            detail="QQ bot tables are missing. Apply migration 20261018120000_master_assistant.sql.",
        ) from exc


class PairingCodeRequest(BaseModel):
    account_id: str = Field(..., description="Workspace (basejump account) to bind this QQ user to.")


class PairingCodeResponse(BaseModel):
    code: str
    expires_at: str


class LinkStatusResponse(BaseModel):
    account_id: str
    linked_peer_count: int


class BridgeChatRequest(BaseModel):
    user_openid: str = Field(..., min_length=1, max_length=128)
    message: str = Field(..., min_length=1, max_length=32000)


class BridgeChatStartResponse(BaseModel):
    ok: bool
    reply: str = ""
    agent_run_id: Optional[str] = None
    thread_id: Optional[str] = None
    message: str = ""
    paired: bool = False


class BridgeChatSessionRequest(BaseModel):
    user_openid: str = Field(..., min_length=1, max_length=128)
    agent_run_id: str = Field(..., min_length=1, max_length=80)
    thread_id: str = Field(..., min_length=1, max_length=80)
    message: str = Field(..., min_length=1, max_length=32000)


class BridgeChatSnapshotResponse(BaseModel):
    ok: bool
    run_status: str
    reply: str
    terminal: bool


class BridgeChatResponse(BaseModel):
    ok: bool
    reply: str
    thread_id: Optional[str] = None
    agent_run_id: Optional[str] = None
    thread_browser_url: Optional[str] = None


class OutboxClaimResponse(BaseModel):
    items: List[Dict[str, Any]]


class OutboxAckRequest(BaseModel):
    ids: List[str]


def _require_bridge_secret(secret: Optional[str]) -> None:
    expected = (config.QQ_BRIDGE_SECRET or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="QQ bridge is not configured")
    got = (secret or "").strip()
    if not got or not hmac.compare_digest(got, expected):
        raise HTTPException(status_code=401, detail="Invalid bridge secret")


def _generate_pairing_code() -> str:
    return "".join(secrets.choice(_PAIRING_CODE_ALPHABET) for _ in range(6))


async def _get_link(openid: str) -> Optional[Dict[str, Any]]:
    return await execute_one_read(
        """
        SELECT user_openid, account_id::text AS account_id, thread_id::text AS thread_id
        FROM public.qq_bot_links WHERE user_openid = :openid
        """,
        {"openid": openid},
    )


async def _set_link_thread(openid: str, thread_id: Optional[str]) -> None:
    await execute_one(
        """
        UPDATE public.qq_bot_links
        SET thread_id = CAST(:thread_id AS uuid), updated_at = timezone('utc', now())
        WHERE user_openid = :openid
        RETURNING 1
        """,
        {"openid": openid, "thread_id": thread_id},
        commit=True,
    )


async def _set_link_thread_resilient(openid: str, thread_id: str) -> None:
    for attempt in range(24):
        try:
            await _set_link_thread(openid, thread_id)
            return
        except Exception as e:
            if "foreign key" in str(e).lower() and attempt < 23:
                await asyncio.sleep(0.25)
                continue
            raise


async def _master_thread_id(account_id: str) -> Optional[str]:
    try:
        from core.master_assistant.service import get_or_create_master

        return (await get_or_create_master(account_id))["thread_id"]
    except Exception as e:
        logger.warning(f"[qq_bot] master thread unavailable for {account_id}: {e}")
        return None


async def _upsert_link(openid: str, account_id: str) -> None:
    master_tid = await _master_thread_id(account_id)
    await execute_one(
        """
        INSERT INTO public.qq_bot_links (user_openid, account_id, thread_id, created_at, updated_at)
        VALUES (:openid, CAST(:account_id AS uuid), CAST(:thread_id AS uuid),
                timezone('utc', now()), timezone('utc', now()))
        ON CONFLICT (user_openid) DO UPDATE SET
            account_id = EXCLUDED.account_id,
            thread_id = EXCLUDED.thread_id,
            updated_at = timezone('utc', now())
        RETURNING 1
        """,
        {"openid": openid, "account_id": account_id, "thread_id": master_tid},
        commit=True,
    )


async def _consume_pairing_code(code: str) -> Optional[str]:
    row = await execute_one(
        """
        DELETE FROM public.qq_bot_pairing_codes
        WHERE code = :code AND expires_at > timezone('utc', now())
        RETURNING account_id::text AS account_id
        """,
        {"code": code},
        commit=True,
    )
    return row["account_id"] if row else None


async def _run_started_at(agent_run_id: str) -> Any:
    run_row = await agents_repo.get_agent_run_by_id(agent_run_id)
    if run_row:
        return run_row.get("started_at") or run_row.get("created_at")
    return None


async def _thread_rows(thread_id: str) -> List[Dict[str, Any]]:
    return await threads_repo.get_thread_messages(
        thread_id,
        order="desc",
        optimized=True,
        allowed_types=["user", "tool", "assistant", "status"],
    )


async def _verify_run(openid: str, agent_run_id: str, thread_id: str) -> None:
    link = await _get_link(openid)
    if not link:
        raise HTTPException(status_code=403, detail="QQ user is not linked")
    run_row = await agents_repo.get_agent_run_by_id(agent_run_id)
    if not run_row:
        raise HTTPException(status_code=404, detail="Agent run not found")
    if str(run_row.get("thread_id") or "") != str(thread_id):
        raise HTTPException(status_code=400, detail="Thread mismatch for this run")
    if str(run_row.get("thread_account_id") or "") != str(link.get("account_id") or ""):
        raise HTTPException(status_code=403, detail="Workspace mismatch for this run")


async def _start_chat(openid: str, raw: str) -> BridgeChatStartResponse:
    link = await _get_link(openid)
    if not link:
        candidate = re.sub(r"\s+", "", raw).upper()
        if _PAIRING_CODE_PATTERN.match(candidate):
            account_id = await _consume_pairing_code(candidate)
            if not account_id:
                return BridgeChatStartResponse(ok=False, reply=MSG_BIND_INVALID)
            await _upsert_link(openid, account_id)
            return BridgeChatStartResponse(ok=True, reply=MSG_BIND_OK, paired=True)
        cmd, _ = parse_bridge_slash_command(raw)
        if is_help_command(cmd):
            return BridgeChatStartResponse(ok=True, reply=build_help_reply(linked=False))
        return BridgeChatStartResponse(ok=False, reply=MSG_BIND_NEEDED)

    account_id = link["account_id"]
    cmd, _ = parse_bridge_slash_command(raw)
    if cmd in _MASTER_CMDS or _is_back_to_master(raw):
        master_tid = await _master_thread_id(account_id)
        if not master_tid:
            return BridgeChatStartResponse(ok=False, reply=MSG_RUN_FAILED)
        await _set_link_thread(openid, master_tid)
        return BridgeChatStartResponse(ok=True, reply=MSG_MASTER_SWITCH, thread_id=master_tid)

    handled = await handle_thread_slash_command(
        raw,
        account_id=account_id,
        active_thread_id=link.get("thread_id"),
        frontend_url=config.FRONTEND_URL,
        set_active_thread=lambda tid: _set_link_thread(openid, tid),
        clear_active_thread=lambda: _set_link_thread(openid, None),
    )
    if handled is not None:
        reply = handled.reply
        if is_help_command(cmd):
            reply = f"{reply}\n\n{MSG_MASTER_HELP}"
        return BridgeChatStartResponse(ok=True, reply=reply, thread_id=handled.thread_id)

    thread_id = link.get("thread_id")
    from core.agents.api import start_agent_run

    try:
        result = await start_agent_run(
            account_id=account_id,
            prompt=raw,
            thread_id=str(thread_id) if thread_id else None,
            metadata={"source": "qq_bot", "qq_user_openid": openid},
        )
    except HTTPException as e:
        detail = e.detail
        msg = detail.get("message") or str(detail) if isinstance(detail, dict) else str(detail)
        logger.warning(f"[qq_bot] start_agent_run HTTPException: {msg}")
        return BridgeChatStartResponse(ok=False, reply=f"{MSG_RUN_FAILED} ({msg})")
    except Exception:
        logger.exception("[qq_bot] start_agent_run failed")
        return BridgeChatStartResponse(ok=False, reply=MSG_RUN_FAILED)

    agent_run_id = result.get("agent_run_id")
    tid = result.get("thread_id")
    if not agent_run_id or not tid:
        return BridgeChatStartResponse(ok=False, reply=MSG_RUN_FAILED)
    if not thread_id:
        await _set_link_thread_resilient(openid, str(tid))
    return BridgeChatStartResponse(
        ok=True,
        agent_run_id=str(agent_run_id),
        thread_id=str(tid),
        message=raw,
    )


@router.post("/pairing-code", response_model=PairingCodeResponse)
async def create_pairing_code(
    body: PairingCodeRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    if not await threads_repo.check_account_user_access(user_id, body.account_id):
        raise HTTPException(status_code=403, detail="No access to this workspace")
    try:
        await execute_one(
            "DELETE FROM public.qq_bot_pairing_codes WHERE account_id = CAST(:aid AS uuid) RETURNING 1",
            {"aid": body.account_id},
            commit=True,
        )
    except Exception as e:
        _reraise_if_missing_tables(e)
        raise

    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    for _ in range(6):
        code = _generate_pairing_code()
        try:
            await execute_one(
                """
                INSERT INTO public.qq_bot_pairing_codes (code, account_id, expires_at)
                VALUES (:code, CAST(:account_id AS uuid), :expires_at)
                RETURNING code
                """,
                {"code": code, "account_id": body.account_id, "expires_at": expires},
                commit=True,
            )
            return PairingCodeResponse(code=code, expires_at=expires.isoformat())
        except Exception as e:
            _reraise_if_missing_tables(e)
            msg = str(e).lower()
            if "duplicate key" in msg or "unique constraint" in msg:
                continue
            raise
    raise HTTPException(status_code=500, detail="Failed to generate pairing code")


@router.get("/link-status", response_model=LinkStatusResponse)
async def link_status(
    account_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    if not await threads_repo.check_account_user_access(user_id, account_id):
        raise HTTPException(status_code=403, detail="No access to this workspace")
    try:
        row = await execute_one(
            "SELECT COUNT(*)::int AS c FROM public.qq_bot_links WHERE account_id = CAST(:aid AS uuid)",
            {"aid": account_id},
        )
    except Exception as e:
        _reraise_if_missing_tables(e)
        raise
    return LinkStatusResponse(account_id=account_id, linked_peer_count=int(row["c"]) if row else 0)


@router.post("/bridge/chat/start", response_model=BridgeChatStartResponse)
async def bridge_chat_start(
    body: BridgeChatRequest,
    x_qq_bridge_secret: Optional[str] = Header(None, alias="X-QQ-Bridge-Secret"),
):
    _require_bridge_secret(x_qq_bridge_secret)
    openid = body.user_openid.strip()
    raw = (body.message or "").strip()
    if not openid or not raw:
        return BridgeChatStartResponse(ok=False, reply=MSG_BIND_NEEDED)
    try:
        return await _start_chat(openid, raw)
    except Exception:
        logger.exception("[qq_bot] bridge_chat_start failed")
        return BridgeChatStartResponse(ok=False, reply=MSG_RUN_FAILED)


@router.post("/bridge/chat/snapshot", response_model=BridgeChatSnapshotResponse)
async def bridge_chat_snapshot(
    body: BridgeChatSessionRequest,
    x_qq_bridge_secret: Optional[str] = Header(None, alias="X-QQ-Bridge-Secret"),
):
    _require_bridge_secret(x_qq_bridge_secret)
    openid = body.user_openid.strip()
    rid = body.agent_run_id.strip()
    tid = body.thread_id.strip()
    try:
        await _verify_run(openid, rid, tid)
        row = await agents_repo.get_agent_run_status(rid)
        if not row:
            return BridgeChatSnapshotResponse(ok=True, run_status="missing", reply="", terminal=True)
        st = (row.get("status") or "").lower()
        started = await _run_started_at(rid)
        reply = (compose_bridge_turn_plain_text(await _thread_rows(tid), started, body.message) or "").strip()
        terminal = st in ("completed", "failed", "cancelled", "stopped", "error")
        return BridgeChatSnapshotResponse(ok=True, run_status=st, reply=reply, terminal=terminal)
    except HTTPException:
        raise
    except Exception:
        logger.exception("[qq_bot] bridge_chat_snapshot failed")
        return BridgeChatSnapshotResponse(ok=False, run_status="error", reply=MSG_RUN_FAILED, terminal=True)


@router.post("/bridge/chat/finalize", response_model=BridgeChatResponse)
async def bridge_chat_finalize(
    body: BridgeChatSessionRequest,
    x_qq_bridge_secret: Optional[str] = Header(None, alias="X-QQ-Bridge-Secret"),
):
    _require_bridge_secret(x_qq_bridge_secret)
    openid = body.user_openid.strip()
    rid = body.agent_run_id.strip()
    tid = body.thread_id.strip()
    raw = (body.message or "").strip()
    try:
        await _verify_run(openid, rid, tid)
        row = await agents_repo.get_agent_run_status(rid)
        st = ((row or {}).get("status") or "").lower()
        if st in ("failed", "error"):
            err = (row or {}).get("error") or "failed"
            return BridgeChatResponse(ok=False, reply=f"{MSG_RUN_FAILED} ({err})")
        if st in ("running", "queued", "pending"):
            return BridgeChatResponse(
                ok=True,
                reply="处理时间较长，完成后我会再通知你，也可以在 Dobby 网页端查看。",
                thread_id=tid,
                agent_run_id=rid,
            )

        await asyncio.sleep(BRIDGE_POST_RUN_SETTLE_SEC)
        started = await _run_started_at(rid)

        async def fetch_rows():
            return await _thread_rows(tid)

        reply_text = await latest_bridge_reply_plain_text_via_poll(started, raw, fetch_rows)
        if not reply_text:
            reply_text = "（暂无文本回复，请在网页端查看详情。）"
        reply_text, thread_browser_url = await append_thread_workspace_link(
            reply_text,
            tid,
            threads_repo=threads_repo,
            frontend_url=config.FRONTEND_URL,
        )
        return BridgeChatResponse(
            ok=True,
            reply=reply_text,
            thread_id=tid,
            agent_run_id=rid,
            thread_browser_url=thread_browser_url,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("[qq_bot] bridge_chat_finalize failed")
        return BridgeChatResponse(ok=False, reply=MSG_RUN_FAILED)


@router.post("/bridge/outbox/claim", response_model=OutboxClaimResponse)
async def bridge_outbox_claim(
    x_qq_bridge_secret: Optional[str] = Header(None, alias="X-QQ-Bridge-Secret"),
):
    _require_bridge_secret(x_qq_bridge_secret)
    try:
        return OutboxClaimResponse(items=await outbox.claim_pending())
    except Exception as e:
        _reraise_if_missing_tables(e)
        logger.warning(f"[qq_bot] outbox claim failed: {e}")
        return OutboxClaimResponse(items=[])


@router.post("/bridge/outbox/ack")
async def bridge_outbox_ack(
    body: OutboxAckRequest,
    x_qq_bridge_secret: Optional[str] = Header(None, alias="X-QQ-Bridge-Secret"),
):
    _require_bridge_secret(x_qq_bridge_secret)
    await outbox.mark_sent([i for i in body.ids if i])
    return {"ok": True}
