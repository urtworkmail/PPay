import hashlib
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
    refresh_token_expiry,
    totp_uri,
    verify_password,
    verify_totp_code,
)
from app.models.api_key import ApiKey
from app.models.checkout_session import PaymentMethod
from app.models.live_access_request import BusinessType, LiveAccessRequest, LiveAccessStatus
from app.models.merchant import Merchant, MerchantLiveStatus, MerchantStatus, PayoutSchedule
from app.models.session import Session as UserSession, SessionRevokedReason
from app.models.user import User, UserRole, UserStatus
from app.services.geoip import resolve_location
from app.services.audit_log import record_audit_event
from app.services.bank_verification import clear_verification
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
    EmailVerifyRequest,
    EmailVerifyTokenRequest,
    GenericMessageResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    ResendVerificationRequest,
    SessionResponse,
    TotpDisableRequest,
    TotpEnrollResponse,
    TotpVerifyRequest,
    UserProfile,
    UserProfileUpdateRequest,
)
from app.models.email_verification import VerificationPurpose
from app.models.notification import NotificationCategory, NotificationSeverity
from app.services.notifications import notify
from app.services.verification import VerificationResult, issue_verification, redeem_code, redeem_token

router = APIRouter(prefix="/auth", tags=["auth"])
merchants_router = APIRouter(prefix="/merchants", tags=["merchants"])
users_router = APIRouter(prefix="/users", tags=["users"])

REAL_PAYMENT_METHODS = {PaymentMethod.CARD.value, PaymentMethod.WALLET.value, PaymentMethod.BANK_TRANSFER.value}


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _refresh_session_location(session: UserSession, ip: str | None) -> None:
    """Re-resolves city/region/country only when the IP actually changed —
    a session's location would otherwise trigger a geolocation lookup on
    every single token refresh, which happens far more often than a device's
    location does.
    """
    if not ip or ip == session.ip_address:
        return
    location = await resolve_location(ip)
    session.city = location["city"]
    session.region = location["region"]
    session.country = location["country"]


def _device_id(request: Request) -> str:
    """Identify the device this request came from.

    The browser generates an opaque id once and stores it locally, sending it
    as `X-Device-Id`. This is not a credential and is never trusted on its own:
    it is read only after the caller has already authenticated, and it only
    decides which of *that user's own* session rows to continue.

    Non-browser clients (curl, scripts, older frontend builds) send no header,
    so a stable surrogate is derived from the user agent instead. Two different
    browsers reporting an identical user agent on the same account would share
    a row under that fallback — an acceptable trade for not creating a fresh
    "device" on every scripted login, and one that disappears as soon as a real
    device id is present.
    """
    header = (request.headers.get("x-device-id") or "").strip()
    if header:
        # Bounded and sanitised: this value is stored and later compared, never
        # interpolated anywhere, but there's no reason to accept junk.
        cleaned = "".join(c for c in header if c.isalnum() or c in "-_")[:64]
        if len(cleaned) >= 8:
            return cleaned

    agent = request.headers.get("user-agent") or "unknown"
    return "ua-" + hashlib.sha256(agent.encode("utf-8")).hexdigest()[:32]


def _device_label(user_agent: str | None) -> str:
    """Short human label so the sessions list reads as devices, not UA strings."""
    if not user_agent:
        return "Unknown device"
    ua = user_agent.lower()
    os_name = (
        "Windows" if "windows" in ua
        else "iOS" if ("iphone" in ua or "ipad" in ua)
        else "macOS" if "mac os" in ua
        else "Android" if "android" in ua
        else "Linux" if "linux" in ua
        else None
    )
    browser = (
        "Edge" if "edg/" in ua
        else "Chrome" if ("chrome" in ua and "chromium" not in ua)
        else "Firefox" if "firefox" in ua
        else "Safari" if ("safari" in ua and "chrome" not in ua)
        else "API client" if ("curl" in ua or "python" in ua or "node" in ua)
        else None
    )
    if not os_name and not browser:
        return user_agent[:60]
    return " on ".join([p for p in (browser, os_name) if p])


