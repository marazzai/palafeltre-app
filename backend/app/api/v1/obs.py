from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from ...core.auth import get_current_user
from ...core.permissions import require_permission, Permissions
from ...models.rbac import User
from .endpoints import get_db
from ...services.obs_v5 import obs_manager
from ...core.config import settings

router = APIRouter(prefix="/obs", tags=["obs"])

# Pydantic models
class ObsStatus(BaseModel):
    connected: bool
    host: Optional[str] = None
    port: Optional[int] = None

class ObsScenesList(BaseModel):
    scenes: List[str]
    current_scene: Optional[str] = None

class SetSceneRequest(BaseModel):
    scene_name: str

class ObsConfig(BaseModel):
    host: str
    port: int
    password: str

@router.get("/status", response_model=ObsStatus)
@require_permission(Permissions.OBS_VIEW)
async def get_obs_status(current_user: User = Depends(get_current_user)):
    """Get OBS connection status"""
    return {
        "connected": obs_manager.is_connected(),
        "host": settings.obs_host if obs_manager.is_connected() else None,
        "port": settings.obs_port if obs_manager.is_connected() else None
    }

@router.post("/connect")
@require_permission(Permissions.OBS_CONTROL)
async def connect_obs(
    config: ObsConfig,
    current_user: User = Depends(get_current_user)
):
    """Connect to OBS with provided configuration"""
    try:
        obs_manager.set_config(config.host, config.port, config.password)
        
        # Wait a bit for connection attempt
        import time
        time.sleep(2)
        
        if obs_manager.is_connected():
            return {"message": "Connected to OBS successfully", "connected": True}
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to connect to OBS"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error connecting to OBS: {str(e)}"
        )

@router.post("/disconnect")
@require_permission(Permissions.OBS_CONTROL)
async def disconnect_obs(current_user: User = Depends(get_current_user)):
    """Disconnect from OBS"""
    try:
        obs_manager.stop()
        return {"message": "Disconnected from OBS", "connected": False}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error disconnecting from OBS: {str(e)}"
        )

@router.get("/scenes", response_model=ObsScenesList)
@require_permission(Permissions.OBS_VIEW)
async def get_scenes(current_user: User = Depends(get_current_user)):
    """Get list of available scenes"""
    if not obs_manager.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Not connected to OBS"
        )
    
    try:
        scenes = obs_manager.get_scenes()
        return {"scenes": scenes, "current_scene": None}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting scenes: {str(e)}"
        )

@router.post("/scene")
@require_permission(Permissions.OBS_CONTROL)
async def set_scene(
    request: SetSceneRequest,
    current_user: User = Depends(get_current_user)
):
    """Set current scene"""
    if not obs_manager.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Not connected to OBS"
        )
    
    try:
        obs_manager.set_scene(request.scene_name)
        return {"message": f"Scene changed to '{request.scene_name}'"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error setting scene: {str(e)}"
        )

@router.post("/init")
@require_permission(Permissions.OBS_CONTROL)
async def initialize_obs(current_user: User = Depends(get_current_user)):
    """Initialize OBS connection with default settings"""
    try:
        obs_manager.set_config(
            settings.obs_host,
            settings.obs_port,
            settings.obs_password
        )
        
        # Wait a bit for connection attempt
        import time
        time.sleep(2)
        
        connected = obs_manager.is_connected()
        
        return {
            "message": "OBS initialization completed",
            "connected": connected,
            "config": {
                "host": settings.obs_host,
                "port": settings.obs_port,
                "password_set": bool(settings.obs_password)
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initializing OBS: {str(e)}"
        )