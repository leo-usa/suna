"""Switch a project between cloud Daytona and a paired local runner."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from core.local_runner import protocol as proto
from core.local_runner.registry import get_online_info, is_online
from core.resources import ResourceService, ResourceStatus, ResourceType
from core.utils.logger import logger

from datetime import datetime, timezone

LOCAL_SANDBOX_PREFIX = "local:"


def local_sandbox_id(project_id: str) -> str:
    return f"{LOCAL_SANDBOX_PREFIX}{project_id}"


def is_local_sandbox_id(sandbox_id: str | None) -> bool:
    return bool(sandbox_id) and str(sandbox_id).startswith(LOCAL_SANDBOX_PREFIX)


def uses_local_runtime(execution_target: str | None, sandbox_id: str | None = None) -> bool:
    return (execution_target or "").lower() == "local" or is_local_sandbox_id(sandbox_id)


def local_preview_url(project_id: str, preview_port: int | str | None = None) -> str:
    port = int(preview_port or proto.DEFAULT_PREVIEW_PORT)
    return f"http://127.0.0.1:{port}/{project_id}"


def local_sandbox_public_info(runtime: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": runtime["sandbox_id"],
        "pass": "",
        "vnc_preview": None,
        "sandbox_url": runtime["sandbox_url"],
    }


async def find_online_device_id(client, account_ids: list[str]) -> Optional[str]:
    ids = [value for value in dict.fromkeys(account_ids) if value]
    if not ids:
        return None
    devices = (
        await client.table("local_runner_devices")
        .select("device_id")
        .in_("account_id", ids)
        .is_("revoked_at", "null")
        .order("last_seen_at", desc=True)
        .execute()
    )
    for row in devices.data or []:
        if await is_online(row["device_id"]):
            return row["device_id"]
    return None


async def ensure_project_device_online(
    client,
    project_id: str,
    *,
    account_id: Optional[str] = None,
    device_id: Optional[str] = None,
) -> Optional[str]:
    """Use the stored device if it is online; otherwise rebind to this account's live runner."""
    if device_id and await is_online(device_id):
        return device_id

    if client is None:
        return None

    if not account_id or not device_id:
        result = (
            await client.table("projects")
            .select("account_id, local_device_id")
            .eq("project_id", project_id)
            .maybe_single()
            .execute()
        )
        row = result.data if result else None
        if row:
            account_id = account_id or row.get("account_id")
            device_id = device_id or row.get("local_device_id")
        if device_id and await is_online(device_id):
            return device_id

    if not account_id:
        return None

    online_id = await find_online_device_id(client, [account_id])
    if not online_id:
        return None
    if online_id != device_id:
        await enable_local_execution(client, project_id, account_id, online_id, user_id=account_id)
        logger.info(f"[LOCAL_RUNNER] Rebound project {project_id} to online device {online_id}")
    return online_id


