import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_merchant_from_api_key
from app.core.config import get_settings
from app.core.db import get_db
from app.core.idempotency import require_idempotency_key
from app.models.checkout_session import CheckoutSession, CheckoutSessionStatus, PaymentMethod
from app.models.invoice import Invoice, InvoiceStatus
from app.models.merchant import Merchant
from app.models.transaction import Transaction, TransactionStatus
from app.models.webhook import WebhookEndpoint
from app.schemas.checkout import CheckoutPayRequest, CheckoutSessionCreateRequest, CheckoutSessionResponse
from app.schemas.transaction import TransactionResponse
from app.services import sandbox_engine
from app.services.fee_calculator import calculate_fee_minor, calculate_net_minor
from app.services.webhook_dispatcher import deliver_webhook, enqueue_webhook_event

router = APIRouter(prefix="/checkout", tags=["checkout"])
SESSION_TTL_MINUTES = 30
CHECKOUT_FRONTEND_PATH = "/checkout"


def _checkout_url(session_id: uuid.UUID) -> str:
    settings = get_settings()
    frontend_origin = settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"
    return f"{frontend_origin}{CHECKOUT_FRONTEND_PATH}/{session_id}"


def _to_response(session: CheckoutSession) -> CheckoutSessionResponse:
    return CheckoutSessionResponse(
        id=session.id,
        amount_minor=session.amount_minor,
        currency=session.currency,
        status=session.status,
        method=session.method,
        customer_email=session.customer_email,
        description=session.description,
        return_url=session.return_url,
        checkout_url=_checkout_url(session.id),
        created_at=session.created_at,
        expires_at=session.expires_at,
        completed_at=session.completed_at,
    )


@router.post("/sessions", response_model=CheckoutSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_checkout_session(
    payload: CheckoutSessionCreateRequest,
    idempotency_key: str = Depends(require_idempotency_key),
    merchant: Merchant = Depends(get_merchant_from_api_key),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionResponse:
    existing = await db.execute(
        select(CheckoutSession).where(
            CheckoutSession.merchant_id == merchant.id,
            CheckoutSession.idempotency_key == idempotency_key,
        )
    )
    existing_session = existing.scalar_one_or_none()
    if existing_session is not None:
        return _to_response(existing_session)

    session = CheckoutSession(
        merchant_id=merchant.id,
        amount_minor=payload.amount_minor,
        currency=payload.currency.upper(),
        description=payload.description,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        return_url=payload.return_url,
        idempotency_key=idempotency_key,
        session_metadata=payload.metadata,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=SESSION_TTL_MINUTES),
    )
    db.add(session)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Idempotency key already used with different parameters"
        ) from exc
    await db.refresh(session)

    return _to_response(session)


@router.get("/sessions/{session_id}", response_model=CheckoutSessionResponse)
async def get_checkout_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> CheckoutSessionResponse:
    session = await db.get(CheckoutSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checkout session not found")

    if session.status == CheckoutSessionStatus.CREATED and session.expires_at < datetime.now(timezone.utc):
        session.status = CheckoutSessionStatus.EXPIRED
        await db.commit()
        await db.refresh(session)

    return _to_response(session)


@router.post("/sessions/{session_id}/pay", response_model=TransactionResponse)
async def pay_checkout_session(
    session_id: uuid.UUID, payload: CheckoutPayRequest, db: AsyncSession = Depends(get_db)
) -> Transaction:
    session = await db.get(CheckoutSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checkout session not found")
    if session.status not in (CheckoutSessionStatus.CREATED, CheckoutSessionStatus.PENDING):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Session is already {session.status}")
    if session.expires_at < datetime.now(timezone.utc):
        session.status = CheckoutSessionStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Checkout session expired")

    try:
        method = PaymentMethod(payload.method)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment method") from exc

    session.status = CheckoutSessionStatus.PENDING
    session.method = method
    await db.commit()

    if method == PaymentMethod.CARD:
        if not payload.card_number:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="card_number is required")
        result = await sandbox_engine.authorize_card(payload.card_number)
    elif method == PaymentMethod.WALLET:
        if not payload.wallet_phone:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="wallet_phone is required")
        result = await sandbox_engine.authorize_wallet(payload.wallet_phone)
    elif method == PaymentMethod.BANK_TRANSFER:
        result = await sandbox_engine.authorize_bank_transfer()
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported payment method for sandbox")

    fee_minor = calculate_fee_minor(session.amount_minor) if result.success else 0
    net_minor = calculate_net_minor(session.amount_minor, fee_minor) if result.success else 0

    transaction = Transaction(
        checkout_session_id=session.id,
        merchant_id=session.merchant_id,
        amount_minor=session.amount_minor,
        currency=session.currency,
        fee_minor=fee_minor,
        net_amount_minor=net_minor,
        status=TransactionStatus.SUCCEEDED if result.success else TransactionStatus.FAILED,
        gateway_reference=result.gateway_reference,
        failure_reason=result.failure_reason,
        payment_method_details=result.masked_details,
    )
    db.add(transaction)

    session.status = CheckoutSessionStatus.SUCCEEDED if result.success else CheckoutSessionStatus.FAILED
    session.completed_at = datetime.now(timezone.utc)

    if result.success:
        invoice_result = await db.execute(select(Invoice).where(Invoice.checkout_session_id == session.id))
        invoice = invoice_result.scalar_one_or_none()
        if invoice is not None:
            invoice.status = InvoiceStatus.PAID
            invoice.paid_at = session.completed_at

    await db.flush()

    event_type = "payment_intent.succeeded" if result.success else "payment_intent.failed"
    logs = await enqueue_webhook_event(
        db,
        merchant_id=session.merchant_id,
        event_type=event_type,
        data={
            "transaction_id": str(transaction.id),
            "checkout_session_id": str(session.id),
            "amount_minor": transaction.amount_minor,
            "currency": transaction.currency,
            "status": transaction.status,
            "failure_reason": transaction.failure_reason,
        },
        transaction_id=transaction.id,
    )
    await db.commit()
    await db.refresh(transaction)

    for log in logs:
        endpoint = await db.get(WebhookEndpoint, log.endpoint_id)
        if endpoint is not None:
            await deliver_webhook(db, log, endpoint)
    if logs:
        await db.commit()

    return transaction
