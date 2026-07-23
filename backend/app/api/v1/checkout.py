import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_merchant_and_key_from_api_key, get_merchant_from_api_key
from app.core.config import get_settings
from app.core.db import Mode, get_db, session_factory_for_mode
from app.core.idempotency import require_idempotency_key
from app.core.public_ref import CHECKOUT_SESSION_PREFIX, decode_ref, encode_ref
from app.models.api_key import ApiKey, ApiKeyMode
from app.models.checkout_session import CheckoutSession, CheckoutSessionStatus, PaymentMethod
from app.models.invoice import Invoice, InvoiceStatus
from app.models.merchant import Merchant
from app.models.payment_intent import PaymentIntentSourceType
from app.models.subscription import SavedPaymentMethod, SavedPaymentMethodType, Subscription, SubscriptionStatus
from app.models.transaction import Transaction, TransactionStatus
from app.models.webhook import WebhookEndpoint
from app.schemas.branding import MerchantBrandingSummary
from app.schemas.checkout import CheckoutPayRequest, CheckoutSessionCreateRequest, CheckoutSessionResponse
from app.schemas.transaction import TransactionResponse
from app.services import sandbox_engine
from app.services.fee_calculator import calculate_fee_minor, calculate_net_minor
from app.services.payment_intent_engine import get_or_create_payment_intent, record_charge_attempt
from app.services.subscription_engine import activate_subscription
from app.services.webhook_dispatcher import deliver_webhook, enqueue_webhook_event

router = APIRouter(prefix="/checkout", tags=["checkout"])
SESSION_TTL_MINUTES = 30
CHECKOUT_FRONTEND_PATH = "/checkout"


def _checkout_url(public_ref: str) -> str:
    settings = get_settings()
    frontend_origin = settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"
    return f"{frontend_origin}{CHECKOUT_FRONTEND_PATH}/{public_ref}"


def mode_of(api_key: ApiKey) -> Mode:
    return Mode.LIVE if api_key.mode == ApiKeyMode.LIVE else Mode.SANDBOX


def _to_response(session: CheckoutSession, mode: Mode, merchant: Merchant | None = None) -> CheckoutSessionResponse:
    public_id = encode_ref(CHECKOUT_SESSION_PREFIX, mode, session.id)
    return CheckoutSessionResponse(
        id=public_id,
        amount_minor=session.amount_minor,
        currency=session.currency,
        status=session.status,
        method=session.method,
        customer_email=session.customer_email,
        description=session.description,
        return_url=session.return_url,
        checkout_url=_checkout_url(public_id),
        created_at=session.created_at,
        expires_at=session.expires_at,
        completed_at=session.completed_at,
        merchant=MerchantBrandingSummary.model_validate(merchant) if merchant else None,
    )


