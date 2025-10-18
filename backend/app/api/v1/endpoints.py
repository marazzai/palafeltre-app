from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import or_, inspect
from ...db.session import SessionLocal
from ...models.rbac import User, Role, Permission
from ...models.settings import AppSetting, AuditLog
from ...models.skating import SkatingEvent
from ...models.tasks import Task, TaskComment, TaskAttachment
from ...models.tickets import Ticket, TicketComment, TicketStatusHistory, TicketAttachment, TicketCategory
from ...models.documents import Folder, Document, DocumentVersion
from ...models.scheduling import Shift, AvailabilityBlock, ShiftSwapRequest
from ...models.skates import SkateInventory, SkateRental
from fastapi import UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, Response
from typing import Dict, Set, List, Optional
from datetime import datetime, timedelta, timezone, date
import asyncio
from ...core.security import verify_password, hash_password, create_access_token, decode_token
from ...services.dali import service as dali_service
from ...core.config import settings
import os, shutil
from ...services.pdf_service import ensure_archive_path, render_pdf_bytes, save_pdf_to_archive
from ...services.siren import siren_wav_bytes
from fastapi import Form, Request
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
except Exception:  # pragma: no cover - fallback for editor / dev machines without slowapi
    # Minimal stubs so Pylance/editor don't report missing imports and runtime can operate
    class Limiter:  # very small shim compatible with decorator usage in this module
        def __init__(self, *args, **kwargs):
            pass
        def limit(self, *args, **kwargs):
            def _inner(func):
                return func
            return _inner
    def get_remote_address(request=None):
        return None
import logging

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)

router = APIRouter()

def _has_username_column(db: Session) -> bool:
    try:
        bind = db.get_bind()
        if bind is None:
            return True
        insp = inspect(bind)
        cols = [c['name'] for c in insp.get_columns('users')]
        return 'username' in cols
    except Exception:
        # Default to True to align with current model; avoids breaking user creation/login on modern deployments
        return True


