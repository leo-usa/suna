"""
HTTP API for WeChat iLink pairing (JWT) and bridge chat (shared secret).

Each basejump account may link one or more ilink_peer_id rows; pairing ties a
WeChat peer to the workspace the user selected when generating the code.
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
    append_thread_workspace_link,
    latest_bridge_reply_plain_text_via_poll,
)
from core.agents import repo as agents_repo
from core.services.db import execute_one, execute_one_read
from core.threads import repo as threads_repo
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.config import config
from core.utils.logger import logger

router = APIRouter(tags=["wechat-ilink"])

_PAIRING_CODE_ALPHABET = string.ascii_uppercase + string.digits
_PAIRING_CODE_PATTERN = re.compile(r"^[A-Z0-9]{6}$")
_MAX_POLL_SECONDS = 120
_POLL_INTERVAL_SEC = 1.5

MSG_BIND_OK = "已成功绑定当前工作区。请继续向 Dobby 发送消息。"
MSG_BIND_INVALID = "验证码无效或已过期。请在本页重新生成验证码，并在微信中单独发送该 6 位码。"
MSG_BIND_NEEDED = "请先在 Dobby 网页端：用户菜单 → 微信，选择工作区并生成验证码，然后在微信中单独发送该 6 位码完成绑定。"
MSG_RUN_FAILED = "Dobby 暂时无法完成请求，请稍后再试。"


class PairingCodeRequest(BaseModel):
    account_id: str = Field(..., description="Workspace (basejump account) to bind this WeChat peer to.")


class PairingCodeResponse(BaseModel):
    code: str
    expires_at: str


class BridgeChatRequest(BaseModel):
    ilink_peer_id: str = Field(..., min_length=1, max_length=256)
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


def _require_bridge_secret(x_wechat_ilink_bridge_secret: Optional[str]) -> None:
    expected = (config.WECHAT_ILINK_BRIDGE_SECRET or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="WeChat iLink bridge is not configured")
    got = (x_wechat_ilink_bridge_secret or "").strip()
    if not got or not hmac.compare_digest(got, expected):
        raise HTTPException(status_code=401, detail="Invalid bridge secret")


def _generate_pairing_code() -> str:
    return "".join(secrets.choice(_PAIRING_CODE_ALPHABET) for _ in range(6))


async def _get_link(ilink_peer_id: str) -> Optional[Dict[str, Any]]:
    sql = """
    SELECT ilink_peer_id, account_id::text AS account_id, thread_id::text AS thread_id
    FROM public.wechat_ilink_links
    WHERE ilink_peer_id = :ilink_peer_id
    """
    return await execute_one_read(sql, {"ilink_peer_id": ilink_peer_id})


async def _upsert_link(ilink_peer_id: str, account_id: str) -> None:
    sql = """
    INSERT INTO public.wechat_ilink_links (ilink_peer_id, account_id, thread_id, created_at, updated_at)
    VALUES (:ilink_peer_id, CAST(:account_id AS uuid), NULL, timezone('utc', now()), timezone('utc', now()))
    ON CONFLICT (ilink_peer_id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        thread_id = NULL,
        updated_at = timezone('utc', now())
    RETURNING 1
    """
    await execute_one(sql, {"ilink_peer_id": ilink_peer_id, "account_id": account_id}, commit=True)


async def _update_link_thread(ilink_peer_id: str, thread_id: str) -> None:
    sql = """
    UPDATE public.wechat_ilink_links
    SET thread_id = CAST(:thread_id AS uuid), updated_at = timezone('utc', now())
    WHERE ilink_peer_id = :ilink_peer_id
    RETURNING 1
    """
    await execute_one(sql, {"ilink_peer_id": ilink_peer_id, "thread_id": thread_id}, commit=True)


async def _update_link_thread_resilient(ilink_peer_id: str, thread_id: str) -> None:
    """Retry when threads row is not committed yet (FK wechat_ilink_links.thread_id → threads)."""
    for attempt in range(24):
        try:
            await _update_link_thread(ilink_peer_id, thread_id)
            return
        except Exception as e:
            msg = str(e).lower()
            if ("foreign key" in msg or "violates foreign key" in msg) and attempt < 23:
                await asyncio.sleep(0.25)
                continue
            raise


async def _consume_pairing_code(code: str) -> Optional[str]:
    sql = """
    DELETE FROM public.wechat_ilink_pairing_codes
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

    async def fetch_rows():
        return await threads_repo.get_thread_messages(
            thread_id,
            order="desc",
            optimized=True,
            allowed_types=["user", "tool", "assistant", "status"],
        )

    return await latest_bridge_reply_plain_text_via_poll(started, user_prompt, fetch_rows)


@router.post("/pairing-code", response_model=PairingCodeResponse)
async def create_pairing_code(
    body: PairingCodeRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    if not await threads_repo.check_account_user_access(user_id, body.account_id):
        raise HTTPException(status_code=403, detail="No access to this workspace")

    await execute_one(
        "DELETE FROM public.wechat_ilink_pairing_codes WHERE account_id = CAST(:aid AS uuid) RETURNING 1",
        {"aid": body.account_id},
        commit=True,
    )

    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    last_err: Optional[Exception] = None
    for _ in range(6):
        code = _generate_pairing_code()
        try:
            await execute_one(
                """
                INSERT INTO public.wechat_ilink_pairing_codes (code, account_id, expires_at)
                VALUES (:code, CAST(:account_id AS uuid), :expires_at)
                RETURNING code
                """,
                {"code": code, "account_id": body.account_id, "expires_at": expires},
                commit=True,
            )
            return PairingCodeResponse(code=code, expires_at=expires.isoformat())
        except Exception as e:
            last_err = e
            msg = str(e).lower()
            if "duplicate key" in msg or "unique constraint" in msg:
                continue
            raise

    logger.exception("[wechat_ilink] failed to generate unique pairing code", exc_info=last_err)
    raise HTTPException(status_code=500, detail="Failed to generate pairing code")


@router.get("/link-status", response_model=LinkStatusResponse)
async def link_status(
    account_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    if not await threads_repo.check_account_user_access(user_id, account_id):
        raise HTTPException(status_code=403, detail="No access to this workspace")
    row = await execute_one_read(
        """
        SELECT COUNT(*)::int AS c FROM public.wechat_ilink_links
        WHERE account_id = CAST(:aid AS uuid)
        """,
        {"aid": account_id},
    )
    n = int(row["c"]) if row else 0
    return LinkStatusResponse(account_id=account_id, linked_peer_count=n)


@router.post("/bridge/chat", response_model=BridgeChatResponse)
async def bridge_chat(
    body: BridgeChatRequest,
    x_wechat_ilink_bridge_secret: Optional[str] = Header(None, alias="X-Wechat-Ilink-Bridge-Secret"),
):
    _require_bridge_secret(x_wechat_ilink_bridge_secret)
    peer = body.ilink_peer_id.strip()
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
            metadata={"source": "wechat_ilink", "ilink_peer_id": peer},
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
        return BridgeChatResponse(ok=False, reply=f"{MSG_RUN_FAILED} ({msg})")
    except Exception:
        logger.exception("[wechat_ilink] start_agent_run failed")
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
        # Long replies are split in apps/bridges (wechat-ilink). Do not cap at ~4k here
        # or the tail (e.g. later list items) is dropped before chunking reaches WeChat.
        reply_text, thread_browser_url = await append_thread_workspace_link(
            reply_text,
            str(tid),
            threads_repo=threads_repo,
            frontend_url=config.FRONTEND_URL,
        )
        _max = 180_000
        if len(reply_text) > _max:
            reply_text = reply_text[: _max - 1] + "…"

        await _update_link_thread_resilient(peer, str(tid))
        return BridgeChatResponse(
            ok=True,
            reply=reply_text,
            thread_id=str(tid),
            agent_run_id=str(agent_run_id),
            thread_browser_url=thread_browser_url,
        )
    except Exception:
        logger.exception("[wechat_ilink] bridge_chat after start_agent_run failed")
        return BridgeChatResponse(ok=False, reply=MSG_RUN_FAILED)
