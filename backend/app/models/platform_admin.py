import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class PlatformAdmin(Base):
    """The platform operator (super admin) — not scoped to any merchant, not
    part of the sandbox/production split, lives in the shared `public` schema
    same as `Merchant`/`User`. Distinct from a merchant's own `UserRole.OWNER`:
    a merchant Owner manages their own account; a PlatformAdmin can act across
    every merchant (currently: archiving live data — see
    app/services/archive_engine.py).

    2FA is mandatory, not optional like merchant `User.totp_enabled` — login
    is rejected until `totp_enabled` is true. `archive_passphrase_hash` is a
    second, separate secret required to actually execute an archive (never
    the login password) — a step-up confirmation so a hijacked login session
    alone can't move data.
    """

    __tablename__ = "platform_admins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archive_passphrase_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
