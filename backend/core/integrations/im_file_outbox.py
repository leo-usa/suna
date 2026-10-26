"""Queue office files from a finished master-assistant conversation back to WeChat and Telegram."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from core.services.db import execute_mutate, execute_one, execute_read
from core.utils.logger import logger

MAX_ATTEMPTS = 8


def child_file_caption(title: Optional[str]) -> str:
    name = (title or "").strip() or "任务"
    return f"「{name}」已完成，文件在下面。"


def resend_file_caption(title: Optional[str]) -> str:
    name = (title or "").strip() or "任务"
    return f"「{name}」的文件在下面。"


def channel_should_receive_child_file(current_thread_id: Optional[str], child_thread_id: str) -> bool:
    """The live chat already sends files when the user is inside that same conversation."""
    return bool(child_thread_id) and str(current_thread_id or "") != str(child_thread_id)


def _missing_table(exc: Exception) -> bool:
    text = str(exc).lower()
    return "im_file_outbox" in text or "reply_context_token" in text or "does not exist" in text


async def save_wechat_reply_context(account_id: str, peer_id: str, context_token: str) -> None:
    peer = (peer_id or "").strip()
    token = (context_token or "").strip()
    if not account_id or not peer or not token:
        return
    try:
        await execute_one(
            """
            UPDATE public.wechat_ilink_sessions
            SET reply_peer_id = :peer, reply_context_token = :token, updated_at = timezone('utc', now())
            WHERE account_id = CAST(:aid AS uuid) AND status = 'active'
            RETURNING 1
            """,
            {"aid": account_id, "peer": peer, "token": token},
            commit=True,
        )
    except Exception as exc:
        if _missing_table(exc):
            logger.warning("[im_file_outbox] reply context skipped; apply migration 20261026020000_im_file_outbox.sql")
            return
        raise


async def clear_wechat_reply_context(account_id: str) -> None:
    try:
        await execute_one(
            """
            UPDATE public.wechat_ilink_sessions
            SET reply_context_token = NULL, updated_at = timezone('utc', now())
            WHERE account_id = CAST(:aid AS uuid)
            RETURNING 1
            """,
            {"aid": account_id},
            commit=True,
        )
    except Exception as exc:
        if _missing_table(exc):
            return
        raise


async def _insert_file(
    account_id: str,
    channel: str,
    recipient: str,
    thread_id: str,
    path: str,
    name: str,
    size: int,
    caption: Optional[str],
) -> bool:
    row = await execute_one(
        """
        INSERT INTO public.im_file_outbox
            (account_id, channel, recipient, thread_id, path, name, size, caption)
        SELECT CAST(:aid AS uuid), :channel, :recipient, CAST(:tid AS uuid), :path, :name, :size, :caption
        WHERE NOT EXISTS (
            SELECT 1 FROM public.im_file_outbox
            WHERE sent_at IS NULL AND channel = :channel AND recipient = :recipient
              AND thread_id = CAST(:tid AS uuid) AND path = :path
        )
        RETURNING id::text AS id
        """,
        {
            "aid": account_id,
            "channel": channel,
            "recipient": recipient,
            "tid": thread_id,
            "path": path,
            "name": name,
            "size": int(size or 0),
            "caption": caption,
        },
        commit=True,
    )
    return bool(row and row.get("id"))


async def enqueue_child_office_files(
    account_id: str,
    child_thread_id: str,
    agent_run_id: str,
    title: Optional[str],
) -> int:
    """Queue office files from a finished child conversation for each connected chat."""
    from core.integrations.bridge_office_files import list_turn_office_files

    try:
        files = await list_turn_office_files(account_id, child_thread_id, agent_run_id, "")
    except Exception:
        logger.warning("[im_file_outbox] could not list child files", exc_info=True)
        return 0
    if not files:
        return 0
    queued, _pending = await _queue_office_files(account_id, child_thread_id, files, child_file_caption(title))
    return queued


async def enqueue_existing_office_files(
    account_id: str,
    thread_id: str,
    title: Optional[str],
) -> Dict[str, Any]:
    """Queue office files that already exist, including ones sent before."""
    from core.integrations.bridge_office_files import list_thread_office_files

    try:
        files = await list_thread_office_files(account_id, thread_id)
    except Exception:
        logger.warning("[im_file_outbox] could not list conversation files", exc_info=True)
        files = []
    names = [office_file.name for office_file in files]
    if not files:
        return {"queued": 0, "already_pending": 0, "names": []}
    queued, pending = await _queue_office_files(account_id, thread_id, files, resend_file_caption(title))
    return {"queued": queued, "already_pending": pending, "names": names}


async def _queue_office_files(
    account_id: str,
    thread_id: str,
    files: List[Any],
    caption: str,
) -> tuple:
    try:
        wechat = await execute_one(
            """
            SELECT thread_id::text AS thread_id
            FROM public.wechat_ilink_sessions
            WHERE account_id = CAST(:aid AS uuid) AND status = 'active'
            """,
            {"aid": account_id},
        )
        telegram_links = await execute_read(
            """
            SELECT telegram_user_id, thread_id::text AS thread_id
            FROM public.telegram_bot_links
            WHERE account_id = CAST(:aid AS uuid)
            """,
            {"aid": account_id},
        )
    except Exception as exc:
        if _missing_table(exc):
            logger.warning("[im_file_outbox] enqueue skipped; apply migration 20261026020000_im_file_outbox.sql")
            return 0, 0
        raise

    inserted = 0
    already_pending = 0
    if wechat and channel_should_receive_child_file(wechat.get("thread_id"), thread_id):
        for index, office_file in enumerate(files):
            if await _insert_file(
                account_id,
                "wechat_ilink",
                account_id,
                thread_id,
                office_file.path,
                office_file.name,
                office_file.size,
                caption if index == 0 else None,
            ):
                inserted += 1
            else:
                already_pending += 1
    for link in telegram_links or []:
        if not channel_should_receive_child_file(link.get("thread_id"), thread_id):
            continue
        recipient = str(link.get("telegram_user_id") or "")
        if not recipient:
            continue
        for index, office_file in enumerate(files):
            if await _insert_file(
                account_id,
                "telegram",
                recipient,
                thread_id,
                office_file.path,
                office_file.name,
                office_file.size,
                caption if index == 0 else None,
            ):
                inserted += 1
            else:
                already_pending += 1
    if inserted:
        logger.info("[im_file_outbox] queued %s file row(s) for %s", inserted, thread_id)
    return inserted, already_pending


def _file_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(row["id"]),
        "thread_id": str(row["thread_id"]),
        "path": row["path"],
        "name": row["name"],
        "caption": row.get("caption") or "",
        "recipient": row.get("recipient") or "",
    }


async def claim_pending(channel: str, recipient: Optional[str] = None, limit: int = 3) -> List[Dict[str, Any]]:
    recipient_clause = "AND recipient = :recipient" if recipient else ""
    params: Dict[str, Any] = {
        "channel": channel,
        "lim": max(1, min(int(limit or 3), 10)),
        "max_attempts": MAX_ATTEMPTS,
    }
    if recipient:
        params["recipient"] = recipient
    rows = await execute_mutate(
        f"""
        UPDATE public.im_file_outbox o
        SET claimed_at = timezone('utc', now()), attempts = o.attempts + 1
        WHERE o.id IN (
            SELECT id FROM public.im_file_outbox
            WHERE sent_at IS NULL AND attempts < :max_attempts
              AND channel = :channel
              {recipient_clause}
              AND (claimed_at IS NULL OR claimed_at < timezone('utc', now()) - interval '2 minutes')
            ORDER BY created_at
            LIMIT :lim
            FOR UPDATE SKIP LOCKED
        )
        RETURNING o.id::text AS id, o.thread_id::text AS thread_id, o.path, o.name,
                  o.caption, o.recipient
        """,
        params,
    )
    return [_file_row(row) for row in rows or [] if row.get("id")]


async def claim_wechat(account_id: str) -> Dict[str, Any]:
    empty = {"files": [], "peer_id": "", "context_token": ""}
    try:
        ctx = await execute_one(
            """
            SELECT reply_peer_id, reply_context_token
            FROM public.wechat_ilink_sessions
            WHERE account_id = CAST(:aid AS uuid) AND status = 'active'
            """,
            {"aid": account_id},
        )
    except Exception as exc:
        if _missing_table(exc):
            return empty
        raise
    peer = str((ctx or {}).get("reply_peer_id") or "")
    token = str((ctx or {}).get("reply_context_token") or "")
    if not peer or not token:
        return empty
    files = await claim_pending("wechat_ilink", account_id)
    return {"files": files, "peer_id": peer, "context_token": token}


async def claim_telegram() -> List[Dict[str, Any]]:
    try:
        return await claim_pending("telegram", None)
    except Exception as exc:
        if _missing_table(exc):
            return []
        raise


async def mark_sent(ids: List[str]) -> None:
    clean = [item for item in ids if item]
    if not clean:
        return
    await execute_mutate(
        """
        UPDATE public.im_file_outbox
        SET sent_at = timezone('utc', now()), claimed_at = NULL
        WHERE id = ANY(CAST(:ids AS uuid[]))
        """,
        {"ids": clean},
    )


async def release_file(file_id: str, error: str, context_expired: bool = False) -> None:
    if not file_id:
        return
    if context_expired:
        await execute_mutate(
            """
            UPDATE public.im_file_outbox
            SET claimed_at = NULL,
                attempts = GREATEST(attempts - 1, 0),
                last_error = :err
            WHERE id = CAST(:id AS uuid) AND sent_at IS NULL
            """,
            {"id": file_id, "err": (error or "")[:500]},
        )
        return
    await execute_mutate(
        """
        UPDATE public.im_file_outbox
        SET claimed_at = NULL, last_error = :err
        WHERE id = CAST(:id AS uuid) AND sent_at IS NULL
        """,
        {"id": file_id, "err": (error or "")[:500]},
    )
