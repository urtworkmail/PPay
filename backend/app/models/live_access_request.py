import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class LiveAccessStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class LiveAccessRequest(Base):
    """A merchant's application to move from sandbox to real-money processing.

    Approving this is a manual, human review step (KYC/business verification) —
    there is deliberately no code path that auto-approves it.
    """

    __tablename__ = "live_access_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    legal_business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_category: Mapped[str] = mapped_column(String(120), nullable=False)
    registration_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    bank_name: Mapped[str] = mapped_column(String(120), nullable=False)
    bank_account_number: Mapped[str] = mapped_column(String(64), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[LiveAccessStatus] = mapped_column(
        Enum(LiveAccessStatus, name="live_access_status"), default=LiveAccessStatus.PENDING_REVIEW, nullable=False
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    merchant: Mapped["Merchant"] = relationship()
