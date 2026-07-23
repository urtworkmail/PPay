"""The single orchestration entry point every payment-collecting feature should
create and transition instead of writing rail results directly (architecture
spec §1, principle #1 and §5.1's state machine).

Phase 2 status: `checkout.py`'s pay endpoint calls this alongside its existing
`Transaction` write (dual-write) so the dashboard's Payments views — still
reading `Transaction` — keep working unmodified while `PaymentIntent`/`Charge`
data accumulates in parallel. Cutting the dashboard over to read from
`PaymentIntent`/`Charge` and retiring the `Transaction` write is the remaining
part of Phase 2.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.charge import Charge, ChargeStatus
from app.models.payment_intent import PaymentIntent, PaymentIntentSourceType, PaymentIntentStatus
from app.services.fee_calculator import calculate_fee_minor, calculate_net_minor

# Adapter-reported failure reasons that mean "the rail never told us what
# happened" rather than "the rail said no". These must route to
# requires_reconciliation, never to a customer-retryable failure — see the
# critical rule in architecture spec §5.1.
RECONCILIATION_FAILURE_REASONS = {"timeout"}


async def get_or_create_payment_intent(
    db: AsyncSession,
    *,
    merchant_id: uuid.UUID,
    amount_minor: int,
    currency: str,
    source_type: PaymentIntentSourceType,
    source_id: uuid.UUID | None,
    idempotency_key: str,
    customer_id: uuid.UUID | None = None,
    payment_method_id: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> PaymentIntent:
    """Get-or-create keyed on `(merchant_id, idempotency_key)`.

    A checkout session can legitimately go through this path more than once
    while still `PENDING` (e.g. the customer's first attempt failed payload
    validation before any rail was called) — re-deriving a fresh `PaymentIntent`
    each time would violate its idempotency-key uniqueness. Reusing the same
    intent across retries is also just correct behavior: the same logical
    payment attempt, potentially several charge attempts.
    """
    existing = await db.execute(
        select(PaymentIntent).where(
            PaymentIntent.merchant_id == merchant_id, PaymentIntent.idempotency_key == idempotency_key
        )
    )
    intent = existing.scalar_one_or_none()
    if intent is not None:
        return intent

    intent = PaymentIntent(
        merchant_id=merchant_id,
        customer_id=customer_id,
        payment_method_id=payment_method_id,
        amount_minor=amount_minor,
        currency=currency,
        source_type=source_type,
        source_id=source_id,
        idempotency_key=idempotency_key,
        intent_metadata=metadata or {},
    )
    db.add(intent)
    await db.flush()
    return intent


async def record_charge_attempt(
    db: AsyncSession,
    intent: PaymentIntent,
    *,
    adapter_name: str,
    success: bool,
    failure_reason: str | None,
    rail_reference_id: str | None,
    raw_response_payload: dict | None = None,
) -> Charge:
    """Records one rail attempt against `intent` and transitions the intent's
    status per the state machine in architecture spec §5.1.

    A `failure_reason` in `RECONCILIATION_FAILURE_REASONS` moves both the
    charge and the intent to `requires_reconciliation` — this state must only
    ever be cleared by the reconciliation job (Phase 4) or a manual ops
    action, never by a customer-facing retry button re-attempting the charge.
    """
    existing = await db.execute(select(Charge.id).where(Charge.payment_intent_id == intent.id))
    attempt_number = len(existing.all()) + 1

    if failure_reason in RECONCILIATION_FAILURE_REASONS:
        charge_status = ChargeStatus.REQUIRES_RECONCILIATION
        intent_status = PaymentIntentStatus.REQUIRES_RECONCILIATION
    elif success:
        charge_status = ChargeStatus.SUCCEEDED
        intent_status = PaymentIntentStatus.SUCCEEDED
    else:
        charge_status = ChargeStatus.FAILED
        # Retry allowed: a declined charge sends the intent back to needing a
        # payment method, not to a terminal failure.
        intent_status = PaymentIntentStatus.REQUIRES_PAYMENT_METHOD

    fee_minor = calculate_fee_minor(intent.amount_minor) if charge_status == ChargeStatus.SUCCEEDED else 0
    net_minor = (
        calculate_net_minor(intent.amount_minor, fee_minor) if charge_status == ChargeStatus.SUCCEEDED else 0
    )

    charge = Charge(
        payment_intent_id=intent.id,
        adapter_name=adapter_name,
        rail_reference_id=rail_reference_id,
        attempt_number=attempt_number,
        amount_minor=intent.amount_minor,
        fee_minor=fee_minor,
        net_amount_minor=net_minor,
        status=charge_status,
        failure_reason=failure_reason,
        raw_response_payload=raw_response_payload or {},
    )
    db.add(charge)

    intent.status = intent_status
    intent.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return charge


async def cancel_payment_intent(db: AsyncSession, intent: PaymentIntent) -> None:
    intent.status = PaymentIntentStatus.CANCELED
    intent.updated_at = datetime.now(timezone.utc)
    await db.flush()
