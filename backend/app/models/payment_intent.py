import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class PaymentIntentStatus(StrEnum):
    """State machine per architecture spec §5.1.

    `requires_reconciliation` is the ambiguous "rail didn't respond" state — it
    must never be reached by a normal retry, only set when a rail times out,
    and only cleared by the reconciliation job or manual ops action (Phase 4),
    never by the customer-facing retry button.
    """

    REQUIRES_PAYMENT_METHOD = "requires_payment_method"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    REQUIRES_RECONCILIATION = "requires_reconciliation"
    FAILED = "failed"
    CANCELED = "canceled"


class PaymentIntentSourceType(StrEnum):
    CHECKOUT = "checkout"
    PAYMENT_LINK = "payment_link"
    INVOICE = "invoice"
    SUBSCRIPTION = "subscription"


class PaymentIntent(Base):
    """The single orchestration object every entry point (Checkout, Payment
    Links, Invoices, Subscriptions) creates and transitions instead of talking
    to a payment rail directly (architecture principle #1).

    Not yet wired into the orchestrator in this phase (see Phase 2 of the
    rebuild plan) — this table exists so the schema and state machine are in
    place before `checkout.py` et al. are refactored to use it.
    """

    __tablename__ = "payment_intents"
    __table_args__ = (
        UniqueConstraint("merchant_id", "idempotency_key", name="uq_payment_intent_merchant_idempotency"),
        CheckConstraint("amount_minor > 0", name="ck_payment_intent_amount_positive"),
        {"schema": TENANT_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.customers.id", ondelete="SET NULL"), nullable=True
    )
    payment_method_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.saved_payment_methods.id", ondelete="SET NULL"), nullable=True
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="PKR", nullable=False)
    status: Mapped[PaymentIntentStatus] = mapped_column(
        Enum(PaymentIntentStatus, name="payment_intent_status"),
        default=PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
        nullable=False,
    )
    source_type: Mapped[PaymentIntentSourceType] = mapped_column(
        Enum(PaymentIntentSourceType, name="payment_intent_source_type"), nullable=False
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    intent_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    merchant: Mapped["Merchant"] = relationship()
    customer: Mapped["Customer | None"] = relationship()
    charges: Mapped[list["Charge"]] = relationship(back_populates="payment_intent", cascade="all, delete-orphan")
