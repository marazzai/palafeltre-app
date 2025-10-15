from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.logging_config import setup_logging
from .api.v1.router import api_router
from .db.session import Base, engine, SessionLocal
from .models.rbac import User, Role
from .core.security import hash_password
from .api.v1.endpoints import skating_scheduler, game_scheduler, backup_scheduler, recurring_tasks_scheduler
import asyncio
import os
from datetime import datetime, timezone
from sqlalchemy import text
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging

# Setup logging
setup_logging(enable_json=settings.json_logs, log_level=settings.log_level)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="App Palafeltre API", version="0.1.0")

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    """Production health check endpoint for Docker/Portainer monitoring"""
    health_status = {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
    
    # Check database connectivity
    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            health_status["database"] = "connected"
        finally:
            db.close()
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["database"] = f"error: {str(e)}"
    
    # Check storage path
    try:
        storage_ok = os.path.exists(settings.storage_path) and os.access(settings.storage_path, os.W_OK)
        health_status["storage"] = "ok" if storage_ok else "not writable"
        if not storage_ok:
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["storage"] = f"error: {str(e)}"
    
    return health_status

# API v1
app.include_router(api_router, prefix="/api/v1")

# Create tables on startup (simple bootstrap; replace with Alembic in production)
@app.on_event("startup")
def on_startup():
    logger.info("Starting application initialization...")
    Base.metadata.create_all(bind=engine)
    # seed admin user and role if not exist
    db = SessionLocal()
    try:
        admin_role = db.query(Role).filter(Role.name == 'admin').first()
        if not admin_role:
            admin_role = Role(name='admin')
            db.add(admin_role)
            db.commit()
            db.refresh(admin_role)
            logger.info("Created admin role")
        # ensure superuser with configured username
        admin_username = settings.admin_username
        admin_email = settings.admin_email
        admin_password = settings.admin_password
        admin = db.query(User).filter(User.username == admin_username).first()
        if not admin:
            # try migrate legacy admin by email
            admin = db.query(User).filter(User.email.in_([admin_email,'admin@palafeltre.local','admin@example.com'])).first()
            if admin:
                admin.username = admin_username
                admin.hashed_password = hash_password(admin_password)
                if not admin.email:
                    admin.email = admin_email
                db.add(admin); db.commit(); db.refresh(admin)
                logger.info(f"Migrated admin user to username: {admin_username}")
            else:
                admin = User(username=admin_username, email=admin_email, full_name='Admin', hashed_password=hash_password(admin_password), is_active=True)
                db.add(admin); db.commit(); db.refresh(admin)
                logger.info(f"Created admin user: {admin_username}")
        # Optional forced reset of admin password on each startup (for recovery)
        if settings.force_reset_admin_password:
            admin.hashed_password = hash_password(admin_password)
            db.add(admin); db.commit(); db.refresh(admin)
            logger.warning("Force reset admin password enabled")
        # ensure admin role bound
        if not any(r.name=='admin' for r in admin.roles):
            admin.roles.append(admin_role); db.add(admin); db.commit()
            logger.info("Bound admin role to admin user")
    finally:
        db.close()
    # start background scheduler
    logger.info("Starting background schedulers...")
    loop = asyncio.get_event_loop()
    loop.create_task(skating_scheduler())
    loop.create_task(game_scheduler())
    loop.create_task(backup_scheduler())
    loop.create_task(recurring_tasks_scheduler())
    logger.info("Application startup complete")
