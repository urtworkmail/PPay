"""Disputes: read/respond endpoints, plus a sandbox-only way to raise one.

Full lifecycle wiring — real card-network submission, evidence deadlines that
actually expire, auto-loss — is out of scope here (see `models/dispute.py`'s
own docstring: that's Phase 5 of the rebuild, and there is no real card
network behind this sandbox to submit evidence to). What a merchant actually
needs today is what this router gives them: see disputes raised against their
charges, read the detail, submit a response, and — since nothing upstream can
raise a real chargeback in sandbox mode — a way to raise a test one, the same
way the rest of this sandbox lets you rehearse failure paths deterministically
(`services/sandbox_engine.py`) instead of staring at a permanently empty page.
"""

import random
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, get_request_mode, require_role
from app.core.db import Mode, get_db
from app.models.charge import Charge, ChargeStatus
from app.models.dispute import Dispute, DisputeStatus
from app.models.merchant import Merchant
from app.models.notification import NotificationCategory, NotificationSeverity
from app.models.payment_intent import PaymentIntent, PaymentIntentSourceType
from app.models.user import User, UserRole
from app.schemas.dispute import DisputeListResponse, DisputeRespondRequest, DisputeResponse, DisputeSimulateRequest
from app.services.audit_log import record_audit_event
from app.services.notifications import notify

router = APIRouter(prefix="/disputes", tags=["disputes"])

_SIMULATED_REASONS = [
    "Product not received",
    "Product unacceptable",
    "Duplicate charge",
    "Credit not processed",
    "Unrecognized charge",
]


async def _to_response(db: AsyncSession, dispute: Dispute) -> DisputeResponse:
    charge = await db.get(Charge, dispute.charge_id)
    intent = await db.get(PaymentIntent, charge.payment_intent_id) if charge else None
    response = DisputeResponse.model_validate(dispute)
    response.transaction_id = (
        intent.source_id if (intent and intent.source_type == PaymentIntentSourceType.CHECKOUT) else None
    )
    response.gateway_reference = charge.rail_reference_id if charge else None
    return response


@router.get("", response_model=DisputeListResponse)
async def list_disputes(
    status_filter: DisputeStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> DisputeListResponse:
    filters = [Dispute.merchant_id == merchant.id]
    if status_filter is not None:
        filters.append(Dispute.status == status_filter)

    total = await db.scalar(select(func.count()).select_from(Dispute).where(*filters)) or 0
    needs_response = (
        await db.scalar(
            select(func.count())
            .select_from(Dispute)
            .where(Dispute.merchant_id == merchant.id, Dispute.status == DisputeStatus.NEEDS_RESPONSE)
        )
        or 0
    )

    result = await db.execute(
        select(Dispute).where(*filters).order_by(Dispute.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = [await _to_response(db, d) for d in result.scalars().all()]

    return DisputeListResponse(items=items, total=total, needs_response=needs_response, page=page, page_size=page_size)


async def _load_owned(db: AsyncSession, merchant: Merchant, dispute_id: uuid.UUID) -> Dispute:
    dispute = await db.get(Dispute, dispute_id)
    if dispute is None or dispute.merchant_id != merchant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")
    return dispute


@router.get("/{dispute_id}", response_model=DisputeResponse)
async def get_dispute(
    dispute_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    dispute = await _load_owned(db, merchant, dispute_id)
    return await _to_response(db, dispute)


@router.post("/{dispute_id}/respond", response_model=DisputeResponse)
async def respond_to_dispute(
    dispute_id: uuid.UUID,
    payload: DisputeRespondRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPPORT)),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    dispute = await _load_owned(db, merchant, dispute_id)
    if dispute.status != DisputeStatus.NEEDS_RESPONSE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This dispute has already been responded to")

    dispute.evidence_submitted_at = datetime.now(timezone.utc)
    dispute.evidence_details = {**dispute.evidence_details, "text": payload.evidence_text}
    dispute.status = DisputeStatus.UNDER_REVIEW

    # notify=False: this is the merchant's own action, not news to tell them.
    await record_audit_event(
        db, merchant_id=merchant.id, action="update", resource_type="dispute", resource_id=dispute.id,
        changes={"status": dispute.status}, notify=False,
    )
    await db.commit()
    await db.refresh(dispute)
    return await _to_response(db, dispute)


@router.post("/simulate", response_model=DisputeResponse, status_code=status.HTTP_201_CREATED)
async def simulate_dispute(
    payload: DisputeSimulateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    mode: Mode = Depends(get_request_mode),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    """Raise a test dispute against one of the merchant's succeeded charges.

    Sandbox-mode only — there's no real card network in live mode to have
    raised a chargeback, so allowing this there would let a merchant fabricate
    a dispute record about money that was never actually contested.
    """
    if mode != Mode.SANDBOX:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Disputes can only be simulated in sandbox mode")

    if payload.transaction_id is not None:
        intent_result = await db.execute(
            select(PaymentIntent).where(
                PaymentIntent.merchant_id == merchant.id,
                PaymentIntent.source_type == PaymentIntentSourceType.CHECKOUT,
                PaymentIntent.source_id == payload.transaction_id,
            )
        )
        intents = list(intent_result.scalars().all())
    else:
        intent_result = await db.execute(
            select(PaymentIntent).where(PaymentIntent.merchant_id == merchant.id)
        )
        intents = list(intent_result.scalars().all())

    charge = None
    if intents:
        charges_result = await db.execute(
            select(Charge).where(
                Charge.payment_intent_id.in_([i.id for i in intents]), Charge.status == ChargeStatus.SUCCEEDED
            )
        )
        eligible = list(charges_result.scalars().all())
        # Skip charges already fully disputed.
        if eligible:
            existing_result = await db.execute(
                select(Dispute.charge_id).where(Dispute.charge_id.in_([c.id for c in eligible]))
            )
            already_disputed = {row[0] for row in existing_result.all()}
            candidates = [c for c in eligible if c.id not in already_disputed]
            charge = random.choice(candidates) if candidates else None

    if charge is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No eligible succeeded payment is available to dispute — process a sandbox payment first.",
        )

    dispute = Dispute(
        charge_id=charge.id,
        merchant_id=merchant.id,
        amount_minor=charge.amount_minor,
        reason=random.choice(_SIMULATED_REASONS),
        evidence_due_by=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(dispute)
    await db.flush()

    await notify(
        db,
        merchant_id=merchant.id,
        category=NotificationCategory.DISPUTE,
        title="New dispute filed",
        body=(
            f"A customer disputed a payment of {charge.amount_minor / 100:.2f} ({dispute.reason}). "
            f"Respond by {dispute.evidence_due_by.strftime('%b %d')}."
        ),
        severity=NotificationSeverity.CRITICAL,
        resource_type="dispute",
        resource_id=dispute.id,
        link=f"/dashboard/disputes/{dispute.id}",
    )
    # notify=False: the explicit notify() above already told the merchant,
    # with the richer, dispute-specific message — the generic audit-log
    # notifier would just duplicate it.
    await record_audit_event(
        db, merchant_id=merchant.id, action="create", resource_type="dispute", resource_id=dispute.id,
        changes={"reason": dispute.reason, "amount_minor": dispute.amount_minor}, notify=False,
    )
    await db.commit()
    await db.refresh(dispute)
    return await _to_response(db, dispute)
