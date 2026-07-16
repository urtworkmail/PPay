import uuid
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import decode_token, verify_api_key
from app.models.api_key import ApiKey
from app.models.merchant import Merchant

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_merchant(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        merchant_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    merchant = await db.get(Merchant, merchant_id)
    if merchant is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Merchant not found")
    return merchant


async def get_merchant_from_api_key(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")
    api_key_value = authorization.removeprefix("Bearer ").strip()

    if not api_key_value.startswith("sk_"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key format")
    prefix = "_".join(api_key_value.split("_")[:2])

    result = await db.execute(
        select(ApiKey).where(ApiKey.key_prefix == prefix, ApiKey.is_active.is_(True))
    )
    candidates = result.scalars().all()

    for candidate in candidates:
        if verify_api_key(api_key_value, candidate.hashed_key):
            candidate.last_used_at = datetime.now(timezone.utc)
            merchant = await db.get(Merchant, candidate.merchant_id)
            if merchant is None:
                break
            return merchant

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


async def get_merchant_flexible(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    """Accepts either a dashboard JWT or a merchant API key.

    Read endpoints like transaction listing are used both by the merchant
    dashboard UI (JWT session) and by a merchant's own backend integration
    (API key) — this lets one route serve both callers.
    """
    if credentials is not None and credentials.credentials.startswith("sk_"):
        return await get_merchant_from_api_key(authorization=f"Bearer {credentials.credentials}", db=db)
    return await get_current_merchant(credentials=credentials, db=db)
