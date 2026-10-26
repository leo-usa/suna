"""
Per-account master assistant (总助理): one pinned thread that can start child
conversations (cloud or local), track them, and report results back.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from core.services.db import execute, execute_mutate, execute_one, execute_one_read
from core.utils.logger import logger

MASTER_NAME = "Dobby 总助理"
TASK_UPDATE_MARKER = "[Dobby 任务更新]"
TERMINAL_STATUSES = frozenset({"completed", "failed", "stopped", "cancelled", "error"})
EXECUTION_TARGETS = ("cloud", "local", "dedicated")
SUMMARY_MAX_CHARS = 1500

PAGE_PATHS: Dict[str, str] = {
    "buy_credits": "/dashboard?settings=billing",
    "billing": "/dashboard?settings=billing",
    "usage": "/dashboard?settings=usage",
    "memory": "/dashboard?settings=memory",
    "plan": "/dashboard?settings=plan",
    "referrals": "/dashboard?settings=referrals",
    "files": "/files",
    "workers": "/agents",
    "triggers": "/triggers",
    "knowledge": "/knowledge",
    "local_runner_download": "/download",
    "qq_link": "/dashboard/qq",
    "telegram_link": "/dashboard/telegram",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def thread_path(project_id: Optional[str], thread_id: str) -> str:
    if project_id:
        return f"/projects/{project_id}/thread/{thread_id}"
    return f"/thread/{thread_id}"


def absolute_url(path: str) -> str:
    from core.utils.config import config

    base = (config.FRONTEND_URL or "").rstrip("/")
    return f"{base}{path}"


async def get_master(account_id: str) -> Optional[Dict[str, Any]]:
    return await execute_one(
        """
        SELECT account_id::text AS account_id, project_id::text AS project_id,
               thread_id::text AS thread_id, created_at
        FROM public.master_assistants
        WHERE account_id = CAST(:account_id AS uuid)
        """,
        {"account_id": account_id},
    )


async def get_master_by_thread(thread_id: str) -> Optional[Dict[str, Any]]:
    if not thread_id:
        return None
    try:
        return await execute_one_read(
            """
            SELECT account_id::text AS account_id, project_id::text AS project_id,
                   thread_id::text AS thread_id
            FROM public.master_assistants
            WHERE thread_id = CAST(:thread_id AS uuid)
            """,
            {"thread_id": thread_id},
        )
    except Exception as e:
        logger.debug(f"[master] lookup by thread failed: {e}")
        return None


async def is_master_thread(thread_id: str) -> bool:
    return (await get_master_by_thread(thread_id)) is not None


async def master_thread_for_new_channel(account_id: str) -> str:
    """First WeChat or Telegram chat lands in the master assistant, not a new project."""
    from core.utils.ensure_suna import ensure_suna_installed

    await ensure_suna_installed(account_id)
    master = await get_or_create_master(account_id)
    return master["thread_id"]


async def get_or_create_master(account_id: str) -> Dict[str, Any]:
    existing = await get_master(account_id)
    if existing:
        thread = await execute_one(
            "SELECT 1 AS ok FROM public.threads WHERE thread_id = CAST(:tid AS uuid)",
            {"tid": existing["thread_id"]},
        )
        if thread:
            return existing
        await execute_one(
            "DELETE FROM public.master_assistants WHERE account_id = CAST(:aid AS uuid) RETURNING 1",
            {"aid": account_id},
            commit=True,
        )

    from core.threads import repo as threads_repo

    project_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())
    await threads_repo.create_project_and_thread(
        project_id=project_id,
        thread_id=thread_id,
        account_id=account_id,
        project_name=MASTER_NAME,
        thread_name=MASTER_NAME,
        status="ready",
    )
    await threads_repo.update_thread_metadata(thread_id, {"title": MASTER_NAME, "is_master": True})

    row = await execute_one(
        """
        INSERT INTO public.master_assistants (account_id, project_id, thread_id)
        VALUES (CAST(:aid AS uuid), CAST(:pid AS uuid), CAST(:tid AS uuid))
        ON CONFLICT (account_id) DO NOTHING
        RETURNING account_id::text AS account_id, project_id::text AS project_id,
                  thread_id::text AS thread_id, created_at
        """,
        {"aid": account_id, "pid": project_id, "tid": thread_id},
        commit=True,
    )
    if row:
        logger.info(f"[master] created master thread {thread_id} for {account_id}")
        return row

    # Lost a race with a concurrent create; drop ours and use the winner.
    try:
        await threads_repo.delete_project_and_threads(project_id)
    except Exception:
        pass
    winner = await get_master(account_id)
    if not winner:
        raise RuntimeError("Failed to create master assistant")
    return winner


async def resolve_model_for_account(account_id: str, requested: Optional[str]) -> Dict[str, Any]:
    """Validate a requested model against the account tier. Falls back to Basic."""
    from core.ai_models import model_manager, FREE_MODEL_ID
    from core.billing.shared.config import is_model_allowed
    from core.billing.subscriptions import subscription_service

    tier_info = await subscription_service.get_user_subscription_tier(account_id)
    tier_name = tier_info.get("name", "free")

    note = None
    model_id = FREE_MODEL_ID
    if requested:
        resolved = model_manager.resolve_model_id(requested)
        if resolved and model_manager.get(resolved) and is_model_allowed(tier_name, resolved):
            model_id = resolved
        else:
            note = f"Model '{requested}' is not available on this plan; used Basic instead."
    return {"model_name": model_id, "note": note, "tier": tier_name}


async def list_models_for_account(account_id: str) -> Dict[str, Any]:
    from core.ai_models import model_manager
    from core.billing.shared.config import is_model_allowed
    from core.billing.subscriptions import subscription_service

    tier_info = await subscription_service.get_user_subscription_tier(account_id)
    tier_name = tier_info.get("name", "free")

    descriptions = {
        "dobby/basic": "Basic: fast and economical, good for everyday tasks.",
        "dobby/power": "Advanced: strongest reasoning for long or complex tasks; uses more credits.",
    }
    models: List[Dict[str, Any]] = []
    for info in model_manager.list_available_models(include_disabled=False):
        model_id = info.get("id")
        if not model_id or model_id == "dobby/test":
            continue
        models.append({
            "id": model_id,
            "name": info.get("name") or model_id,
            "available": bool(is_model_allowed(tier_name, model_id)),
            "description": descriptions.get(model_id, ""),
        })
    models.sort(key=lambda m: (m["id"] not in descriptions, not m["available"], m["name"]))
    return {
        "plan": tier_name,
        "models": models,
        "how_to_change": "In any conversation, use the model selector (Basic / Advanced) at the bottom-left of the message box.",
    }


async def get_account_status(account_id: str) -> Dict[str, Any]:
    from core.billing.credits.manager import credit_manager
    from core.billing import repo as billing_repo
    from core.billing.shared.config import CREDITS_PER_DOLLAR
    from core.billing.subscriptions import subscription_service

    tier_info, summary, week = await asyncio.gather(
        subscription_service.get_user_subscription_tier(account_id),
        credit_manager.get_credit_summary(account_id),
        billing_repo.get_transactions_summary(account_id, 7),
        return_exceptions=True,
    )
    out: Dict[str, Any] = {"credits_per_dollar": CREDITS_PER_DOLLAR}
    if isinstance(tier_info, dict):
        out["plan"] = tier_info.get("display_name") or tier_info.get("name")
    if isinstance(summary, dict):
        total = float(summary.get("total_balance") or 0)
        out["credit_balance"] = round(total * CREDITS_PER_DOLLAR)
        out["credit_balance_usd"] = round(total, 2)
    if isinstance(week, dict):
        spent = float(week.get("total_spent") or 0)
        out["credits_used_last_7_days"] = round(spent * CREDITS_PER_DOLLAR)
        out["usage_events_last_7_days"] = week.get("usage_count", 0)
    out["details_url"] = absolute_url(PAGE_PATHS["usage"])
    return out


async def list_local_devices(account_id: str) -> List[Dict[str, Any]]:
    from core.local_runner.registry import is_online

    rows = await execute(
        """
        SELECT device_id::text AS device_id, name, platform, last_seen_at
        FROM public.local_runner_devices
        WHERE account_id = CAST(:aid AS uuid) AND revoked_at IS NULL
        ORDER BY last_seen_at DESC NULLS LAST
        """,
        {"aid": account_id},
    )
    devices = []
    for row in rows or []:
        devices.append({
            "device_id": row["device_id"],
            "name": row.get("name") or "This computer",
            "platform": row.get("platform"),
            "online": await is_online(row["device_id"]),
        })
    return devices


async def spawn_child(
    account_id: str,
    master_thread_id: str,
    prompt: str,
    title: Optional[str],
    execution_target: str,
    model: Optional[str],
) -> Dict[str, Any]:
    from core.agents.api import start_agent_run

    target = (execution_target or "cloud").lower()
    if target not in EXECUTION_TARGETS:
        target = "cloud"

    model_info = await resolve_model_for_account(account_id, model)
    result = await start_agent_run(
        account_id=account_id,
        prompt=prompt,
        model_name=model_info["model_name"],
        metadata={"source": "master_assistant", "master_thread_id": master_thread_id},
        execution_target=None if target == "cloud" else target,
    )
    child_thread_id = str(result["thread_id"])
    child_project_id = str(result.get("project_id") or "")
    agent_run_id = str(result["agent_run_id"])
    label = (title or prompt or "").strip()[:80] or "New task"

    await execute_one(
        """
        INSERT INTO public.master_child_runs
            (account_id, master_thread_id, child_thread_id, child_project_id, child_agent_run_id,
             title, execution_target, model_name, status)
        VALUES (CAST(:aid AS uuid), CAST(:mtid AS uuid), CAST(:ctid AS uuid),
                CAST(NULLIF(:cpid, '') AS uuid), CAST(:rid AS uuid),
                :title, :target, :model, 'running')
        ON CONFLICT (child_thread_id) DO NOTHING
        RETURNING 1
        """,
        {
            "aid": account_id,
            "mtid": master_thread_id,
            "ctid": child_thread_id,
            "cpid": child_project_id,
            "rid": agent_run_id,
            "title": label,
            "target": target,
            "model": model_info["model_name"],
        },
        commit=True,
    )
    path = thread_path(child_project_id or None, child_thread_id)
    return {
        "thread_id": child_thread_id,
        "project_id": child_project_id,
        "agent_run_id": agent_run_id,
        "title": label,
        "execution_target": target,
        "model_name": model_info["model_name"],
        "model_note": model_info["note"],
        "status": "running",
        "path": path,
        "url": absolute_url(path),
    }


async def get_child(account_id: str, child_thread_id: str) -> Optional[Dict[str, Any]]:
    return await execute_one(
        """
        SELECT child_thread_id::text AS thread_id, child_project_id::text AS project_id,
               child_agent_run_id::text AS agent_run_id, master_thread_id::text AS master_thread_id,
               title, execution_target, model_name, status, summary, created_at, finished_at
        FROM public.master_child_runs
        WHERE account_id = CAST(:aid AS uuid) AND child_thread_id = CAST(:tid AS uuid)
        """,
        {"aid": account_id, "tid": child_thread_id},
    )


async def list_children(account_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    rows = await execute(
        """
        SELECT child_thread_id::text AS thread_id, child_project_id::text AS project_id,
               title, execution_target, model_name, status, created_at, finished_at
        FROM public.master_child_runs
        WHERE account_id = CAST(:aid AS uuid)
        ORDER BY created_at DESC
        LIMIT :lim
        """,
        {"aid": account_id, "lim": max(1, min(int(limit or 10), 50))},
    )
    out = []
    for row in rows or []:
        item = dict(row)
        item["path"] = thread_path(item.get("project_id"), item["thread_id"])
        out.append(item)
    return out


async def _live_status(child: Dict[str, Any]) -> str:
    from core.agents import repo as agents_repo

    run_id = child.get("agent_run_id")
    if not run_id:
        return child.get("status") or "unknown"
    row = await agents_repo.get_agent_run_status(run_id)
    return ((row or {}).get("status") or child.get("status") or "unknown").lower()


async def check_child(account_id: str, child_thread_id: str) -> Optional[Dict[str, Any]]:
    child = await get_child(account_id, child_thread_id)
    if not child:
        return None
    status = await _live_status(child)
    summary = child.get("summary")
    if not summary:
        summary = await latest_reply_text(child_thread_id, None)
    path = thread_path(child.get("project_id"), child_thread_id)
    return {
        "thread_id": child_thread_id,
        "title": child.get("title"),
        "execution_target": child.get("execution_target"),
        "model_name": child.get("model_name"),
        "status": status,
        "latest_reply": (summary or "")[:SUMMARY_MAX_CHARS],
        "path": path,
        "url": absolute_url(path),
    }


async def send_to_child(account_id: str, child_thread_id: str, message: str) -> Dict[str, Any]:
    from core.agents.api import start_agent_run

    child = await get_child(account_id, child_thread_id)
    if not child:
        raise ValueError("Conversation not found or not started by the master assistant")
    if await _live_status(child) == "running":
        raise ValueError("That conversation is still running; wait for it to finish or stop it first")

    result = await start_agent_run(
        account_id=account_id,
        prompt=message,
        model_name=child.get("model_name"),
        thread_id=child_thread_id,
        project_id=child.get("project_id"),
        metadata={"source": "master_assistant", "master_thread_id": child.get("master_thread_id")},
    )
    await execute_one(
        """
        UPDATE public.master_child_runs
        SET child_agent_run_id = CAST(:rid AS uuid), status = 'running', summary = NULL,
            finished_at = NULL, reported_at = NULL, updated_at = timezone('utc', now())
        WHERE account_id = CAST(:aid AS uuid) AND child_thread_id = CAST(:tid AS uuid)
        RETURNING 1
        """,
        {"rid": str(result["agent_run_id"]), "aid": account_id, "tid": child_thread_id},
        commit=True,
    )
    path = thread_path(child.get("project_id"), child_thread_id)
    return {
        "thread_id": child_thread_id,
        "project_id": child.get("project_id"),
        "agent_run_id": str(result["agent_run_id"]),
        "title": child.get("title"),
        "execution_target": child.get("execution_target"),
        "model_name": child.get("model_name"),
        "status": "running",
        "path": path,
        "url": absolute_url(path),
    }


async def stop_child(account_id: str, child_thread_id: str) -> Dict[str, Any]:
    from core.utils.run_management import stop_agent_run_with_helpers

    child = await get_child(account_id, child_thread_id)
    if not child:
        raise ValueError("Conversation not found or not started by the master assistant")
    if child.get("agent_run_id") and await _live_status(child) == "running":
        await stop_agent_run_with_helpers(child["agent_run_id"], stop_source="master_assistant")
    return {"thread_id": child_thread_id, "status": "stopped"}


async def share_thread(account_id: str, thread_id: str, public: bool) -> Dict[str, Any]:
    from core.threads import repo as threads_repo

    thread = await threads_repo.get_thread_with_project(thread_id)
    if not thread or str(thread.get("account_id")) != str(account_id):
        raise ValueError("Conversation not found in this account")
    project_id = thread.get("project_id")
    if project_id:
        await threads_repo.update_project_visibility(str(project_id), public)
    await threads_repo.update_thread(thread_id=thread_id, is_public=public)
    share_path = f"/share/{thread_id}"
    return {
        "thread_id": thread_id,
        "public": public,
        "share_url": absolute_url(share_path) if public else None,
        "thread_url": absolute_url(thread_path(str(project_id) if project_id else None, thread_id)),
    }


async def latest_reply_text(thread_id: str, since: Optional[datetime]) -> str:
    from core.integrations.bridge_reply_format import assistant_message_row_to_plain_text

    rows = await execute(
        """
        SELECT message_id, type, content, metadata, created_at, updated_at
        FROM public.messages
        WHERE thread_id = CAST(:tid AS uuid) AND type = 'assistant'
          AND (CAST(:since AS timestamptz) IS NULL OR created_at >= CAST(:since AS timestamptz))
        ORDER BY created_at DESC
        LIMIT 8
        """,
        {"tid": thread_id, "since": since},
    )
    for row in rows or []:
        text = assistant_message_row_to_plain_text(dict(row))
        if text and text.strip():
            return text.strip()
    return ""


async def _master_has_running_run(master_thread_id: str) -> bool:
    row = await execute_one(
        """
        SELECT 1 AS ok FROM public.agent_runs
        WHERE thread_id = CAST(:tid AS uuid) AND status = 'running'
        LIMIT 1
        """,
        {"tid": master_thread_id},
    )
    return bool(row)


def _status_label(status: str) -> str:
    return {
        "completed": "已完成",
        "failed": "失败",
        "error": "失败",
        "stopped": "已停止",
        "cancelled": "已停止",
    }.get(status, status)


def _target_label(target: str) -> str:
    return {"local": "本地", "dedicated": "专属电脑"}.get(target or "", "云端")


def build_task_update_prompt(rows: List[Dict[str, Any]]) -> str:
    lines = [TASK_UPDATE_MARKER]
    for row in rows:
        path = thread_path(row.get("project_id"), row["thread_id"])
        lines.append(
            f"- 「{row.get('title') or '任务'}」（{_target_label(row.get('execution_target'))}）"
            f"{_status_label(row.get('status') or '')} | thread_id={row['thread_id']} | {absolute_url(path)}"
        )
        summary = (row.get("summary") or "").strip()
        if summary:
            lines.append(f"  结果摘要：{summary[:SUMMARY_MAX_CHARS]}")
    lines.append(
        "Report these results to the user in one or two sentences (in the user's language). "
        "Call check_conversation for each thread_id so the user gets a card with an Open button."
    )
    return "\n".join(lines)


async def maybe_report_to_master(account_id: str, master_thread_id: str) -> None:
    if await _master_has_running_run(master_thread_id):
        return

    rows = await execute_mutate(
        """
        UPDATE public.master_child_runs
        SET reported_at = timezone('utc', now()), updated_at = timezone('utc', now())
        WHERE master_thread_id = CAST(:mtid AS uuid)
          AND finished_at IS NOT NULL AND reported_at IS NULL
        RETURNING child_thread_id::text AS thread_id, child_project_id::text AS project_id,
                  title, execution_target, status, summary
        """,
        {"mtid": master_thread_id},
    )
    rows = [dict(r) for r in rows or [] if "thread_id" in r]
    if not rows:
        return

    from core.agents.api import start_agent_run

    try:
        await start_agent_run(
            account_id=account_id,
            prompt=build_task_update_prompt(rows),
            thread_id=master_thread_id,
            metadata={"source": "master_callback"},
        )
    except Exception as e:
        logger.warning(f"[master] could not start report run for {master_thread_id}: {e}")
        await execute_mutate(
            """
            UPDATE public.master_child_runs
            SET reported_at = NULL
            WHERE master_thread_id = CAST(:mtid AS uuid)
              AND child_thread_id = ANY(CAST(:ids AS uuid[]))
            RETURNING 1
            """,
            {"mtid": master_thread_id, "ids": [r["thread_id"] for r in rows]},
        )


async def _push_master_reply_to_channels(account_id: str, master_thread_id: str, run_started_at: Any) -> None:
    text = await latest_reply_text(master_thread_id, run_started_at)
    if not text:
        return
    from core.integrations.qq_bot.outbox import enqueue_for_account

    await enqueue_for_account(account_id, text, master_thread_id)


async def on_agent_run_terminal(agent_run_id: str, status: str) -> None:
    """Called after any agent run reaches a terminal status."""
    try:
        child = await execute_one(
            """
            UPDATE public.master_child_runs
            SET status = :status, finished_at = timezone('utc', now()), updated_at = timezone('utc', now())
            WHERE child_agent_run_id = CAST(:rid AS uuid) AND finished_at IS NULL
            RETURNING account_id::text AS account_id, master_thread_id::text AS master_thread_id,
                      child_thread_id::text AS thread_id, title
            """,
            {"rid": agent_run_id, "status": status},
            commit=True,
        )
        if child:
            summary = await latest_reply_text(child["thread_id"], None)
            await execute_one(
                """
                UPDATE public.master_child_runs SET summary = :summary
                WHERE child_thread_id = CAST(:tid AS uuid)
                RETURNING 1
                """,
                {"summary": summary[:4000] if summary else None, "tid": child["thread_id"]},
                commit=True,
            )
            try:
                from core.integrations.im_file_outbox import enqueue_child_office_files

                await enqueue_child_office_files(
                    child["account_id"],
                    child["thread_id"],
                    agent_run_id,
                    child.get("title"),
                )
            except Exception:
                logger.warning("[master] child file enqueue failed", exc_info=True)
            await maybe_report_to_master(child["account_id"], child["master_thread_id"])
            return

        run = await execute_one(
            """
            SELECT ar.thread_id::text AS thread_id, ar.started_at, ar.metadata,
                   ma.account_id::text AS account_id
            FROM public.agent_runs ar
            JOIN public.master_assistants ma ON ma.thread_id = ar.thread_id
            WHERE ar.id = CAST(:rid AS uuid)
            """,
            {"rid": agent_run_id},
        )
        if not run:
            return
        meta = run.get("metadata") or {}
        if isinstance(meta, dict) and meta.get("source") == "master_callback":
            from core.services import redis

            if await redis.set(f"master_pushed:{agent_run_id}", "1", ex=86400, nx=True):
                await _push_master_reply_to_channels(run["account_id"], run["thread_id"], run.get("started_at"))
        await maybe_report_to_master(run["account_id"], run["thread_id"])
    except Exception as e:
        if "does not exist" in str(e).lower():
            logger.debug(f"[master] tables missing, hook skipped: {e}")
        else:
            logger.warning(f"[master] terminal hook failed for {agent_run_id}: {e}")


def schedule_terminal_hook(agent_run_id: str, status: str) -> None:
    if status not in TERMINAL_STATUSES:
        return
    try:
        asyncio.get_running_loop().create_task(on_agent_run_terminal(agent_run_id, status))
    except RuntimeError:
        pass


async def current_run_channel(master_thread_id: str) -> Dict[str, Any]:
    """Where the user's current message to the master came from (web or a chat bridge)."""
    row = await execute_one(
        """
        SELECT metadata FROM public.agent_runs
        WHERE thread_id = CAST(:tid AS uuid) AND status = 'running'
        ORDER BY started_at DESC NULLS LAST
        LIMIT 1
        """,
        {"tid": master_thread_id},
    )
    meta = (row or {}).get("metadata") or {}
    if isinstance(meta, str):
        import json

        try:
            meta = json.loads(meta)
        except ValueError:
            meta = {}
    if meta.get("source") == "qq_bot" and meta.get("qq_user_openid"):
        return {"channel": "qq", "qq_user_openid": str(meta["qq_user_openid"])}
    return {"channel": "web"}


