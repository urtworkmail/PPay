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
from app.models.merchant import Merchant
from app.models.platform_admin import PlatformAdmin
from app.schemas.platform_admin import (
    ArchiveMerchantRequest,
    ArchiveOperationResponse,
    ArchivePassphraseSetRequest,
    PlatformAdminLoginRequest,
    PlatformAdminTokenResponse,
)
from app.services.archive_engine import archive_merchant_live_data

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
