import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class CouponDuration(StrEnum):
    ONCE = "once"
    REPEATING = "repeating"
    FOREVER = "forever"


class Coupon(Base):
    __tablename__ = "coupons"
    __table_args__ = (
        UniqueConstraint("merchant_id", "code", name="uq_coupon_merchant_code"),
        CheckConstraint(
            "(percent_off IS NOT NULL) != (amount_off_minor IS NOT NULL)",
            name="ck_coupon_exactly_one_discount_type",
        ),
        {"schema": TENANT_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    percent_off: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount_off_minor: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    duration: Mapped[CouponDuration] = mapped_column(
        Enum(CouponDuration, name="coupon_duration"), default=CouponDuration.ONCE, nullable=False
    )
    duration_in_cycles: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_redemptions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    redemption_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship()


class Discount(Base):
    """Join entity — a `Coupon` redeemed onto exactly one of Subscription /
    Invoice / PaymentLink (architecture spec §2.2)."""

    __tablename__ = "discounts"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(subscription_id, invoice_id, payment_link_id) = 1",
            name="ck_discount_exactly_one_target",
        ),
        {"schema": TENANT_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coupon_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.coupons.id", ondelete="CASCADE"), nullable=False
    )
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.subscriptions.id", ondelete="CASCADE"), nullable=True
    )
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.invoices.id", ondelete="CASCADE"), nullable=True
    )
    payment_link_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.payment_links.id", ondelete="CASCADE"), nullable=True
    )
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    coupon: Mapped["Coupon"] = relationship()
