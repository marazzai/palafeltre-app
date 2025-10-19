from typing import Any, Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from ..core.config import settings

# Create engine with SQLite-friendly connect args when using SQLite URLs (tests)
_url = settings.database_url
_kwargs: dict[str, Any] = {"echo": False, "future": True}
if _url.startswith("sqlite"):
    # needed when using FastAPI TestClient and SQLite in-memory/file DBs across threads
    _kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(_url, **_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()