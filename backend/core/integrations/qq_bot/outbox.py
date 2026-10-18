"""Queue of proactive QQ messages (master-assistant reports) drained by the bridge."""

from __future__ import annotations

from typing import Any, Dict, List

from core.services.db import execute_mutate
from core.utils.logger import logger

OUTBOX_MAX_TEXT = 3500
OUTBOX_MAX_ATTEMPTS = 5


async def enqueue_for_account(account_id: str, text: str, master_thread_id: str) -> int:
    from core.integrations.bridge_reply_format import sanitize_plain_text_for_messaging_apps
    from core.master_assistant.service import absolute_url, get_master, thread_path

    body = sanitize_plain_text_for_messaging_apps(text or "").strip()
    if not body:
        return 0
    master = await get_master(account_id)
    link = absolute_url(thread_path(master.get("project_id") if master else None, master_thread_id))
    if len(body) > OUTBOX_MAX_TEXT:
        body = body[: OUTBOX_MAX_TEXT - 1] + "…"
    body = f"{body}\n\n{link}"
    try:
        rows = await execute_mutate(
            """
            INSERT INTO public.qq_bot_outbox (user_openid, text)
            SELECT user_openid, :text FROM public.qq_bot_links
            WHERE account_id = CAST(:aid AS uuid)
            RETURNING id
            """,
            {"aid": account_id, "text": body},
        )
    except Exception as e:
        logger.debug(f"[qq_bot] outbox enqueue skipped: {e}")
        return 0
    return len([r for r in rows or [] if "id" in r])


async def claim_pending(limit: int = 20) -> List[Dict[str, Any]]:
    rows = await execute_mutate(
        """
        UPDATE public.qq_bot_outbox o
        SET claimed_at = timezone('utc', now()), attempts = o.attempts + 1
        WHERE o.id IN (
            SELECT id FROM public.qq_bot_outbox
            WHERE sent_at IS NULL AND attempts < :max_attempts
              AND (claimed_at IS NULL OR claimed_at < timezone('utc', now()) - interval '2 minutes')
            ORDER BY created_at
            LIMIT :lim
            FOR UPDATE SKIP LOCKED
        )
        RETURNING o.id::text AS id, o.user_openid, o.text
        """,
        {"lim": max(1, min(limit, 50)), "max_attempts": OUTBOX_MAX_ATTEMPTS},
    )
    return [dict(r) for r in rows or [] if "id" in r]


async def mark_sent(ids: List[str]) -> None:
    if not ids:
        return
    await execute_mutate(
        """
        UPDATE public.qq_bot_outbox SET sent_at = timezone('utc', now())
        WHERE id = ANY(CAST(:ids AS uuid[]))
        """,
        {"ids": ids},
    )
