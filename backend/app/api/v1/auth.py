import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, get_current_user, require_role
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
from app.models.live_access_request import LiveAccessRequest
from app.models.merchant import Merchant, MerchantLiveStatus
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import (
    ApiKeyCreateResponse,
    ApiKeyPublic,
    GoLiveRequest,
    GoLiveResponse,
    MerchantLoginRequest,
    MerchantProfile,
    MerchantRegisterRequest,
    RefreshRequest,
    TokenPair,
)
from app.schemas.user import ChangePasswordRequest, UserProfile

router = APIRouter(prefix="/auth", tags=["auth"])
merchants_router = APIRouter(prefix="/merchants", tags=["merchants"])
users_router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(payload: MerchantRegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    merchant = Merchant(business_name=payload.business_name, email=payload.email)
    db.add(merchant)
    await db.flush()

    owner = User(
        merchant_id=merchant.id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.OWNER,
        status=UserStatus.ACTIVE,
    )
    db.add(owner)
    await db.commit()
    await db.refresh(owner)

    return TokenPair(
        access_token=create_access_token(str(owner.id)),
        refresh_token=create_refresh_token(str(owner.id)),
    )


@router.post("/login", response_model=TokenPair)
async def login(payload: MerchantLoginRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if (
        user is None
        or user.password_hash is None
        or user.status != UserStatus.ACTIVE
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = uuid.UUID(decoded["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token") from exc

    user = await db.get(User, user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@merchants_router.get("/me", response_model=MerchantProfile)
async def get_profile(merchant: Merchant = Depends(get_current_merchant)) -> Merchant:
    return merchant


@users_router.get("/me", response_model=UserProfile)
async def get_current_user_profile(user: User = Depends(get_current_user)) -> User:
    return user


@users_router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    if user.password_hash is None or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    await db.commit()


@merchants_router.post("/me/api-keys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyCreateResponse:
    full_key, prefix, _key = generate_api_key(mode="sandbox")
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
    key_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.merchant_id == merchant.id))
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    api_key.is_active = False
    await db.commit()


@merchants_router.post("/me/go-live", response_model=GoLiveResponse, status_code=status.HTTP_201_CREATED)
async def submit_go_live_request(
    payload: GoLiveRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> LiveAccessRequest:
    result = await db.execute(select(LiveAccessRequest).where(LiveAccessRequest.merchant_id == merchant.id))
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.legal_business_name = payload.legal_business_name
        existing.business_category = payload.business_category
        existing.registration_number = payload.registration_number
        existing.website_url = payload.website_url
        existing.bank_name = payload.bank_name
        existing.bank_account_number = payload.bank_account_number
        existing.contact_phone = payload.contact_phone
        existing.notes = payload.notes
        request = existing
    else:
        request = LiveAccessRequest(merchant_id=merchant.id, **payload.model_dump())
        db.add(request)

    merchant.live_status = MerchantLiveStatus.PENDING_REVIEW
    await db.commit()
    await db.refresh(request)
    return request


@merchants_router.get("/me/go-live", response_model=GoLiveResponse)
async def get_go_live_request(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> LiveAccessRequest:
    result = await db.execute(select(LiveAccessRequest).where(LiveAccessRequest.merchant_id == merchant.id))
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No go-live request submitted yet")
    return request
