from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant
from app.core.db import get_db
from app.models.checkout_session import CheckoutSession
from app.models.invoice import Invoice
from app.models.merchant import Merchant
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.customer import CustomerDetailResponse, CustomerSummary
from app.schemas.invoice import InvoiceResponse
from app.schemas.transaction import TransactionResponse

router = APIRouter(prefix="/customers", tags=["customers"])


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

    return [
        CustomerSummary(
            email=row.customer_email,
            total_spent_minor=row.total_spent,
            currency=row.currency,
            transaction_count=row.tx_count,
            last_transaction_at=row.last_tx_at,
        )
        for row in result.all()
    ]


@router.get("/{email}", response_model=CustomerDetailResponse)
async def get_customer_detail(
    email: str, merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> CustomerDetailResponse:
    from app.api.v1.invoices import _to_response as invoice_to_response

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

    return CustomerDetailResponse(
        email=email,
        name=name,
        total_spent_minor=total_spent,
        currency=currency,
        transaction_count=len(succeeded),
        first_seen_at=first_session.created_at if first_session else None,
        last_transaction_at=transactions[0].created_at if transactions else None,
        transactions=[TransactionResponse.model_validate(t) for t in transactions],
        invoices=[invoice_to_response(inv) for inv in invoices],
    )
