import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class WebsiteVisit(Base):
    """One page load of the public marketing site (ppay.silicatelabs.site),
    not the merchant dashboard app — that already has its own IP/location
    tracking on `Session` (see `services/geoip.py`).

    Platform-global, like `ServiceStatusCheck` — lives in the `public`
    schema, untouched by the sandbox/production tenant split, since a
    marketing-site page view has no merchant or mode to attach to.

    Recorded via a public, unauthenticated beacon (`POST
    /api/v1/public/track-visit`) fired from `website/shared.js` on every
    page load; read back only through the platform-admin-gated list
    endpoint in the same router.
    """

    __tablename__ = "website_visits"
    __table_args__ = (Index("ix_website_visits_created_at", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    referrer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    region: Mapped[str | None] = mapped_column(String(120), nullable=True)
    country: Mapped[str | None] = mapped_column(String(120), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