async def list_recent_threads(account_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    from core.threads import repo as threads_repo

    master = await get_master(account_id)
    master_tid = master["thread_id"] if master else None
    rows, _ = await threads_repo.list_user_threads(
        account_id, limit=max(1, min(int(limit or 10), 30)), offset=0, order_by="updated_at"
    )
    items = []
    for index, row in enumerate(rows, start=1):
        tid = str(row["thread_id"])
        pid = str(row["project_id"]) if row.get("project_id") else None
        project = row.get("project") or {}
        path = thread_path(pid, tid)
        updated = row.get("updated_at")
        items.append({
            "index": index,
            "thread_id": tid,
            "title": (project.get("name") or row.get("name") or "New Chat").strip(),
            "updated_at": updated.isoformat() if hasattr(updated, "isoformat") else updated,
            "is_master": tid == master_tid,
            "path": path,
            "url": absolute_url(path),
        })
    return items


async def _thread_for_account(account_id: str, thread_id: str) -> Optional[Dict[str, Any]]:
    return await execute_one(
        """
        SELECT t.thread_id::text AS thread_id, t.project_id::text AS project_id,
               COALESCE(NULLIF(p.name, ''), NULLIF(t.name, ''), 'New Chat') AS title
        FROM public.threads t
        LEFT JOIN public.projects p ON p.project_id = t.project_id
        WHERE t.thread_id = CAST(:tid AS uuid) AND t.account_id = CAST(:aid AS uuid)
        """,
        {"tid": thread_id, "aid": account_id},
    )


async def switch_channel_conversation(
    account_id: str, master_thread_id: str, target_thread_id: Optional[str]
) -> Dict[str, Any]:
    """Point the chat channel the user is writing from at another conversation (None = fresh one)."""
    channel = await current_run_channel(master_thread_id)

    thread = None
    if target_thread_id:
        try:
            uuid.UUID(str(target_thread_id))
        except ValueError:
            raise ValueError("thread_id must be a conversation id from list_recent_conversations")
        thread = await _thread_for_account(account_id, target_thread_id)
        if not thread:
            raise ValueError("Conversation not found in this account")

    result: Dict[str, Any] = {"channel": channel["channel"], "new": thread is None}
    if thread:
        path = thread_path(thread.get("project_id"), thread["thread_id"])
        result.update({
            "thread_id": thread["thread_id"],
            "title": thread["title"],
            "label": f"打开「{thread['title'][:24]}」",
            "path": path,
            "url": absolute_url(path),
        })

    if channel["channel"] == "qq":
        await execute_one(
            """
            UPDATE public.qq_bot_links
            SET thread_id = CAST(:tid AS uuid), updated_at = timezone('utc', now())
            WHERE user_openid = :openid AND account_id = CAST(:aid AS uuid)
            RETURNING 1
            """,
            {"tid": thread["thread_id"] if thread else None, "openid": channel["qq_user_openid"], "aid": account_id},
            commit=True,
        )
        result["switched"] = True
        result["note"] = (
            "From the user's next QQ message on, they talk to "
            + ("a brand-new conversation" if not thread else f"「{thread['title']}」")
            + " instead of you. They can say 回到总助理 or send /master to come back."
        )
    else:
        result["switched"] = False
        result["note"] = (
            "The user is on the web. Tell them to click the button to open the conversation."
            if thread
            else "The user is on the web; for a new task use start_conversation instead."
        )
    return result
