from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship, Mapped, mapped_column
from ..db.session import Base


class Shift(Base):
    __tablename__ = 'shifts'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False)  # mansione
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship('User', foreign_keys=[user_id])
    creator = relationship('User', foreign_keys=[created_by])


class AvailabilityBlock(Base):
    __tablename__ = 'availability_blocks'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon .. 6=Sun
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False)  # minutes from 00:00
    end_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    available: Mapped[bool] = mapped_column(Boolean, default=True)

    user = relationship('User')


class ShiftSwapRequest(Base):
    __tablename__ = 'shift_swap_requests'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    shift_id: Mapped[int] = mapped_column(Integer, ForeignKey('shifts.id', ondelete='CASCADE'))
    requester_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'))
    status: Mapped[str] = mapped_column(String(20), default='pending')  # pending|approved|denied
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    decided_by: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    shift = relationship('Shift')
    requester = relationship('User', foreign_keys=[requester_id])