async def describe_local_runtime(
    project_id: str,
    *,
    client=None,
    execution_target: str | None = None,
    local_device_id: str | None = None,
    sandbox_id: str | None = None,
    sandbox_config: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    """Return LIVE/OFFLINE status for a local project, or None if this is a cloud sandbox."""
    config = dict(sandbox_config or {})
    account_id = None
    if client is not None and (execution_target is None or not local_device_id or not sandbox_id):
        result = (
            await client.table("projects")
            .select("execution_target, local_device_id, sandbox_resource_id, account_id")
            .eq("project_id", project_id)
            .maybe_single()
            .execute()
        )
        row = result.data if result else None
        if row:
            if execution_target is None:
                execution_target = row.get("execution_target")
            local_device_id = local_device_id or row.get("local_device_id")
            account_id = row.get("account_id")
            if not sandbox_id and row.get("sandbox_resource_id"):
                resource = await ResourceService(client).get_resource_by_id(row["sandbox_resource_id"])
                if resource:
                    sandbox_id = resource.get("external_id")
                    config = resource.get("config") or config

    if not uses_local_runtime(execution_target, sandbox_id):
        return None

    device_id = local_device_id or config.get("device_id")
    if client is not None:
        device_id = await ensure_project_device_online(
            client,
            project_id,
            account_id=account_id,
            device_id=device_id,
        )
    online = bool(device_id) and await is_online(device_id)
    info = await get_online_info(device_id) if device_id else None
    preview_port = int((info or {}).get("preview_port") or config.get("preview_port") or proto.DEFAULT_PREVIEW_PORT)
    return {
        "status": "LIVE" if online else "OFFLINE",
        "sandbox_id": local_sandbox_id(project_id),
        "project_id": project_id,
        "daytona_state": "started" if online else "stopped",
        "last_checked": datetime.now(timezone.utc).isoformat(),
        "vnc_preview": None,
        "sandbox_url": local_preview_url(project_id, preview_port),
        "target": "local",
        "error": None if online else "This computer is not connected. Open the Dobby desktop app and try again.",
    }


async def enable_local_execution(
    client, project_id: str, account_id: str, device_id: str, user_id: Optional[str] = None
) -> dict[str, Any]:
    owner_id = user_id or account_id
    device = (
        await client.table("local_runner_devices")
        .select("device_id, account_id, preview_port, revoked_at")
        .eq("device_id", device_id)
        .eq("account_id", owner_id)
        .maybe_single()
        .execute()
    )
    if not device or not device.data or device.data.get("revoked_at"):
        raise ValueError("This computer is not paired")
    if not await is_online(device_id):
        raise ValueError("This computer is not connected. Open the Dobby desktop app and try again.")

    info = await get_online_info(device_id)
    preview_port = int((info or {}).get("preview_port") or device.data.get("preview_port") or proto.DEFAULT_PREVIEW_PORT)
    sandbox_id = local_sandbox_id(project_id)
    sandbox_url = f"http://127.0.0.1:{preview_port}/{project_id}"

    project = (
        await client.table("projects")
        .select("project_id, sandbox_resource_id, execution_target")
        .eq("project_id", project_id)
        .maybe_single()
        .execute()
    )
    if not project or not project.data:
        raise ValueError("Project not found")

    previous_resource_id = project.data.get("sandbox_resource_id")
    config = {
        "pass": "",
        "vnc_preview": None,
        "sandbox_url": sandbox_url,
        "token": None,
        "device_id": device_id,
        "kind": "local",
        "previous_resource_id": previous_resource_id,
    }

    resource_service = ResourceService(client)
    existing = await resource_service.get_resource_by_external_id(sandbox_id, ResourceType.SANDBOX)
    if existing:
        config["previous_resource_id"] = existing.get("config", {}).get("previous_resource_id") or previous_resource_id
        await client.table("resources").update({"config": config, "status": ResourceStatus.ACTIVE.value}).eq(
            "id", existing["id"]
        ).execute()
        resource_id = existing["id"]
    else:
        created = await resource_service.create_resource(
            account_id=account_id,
            resource_type=ResourceType.SANDBOX,
            external_id=sandbox_id,
            config=config,
            status=ResourceStatus.ACTIVE,
        )
        resource_id = created["id"]

    await resource_service.link_resource_to_project(project_id, resource_id)
    await client.table("projects").update(
        {
            "execution_target": "local",
            "local_device_id": device_id,
        }
    ).eq("project_id", project_id).execute()

    from core.cache.runtime_cache import set_cached_project_metadata

    await set_cached_project_metadata(
        project_id,
        {
            "sandbox_id": sandbox_id,
            "pass": "",
            "vnc_preview": None,
            "sandbox_url": sandbox_url,
            "token": None,
        },
    )
    logger.info(f"[LOCAL_RUNNER] Project {project_id} now runs on device {device_id}")
    return {
        "project_id": project_id,
        "execution_target": "local",
        "device_id": device_id,
        "sandbox_id": sandbox_id,
        "sandbox_url": sandbox_url,
    }


async def enable_local_execution_for_user(client, project_id: str, account_id: str, user_id: str) -> dict[str, Any]:
    last_error = "This computer is not connected. Open the Dobby desktop app and try again."
    account_ids = [value for value in dict.fromkeys([user_id, account_id]) if value]
    for attempt in range(8):
        device_id = await find_online_device_id(client, account_ids)
        if device_id:
            return await enable_local_execution(client, project_id, account_id, device_id, user_id=user_id)
        if attempt < 7:
            await asyncio.sleep(0.4)
    raise ValueError(last_error)


async def disable_local_execution(client, project_id: str) -> dict[str, Any]:
    project = (
        await client.table("projects")
        .select("project_id, sandbox_resource_id")
        .eq("project_id", project_id)
        .maybe_single()
        .execute()
    )
    if not project or not project.data:
        raise ValueError("Project not found")

    resource_service = ResourceService(client)
    current = None
    if project.data.get("sandbox_resource_id"):
        current = await resource_service.get_resource_by_id(project.data["sandbox_resource_id"])
    previous_id = (current or {}).get("config", {}).get("previous_resource_id") if current else None

    updates: dict[str, Any] = {"execution_target": "cloud", "local_device_id": None}
    if previous_id:
        updates["sandbox_resource_id"] = previous_id
        previous = await resource_service.get_resource_by_id(previous_id)
        if previous:
            from core.cache.runtime_cache import set_cached_project_metadata

            config = previous.get("config") or {}
            await set_cached_project_metadata(
                project_id,
                {
                    "sandbox_id": previous.get("external_id"),
                    "pass": config.get("pass"),
                    "vnc_preview": config.get("vnc_preview"),
                    "sandbox_url": config.get("sandbox_url"),
                    "token": config.get("token"),
                },
            )
    await client.table("projects").update(updates).eq("project_id", project_id).execute()
    if not previous_id:
        from core.cache.runtime_cache import set_cached_project_metadata

        await set_cached_project_metadata(
            project_id,
            {
                "sandbox_id": None,
                "pass": None,
                "vnc_preview": None,
                "sandbox_url": None,
                "token": None,
            },
        )
    logger.info(f"[LOCAL_RUNNER] Project {project_id} restored to cloud execution")
    return {"project_id": project_id, "execution_target": "cloud"}


async def delete_local_workspace(
    project_id: str,
    *,
    device_id: Optional[str] = None,
    client=None,
) -> bool:
    """Remove ~/Documents/Dobby/<project folder> on the paired Mac. No-op if offline."""
    from core.local_runner.registry import rpc

    if not project_id or "/" in project_id or "\\" in project_id or project_id in {".", ".."}:
        logger.warning(f"[LOCAL_RUNNER] Refusing to delete workspace for invalid project_id={project_id!r}")
        return False

    if not device_id and client is not None:
        try:
            project = (
                await client.table("projects")
                .select("local_device_id")
                .eq("project_id", project_id)
                .maybe_single()
                .execute()
            )
            if project and project.data:
                device_id = project.data.get("local_device_id")
        except Exception as e:
            logger.debug(f"[LOCAL_RUNNER] Could not load local_device_id for {project_id}: {e}")
        if not device_id:
            try:
                resource_service = ResourceService(client)
                resource = await resource_service.get_resource_by_external_id(
                    local_sandbox_id(project_id), ResourceType.SANDBOX
                )
                if resource:
                    device_id = (resource.get("config") or {}).get("device_id")
            except Exception as e:
                logger.debug(f"[LOCAL_RUNNER] Could not load local resource for {project_id}: {e}")

    if not device_id:
        logger.warning(f"[LOCAL_RUNNER] No device for project {project_id}; left local folder on disk")
        return False
    if not await is_online(device_id):
        logger.warning(f"[LOCAL_RUNNER] Device {device_id} offline; left ~/Documents/Dobby/{project_id} on disk")
        return False

    try:
        result = await rpc(device_id, proto.WORKSPACE_DELETE, {"project_id": project_id}, timeout=30)
    except Exception as e:
        logger.warning(f"[LOCAL_RUNNER] Failed to delete local workspace for {project_id}: {e}")
        return False
    logger.info(f"[LOCAL_RUNNER] Deleted local workspace for {project_id}: {result}")
    return bool((result or {}).get("deleted"))


async def delete_local_sandbox(sandbox_id: str, *, client=None) -> bool:
    if not is_local_sandbox_id(sandbox_id):
        return False
    project_id = str(sandbox_id).split(":", 1)[1]
    if client is None:
        try:
            from core.services.supabase import DBConnection
            client = await DBConnection().client
        except Exception as e:
            logger.debug(f"[LOCAL_RUNNER] Could not open DB to delete local sandbox {sandbox_id}: {e}")
    return await delete_local_workspace(project_id, client=client)

