import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, get_merchant_flexible, require_role
from app.core.db import get_db
from app.models.api_key import ApiKey
from app.models.checkout_session import CheckoutSession
from app.models.invoice import Invoice
from app.models.merchant import Merchant
from app.models.notification import NotificationCategory
from app.models.payment_intent import PaymentIntent, PaymentIntentSourceType
from app.models.charge import Charge
from app.models.payment_link import PaymentLink
from app.models.refund import Refund
from app.models.subscription import Subscription
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User, UserRole
from app.models.webhook import WebhookEndpoint, WebhookLog
from app.schemas.transaction import (
    RefundCreateRequest,
    RefundResponse,
    RelatedInvoice,
    RelatedPaymentLink,
    RelatedSubscription,
    TimelineEvent,
    TransactionDetailResponse,
    TransactionListResponse,
    TransactionResponse,
    WebhookLogResponse,
)
from app.services.notifications import notify
from app.services.payment_intent_engine import apply_refund
from app.services.webhook_dispatcher import deliver_webhook, enqueue_webhook_event

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    status_filter: TransactionStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    merchant: Merchant = Depends(get_merchant_flexible),
    db: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    base_query = (
        select(Transaction, CheckoutSession.customer_email, PaymentIntent.status)
        .join(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
        .outerjoin(
            PaymentIntent,
            (PaymentIntent.source_id == Transaction.checkout_session_id)
            & (PaymentIntent.source_type == PaymentIntentSourceType.CHECKOUT),
        )
        .where(Transaction.merchant_id == merchant.id)
    )
    count_query = select(func.count()).select_from(Transaction).where(Transaction.merchant_id == merchant.id)

    if status_filter is not None:
        base_query = base_query.where(Transaction.status == status_filter)
        count_query = count_query.where(Transaction.status == status_filter)

    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(
        base_query.order_by(Transaction.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = [
        TransactionResponse(
            **TransactionResponse.model_validate(t).model_dump()
            | {"customer_email": email, "payment_intent_status": intent_status}
        )
        for t, email, intent_status in result.all()
    ]

    return TransactionListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{transaction_id}", response_model=TransactionDetailResponse)
async def get_transaction(
    transaction_id: uuid.UUID,
    merchant: Merchant = Depends(get_merchant_flexible),
    db: AsyncSession = Depends(get_db),
) -> TransactionDetailResponse:
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.merchant_id == merchant.id)
    )
    transaction = result.scalar_one_or_none()
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    session = await db.get(CheckoutSession, transaction.checkout_session_id)

    payment_link = None
    invoice_link = None
    subscription_link = None
    api_key_prefix = None
    customer_name = None
    if session is not None:
        if isinstance(session.session_metadata, dict):
            customer_name = session.session_metadata.get("customer_name")
        if session.payment_link_id is not None:
            link = await db.get(PaymentLink, session.payment_link_id)
            if link is not None:
                payment_link = RelatedPaymentLink(id=link.id, title=link.title)
        if session.api_key_id is not None:
            key = await db.get(ApiKey, session.api_key_id)
            if key is not None:
                api_key_prefix = key.key_prefix

        invoice_result = await db.execute(select(Invoice).where(Invoice.checkout_session_id == session.id))
        invoice = invoice_result.scalar_one_or_none()
        if invoice is not None:
            invoice_link = RelatedInvoice(id=invoice.id, status=invoice.status)
            if invoice.subscription_id is not None:
                subscription = await db.get(Subscription, invoice.subscription_id)
                if subscription is not None:
                    subscription_link = RelatedSubscription(id=subscription.id, status=subscription.status)

    refunds_result = await db.execute(
        select(Refund).where(Refund.transaction_id == transaction.id).order_by(Refund.created_at.asc())
    )
    refunds = list(refunds_result.scalars().all())

    intent_result = await db.execute(
        select(PaymentIntent).where(
            PaymentIntent.source_id == transaction.checkout_session_id,
            PaymentIntent.source_type == PaymentIntentSourceType.CHECKOUT,
        )
    )
    intent = intent_result.scalar_one_or_none()
    charge_attempts = 0
    if intent is not None:
        charges_result = await db.execute(select(func.count()).select_from(Charge).where(Charge.payment_intent_id == intent.id))
        charge_attempts = charges_result.scalar_one()

    logs_result = await db.execute(
        select(WebhookLog)
        .join(WebhookEndpoint, WebhookLog.endpoint_id == WebhookEndpoint.id)
        .where(WebhookLog.transaction_id == transaction.id, WebhookEndpoint.merchant_id == merchant.id)
        .order_by(WebhookLog.created_at.asc())
    )
    webhook_logs = list(logs_result.scalars().all())

    timeline: list[TimelineEvent] = []
    if session is not None:
        timeline.append(TimelineEvent(event="Checkout session created", at=session.created_at))
    timeline.append(TimelineEvent(event="Payment attempted", at=transaction.created_at))
    if transaction.status == TransactionStatus.SUCCEEDED:
        timeline.append(TimelineEvent(event="Payment succeeded", at=transaction.created_at))
    elif transaction.status == TransactionStatus.FAILED:
        timeline.append(
            TimelineEvent(event=f"Payment failed ({transaction.failure_reason or 'unknown'})", at=transaction.created_at)
        )
    for refund in refunds:
        timeline.append(TimelineEvent(event=f"Refunded ({refund.reason or 'no reason given'})", at=refund.created_at))
    if transaction.settled:
        timeline.append(TimelineEvent(event="Settled", at=transaction.updated_at))
    timeline.sort(key=lambda e: e.at)

    return TransactionDetailResponse(
        **(
            TransactionResponse.model_validate(transaction).model_dump()
            | {
                "customer_email": session.customer_email if session else None,
                "payment_intent_status": intent.status if intent is not None else None,
            }
        ),
        customer_name=customer_name,
        refunds=[RefundResponse.model_validate(r) for r in refunds],
        webhook_logs=[WebhookLogResponse.model_validate(log) for log in webhook_logs],
        timeline=timeline,
        payment_link=payment_link,
        invoice=invoice_link,
        subscription=subscription_link,
        api_key_prefix=api_key_prefix,
        charge_attempts=charge_attempts,
    )


@router.post("/{transaction_id}/refund", response_model=RefundResponse, status_code=status.HTTP_201_CREATED)
async def refund_transaction(
    transaction_id: uuid.UUID,
    payload: RefundCreateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPPORT)),
    db: AsyncSession = Depends(get_db),
) -> Refund:
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.merchant_id == merchant.id)
    )
    transaction = result.scalar_one_or_none()
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    if transaction.status != TransactionStatus.SUCCEEDED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only succeeded transactions can be refunded")
    if transaction.settled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transaction has already been settled and can't be refunded in sandbox mode",
        )

    refund = Refund(
        transaction_id=transaction.id,
        merchant_id=merchant.id,
        amount_minor=transaction.amount_minor,
        reason=payload.reason,
    )
    db.add(refund)
    transaction.status = TransactionStatus.REFUNDED
    await db.flush()

    # Keep the PaymentIntent/Charge dual-write (checkout.py) honest: without
    # this, a refunded Transaction left its Charge silently still claiming to
    # be fully succeeded with no refund recorded against it.
    await apply_refund(
        db,
        source_type=PaymentIntentSourceType.CHECKOUT,
        source_id=transaction.checkout_session_id,
        amount_minor=refund.amount_minor,
    )

    await notify(
        db,
        merchant_id=merchant.id,
        category=NotificationCategory.REFUND,
        title="Refund issued",
        body=(
            f"{transaction.currency} {refund.amount_minor / 100:,.2f} was refunded"
            + (f" — {payload.reason}." if payload.reason else ".")
        ),
        resource_type="refund",
        resource_id=refund.id,
        link=f"/dashboard/transactions/{transaction.id}",
    )

    logs = await enqueue_webhook_event(
        db,
        merchant_id=merchant.id,
        event_type="charge.refunded",
        data={
            "transaction_id": str(transaction.id),
            "refund_id": str(refund.id),
            "amount_minor": refund.amount_minor,
            "currency": transaction.currency,
        },
        transaction_id=transaction.id,
    )
    await db.commit()
    await db.refresh(refund)

    for log in logs:
        endpoint = await db.get(WebhookEndpoint, log.endpoint_id)
        if endpoint is not None:
            await deliver_webhook(db, log, endpoint)
    if logs:
        await db.commit()

    return refund
