import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class VerificationPurpose(StrEnum):
    SIGNUP = "signup"  # confirm the login address on a new account
    NOTIFICATION_EMAIL = "notification_email"  # confirm an alternate delivery address
    PASSWORD_RESET = "password_reset"
    LOGIN_OTP = "login_otp"  # emailed second factor for accounts without TOTP
    EMAIL_CHANGE = "email_change"


class EmailVerification(Base):
    """A pending emailed one-time code (and optional magic link token).

    Global (public schema) — verification is about a person's address, not
    about sandbox or live data.

    Neither secret is stored in the clear: `code_hash` and `token_hash` hold
    HMAC-SHA256 digests keyed by the app secret (see `core.security`). A stolen
    database snapshot therefore can't be replayed against these endpoints, and
    a code is only ever compared in constant time.

    Rows are consumed (`consumed_at`) rather than deleted, so a replay of an
    already-used code is a distinguishable, logged event instead of a silent
    miss — and the no-delete data policy holds here too.
    """

    __tablename__ = "email_verifications"
    __table_args__ = (
        Index("ix_email_verifications_lookup", "email", "purpose", "consumed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)

    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()
