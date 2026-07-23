import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class ReconciliationRecord(Base):
    """One row per match/mismatch between our `PaymentIntent` state and a
    rail's settlement statement (architecture spec §6). Written by the
    reconciliation job (Phase 4 of the rebuild plan) — this table exists now
    so `PaymentIntent.requires_reconciliation` has somewhere to be resolved
    from once that job is built.

    Mismatches (`mismatch=True`) are never auto-corrected by the job itself;
    `resolved_at` stays null until a human ops action clears them.
    """

    __tablename__ = "reconciliation_records"
    __table_args__ = {"schema": TENANT_SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_intent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.payment_intents.id", ondelete="CASCADE"), nullable=False
    )
    provider_statement_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    provider_reported_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    platform_status: Mapped[str] = mapped_column(String(64), nullable=False)
    mismatch: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payment_intent: Mapped["PaymentIntent"] = relationship()
