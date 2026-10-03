import asyncio
import time
import uuid

from daytona_sdk import AsyncDaytona, DaytonaConfig, CreateSandboxFromSnapshotParams, AsyncSandbox, SessionExecuteRequest, SandboxState, ListSandboxesQuery
from dotenv import load_dotenv
from core.utils.logger import logger
from core.utils.config import config
from core.utils.config import Configuration

load_dotenv()

# logger.debug("Initializing Daytona sandbox configuration")
daytona_config = DaytonaConfig(
    api_key=config.DAYTONA_API_KEY,
    api_url=config.DAYTONA_SERVER_URL, 
    target=config.DAYTONA_TARGET,
)

if daytona_config.api_key:
    logger.debug("Daytona sandbox configured successfully")
else:
    logger.warning("No Daytona API key found in environment variables")

if daytona_config.api_url:
    logger.debug(f"Daytona API URL set to: {daytona_config.api_url}")
else:
    logger.warning("No Daytona API URL found in environment variables")

if daytona_config.target:
    logger.debug(f"Daytona target set to: {daytona_config.target}")
else:
    logger.warning("No Daytona target found in environment variables")

daytona = AsyncDaytona(daytona_config)

_SANDBOX_START_LOCKS: dict[str, asyncio.Lock] = {}
_BACKGROUND_SANDBOX_TASKS: set[asyncio.Task] = set()
_REPLACING_SANDBOX_IDS: set[str] = set()

_STARTED_STATES = {SandboxState.STARTED}
_STOPPED_STATES = {SandboxState.STOPPED, SandboxState.ARCHIVED}
_TRANSITIONAL_STATES = {
    SandboxState.STARTING,
    SandboxState.RESTORING,
    SandboxState.CREATING,
    SandboxState.PULLING_SNAPSHOT,
    SandboxState.PENDING_BUILD,
    SandboxState.ARCHIVING,
    SandboxState.STOPPING,
    SandboxState.RESIZING,
    SandboxState.BUILDING_SNAPSHOT,
    SandboxState.SNAPSHOTTING,
    SandboxState.FORKING,
}
_ERROR_STATES = {
    SandboxState.ERROR,
    SandboxState.BUILD_FAILED,
    SandboxState.UNKNOWN,
    SandboxState.UNKNOWN_DEFAULT_OPEN_API,
}
_DESTROYED_STATES = {SandboxState.DESTROYED, SandboxState.DESTROYING}


def _start_lock_for(sandbox_id: str) -> asyncio.Lock:
    lock = _SANDBOX_START_LOCKS.get(sandbox_id)
    if lock is None:
        lock = asyncio.Lock()
        _SANDBOX_START_LOCKS[sandbox_id] = lock
    return lock


async def _run_scheduled_sandbox_start(sandbox_id: str, force: bool = False) -> None:
    try:
        await get_or_start_sandbox(sandbox_id, force=force)
    except Exception as e:
        logger.error(f"Background sandbox start failed for {sandbox_id}: {e}")


def schedule_sandbox_start(sandbox_id: str, force: bool = False) -> None:
    """Start or recover a sandbox in the background without dropping the task."""
    task = asyncio.create_task(_run_scheduled_sandbox_start(sandbox_id, force=force))
    _BACKGROUND_SANDBOX_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_SANDBOX_TASKS.discard)


async def _wait_for_states(
    sandbox_id: str,
    desired_states: set[SandboxState],
    timeout: float,
) -> AsyncSandbox:
    deadline = time.monotonic() + timeout
    sandbox = await daytona.get(sandbox_id)
    while time.monotonic() < deadline:
        if sandbox.state in desired_states:
            return sandbox
        await asyncio.sleep(1)
        sandbox = await daytona.get(sandbox_id)
    return sandbox


async def _preview_urls_for_sandbox(sandbox: AsyncSandbox) -> tuple[str | None, str | None, str | None]:
    try:
        vnc_link = await sandbox.get_preview_link(6080)
        website_link = await sandbox.get_preview_link(8080)
        vnc_url = vnc_link.url if hasattr(vnc_link, "url") else None
        website_url = website_link.url if hasattr(website_link, "url") else None
        token = vnc_link.token if hasattr(vnc_link, "token") else None
        return vnc_url, website_url, token
    except Exception as e:
        logger.warning(f"Could not get preview links for sandbox {getattr(sandbox, 'id', '?')}: {e}")
        return None, None, None


