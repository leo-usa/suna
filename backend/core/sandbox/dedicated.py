from typing import List, Set

from core.services.db import execute
from core.utils.logger import logger


async def get_dedicated_sandbox_ids(sandbox_ids: List[str]) -> Set[str]:
    """Return sandbox external IDs linked to projects with dedicated_at set."""
    ids = [s for s in sandbox_ids if s]
    if not ids:
        return set()

    placeholders = ", ".join(f":sid_{i}" for i in range(len(ids)))
    params = {f"sid_{i}": sid for i, sid in enumerate(ids)}
    sql = f"""
    SELECT r.external_id
    FROM projects p
    JOIN resources r ON p.sandbox_resource_id = r.id
    WHERE p.dedicated_at IS NOT NULL
      AND r.external_id IN ({placeholders})
    """
    rows = await execute(sql, params)
    return {row["external_id"] for row in rows if row.get("external_id")}


async def is_sandbox_id_dedicated(sandbox_id: str) -> bool:
    if not sandbox_id:
        return False
    dedicated = await get_dedicated_sandbox_ids([sandbox_id])
    return sandbox_id in dedicated


async def sync_sandbox_dedicated_label(sandbox_id: str, dedicated: bool) -> None:
    """Best-effort Daytona label sync for dedicated sandboxes."""
    if not sandbox_id:
        return
    try:
        from core.sandbox.sandbox import daytona

        sandbox = await daytona.get(sandbox_id)
        labels = dict(getattr(sandbox, "labels", None) or {})
        if dedicated:
            labels["dedicated"] = "true"
        else:
            labels.pop("dedicated", None)
        if hasattr(sandbox, "set_labels") and callable(sandbox.set_labels):
            await sandbox.set_labels(labels)
        elif hasattr(daytona, "update_labels"):
            await daytona.update_labels(sandbox, labels)
    except Exception as e:
        logger.debug(f"Could not sync dedicated label for sandbox {sandbox_id}: {e}")
