from __future__ import annotations

from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, String, Text, Boolean, Date, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship, Mapped
from ..db.session import Base


task_assignees = Table(
    'task_assignees',
    Base.metadata,
    Column('task_id', Integer, ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
)


class Task(Base):
    __tablename__ = 'tasks'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    title: Mapped[str] = Column(String(200), nullable=False)
    description: Mapped[str | None] = Column(Text, nullable=True)
    priority: Mapped[str] = Column(String(10), default='medium')  # low|medium|high
    due_date: Mapped[date | None] = Column(Date, nullable=True)
    completed: Mapped[bool] = Column(Boolean, default=False)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    creator_id: Mapped[int] = Column(Integer, ForeignKey('users.id'))

    creator = relationship('User', backref='created_tasks')
    assignees = relationship('User', secondary=task_assignees, backref='assigned_tasks')
    comments = relationship('TaskComment', back_populates='task', cascade='all, delete-orphan')


class TaskComment(Base):
    __tablename__ = 'task_comments'

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    task_id: Mapped[int] = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    author_id: Mapped[int] = Column(Integer, ForeignKey('users.id'))
    content: Mapped[str] = Column(Text, nullable=False)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    task = relationship('Task', back_populates='comments')
    author = relationship('User')