async def replace_dead_sandbox(sandbox_id: str) -> AsyncSandbox:
    """Delete an irrecoverable Daytona VM and point the existing resource at a new one."""
    from core.utils.db_helpers import get_db
    from core.resources import ResourceService, ResourceType
    from core.cache.runtime_cache import set_cached_project_metadata

    logger.warning(f"Replacing irrecoverable sandbox {sandbox_id}")
    _REPLACING_SANDBOX_IDS.add(sandbox_id)

    db = await get_db()
    client = await db.client
    resource_service = ResourceService(client)
    resource = await resource_service.get_resource_by_external_id(sandbox_id, ResourceType.SANDBOX)
    if not resource:
        _REPLACING_SANDBOX_IDS.discard(sandbox_id)
        raise RuntimeError(f"Sandbox {sandbox_id} is irrecoverable and has no resource to replace")

    linked = await client.table("projects").select("project_id").eq(
        "sandbox_resource_id", resource["id"]
    ).execute()
    project_ids = [row["project_id"] for row in (linked.data or []) if row.get("project_id")]
    project_id = project_ids[0] if project_ids else None

    try:
        dead = await daytona.get(sandbox_id)
        await daytona.delete(dead)
        logger.info(f"Deleted irrecoverable sandbox {sandbox_id}")
    except Exception as e:
        logger.warning(f"Could not delete irrecoverable sandbox {sandbox_id}: {e}")

    try:
        password = (resource.get("config") or {}).get("pass") or str(uuid.uuid4())
        new_sandbox = await create_sandbox(password, project_id)
        await asyncio.sleep(2)
        vnc_url, website_url, token = await _preview_urls_for_sandbox(new_sandbox)

        config = dict(resource.get("config") or {})
        config["pass"] = password
        if vnc_url:
            config["vnc_preview"] = vnc_url
        if website_url:
            config["sandbox_url"] = website_url
        if token:
            config["token"] = token
        from core.resources import ResourceStatus

        await resource_service.update_resource(
            resource["id"],
            config=config,
            external_id=new_sandbox.id,
            status=ResourceStatus.ACTIVE,
        )
        for linked_project_id in project_ids:
            try:
                await resource_service.link_resource_to_project(linked_project_id, resource["id"])
            except Exception as e:
                logger.warning(f"Could not relink sandbox resource to project {linked_project_id}: {e}")
        for linked_project_id in project_ids:
            try:
                await set_cached_project_metadata(linked_project_id, {
                    "sandbox_id": new_sandbox.id,
                    "pass": password,
                    "vnc_preview": vnc_url,
                    "sandbox_url": website_url,
                    "token": token,
                })
            except Exception as e:
                logger.warning(f"Could not refresh sandbox cache for project {linked_project_id}: {e}")
        try:
            from core.sandbox.dedicated import is_sandbox_id_dedicated, sync_sandbox_dedicated_label
            if await is_sandbox_id_dedicated(new_sandbox.id):
                await sync_sandbox_dedicated_label(new_sandbox.id, True)
        except Exception as e:
            logger.debug(f"Could not mark replacement sandbox dedicated: {e}")
        logger.info(
            f"Replaced sandbox {sandbox_id} with {new_sandbox.id} on resource {resource['id']}"
        )
        return new_sandbox
    finally:
        _REPLACING_SANDBOX_IDS.discard(sandbox_id)


async def refresh_sandbox_preview_urls(sandbox: AsyncSandbox) -> None:
    """Refresh stored preview URLs after a start/restart so health checks hit the live IP."""
    try:
        vnc_link = await sandbox.get_preview_link(6080)
        website_link = await sandbox.get_preview_link(8080)
        vnc_url = vnc_link.url if hasattr(vnc_link, "url") else None
        website_url = website_link.url if hasattr(website_link, "url") else None
        token = vnc_link.token if hasattr(vnc_link, "token") else None
        if not website_url and not vnc_url:
            return

        from core.utils.db_helpers import get_db
        from core.resources import ResourceService, ResourceType

        db = await get_db()
        client = await db.client
        resource_service = ResourceService(client)
        resource = await resource_service.get_resource_by_external_id(sandbox.id, ResourceType.SANDBOX)
        if not resource:
            return

        config = dict(resource.get("config") or {})
        if vnc_url:
            config["vnc_preview"] = vnc_url
        if website_url:
            config["sandbox_url"] = website_url
        if token:
            config["token"] = token
        await resource_service.update_resource(resource["id"], config=config)
        logger.info(f"Refreshed preview URLs for sandbox {sandbox.id}")
    except Exception as e:
        logger.warning(f"Could not refresh preview URLs for sandbox {getattr(sandbox, 'id', '?')}: {e}")