async def _start_session(db: AsyncSession, user: User, request: Request) -> tuple[str, bool]:
    """Begin or continue this device's session.

    Returns (refresh_token, is_new_device). Signing in again from a device that
    already has a live session rotates that session's token in place rather
    than adding a second row — which is why the sessions list stays a list of
    devices instead of a login history.
    """
    device_id = _device_id(request)
    user_agent = request.headers.get("user-agent")
    now = datetime.now(timezone.utc)

    existing = await db.execute(
        select(UserSession).where(
            UserSession.user_id == user.id,
            UserSession.device_id == device_id,
            UserSession.revoked_at.is_(None),
        )
    )
    session = existing.scalars().first()
    is_new_device = session is None

    if session is None:
        session = UserSession(user_id=user.id, device_id=device_id, refresh_jti="pending")
        db.add(session)
        await db.flush()  # assign the id the token's `sid` claim binds to

    refresh_token = create_refresh_token(str(user.id), session_id=str(session.id))
    session.refresh_jti = decode_token(refresh_token)["jti"]
    incoming_ip = _client_ip(request)
    await _refresh_session_location(session, incoming_ip)
    session.ip_address = incoming_ip
    session.user_agent = user_agent
    session.device_label = _device_label(user_agent)
    session.last_seen_at = now
    session.expires_at = refresh_token_expiry()
    return refresh_token, is_new_device


async def _revoke_sessions(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    reason: str,
    exclude_session_id: uuid.UUID | None = None,
) -> int:
    result = await db.execute(
        select(UserSession).where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
    )
    count = 0
    for session in result.scalars().all():
        if exclude_session_id is not None and session.id == exclude_session_id:
            continue
        session.revoked_at = datetime.now(timezone.utc)
        session.revoked_reason = reason
        count += 1
    return count


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

    # Email the confirmation code before issuing the session: the account is
    # usable immediately (so the user lands on the verify screen already signed
    # in), but stays unverified until the code is redeemed, which is what
    # gates going live.
    await issue_verification(
        db,
        email=owner.email,
        purpose=VerificationPurpose.SIGNUP,
        user_id=owner.id,
        link_path="/verify-email",
    )

    refresh_token, _ = await _start_session(db, owner, request)
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
    refresh_token, is_new_device = await _start_session(db, user, request)

    # Only a sign-in from a device we haven't seen before is worth alerting on.
    # Notifying on every login trains people to ignore the alert, which is
    # exactly the message you need them to read when it does matter.
    if is_new_device:
        new_session = await db.execute(
            select(UserSession).where(
                UserSession.user_id == user.id, UserSession.device_id == _device_id(request)
            )
        )
        session_row = new_session.scalars().first()
        location = (
            ", ".join(p for p in (session_row.city, session_row.country) if p)
            if session_row
            else None
        )
        location_clause = f" in {location}" if location else ""
        await notify(
            db,
            merchant_id=user.merchant_id,
            category=NotificationCategory.SECURITY,
            title="New sign-in from a new device",
            body=(
                f"{user.email} signed in from {_device_label(request.headers.get('user-agent'))}"
                f"{location_clause} ({_client_ip(request) or 'unknown IP'}). "
                "If this wasn't you, change your password and revoke the session."
            ),
            severity=NotificationSeverity.WARNING,
            resource_type="session",
            link="/dashboard/settings/sessions",
            user_id=user.id,
            actor_email=user.email,
            changes={"ip_address": _client_ip(request), "user_agent": request.headers.get("user-agent")},
        )
    await db.commit()

    return TokenPair(access_token=create_access_token(str(user.id)), refresh_token=refresh_token)


@router.post("/verify-email", response_model=UserProfile)
async def verify_email(payload: EmailVerifyRequest, db: AsyncSession = Depends(get_db)) -> User:
    """Redeem the signup code. Deliberately unauthenticated so the link in the
    email works in any browser, not only the one holding the session."""
    result, record = await redeem_code(
        db, email=payload.email, purpose=VerificationPurpose.SIGNUP, code=payload.code
    )
    if result is not VerificationResult.OK or record is None:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="That code is invalid or has expired. Request a new one."
        )

    user_result = await db.execute(select(User).where(User.email == record.email))
    user = user_result.scalar_one_or_none()
    if user is None:
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is invalid or has expired.")

    if not user.email_verified:
        user.email_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
        await notify(
            db,
            merchant_id=user.merchant_id,
            category=NotificationCategory.SECURITY,
            title="Email address verified",
            body=f"{user.email} is now confirmed and can receive account notifications.",
            severity=NotificationSeverity.SUCCESS,
            resource_type="user",
            user_id=user.id,
            actor_email=user.email,
        )
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/verify-email/token", response_model=GenericMessageResponse)
async def verify_email_by_token(payload: EmailVerifyTokenRequest, db: AsyncSession = Depends(get_db)) -> GenericMessageResponse:
    result, record = await redeem_token(db, purpose=VerificationPurpose.SIGNUP, token=payload.token)
    if result is not VerificationResult.OK or record is None:
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That link is invalid or has expired.")

    user_result = await db.execute(select(User).where(User.email == record.email))
    user = user_result.scalar_one_or_none()
    if user is not None and not user.email_verified:
        user.email_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
    await db.commit()
    return GenericMessageResponse(message="Email verified. You can close this tab and return to the dashboard.")


