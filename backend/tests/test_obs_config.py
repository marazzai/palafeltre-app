import os
import pytest

os.environ.setdefault('DATABASE_URL', 'sqlite:///./test.db')

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import Base, engine, SessionLocal
from app.models.settings import AppSetting
from app.models.rbac import Role, User
from app.core.security import hash_password, create_access_token


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def admin_token():
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name=='admin').first()
        if not role:
            role = Role(name='admin')
            db.add(role); db.commit(); db.refresh(role)
        user = db.query(User).filter(User.username=='admin').first()
        if not user:
            user = User(username='admin', email='admin@example.com', full_name='Admin', hashed_password=hash_password('adminadmin'), is_active=True)
            user.roles.append(role)
            db.add(user); db.commit(); db.refresh(user)
        token = create_access_token(str(user.id))
        return token
    finally:
        db.close()


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_admin_obs_config_saves_encrypted_password(client, admin_token):
    payload = { 'host': 'localhost', 'port': 4455, 'password': 'supersecret' }
    r = client.put('/api/v1/admin/obs/config', json=payload, headers=auth_headers(admin_token))
    assert r.status_code == 200
    # verify in DB
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == 'obs.password').first()
        assert row is not None
        assert isinstance(row.value, str)
        assert row.value.startswith('enc:')
    finally:
        db.close()
