import secrets
from datetime import datetime, timedelta, timezone

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


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {"sub": subject, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


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
