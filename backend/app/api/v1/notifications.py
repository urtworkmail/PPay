import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, get_current_user
from app.core.db import get_db
from app.models.merchant import Merchant
from app.models.notification import (
    DEFAULT_EMAIL_CATEGORIES,
    Notification,
    NotificationCategory,
    NotificationPreference,
)
from app.models.user import User
from app.schemas.notification import (
    NotificationEmailRequest,
    NotificationEmailVerifyRequest,
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdateRequest,
    NotificationResponse,
    UnreadCountResponse,
)
from app.models.email_verification import VerificationPurpose
from app.services.verification import VerificationResult, issue_verification, redeem_code

router = APIRouter(prefix="/notifications", tags=["notifications"])

ALL_CATEGORIES = [c.value for c in NotificationCategory]


async def _get_or_create_preference(db: AsyncSession, user: User) -> NotificationPreference:
    result = await db.execute(select(NotificationPreference).where(NotificationPreference.user_id == user.id))
    preference = result.scalar_one_or_none()
    if preference is None:
        preference = NotificationPreference(
            user_id=user.id,
            email_enabled=True,
            email_categories=list(DEFAULT_EMAIL_CATEGORIES),
        )
        db.add(preference)
        await db.commit()
        await db.refresh(preference)
    return preference


# --- Preferences ------------------------------------------------------------
# Declared before the `/{notification_id}` routes: FastAPI matches in
# definition order, so a literal path registered after a UUID path parameter
# would be swallowed by it.


@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceResponse:
    preference = await _get_or_create_preference(db, user)
    return NotificationPreferenceResponse(
        email_enabled=preference.email_enabled,
        email_address=preference.email_address,
        email_verified=preference.email_verified_at is not None,
        login_email=user.email,
        login_email_verified=user.email_verified,
        email_categories=list(preference.email_categories or []),
        available_categories=ALL_CATEGORIES,
    )


@router.patch("/preferences", response_model=NotificationPreferenceResponse)
async def update_preferences(
    payload: NotificationPreferenceUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceResponse:
    preference = await _get_or_create_preference(db, user)

    if payload.email_enabled is not None:
        preference.email_enabled = payload.email_enabled

    if payload.email_categories is not None:
        unknown = sorted(set(payload.email_categories) - set(ALL_CATEGORIES))
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown notification categories: {', '.join(unknown)}",
            )
        preference.email_categories = list(dict.fromkeys(payload.email_categories))

    await db.commit()
    await db.refresh(preference)
    return await get_preferences(user=user, db=db)


@router.post("/preferences/email", status_code=status.HTTP_202_ACCEPTED)
async def start_email_change(
    payload: NotificationEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Send a one-time code to a proposed delivery address.

    The address is not stored on the preference until the code is redeemed, so
    an unverified address can never receive account mail.
    """
    await _get_or_create_preference(db, user)
    await issue_verification(
        db,
        email=payload.email,
        purpose=VerificationPurpose.NOTIFICATION_EMAIL,
        user_id=user.id,
    )
    await db.commit()
    return {"message": "Verification code sent. Enter it to start using this address."}


@router.post("/preferences/email/verify", response_model=NotificationPreferenceResponse)
async def confirm_email_change(
    payload: NotificationEmailVerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceResponse:
    result, record = await redeem_code(
        db, email=payload.email, purpose=VerificationPurpose.NOTIFICATION_EMAIL, code=payload.code
    )
    # A code issued for someone else's account must not be redeemable here even
    # if it is otherwise valid.
    if result is not VerificationResult.OK or record is None or record.user_id != user.id:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="That code is invalid or has expired. Request a new one."
        )

    preference = await _get_or_create_preference(db, user)
    preference.email_address = record.email
    preference.email_verified_at = datetime.now(timezone.utc)
    await db.commit()
    return await get_preferences(user=user, db=db)


@router.delete("/preferences/email", response_model=NotificationPreferenceResponse)
async def clear_email_override(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceResponse:
    """Fall back to the verified login address."""
    preference = await _get_or_create_preference(db, user)
    preference.email_address = None
    preference.email_verified_at = None
    await db.commit()
    return await get_preferences(user=user, db=db)


# --- Feed -------------------------------------------------------------------


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    unread_only: bool = Query(default=False),
    category: str | None = Query(default=None),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> NotificationListResponse:
    filters = [Notification.merchant_id == merchant.id]
    if unread_only:
        filters.append(Notification.read_at.is_(None))
    if category:
        filters.append(Notification.category == category)

    total = await db.scalar(select(func.count()).select_from(Notification).where(*filters)) or 0
    unread = (
        await db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.merchant_id == merchant.id, Notification.read_at.is_(None))
        )
        or 0
    )

    result = await db.execute(
        select(Notification)
        .where(*filters)
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in result.scalars().all()],
        total=total,
        unread=unread,
        page=page,
        page_size=page_size,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    count = (
        await db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.merchant_id == merchant.id, Notification.read_at.is_(None))
        )
        or 0
    )
    return UnreadCountResponse(unread=count)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.merchant_id == merchant.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def _load_owned(db: AsyncSession, merchant: Merchant, notification_id: uuid.UUID) -> Notification:
    notification = await db.get(Notification, notification_id)
    # Same 404 whether it doesn't exist or belongs to another merchant — an
    # id must not be probeable across accounts.
    if notification is None or notification.merchant_id != merchant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> Notification:
    return await _load_owned(db, merchant, notification_id)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> Notification:
    notification = await _load_owned(db, merchant, notification_id)
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(notification)
    return notification


@router.post("/{notification_id}/unread", response_model=NotificationResponse)
async def mark_unread(
    notification_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> Notification:
    notification = await _load_owned(db, merchant, notification_id)
    notification.read_at = None
    await db.commit()
    await db.refresh(notification)
    return notification
