from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.deps import get_current_merchant, get_request_mode
from app.core.db import Mode, get_db
from app.core.public_ref import PAYMENT_LINK_PREFIX, encode_ref
from app.models.checkout_session import CheckoutSession
from app.models.invoice import Invoice
from app.models.merchant import Merchant
from app.models.payment_link import PaymentLink
from app.models.subscription import SavedPaymentMethod, Subscription, SubscriptionStatus
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.customer import (
    CustomerDetailResponse,
    CustomerSummary,
    RelatedPaymentLinkSummary,
    SavedPaymentMethodSummary,
)
from app.schemas.invoice import InvoiceResponse
from app.schemas.transaction import TransactionResponse

router = APIRouter(prefix="/customers", tags=["customers"])


def _payment_method_label(details: dict) -> str:
    method = details.get("method")
    if method == "card":
        return f"Card •••• {details.get('last4', '????')}"
    if method == "wallet":
        return f"Wallet •••{details.get('phone_last4', '????')}"
    if method == "bank_transfer":
        return "Bank transfer"
    if method == "qr":
        return "QR"
    return (method or "unknown").replace("_", " ").capitalize()


@router.get("", response_model=list[CustomerSummary])
async def list_customers(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[CustomerSummary]:
    result = await db.execute(
        select(
            CheckoutSession.customer_email,
            func.sum(Transaction.amount_minor).label("total_spent"),
            func.max(Transaction.currency).label("currency"),
            func.count(Transaction.id).label("tx_count"),
            func.max(Transaction.created_at).label("last_tx_at"),
        )
        .join(Transaction, Transaction.checkout_session_id == CheckoutSession.id)
        .where(
            CheckoutSession.merchant_id == merchant.id,
            CheckoutSession.customer_email.is_not(None),
            Transaction.status == TransactionStatus.SUCCEEDED,
        )
        .group_by(CheckoutSession.customer_email)
        .order_by(func.max(Transaction.created_at).desc())
    )
    rows = result.all()

    sub_counts_result = await db.execute(
        select(Subscription.customer_email, func.count(Subscription.id))
        .where(
            Subscription.merchant_id == merchant.id,
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]),
        )
        .group_by(Subscription.customer_email)
    )
    sub_counts = dict(sub_counts_result.all())

    return [
        CustomerSummary(
            email=row.customer_email,
            total_spent_minor=row.total_spent,
            currency=row.currency,
            transaction_count=row.tx_count,
            last_transaction_at=row.last_tx_at,
            subscription_count=sub_counts.get(row.customer_email, 0),
        )
        for row in rows
    ]


@router.get("/{email}", response_model=CustomerDetailResponse)
async def get_customer_detail(
    email: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> CustomerDetailResponse:
    from app.api.v1.invoices import _to_response as invoice_to_response
    from app.api.v1.subscriptions import _to_response as subscription_to_response

    tx_result = await db.execute(
        select(Transaction)
        .join(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
        .where(CheckoutSession.merchant_id == merchant.id, CheckoutSession.customer_email == email)
        .order_by(Transaction.created_at.desc())
    )
    transactions = list(tx_result.scalars().all())

    if not transactions:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    succeeded = [t for t in transactions if t.status == TransactionStatus.SUCCEEDED]
    total_spent = sum(t.amount_minor for t in succeeded)
    currency = succeeded[0].currency if succeeded else transactions[0].currency

    session_result = await db.execute(
        select(CheckoutSession)
        .where(CheckoutSession.merchant_id == merchant.id, CheckoutSession.customer_email == email)
        .order_by(CheckoutSession.created_at.asc())
        .limit(1)
    )
    first_session = session_result.scalar_one_or_none()
    name = None
    if first_session is not None and isinstance(first_session.session_metadata, dict):
        name = first_session.session_metadata.get("customer_name")

    invoice_result = await db.execute(
        select(Invoice)
        .where(Invoice.merchant_id == merchant.id, Invoice.customer_email == email)
        .order_by(Invoice.created_at.desc())
    )
    invoices = list(invoice_result.scalars().all())

    payment_methods: list[str] = []
    for t in succeeded:
        label = _payment_method_label(t.payment_method_details or {})
        if label not in payment_methods:
            payment_methods.append(label)

    subscription_result = await db.execute(
        select(Subscription)
        .where(Subscription.merchant_id == merchant.id, Subscription.customer_email == email)
        .options(selectinload(Subscription.price))
        .order_by(Subscription.created_at.desc())
    )
    subscriptions = list(subscription_result.unique().scalars().all())

    saved_method_result = await db.execute(
        select(SavedPaymentMethod)
        .where(SavedPaymentMethod.merchant_id == merchant.id, SavedPaymentMethod.customer_email == email)
        .order_by(SavedPaymentMethod.created_at.desc())
    )
    saved_methods = list(saved_method_result.scalars().all())

    payment_link_result = await db.execute(
        select(PaymentLink)
        .join(CheckoutSession, CheckoutSession.payment_link_id == PaymentLink.id)
        .where(CheckoutSession.merchant_id == merchant.id, CheckoutSession.customer_email == email)
        .distinct()
    )
    payment_links = list(payment_link_result.scalars().all())

    return CustomerDetailResponse(
        email=email,
        name=name,
        total_spent_minor=total_spent,
        currency=currency,
        transaction_count=len(succeeded),
        first_seen_at=first_session.created_at if first_session else None,
        last_transaction_at=transactions[0].created_at if transactions else None,
        payment_methods=payment_methods,
        transactions=[
            TransactionResponse(**TransactionResponse.model_validate(t).model_dump() | {"customer_email": email})
            for t in transactions
        ],
        invoices=[invoice_to_response(inv, mode) for inv in invoices],
        subscriptions=[subscription_to_response(s) for s in subscriptions],
        saved_payment_methods=[
            SavedPaymentMethodSummary(
                id=m.id,
                method=m.method.value,
                label=_payment_method_label(m.masked_details or {}),
                created_at=m.created_at,
            )
            for m in saved_methods
        ],
        payment_links=[
            RelatedPaymentLinkSummary(id=encode_ref(PAYMENT_LINK_PREFIX, mode, link.id), title=link.title)
            for link in payment_links
        ],
    )
