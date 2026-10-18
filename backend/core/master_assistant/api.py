from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query

from core.master_assistant import service
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.logger import logger

router = APIRouter(tags=["master-assistant"])


def _raise_if_missing_tables(exc: Exception) -> None:
    msg = str(exc).lower()
    if "does not exist" in msg and "master_" in msg:
        raise HTTPException(
            status_code=503,
            detail="Master assistant tables are missing. Apply migration 20261018120000_master_assistant.sql.",
        ) from exc


@router.get("/master-assistant")
async def get_master_assistant(user_id: str = Depends(verify_and_get_user_id_from_jwt)) -> Dict[str, Any]:
    try:
        master = await service.get_or_create_master(user_id)
        running = await service._master_has_running_run(master["thread_id"])
    except HTTPException:
        raise
    except Exception as e:
        _raise_if_missing_tables(e)
        logger.exception("[master] get_or_create failed")
        raise HTTPException(status_code=500, detail="Failed to load master assistant")
    return {
        "thread_id": master["thread_id"],
        "project_id": master["project_id"],
        "path": service.thread_path(master["project_id"], master["thread_id"]),
        "name": service.MASTER_NAME,
        "running": running,
    }


@router.get("/master-assistant/children")
async def list_master_children(
    limit: int = Query(10, ge=1, le=50),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
) -> Dict[str, Any]:
    try:
        return {"conversations": await service.list_children(user_id, limit)}
    except Exception as e:
        _raise_if_missing_tables(e)
        raise


@router.get("/master-assistant/children/{thread_id}")
async def get_master_child(
    thread_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
) -> Dict[str, Any]:
    child = await service.get_child(user_id, thread_id)
    if not child:
        raise HTTPException(status_code=404, detail="Conversation not found")
    status = await service._live_status(child)
    return {
        "thread_id": thread_id,
        "project_id": child.get("project_id"),
        "title": child.get("title"),
        "execution_target": child.get("execution_target"),
        "model_name": child.get("model_name"),
        "status": status,
        "path": service.thread_path(child.get("project_id"), thread_id),
    }