def _get_setting_value(db: Session, key: str, default: str | None = None) -> str | None:
    """Return AppSetting.value or default safely without confusing the type checker."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row:
        return default
    return getattr(row, 'value', default)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_token(token)
    if not payload or 'sub' not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Non autenticato")
    user = db.query(User).get(int(payload['sub']))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utente non valido")
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if not any(r.name == 'admin' for r in user.roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permesso negato")
    return user

def require_permission(permission_code: str):
    """Factory function to create a dependency that checks for a specific permission"""
    def permission_checker(user: User = Depends(get_current_user)) -> User:
        # Admin has all permissions
        if any(r.name == 'admin' for r in user.roles):
            return user
        # Check if user has the specific permission through any of their roles
        for role in user.roles:
            if any(p.code == permission_code for p in role.permissions):
                return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Permesso '{permission_code}' richiesto")
    return permission_checker

# optional auth: don't require token
def get_current_user_optional(db: Session = Depends(get_db), token: str | None = Depends(lambda: None)) -> User | None:
    # Try to read Authorization header manually
    # FastAPI/Starlette makes it easier via request, but for simplicity, reuse oauth2 if present in headers
    return None

@router.get("/ping")
def ping():
    return {"message": "pong"}


# Schemas
class UserOut(BaseModel):
    id: int
    username: str | None = None
    email: EmailStr
    full_name: str | None
    is_active: bool
    roles: list[str] = []
    last_login: datetime | None = None
    must_change_password: bool = False

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str | None = None
    password: str | None = None

class AdminCreateUser(BaseModel):
    username: str | None = None
    email: EmailStr
    full_name: str | None = None
    password: str | None = None

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int | None = None


@router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    # Accept username or email as identifier to ease migration; avoid referencing missing column
    user = None
    if _has_username_column(db):
        user = db.query(User).filter(User.username == data.username).first()
    if not user:
        user = db.query(User).filter(User.email == data.username).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide")
    # update last_login
    try:
        user.last_login = datetime.now(timezone.utc)
        db.add(user); db.commit()
    except Exception:
        pass
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, expires_in=settings.access_token_expire_minutes*60)

@router.post("/auth/refresh", response_model=TokenResponse)
def refresh_token(current: User = Depends(get_current_user)):
    # Simple refresh that issues a new token when the old one is still valid
    token = create_access_token(str(current.id))
    return TokenResponse(access_token=token, expires_in=settings.access_token_expire_minutes*60)

@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return UserOut(id=current.id, username=current.username, email=current.email, full_name=current.full_name, is_active=current.is_active, roles=[r.name for r in current.roles], last_login=current.last_login, must_change_password=bool(getattr(current,'must_change_password',False)))


@router.post('/admin/users/create')
def admin_create_user(data: AdminCreateUser, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    # Admin can provide a password or leave it empty to auto-generate one (returned in response)
    import secrets, string
    def gen_password(n=12):
        alphabet = string.ascii_letters + string.digits + '!@#$%^&*()'
        return ''.join(secrets.choice(alphabet) for _ in range(n))

    username = data.username
    if username is None:
        # derive username from email local part
        username = data.email.split('@',1)[0]
    if _has_username_column(db):
        if db.query(User).filter((User.email == data.email) | (User.username == username)).first():
            raise HTTPException(status_code=400, detail='Username o email già in uso')
    else:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail='Email già in uso')

    pwd = data.password or gen_password(12)
    user = User(username=username, email=data.email, full_name=data.full_name, hashed_password=hash_password(pwd))
    user.must_change_password = True
    db.add(user); db.commit(); db.refresh(user)
    return { 'id': user.id, 'username': user.username, 'email': user.email, 'password': pwd }


@router.post('/admin/users/{user_id}/reset_password')
def admin_reset_user_password(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    import secrets, string
    def gen_password(n=12):
        alphabet = string.ascii_letters + string.digits + '!@#$%^&*()'
        return ''.join(secrets.choice(alphabet) for _ in range(n))
    u = db.query(User).get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail='Utente non trovato')
    pwd = gen_password(12)
    u.hashed_password = hash_password(pwd)
    u.must_change_password = True
    db.add(u); db.commit(); db.refresh(u)
    return {'id': u.id, 'username': u.username, 'password': pwd}


@router.get('/me/permissions')
def me_permissions(current: User = Depends(get_current_user)):
    perms = set()
    for r in current.roles:
        for p in r.permissions:
            perms.add(p.code)
    return {'permissions': sorted(list(perms))}

class DashboardSummary(BaseModel):
    greeting: str
    next_shift: dict | None
    next_public_event: str | None
    maintenance: dict
    my_tasks: dict
    checklists: dict
    recent_documents: list[dict]

@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    # Stubbed summary; will be replaced with real queries
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    next_event = (now + timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
    result = DashboardSummary(
        greeting="Ciao!",
        next_shift={"date": now.date().isoformat(), "time": "15:00-19:00", "role": "Cassa"},
        next_public_event=next_event.isoformat() + "Z",
        maintenance={"open": 5, "high_priority": 2, "link": "/maintenance"},
        my_tasks={"assigned": 3, "due_soon": 1, "link": "/tasks"},
        checklists={"pending_today": 2, "link": "/checklists"},
        recent_documents=[
            {"name": "Procedure sicurezza.pdf", "path": "/documents/1"},
            {"name": "Report manutenzione Zamboni.pdf", "path": "/documents/2"},
            {"name": "Check-list apertura.pdf", "path": "/documents/3"},
        ],
    )
    return result

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/auth/change_password")
def change_password(data: ChangePasswordRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, current.hashed_password):
        raise HTTPException(status_code=400, detail="Password attuale non corretta")
    current.hashed_password = hash_password(data.new_password)
    # clear must_change_password flag on successful change
    try:
        current.must_change_password = False
    except Exception:
        pass
    db.add(current)
    db.commit()
    return {"ok": True}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/auth/forgot_password")
def forgot_password(_: ForgotPasswordRequest):
    # Stub: in futuro invio email con token reset
    return {"ok": True}


@router.post("/users", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    # Admin creates a user; password provided or autogenerated
    import secrets, string
    def gen_password(n=12):
        alphabet = string.ascii_letters + string.digits + '!@#$%^&*()'
        return ''.join(secrets.choice(alphabet) for _ in range(n))

    if _has_username_column(db):
        if db.query(User).filter((User.email == data.email) | (User.username == data.username)).first():
            raise HTTPException(status_code=400, detail="Username o email già in uso")
        pwd = data.password or gen_password(12)
        user = User(username=data.username, email=data.email, full_name=data.full_name, hashed_password=hash_password(pwd))
    else:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email già in uso")
        pwd = data.password or gen_password(12)
        user = User(email=data.email, full_name=data.full_name, hashed_password=hash_password(pwd))
    # If created by admin via this endpoint, ensure user must change password on first login
    user.must_change_password = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(id=user.id, username=user.username, email=user.email, full_name=user.full_name, is_active=user.is_active, roles=[r.name for r in user.roles], last_login=user.last_login, must_change_password=user.must_change_password)


@router.get('/admin/users', response_model=list[UserOut])
def admin_list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.query(User).order_by(User.id.asc()).all()
    return [UserOut(id=u.id, username=u.username, email=u.email, full_name=u.full_name, is_active=u.is_active, roles=[r.name for r in u.roles], last_login=u.last_login, must_change_password=bool(u.must_change_password)) for u in rows]

@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), q: str | None = None, page: int = 1, page_size: int = 50, _: User = Depends(require_admin)):
    # simple search + pagination; if q omitted returns all (compat)
    query = db.query(User)
    if q:
        like = f"%{q.lower()}%"
        from sqlalchemy import func
        if _has_username_column(db):
            query = query.filter(
                func.lower(User.email).like(like) | func.lower(User.full_name).like(like) | func.lower(User.username).like(like)
            )
        else:
            query = query.filter(
                func.lower(User.email).like(like) | func.lower(User.full_name).like(like)
            )
    total = query.count()
    rows = query.order_by(User.id.asc()).offset(max(0, (page-1)*page_size)).limit(page_size).all()
    result: list[UserOut] = []
    for u in rows:
        result.append(UserOut(
            id=u.id, username=u.username, email=u.email, full_name=u.full_name, is_active=u.is_active,
            roles=[r.name for r in u.roles]
        ))
    # backward compatibility: if client expects list, just return items; admin panel can use a new /admin/users endpoint for meta
    return result

class RoleCreate(BaseModel):
    name: str

class PermissionCreate(BaseModel):
    code: str
    description: str | None = None

@router.post("/roles")
def create_role(data: RoleCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(Role).filter(Role.name == data.name).first():
        raise HTTPException(status_code=400, detail="Ruolo già esistente")
    role = Role(name=data.name)
    db.add(role)
    db.commit()
    db.refresh(role)
    return {"id": role.id, "name": role.name}

@router.get("/roles")
def list_roles(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    roles = db.query(Role).all()
    return [{"id": r.id, "name": r.name, "permissions": [p.code for p in r.permissions]} for r in roles]

@router.get("/roles/{role_id}")
def get_role(role_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    role = db.query(Role).get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")
    return {"id": role.id, "name": role.name, "permissions": [p.code for p in role.permissions]}

class RoleUpdate(BaseModel):
    name: str

@router.patch("/roles/{role_id}")
def rename_role(role_id: int, data: RoleUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    role = db.query(Role).get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")
    # ensure name uniqueness
    exists = db.query(Role).filter(Role.name == data.name, Role.id != role_id).first()
    if exists:
        raise HTTPException(status_code=400, detail="Nome ruolo già in uso")
    role.name = data.name
    db.commit(); db.refresh(role)
    return {"id": role.id, "name": role.name}

@router.post("/permissions")
def create_permission(data: PermissionCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(Permission).filter(Permission.code == data.code).first():
        raise HTTPException(status_code=400, detail="Permesso già esistente")
    perm = Permission(code=data.code, description=data.description)
    db.add(perm)
    db.commit()
    db.refresh(perm)
    return {"id": perm.id, "code": perm.code}

@router.get("/permissions")
def list_permissions(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    perms = db.query(Permission).all()
    return [{"id": p.id, "code": p.code, "description": p.description} for p in perms]

class RolePermissionsUpdate(BaseModel):
    permissions: list[str]

@router.put("/roles/{role_id}/permissions")
def set_role_permissions(role_id: int, data: RolePermissionsUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    role = db.query(Role).get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")
    # map codes to Permission instances
    perms = db.query(Permission).filter(Permission.code.in_(data.permissions)).all()
    role.permissions = perms
    db.commit()
    return {"ok": True}

@router.delete("/roles/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    role = db.query(Role).get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")
    db.delete(role)
    db.commit()
    return {"ok": True}

# ---- Skating: ICS upload, events list, clear ----
@router.post("/skating/calendar/upload")
async def upload_ics(file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    # delete existing events
    db.query(SkatingEvent).delete()
    db.commit()
    # parse ICS lines (lightweight parser for VEVENT)
    text = (await file.read()).decode('utf-8', errors='ignore')
    events: list[SkatingEvent] = []
    cur: Dict[str, str] = {}
    in_event = False
    for raw in text.splitlines():
        line = raw.strip()
        if line == 'BEGIN:VEVENT':
            in_event = True
            cur = {}
        elif line == 'END:VEVENT' and in_event:
            title = cur.get('SUMMARY', 'Pattinaggio Pubblico')
            dtstart = cur.get('DTSTART')
            dtend = cur.get('DTEND')
            if dtstart and dtend:
                # basic formats: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
                def parse_dt(v: str) -> datetime:
                    if v.endswith('Z'):
                        v = v[:-1]
                        return datetime.strptime(v, '%Y%m%dT%H%M%S').replace(tzinfo=timezone.utc)
                    return datetime.strptime(v, '%Y%m%dT%H%M%S').replace(tzinfo=timezone.utc)
                start = parse_dt(dtstart)
                end = parse_dt(dtend)
                events.append(SkatingEvent(title=title, start_time=start, end_time=end))
            in_event = False
        elif in_event and ':' in line:
            k, v = line.split(':', 1)
            k = k.split(';', 1)[0]
            cur[k] = v
    for e in events:
        db.add(e)
    db.commit()
    return {"imported": len(events)}

@router.get("/skating/events")
def list_skating_events(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(SkatingEvent).order_by(SkatingEvent.start_time.asc()).all()
    return [
        {"id": r.id, "title": r.title, "start_time": r.start_time.isoformat(), "end_time": r.end_time.isoformat()}
        for r in rows
    ]

@router.delete("/skating/calendar")
def clear_skating_calendar(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    db.query(SkatingEvent).delete()
    db.commit()
    return {"ok": True}

# ---- WebSocket Rooms and Command Broker ----
class WSManager:
    def __init__(self) -> None:
        self.rooms: Dict[str, Set[WebSocket]] = {
            'control': set(),
            'player': set(),
            'display': set(),
            'game': set(),
        }
        self.lock = asyncio.Lock()

    async def connect(self, room: str, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.rooms.setdefault(room, set()).add(ws)

    async def disconnect(self, room: str, ws: WebSocket):
        async with self.lock:
            if room in self.rooms and ws in self.rooms[room]:
                self.rooms[room].remove(ws)

    async def broadcast(self, room: str, message: dict):
        async with self.lock:
            targets = list(self.rooms.get(room, set()))
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                try:
                    await ws.close()
                except Exception:
                    pass

ws_manager = WSManager()

@router.websocket("/ws/{room}")
async def ws_endpoint(ws: WebSocket, room: str):
    await ws_manager.connect(room, ws)
    try:
        while True:
            data = await ws.receive_json()
            # echo back ack if needed
            await ws.send_json({"ok": True})
    except WebSocketDisconnect:
        await ws_manager.disconnect(room, ws)

class Command(BaseModel):
    type: str
    payload: dict | None = None

@router.post("/skating/command/{target}")
async def send_command(target: str, cmd: Command, _: User = Depends(require_admin)):
    # target: 'player' or 'display'
    if target not in ('player', 'display'):
        raise HTTPException(status_code=400, detail="Target non valido")
    await ws_manager.broadcast(target, {"type": cmd.type, "payload": cmd.payload or {}})
    return {"ok": True}

# ---- Automation Task ----
async def skating_scheduler():
    while True:
        # every minute
        await asyncio.sleep(60)
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)
            soon = now + timedelta(minutes=15)
            pending = (
                db.query(SkatingEvent)
                .filter(SkatingEvent.start_time <= soon)
                .filter(SkatingEvent.start_time > now)
                .all()
            )
            for ev in pending:
                if not ev.jingle_trigger_sent:
                    await ws_manager.broadcast('player', {"type": "playJingle", "payload": {"eventId": ev.id}})
                    ev.jingle_trigger_sent = True
                if not ev.obs_trigger_sent:
                    await ws_manager.broadcast('control', {"type": "obsScene", "payload": {"scene": "Live"}})
                    ev.obs_trigger_sent = True
                if not ev.display_timer_trigger_sent:
                    remaining = int((ev.start_time - now).total_seconds())
                    await ws_manager.broadcast('display', {"type": "showView", "payload": {"view": "timer", "seconds": remaining}})
                    ev.display_timer_trigger_sent = True
            db.commit()
        except Exception:
            pass
        finally:
            try:
                db.close()
            except Exception:
                pass

class UserUpdate(BaseModel):
    full_name: str | None = None
    is_active: bool | None = None

class UserRolesUpdate(BaseModel):
    role_ids: list[int]

@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, is_active=user.is_active, roles=[r.name for r in user.roles])

class ResetPasswordRequest(BaseModel):
    new_password: str

@router.post("/admin/users/{user_id}/reset_password")
def admin_reset_password(user_id: int, data: ResetPasswordRequest, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    user.hashed_password = hash_password(data.new_password)
    db.add(user); db.commit(); return {"ok": True}

@router.put("/users/{user_id}/roles")
def set_user_roles(user_id: int, data: UserRolesUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
    user.roles = roles
    db.commit()
    return {"ok": True}

# ===================== TASKS (To-Do) =====================
from datetime import date as _date

class TaskOut(BaseModel):
    id: int
    title: str
    description: str | None
    priority: str
    due_date: _date | None
    completed: bool
    assignees: list[int]
    creator_id: int
    created_at: datetime
    is_recurring: bool = False
    recurrence_pattern: str | None = None
    recurrence_interval: int | None = None
    recurrence_end_date: _date | None = None
    parent_task_id: int | None = None

    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    priority: str = 'medium'
    due_date: _date | None = None
    assignee_ids: list[int] = []
    is_recurring: bool = False
    recurrence_pattern: str | None = None  # daily|weekly|monthly
    recurrence_interval: int | None = 1
    recurrence_end_date: _date | None = None

class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    due_date: _date | None = None
    completed: bool | None = None

class TaskCommentCreate(BaseModel):
    content: str

@router.get("/tasks", response_model=list[TaskOut])
def tasks_list(view: str = 'mine', db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    q = db.query(Task)
    if view == 'mine':
        q = q.filter(Task.assignees.any(id=current.id))
    elif view == 'overdue':
        q = q.filter(Task.completed == False).filter(Task.due_date != None).filter(Task.due_date < datetime.utcnow().date())
    elif view == 'completed':
        q = q.filter(Task.completed == True)
    # else 'all'
    try:
        from sqlalchemy import nullslast
        q = q.order_by(Task.completed.asc(), nullslast(Task.due_date.asc()), Task.created_at.desc())
    except Exception:
        # Fallback if nullslast not available
        q = q.order_by(Task.completed.asc(), Task.due_date.asc(), Task.created_at.desc())
    rows = q.all()
    result: list[TaskOut] = []
    for t in rows:
        result.append(TaskOut(
            id=t.id, title=t.title, description=t.description, priority=t.priority, due_date=t.due_date,
            completed=t.completed, assignees=[u.id for u in t.assignees], creator_id=t.creator_id, created_at=t.created_at
        ))
    return result

@router.post("/tasks", response_model=TaskOut, status_code=201)
async def tasks_create(data: TaskCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    task = Task(
        title=data.title, 
        description=data.description, 
        priority=data.priority, 
        due_date=data.due_date, 
        creator_id=current.id,
        is_recurring=data.is_recurring,
        recurrence_pattern=data.recurrence_pattern if data.is_recurring else None,
        recurrence_interval=data.recurrence_interval if data.is_recurring else None,
        recurrence_end_date=data.recurrence_end_date if data.is_recurring else None
    )
    if data.assignee_ids:
        users = db.query(User).filter(User.id.in_(data.assignee_ids)).all()
        task.assignees = users
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Send notifications to assigned users
    for assignee in task.assignees:
        await send_notification(
            assignee.id, 
            f"Nuovo incarico assegnato: {task.title}",
            "info",
            {"task_id": task.id, "priority": task.priority}
        )
    
    return TaskOut(
        id=task.id, title=task.title, description=task.description, priority=task.priority, due_date=task.due_date,
        completed=task.completed, assignees=[u.id for u in task.assignees], creator_id=task.creator_id, created_at=task.created_at,
        is_recurring=task.is_recurring, recurrence_pattern=task.recurrence_pattern, 
        recurrence_interval=task.recurrence_interval, recurrence_end_date=task.recurrence_end_date,
        parent_task_id=task.parent_task_id
    )

@router.get("/tasks/{task_id}", response_model=TaskOut)
def tasks_get(task_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    t = db.query(Task).get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Incarico non trovato")
    return TaskOut(
        id=t.id, title=t.title, description=t.description, priority=t.priority, due_date=t.due_date,
        completed=t.completed, assignees=[u.id for u in t.assignees], creator_id=t.creator_id, created_at=t.created_at,
        is_recurring=t.is_recurring, recurrence_pattern=t.recurrence_pattern,
        recurrence_interval=t.recurrence_interval, recurrence_end_date=t.recurrence_end_date,
        parent_task_id=t.parent_task_id
    )

@router.patch("/tasks/{task_id}", response_model=TaskOut)
def tasks_update(task_id: int, data: TaskUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    t = db.query(Task).get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Incarico non trovato")
    if data.title is not None:
        t.title = data.title
    if data.description is not None:
        t.description = data.description
    if data.priority is not None:
        t.priority = data.priority
    if data.due_date is not None:
        t.due_date = data.due_date
    if data.completed is not None:
        t.completed = data.completed
    db.commit()
    db.refresh(t)
    return TaskOut(
        id=t.id, title=t.title, description=t.description, priority=t.priority, due_date=t.due_date,
        completed=t.completed, assignees=[u.id for u in t.assignees], creator_id=t.creator_id, created_at=t.created_at
    )

class TaskAssigneesUpdate(BaseModel):
    user_ids: list[int]

@router.put("/tasks/{task_id}/assignees")
def tasks_set_assignees(task_id: int, data: TaskAssigneesUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    t = db.query(Task).get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Incarico non trovato")
    users = db.query(User).filter(User.id.in_(data.user_ids)).all()
    t.assignees = users
    db.commit()
    return {"ok": True}

@router.post("/tasks/{task_id}/comments")
def tasks_add_comment(task_id: int, data: TaskCommentCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    t = db.query(Task).get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Incarico non trovato")
    c = TaskComment(task_id=task_id, author_id=current.id, content=data.content)
    db.add(c)
    db.commit()
    return {"ok": True}

class TaskCommentOut(BaseModel):
    id: int
    task_id: int
    author_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/tasks/{task_id}/comments", response_model=list[TaskCommentOut])
def tasks_list_comments(task_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    t = db.query(Task).get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Incarico non trovato")
    rows = db.query(TaskComment).filter(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc()).all()
    return [TaskCommentOut.model_validate(r) for r in rows]

# Task attachments
@router.get('/tasks/{task_id}/attachments')
def task_attachments_list(task_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task non trovato")
    atts = db.query(TaskAttachment).filter(TaskAttachment.task_id == task_id).all()
    return {"items": [{"id": a.id, "file_name": a.file_name, "uploaded_at": a.uploaded_at.isoformat()} for a in atts]}

@router.post('/tasks/{task_id}/attachments')
def task_attachments_upload(task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task non trovato")
    base = os.path.join(settings.storage_path, 'tasks', str(task_id))
    os.makedirs(base, exist_ok=True)
    dest = os.path.join(base, file.filename or 'unnamed')
    with open(dest, 'wb') as fh:
        shutil.copyfileobj(file.file, fh)
    att = TaskAttachment(task_id=task_id, file_name=file.filename or 'unnamed', file_path=dest)
    db.add(att)
    db.commit()
    return {"id": att.id, "file_name": att.file_name}

@router.get('/tasks/attachments/{att_id}')
def task_attachments_download(att_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    att = db.query(TaskAttachment).get(att_id)
    if not att or not os.path.exists(att.file_path):
        raise HTTPException(status_code=404, detail="Allegato non trovato")
    return FileResponse(att.file_path, filename=att.file_name)

@router.delete('/tasks/attachments/{att_id}')
def task_attachments_delete(att_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    att = db.query(TaskAttachment).get(att_id)
    if not att:
        raise HTTPException(status_code=404, detail="Allegato non trovato")
    if os.path.exists(att.file_path):
        os.remove(att.file_path)
    db.delete(att)
    db.commit()
    return {"ok": True}

# ===================== TICKETS (Maintenance/Kanban) =====================
class TicketOut(BaseModel):
    id: int
    title: str
    description: str | None
    category: str
    priority: str
    status: str
    creator_id: int
    assignee_id: int | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TicketCreate(BaseModel):
    title: str
    description: str | None = None
    category: str = 'Generale'
    priority: str = 'medium'
    assignee_id: int | None = None

class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    priority: str | None = None
    assignee_id: int | None = None

class TicketMoveRequest(BaseModel):
    status: str  # open|in_progress|resolved

class TicketCommentCreate(BaseModel):
    content: str

class TicketCommentOut(BaseModel):
    id: int
    ticket_id: int
    author_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

@router.get('/tickets', response_model=list[TicketOut])
def tickets_list(status: str | None = None, category: str | None = None, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    q = db.query(Ticket)
    if status in ('open','in_progress','resolved'):
        q = q.filter(Ticket.status == status)
    if category:
        q = q.filter(Ticket.category == category)
    q = q.order_by(Ticket.priority.desc(), Ticket.created_at.asc())
    rows = q.all()
    return [TicketOut.model_validate(r) for r in rows]

@router.post('/tickets', response_model=TicketOut)
def tickets_create(data: TicketCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    t = Ticket(title=data.title, description=data.description, category=data.category, priority=data.priority, creator_id=current.id, assignee_id=data.assignee_id)
    db.add(t)
    db.commit()
    db.refresh(t)
    # history
    h = TicketStatusHistory(ticket_id=t.id, from_status=None, to_status=t.status, changed_by=current.id)
    db.add(h)
    db.commit()
    return TicketOut.model_validate(t)

@router.get('/tickets/{ticket_id}', response_model=TicketOut)
def tickets_get(ticket_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    t = db.query(Ticket).get(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail='Ticket non trovato')
    return TicketOut.model_validate(t)

@router.patch('/tickets/{ticket_id}', response_model=TicketOut)
def tickets_update(ticket_id: int, data: TicketUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    t = db.query(Ticket).get(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail='Ticket non trovato')
    changed = False
    if data.title is not None:
        t.title = data.title; changed = True
    if data.description is not None:
        t.description = data.description; changed = True
    if data.category is not None:
        t.category = data.category; changed = True
    if data.priority is not None:
        t.priority = data.priority; changed = True
    if data.assignee_id is not None:
        t.assignee_id = data.assignee_id; changed = True
    if changed:
        t.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(t)
    return TicketOut.model_validate(t)

@router.post('/tickets/{ticket_id}/move', response_model=TicketOut)
def tickets_move(ticket_id: int, req: TicketMoveRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if req.status not in ('open','in_progress','resolved'):
        raise HTTPException(status_code=400, detail='Stato non valido')
    t = db.query(Ticket).get(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail='Ticket non trovato')
    old = t.status
    if old == req.status:
        return TicketOut.model_validate(t)
    t.status = req.status
    t.updated_at = datetime.now(timezone.utc)
    db.add(TicketStatusHistory(ticket_id=t.id, from_status=old, to_status=req.status, changed_by=current.id))
    db.commit()
    # Auto-generate a PDF report when resolved
    if req.status == 'resolved':
        try:
            folder_id = ensure_archive_path(db, 'Manutenzione')
            headers = ['ID', 'Titolo', 'Categoria', 'Priorità', 'Autore', 'Assegnato a', 'Creato', 'Chiuso']
            row = [
                str(t.id), t.title or '', t.category or '', t.priority or '',
                str(t.creator_id), str(t.assignee_id or ''),
                (t.created_at.isoformat() if t.created_at else ''), (t.updated_at.isoformat() if t.updated_at else '')
            ]
            footer = (db.query(AppSetting).filter(AppSetting.key == 'pdf.footer').first() or type('x',(),{'value':None}))
            pdf = render_pdf_bytes(
                title='Ticket Risolto',
                subtitle=f"Ticket #{t.id}",
                table_headers=headers,
                table_rows=[row],
                logo_path=settings.report_logo_path,
                footer_text=getattr(footer,'value',None),
            )
            fname = f"Ticket_{t.id:06d}.pdf"
            save_pdf_to_archive(db, folder_id, fname, pdf, author_id=current.id)
        except Exception:
            # don't block main flow on PDF errors
            pass
    db.refresh(t)
    return TicketOut.model_validate(t)

@router.get('/tickets/{ticket_id}/comments', response_model=list[TicketCommentOut])
def tickets_comments(ticket_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.query(TicketComment).filter(TicketComment.ticket_id == ticket_id).order_by(TicketComment.created_at.asc()).all()
    return [TicketCommentOut.model_validate(r) for r in rows]

@router.post('/tickets/{ticket_id}/comments')
def tickets_add_comment(ticket_id: int, data: TicketCommentCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    t = db.query(Ticket).get(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail='Ticket non trovato')
    c = TicketComment(ticket_id=ticket_id, author_id=current.id, content=data.content)
    db.add(c)
    db.commit()
    return {"ok": True}

# ===================== DOCUMENTS (Archive) =====================
class FolderOut(BaseModel):
    id: int
    name: str
    parent_id: int | None

    class Config:
        from_attributes = True

class DocumentOut(BaseModel):
    id: int
    name: str
    folder_id: int | None
    created_at: datetime
    updated_at: datetime
    latest_version: int | None = None

    class Config:
        from_attributes = True

class FolderCreate(BaseModel):
    name: str
    parent_id: int | None = None

class RenameRequest(BaseModel):
    name: str

class MoveRequest(BaseModel):
    folder_id: int | None

class VersionOut(BaseModel):
    id: int
    version: int
    file_name: str
    mime_type: str | None
    size: int | None
    author_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True

def _ensure_root(db: Session):
    if not db.query(Folder).first():
        db.add(Folder(name='Documenti', parent_id=None))
        db.commit()

def _folder_breadcrumb(db: Session, folder_id: int | None) -> list[dict]:
    trail: list[dict] = []
    cur = folder_id
    while cur is not None:
        f = db.query(Folder).get(cur)
        if not f: break
        trail.append({"id": f.id, "name": f.name, "parent_id": f.parent_id})
        cur = f.parent_id
    trail.reverse()
    return trail

@router.get('/documents/folders', response_model=list[FolderOut])
def documents_folders(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _ensure_root(db)
    rows = db.query(Folder).order_by(Folder.name.asc()).all()
    return [FolderOut.model_validate(f) for f in rows]

@router.post('/documents/folders', response_model=FolderOut)
def documents_create_folder(data: FolderCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = Folder(name=data.name, parent_id=data.parent_id)
    db.add(f)
    db.commit()
    db.refresh(f)
    return FolderOut.model_validate(f)

@router.post('/documents/folders/{folder_id}/rename')
def documents_rename_folder(folder_id: int, data: RenameRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = db.query(Folder).get(folder_id)
    if not f:
        raise HTTPException(status_code=404, detail='Cartella non trovata')
    f.name = data.name
    db.commit(); return {"ok": True}

@router.delete('/documents/folders/{folder_id}')
def documents_delete_folder(folder_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = db.query(Folder).get(folder_id)
    if not f:
        return {"ok": True}
    # only allow delete if empty
    has_sub = db.query(Folder).filter(Folder.parent_id == folder_id).first() is not None
    has_docs = db.query(Document).filter(Document.folder_id == folder_id).first() is not None
    if has_sub or has_docs:
        raise HTTPException(status_code=400, detail='La cartella non è vuota')
    db.delete(f); db.commit(); return {"ok": True}

@router.get('/documents/contents')
def documents_list(folder_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _ensure_root(db)
    qf = db.query(Folder).filter(Folder.parent_id == folder_id)
    qd = db.query(Document).filter(Document.folder_id == folder_id)
    folders = [FolderOut.model_validate(f) for f in qf.all()]
    docs = []
    for d in qd.all():
        latest = db.query(DocumentVersion).filter(DocumentVersion.document_id == d.id).order_by(DocumentVersion.version.desc()).first()
        docs.append({
            'id': d.id, 'name': d.name, 'folder_id': d.folder_id,
            'created_at': d.created_at, 'updated_at': d.updated_at,
            'latest_version': latest.version if latest else None,
        })
    breadcrumb = _folder_breadcrumb(db, folder_id)
    return {'folders': folders, 'documents': docs, 'breadcrumb': breadcrumb}

@router.post('/documents/upload')
def documents_upload(folder_id: int | None = None, file: UploadFile = File(...), db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    # create or append new version
    storage = settings.storage_path
    os.makedirs(storage, exist_ok=True)
    # find or create document
    name = file.filename or 'file'
    doc = db.query(Document).filter(Document.folder_id == folder_id, Document.name == name).first()
    if not doc:
        doc = Document(name=name, folder_id=folder_id)
        db.add(doc); db.commit(); db.refresh(doc)
    latest = db.query(DocumentVersion).filter(DocumentVersion.document_id == doc.id).order_by(DocumentVersion.version.desc()).first()
    next_ver = (latest.version + 1) if latest else 1
    file_name = f"{doc.id}_v{next_ver}_{name}"
    file_path = os.path.join(storage, file_name)
    with open(file_path, 'wb') as f:
        shutil.copyfileobj(file.file, f)
    ver = DocumentVersion(document_id=doc.id, version=next_ver, file_name=name, file_path=file_path, mime_type=file.content_type, size=None, author_id=current.id)
    doc.updated_at = datetime.now(timezone.utc)
    db.add(ver); db.add(doc); db.commit()
    return {"ok": True, "document_id": doc.id, "version": next_ver}

@router.post('/documents/{document_id}/rename')
def documents_rename(document_id: int, data: RenameRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = db.query(Document).get(document_id)
    if not d:
        raise HTTPException(status_code=404, detail='Documento non trovato')
    d.name = data.name
    d.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(d)
    return {"ok": True}

@router.post('/documents/{document_id}/move')
def documents_move(document_id: int, data: MoveRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = db.query(Document).get(document_id)
    if not d:
        raise HTTPException(status_code=404, detail='Documento non trovato')
    d.folder_id = data.folder_id
    d.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(d)
    return {"ok": True}

@router.delete('/documents/{document_id}')
def documents_delete(document_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = db.query(Document).get(document_id)
    if not d:
        return {"ok": True}
    # optional: also remove files from storage
    vers = db.query(DocumentVersion).filter(DocumentVersion.document_id == d.id).all()
    for v in vers:
        try:
            if os.path.exists(v.file_path): os.remove(v.file_path)
        except Exception:
            pass
    db.delete(d)
    db.commit()
    return {"ok": True}

@router.get('/documents/{document_id}/versions', response_model=list[VersionOut])
def documents_versions(document_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(DocumentVersion).filter(DocumentVersion.document_id == document_id).order_by(DocumentVersion.version.desc()).all()
    return [VersionOut.model_validate(r) for r in rows]

@router.get('/documents/versions/{version_id}')
def documents_get_version(version_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    v = db.query(DocumentVersion).get(version_id)
    if not v:
        raise HTTPException(status_code=404, detail='Versione non trovata')
    disposition = 'inline'
    filename = v.file_name
    return FileResponse(v.file_path, media_type=v.mime_type or 'application/octet-stream', filename=filename, headers={"Content-Disposition": f"{disposition}; filename=\"{filename}\""})

@router.get('/documents/search')
def documents_search(q: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from sqlalchemy import func
    like = f"%{q.lower()}%"
    rows = db.query(Document).filter(func.lower(Document.name).like(like)).order_by(Document.updated_at.desc()).limit(100).all()
    results = []
    for d in rows:
        results.append({
            'id': d.id,
            'name': d.name,
            'folder_id': d.folder_id,
            'breadcrumb': _folder_breadcrumb(db, d.folder_id),
            'updated_at': d.updated_at,
        })
    return {'items': results}

# ===================== ADMIN: SETTINGS & AUDIT =====================
class SettingItem(BaseModel):
    key: str
    value: str

@router.get('/admin/settings', response_model=list[SettingItem])
def admin_settings_list(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.query(AppSetting).order_by(AppSetting.key.asc()).all()
    return [SettingItem(key=r.key, value=r.value) for r in rows]

@router.put('/admin/settings')
def admin_settings_set(items: list[SettingItem], db: Session = Depends(get_db), current: User = Depends(require_admin)):
    for it in items:
        row = db.query(AppSetting).filter(AppSetting.key == it.key).first()
        if row:
            row.value = it.value
        else:
            db.add(AppSetting(key=it.key, value=it.value))
    db.add(AuditLog(user_id=current.id, action='settings.update', details=f"{len(items)} items"))
    db.commit()
    return {"ok": True}


# OBS integration endpoints (best-effort: requires obs-websocket client lib on server)
class ObsConfig(BaseModel):
    host: str
    port: int = 4455
    password: str | None = None

@router.put('/admin/obs/config')
def admin_obs_config(data: ObsConfig, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    # store as app settings
    kv = { 'obs.host': data.host, 'obs.port': str(data.port), 'obs.password': data.password or '' }
    for k,v in kv.items():
        row = db.query(AppSetting).filter(AppSetting.key==k).first()
        if row: row.value = v
        else: db.add(AppSetting(key=k, value=v))
    db.add(AuditLog(user_id=current.id, action='obs.config', details=f"{data.host}:{data.port}"))
    db.commit()
    return { 'ok': True }


@router.get('/admin/obs/scan')
def admin_obs_scan(db: Session = Depends(get_db), current: User = Depends(require_admin)):
    # Try to import obs-websocket library and connect to list scenes.
    try:
        from obswebsocket import obsws, requests as obsreq  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=501, detail=f"obs-websocket client not available on server: {e}")
    # read config
    host = _get_setting_value(db, 'obs.host', '') or ''
    port = int(_get_setting_value(db, 'obs.port', '4455') or '4455')
    pwd = _get_setting_value(db, 'obs.password', '') or ''
    try:
        ws = obsws(host, port, pwd)
        ws.connect()
        resp = ws.call(obsreq.GetSceneList())
        scenes = [s['sceneName'] for s in resp.getScenes()]
        ws.disconnect()
        return {'scenes': scenes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Connection failed: {e}')

class AuditOut(BaseModel):
    id: int
    timestamp: datetime
    user_id: int | None
    action: str
    details: str | None

    class Config:
        from_attributes = True

@router.get('/admin/audit', response_model=list[AuditOut])
def admin_audit_list(q: str | None = None, limit: int = 200, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if q:
        from sqlalchemy import func
        like = f"%{q.lower()}%"
        query = query.filter(func.lower(AuditLog.action).like(like) | func.lower(AuditLog.details).like(like))
    rows = query.limit(limit).all()
    return [AuditOut.model_validate(r) for r in rows]

# Branding & PDF footer text
class BrandingUpdate(BaseModel):
    pdf_footer_text: str | None = None

@router.post('/admin/branding')
def admin_branding_set(data: BrandingUpdate, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    if data.pdf_footer_text is not None:
        row = db.query(AppSetting).filter(AppSetting.key == 'pdf.footer').first()
        if row:
            row.value = data.pdf_footer_text
        else:
            db.add(AppSetting(key='pdf.footer', value=data.pdf_footer_text))
    db.add(AuditLog(user_id=current.id, action='branding.update', details='pdf.footer'))
    db.commit(); return {"ok": True}

# Skating audio file manager (simple storage under /app/storage/audio/skating)

@router.get('/admin/skating/audio')
def skating_audio_list(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'audio', 'skating')
    os.makedirs(base, exist_ok=True)
    items = []
    for name in sorted(os.listdir(base)):
        p = os.path.join(base, name)
        if os.path.isfile(p):
            items.append({"name": name, "size": os.path.getsize(p)})
    return {"items": items}

@router.post('/admin/skating/audio/upload')
def skating_audio_upload(file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'audio', 'skating')
    os.makedirs(base, exist_ok=True)
    name = file.filename or 'audio'
    dest = os.path.join(base, name)
    with open(dest, 'wb') as fh:
        shutil.copyfileobj(file.file, fh)
    return {"ok": True}

class RenameAudio(BaseModel):
    new_name: str

@router.post('/admin/skating/audio/{name}/rename')
def skating_audio_rename(name: str, data: RenameAudio, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'audio', 'skating')
    src = os.path.join(base, name)
    dst = os.path.join(base, data.new_name)
    if not os.path.exists(src):
        raise HTTPException(status_code=404, detail='File non trovato')
    if os.path.exists(dst):
        raise HTTPException(status_code=400, detail='Nome già in uso')
    os.rename(src, dst); return {"ok": True}

@router.delete('/admin/skating/audio/{name}')
def skating_audio_delete(name: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'audio', 'skating')
    path = os.path.join(base, name)
    try:
        if os.path.exists(path): os.remove(path)
    except Exception:
        pass
    return {"ok": True}


# ===================== REPORTS (Generic PDF generation) =====================
class ReportRequest(BaseModel):
    module: str  # es. "Manutenzione", "Turni", "Pattinaggio"
    title: str
    subtitle: str | None = None
    headers: list[str] | None = None
    rows: list[list[str]] = []
    file_name: str | None = None

@router.post('/reports/generate')
def reports_generate(data: ReportRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    folder_id = ensure_archive_path(db, data.module)
    footer = (db.query(AppSetting).filter(AppSetting.key == 'pdf.footer').first() or type('x',(),{'value':None}))
    pdf = render_pdf_bytes(
        title=data.title,
        subtitle=data.subtitle,
        table_headers=data.headers,
        table_rows=data.rows,
        logo_path=settings.report_logo_path,
        footer_text=getattr(footer,'value',None),
    )
    name = data.file_name or f"Report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"
    ver = save_pdf_to_archive(db, folder_id, name, pdf, author_id=current.id)
    return {"ok": True, "folder_id": folder_id, "file": name, "version": ver}

# ===================== ANALYTICS & BACKUP =====================
class BackupResponse(BaseModel):
    file_name: str
    size: int

@router.get('/admin/analytics/summary')
def analytics_summary(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return {
        "tickets": db.query(Ticket).count(),
        "tickets_open": db.query(Ticket).filter(Ticket.status=='open').count(),
        "tasks": db.query(Task).count(),
        "documents": db.query(Document).count(),
        "users": db.query(User).count(),
    }

@router.post('/admin/backup/create', response_model=BackupResponse)
def backup_create(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    # Simple pg_dump to storage/backups with timestamped filename
    os.makedirs(settings.storage_path, exist_ok=True)
    backup_dir = os.path.join(settings.storage_path, 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    file_name = f'backup_{ts}.sql'
    dest = os.path.join(backup_dir, file_name)
    url = settings.database_url
    import subprocess
    try:
        subprocess.run(['pg_dump', url, '-f', dest], check=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {e}")
    size = os.path.getsize(dest)
    return {"file_name": file_name, "size": size}

# ===================== SHIFTS (Scheduling) =====================
class ShiftOut(BaseModel):
    id: int
    user_id: int
    role: str
    start_time: datetime
    end_time: datetime
    created_by: int

    class Config:
        from_attributes = True

class ShiftCreate(BaseModel):
    user_id: int
    role: str
    start_time: datetime
    end_time: datetime
    repeat_weekly: bool = False
    repeat_until: datetime | None = None

class ShiftUpdate(BaseModel):
    user_id: int | None = None
    role: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None

@router.get('/shifts', response_model=list[ShiftOut])
def shifts_list(start: datetime, end: datetime, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Shift).filter(Shift.start_time < end, Shift.end_time > start).order_by(Shift.start_time.asc()).all()
    return [ShiftOut.model_validate(r) for r in rows]

@router.post('/shifts', response_model=list[ShiftOut])
def shifts_create(data: ShiftCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    created: list[Shift] = []
    def _add(s: datetime, e: datetime):
        sh = Shift(user_id=data.user_id, role=data.role, start_time=s, end_time=e, created_by=current.id)
        db.add(sh); db.commit(); db.refresh(sh); created.append(sh)
    _add(data.start_time, data.end_time)
    if data.repeat_weekly and data.repeat_until:
        cur_s, cur_e = data.start_time, data.end_time
        from datetime import timedelta
        while True:
            cur_s = cur_s + timedelta(days=7)
            cur_e = cur_e + timedelta(days=7)
            if cur_s > data.repeat_until: break
            _add(cur_s, cur_e)
    return [ShiftOut.model_validate(s) for s in created]

@router.patch('/shifts/{shift_id}', response_model=ShiftOut)
def shifts_update(shift_id: int, data: ShiftUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    sh = db.query(Shift).get(shift_id)
    if not sh: raise HTTPException(status_code=404, detail='Turno non trovato')
    if data.user_id is not None: sh.user_id = data.user_id
    if data.role is not None: sh.role = data.role
    if data.start_time is not None: sh.start_time = data.start_time
    if data.end_time is not None: sh.end_time = data.end_time
    sh.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(sh)
    return ShiftOut.model_validate(sh)

@router.delete('/shifts/{shift_id}')
def shifts_delete(shift_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    sh = db.query(Shift).get(shift_id)
    if not sh: return {"ok": True}
    db.delete(sh); db.commit(); return {"ok": True}

@router.get('/my/shifts', response_model=list[ShiftOut])
def my_shifts(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    rows = db.query(Shift).filter(Shift.user_id == current.id, Shift.end_time >= now).order_by(Shift.start_time.asc()).all()
    return [ShiftOut.model_validate(r) for r in rows]

class AvailabilityBlockIn(BaseModel):
    weekday: int
    start_minute: int
    end_minute: int
    available: bool

@router.get('/availability', response_model=list[AvailabilityBlockIn])
def availability_get(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.query(AvailabilityBlock).filter(AvailabilityBlock.user_id == current.id).order_by(AvailabilityBlock.weekday.asc(), AvailabilityBlock.start_minute.asc()).all()
    return [AvailabilityBlockIn.model_validate(r) for r in rows]

@router.put('/availability')
def availability_set(items: list[AvailabilityBlockIn], db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    db.query(AvailabilityBlock).filter(AvailabilityBlock.user_id == current.id).delete()
    for it in items:
        db.add(AvailabilityBlock(user_id=current.id, weekday=it.weekday, start_minute=it.start_minute, end_minute=it.end_minute, available=it.available))
    db.commit(); return {"ok": True}

class SwapRequestOut(BaseModel):
    id: int
    shift_id: int
    requester_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

@router.post('/shifts/{shift_id}/swap', response_model=SwapRequestOut)
def swap_request(shift_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    sh = db.query(Shift).get(shift_id)
    if not sh: raise HTTPException(status_code=404, detail='Turno non trovato')
    req = ShiftSwapRequest(shift_id=shift_id, requester_id=current.id)
    db.add(req); db.commit(); db.refresh(req)
    return SwapRequestOut.model_validate(req)

@router.get('/shifts/swaps', response_model=list[SwapRequestOut])
def swaps_list(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(ShiftSwapRequest).order_by(ShiftSwapRequest.created_at.desc()).all()
    return [SwapRequestOut.model_validate(r) for r in rows]

class SwapDecision(BaseModel):
    approve: bool

@router.post('/shifts/swaps/{req_id}/decide')
def swap_decide(req_id: int, data: SwapDecision, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    req = db.query(ShiftSwapRequest).get(req_id)
    if not req: raise HTTPException(status_code=404, detail='Richiesta non trovata')
    req.status = 'approved' if data.approve else 'denied'
    req.decided_by = current.id
    req.decided_at = datetime.now(timezone.utc)
    db.commit(); return {"ok": True}

# ===================== GAME (Match Control & Scoreboard) =====================

class Penalty(BaseModel):
    id: int
    team: str  # 'home' | 'away'
    player_number: str
    remaining: int  # seconds

class GameState(BaseModel):
    home_name: str = "Casa"
    away_name: str = "Ospiti"
    period_duration_seconds: int = 20*60
    interval_duration_seconds: int = 15*60
    period_index: int = 1  # 1,2,3,4(OT)
    color_home: str = "#ff4444"
    color_away: str = "#44aaff"
    score_home: int = 0
    score_away: int = 0
    shots_home: int = 0
    shots_away: int = 0
    timeout_remaining: int = 0  # seconds, 0 when no timeout running
    siren_on: bool = False
    siren_every_minute: bool = False
    obs_visible: bool = True
    timer_running: bool = False
    timer_remaining: int = 20*60
    in_interval: bool = False
    penalties: List[Penalty] = []

    def period_label(self) -> str:
        return "OT" if self.period_index >= 4 else f"{self.period_index}°"

game_state = GameState()
game_lock = asyncio.Lock()
_penalty_id_seq = 1

def _snapshot_state() -> dict:
    return {
        "homeName": game_state.home_name,
        "awayName": game_state.away_name,
        "colorHome": game_state.color_home,
        "colorAway": game_state.color_away,
        "scoreHome": game_state.score_home,
        "scoreAway": game_state.score_away,
        "shotsHome": game_state.shots_home,
        "shotsAway": game_state.shots_away,
        "period": game_state.period_label(),
        "periodIndex": game_state.period_index,
        "timerRunning": game_state.timer_running,
        "timerRemaining": game_state.timer_remaining,
    "inInterval": game_state.in_interval,
        "periodDuration": game_state.period_duration_seconds,
        "intervalDuration": game_state.interval_duration_seconds,
        "timeoutRemaining": game_state.timeout_remaining,
        "sirenOn": game_state.siren_on,
        "sirenEveryMinute": game_state.siren_every_minute,
        "obsVisible": game_state.obs_visible,
        "penalties": [p.model_dump() for p in game_state.penalties],
    }

class GameSetupRequest(BaseModel):
    home_name: str
    away_name: str
    period_duration: str  # "MM:SS"
    interval_duration: str | None = None  # "MM:SS"
    color_home: str | None = None
    color_away: str | None = None
    siren_every_minute: bool | None = None

def _parse_mmss(v: str) -> int:
    try:
        m, s = v.split(':')
        return int(m)*60 + int(s)
    except Exception:
        raise HTTPException(status_code=400, detail="Formato durata non valido (usa MM:SS)")

@router.post("/game/setup")
async def game_setup(data: GameSetupRequest, _: User = Depends(require_permission('game.control'))):
    global game_state
    async with game_lock:
        secs = _parse_mmss(data.period_duration)
        game_state.home_name = data.home_name
        game_state.away_name = data.away_name
        game_state.period_duration_seconds = secs
        if data.interval_duration:
            game_state.interval_duration_seconds = _parse_mmss(data.interval_duration)
        if data.color_home:
            game_state.color_home = data.color_home
        if data.color_away:
            game_state.color_away = data.color_away
        if data.siren_every_minute is not None:
            game_state.siren_every_minute = bool(data.siren_every_minute)
        game_state.period_index = 1
        game_state.score_home = 0
        game_state.score_away = 0
        game_state.timer_running = False
        game_state.in_interval = False
        game_state.timer_remaining = secs
        game_state.penalties = []
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True}

class GameConfigPatch(BaseModel):
    home_name: str | None = None
    away_name: str | None = None
    color_home: str | None = None
    color_away: str | None = None
    period_duration: str | None = None
    interval_duration: str | None = None
    siren_every_minute: bool | None = None

@router.patch("/game/config")
async def game_config_patch(data: GameConfigPatch, _: User = Depends(require_permission('game.control'))):
    async with game_lock:
        if data.home_name is not None:
            game_state.home_name = data.home_name
        if data.away_name is not None:
            game_state.away_name = data.away_name
        if data.color_home is not None:
            game_state.color_home = data.color_home
        if data.color_away is not None:
            game_state.color_away = data.color_away
        if data.period_duration is not None:
            game_state.period_duration_seconds = _parse_mmss(data.period_duration)
        if data.interval_duration is not None:
            game_state.interval_duration_seconds = _parse_mmss(data.interval_duration)
        if data.siren_every_minute is not None:
            game_state.siren_every_minute = bool(data.siren_every_minute)
        await ws_manager.broadcast('game', {"type":"state","payload": _snapshot_state()})
    return {"ok": True}

# Admin: Ticket Categories CRUD
class CategoryIn(BaseModel):
    name: str
    color: str | None = None
    sort_order: int | None = None

class CategoryOut(BaseModel):
    id: int
    name: str
    color: str | None = None
    sort_order: int = 0
    class Config:
        from_attributes = True

@router.get('/admin/tickets/categories', response_model=list[CategoryOut])
def categories_list(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.query(TicketCategory).order_by(TicketCategory.sort_order.asc(), TicketCategory.name.asc()).all()
    return [CategoryOut.model_validate(r) for r in rows]

@router.get('/tickets/categories', response_model=list[CategoryOut])
def categories_public_list(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(TicketCategory).order_by(TicketCategory.sort_order.asc(), TicketCategory.name.asc()).all()
    return [CategoryOut.model_validate(r) for r in rows]

@router.post('/admin/tickets/categories', response_model=CategoryOut)
def categories_create(data: CategoryIn, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    c = TicketCategory(name=data.name, color=data.color, sort_order=data.sort_order or 0)
    db.add(c); db.commit(); db.refresh(c)
    db.add(AuditLog(user_id=current.id, action='ticket.category.create', details=c.name)); db.commit()
    return CategoryOut.model_validate(c)

@router.patch('/admin/tickets/categories/{cat_id}', response_model=CategoryOut)
def categories_update(cat_id: int, data: CategoryIn, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    c = db.query(TicketCategory).get(cat_id)
    if not c: raise HTTPException(status_code=404, detail='Categoria non trovata')
    if data.name is not None: c.name = data.name
    if data.color is not None: c.color = data.color
    if data.sort_order is not None: c.sort_order = data.sort_order
    db.commit(); db.refresh(c)
    db.add(AuditLog(user_id=current.id, action='ticket.category.update', details=c.name)); db.commit()
    return CategoryOut.model_validate(c)

@router.delete('/admin/tickets/categories/{cat_id}')
def categories_delete(cat_id: int, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    c = db.query(TicketCategory).get(cat_id)
    if not c: return {"ok": True}
    db.delete(c); db.commit(); db.add(AuditLog(user_id=current.id, action='ticket.category.delete', details=str(cat_id))); db.commit()
    return {"ok": True}

# Admin: Backup list & download
class BackupFile(BaseModel):
    name: str
    size: int
    created_at: datetime

@router.get('/admin/backup/list', response_model=list[BackupFile])
def backup_list(_: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'backups')
    if not os.path.exists(base):
        return []
    items = []
    for name in sorted(os.listdir(base)):
        p = os.path.join(base, name)
        if os.path.isfile(p):
            st = os.stat(p)
            items.append(BackupFile(name=name, size=st.st_size, created_at=datetime.fromtimestamp(st.st_mtime, tz=timezone.utc)))
    items.sort(key=lambda x: x.created_at, reverse=True)
    return items

@router.get('/admin/backup/download/{name}')
def backup_download(name: str, _: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'backups')
    path = os.path.join(base, name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail='File non trovato')
    return FileResponse(path, media_type='application/sql', filename=name)

# Automatic Backups: scheduler and retention
async def backup_scheduler():
    """Background task that creates backups periodically and prunes old ones.
    Controlled by AppSetting keys:
      - backup.enabled: 'true'|'false'
      - backup.interval_hours: integer hours between backups (default 24)
      - backup.retention_days: keep files newer than N days
      - backup.retention_count: always keep at least N most recent files
    """
    import subprocess
    while True:
        try:
            db = SessionLocal()
            # read settings
            def get(key: str, default: str | None = None) -> str | None:
                row = db.query(AppSetting).filter(AppSetting.key == key).first()
                return row.value if row else default
            enabled = (get('backup.enabled', 'false') or 'false').lower() in ('1','true','yes','on')
            hours = int(get('backup.interval_hours', '24') or '24')
            retention_days = int(get('backup.retention_days', '14') or '14')
            retention_count = int(get('backup.retention_count', '10') or '10')
            if not enabled:
                # sleep a bit and re-check later
                await asyncio.sleep(300)
                continue
            # perform backup
            os.makedirs(settings.storage_path, exist_ok=True)
            backup_dir = os.path.join(settings.storage_path, 'backups')
            os.makedirs(backup_dir, exist_ok=True)
            ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
            name = f'backup_{ts}.sql'
            dest = os.path.join(backup_dir, name)
            try:
                subprocess.run(['pg_dump', settings.database_url, '-f', dest], check=True)
            except Exception:
                # ignore errors; try next cycle
                pass
            # retention pruning
            try:
                files = []
                for n in os.listdir(backup_dir):
                    p = os.path.join(backup_dir, n)
                    if os.path.isfile(p):
                        st = os.stat(p)
                        files.append((n, p, st.st_mtime))
                files.sort(key=lambda x: x[2], reverse=True)
                keep = set(n for n,_,_ in files[:retention_count])
                cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
                for n, p, m in files:
                    if n in keep:
                        continue
                    mt = datetime.fromtimestamp(m, tz=timezone.utc)
                    if mt < cutoff:
                        try:
                            os.remove(p)
                        except Exception:
                            pass
            except Exception:
                pass
            # sleep until next cycle
            await asyncio.sleep(max(60, hours*3600))
        except Exception:
            # never crash
            await asyncio.sleep(300)

# Admin: Scoreboard logos upload
@router.post('/admin/scoreboard/logo/{side}')
def scoreboard_logo_upload(side: str, file: UploadFile = File(...), db: Session = Depends(get_db), current: User = Depends(require_admin)):
    if side not in ('home','away'):
        raise HTTPException(status_code=400, detail='Side non valido')
    base = os.path.join(settings.storage_path, 'scoreboard')
    os.makedirs(base, exist_ok=True)
    ext = os.path.splitext(file.filename or '')[1] or '.png'
    name = f'{side}_logo{ext}'
    dest = os.path.join(base, name)
    with open(dest, 'wb') as fh:
        shutil.copyfileobj(file.file, fh)
    key = f'scoreboard.{side}_logo_path'
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row: row.value = dest
    else: db.add(AppSetting(key=key, value=dest))
    db.add(AuditLog(user_id=current.id, action='scoreboard.logo.upload', details=key))
    db.commit()
    return {"ok": True, "path": dest}

@router.get('/admin/scoreboard/logo/{side}')
def scoreboard_logo_get(side: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if side not in ('home','away'):
        raise HTTPException(status_code=400, detail='Side non valido')
    key = f'scoreboard.{side}_logo_path'
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row or not row.value or not os.path.exists(row.value):
        raise HTTPException(status_code=404, detail='Logo non trovato')
    # try to guess media type from extension
    ext = os.path.splitext(row.value)[1].lower()
    mt = 'image/png' if ext in ('.png','.apng') else 'image/jpeg' if ext in ('.jpg','.jpeg') else 'application/octet-stream'
    name = os.path.basename(row.value)
    return FileResponse(row.value, media_type=mt, filename=name)

# Admin: Scoreboard siren audio upload and public fetch
@router.post('/admin/scoreboard/siren')
def scoreboard_siren_upload(file: UploadFile = File(...), db: Session = Depends(get_db), current: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'scoreboard')
    os.makedirs(base, exist_ok=True)
    ext = os.path.splitext(file.filename or '')[1].lower() or '.mp3'
    # Basic whitelist
    if ext not in ('.mp3', '.wav', '.ogg'):
        ext = '.mp3'
    name = f'siren{ext}'
    dest = os.path.join(base, name)
    with open(dest, 'wb') as fh:
        shutil.copyfileobj(file.file, fh)
    key = 'scoreboard.siren_path'
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row: row.value = dest
    else: db.add(AppSetting(key=key, value=dest))
    db.add(AuditLog(user_id=current.id, action='scoreboard.siren.upload', details=name))
    db.commit(); return {"ok": True, "path": dest}

@router.get('/scoreboard/siren')
def scoreboard_siren_get(db: Session = Depends(get_db)):
    # 1) Repo-bundled static siren (if present)
    try:
        here = os.path.dirname(__file__)
        static_dir = os.path.normpath(os.path.join(here, '..', '..', 'static', 'sounds'))
        for ext, mt in (('.mp3','audio/mpeg'),('.wav','audio/wav'),('.ogg','audio/ogg')):
            p = os.path.join(static_dir, f'siren{ext}')
            if os.path.exists(p):
                try:
                    logger.info(f"Serving scoreboard siren from static: {p}")
                except Exception:
                    pass
                return FileResponse(p, media_type=mt, filename=os.path.basename(p), headers={'Cache-Control': 'public, max-age=86400', 'X-Siren-Source': 'static'})
    except Exception:
        pass
    # 2) Admin-uploaded siren path from settings
    key = 'scoreboard.siren_path'
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row and row.value and os.path.exists(row.value):
        ext = os.path.splitext(row.value)[1].lower()
        mt = 'audio/mpeg' if ext == '.mp3' else 'audio/wav' if ext == '.wav' else 'audio/ogg' if ext == '.ogg' else 'application/octet-stream'
        name = os.path.basename(row.value)
        try:
            logger.info(f"Serving scoreboard siren from uploaded path: {row.value}")
        except Exception:
            pass
        return FileResponse(row.value, media_type=mt, filename=name, headers={'Cache-Control': 'public, max-age=86400', 'X-Siren-Source': 'uploaded'})
    # 3) Generated built-in siren as last resort
    data = siren_wav_bytes()
    try:
        logger.info("Serving scoreboard siren from generated fallback")
    except Exception:
        pass
    return Response(content=data, media_type='audio/wav', headers={'Cache-Control': 'public, max-age=86400', 'X-Siren-Source': 'generated'})


@router.get('/admin/scoreboard/siren-info')
def scoreboard_siren_info(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Diagnostic endpoint: returns which siren source would be served and the file size when applicable."""
    try:
        here = os.path.dirname(__file__)
        static_dir = os.path.normpath(os.path.join(here, '..', '..', 'static', 'sounds'))
        for ext, mt in (('.mp3','audio/mpeg'),('.wav','audio/wav'),('.ogg','audio/ogg')):
            p = os.path.join(static_dir, f'siren{ext}')
            if os.path.exists(p):
                return {'source': 'static', 'path': p, 'size': os.path.getsize(p)}
    except Exception:
        pass
    key = 'scoreboard.siren_path'
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row and getattr(row,'value',None) and os.path.exists(row.value):
        return {'source': 'uploaded', 'path': row.value, 'size': os.path.getsize(row.value)}
    # fallback generated
    data = siren_wav_bytes()
    return {'source': 'generated', 'path': None, 'size': len(data)}

