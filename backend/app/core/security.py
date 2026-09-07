import base64
import hashlib
import hmac
import secrets
import struct
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import bcrypt
from jose import jwt

from app.core.config import get_settings

settings = get_settings()

# bcrypt only uses the first 72 bytes of input; truncate consistently on both
# hash and verify so longer passwords/API keys don't raise or silently mismatch.
_BCRYPT_MAX_BYTES = 72


def _prepare(value: str) -> bytes:
    return value.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prepare(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(_prepare(password), password_hash.encode("utf-8"))


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, jti: str | None = None, session_id: str | None = None) -> str:
    """Mint a refresh token.

    `session_id` binds the token to the Session row it belongs to, which is
    what makes rotation auditable: on refresh the server looks the session up
    by `sid` and compares the presented `jti` to the one it last issued. A
    mismatch means an already-rotated token was replayed, which is treated as
    theft rather than as a simple expiry (see api/v1/auth.py::refresh).
    """
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    jti = jti or secrets.token_urlsafe(16)
    payload = {"sub": subject, "exp": expire, "type": "refresh", "jti": jti}
    if session_id:
        payload["sid"] = session_id
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def create_platform_admin_token(subject: str) -> str:
    """A distinct token `type` from merchant User access tokens — a merchant
    JWT must never be accepted by a PlatformAdmin-only endpoint, or vice
    versa, even though both are signed with the same JWT secret."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire, "type": "platform_admin_access"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def generate_api_key(mode: str = "sandbox") -> tuple[str, str, str]:
    """Returns (full_key, key_prefix, raw_secret_to_hash)."""
    raw = secrets.token_urlsafe(32)
    prefix = f"sk_{mode}"
    full_key = f"{prefix}_{raw}"
    return full_key, prefix, raw


def hash_api_key(full_key: str) -> str:
    return bcrypt.hashpw(_prepare(full_key), bcrypt.gensalt()).decode("utf-8")


def verify_api_key(full_key: str, hashed_key: str) -> bool:
    return bcrypt.checkpw(_prepare(full_key), hashed_key.encode("utf-8"))


def generate_webhook_secret() -> str:
    return f"whsec_{secrets.token_urlsafe(24)}"


# --- Emailed one-time codes and verification links --------------------------
# A 6-digit code has only a million possibilities, so its security comes from
# being short-lived and attempt-limited (see EmailVerification), not from a
# slow hash. Storing an HMAC keyed by the app secret — rather than bcrypt or a
# bare SHA — keeps verification fast while making a leaked database row
# useless on its own: without the server key, the digest can't be brute-forced
# offline through its tiny keyspace.


def generate_otp_code(digits: int = 6) -> str:
    return str(secrets.randbelow(10**digits)).zfill(digits)


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


def hash_verification_secret(value: str) -> str:
    return hmac.new(settings.jwt_secret_key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_verification_secret(value: str, digest: str) -> bool:
    return hmac.compare_digest(hash_verification_secret(value), digest)


# --- TOTP (RFC 6238) two-factor authentication -----------------------------
# Hand-rolled with stdlib hmac/hashlib rather than pulling in a library —
# mirrors the same choice already made for webhook HMAC signing
# (webhook_dispatcher.py::sign_payload). No QR image is generated (that would
# need qrcode/Pillow); the secret and otpauth:// URI are shown as text, which
# every authenticator app accepts via manual entry.
_TOTP_STEP_SECONDS = 30
_TOTP_DIGITS = 6


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8").rstrip("=")


def _totp_code_at(secret: str, counter: int) -> str:
    # Base32 secrets need to be padded back out to a multiple of 8 chars to decode.
    padded = secret + "=" * (-len(secret) % 8)
    key = base64.b32decode(padded.upper())
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    truncated = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(truncated % (10**_TOTP_DIGITS)).zfill(_TOTP_DIGITS)


def verify_totp_code(secret: str, code: str) -> bool:
    if not code or not code.isdigit():
        return False
    counter = int(time.time()) // _TOTP_STEP_SECONDS
    # Allow the immediately preceding/following step to tolerate clock drift.
    return any(hmac.compare_digest(_totp_code_at(secret, counter + offset), code) for offset in (-1, 0, 1))


def totp_uri(secret: str, email: str, issuer: str = "PPay") -> str:
    label = quote(f"{issuer}:{email}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits={_TOTP_DIGITS}&period={_TOTP_STEP_SECONDS}"
