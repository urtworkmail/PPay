from fastapi import APIRouter, Depends, Query
from sqlalchemy import cast, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, get_request_mode
from app.core.db import Mode, get_db
from app.core.public_ref import INVOICE_PREFIX, PAYMENT_LINK_PREFIX, encode_ref
from app.models.checkout_session import CheckoutSession
from app.models.invoice import Invoice
from app.models.merchant import Merchant
from app.models.payment_link import PaymentLink
from app.models.transaction import Transaction
from app.schemas.search import SearchResponse, SearchResult

router = APIRouter(prefix="/search", tags=["search"])

RESULT_LIMIT = 5


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(min_length=2, max_length=255),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> SearchResponse:
    pattern = f"%{q}%"
    results: list[SearchResult] = []

    tx_result = await db.execute(
        select(Transaction)
        .where(
            Transaction.merchant_id == merchant.id,
            or_(
                Transaction.gateway_reference.ilike(pattern),
                cast(Transaction.id, String).ilike(pattern),
            ),
        )
        .order_by(Transaction.created_at.desc())
        .limit(RESULT_LIMIT)
    )
    for tx in tx_result.scalars().all():
        results.append(
            SearchResult(
                type="transaction",
                id=str(tx.id),
                label=tx.gateway_reference or str(tx.id)[:8],
                sublabel=f"{tx.amount_minor / 100:.2f} {tx.currency} · {tx.status}",
                path=f"/dashboard/transactions/{tx.id}",
            )
        )

    customer_result = await db.execute(
        select(CheckoutSession.customer_email)
        .where(
            CheckoutSession.merchant_id == merchant.id,
            CheckoutSession.customer_email.ilike(pattern),
        )
        .distinct()
        .limit(RESULT_LIMIT)
    )
    for (email,) in customer_result.all():
        results.append(SearchResult(type="customer", id=email, label=email, path=f"/dashboard/customers/{email}"))

    invoice_result = await db.execute(
        select(Invoice)
        .where(
            Invoice.merchant_id == merchant.id,
            or_(
                Invoice.customer_email.ilike(pattern),
                Invoice.customer_name.ilike(pattern),
                cast(Invoice.id, String).ilike(pattern),
            ),
        )
        .order_by(Invoice.created_at.desc())
        .limit(RESULT_LIMIT)
    )
    for inv in invoice_result.scalars().all():
        public_id = encode_ref(INVOICE_PREFIX, mode, inv.id)
        results.append(
            SearchResult(
                type="invoice",
                id=public_id,
                label=inv.customer_name or inv.customer_email,
                sublabel=f"{inv.amount_minor / 100:.2f} {inv.currency} · {inv.status}",
                path=f"/dashboard/invoices/{public_id}",
            )
        )

    link_result = await db.execute(
        select(PaymentLink)
        .where(
            PaymentLink.merchant_id == merchant.id,
            or_(
                PaymentLink.title.ilike(pattern),
                cast(PaymentLink.id, String).ilike(pattern),
            ),
        )
        .order_by(PaymentLink.created_at.desc())
        .limit(RESULT_LIMIT)
    )
    for link in link_result.scalars().all():
        public_id = encode_ref(PAYMENT_LINK_PREFIX, mode, link.id)
        results.append(
            SearchResult(
                type="payment_link",
                id=public_id,
                label=link.title,
                sublabel=f"{link.amount_minor / 100:.2f} {link.currency}",
                path=f"/dashboard/payment-links/{public_id}",
            )
        )

    return SearchResponse(results=results)
