import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.checkout import _to_response as checkout_to_response
from app.api.v1.deps import get_current_merchant, get_request_mode
from app.core.config import get_settings
from app.core.db import Mode, get_db, session_factory_for_mode
from app.core.public_ref import INVOICE_PREFIX, decode_ref, encode_ref
from app.models.checkout_session import CheckoutSession, CheckoutSessionStatus
from app.models.invoice import Invoice, InvoiceStatus
from app.models.merchant import Merchant
from app.models.subscription import Subscription
from app.models.transaction import Transaction
from app.schemas.branding import MerchantBrandingSummary
from app.schemas.checkout import CheckoutSessionResponse
from app.schemas.invoice import InvoiceCreateRequest, InvoiceDetailResponse, InvoiceResponse
from app.schemas.transaction import RelatedSubscription, TransactionResponse

router = APIRouter(prefix="/invoices", tags=["invoices"])
SESSION_TTL_MINUTES = 60 * 24


def _frontend_origin() -> str:
    settings = get_settings()
    return settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"


def _decode_invoice_ref(invoice_id: str, expected_mode: Mode | None = None) -> uuid.UUID:
    try:
        decoded = decode_ref(INVOICE_PREFIX, invoice_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found") from exc
    if expected_mode is not None and decoded.mode != expected_mode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return decoded.id


def _to_response(invoice: Invoice, mode: Mode, merchant: Merchant | None = None) -> InvoiceResponse:
    public_id = encode_ref(INVOICE_PREFIX, mode, invoice.id)
    url = None
    if invoice.status != InvoiceStatus.DRAFT:
        url = f"{_frontend_origin()}/invoices/{public_id}"
    return InvoiceResponse(
        id=public_id,
        customer_name=invoice.customer_name,
        customer_email=invoice.customer_email,
        amount_minor=invoice.amount_minor,
        currency=invoice.currency,
        description=invoice.description,
        status=invoice.status,
        due_date=invoice.due_date,
        url=url,
        subscription_id=invoice.subscription_id,
        billing_reason=invoice.billing_reason,
        merchant=MerchantBrandingSummary.model_validate(merchant) if merchant else None,
        created_at=invoice.created_at,
        sent_at=invoice.sent_at,
        paid_at=invoice.paid_at,
    )


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> InvoiceResponse:
    invoice = Invoice(
        merchant_id=merchant.id,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        amount_minor=payload.amount_minor,
        currency=payload.currency.upper(),
        description=payload.description,
        due_date=payload.due_date,
        status=InvoiceStatus.SENT,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return _to_response(invoice, mode)


@router.get("", response_model=list[InvoiceResponse])
async def list_invoices(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> list[InvoiceResponse]:
    result = await db.execute(
        select(Invoice).where(Invoice.merchant_id == merchant.id).order_by(Invoice.created_at.desc())
    )
    return [_to_response(inv, mode) for inv in result.scalars().all()]


@router.get("/{invoice_id}", response_model=InvoiceDetailResponse)
async def get_invoice_detail(
    invoice_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> InvoiceDetailResponse:
    real_id = _decode_invoice_ref(invoice_id, expected_mode=mode)
    result = await db.execute(select(Invoice).where(Invoice.id == real_id, Invoice.merchant_id == merchant.id))
    invoice = result.scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    transaction = None
    if invoice.checkout_session_id is not None:
        tx_result = await db.execute(
            select(Transaction).where(Transaction.checkout_session_id == invoice.checkout_session_id)
        )
        transaction = tx_result.scalar_one_or_none()

    subscription_link = None
    if invoice.subscription_id is not None:
        subscription = await db.get(Subscription, invoice.subscription_id)
        if subscription is not None:
            subscription_link = RelatedSubscription(id=subscription.id, status=subscription.status)

    base = _to_response(invoice, mode)
    return InvoiceDetailResponse(
        **base.model_dump(),
        transaction=TransactionResponse.model_validate(transaction) if transaction else None,
        subscription=subscription_link,
    )


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> InvoiceResponse:
    real_id = _decode_invoice_ref(invoice_id, expected_mode=mode)
    result = await db.execute(select(Invoice).where(Invoice.id == real_id, Invoice.merchant_id == merchant.id))
    invoice = result.scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot cancel a paid invoice")
    invoice.status = InvoiceStatus.CANCELLED
    await db.commit()
    await db.refresh(invoice)
    return _to_response(invoice, mode)


@router.get("/{invoice_id}/public", response_model=InvoiceResponse)
async def get_invoice_public(invoice_id: str) -> InvoiceResponse:
    decoded = decode_ref(INVOICE_PREFIX, invoice_id)
    mode, real_id = decoded.mode, decoded.id
    async with session_factory_for_mode(mode)() as db:
        invoice = await db.get(Invoice, real_id)
        if invoice is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
        merchant = await db.get(Merchant, invoice.merchant_id)
        return _to_response(invoice, mode, merchant)


@router.post("/{invoice_id}/sessions", response_model=CheckoutSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session_from_invoice(invoice_id: str) -> CheckoutSessionResponse:
    decoded = decode_ref(INVOICE_PREFIX, invoice_id)
    mode, real_id = decoded.mode, decoded.id
    async with session_factory_for_mode(mode)() as db:
        return await _create_session_from_invoice(real_id, mode, db)


async def _create_session_from_invoice(invoice_id: uuid.UUID, mode: Mode, db: AsyncSession) -> CheckoutSessionResponse:
    invoice = await db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invoice already paid")
    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invoice was cancelled")

    if invoice.checkout_session_id is not None:
        existing = await db.get(CheckoutSession, invoice.checkout_session_id)
        if existing is not None and existing.status in (
            CheckoutSessionStatus.CREATED,
            CheckoutSessionStatus.PENDING,
        ):
            return checkout_to_response(existing, mode)

    session = CheckoutSession(
        merchant_id=invoice.merchant_id,
        amount_minor=invoice.amount_minor,
        currency=invoice.currency,
        description=invoice.description or f"Invoice for {invoice.customer_name or invoice.customer_email}",
        customer_email=invoice.customer_email,
        idempotency_key=f"invoice_{invoice.id}_{uuid.uuid4()}",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=SESSION_TTL_MINUTES),
    )
    db.add(session)
    await db.flush()
    invoice.checkout_session_id = session.id
    await db.commit()
    await db.refresh(session)

    return checkout_to_response(session, mode)
