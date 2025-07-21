from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from utils.logger import logger
from .flags import list_flags, is_enabled, get_flag_details, enable_flag, disable_flag, set_flag

router = APIRouter()


class FeatureFlagUpdateRequest(BaseModel):
    enabled: bool
    description: str = ""


@router.get("/feature-flags")
async def get_feature_flags():
    try:
        flags = await list_flags()
        return {"flags": flags}
    except Exception as e:
        logger.error(f"Error fetching feature flags: {str(e)}")
        return {"flags": {}}

@router.get("/feature-flags/{flag_name}")
async def get_feature_flag(flag_name: str):
    try:
        enabled = await is_enabled(flag_name)
        details = await get_flag_details(flag_name)
        return {
            "flag_name": flag_name,
            "enabled": enabled,
            "details": details
        }
    except Exception as e:
        logger.error(f"Error fetching feature flag {flag_name}: {str(e)}")
        return {
            "flag_name": flag_name,
            "enabled": False,
            "details": None
        }

@router.post("/feature-flags/{flag_name}/enable")
async def enable_feature_flag(flag_name: str, request: FeatureFlagUpdateRequest):
    """Enable a feature flag"""
    try:
        success = await enable_flag(flag_name, request.description)
        if success:
            return {"message": f"Feature flag '{flag_name}' enabled successfully"}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to enable feature flag '{flag_name}'")
    except Exception as e:
        logger.error(f"Error enabling feature flag {flag_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error enabling feature flag: {str(e)}")

@router.post("/feature-flags/{flag_name}/disable")
async def disable_feature_flag(flag_name: str, request: FeatureFlagUpdateRequest):
    """Disable a feature flag"""
    try:
        success = await disable_flag(flag_name, request.description)
        if success:
            return {"message": f"Feature flag '{flag_name}' disabled successfully"}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to disable feature flag '{flag_name}'")
    except Exception as e:
        logger.error(f"Error disabling feature flag {flag_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error disabling feature flag: {str(e)}")

@router.put("/feature-flags/{flag_name}")
async def update_feature_flag(flag_name: str, request: FeatureFlagUpdateRequest):
    """Update a feature flag (enable/disable with description)"""
    try:
        success = await set_flag(flag_name, request.enabled, request.description)
        if success:
            status = "enabled" if request.enabled else "disabled"
            return {"message": f"Feature flag '{flag_name}' {status} successfully"}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to update feature flag '{flag_name}'")
    except Exception as e:
        logger.error(f"Error updating feature flag {flag_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating feature flag: {str(e)}") 