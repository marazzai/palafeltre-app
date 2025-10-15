from __future__ import annotations

from datetime import datetime, timezone, date
from sqlalchemy import Integer, String, Text, Boolean, Date, DateTime, ForeignKey, Table, Column
from sqlalchemy.orm import relationship, Mapped, mapped_column
from ..db.session import Base


task_assignees = Table(
    'task_assignees',
    Base.metadata,
    Column('task_id', Integer, ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
)


class Task(Base):
    __tablename__ = 'tasks'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(10), default='medium')  # low|medium|high
    due_date: Mapped[date] = mapped_column(Date, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    creator_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'))
    
    # Recurrence fields
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recurrence_pattern: Mapped[str | None] = mapped_column(String(50), nullable=True)  # daily|weekly|monthly
    recurrence_interval: Mapped[int | None] = mapped_column(Integer, nullable=True, default=1)  # every N days/weeks/months
    recurrence_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # when to stop generating
    parent_task_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('tasks.id'), nullable=True)  # template task
    last_generated_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # track last instance creation

    creator = relationship('User', backref='created_tasks')
    assignees = relationship('User', secondary=task_assignees, backref='assigned_tasks')
    comments = relationship('TaskComment', back_populates='task', cascade='all, delete-orphan')
    attachments = relationship('TaskAttachment', back_populates='task', cascade='all, delete-orphan')
    parent_task = relationship('Task', remote_side=[id], backref='recurring_instances')


class TaskComment(Base):
    __tablename__ = 'task_comments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    task = relationship('Task', back_populates='comments')
    author = relationship('User')


class TaskAttachment(Base):
    __tablename__ = 'task_attachments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    task = relationship('Task', back_populates='attachments')
