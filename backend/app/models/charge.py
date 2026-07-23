import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class ChargeStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REQUIRES_RECONCILIATION = "requires_reconciliation"


class Charge(Base):
    """One rail-execution attempt against a `PaymentIntent`. A single intent
    can have multiple charges if earlier attempts failed and the customer
    retried with a different method — the intent is the durable object,
    charges are its attempt history (architecture spec §2.2).
    """

    __tablename__ = "charges"
    __table_args__ = {"schema": TENANT_SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_intent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.payment_intents.id", ondelete="CASCADE"), nullable=False
    )
    adapter_name: Mapped[str] = mapped_column(String(64), nullable=False)
    rail_reference_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    fee_minor: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    net_amount_minor: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    status: Mapped[ChargeStatus] = mapped_column(
        Enum(ChargeStatus, name="charge_status"), default=ChargeStatus.PENDING, nullable=False
    )
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_response_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    payment_intent: Mapped["PaymentIntent"] = relationship(back_populates="charges")
