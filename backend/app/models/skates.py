from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship, Mapped, mapped_column
from ..db.session import Base


class SkateInventory(Base):
    """Inventario pattini disponibili per il noleggio"""
    __tablename__ = 'skate_inventory'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    size: Mapped[str] = mapped_column(String(10), nullable=False)  # es. "38", "42", "M", "L"
    type: Mapped[str] = mapped_column(String(50), default='standard')  # standard|hockey|artistic
    qr_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=True)  # Codice QR univoco
    status: Mapped[str] = mapped_column(String(20), default='available')  # available|rented|maintenance|retired
    condition: Mapped[str] = mapped_column(String(20), default='good')  # excellent|good|fair|poor
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    rentals = relationship('SkateRental', back_populates='skate', cascade='all, delete-orphan')


class SkateRental(Base):
    """Noleggio pattini con deposito cauzionale"""
    __tablename__ = 'skate_rentals'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    skate_id: Mapped[int] = mapped_column(Integer, ForeignKey('skate_inventory.id', ondelete='CASCADE'))
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('users.id'), nullable=True)  # Operatore che ha registrato
    deposit_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)  # Deposito cauzionale
    rental_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)  # Prezzo noleggio
    rented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    skate = relationship('SkateInventory', back_populates='rentals')
    operator = relationship('User', backref='managed_rentals')
