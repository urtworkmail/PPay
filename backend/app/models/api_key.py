import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ApiKeyMode(StrEnum):
    SANDBOX = "sandbox"
    LIVE = "live"


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(32), nullable=False)
    hashed_key: Mapped[str] = mapped_column(String(255), nullable=False)
    mode: Mapped[ApiKeyMode] = mapped_column(Enum(ApiKeyMode, name="api_key_mode"), default=ApiKeyMode.SANDBOX)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    merchant: Mapped["Merchant"] = relationship(back_populates="api_keys")