async def download_sandbox_file_bytes(sandbox: AsyncSandbox, path: str, timeout: int = 30 * 60) -> bytes:
    """Read file bytes from the sandbox using the Daytona SDK's public download API."""
    raw = await sandbox.fs.download_file(path, timeout)
    return bytes(raw) if raw else b""


SANDBOX_LRU_EVICTION_BATCH = 5
SANDBOX_LRU_MAX_RETRIES = 5
SANDBOX_LIST_PAGE_SIZE = 100


def _sandbox_lru_sort_key(s: AsyncSandbox) -> float:
    labels = getattr(s, "labels", None) or {}
    ts = labels.get("last_used_ts") if isinstance(labels, dict) else None
    if ts is not None:
        try:
            return float(ts)
        except (ValueError, TypeError):
            return 0.0
    return 0.0


async def _list_all_sandboxes_paginated() -> tuple[list[AsyncSandbox], int]:
    """Fetch every sandbox via cursor-based iteration (Daytona SDK >= 0.180)."""
    items: list[AsyncSandbox] = []
    async for sandbox in daytona.list(ListSandboxesQuery(limit=SANDBOX_LIST_PAGE_SIZE)):
        items.append(sandbox)
    return items, len(items)


async def sync_db_after_evicted_sandbox(sandbox_id: str) -> None:
    """Mark matching resource deleted and unlink projects so resolver can attach a new sandbox."""
    try:
        from core.utils.db_helpers import get_db
        from core.resources import ResourceService, ResourceType

        if sandbox_id in _REPLACING_SANDBOX_IDS:
            logger.info(f"Skipping unlink for {sandbox_id}; a replacement is in progress")
            return
        db = await get_db()
        client = await db.client
        rs = ResourceService(client)
        resource = await rs.get_resource_by_external_id(sandbox_id, ResourceType.SANDBOX)
        if not resource or resource.get("external_id") != sandbox_id:
            return
        rid = resource["id"]
        await client.table("projects").update({"sandbox_resource_id": None}).eq(
            "sandbox_resource_id", rid
        ).execute()
        await rs.delete_resource(rid)
        logger.info(
            f"[SANDBOX LRU] Soft-deleted resource {rid} and unlinked projects for evicted sandbox {sandbox_id}"
        )
    except Exception as e:
        logger.warning(f"[SANDBOX LRU] DB sync failed for evicted sandbox {sandbox_id}: {e}")


async def _evict_oldest_deletable_sandboxes_if_over_limit() -> None:
    """
    When DAYTONA_MAX_SANDBOXES > 0 and list length >= cap, delete oldest STOPPED/ARCHIVED
    sandboxes (by last_used_ts label) until under cap or no deletable VMs remain.
    """
    cap = config.DAYTONA_MAX_SANDBOXES or 0
    if cap <= 0:
        return

    sandboxes, total = await _list_all_sandboxes_paginated()
    logger.info(f"[SANDBOX LRU] Daytona sandbox count: {total}, cap: {cap}")

    if total < cap:
        return

    logger.warning(
        f"[SANDBOX LRU] At or over cap ({cap}), count={total}. Evicting oldest stopped/archived sandboxes."
    )

    retry_count = 0
    while total >= cap and retry_count < SANDBOX_LRU_MAX_RETRIES:
        retry_count += 1
        deletable = [
            s for s in sandboxes if s.state in (SandboxState.ARCHIVED, SandboxState.STOPPED)
        ]
        if deletable:
            from core.sandbox.dedicated import get_dedicated_sandbox_ids

            candidate_ids = [
                getattr(s, "id", None) or str(s) for s in deletable
            ]
            dedicated_ids = await get_dedicated_sandbox_ids(candidate_ids)
            if dedicated_ids:
                before = len(deletable)
                deletable = [
                    s for s in deletable
                    if (getattr(s, "id", None) or str(s)) not in dedicated_ids
                ]
                logger.info(
                    f"[SANDBOX LRU] Skipped {before - len(deletable)} dedicated sandbox(es)"
                )
        logger.info(f"[SANDBOX LRU] Attempt {retry_count}/{SANDBOX_LRU_MAX_RETRIES}: {len(deletable)} deletable (stopped/archived)")

        if not deletable:
            logger.error("[SANDBOX LRU] No stopped/archived sandboxes to evict; cannot create a new sandbox.")
            raise RuntimeError(
                "All sandboxes are busy or running. Please wait for one to stop or archive, then try again."
            )

        deletable.sort(key=_sandbox_lru_sort_key)
        n = min(SANDBOX_LRU_EVICTION_BATCH, len(deletable))
        deleted = 0
        for i in range(n):
            oldest = deletable[i]
            sid = getattr(oldest, "id", None) or str(oldest)
            lu = (
                (getattr(oldest, "labels", None) or {}).get("last_used_ts", "N/A")
                if isinstance(getattr(oldest, "labels", None), dict)
                else "N/A"
            )
            logger.info(
                f"[SANDBOX LRU] Deleting {i + 1}/{n}: id={sid}, state={oldest.state}, last_used={lu}"
            )
            try:
                await daytona.delete(oldest)
                deleted += 1
                await sync_db_after_evicted_sandbox(sid)
            except Exception as e:
                logger.error(f"[SANDBOX LRU] Failed to delete sandbox {sid}: {e}")

        sandboxes, total = await _list_all_sandboxes_paginated()
        logger.info(f"[SANDBOX LRU] After eviction batch: total={total}, deleted_ok={deleted}")

        if total < cap:
            logger.info(f"[SANDBOX LRU] Under cap: {total} < {cap}")
            return

    if total >= cap:
        logger.error(
            f"[SANDBOX LRU] Still at or over cap after {SANDBOX_LRU_MAX_RETRIES} rounds: {total} >= {cap}"
        )
        raise RuntimeError(
            "No sandbox slots available. Try again after more sandboxes stop or archive."
        )