# Admin: DALI mapping settings (JSON)
@router.get('/admin/dali/mapping')
def dali_mapping_get(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    row = db.query(AppSetting).filter(AppSetting.key == 'dali.mapping').first()
    return {"mapping": row.value if row else '[]'}

@router.put('/admin/dali/mapping')
def dali_mapping_set(payload: dict, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    # payload expected: { mapping: JSON-string or array/object }
    import json
    raw = payload.get('mapping')
    if isinstance(raw, (dict, list)):
        value = json.dumps(raw)
    else:
        value = str(raw or '[]')
    row = db.query(AppSetting).filter(AppSetting.key == 'dali.mapping').first()
    if row: row.value = value
    else: db.add(AppSetting(key='dali.mapping', value=value))
    db.add(AuditLog(user_id=current.id, action='dali.mapping.update', details=None))
    db.commit(); return {"ok": True}

# ===================== DALI (Lighting) =====================

class DALILevelRequest(BaseModel):
    level: int

@router.get("/dali/groups")
def dali_get_groups(_: User = Depends(require_admin)):
    groups = dali_service.list_groups()
    return {"groups": groups, "active_scene": dali_service.active_scene(), "scenes": dali_service.list_scenes()}

@router.post("/dali/groups/{group_id}/level")
def dali_set_group_level(group_id: int, data: DALILevelRequest, _: User = Depends(require_admin)):
    try:
        dali_service.set_group_level(group_id, int(data.level))
        return {"ok": True, "level": dali_service.read_group_level(group_id)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/dali/scenes/{scene_id}/recall")
def dali_recall_scene(scene_id: int, _: User = Depends(require_admin)):
    try:
        dali_service.recall_scene(scene_id)
        return {"ok": True, "active_scene": dali_service.active_scene()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/game/state")
def game_get_state():
    """Get current game state (public endpoint for scoreboard display)"""
    return _snapshot_state()

class ScoreUpdate(BaseModel):
    team: str  # 'home'|'away'
    delta: int  # +1 or -1

@router.post("/game/score")
async def game_update_score(data: ScoreUpdate, _: User = Depends(require_permission('game.control'))):
    async with game_lock:
        if data.team not in ("home","away"):
            raise HTTPException(status_code=400, detail="Team non valido")
        if data.team == 'home':
            game_state.score_home = max(0, game_state.score_home + data.delta)
        else:
            game_state.score_away = max(0, game_state.score_away + data.delta)
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True}

class ShotsUpdate(BaseModel):
    team: str  # 'home'|'away'
    delta: int  # +1 or -1

@router.post("/game/shots")
async def game_update_shots(data: ShotsUpdate, _: User = Depends(require_permission('game.control'))):
    async with game_lock:
        if data.team not in ("home","away"):
            raise HTTPException(status_code=400, detail="Team non valido")
        if data.team == 'home':
            game_state.shots_home = max(0, game_state.shots_home + data.delta)
        else:
            game_state.shots_away = max(0, game_state.shots_away + data.delta)
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True}

# ===================== TICKET ATTACHMENTS =====================
@router.get('/tickets/{ticket_id}/attachments')
def ticket_attachments_list(ticket_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(TicketAttachment).filter(TicketAttachment.ticket_id == ticket_id).order_by(TicketAttachment.uploaded_at.asc()).all()
    return [{"id": r.id, "file_name": r.file_name, "uploaded_at": r.uploaded_at} for r in rows]

@router.post('/tickets/{ticket_id}/attachments')
def ticket_attachments_upload(ticket_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    # Save under storage/tickets
    base = os.path.join(settings.storage_path, 'tickets')
    os.makedirs(base, exist_ok=True)
    name = file.filename or 'file'
    dest = os.path.join(base, f"{ticket_id}_{name}")
    with open(dest, 'wb') as fh:
        shutil.copyfileobj(file.file, fh)
    att = TicketAttachment(ticket_id=ticket_id, file_name=name, file_path=dest)
    db.add(att); db.commit(); db.refresh(att)
    return {"id": att.id, "file_name": att.file_name}

@router.get('/tickets/attachments/{att_id}')
def ticket_attachments_download(att_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    att = db.query(TicketAttachment).get(att_id)
    if not att or not os.path.exists(att.file_path):
        raise HTTPException(status_code=404, detail='Allegato non trovato')
    mt = 'application/octet-stream'
    return FileResponse(att.file_path, media_type=mt, filename=att.file_name)

# ===================== LOCKER ROOM MONITORS =====================
@router.get('/monitors/presets')
def monitors_presets(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    row = db.query(AppSetting).filter(AppSetting.key == 'monitors.presets').first()
    import json
    try:
        return {"items": json.loads(row.value) if row and row.value else []}
    except Exception:
        return {"items": []}

@router.put('/monitors/presets')
def monitors_presets_set(payload: dict, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    import json
    items = payload.get('items')
    try:
        raw = json.dumps(items or [])
    except Exception:
        raw = '[]'
    row = db.query(AppSetting).filter(AppSetting.key == 'monitors.presets').first()
    if row: row.value = raw
    else: db.add(AppSetting(key='monitors.presets', value=raw))
    db.commit(); return {"ok": True}

@router.get('/monitors/{name}')
def monitor_get(name: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'monitors')
    os.makedirs(base, exist_ok=True)
    path = os.path.join(base, f'{name}.txt')
    content = ''
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as fh:
                content = fh.read()
        except Exception:
            content = ''
    return {"name": name, "content": content}

@router.post('/monitors/{name}')
def monitor_set(name: str, content: str = Form(''), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'monitors')
    os.makedirs(base, exist_ok=True)
    path = os.path.join(base, f'{name}.txt')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(content or '')
    return {"ok": True}

@router.post('/monitors/clear_all')
def monitors_clear_all(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    base = os.path.join(settings.storage_path, 'monitors')
    if not os.path.exists(base):
        return {"ok": True}
    for n in os.listdir(base):
        if n.endswith('.txt'):
            try:
                open(os.path.join(base, n), 'w').close()
            except Exception:
                pass
    return {"ok": True}

@router.post("/game/timer/start")
async def game_timer_start(_: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.timer_running = True
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True}

@router.post("/game/timer/stop")
async def game_timer_stop(_: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.timer_running = False
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True}

@router.post("/game/timeout/start")
async def game_timeout_start(_: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.timeout_remaining = 30
        await ws_manager.broadcast('game', {"type":"state","payload": _snapshot_state()})
    return {"ok": True}

@router.post("/game/timeout/stop")
async def game_timeout_stop(_: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.timeout_remaining = 0
        await ws_manager.broadcast('game', {"type":"state","payload": _snapshot_state()})
    return {"ok": True}

class SirenToggle(BaseModel):
    on: bool

@router.post("/game/siren")
async def game_siren_set(data: SirenToggle, _: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.siren_on = bool(data.on)
        await ws_manager.broadcast('game', {"type":"state","payload": _snapshot_state()})
    return {"ok": True}

class ObsToggle(BaseModel):
    visible: bool

@router.post("/game/obs")
async def game_obs_set(data: ObsToggle, _: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.obs_visible = bool(data.visible)
        await ws_manager.broadcast('game', {"type":"state","payload": _snapshot_state()})
    return {"ok": True}

@router.post("/game/timer/reset")
async def game_timer_reset(_: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.timer_running = False
        game_state.in_interval = False
        game_state.timer_remaining = game_state.period_duration_seconds
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True}

class TimerSetRequest(BaseModel):
    seconds: int
    running: bool | None = None

@router.post("/game/timer/set")
async def game_timer_set(req: TimerSetRequest, _: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.timer_remaining = max(0, int(req.seconds))
        if req.running is not None:
            game_state.timer_running = bool(req.running)
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True, "timerRemaining": game_state.timer_remaining, "timerRunning": game_state.timer_running}

@router.post("/game/interval/start")
async def game_interval_start(_: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.in_interval = True
        game_state.timer_running = True
        # preload to interval duration if not already set at end-of-period
        if game_state.timer_remaining <= 0 or game_state.timer_remaining > game_state.interval_duration_seconds:
            game_state.timer_remaining = game_state.interval_duration_seconds
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True}

@router.post("/game/period/next")
async def game_period_next(_: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.period_index = min(4, game_state.period_index + 1)
        game_state.timer_running = False
        game_state.in_interval = False
        game_state.timer_remaining = game_state.period_duration_seconds
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True}

class AddPenaltyRequest(BaseModel):
    team: str  # 'home'|'away'
    player_number: str
    minutes: int  # 2 or 5

@router.post("/game/penalties")
async def game_add_penalty(data: AddPenaltyRequest, _: User = Depends(require_admin)):
    global _penalty_id_seq
    async with game_lock:
        if data.team not in ("home","away"):
            raise HTTPException(status_code=400, detail="Team non valido")
        pid = _penalty_id_seq
        _penalty_id_seq += 1
        pen = Penalty(id=pid, team=data.team, player_number=data.player_number, remaining=data.minutes*60)
        game_state.penalties.append(pen)
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"id": pid}

@router.delete("/game/penalties/{penalty_id}")
async def game_remove_penalty(penalty_id: int, _: User = Depends(require_permission('game.control'))):
    async with game_lock:
        game_state.penalties = [p for p in game_state.penalties if p.id != penalty_id]
        await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
    return {"ok": True}

async def game_scheduler():
    while True:
        await asyncio.sleep(1)
        changed = False
        just_pulsed = False
        period_end_pulse = False
        removed_ids: List[int] = []
        async with game_lock:
            if game_state.timer_running and game_state.timer_remaining > 0:
                game_state.timer_remaining -= 1
                if game_state.timer_remaining <= 0:
                    game_state.timer_remaining = 0
                    game_state.timer_running = False
                    if not game_state.in_interval:
                        # end of period → switch to interval (stopped, ready to start)
                        game_state.in_interval = True
                        game_state.timer_remaining = game_state.interval_duration_seconds
                        # trigger siren at end of period
                        period_end_pulse = True
                    else:
                        # end of interval: keep at 0, controller will advance period
                        game_state.in_interval = True
                changed = True
                # siren pulse each minute if option enabled
                if game_state.siren_every_minute and (not game_state.in_interval) and game_state.timer_remaining % 60 == 0:
                    just_pulsed = True
            # timeout countdown (always runs once started)
            if game_state.timeout_remaining > 0:
                game_state.timeout_remaining -= 1
                if game_state.timeout_remaining < 0:
                    game_state.timeout_remaining = 0
                changed = True
            # penalties: decrement ONLY when main timer is running (not during interval)
            if game_state.timer_running and (not game_state.in_interval):
                for p in list(game_state.penalties):
                    if p.remaining > 0:
                        p.remaining -= 1
                        if p.remaining <= 0:
                            removed_ids.append(p.id)
                            changed = True
            if removed_ids:
                game_state.penalties = [p for p in game_state.penalties if p.id not in removed_ids]
        if changed:
            try:
                await ws_manager.broadcast('game', {"type": "state", "payload": _snapshot_state()})
            except Exception:
                pass
        # trigger siren pulse event, outside lock
        if just_pulsed or period_end_pulse:
            try:
                await ws_manager.broadcast('game', {"type": "sirenPulse", "payload": {"at": int(datetime.now(timezone.utc).timestamp())}})
            except Exception:
                pass

# ===================== OBS BROWSER SOURCE OVERLAYS =====================

@router.get("/obs/overlay/scoreboard", response_class=HTMLResponse)
def obs_overlay_scoreboard():
    """HTML overlay per OBS - Scoreboard Hockey"""
    html = """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920, height=1080">
<title>OBS Overlay - Scoreboard</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { 
    background: transparent; 
    font-family: 'Arial Black', Arial, sans-serif; 
    color: #fff;
    overflow: hidden;
}
#overlay {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(30,30,30,0.9) 100%);
    border-radius: 16px;
    padding: 20px 40px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    gap: 32px;
    opacity: 1;
    transition: opacity 0.5s;
}
#overlay.hidden { opacity: 0; }
.team { text-align: center; min-width: 180px; }
.team-name { font-size: 18px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 8px; }
.score { font-size: 72px; font-weight: 900; line-height: 1; }
.center { text-align: center; padding: 0 24px; border-left: 2px solid rgba(255,255,255,0.2); border-right: 2px solid rgba(255,255,255,0.2); }
.period { font-size: 16px; opacity: 0.8; margin-bottom: 4px; }
.timer { font-size: 42px; font-weight: 700; font-family: 'Courier New', monospace; }
.shots { font-size: 12px; opacity: 0.7; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
.timeout-indicator {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 12px;
    background: rgba(249, 115, 22, 0.9);
    padding: 8px 24px;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 700;
    animation: pulse 1.5s infinite;
}
@keyframes pulse {
    0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
    50% { opacity: 0.7; transform: translateX(-50%) scale(1.05); }
}
</style>
</head>
<body>
<div id="overlay">
    <div class="team">
        <div class="team-name" id="homeName">Casa</div>
        <div class="score" id="homeScore">0</div>
        <div class="shots">Tiri: <span id="homeShots">0</span></div>
    </div>
    <div class="center">
        <div class="period" id="period">1° Periodo</div>
        <div class="timer" id="timer">20:00</div>
    </div>
    <div class="team">
        <div class="team-name" id="awayName">Ospiti</div>
        <div class="score" id="awayScore">0</div>
        <div class="shots">Tiri: <span id="awayShots">0</span></div>
    </div>
</div>
<div class="timeout-indicator" id="timeoutIndicator" style="display:none;">
    Timeout · <span id="timeoutSeconds">30</span>s
</div>
<script>
const ws = new WebSocket(`ws://${window.location.host}/api/v1/ws/game`);
const overlay = document.getElementById('overlay');
const timeoutIndicator = document.getElementById('timeoutIndicator');

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateState(state) {
    document.getElementById('homeName').textContent = state.homeName || 'Casa';
    document.getElementById('awayName').textContent = state.awayName || 'Ospiti';
    document.getElementById('homeScore').textContent = state.scoreHome ?? 0;
    document.getElementById('awayScore').textContent = state.scoreAway ?? 0;
    document.getElementById('homeShots').textContent = state.shotsHome ?? 0;
    document.getElementById('awayShots').textContent = state.shotsAway ?? 0;
    document.getElementById('period').textContent = (state.period || '1°') + ' Periodo';
    document.getElementById('timer').textContent = formatTime(state.timerRemaining ?? 0);
    
    // Visibility control
    if (state.obsVisible === false) {
        overlay.classList.add('hidden');
    } else {
        overlay.classList.remove('hidden');
    }
    
    // Timeout indicator
    if (state.timeoutRemaining && state.timeoutRemaining > 0) {
        document.getElementById('timeoutSeconds').textContent = state.timeoutRemaining;
        timeoutIndicator.style.display = 'block';
    } else {
        timeoutIndicator.style.display = 'none';
    }
}

ws.onmessage = (event) => {
    try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'state' && msg.payload) {
            updateState(msg.payload);
        }
    } catch (e) {
        console.error('WS parse error:', e);
    }
};

// Initial fetch
fetch('/api/v1/game/state')
    .then(r => r.json())
    .then(state => updateState(state))
    .catch(e => console.error('Initial fetch failed:', e));
</script>
</body>
</html>"""
    return HTMLResponse(content=html)

@router.get("/obs/overlay/skating", response_class=HTMLResponse)
def obs_overlay_skating():
    """HTML overlay per OBS - Pattinaggio Pubblico"""
    html = """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920, height=1080">
<title>OBS Overlay - Pattinaggio</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { 
    background: transparent; 
    font-family: Arial, sans-serif; 
    color: #fff;
    overflow: hidden;
}
.message-box {
    position: absolute;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%);
    border-radius: 20px;
    padding: 24px 48px;
    box-shadow: 0 12px 48px rgba(0,0,0,0.6);
    text-align: center;
    max-width: 80%;
    display: none;
}
.message-box.visible { display: block; animation: slideIn 0.5s ease-out; }
@keyframes slideIn {
    from { opacity: 0; transform: translateX(-50%) translateY(40px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.message-title {
    font-size: 32px;
    font-weight: 900;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
}
.message-content {
    font-size: 24px;
    line-height: 1.4;
    opacity: 0.95;
}
.timer-box {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.9);
    border-radius: 24px;
    padding: 40px 80px;
    box-shadow: 0 16px 64px rgba(0,0,0,0.8);
    text-align: center;
    display: none;
}
.timer-box.visible { display: block; animation: zoomIn 0.4s ease-out; }
@keyframes zoomIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
.timer-label {
    font-size: 28px;
    opacity: 0.8;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 3px;
}
.timer-value {
    font-size: 120px;
    font-weight: 900;
    font-family: 'Courier New', monospace;
    line-height: 1;
    color: #3b82f6;
}
</style>
</head>
<body>
<div class="message-box" id="messageBox">
    <div class="message-title" id="messageTitle">Pattinaggio Pubblico</div>
    <div class="message-content" id="messageContent">Benvenuti!</div>
</div>
<div class="timer-box" id="timerBox">
    <div class="timer-label">Tempo rimanente</div>
    <div class="timer-value" id="timerValue">00:00</div>
</div>
<script>
const ws = new WebSocket(`ws://${window.location.host}/api/v1/ws/display`);
const messageBox = document.getElementById('messageBox');
const timerBox = document.getElementById('timerBox');

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

ws.onmessage = (event) => {
    try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'showView') {
            const view = msg.payload?.view;
            if (view === 'message') {
                const title = msg.payload?.title || 'Pattinaggio Pubblico';
                const content = msg.payload?.message || '';
                document.getElementById('messageTitle').textContent = title;
                document.getElementById('messageContent').textContent = content;
                timerBox.classList.remove('visible');
                messageBox.classList.add('visible');
            } else if (view === 'timer') {
                const seconds = msg.payload?.seconds ?? 0;
                document.getElementById('timerValue').textContent = formatTime(seconds);
                messageBox.classList.remove('visible');
                timerBox.classList.add('visible');
            } else if (view === 'clear') {
                messageBox.classList.remove('visible');
                timerBox.classList.remove('visible');
            }
        }
    } catch (e) {
        console.error('WS parse error:', e);
    }
};

ws.onerror = () => console.error('WebSocket error');
ws.onclose = () => console.log('WebSocket closed');
</script>
</body>
</html>"""
    return HTMLResponse(content=html)


# Recurring Tasks Scheduler
async def recurring_tasks_scheduler():
    """Background task that generates recurring task instances based on recurrence rules"""
    from datetime import timedelta
    while True:
        try:
            await asyncio.sleep(3600)  # Check every hour
            db = SessionLocal()
            try:
                today = date.today()
                # Find all recurring template tasks
                recurring_tasks = db.query(Task).filter(
                    Task.is_recurring == True,
                    or_(Task.recurrence_end_date.is_(None), Task.recurrence_end_date >= today)
                ).all()
                
                for template in recurring_tasks:
                    # Determine if we need to generate a new instance
                    should_generate = False
                    next_due_date = None
                    
                    if not template.last_generated_date:
                        # First time - generate from due_date or today
                        should_generate = True
                        next_due_date = template.due_date or today
                    else:
                        # Calculate next due date based on pattern
                        last_gen = template.last_generated_date
                        interval = template.recurrence_interval or 1
                        
                        if template.recurrence_pattern == 'daily':
                            next_due_date = last_gen + timedelta(days=interval)
                        elif template.recurrence_pattern == 'weekly':
                            next_due_date = last_gen + timedelta(weeks=interval)
                        elif template.recurrence_pattern == 'monthly':
                            # Approximate month by 30 days
                            next_due_date = last_gen + timedelta(days=30 * interval)
                        
                        if next_due_date and next_due_date <= today:
                            should_generate = True
                    
                    if should_generate and next_due_date:
                        # Check if instance already exists for this date
                        existing = db.query(Task).filter(
                            Task.parent_task_id == template.id,
                            Task.due_date == next_due_date
                        ).first()
                        
                        if not existing:
                            # Create new task instance
                            new_task = Task(
                                title=template.title,
                                description=template.description,
                                priority=template.priority,
                                due_date=next_due_date,
                                completed=False,
                                creator_id=template.creator_id,
                                parent_task_id=template.id,
                                is_recurring=False
                            )
                            db.add(new_task)
                            
                            # Copy assignees
                            for assignee in template.assignees:
                                new_task.assignees.append(assignee)
                            
                            # Update template's last_generated_date
                            template.last_generated_date = next_due_date
                            db.add(template)
                            
                            db.commit()
                            logger.info(f"Generated recurring task instance: {template.title} for {next_due_date}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in recurring_tasks_scheduler: {e}", exc_info=True)
            await asyncio.sleep(60)


# ---- Notifications System ----
async def send_notification(user_id: int | None, message: str, notification_type: str = "info", data: dict | None = None):
    """
    Send notification to a specific user or broadcast to all
    notification_type: info|success|warning|danger
    """
    payload = {
        "type": "notification",
        "notification_type": notification_type,
        "message": message,
        "data": data or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    if user_id:
        # Send to specific user's room (notifications_user_{id})
        await ws_manager.broadcast(f"notifications_user_{user_id}", payload)
    else:
        # Broadcast to all connected users (notifications_all)
        await ws_manager.broadcast("notifications_all", payload)
    
    logger.info(f"Notification sent - user: {user_id or 'all'}, type: {notification_type}, message: {message}")


@router.post("/notifications/test")
async def test_notification(current: User = Depends(get_current_user)):
    """Test endpoint to send a notification to current user"""
    await send_notification(current.id, "Questa è una notifica di test!", "info")
    return {"ok": True, "message": "Notification sent"}


@router.post("/notifications/broadcast")
async def broadcast_notification(message: str, notification_type: str = "info", _: User = Depends(require_admin)):
    """Admin endpoint to broadcast notification to all users"""
    await send_notification(None, message, notification_type)
    return {"ok": True, "message": "Broadcast sent"}


# ---- Skate Rental System ----
class SkateInventoryOut(BaseModel):
    id: int
    size: str
    type: str
    qr_code: str | None
    status: str
    condition: str
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class SkateInventoryCreate(BaseModel):
    size: str
    type: str = 'standard'
    qr_code: str | None = None
    condition: str = 'good'
    notes: str | None = None


class SkateRentalOut(BaseModel):
    id: int
    skate_id: int
    customer_name: str
    customer_phone: str | None
    user_id: int | None
    deposit_amount: float
    rental_price: float
    rented_at: datetime
    returned_at: datetime | None
    notes: str | None
    skate: SkateInventoryOut | None

    class Config:
        from_attributes = True


class SkateRentalCreate(BaseModel):
    skate_id: int
    customer_name: str
    customer_phone: str | None = None
    deposit_amount: float = 0.0
    rental_price: float = 0.0
    notes: str | None = None


@router.get("/skates/inventory", response_model=list[SkateInventoryOut])
def skates_inventory_list(status: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """List all skates in inventory, optionally filtered by status"""
    q = db.query(SkateInventory)
    if status:
        q = q.filter(SkateInventory.status == status)
    return q.order_by(SkateInventory.size.asc()).all()


@router.post("/skates/inventory", response_model=SkateInventoryOut, status_code=201)
def skates_inventory_create(data: SkateInventoryCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Add new skate to inventory"""
    skate = SkateInventory(**data.model_dump())
    db.add(skate)
    db.commit()
    db.refresh(skate)
    logger.info(f"Added skate to inventory: size {skate.size}, type {skate.type}")
    return skate


@router.patch("/skates/inventory/{skate_id}")
def skates_inventory_update(skate_id: int, status: str | None = None, condition: str | None = None, notes: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Update skate status/condition"""
    skate = db.query(SkateInventory).get(skate_id)
    if not skate:
        raise HTTPException(status_code=404, detail="Pattino non trovato")
    if status:
        skate.status = status
    if condition:
        skate.condition = condition
    if notes is not None:
        skate.notes = notes
    skate.updated_at = datetime.now(timezone.utc)
    db.add(skate)
    db.commit()
    return {"ok": True}


@router.delete("/skates/inventory/{skate_id}")
def skates_inventory_delete(skate_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Delete skate from inventory (admin only)"""
    skate = db.query(SkateInventory).get(skate_id)
    if not skate:
        raise HTTPException(status_code=404, detail="Pattino non trovato")
    db.delete(skate)
    db.commit()
    return {"ok": True}


@router.get("/skates/rentals", response_model=list[SkateRentalOut])
def skates_rentals_list(active: bool | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """List all rentals, optionally filter by active status"""
    q = db.query(SkateRental)
    if active is not None:
        if active:
            q = q.filter(SkateRental.returned_at == None)
        else:
            q = q.filter(SkateRental.returned_at != None)
    return q.order_by(SkateRental.rented_at.desc()).all()


@router.post("/skates/rentals", response_model=SkateRentalOut, status_code=201)
async def skates_rentals_create(data: SkateRentalCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Create new rental (check-out)"""
    skate = db.query(SkateInventory).get(data.skate_id)
    if not skate:
        raise HTTPException(status_code=404, detail="Pattino non trovato")
    if skate.status != 'available':
        raise HTTPException(status_code=400, detail="Pattino non disponibile")
    
    rental = SkateRental(
        skate_id=data.skate_id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        user_id=current.id,
        deposit_amount=data.deposit_amount,
        rental_price=data.rental_price,
        notes=data.notes
    )
    skate.status = 'rented'
    db.add(rental)
    db.add(skate)
    db.commit()
    db.refresh(rental)
    
    logger.info(f"Skate rented: {skate.size} to {rental.customer_name}")
    
    # Send notification to admins
    await send_notification(None, f"Noleggio pattini taglia {skate.size} a {rental.customer_name}", "info", {"rental_id": rental.id})
    
    return rental


@router.post("/skates/rentals/{rental_id}/return")
async def skates_rentals_return(rental_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Return rental (check-in)"""
    rental = db.query(SkateRental).get(rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Noleggio non trovato")
    if rental.returned_at:
        raise HTTPException(status_code=400, detail="Pattino già restituito")
    
    rental.returned_at = datetime.now(timezone.utc)
    rental.skate.status = 'available'
    db.add(rental)
    db.add(rental.skate)
    db.commit()
    
    logger.info(f"Skate returned: rental_id {rental_id}")
    
    # Send notification
    await send_notification(None, f"Restituzione pattini taglia {rental.skate.size} da {rental.customer_name}", "success", {"rental_id": rental_id})
    
    return {"ok": True, "returned_at": rental.returned_at}


@router.get("/skates/stats")
def skates_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Get rental statistics"""
    total = db.query(SkateInventory).count()
    available = db.query(SkateInventory).filter(SkateInventory.status == 'available').count()
    rented = db.query(SkateInventory).filter(SkateInventory.status == 'rented').count()
    maintenance = db.query(SkateInventory).filter(SkateInventory.status == 'maintenance').count()
    active_rentals = db.query(SkateRental).filter(SkateRental.returned_at == None).count()
    
    return {
        "total_skates": total,
        "available": available,
        "rented": rented,
        "maintenance": maintenance,
        "active_rentals": active_rentals
    }

