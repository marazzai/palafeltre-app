"""
Models package - export all database models for easy import
"""

from .rbac import User, Role
from .tasks import Task, TaskComment, TaskAttachment
from .tickets import Ticket, TicketComment, TicketStatusHistory, TicketAttachment, TicketCategory
from .skating import SkatingEvent
from .scheduling import Shift, AvailabilityBlock, ShiftSwapRequest
from .documents import Document
from .settings import AppSetting
from .skates import SkateInventory, SkateRental

__all__ = [
    "User",
    "Role",
    "Task",
    "TaskComment",
    "TaskAttachment",
    "Ticket",
    "TicketComment",
    "TicketStatusHistory",
    "TicketAttachment",
    "TicketCategory",
    "SkatingEvent",
    "Shift",
    "AvailabilityBlock",
    "ShiftSwapRequest",
    "Document",
    "AppSetting",
    "SkateInventory",
    "SkateRental",
]