async def get_or_start_sandbox(sandbox_id: str, force: bool = False) -> AsyncSandbox:
    """Retrieve a sandbox by ID, check its state, and start it if needed."""
    
    logger.info(f"Getting or starting sandbox with ID: {sandbox_id} force={force}")

    async with _start_lock_for(sandbox_id):
        try:
            sandbox = await daytona.get(sandbox_id)
            logger.info(f"Sandbox {sandbox_id} current state: {sandbox.state}")

            if sandbox.state in _DESTROYED_STATES:
                raise RuntimeError(f"Sandbox {sandbox_id} is {sandbox.state} and cannot be started")

            if sandbox.state in _ERROR_STATES:
                logger.warning(
                    f"Sandbox {sandbox_id} is {sandbox.state} and cannot be restarted; replacing it"
                )
                sandbox = await replace_dead_sandbox(sandbox_id)
                logger.info(f"Sandbox {sandbox.id} is ready")
                return sandbox

            if sandbox.state in _TRANSITIONAL_STATES and not force:
                logger.info(f"Sandbox {sandbox_id} is {sandbox.state}; waiting for a terminal state")
                sandbox = await _wait_for_states(
                    sandbox_id,
                    _STARTED_STATES | _STOPPED_STATES | _ERROR_STATES | _DESTROYED_STATES,
                    timeout=45,
                )

            if sandbox.state in _TRANSITIONAL_STATES:
                logger.warning(f"Sandbox {sandbox_id} stuck in {sandbox.state}; forcing restart")
                force = True

            if sandbox.state in _DESTROYED_STATES:
                raise RuntimeError(f"Sandbox {sandbox_id} is {sandbox.state} and cannot be started")

            if sandbox.state in _ERROR_STATES:
                logger.warning(
                    f"Sandbox {sandbox_id} entered {sandbox.state}; replacing it"
                )
                sandbox = await replace_dead_sandbox(sandbox_id)
                logger.info(f"Sandbox {sandbox.id} is ready")
                return sandbox

            if force and sandbox.state not in _STOPPED_STATES:
                logger.warning(f"Stopping sandbox {sandbox_id} from {sandbox.state} before restart")
                try:
                    await daytona.stop(sandbox)
                except Exception as e:
                    logger.warning(f"Could not stop sandbox {sandbox_id} before restart: {e}")
                sandbox = await _wait_for_states(
                    sandbox_id,
                    _STOPPED_STATES | _ERROR_STATES | _DESTROYED_STATES,
                    timeout=45,
                )

            if force or sandbox.state in _STOPPED_STATES | {SandboxState.ARCHIVING}:
                logger.info(f"Sandbox is in {sandbox.state} state. Starting...")
                try:
                    await daytona.start(sandbox)
                    sandbox = await _wait_for_states(sandbox_id, _STARTED_STATES, timeout=60)
                    if sandbox.state != SandboxState.STARTED:
                        raise RuntimeError(
                            f"Sandbox {sandbox_id} failed to reach STARTED, state={sandbox.state}"
                        )
                    await start_supervisord_session(sandbox)
                    await refresh_sandbox_preview_urls(sandbox)
                except Exception as e:
                    if "errored state" in str(e).lower():
                        logger.warning(
                            f"Sandbox {sandbox_id} cannot start from error; replacing it"
                        )
                        sandbox = await replace_dead_sandbox(sandbox_id)
                    else:
                        logger.error(f"Error starting sandbox: {e}")
                        raise e

            # LRU: refresh last_used_ts on labels when supported (Daytona SDK)
            try:
                labels = dict(getattr(sandbox, "labels", None) or {})
                labels["last_used_ts"] = str(time.time())
                if hasattr(sandbox, "set_labels") and callable(sandbox.set_labels):
                    await sandbox.set_labels(labels)
                elif hasattr(daytona, "update_labels"):
                    await daytona.update_labels(sandbox, labels)
            except Exception as e:
                logger.debug(f"Could not update last_used_ts labels for {sandbox_id}: {e}")

            logger.info(f"Sandbox {sandbox_id} is ready")
            return sandbox

        except Exception as e:
            logger.error(f"Error retrieving or starting sandbox: {str(e)}")
            raise e

