import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class AuditLogEntry(Base):
    """Append-only record of a data change made by a team member or owner
    within their own account. Never updated or deleted after insert.

    Indexed as an ordered, per-merchant event stream (`merchant_id`,
    `created_at`) rather than a dedicated time-series engine — see the Phase
    3 (data-retention/audit) rebuild notes for why a plain indexed Postgres
    table was chosen over standing up new infrastructure.

    Visible only to the merchant's Owner (see `api/v1/audit_log.py`) — not to
    other team members, and not part of the no-delete guarantee's exception
    (this table itself is never archived away by a merchant action; only the
    platform super admin's archive flow can move it, same as any other data).
    """

    __tablename__ = "audit_log_entries"
    __table_args__ = (
        Index("ix_audit_log_entries_merchant_created", "merchant_id", "created_at"),
        {"schema": TENANT_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    changes: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship()
