from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped
from ..db.session import Base


class AppSetting(Base):
    __tablename__ = 'app_settings'

    id: Mapped[int] = Column(Integer, primary_key=True)
    key: Mapped[str] = Column(String(200), unique=True, index=True, nullable=False)
    value: Mapped[str] = Column(Text, nullable=False)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id: Mapped[int] = Column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    user_id: Mapped[int | None] = Column(Integer, nullable=True)
    action: Mapped[str] = Column(String(120), nullable=False)
    details: Mapped[str] = Column(Text, nullable=True)
