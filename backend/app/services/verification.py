"""Issue and redeem emailed one-time codes.

One place owns the rules every email-verification flow shares — signup
confirmation, notification-address confirmation, password reset, emailed login
OTP — so the security properties can't drift apart between call sites:

* codes are random 6-digit values, stored only as keyed digests;
* any previously issued, unconsumed code for the same (email, purpose) is
  invalidated the moment a new one is issued, so a resend can't leave two live
  codes in circulation;
* a code expires after `otp_expiry_minutes` and dies after
  `otp_max_attempts` wrong guesses, which is what makes a 6-digit secret safe;
* redemption is single-use and marked, never deleted.

Callers get a coarse `VerificationResult` rather than a detailed reason so
endpoints can respond identically to "wrong code", "expired", and "no such
pending verification" — the difference is useful to an attacker and useless to
a legitimate user.
"""

import uuid
from datetime import datetime, timedelta, timezone
from enum import StrEnum

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    generate_otp_code,
    generate_verification_token,
    hash_verification_secret,
    verify_verification_secret,
)
from app.models.email_verification import EmailVerification, VerificationPurpose
from app.services.email import send_verification_code

settings = get_settings()

PURPOSE_LABELS: dict[str, str] = {
    VerificationPurpose.SIGNUP: "confirm your email address",
    VerificationPurpose.NOTIFICATION_EMAIL: "confirm this address for PPay notifications",
    VerificationPurpose.PASSWORD_RESET: "reset your PPay password",
    VerificationPurpose.LOGIN_OTP: "finish signing in to PPay",
    VerificationPurpose.EMAIL_CHANGE: "confirm your new email address",
}


class VerificationResult(StrEnum):
    OK = "ok"
    INVALID = "invalid"  # unknown, wrong, expired, already used, or out of attempts


async def issue_verification(
    db: AsyncSession,
    *,
    email: str,
    purpose: str,
    user_id: uuid.UUID | None = None,
    send: bool = True,
    link_path: str | None = None,
) -> EmailVerification:
    """Create (and normally email) a fresh code, retiring any earlier one."""
    email = email.strip().lower()
    now = datetime.now(timezone.utc)

    # Retire outstanding codes for this address+purpose so only the newest works.
    await db.execute(
        update(EmailVerification)
        .where(
            EmailVerification.email == email,
            EmailVerification.purpose == purpose,
            EmailVerification.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )

    code = generate_otp_code()
    token = generate_verification_token()
    record = EmailVerification(
        user_id=user_id,
        email=email,
        purpose=purpose,
        code_hash=hash_verification_secret(code),
        token_hash=hash_verification_secret(token),
        expires_at=now + timedelta(minutes=settings.otp_expiry_minutes),
    )
    db.add(record)
    await db.flush()

    if send:
        link = None
        if link_path:
            link = f"{settings.app_base_url.rstrip('/')}{link_path}?token={token}&email={email}"
        await send_verification_code(
            to_email=email,
            code=code,
            purpose_label=PURPOSE_LABELS.get(purpose, "verify your email address"),
            link=link,
        )
    return record


async def _load_pending(db: AsyncSession, *, email: str, purpose: str) -> EmailVerification | None:
    result = await db.execute(
        select(EmailVerification)
        .where(
            EmailVerification.email == email.strip().lower(),
            EmailVerification.purpose == purpose,
            EmailVerification.consumed_at.is_(None),
        )
        .order_by(EmailVerification.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def redeem_code(db: AsyncSession, *, email: str, purpose: str, code: str) -> tuple[VerificationResult, EmailVerification | None]:
    record = await _load_pending(db, email=email, purpose=purpose)
    if record is None:
        return VerificationResult.INVALID, None

    now = datetime.now(timezone.utc)
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now or record.attempts >= settings.otp_max_attempts:
        record.consumed_at = now
        await db.flush()
        return VerificationResult.INVALID, None

    if not verify_verification_secret(code.strip(), record.code_hash):
        # Count the miss; the row dies on its own once attempts run out.
        record.attempts += 1
        if record.attempts >= settings.otp_max_attempts:
            record.consumed_at = now
        await db.flush()
        return VerificationResult.INVALID, None

    record.consumed_at = now
    await db.flush()
    return VerificationResult.OK, record


async def redeem_token(db: AsyncSession, *, purpose: str, token: str) -> tuple[VerificationResult, EmailVerification | None]:
    """Same redemption, reached by clicking the link in the email instead."""
    result = await db.execute(
        select(EmailVerification)
        .where(
            EmailVerification.purpose == purpose,
            EmailVerification.token_hash == hash_verification_secret(token),
            EmailVerification.consumed_at.is_(None),
        )
        .limit(1)
    )
    record = result.scalar_one_or_none()
    if record is None:
        return VerificationResult.INVALID, None

    now = datetime.now(timezone.utc)
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        record.consumed_at = now
        await db.flush()
        return VerificationResult.INVALID, None

    record.consumed_at = now
    await db.flush()
    return VerificationResult.OK, record
