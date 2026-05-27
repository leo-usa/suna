import asyncio
import time

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

        db = await get_db()
        client = await db.client
        rs = ResourceService(client)
        resource = await rs.get_resource_by_external_id(sandbox_id, ResourceType.SANDBOX)
        if not resource:
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


async def get_or_start_sandbox(sandbox_id: str) -> AsyncSandbox:
    """Retrieve a sandbox by ID, check its state, and start it if needed."""
    
    logger.info(f"Getting or starting sandbox with ID: {sandbox_id}")

    try:
        sandbox = await daytona.get(sandbox_id)
        
        # Check if sandbox needs to be started
        if sandbox.state in [SandboxState.ARCHIVED, SandboxState.STOPPED, SandboxState.ARCHIVING]:
            logger.info(f"Sandbox is in {sandbox.state} state. Starting...")
            try:
                await daytona.start(sandbox)
                
                # Wait for sandbox to reach STARTED state
                for _ in range(30):
                    await asyncio.sleep(1)
                    sandbox = await daytona.get(sandbox_id)
                    if sandbox.state == SandboxState.STARTED:
                        break
                
                # Start supervisord in a session when restarting
                await start_supervisord_session(sandbox)
            except Exception as e:
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
            "RESOLUTION": "1048x768x24",
            "RESOLUTION_WIDTH": "1048",
            "RESOLUTION_HEIGHT": "768",
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
    """Delete a sandbox by its ID."""
    logger.info(f"Deleting sandbox with ID: {sandbox_id}")

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
