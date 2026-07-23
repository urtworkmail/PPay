import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class DisputeStatus(StrEnum):
    NEEDS_RESPONSE = "needs_response"
    UNDER_REVIEW = "under_review"
    WON = "won"
    LOST = "lost"


class Dispute(Base):
    """Card-network chargeback or wallet-provider dispute against a `Charge`
    (architecture spec §4.6 / §5.4). Full lifecycle wiring (evidence upload,
    network submission, auto-loss on deadline) lands in Phase 5 of the rebuild
    plan — this table exists now so the entity and status machine exist ahead
    of that work.
    """

    __tablename__ = "disputes"
    __table_args__ = {"schema": TENANT_SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    charge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.charges.id", ondelete="CASCADE"), nullable=False
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[DisputeStatus] = mapped_column(
        Enum(DisputeStatus, name="dispute_status"), default=DisputeStatus.NEEDS_RESPONSE, nullable=False
    )
    evidence_due_by: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    evidence_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    evidence_details: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    charge: Mapped["Charge"] = relationship()
    merchant: Mapped["Merchant"] = relationship()
