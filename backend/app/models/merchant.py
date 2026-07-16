import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class MerchantStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str] = mapped_column(String(2), default="PK")
    status: Mapped[MerchantStatus] = mapped_column(
        Enum(MerchantStatus, name="merchant_status"), default=MerchantStatus.ACTIVE, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="merchant", cascade="all, delete-orphan")
    checkout_sessions: Mapped[list["CheckoutSession"]] = relationship(
        back_populates="merchant", cascade="all, delete-orphan"
    )
    webhook_endpoints: Mapped[list["WebhookEndpoint"]] = relationship(
        back_populates="merchant", cascade="all, delete-orphan"
    )
