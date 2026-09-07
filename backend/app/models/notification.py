import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class NotificationCategory(StrEnum):
    """What a notification is about. Doubles as the unit a user subscribes to
    for email — see `NotificationPreference.email_categories`.
    """

    PAYMENT = "payment"
    REFUND = "refund"
    DISPUTE = "dispute"
    PAYOUT = "payout"
    CUSTOMER = "customer"
    INVOICE = "invoice"
    SUBSCRIPTION = "subscription"
    PAYMENT_LINK = "payment_link"
    PRODUCT = "product"
    TEAM = "team"
    API_KEY = "api_key"
    WEBHOOK = "webhook"
    SECURITY = "security"
    ACCOUNT = "account"


class NotificationSeverity(StrEnum):
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    CRITICAL = "critical"


# Categories that email by default for a brand-new account: the ones a merchant
# would want to hear about away from the dashboard. Everything else is in-app
# only until they opt in (Settings > Notifications).
DEFAULT_EMAIL_CATEGORIES: list[str] = [
    NotificationCategory.SECURITY,
    NotificationCategory.PAYOUT,
    NotificationCategory.TEAM,
    NotificationCategory.DISPUTE,
]


class Notification(Base):
    """One in-app notification for a merchant account.

    Tenant-scoped like the rest of the merchant's data, so sandbox activity
    never shows up in a live-mode notification list (and vice versa) — the
    schema separation makes that structural rather than a filter someone has
    to remember to write.

    `user_id` is null for account-wide notifications (a payment came in);
    it's set for ones addressed to one team member (your session was revoked).
    Read state is per-notification rather than per-user for that reason: an
    account-wide notification is marked read by whoever reads it, matching how
    a shared dashboard inbox behaves.
    """

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_merchant_created", "merchant_id", "created_at"),
        Index("ix_notifications_merchant_read", "merchant_id", "read_at"),
        {"schema": TENANT_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    category: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), default=NotificationSeverity.INFO, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(String(1000), nullable=False)

    # What changed, and where to look at it in the dashboard.
    resource_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    link: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Who caused it (a team member's email, or null for system-generated) plus
    # any before/after detail worth showing on the notification's own page.
    actor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    changes: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    emailed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship()


class NotificationPreference(Base):
    """Per-user email-notification settings.

    Global (public schema), not tenant-scoped: a person's contact address and
    the categories they want emailed are a property of them, not of the
    sandbox/live mode they happen to be looking at.

    `email_address` is only used once `email_verified_at` is set — an
    unverified address is never sent to, so this can't be used to mail an
    arbitrary third party.
    """

    __tablename__ = "notification_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Null means "use the login email" (which is verified at signup).
    email_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_categories: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship()
