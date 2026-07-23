import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class Event(Base):
    """Immutable record of a state transition (architecture spec §8) —
    `payment_intent.succeeded`, `invoice.paid`, `charge.refunded`, etc.
    Never updated after insert.

    Delivery to a merchant's webhook endpoint(s) is tracked separately in
    `WebhookLog` (one row per endpoint per event), since a merchant can have
    more than one active endpoint subscribed to the same event type — folding
    delivery-attempt state directly onto this row would only work for the
    single-endpoint case.
    """

    __tablename__ = "events"
    __table_args__ = {"schema": TENANT_SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    livemode: Mapped[bool] = mapped_column(Boolean, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship()
