import calendar
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import Mode, session_factory_for_mode, stamp_mode
from app.models.checkout_session import CheckoutSession, CheckoutSessionStatus, PaymentMethod
from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment_intent import PaymentIntentSourceType
from app.models.product import BillingInterval, Price
from app.models.subscription import SavedPaymentMethod, Subscription, SubscriptionStatus
from app.models.transaction import Transaction, TransactionStatus
from app.models.webhook import WebhookEndpoint
from app.services import sandbox_engine
from app.services.fee_calculator import calculate_fee_minor, calculate_net_minor
from app.services.payment_intent_engine import get_or_create_payment_intent, record_charge_attempt
from app.services.webhook_dispatcher import deliver_webhook, enqueue_webhook_event

MAX_BILLING_ATTEMPTS = 3


def _add_months(start: datetime, months: int) -> datetime:
    total_month_index = start.month - 1 + months
    year = start.year + total_month_index // 12
    month = total_month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return start.replace(year=year, month=month, day=day)


def compute_period_end(start: datetime, price: Price) -> datetime:
    if price.interval == BillingInterval.DAY:
        return start + timedelta(days=price.interval_count)
    if price.interval == BillingInterval.WEEK:
        return start + timedelta(weeks=price.interval_count)
    if price.interval == BillingInterval.MONTH:
        return _add_months(start, price.interval_count)
    if price.interval == BillingInterval.YEAR:
        return _add_months(start, price.interval_count * 12)
    # ONE_TIME prices shouldn't drive a subscription, but don't loop forever if one does.
    return _add_months(start, 1200)


async def activate_subscription(
    db: AsyncSession, subscription: Subscription, payment_method_id: uuid.UUID, now: datetime | None = None
) -> None:
    """Called once a subscription's first invoice has been paid."""
    now = now or datetime.now(timezone.utc)
    price = await db.get(Price, subscription.price_id)

    subscription.payment_method_id = payment_method_id
    subscription.status = SubscriptionStatus.ACTIVE
    subscription.current_period_start = now
    subscription.current_period_end = compute_period_end(now, price)
    subscription.failed_attempt_count = 0
    await db.flush()


