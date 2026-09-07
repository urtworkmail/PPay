import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class SessionRevokedReason:
    USER = "user"  # signed out from the sessions page
    PASSWORD_CHANGE = "password_change"
    TOKEN_REUSE = "token_reuse"  # an already-rotated refresh token was replayed
    ACCOUNT_CLOSED = "account_closed"


class Session(Base):
    """One signed-in device — not one login, and not one refresh token.

    A session is keyed on the device it belongs to, so signing in again from a
    browser you're already signed in on continues the existing session instead
    of stacking up a new row every time. That's what makes the "active
    sessions" list mean what people expect it to mean: devices, not events.

    `device_id` is an opaque identifier the client generates once and stores
    locally. It is emphatically **not** a credential: it is only ever read
    after the request has already been authenticated, and its sole job is to
    group rows for a user who has already proven who they are. Presenting
    someone else's device id gains an attacker nothing, because they still need
    that account's password to reach any code path that reads it.

    The refresh token is rotated on every use and the new jti is written back
    to `refresh_jti` here. Presenting a jti that this row has already rotated
    past means a token was captured and replayed, so the whole session is
    revoked rather than merely refused — see `api/v1/auth.py::refresh`.

    Access tokens stay stateless and short-lived (no DB hit per request); only
    the refresh flow reads this table, so revoking a session takes effect the
    next time that refresh token would otherwise be used.
    """

    __tablename__ = "sessions"
    __table_args__ = (
        Index("ix_sessions_user_device", "user_id", "device_id"),
        Index("ix_sessions_user_active", "user_id", "revoked_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_jti: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    device_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    device_label: Mapped[str | None] = mapped_column(String(120), nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # When the current refresh token stops working. A session past this point
    # is dead whether or not anyone revoked it, and is filtered out of the
    # active list rather than lingering as a phantom "signed-in" device.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)

    user: Mapped["User"] = relationship()
