from datetime import datetime
from sqlalchemy import Integer, String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from ..db.session import Base

class SkatingEvent(Base):
    __tablename__ = 'skating_events'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    jingle_trigger_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    obs_trigger_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    display_timer_trigger_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