async def charge_subscription_cycle(
    db: AsyncSession, subscription: Subscription, price: Price, billing_reason: str = "subscription_cycle"
) -> bool:
    """Creates a billing-cycle invoice + checkout session + transaction, attempting an off-session charge.

    Shared by the renewal scheduler (run_subscription_billing) and the "customer
    already has a saved payment method" path in the create-subscription endpoint
    — both cases are "charge this subscription's price against payment_method_id
    on file", they just differ in which invoice.billing_reason gets recorded.

    Returns True if the charge succeeded.
    """
    payment_method = await db.get(SavedPaymentMethod, subscription.payment_method_id)

    description = (
        f"Subscription ({price.interval.value})"
        if billing_reason == "subscription_first"
        else f"Subscription renewal ({price.interval.value})"
    )
    invoice = Invoice(
        merchant_id=subscription.merchant_id,
        customer_name=subscription.customer_name,
        customer_email=subscription.customer_email,
        amount_minor=price.amount_minor,
        currency=price.currency,
        description=description,
        status=InvoiceStatus.SENT,
        subscription_id=subscription.id,
        billing_reason=billing_reason,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(invoice)
    await db.flush()

    session = CheckoutSession(
        merchant_id=subscription.merchant_id,
        amount_minor=price.amount_minor,
        currency=price.currency,
        description=invoice.description,
        customer_email=subscription.customer_email,
        method=PaymentMethod(payment_method.method.value) if payment_method else None,
        idempotency_key=f"sub_{subscription.id}_{invoice.id}",
        session_metadata={"subscription_id": str(subscription.id)},
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=60),
    )
    db.add(session)
    await db.flush()
    invoice.checkout_session_id = session.id

    if payment_method is None:
        result = sandbox_engine.AuthorizationResult(
            success=False, failure_reason="no_payment_method", gateway_reference="", masked_details={}
        )
    else:
        result = await sandbox_engine.authorize_off_session(
            payment_method.sandbox_digits or "", payment_method.method.value
        )

    fee_minor = calculate_fee_minor(price.amount_minor) if result.success else 0
    net_minor = calculate_net_minor(price.amount_minor, fee_minor) if result.success else 0

    transaction = Transaction(
        checkout_session_id=session.id,
        merchant_id=subscription.merchant_id,
        amount_minor=price.amount_minor,
        currency=price.currency,
        fee_minor=fee_minor,
        net_amount_minor=net_minor,
        status=TransactionStatus.SUCCEEDED if result.success else TransactionStatus.FAILED,
        gateway_reference=result.gateway_reference or None,
        failure_reason=result.failure_reason,
        payment_method_details=result.masked_details or (payment_method.masked_details if payment_method else {}),
    )
    db.add(transaction)

    # PaymentIntent/Charge orchestrator write, alongside the Transaction above
    # (Phase 2, dual-write — see payment_intent_engine module docstring).
    intent = await get_or_create_payment_intent(
        db,
        merchant_id=subscription.merchant_id,
        amount_minor=price.amount_minor,
        currency=price.currency,
        source_type=PaymentIntentSourceType.SUBSCRIPTION,
        source_id=subscription.id,
        idempotency_key=session.idempotency_key,
        payment_method_id=subscription.payment_method_id,
    )
    await record_charge_attempt(
        db,
        intent,
        adapter_name=f"mock_{(payment_method.method.value if payment_method else 'none')}",
        success=result.success,
        failure_reason=result.failure_reason,
        rail_reference_id=result.gateway_reference or None,
        raw_response_payload=result.masked_details,
    )

    session.status = CheckoutSessionStatus.SUCCEEDED if result.success else CheckoutSessionStatus.FAILED
    session.completed_at = datetime.now(timezone.utc)

    if result.success:
        invoice.status = InvoiceStatus.PAID
        invoice.paid_at = session.completed_at

    await db.flush()

    event_type = "invoice.paid" if result.success else "invoice.payment_failed"
    logs = await enqueue_webhook_event(
        db,
        merchant_id=subscription.merchant_id,
        event_type=event_type,
        data={
            "subscription_id": str(subscription.id),
            "invoice_id": str(invoice.id),
            "transaction_id": str(transaction.id),
            "amount_minor": price.amount_minor,
            "currency": price.currency,
        },
        transaction_id=transaction.id,
    )
    for log in logs:
        endpoint = await db.get(WebhookEndpoint, log.endpoint_id)
        if endpoint is not None:
            await deliver_webhook(db, log, endpoint)

    return result.success


async def run_subscription_billing(db: AsyncSession, now: datetime | None = None) -> list[Subscription]:
    """Finds subscriptions due for renewal (or retry) and attempts to charge them.

    On success: advances the period and clears failed_attempt_count.
    On failure: increments failed_attempt_count and marks PAST_DUE, or UNPAID
    once MAX_BILLING_ATTEMPTS is exceeded — this is the dunning behavior.
    A subscription flagged cancel_at_period_end is retired instead of charged
    once its current period lapses.
    """
    now = now or datetime.now(timezone.utc)

    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]),
            Subscription.current_period_end <= now,
        )
        .options(selectinload(Subscription.price))
    )
    due = list(result.scalars().all())
    processed: list[Subscription] = []

    for subscription in due:
        if subscription.cancel_at_period_end:
            subscription.status = SubscriptionStatus.CANCELED
            subscription.canceled_at = now
            processed.append(subscription)
            continue

        price = subscription.price or await db.get(Price, subscription.price_id)
        succeeded = await charge_subscription_cycle(db, subscription, price)

        if succeeded:
            subscription.current_period_start = subscription.current_period_end
            subscription.current_period_end = compute_period_end(subscription.current_period_end, price)
            subscription.failed_attempt_count = 0
            subscription.status = SubscriptionStatus.ACTIVE
        else:
            subscription.failed_attempt_count += 1
            if subscription.failed_attempt_count >= MAX_BILLING_ATTEMPTS:
                subscription.status = SubscriptionStatus.UNPAID
            else:
                subscription.status = SubscriptionStatus.PAST_DUE

        processed.append(subscription)

    await db.flush()
    return processed


async def run_subscription_billing_job() -> None:
    """APScheduler job wrapper: runs subscription billing once per mode (sandbox
    and production subscriptions are entirely separate — see core/db.py)."""
    for mode in Mode:
        async with session_factory_for_mode(mode)() as db:
            stamp_mode(db, mode)
            await run_subscription_billing(db)
            await db.commit()
