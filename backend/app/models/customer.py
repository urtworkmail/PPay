import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class Customer(Base):
    """The real buyer entity — replaces the ad hoc `customer_email`/`customer_phone`
    string pair scattered across CheckoutSession/Invoice/SavedPaymentMethod.

    Tenant-scoped like all transactional data: a customer created in test mode
    is a separate record from a customer with the same email in live mode,
    matching Stripe's own test/live customer separation.
    """

    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("merchant_id", "email", name="uq_customer_merchant_email"),
        {"schema": TENANT_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    cnic: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship()
