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
from app.models.merchant import Merchant, MerchantStatus
from app.models.user import User, UserStatus

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    user = await db.get(User, user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def get_current_merchant(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    merchant = await db.get(Merchant, user.merchant_id)
    if merchant is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Merchant not found")
    if merchant.status == MerchantStatus.SUSPENDED:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="This account has been closed")
    return merchant


def require_role(*allowed_roles: str):
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to perform this action"
            )
        return user

    return _checker


async def _resolve_api_key(authorization: str | None, db: AsyncSession) -> tuple[Merchant, ApiKey]:
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
            if merchant is None or merchant.status == MerchantStatus.SUSPENDED:
                break
            return merchant, candidate

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


async def get_merchant_from_api_key(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    merchant, _ = await _resolve_api_key(authorization, db)
    return merchant


async def get_merchant_and_key_from_api_key(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> tuple[Merchant, ApiKey]:
    return await _resolve_api_key(authorization, db)


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
    user = await get_current_user(credentials=credentials, db=db)
    return await get_current_merchant(user=user, db=db)
