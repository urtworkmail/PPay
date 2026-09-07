import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.archive_db import ensure_archive_schema
from app.core.db import get_db
from app.core.security import (
    create_platform_admin_token,
    decode_token,
    hash_password,
    verify_password,
    verify_totp_code,
)
from app.models.archive_operation import ArchiveOperation
from app.models.live_access_request import LiveAccessRequest, LiveAccessStatus
from app.models.merchant import Merchant, MerchantLiveStatus
from app.models.notification import NotificationCategory, NotificationSeverity
from app.models.platform_admin import PlatformAdmin
from app.schemas.live_access_review import LiveAccessRejectRequest, LiveAccessRequestAdminResponse
from app.schemas.platform_admin import (
    ArchiveMerchantRequest,
    ArchiveOperationResponse,
    ArchivePassphraseSetRequest,
    PlatformAdminLoginRequest,
    PlatformAdminTokenResponse,
)
from app.services.archive_engine import archive_merchant_live_data
from app.services.notifications import notify

router = APIRouter(prefix="/platform-admin", tags=["platform-admin"])
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_platform_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> PlatformAdmin:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        payload = decode_token(credentials.credentials)
        # Deliberately a distinct token `type` from merchant User tokens — a
        # merchant's own JWT must never be usable here, and vice versa.
        if payload.get("type") != "platform_admin_access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        admin_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    admin = await db.get(PlatformAdmin, admin_id)
    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")
    return admin


@router.post("/login", response_model=PlatformAdminTokenResponse)
async def login(payload: PlatformAdminLoginRequest, db: AsyncSession = Depends(get_db)) -> PlatformAdminTokenResponse:
    result = await db.execute(select(PlatformAdmin).where(PlatformAdmin.email == payload.email))
    admin = result.scalar_one_or_none()
    # Constant-shape error regardless of which check fails, so a login
    # attempt can't be used to enumerate valid admin emails or 2FA state.
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise invalid
    if not admin.totp_enabled or not admin.totp_secret or not verify_totp_code(admin.totp_secret, payload.totp_code):
        raise invalid

    admin.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    return PlatformAdminTokenResponse(access_token=create_platform_admin_token(str(admin.id)))


