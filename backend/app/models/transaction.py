import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class TransactionStatus(StrEnum):
    PENDING = "pending"
    AUTHORIZING = "authorizing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = {"schema": TENANT_SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    checkout_session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.checkout_sessions.id", ondelete="CASCADE"), nullable=False
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="PKR", nullable=False)
    fee_minor: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    net_amount_minor: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus, name="transaction_status"), default=TransactionStatus.PENDING, nullable=False
    )
    gateway_reference: Mapped[str | None] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_method_details: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    settled: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    checkout_session: Mapped["CheckoutSession"] = relationship(back_populates="transactions")
    merchant: Mapped["Merchant"] = relationship()