@router.post("/sessions", response_model=CheckoutSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_checkout_session(
    payload: CheckoutSessionCreateRequest,
    idempotency_key: str = Depends(require_idempotency_key),
    merchant_and_key: tuple[Merchant, ApiKey] = Depends(get_merchant_and_key_from_api_key),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionResponse:
    merchant, api_key = merchant_and_key
    existing = await db.execute(
        select(CheckoutSession).where(
            CheckoutSession.merchant_id == merchant.id,
            CheckoutSession.idempotency_key == idempotency_key,
        )
    )
    existing_session = existing.scalar_one_or_none()
    if existing_session is not None:
        replayed_params = (
            existing_session.amount_minor,
            existing_session.currency,
            existing_session.description,
            existing_session.customer_email,
            existing_session.customer_phone,
            existing_session.return_url,
            existing_session.session_metadata,
        )
        new_params = (
            payload.amount_minor,
            payload.currency.upper(),
            payload.description,
            payload.customer_email,
            payload.customer_phone,
            payload.return_url,
            payload.metadata,
        )
        if replayed_params != new_params:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Idempotency key already used with different parameters"
            )
        return _to_response(existing_session, mode_of(api_key))

    session = CheckoutSession(
        merchant_id=merchant.id,
        api_key_id=api_key.id,
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

    return _to_response(session, mode_of(api_key))


def _decode_checkout_ref(session_id: str) -> tuple[Mode, uuid.UUID]:
    try:
        decoded = decode_ref(CHECKOUT_SESSION_PREFIX, session_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checkout session not found") from exc
    return decoded.mode, decoded.id


@router.get("/sessions/{session_id}", response_model=CheckoutSessionResponse)
async def get_checkout_session(session_id: str) -> CheckoutSessionResponse:
    # Public, unauthenticated route (the buyer's browser hits this directly) —
    # mode comes from the reference itself, not from a header, since there is
    # no API key or dashboard session here to read it from.
    mode, real_id = _decode_checkout_ref(session_id)
    async with session_factory_for_mode(mode)() as db:
        session = await db.get(CheckoutSession, real_id)
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checkout session not found")

        if session.status == CheckoutSessionStatus.CREATED and session.expires_at < datetime.now(timezone.utc):
            session.status = CheckoutSessionStatus.EXPIRED
            await db.commit()
            await db.refresh(session)

        merchant = await db.get(Merchant, session.merchant_id)
        return _to_response(session, mode, merchant)


@router.post("/sessions/{session_id}/pay", response_model=TransactionResponse)
async def pay_checkout_session(session_id: str, payload: CheckoutPayRequest) -> Transaction:
    mode, real_id = _decode_checkout_ref(session_id)
    async with session_factory_for_mode(mode)() as db:
        return await _pay_checkout_session(real_id, payload, db)


async def _pay_checkout_session(session_id: uuid.UUID, payload: CheckoutPayRequest, db: AsyncSession) -> Transaction:
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

    merchant = await db.get(Merchant, session.merchant_id)
    if merchant is not None and method.value not in merchant.enabled_payment_methods:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{method.value} is not enabled for this merchant")

    # Sessions created without an email up front (payment links, pay-by-link
    # invoices) get one attached here so the payment is still attributable to
    # a customer — matches what the merchant-integration create-session path
    # already captures.
    if session.customer_email is None and payload.customer_email:
        session.customer_email = payload.customer_email

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

    # PaymentIntent/Charge orchestrator write, alongside the Transaction above
    # (Phase 2, dual-write — see payment_intent_engine module docstring). This
    # is what gives "the rail timed out" its own requires_reconciliation state
    # instead of being indistinguishable from a normal decline.
    intent = await get_or_create_payment_intent(
        db,
        merchant_id=session.merchant_id,
        amount_minor=session.amount_minor,
        currency=session.currency,
        source_type=PaymentIntentSourceType.CHECKOUT,
        source_id=session.id,
        idempotency_key=session.idempotency_key,
    )
    await record_charge_attempt(
        db,
        intent,
        adapter_name=f"mock_{method.value}",
        success=result.success,
        failure_reason=result.failure_reason,
        rail_reference_id=result.gateway_reference or None,
        raw_response_payload=result.masked_details,
    )

    session.status = CheckoutSessionStatus.SUCCEEDED if result.success else CheckoutSessionStatus.FAILED
    session.completed_at = datetime.now(timezone.utc)

    invoice = None
    subscription = None
    if result.success:
        invoice_result = await db.execute(select(Invoice).where(Invoice.checkout_session_id == session.id))
        invoice = invoice_result.scalar_one_or_none()
        if invoice is not None and invoice.subscription_id is not None:
            subscription = await db.get(Subscription, invoice.subscription_id)

    # A subscription's first payment always needs a payment method on file to
    # bill future cycles, regardless of what the checkbox on the pay page said.
    should_save_method = payload.save_payment_method or (
        subscription is not None and subscription.status == SubscriptionStatus.INCOMPLETE
    )

    saved_method_id = None
    if result.success and should_save_method and method in (PaymentMethod.CARD, PaymentMethod.WALLET) and session.customer_email:
        digits = (payload.card_number if method == PaymentMethod.CARD else payload.wallet_phone) or ""
        saved_type = SavedPaymentMethodType.CARD if method == PaymentMethod.CARD else SavedPaymentMethodType.WALLET
        existing_method = await db.execute(
            select(SavedPaymentMethod).where(
                SavedPaymentMethod.merchant_id == session.merchant_id,
                SavedPaymentMethod.customer_email == session.customer_email,
                SavedPaymentMethod.method == saved_type,
            )
        )
        saved_method = existing_method.scalar_one_or_none()
        if saved_method is None:
            saved_method = SavedPaymentMethod(
                merchant_id=session.merchant_id, customer_email=session.customer_email, method=saved_type
            )
            db.add(saved_method)
        saved_method.masked_details = result.masked_details
        saved_method.sandbox_digits = "".join(ch for ch in digits if ch.isdigit())
        await db.flush()
        saved_method_id = saved_method.id

    if result.success and invoice is not None:
        invoice.status = InvoiceStatus.PAID
        invoice.paid_at = session.completed_at

        if subscription is not None and subscription.status == SubscriptionStatus.INCOMPLETE:
            method_id = saved_method_id or subscription.payment_method_id
            if method_id is not None:
                await activate_subscription(db, subscription, method_id, now=session.completed_at)

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
