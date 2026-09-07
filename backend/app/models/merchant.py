import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
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


class TaxFilerStatus(StrEnum):
    """FBR active taxpayer list status — determines the withholding tax rate
    applied to payments (non-filers are withheld at a materially higher rate
    under the Income Tax Ordinance). `UNKNOWN` is the honest default: PPay has
    no way to verify FBR status on its own, so tax figures shown before the
    merchant sets this explicitly are marked accordingly rather than assuming
    filer status."""

    UNKNOWN = "unknown"
    FILER = "filer"
    NON_FILER = "non_filer"


class TaxProvince(StrEnum):
    """Which provincial (or federal-territory) revenue authority's Sales Tax on
    Services applies — Pakistan taxes services provincially, not federally, so
    this alone (not `country`) determines the sales tax rate."""

    PUNJAB = "punjab"
    SINDH = "sindh"
    KHYBER_PAKHTUNKHWA = "khyber_pakhtunkhwa"
    BALOCHISTAN = "balochistan"
    ISLAMABAD_CAPITAL_TERRITORY = "islamabad_capital_territory"


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
    # Micro-deposit verification that the merchant controls this bank account
    # — see services/bank_verification.py. Cleared whenever the account number
    # changes (a different account has proven nothing).
    payout_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payout_verification_amount_1: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payout_verification_amount_2: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payout_verification_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    payout_verification_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Payments / checkout policies
    enabled_payment_methods: Mapped[list] = mapped_column(
        JSONB, default=lambda: list(DEFAULT_ENABLED_PAYMENT_METHODS), nullable=False
    )
    checkout_terms_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    checkout_privacy_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # Billing settings
    invoice_footer: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Tax registration — see services/tax_calculator.py for how these drive
    # the sales-tax and withholding-tax figures on the Tax report.
    national_tax_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sales_tax_registration_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    tax_filer_status: Mapped[TaxFilerStatus] = mapped_column(
        Enum(TaxFilerStatus, name="tax_filer_status"), default=TaxFilerStatus.UNKNOWN, nullable=False
    )
    tax_province: Mapped[TaxProvince | None] = mapped_column(
        Enum(TaxProvince, name="tax_province"), nullable=True
    )

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
