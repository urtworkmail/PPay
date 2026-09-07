from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, require_role
from app.core.db import get_db
from app.models.merchant import Merchant
from app.models.notification import NotificationCategory, NotificationSeverity
from app.models.user import User, UserRole
from app.schemas.bank_verification import PayoutVerificationConfirmRequest, PayoutVerificationStatusResponse
from app.services.audit_log import record_audit_event
from app.services.bank_verification import MAX_ATTEMPTS, confirm_verification, start_verification
from app.services.notifications import notify

router = APIRouter(prefix="/merchants/me/financial-connections", tags=["financial-connections"])


def _masked(account_number: str | None) -> str | None:
    if not account_number:
        return None
    return f"••••{account_number[-4:]}" if len(account_number) > 4 else "••••"


@router.get("", response_model=PayoutVerificationStatusResponse)
async def get_verification_status(merchant: Merchant = Depends(get_current_merchant)) -> PayoutVerificationStatusResponse:
    has_pending = merchant.payout_verification_amount_1 is not None
    return PayoutVerificationStatusResponse(
        bank_name=merchant.payout_bank_name,
        account_number_masked=_masked(merchant.payout_bank_account_number),
        verified_at=merchant.payout_verified_at,
        verification_sent_at=merchant.payout_verification_sent_at,
        attempts_remaining=(MAX_ATTEMPTS - merchant.payout_verification_attempts) if has_pending else None,
    )


@router.post("/start", response_model=PayoutVerificationStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_bank_verification(
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> PayoutVerificationStatusResponse:
    if not merchant.payout_bank_account_number:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Add a payout bank account in Settings before verifying it.",
        )
    await start_verification(db, merchant)
    await record_audit_event(
        db, merchant_id=merchant.id, action="create", resource_type="bank_verification", notify=False
    )
    await db.commit()
    await db.refresh(merchant)
    return await get_verification_status(merchant)


@router.post("/confirm", response_model=PayoutVerificationStatusResponse)
async def confirm_bank_verification(
    payload: PayoutVerificationConfirmRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> PayoutVerificationStatusResponse:
    if merchant.payout_verification_amount_1 is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No verification in progress — start one first.")
    if merchant.payout_verification_attempts >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Start a new verification.",
        )

    success = confirm_verification(merchant, payload.amount_1, payload.amount_2)
    await record_audit_event(
        db,
        merchant_id=merchant.id,
        action="update",
        resource_type="bank_verification",
        changes={"result": "verified" if success else "incorrect_amounts"},
        notify=False,  # a custom, richer notification is sent below on success only
    )

    if success:
        await notify(
            db,
            merchant_id=merchant.id,
            category=NotificationCategory.ACCOUNT,
            title="Payout bank account verified",
            body=f"{merchant.payout_bank_name or 'Your bank account'} is now verified for payouts.",
            severity=NotificationSeverity.SUCCESS,
            resource_type="merchant",
            link="/dashboard/financial-connections",
        )

    await db.commit()
    await db.refresh(merchant)

    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Those amounts don't match.")

    return await get_verification_status(merchant)
