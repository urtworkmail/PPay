import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.checkout import _checkout_url
from app.api.v1.deps import get_current_merchant
from app.core.db import get_db
from app.models.checkout_session import CheckoutSession
from app.models.invoice import Invoice, InvoiceStatus
from app.models.merchant import Merchant
from app.models.product import Price, Product
from app.models.subscription import SavedPaymentMethod, Subscription, SubscriptionStatus
from app.models.transaction import Transaction
from app.models.webhook import WebhookEndpoint, WebhookLog
from app.schemas.subscription import (
    SavedPaymentMethodSummary,
    SubscriptionCancelRequest,
    SubscriptionCreateRequest,
    SubscriptionDetailResponse,
    SubscriptionResponse,
)
from app.schemas.transaction import RelatedSubscription, WebhookLogResponse
from app.services.subscription_engine import activate_subscription, charge_subscription_cycle

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
SESSION_TTL_MINUTES = 60


def _payment_method_label(details: dict) -> str:
    method = details.get("method")
    if method == "card":
        return f"Card •••• {details.get('last4', '????')}"
    if method == "wallet":
        return f"Wallet •••{details.get('phone_last4', '????')}"
    return (method or "unknown").replace("_", " ").capitalize()


def _to_response(subscription: Subscription, checkout_url: str | None = None) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=subscription.id,
        customer_email=subscription.customer_email,
        customer_name=subscription.customer_name,
        price=subscription.price,
        status=subscription.status,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        failed_attempt_count=subscription.failed_attempt_count,
        cancel_at_period_end=subscription.cancel_at_period_end,
        canceled_at=subscription.canceled_at,
        checkout_url=checkout_url,
        created_at=subscription.created_at,
    )


async def _load(db: AsyncSession, subscription_id: uuid.UUID, merchant_id: uuid.UUID) -> Subscription | None:
    result = await db.execute(
        select(Subscription)
        .where(Subscription.id == subscription_id, Subscription.merchant_id == merchant_id)
        .options(selectinload(Subscription.price))
    )
    return result.unique().scalar_one_or_none()


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    payload: SubscriptionCreateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    price = await db.get(Price, payload.price_id)
    if price is None or price.merchant_id != merchant.id or not price.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Price not found")

    now = datetime.now(timezone.utc)
    subscription = Subscription(
        merchant_id=merchant.id,
        customer_email=payload.customer_email,
        customer_name=payload.customer_name,
        price_id=price.id,
        status=SubscriptionStatus.INCOMPLETE,
        current_period_start=now,
        current_period_end=now,
    )
    db.add(subscription)
    await db.flush()

    # If this customer already has a card/wallet on file, we can charge them
    # immediately instead of sending them back through checkout — the same
    # "existing customer, one-click subscribe" flow Stripe supports.
    method_result = await db.execute(
        select(SavedPaymentMethod)
        .where(
            SavedPaymentMethod.merchant_id == merchant.id,
            SavedPaymentMethod.customer_email == payload.customer_email,
        )
        .order_by(SavedPaymentMethod.created_at.desc())
        .limit(1)
    )
    saved_method = method_result.scalar_one_or_none()

    checkout_url = None
    if saved_method is not None:
        # charge_subscription_cycle charges whatever payment_method_id is
        # currently on the subscription — set it up front so the very first
        # charge can find the saved card/wallet (activate_subscription only
        # runs, and re-confirms this same id, once the charge succeeds).
        subscription.payment_method_id = saved_method.id
        await db.flush()
        succeeded = await charge_subscription_cycle(db, subscription, price, billing_reason="subscription_first")
        if succeeded:
            await activate_subscription(db, subscription, saved_method.id, now=now)
    else:
        invoice = Invoice(
            merchant_id=merchant.id,
            customer_name=payload.customer_name,
            customer_email=payload.customer_email,
            amount_minor=price.amount_minor,
            currency=price.currency,
            description=f"Subscription ({price.interval.value})",
            status=InvoiceStatus.SENT,
            subscription_id=subscription.id,
            billing_reason="subscription_first",
            sent_at=now,
        )
        db.add(invoice)
        await db.flush()

        session = CheckoutSession(
            merchant_id=merchant.id,
            amount_minor=price.amount_minor,
            currency=price.currency,
            description=invoice.description,
            customer_email=payload.customer_email,
            idempotency_key=f"sub_{subscription.id}_first",
            session_metadata={"subscription_id": str(subscription.id)},
            expires_at=now + timedelta(minutes=SESSION_TTL_MINUTES),
        )
        db.add(session)
        await db.flush()
        invoice.checkout_session_id = session.id
        checkout_url = _checkout_url(session.id)

    await db.commit()

    subscription = await _load(db, subscription.id, merchant.id)
    return _to_response(subscription, checkout_url=checkout_url)


