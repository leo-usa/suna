from typing import Optional

from core.utils.logger import logger

_KEY = "computer_save_screenshots:{project_id}"


def _key(project_id: str) -> str:
    return _KEY.format(project_id=project_id)


async def save_computer_screenshots_enabled(project_id: Optional[str]) -> bool:
    """Local screenshots stay off unless the user opted in for this project."""
    if not project_id:
        return False
    try:
        from core.services import redis

        return await redis.get(_key(project_id)) == "1"
    except Exception as e:
        logger.debug(f"[COMPUTER] Could not read screenshot preference: {e}")
        return False


async def set_save_computer_screenshots(project_id: str, enabled: bool) -> bool:
    from core.services import redis

    key = _key(project_id)
    if enabled:
        await redis.set(key, "1")
    else:
        await redis.delete(key)
    return enabled
