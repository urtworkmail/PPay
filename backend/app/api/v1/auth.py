import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant
from app.core.db import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_api_key,
    hash_api_key,
    hash_password,
    verify_password,
)
from app.models.api_key import ApiKey
from app.models.merchant import Merchant
from app.schemas.auth import (
    ApiKeyCreateResponse,
    ApiKeyPublic,
    MerchantLoginRequest,
    MerchantProfile,
    MerchantRegisterRequest,
    RefreshRequest,
    TokenPair,
)

router = APIRouter(prefix="/auth", tags=["auth"])
merchants_router = APIRouter(prefix="/merchants", tags=["merchants"])


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(payload: MerchantRegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    existing = await db.execute(select(Merchant).where(Merchant.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    merchant = Merchant(
        business_name=payload.business_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(merchant)
    await db.commit()
    await db.refresh(merchant)

    return TokenPair(
        access_token=create_access_token(str(merchant.id)),
        refresh_token=create_refresh_token(str(merchant.id)),
    )


@router.post("/login", response_model=TokenPair)
async def login(payload: MerchantLoginRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    result = await db.execute(select(Merchant).where(Merchant.email == payload.email))
    merchant = result.scalar_one_or_none()
    if merchant is None or not verify_password(payload.password, merchant.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return TokenPair(
        access_token=create_access_token(str(merchant.id)),
        refresh_token=create_refresh_token(str(merchant.id)),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        merchant_id = uuid.UUID(decoded["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token") from exc

    merchant = await db.get(Merchant, merchant_id)
    if merchant is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Merchant not found")

    return TokenPair(
        access_token=create_access_token(str(merchant.id)),
        refresh_token=create_refresh_token(str(merchant.id)),
    )


@merchants_router.get("/me", response_model=MerchantProfile)
async def get_profile(merchant: Merchant = Depends(get_current_merchant)) -> Merchant:
    return merchant


@merchants_router.post("/me/api-keys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> ApiKeyCreateResponse:
    full_key, prefix, _ = generate_api_key(mode="sandbox")
    api_key = ApiKey(merchant_id=merchant.id, key_prefix=prefix, hashed_key=hash_api_key(full_key))
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return ApiKeyCreateResponse(id=api_key.id, key_prefix=prefix, mode=api_key.mode, full_key=full_key)


@merchants_router.get("/me/api-keys", response_model=list[ApiKeyPublic])
async def list_api_keys(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[ApiKey]:
    result = await db.execute(select(ApiKey).where(ApiKey.merchant_id == merchant.id).order_by(ApiKey.created_at.desc()))
    return list(result.scalars().all())


@merchants_router.delete("/me/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID, merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.merchant_id == merchant.id))
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    api_key.is_active = False
    await db.commit()
