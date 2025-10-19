from fastapi import APIRouter
from .endpoints import router as endpoints_router
from .auth import router as auth_router
from .obs import router as obs_router

api_router = APIRouter()
api_router.include_router(endpoints_router)
api_router.include_router(auth_router)
api_router.include_router(obs_router)
