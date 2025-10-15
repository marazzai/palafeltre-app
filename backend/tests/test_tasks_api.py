import os
import pytest

# Ensure we use a local SQLite DB for tests before importing app modules
os.environ.setdefault('DATABASE_URL', 'sqlite:///./test.db')

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import Base, engine, SessionLocal
from app.models.rbac import User, Role
from app.core.security import hash_password, create_access_token

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    # Ensure DB schema for tests (uses the configured engine via env)
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
            user = User(username='admin', email='admin@example.com', full_name='Admin', hashed_password=hash_password('adimnadmin'), is_active=True)
            user.roles.append(role)
            db.add(user); db.commit(); db.refresh(user)
        token = create_access_token(str(user.id))
        return token
    finally:
        db.close()

@pytest.fixture()
def user_token():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username=='user').first()
        if not user:
            user = User(username='user', email='user@example.com', full_name='User', hashed_password=hash_password('user'), is_active=True)
            db.add(user); db.commit(); db.refresh(user)
        token = create_access_token(str(user.id))
        return token
    finally:
        db.close()

def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_tasks_crud_flow(client, user_token):
    # Create
    r = client.post('/api/v1/tasks', json={"title":"Test Task","description":"Desc"}, headers=auth_headers(user_token))
    assert r.status_code == 201
    data = r.json(); tid = data['id']
    assert data['title'] == 'Test Task'

    # Get list (mine)
    r = client.get('/api/v1/tasks', headers=auth_headers(user_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    # Update
    r = client.patch(f'/api/v1/tasks/{tid}', json={"completed": True}, headers=auth_headers(user_token))
    assert r.status_code == 200
    assert r.json()['completed'] is True


def test_rbac_admin_routes(client, admin_token, user_token):
    # Non-admin should be forbidden to list users
    r = client.get('/api/v1/users', headers=auth_headers(user_token))
    assert r.status_code == 403

    # Admin can list users
    r = client.get('/api/v1/users', headers=auth_headers(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    # Non-admin cannot create users
    r = client.post('/api/v1/users', json={"username":"x","email":"x@y.com","password":"p"}, headers=auth_headers(user_token))
    assert r.status_code in (401,403)

    # Admin can create user
    r = client.post('/api/v1/users', json={"username":"new","email":"new@y.com","password":"p","full_name":"N"}, headers=auth_headers(admin_token))
    assert r.status_code == 200
    assert r.json()['email'] == 'new@y.com'
