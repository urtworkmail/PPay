import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class SavedPaymentMethodType(StrEnum):
    CARD = "card"
    WALLET = "wallet"


class SavedPaymentMethod(Base):
    """A customer's payment method kept on file for off-session (recurring) charges.

    Sandbox-safe: stores the same kind of magic test digits sandbox_engine.py
    already uses to decide outcomes, never a real PAN. See sandbox_engine's
    module docstring for why this design is fine for a demo but must never be
    pointed at real card data.
    """

    __tablename__ = "saved_payment_methods"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[SavedPaymentMethodType] = mapped_column(
        Enum(SavedPaymentMethodType, name="saved_payment_method_type"), nullable=False
    )
    masked_details: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    sandbox_digits: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship()


class SubscriptionStatus(StrEnum):
    INCOMPLETE = "incomplete"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    price_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("prices.id", ondelete="RESTRICT"), nullable=False)
    payment_method_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("saved_payment_methods.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscription_status"), default=SubscriptionStatus.INCOMPLETE, nullable=False
    )
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    failed_attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship()
    price: Mapped["Price"] = relationship()
    payment_method: Mapped["SavedPaymentMethod | None"] = relationship()