@router.post("/me/archive-passphrase", status_code=status.HTTP_204_NO_CONTENT)
async def set_archive_passphrase(
    payload: ArchivePassphraseSetRequest,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """The archive passphrase is a second secret, separate from the login
    password — required at the moment of archiving, not just at login, so a
    hijacked login session alone can never trigger an archive."""
    admin.archive_passphrase_hash = hash_password(payload.passphrase)
    await db.commit()


@router.get("/merchants", response_model=list[dict])
async def list_merchants_for_archive(
    _: PlatformAdmin = Depends(get_current_platform_admin), db: AsyncSession = Depends(get_db)
) -> list[dict]:
    result = await db.execute(select(Merchant.id, Merchant.business_name, Merchant.email).order_by(Merchant.business_name))
    return [{"id": str(mid), "business_name": name, "email": email} for mid, name, email in result.all()]


@router.post("/archive", response_model=ArchiveOperationResponse, status_code=status.HTTP_201_CREATED)
async def archive_merchant(
    payload: ArchiveMerchantRequest,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> ArchiveOperationResponse:
    if not admin.archive_passphrase_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Set an archive passphrase first (/me/archive-passphrase)"
        )
    if not verify_password(payload.passphrase, admin.archive_passphrase_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect archive passphrase")

    merchant = await db.get(Merchant, payload.merchant_id)
    if merchant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    await ensure_archive_schema()
    row_counts = await archive_merchant_live_data(payload.merchant_id)

    operation = ArchiveOperation(
        platform_admin_id=admin.id,
        merchant_id=payload.merchant_id,
        reason=payload.reason,
        row_counts=row_counts,
    )
    db.add(operation)
    await db.commit()
    await db.refresh(operation)
    return operation


@router.get("/archive-operations", response_model=list[ArchiveOperationResponse])
async def list_archive_operations(
    _: PlatformAdmin = Depends(get_current_platform_admin), db: AsyncSession = Depends(get_db)
) -> list[ArchiveOperation]:
    result = await db.execute(select(ArchiveOperation).order_by(ArchiveOperation.created_at.desc()))
    return list(result.scalars().all())


# --- Go-Live / KYC review ---------------------------------------------------
# Fixes a real gap: the Go-Live form (api/v1/auth.py::submit_go_live_request)
# collects a merchant's KYC data into a `LiveAccessRequest`, but until this
# router, nothing anywhere could ever move that request — or the merchant's
# `live_status` — to approved or rejected. A merchant who submitted stayed on
# "pending_review" forever, permanently.


def _to_admin_response(request: LiveAccessRequest, merchant: Merchant) -> LiveAccessRequestAdminResponse:
    return LiveAccessRequestAdminResponse(
        id=request.id,
        merchant_id=request.merchant_id,
        merchant_business_name=merchant.business_name,
        merchant_email=merchant.email,
        business_type=request.business_type,
        legal_business_name=request.legal_business_name,
        business_category=request.business_category,
        registration_number=request.registration_number,
        national_tax_number=request.national_tax_number,
        business_address=request.business_address,
        website_url=request.website_url,
        product_description=request.product_description,
        representative_full_name=request.representative_full_name,
        representative_cnic=request.representative_cnic,
        representative_dob=request.representative_dob,
        representative_address=request.representative_address,
        bank_name=request.bank_name,
        bank_account_number=request.bank_account_number,
        contact_phone=request.contact_phone,
        notes=request.notes,
        status=request.status,
        submitted_at=request.submitted_at,
        reviewed_at=request.reviewed_at,
        rejection_reason=request.rejection_reason,
    )


@router.get("/live-access-requests", response_model=list[LiveAccessRequestAdminResponse])
async def list_live_access_requests(
    status_filter: LiveAccessStatus | None = None,
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> list[LiveAccessRequestAdminResponse]:
    query = select(LiveAccessRequest, Merchant).join(Merchant, Merchant.id == LiveAccessRequest.merchant_id)
    if status_filter is not None:
        query = query.where(LiveAccessRequest.status == status_filter)
    result = await db.execute(query.order_by(LiveAccessRequest.submitted_at.desc()))
    return [_to_admin_response(request, merchant) for request, merchant in result.all()]


async def _load_request_and_merchant(db: AsyncSession, request_id: uuid.UUID) -> tuple[LiveAccessRequest, Merchant]:
    request = await db.get(LiveAccessRequest, request_id)
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    merchant = await db.get(Merchant, request.merchant_id)
    if merchant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")
    return request, merchant


@router.get("/live-access-requests/{request_id}", response_model=LiveAccessRequestAdminResponse)
async def get_live_access_request(
    request_id: uuid.UUID,
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> LiveAccessRequestAdminResponse:
    request, merchant = await _load_request_and_merchant(db, request_id)
    return _to_admin_response(request, merchant)


@router.post("/live-access-requests/{request_id}/approve", response_model=LiveAccessRequestAdminResponse)
async def approve_live_access_request(
    request_id: uuid.UUID,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> LiveAccessRequestAdminResponse:
    request, merchant = await _load_request_and_merchant(db, request_id)
    if request.status != LiveAccessStatus.PENDING_REVIEW:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Request is already {request.status}")

    request.status = LiveAccessStatus.APPROVED
    request.reviewed_at = datetime.now(timezone.utc)
    request.rejection_reason = None
    merchant.live_status = MerchantLiveStatus.LIVE

    await notify(
        db,
        merchant_id=merchant.id,
        category=NotificationCategory.ACCOUNT,
        title="You're approved for live payments",
        body=f"{merchant.business_name} passed review and can now accept real payments. Switch to live mode from the sidebar.",
        severity=NotificationSeverity.SUCCESS,
        resource_type="merchant",
        link="/dashboard/go-live",
    )
    await db.commit()
    await db.refresh(request)
    return _to_admin_response(request, merchant)


@router.post("/live-access-requests/{request_id}/reject", response_model=LiveAccessRequestAdminResponse)
async def reject_live_access_request(
    request_id: uuid.UUID,
    payload: LiveAccessRejectRequest,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> LiveAccessRequestAdminResponse:
    request, merchant = await _load_request_and_merchant(db, request_id)
    if request.status != LiveAccessStatus.PENDING_REVIEW:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Request is already {request.status}")

    request.status = LiveAccessStatus.REJECTED
    request.reviewed_at = datetime.now(timezone.utc)
    request.rejection_reason = payload.reason
    # Back to sandbox_only, not pending_review — pending_review means "we're
    # looking at it," which is no longer true. The merchant can resubmit,
    # which re-enters pending_review on its own (see auth.py).
    merchant.live_status = MerchantLiveStatus.SANDBOX_ONLY

    await notify(
        db,
        merchant_id=merchant.id,
        category=NotificationCategory.ACCOUNT,
        title="Your live payments application needs changes",
        body=f"Your Go-Live application wasn't approved: {payload.reason} You can update your details and resubmit.",
        severity=NotificationSeverity.WARNING,
        resource_type="merchant",
        link="/dashboard/go-live",
    )
    await db.commit()
    await db.refresh(request)
    return _to_admin_response(request, merchant)