@router.post("/resend-verification", response_model=GenericMessageResponse)
async def resend_verification(
    payload: ResendVerificationRequest, db: AsyncSession = Depends(get_db)
) -> GenericMessageResponse:
    """Always answers the same way, whether or not the address belongs to an
    account — otherwise this endpoint becomes a way to enumerate users."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is not None and not user.email_verified:
        await issue_verification(
            db,
            email=user.email,
            purpose=VerificationPurpose.SIGNUP,
            user_id=user.id,
            link_path="/verify-email",
        )
        await db.commit()
    return GenericMessageResponse(message="If that address needs verifying, a new code is on its way.")


@router.post("/password-reset", response_model=GenericMessageResponse)
async def request_password_reset(
    payload: PasswordResetRequest, db: AsyncSession = Depends(get_db)
) -> GenericMessageResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is not None and user.status == UserStatus.ACTIVE:
        await issue_verification(
            db, email=user.email, purpose=VerificationPurpose.PASSWORD_RESET, user_id=user.id
        )
        await db.commit()
    return GenericMessageResponse(message="If that address has an account, a reset code is on its way.")


@router.post("/password-reset/confirm", response_model=GenericMessageResponse)
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest, db: AsyncSession = Depends(get_db)
) -> GenericMessageResponse:
    result, record = await redeem_code(
        db, email=payload.email, purpose=VerificationPurpose.PASSWORD_RESET, code=payload.code
    )
    if result is not VerificationResult.OK or record is None:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="That code is invalid or has expired. Request a new one."
        )

    user_result = await db.execute(select(User).where(User.email == record.email))
    user = user_result.scalar_one_or_none()
    if user is None:
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is invalid or has expired.")

    user.password_hash = hash_password(payload.new_password)
    # Every existing session dies with the old password — a reset is the one
    # moment where "sign out everywhere" is unambiguously the right default,
    # since the reason to reset is usually that someone else may have had it.
    await _revoke_sessions(db, user.id, reason=SessionRevokedReason.PASSWORD_CHANGE)

    await notify(
        db,
        merchant_id=user.merchant_id,
        category=NotificationCategory.SECURITY,
        title="Password reset",
        body=f"The password for {user.email} was reset and all active sessions were signed out.",
        severity=NotificationSeverity.WARNING,
        resource_type="password",
        link="/dashboard/settings/personal",
        user_id=user.id,
        actor_email=user.email,
    )
    await db.commit()
    return GenericMessageResponse(message="Password updated. Sign in with your new password.")


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = uuid.UUID(decoded["sub"])
        jti = decoded["jti"]
        session_id = decoded.get("sid")
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token") from exc

    user = await db.get(User, user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    session = None
    if session_id:
        try:
            session = await db.get(UserSession, uuid.UUID(session_id))
        except ValueError:
            session = None
        if session is not None and session.user_id != user.id:
            # A token whose `sid` points at somebody else's session is forged.
            session = None
    else:
        # Tokens minted before sessions carried a `sid` claim.
        legacy = await db.execute(select(UserSession).where(UserSession.refresh_jti == jti))
        session = legacy.scalar_one_or_none()

    if session is None or session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked")

    if session.refresh_jti != jti:
        # The presented token was already exchanged for a newer one. A
        # legitimate client never replays a rotated token, so this means a
        # refresh token leaked and two parties are now using it. The safe
        # response is to kill the whole session — both the thief's copy and
        # ours — and make the user sign in again.
        session.revoked_at = datetime.now(timezone.utc)
        session.revoked_reason = SessionRevokedReason.TOKEN_REUSE
        await notify(
            db,
            merchant_id=user.merchant_id,
            category=NotificationCategory.SECURITY,
            title="Session ended for security",
            body=(
                f"An expired sign-in token for {user.email} was reused, which can mean it was copied from "
                f"{session.device_label or 'a signed-in device'}. That session was signed out. "
                "If you didn't do this, change your password now."
            ),
            severity=NotificationSeverity.CRITICAL,
            resource_type="session",
            resource_id=session.id,
            link="/dashboard/settings/sessions",
            user_id=user.id,
            actor_email=user.email,
            changes={"reason": "refresh_token_reuse", "ip_address": _client_ip(request)},
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked")

    expires_at = session.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at is not None and expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has expired")

    # Rotate the refresh token but keep the same Session row (and its id and
    # first-seen date) so the sessions list stays one entry per device.
    new_refresh_token = create_refresh_token(str(user.id), session_id=str(session.id))
    session.refresh_jti = decode_token(new_refresh_token)["jti"]
    session.last_seen_at = datetime.now(timezone.utc)
    session.expires_at = refresh_token_expiry()
    incoming_ip = _client_ip(request)
    await _refresh_session_location(session, incoming_ip)
    session.ip_address = incoming_ip
    if request.headers.get("user-agent"):
        session.user_agent = request.headers.get("user-agent")
        session.device_label = _device_label(request.headers.get("user-agent"))
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

    # A changed account number has proven nothing yet — any prior verification
    # (or in-flight one) belonged to the old account, not this one.
    if payload.payout_bank_account_number != merchant.payout_bank_account_number:
        clear_verification(merchant)

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
    for user_id in [row[0] for row in user_ids_result.all()]:
        await _revoke_sessions(db, user_id, reason=SessionRevokedReason.ACCOUNT_CLOSED)
    await db.commit()


@users_router.get("/me", response_model=UserProfile)
async def get_current_user_profile(user: User = Depends(get_current_user)) -> User:
    return user


@users_router.patch("/me", response_model=UserProfile)
async def update_current_user_profile(
    payload: UserProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@users_router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if user.password_hash is None or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)

    # Changing a password signs out every *other* device but keeps the one that
    # made the change signed in — the usual behaviour, and the one that stops
    # someone with a stolen session from staying in after the owner reacts.
    current = await db.execute(
        select(UserSession).where(
            UserSession.user_id == user.id,
            UserSession.device_id == _device_id(request),
            UserSession.revoked_at.is_(None),
        )
    )
    current_session = current.scalars().first()
    revoked = await _revoke_sessions(
        db,
        user.id,
        reason=SessionRevokedReason.PASSWORD_CHANGE,
        exclude_session_id=current_session.id if current_session else None,
    )

    await notify(
        db,
        merchant_id=user.merchant_id,
        category=NotificationCategory.SECURITY,
        title="Password changed",
        body=(
            f"The password for {user.email} was changed."
            + (f" {revoked} other device{'s were' if revoked != 1 else ' was'} signed out." if revoked else "")
        ),
        severity=NotificationSeverity.WARNING,
        resource_type="password",
        link="/dashboard/settings/personal",
        user_id=user.id,
        actor_email=user.email,
    )
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
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        .order_by(UserSession.last_seen_at.desc())
    )

    # A session whose refresh token has already expired is not signed in any
    # more, whatever the row says — showing it would overstate who has access.
    sessions = []
    for session in result.scalars().all():
        expires_at = session.expires_at
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at is None or expires_at > now:
            sessions.append(session)

    # "This device" is an exact match on the caller's device id, not a guess at
    # whichever session was active most recently.
    current_device = _device_id(request)

    return [
        SessionResponse(
            id=s.id,
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            device_label=s.device_label or _device_label(s.user_agent),
            city=s.city,
            region=s.region,
            country=s.country,
            created_at=s.created_at,
            last_seen_at=s.last_seen_at,
            expires_at=s.expires_at,
            is_current=s.device_id == current_device,
        )
        for s in sessions
    ]


@users_router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user.id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session.revoked_at = datetime.now(timezone.utc)
    session.revoked_reason = SessionRevokedReason.USER
    await notify(
        db,
        merchant_id=user.merchant_id,
        category=NotificationCategory.SECURITY,
        title="Device signed out",
        body=f"{session.device_label or 'A device'} was signed out of {user.email}.",
        resource_type="session",
        resource_id=session.id,
        link="/dashboard/settings/sessions",
        user_id=user.id,
        actor_email=user.email,
    )
    await db.commit()


@users_router.post("/me/sessions/revoke-others", status_code=status.HTTP_200_OK)
async def revoke_other_sessions(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Sign out everywhere except the device making the request."""
    device_id = _device_id(request)
    current = await db.execute(
        select(UserSession).where(
            UserSession.user_id == user.id,
            UserSession.device_id == device_id,
            UserSession.revoked_at.is_(None),
        )
    )
    current_session = current.scalars().first()

    revoked = await _revoke_sessions(
        db,
        user.id,
        reason=SessionRevokedReason.USER,
        exclude_session_id=current_session.id if current_session else None,
    )
    if revoked:
        await notify(
            db,
            merchant_id=user.merchant_id,
            category=NotificationCategory.SECURITY,
            title="Signed out of other devices",
            body=f"{revoked} other device{'s were' if revoked != 1 else ' was'} signed out of {user.email}.",
            severity=NotificationSeverity.WARNING,
            resource_type="session",
            link="/dashboard/settings/sessions",
            user_id=user.id,
            actor_email=user.email,
        )
    await db.commit()
    return {"revoked": revoked}


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
        # A resubmission (most commonly after rejection) is a fresh
        # application, not a continuation of the old one's outcome — reset
        # both the request's own status and its review timestamp/reason so a
        # previously-rejected request doesn't keep reading as rejected.
        existing.status = LiveAccessStatus.PENDING_REVIEW
        existing.reviewed_at = None
        existing.rejection_reason = None
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
