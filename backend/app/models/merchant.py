import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

DEFAULT_ENABLED_PAYMENT_METHODS = ["card", "wallet", "bank_transfer"]


class MerchantStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class MerchantLiveStatus(StrEnum):
    SANDBOX_ONLY = "sandbox_only"
    PENDING_REVIEW = "pending_review"
    LIVE = "live"


class PayoutSchedule(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(2), default="PK")
    status: Mapped[MerchantStatus] = mapped_column(
        Enum(MerchantStatus, name="merchant_status"), default=MerchantStatus.ACTIVE, nullable=False
    )
    live_status: Mapped[MerchantLiveStatus] = mapped_column(
        Enum(MerchantLiveStatus, name="merchant_live_status"), default=MerchantLiveStatus.SANDBOX_ONLY, nullable=False
    )

    # Business profile
    support_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    support_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    business_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    business_website: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    statement_descriptor: Mapped[str | None] = mapped_column(String(22), nullable=True)

    # Branding
    logo_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    brand_color: Mapped[str | None] = mapped_column(String(7), nullable=True)

    # Payout settings
    payout_bank_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    payout_bank_account_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payout_schedule: Mapped[PayoutSchedule] = mapped_column(
        Enum(PayoutSchedule, name="payout_schedule"), default=PayoutSchedule.WEEKLY, nullable=False
    )

    # Payments / checkout policies
    enabled_payment_methods: Mapped[list] = mapped_column(
        JSONB, default=lambda: list(DEFAULT_ENABLED_PAYMENT_METHODS), nullable=False
    )
    checkout_terms_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    checkout_privacy_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # Billing settings
    invoice_footer: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    users: Mapped[list["User"]] = relationship(back_populates="merchant", cascade="all, delete-orphan")
    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="merchant", cascade="all, delete-orphan")
    checkout_sessions: Mapped[list["CheckoutSession"]] = relationship(
        back_populates="merchant", cascade="all, delete-orphan"
    )
    webhook_endpoints: Mapped[list["WebhookEndpoint"]] = relationship(
        back_populates="merchant", cascade="all, delete-orphan"
    )