async def start_supervisord_session(sandbox: AsyncSandbox):
    """Start supervisord in a session."""
    session_id = "supervisord-session"
    try:
        await sandbox.process.create_session(session_id)
        await sandbox.process.execute_session_command(session_id, SessionExecuteRequest(
            command="exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf",
            var_async=True
        ))
        logger.info("Supervisord started successfully")
    except Exception as e:
        # Don't fail if supervisord already running
        logger.warning(f"Could not start supervisord: {str(e)}")

async def create_sandbox(password: str, project_id: str = None) -> AsyncSandbox:
    """Create a new sandbox with all required services configured and running.

    If DAYTONA_MAX_SANDBOXES > 0 and the Daytona workspace is at or over that count,
    oldest STOPPED/ARCHIVED sandboxes are deleted first (LRU via last_used_ts label).
    """
    logger.info("Creating new Daytona sandbox environment")

    labels: dict = {}
    if project_id:
        labels["id"] = project_id
    labels["last_used_ts"] = str(time.time())

    params = CreateSandboxFromSnapshotParams(
        snapshot=Configuration.SANDBOX_SNAPSHOT_NAME,
        public=True,
        labels=labels,
        env_vars={
            "CHROME_PERSISTENT_SESSION": "true",
            # Tall enough for Chrome UI + login modals (phone verification, etc.)
            "RESOLUTION": "1400x1050x24",
            "RESOLUTION_WIDTH": "1400",
            "RESOLUTION_HEIGHT": "1050",
            "VNC_PASSWORD": password,
            "ANONYMIZED_TELEMETRY": "false",
            "CHROME_PATH": "",
            "CHROME_USER_DATA": "",
            "CHROME_DEBUGGING_PORT": "9222",
            "CHROME_DEBUGGING_HOST": "localhost",
            "CHROME_CDP": "",
        },
        auto_stop_interval=15,
        auto_archive_interval=30,
    )

    await _evict_oldest_deletable_sandboxes_if_over_limit()

    sandbox = await daytona.create(params)
    logger.info(f"Sandbox created with ID: {sandbox.id}")

    await start_supervisord_session(sandbox)

    logger.info("Sandbox environment successfully initialized")
    return sandbox

async def delete_sandbox(sandbox_id: str) -> bool:
    """Delete a Daytona VM, or the local project folder when the sandbox is local:."""
    logger.info(f"Deleting sandbox with ID: {sandbox_id}")

    from core.local_runner.service import delete_local_sandbox, is_local_sandbox_id

    if is_local_sandbox_id(sandbox_id):
        try:
            await delete_local_sandbox(sandbox_id)
            logger.info(f"Successfully deleted local workspace for {sandbox_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting local workspace {sandbox_id}: {str(e)}")
            raise e

    try:
        # Get the sandbox
        sandbox = await daytona.get(sandbox_id)
        
        # Delete the sandbox
        await daytona.delete(sandbox)
        
        logger.info(f"Successfully deleted sandbox {sandbox_id}")
        return True
    except Exception as e:
        logger.error(f"Error deleting sandbox {sandbox_id}: {str(e)}")
        raise e
