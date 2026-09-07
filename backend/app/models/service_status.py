import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ServiceStatus(StrEnum):
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    DOWN = "down"
    MAINTENANCE = "maintenance"
    UNKNOWN = "unknown"


class ServiceStatusCheck(Base):
    """One monitored capability of the platform.

    Platform-global infrastructure, deliberately outside every merchant's
    reach: rows live in the `public` schema (not the tenant schemas), are
    seeded and edited only by the platform super admin, and no merchant-facing
    endpoint can create, modify, pause, or delete one. Merchants and the public
    status page get a read-only, sanitised projection.

    `target_path` is the internal route the monitor probes and is never
    serialised to any public or merchant response — the status page names the
    capability ("Hosted checkout"), never the URL that implements it, so the
    page can't be read as a map of the API's attack surface.
    """

    __tablename__ = "service_status_checks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    # Public-facing description of the capability.
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    category: Mapped[str] = mapped_column(String(64), default="Platform", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

    # Internal probe definition — never exposed outside the super-admin API.
    target_path: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(8), default="GET", nullable=False)
    expected_status: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    # A response slower than this is reported as degraded rather than down.
    degraded_ms: Mapped[int] = mapped_column(Integer, default=2000, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    status: Mapped[str] = mapped_column(String(16), default=ServiceStatus.UNKNOWN, nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_ok_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    down_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Internal diagnostic text (may contain host/path detail) — super admin only.
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Drives the alert cadence: first failure alerts immediately, then at most
    # once per `status_alert_repeat_minutes` for as long as it stays down.
    last_alert_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ServiceStatusIncident(Base):
    """An open or resolved outage window for one check — the history behind the
    status page's "recent incidents" list and its uptime figure.

    Append-only in spirit: a row is opened when a check starts failing and
    closed (`resolved_at`) when it recovers. Nothing deletes incidents.
    """

    __tablename__ = "service_status_incidents"
    __table_args__ = (Index("ix_status_incidents_check_started", "check_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    check_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("service_status_checks.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), default=ServiceStatus.DOWN, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    alerts_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    check: Mapped["ServiceStatusCheck"] = relationship()
