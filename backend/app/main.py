from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api.v1.router import api_router
from .db.session import Base, engine, SessionLocal
from .models.rbac import User, Role
from .core.security import hash_password
from .api.v1.endpoints import skating_scheduler, game_scheduler, backup_scheduler
import asyncio

app = FastAPI(title="App Palafeltre API", version="0.1.0")

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
    return {"status": "ok"}

# API v1
app.include_router(api_router, prefix="/api/v1")

# Create tables on startup (simple bootstrap; replace with Alembic in production)
@app.on_event("startup")
def on_startup():
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
            else:
                admin = User(username=admin_username, email=admin_email, full_name='Admin', hashed_password=hash_password(admin_password), is_active=True)
                db.add(admin); db.commit(); db.refresh(admin)
        # Optional forced reset of admin password on each startup (for recovery)
        if settings.force_reset_admin_password:
            admin.hashed_password = hash_password(admin_password)
            db.add(admin); db.commit(); db.refresh(admin)
        # ensure admin role bound
        if not any(r.name=='admin' for r in admin.roles):
            admin.roles.append(admin_role); db.add(admin); db.commit()
    finally:
        db.close()
    # start background scheduler
    loop = asyncio.get_event_loop()
    loop.create_task(skating_scheduler())
    loop.create_task(game_scheduler())
    loop.create_task(backup_scheduler())
