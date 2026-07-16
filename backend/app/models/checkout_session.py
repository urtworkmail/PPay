import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class CheckoutSessionStatus(StrEnum):
    CREATED = "created"
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class PaymentMethod(StrEnum):
    CARD = "card"
    WALLET = "wallet"
    BANK_TRANSFER = "bank_transfer"
    QR = "qr"


class CheckoutSession(Base):
    __tablename__ = "checkout_sessions"
    __table_args__ = (
        UniqueConstraint("merchant_id", "idempotency_key", name="uq_checkout_merchant_idempotency"),
        CheckConstraint("amount_minor > 0", name="ck_checkout_amount_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="PKR", nullable=False)
    status: Mapped[CheckoutSessionStatus] = mapped_column(
        Enum(CheckoutSessionStatus, name="checkout_session_status"),
        default=CheckoutSessionStatus.CREATED,
        nullable=False,
    )
    method: Mapped[PaymentMethod | None] = mapped_column(Enum(PaymentMethod, name="payment_method"), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    return_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    session_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    merchant: Mapped["Merchant"] = relationship(back_populates="checkout_sessions")
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="checkout_session", cascade="all, delete-orphan"
    )
