from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, Column
from sqlalchemy.orm import relationship, Mapped, mapped_column
from ..db.session import Base


class Ticket(Base):
    __tablename__ = 'tickets'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default='Generale')
    priority: Mapped[str] = mapped_column(String(10), default='medium')  # low|medium|high
    status: Mapped[str] = mapped_column(String(20), default='open')  # open|in_progress|resolved
    creator_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    assignee_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    creator = relationship('User', foreign_keys=[creator_id])
    assignee = relationship('User', foreign_keys=[assignee_id])
    comments = relationship('TicketComment', back_populates='ticket', cascade='all, delete-orphan')
    history = relationship('TicketStatusHistory', back_populates='ticket', cascade='all, delete-orphan')
    attachments = relationship('TicketAttachment', back_populates='ticket', cascade='all, delete-orphan')


class TicketComment(Base):
    __tablename__ = 'ticket_comments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ticket_id: Mapped[int] = mapped_column(Integer, ForeignKey('tickets.id', ondelete='CASCADE'))
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    ticket = relationship('Ticket', back_populates='comments')
    author = relationship('User')


class TicketStatusHistory(Base):
    __tablename__ = 'ticket_status_history'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ticket_id: Mapped[int] = mapped_column(Integer, ForeignKey('tickets.id', ondelete='CASCADE'))
    from_status: Mapped[str] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    ticket = relationship('Ticket', back_populates='history')
    user = relationship('User')


class TicketAttachment(Base):
    __tablename__ = 'ticket_attachments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ticket_id: Mapped[int] = mapped_column(Integer, ForeignKey('tickets.id', ondelete='CASCADE'))
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    ticket = relationship('Ticket', back_populates='attachments')


class TicketCategory(Base):
    __tablename__ = 'ticket_categories'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
