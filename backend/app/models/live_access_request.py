import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class LiveAccessStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class BusinessType(StrEnum):
    UNREGISTERED = "unregistered"
    SOLE_PROPRIETORSHIP = "sole_proprietorship"
    PARTNERSHIP = "partnership"
    PRIVATE_LIMITED = "private_limited"
    NONPROFIT = "nonprofit"


class LiveAccessRequest(Base):
    """A merchant's application to move from sandbox to real-money processing.

    Approving this is a manual, human review step (KYC/business verification) —
    there is deliberately no code path that auto-approves it. Field set is
    modeled on what a Pakistani payment gateway actually needs for SBP/FBR
    compliance (NTN, CNIC) rather than copying US-specific fields like EIN/SSN.
    """

    __tablename__ = "live_access_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    # Business
    business_type: Mapped[BusinessType] = mapped_column(
        Enum(BusinessType, name="business_type"), default=BusinessType.UNREGISTERED, nullable=False
    )
    legal_business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_category: Mapped[str] = mapped_column(String(120), nullable=False)
    registration_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    national_tax_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    business_address: Mapped[str] = mapped_column(String(500), nullable=False)
    website_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # Products/services
    product_description: Mapped[str] = mapped_column(Text, nullable=False)

    # Account representative
    representative_full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    representative_cnic: Mapped[str] = mapped_column(String(20), nullable=False)
    representative_dob: Mapped[date] = mapped_column(Date, nullable=False)
    representative_address: Mapped[str] = mapped_column(String(500), nullable=False)

    # Payout
    bank_name: Mapped[str] = mapped_column(String(120), nullable=False)
    bank_account_number: Mapped[str] = mapped_column(String(64), nullable=False)

    contact_phone: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms_accepted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[LiveAccessStatus] = mapped_column(
        Enum(LiveAccessStatus, name="live_access_status"), default=LiveAccessStatus.PENDING_REVIEW, nullable=False
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    merchant: Mapped["Merchant"] = relationship()
