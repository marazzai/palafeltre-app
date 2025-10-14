from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship, Mapped
from ..db.session import Base


class Ticket(Base):
    __tablename__ = 'tickets'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    title: Mapped[str] = Column(String(200), nullable=False)
    description: Mapped[str | None] = Column(Text, nullable=True)
    category: Mapped[str] = Column(String(100), default='Generale')
    priority: Mapped[str] = Column(String(10), default='medium')  # low|medium|high
    status: Mapped[str] = Column(String(20), default='open')  # open|in_progress|resolved
    creator_id: Mapped[int] = Column(Integer, ForeignKey('users.id'), nullable=False)
    assignee_id: Mapped[int | None] = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    creator = relationship('User', foreign_keys=[creator_id])
    assignee = relationship('User', foreign_keys=[assignee_id])
    comments = relationship('TicketComment', back_populates='ticket', cascade='all, delete-orphan')
    history = relationship('TicketStatusHistory', back_populates='ticket', cascade='all, delete-orphan')
    attachments = relationship('TicketAttachment', back_populates='ticket', cascade='all, delete-orphan')


class TicketComment(Base):
    __tablename__ = 'ticket_comments'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    ticket_id: Mapped[int] = Column(Integer, ForeignKey('tickets.id', ondelete='CASCADE'))
    author_id: Mapped[int] = Column(Integer, ForeignKey('users.id'))
    content: Mapped[str] = Column(Text, nullable=False)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    ticket = relationship('Ticket', back_populates='comments')
    author = relationship('User')


class TicketStatusHistory(Base):
    __tablename__ = 'ticket_status_history'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    ticket_id: Mapped[int] = Column(Integer, ForeignKey('tickets.id', ondelete='CASCADE'))
    from_status: Mapped[str] = Column(String(20), nullable=True)
    to_status: Mapped[str] = Column(String(20), nullable=False)
    changed_by: Mapped[int] = Column(Integer, ForeignKey('users.id'))
    changed_at: Mapped[datetime] = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    ticket = relationship('Ticket', back_populates='history')
    user = relationship('User')


class TicketAttachment(Base):
    __tablename__ = 'ticket_attachments'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    ticket_id: Mapped[int] = Column(Integer, ForeignKey('tickets.id', ondelete='CASCADE'))
    file_name: Mapped[str] = Column(String(300), nullable=False)
    file_path: Mapped[str] = Column(String(500), nullable=False)
    uploaded_at: Mapped[datetime] = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    ticket = relationship('Ticket', back_populates='attachments')


class TicketCategory(Base):
    __tablename__ = 'ticket_categories'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    name: Mapped[str] = Column(String(100), unique=True, nullable=False)
    color: Mapped[str] = Column(String(20), nullable=True)
    sort_order: Mapped[int] = Column(Integer, default=0)