@router.get("", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[SubscriptionResponse]:
    result = await db.execute(
        select(Subscription)
        .where(Subscription.merchant_id == merchant.id)
        .options(selectinload(Subscription.price))
        .order_by(Subscription.created_at.desc())
    )
    return [_to_response(s) for s in result.unique().scalars().all()]


@router.get("/{subscription_id}", response_model=SubscriptionDetailResponse)
async def get_subscription_detail(
    subscription_id: uuid.UUID, merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> SubscriptionDetailResponse:
    from app.api.v1.invoices import _to_response as invoice_to_response
    from app.schemas.transaction import TransactionResponse

    subscription = await _load(db, subscription_id, merchant.id)
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    invoice_result = await db.execute(
        select(Invoice).where(Invoice.subscription_id == subscription.id).order_by(Invoice.created_at.desc())
    )
    invoices = list(invoice_result.scalars().all())

    subscription_link = RelatedSubscription(id=subscription.id, status=subscription.status)
    transaction_ids: list[uuid.UUID] = []
    invoice_details = []
    for inv in invoices:
        transaction = None
        if inv.checkout_session_id is not None:
            tx_result = await db.execute(
                select(Transaction).where(Transaction.checkout_session_id == inv.checkout_session_id)
            )
            transaction = tx_result.scalar_one_or_none()
            if transaction is not None:
                transaction_ids.append(transaction.id)
        invoice_details.append(
            {
                **invoice_to_response(inv).model_dump(),
                "transaction": TransactionResponse.model_validate(transaction) if transaction else None,
                "subscription": subscription_link,
            }
        )

    payment_method = None
    if subscription.payment_method_id is not None:
        method = await db.get(SavedPaymentMethod, subscription.payment_method_id)
        if method is not None:
            payment_method = SavedPaymentMethodSummary(
                id=method.id,
                method=method.method.value,
                label=_payment_method_label(method.masked_details or {}),
                created_at=method.created_at,
            )

    product_name = None
    price = subscription.price
    if price is not None:
        product = await db.get(Product, price.product_id)
        if product is not None:
            product_name = product.name

    webhook_logs = []
    if transaction_ids:
        logs_result = await db.execute(
            select(WebhookLog)
            .join(WebhookEndpoint, WebhookLog.endpoint_id == WebhookEndpoint.id)
            .where(WebhookLog.transaction_id.in_(transaction_ids), WebhookEndpoint.merchant_id == merchant.id)
            .order_by(WebhookLog.created_at.desc())
        )
        webhook_logs = [WebhookLogResponse.model_validate(log) for log in logs_result.scalars().all()]

    base = _to_response(subscription)
    return SubscriptionDetailResponse(
        **base.model_dump(),
        invoices=invoice_details,
        payment_method=payment_method,
        product_name=product_name,
        webhook_logs=webhook_logs,
    )


@router.post("/{subscription_id}/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(
    subscription_id: uuid.UUID,
    payload: SubscriptionCancelRequest,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    subscription = await _load(db, subscription_id, merchant.id)
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    if subscription.status == SubscriptionStatus.CANCELED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Subscription already canceled")

    if payload.at_period_end:
        subscription.cancel_at_period_end = True
    else:
        subscription.status = SubscriptionStatus.CANCELED
        subscription.canceled_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(subscription)
    return _to_response(subscription)
