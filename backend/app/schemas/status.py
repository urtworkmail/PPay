import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PublicIncident(BaseModel):
    """An outage window, described without any internal detail.

    Deliberately omits the probed path and the raw error: the public page says
    *what* was affected and *when*, never *how* it is implemented or *why* it
    broke.
    """

    service: str
    status: str
    started_at: datetime
    resolved_at: datetime | None


class PublicServiceStatus(BaseModel):
    key: str
    name: str
    description: str | None
    category: str
    status: str
    is_critical: bool
    # Rounded to whole seconds so the page never doubles as a latency oracle
    # for probing internal performance.
    last_checked_at: datetime | None
    uptime_30d: float | None = Field(default=None, description="Percentage, 0-100")


class PublicStatusResponse(BaseModel):
    overall: str
    updated_at: datetime
    services: list[PublicServiceStatus]
    incidents: list[PublicIncident]


class AdminServiceStatus(BaseModel):
    """Super-admin view — includes the probe definition and error detail that
    the public projection strips out."""

    id: uuid.UUID
    key: str
    display_name: str
    description: str | None
    category: str
    sort_order: int
    target_path: str
    method: str
    expected_status: int
    degraded_ms: int
    timeout_seconds: int
    enabled: bool
    is_critical: bool
    status: str
    last_checked_at: datetime | None
    last_latency_ms: int | None
    last_ok_at: datetime | None
    down_since: datetime | None
    consecutive_failures: int
    last_error: str | None
    last_alert_at: datetime | None

    model_config = {"from_attributes": True}


class ServiceCheckCreateRequest(BaseModel):
    key: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9_]+$")
    display_name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=300)
    category: str = Field(default="Platform", max_length=64)
    target_path: str = Field(min_length=1, max_length=255)
    method: str = Field(default="GET", max_length=8)
    expected_status: int = Field(default=200, ge=100, le=599)
    degraded_ms: int = Field(default=2000, ge=1, le=60000)
    timeout_seconds: int = Field(default=10, ge=1, le=60)
    is_critical: bool = True
    sort_order: int = 100


class ServiceCheckUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=300)
    category: str | None = Field(default=None, max_length=64)
    target_path: str | None = Field(default=None, min_length=1, max_length=255)
    method: str | None = Field(default=None, max_length=8)
    expected_status: int | None = Field(default=None, ge=100, le=599)
    degraded_ms: int | None = Field(default=None, ge=1, le=60000)
    timeout_seconds: int | None = Field(default=None, ge=1, le=60)
    enabled: bool | None = None
    is_critical: bool | None = None
    sort_order: int | None = None
