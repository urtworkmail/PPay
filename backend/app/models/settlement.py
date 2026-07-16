import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class SettlementStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    gross_amount_minor: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    fee_amount_minor: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    net_amount_minor: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    transaction_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[SettlementStatus] = mapped_column(
        Enum(SettlementStatus, name="settlement_status"), default=SettlementStatus.PENDING, nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship()
    items: Mapped[list["SettlementItem"]] = relationship(back_populates="settlement", cascade="all, delete-orphan")


class SettlementItem(Base):
    __tablename__ = "settlement_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    settlement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("settlements.id", ondelete="CASCADE"), nullable=False
    )
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )

    settlement: Mapped["Settlement"] = relationship(back_populates="items")
    transaction: Mapped["Transaction"] = relationship()
