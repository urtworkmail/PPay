import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
    generate_totp_secret,
    hash_api_key,
    hash_password,
    totp_uri,
    verify_password,
    verify_totp_code,
)
from app.models.api_key import ApiKey
from app.models.checkout_session import PaymentMethod
from app.models.live_access_request import BusinessType, LiveAccessRequest
from app.models.merchant import Merchant, MerchantLiveStatus, MerchantStatus, PayoutSchedule
from app.models.session import Session as UserSession
from app.models.user import User, UserRole, UserStatus
from app.services.audit_log import record_audit_event
from app.schemas.auth import (
    ActivationChecklistItem,
    ActivationChecklistResponse,
    ApiKeyCreateResponse,
    ApiKeyPublic,
    BillingSettingsUpdateRequest,
    BrandingSettingsUpdateRequest,
    BusinessSettingsUpdateRequest,
    CloseAccountRequest,
    GoLiveRequest,
    GoLiveResponse,
    MerchantLoginRequest,
    MerchantProfile,
    MerchantRegisterRequest,
    PaymentsSettingsUpdateRequest,
    PayoutSettingsUpdateRequest,
    RefreshRequest,
    TokenPair,
)
from app.schemas.user import (
    ChangePasswordRequest,
    SessionResponse,
    TotpDisableRequest,
    TotpEnrollResponse,
    TotpVerifyRequest,
    UserProfile,
)

router = APIRouter(prefix="/auth", tags=["auth"])
merchants_router = APIRouter(prefix="/merchants", tags=["merchants"])
users_router = APIRouter(prefix="/users", tags=["users"])

REAL_PAYMENT_METHODS = {PaymentMethod.CARD.value, PaymentMethod.WALLET.value, PaymentMethod.BANK_TRANSFER.value}


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _create_session(db: AsyncSession, user: User, request: Request) -> str:
    """Issues a refresh token and records the Session row backing it."""
    refresh_token = create_refresh_token(str(user.id))
    jti = decode_token(refresh_token)["jti"]
    db.add(
        UserSession(
            user_id=user.id,
            refresh_jti=jti,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    )
    return refresh_token


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(payload: MerchantRegisterRequest, request: Request, db: AsyncSession = Depends(get_db)) -> TokenPair:
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
    await db.flush()

    refresh_token = await _create_session(db, owner, request)
    await db.commit()

    return TokenPair(access_token=create_access_token(str(owner.id)), refresh_token=refresh_token)


@router.post("/login", response_model=TokenPair)
async def login(payload: MerchantLoginRequest, request: Request, db: AsyncSession = Depends(get_db)) -> TokenPair:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if (
        user is None
        or user.password_hash is None
        or user.status != UserStatus.ACTIVE
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    merchant = await db.get(Merchant, user.merchant_id)
    if merchant is not None and merchant.status == MerchantStatus.SUSPENDED:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="This account has been closed")

    if user.totp_enabled:
        if not payload.totp_code:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="totp_required")
        if not verify_totp_code(user.totp_secret, payload.totp_code):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid two-factor code")

    user.last_login_at = datetime.now(timezone.utc)
    refresh_token = await _create_session(db, user, request)
    await db.commit()

    return TokenPair(access_token=create_access_token(str(user.id)), refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = uuid.UUID(decoded["sub"])
        jti = decoded["jti"]
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token") from exc

    user = await db.get(User, user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    session_result = await db.execute(select(UserSession).where(UserSession.refresh_jti == jti))
    session = session_result.scalar_one_or_none()
    if session is None or session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked")

    # Rotate the refresh token but keep the same Session row (and its history/id)
    # so "active sessions" reads as one continuous session, not a new one per refresh.
    new_refresh_token = create_refresh_token(str(user.id))
    session.refresh_jti = decode_token(new_refresh_token)["jti"]
    session.last_seen_at = datetime.now(timezone.utc)
    session.ip_address = _client_ip(request)
    session.user_agent = request.headers.get("user-agent")
    await db.commit()

    return TokenPair(access_token=create_access_token(str(user.id)), refresh_token=new_refresh_token)


@merchants_router.get("/me", response_model=MerchantProfile)
async def get_profile(merchant: Merchant = Depends(get_current_merchant)) -> Merchant:
    return merchant


@merchants_router.patch("/me/business", response_model=MerchantProfile)
async def update_business_settings(
    payload: BusinessSettingsUpdateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    merchant.business_name = payload.business_name
    merchant.support_email = payload.support_email
    merchant.support_phone = payload.support_phone
    merchant.business_address = payload.business_address
    merchant.business_website = payload.business_website
    merchant.statement_descriptor = payload.statement_descriptor
    await db.commit()
    await db.refresh(merchant)
    return merchant


@merchants_router.patch("/me/branding", response_model=MerchantProfile)
async def update_branding_settings(
    payload: BrandingSettingsUpdateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    merchant.logo_url = payload.logo_url
    merchant.brand_color = payload.brand_color
    await db.commit()
    await db.refresh(merchant)
    return merchant


@merchants_router.patch("/me/payout", response_model=MerchantProfile)
async def update_payout_settings(
    payload: PayoutSettingsUpdateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    try:
        schedule = PayoutSchedule(payload.payout_schedule)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payout_schedule") from exc

    merchant.payout_bank_name = payload.payout_bank_name
    merchant.payout_bank_account_number = payload.payout_bank_account_number
    merchant.payout_schedule = schedule
    await db.commit()
    await db.refresh(merchant)
    return merchant


@merchants_router.patch("/me/payments", response_model=MerchantProfile)
async def update_payments_settings(
    payload: PaymentsSettingsUpdateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    unknown = [m for m in payload.enabled_payment_methods if m not in REAL_PAYMENT_METHODS]
    if unknown:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown payment method(s): {', '.join(unknown)}")

    merchant.enabled_payment_methods = payload.enabled_payment_methods
    merchant.checkout_terms_url = payload.checkout_terms_url
    merchant.checkout_privacy_url = payload.checkout_privacy_url
    await db.commit()
    await db.refresh(merchant)
    return merchant


@merchants_router.patch("/me/billing", response_model=MerchantProfile)
async def update_billing_settings(
    payload: BillingSettingsUpdateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    merchant.invoice_footer = payload.invoice_footer
    await db.commit()
    await db.refresh(merchant)
    return merchant


@merchants_router.get("/me/activation-checklist", response_model=ActivationChecklistResponse)
async def get_activation_checklist(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> ActivationChecklistResponse:
    key_result = await db.execute(select(ApiKey).where(ApiKey.merchant_id == merchant.id, ApiKey.is_active.is_(True)))
    has_api_key = key_result.first() is not None

    owner_result = await db.execute(
        select(User).where(User.merchant_id == merchant.id, User.role == UserRole.OWNER, User.status == UserStatus.ACTIVE)
    )
    owners = list(owner_result.scalars().all())
    owner_has_2fa = any(o.totp_enabled for o in owners)

    items = [
        ActivationChecklistItem(
            key="business_profile",
            label="Business profile filled in",
            complete=bool(merchant.support_email and merchant.business_address),
            required=True,
            settings_path="/dashboard/settings/business",
        ),
        ActivationChecklistItem(
            key="payout",
            label="Payout bank account added",
            complete=bool(merchant.payout_bank_name and merchant.payout_bank_account_number),
            required=True,
            settings_path="/dashboard/settings/payout",
        ),
        ActivationChecklistItem(
            key="go_live",
            label="Go-Live application approved",
            complete=merchant.live_status == MerchantLiveStatus.LIVE,
            required=True,
            settings_path="/dashboard/go-live",
        ),
        ActivationChecklistItem(
            key="api_key",
            label="At least one active API key",
            complete=has_api_key,
            required=True,
            settings_path="/dashboard/api-keys",
        ),
        ActivationChecklistItem(
            key="branding",
            label="Branding set (logo/brand color)",
            complete=bool(merchant.logo_url or merchant.brand_color),
            required=False,
            settings_path="/dashboard/settings/branding",
        ),
        ActivationChecklistItem(
            key="checkout_policies",
            label="Checkout Terms/Privacy links set",
            complete=bool(merchant.checkout_terms_url or merchant.checkout_privacy_url),
            required=False,
            settings_path="/dashboard/settings/payments",
        ),
        ActivationChecklistItem(
            key="payment_methods",
            label="Payment methods reviewed",
            complete=len(merchant.enabled_payment_methods) > 0,
            required=False,
            settings_path="/dashboard/settings/payments",
        ),
        ActivationChecklistItem(
            key="two_factor",
            label="Two-factor authentication enabled (owner)",
            complete=owner_has_2fa,
            required=False,
            settings_path="/dashboard/settings/personal",
        ),
    ]
    ready = all(item.complete for item in items if item.required)
    return ActivationChecklistResponse(ready=ready, items=items)


@merchants_router.post("/me/close", status_code=status.HTTP_204_NO_CONTENT)
async def close_account(
    payload: CloseAccountRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db),
) -> None:
    if payload.business_name_confirmation != merchant.business_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business name doesn't match")

    merchant.status = MerchantStatus.SUSPENDED
    user_ids_result = await db.execute(select(User.id).where(User.merchant_id == merchant.id))
    user_ids = [row[0] for row in user_ids_result.all()]
    if user_ids:
        sessions_result = await db.execute(
            select(UserSession).where(UserSession.user_id.in_(user_ids), UserSession.revoked_at.is_(None))
        )
        for session in sessions_result.scalars().all():
            session.revoked_at = datetime.now(timezone.utc)
    await db.commit()


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


@users_router.post("/me/totp/enroll", response_model=TotpEnrollResponse)
async def enroll_totp(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> TotpEnrollResponse:
    secret = generate_totp_secret()
    user.totp_secret = secret
    user.totp_enabled = False
    await db.commit()
    return TotpEnrollResponse(secret=secret, otpauth_uri=totp_uri(secret, user.email))


@users_router.post("/me/totp/verify", status_code=status.HTTP_204_NO_CONTENT)
async def verify_totp(
    payload: TotpVerifyRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    if not user.totp_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No two-factor enrollment in progress")
    if not verify_totp_code(user.totp_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid code")
    user.totp_enabled = True
    await db.commit()


@users_router.post("/me/totp/disable", status_code=status.HTTP_204_NO_CONTENT)
async def disable_totp(
    payload: TotpDisableRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    if user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")
    user.totp_enabled = False
    user.totp_secret = None
    await db.commit()


@users_router.get("/me/sessions", response_model=list[SessionResponse])
async def list_sessions(
    request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[SessionResponse]:
    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        .order_by(UserSession.last_seen_at.desc())
    )
    sessions = list(result.scalars().all())

    current_jti = None
    auth_header = request.headers.get("authorization")
    # The current request carries an access token, not the refresh token whose
    # jti a Session is keyed on — so "current" is inferred as the most-recently
    # active session for this user rather than a token-level match.
    if sessions:
        current_jti = sessions[0].refresh_jti

    return [
        SessionResponse(
            id=s.id,
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            created_at=s.created_at,
            last_seen_at=s.last_seen_at,
            is_current=s.refresh_jti == current_jti,
        )
        for s in sessions
    ]


@users_router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user.id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.revoked_at = datetime.now(timezone.utc)
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
    await db.flush()
    await record_audit_event(
        db, merchant_id=merchant.id, action="create", resource_type="ApiKey", resource_id=api_key.id,
        changes={"key_prefix": prefix},
    )
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
    await record_audit_event(
        db, merchant_id=merchant.id, action="revoke", resource_type="ApiKey", resource_id=api_key.id
    )
    await db.commit()


@merchants_router.post("/me/go-live", response_model=GoLiveResponse, status_code=status.HTTP_201_CREATED)
async def submit_go_live_request(
    payload: GoLiveRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> LiveAccessRequest:
    try:
        business_type = BusinessType(payload.business_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid business_type") from exc

    result = await db.execute(select(LiveAccessRequest).where(LiveAccessRequest.merchant_id == merchant.id))
    existing = result.scalar_one_or_none()

    fields = payload.model_dump(exclude={"business_type", "terms_accepted"})
    fields["business_type"] = business_type
    fields["terms_accepted"] = payload.terms_accepted
    fields["terms_accepted_at"] = datetime.now(timezone.utc) if payload.terms_accepted else None

    if existing is not None:
        for key, value in fields.items():
            setattr(existing, key, value)
        request = existing
    else:
        request = LiveAccessRequest(merchant_id=merchant.id, **fields)
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
