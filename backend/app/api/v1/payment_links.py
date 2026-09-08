import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.checkout import _to_response as checkout_to_response
from app.api.v1.deps import get_current_merchant, get_request_mode
from app.core.config import get_settings
from app.core.db import Mode, get_db, session_factory_for_mode, stamp_mode
from app.core.public_ref import PAYMENT_LINK_PREFIX, decode_ref, encode_ref
from app.models.checkout_session import CheckoutSession
from app.models.merchant import Merchant
from app.models.payment_link import PaymentLink
from app.models.product import BillingInterval, Price, Product
from app.schemas.branding import MerchantBrandingSummary
from app.schemas.checkout import CheckoutSessionResponse
from app.schemas.payment_link import PaymentLinkCreateRequest, PaymentLinkDetailResponse, PaymentLinkResponse
from app.schemas.transaction import TransactionResponse

router = APIRouter(prefix="/payment-links", tags=["payment-links"])
SESSION_TTL_MINUTES = 30


def _frontend_origin() -> str:
    settings = get_settings()
    return settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"


def _to_response(
    link: PaymentLink,
    mode: Mode,
    customer_count: int = 0,
    product_name: str | None = None,
    merchant: Merchant | None = None,
) -> PaymentLinkResponse:
    public_id = encode_ref(PAYMENT_LINK_PREFIX, mode, link.id)
    return PaymentLinkResponse(
        id=public_id,
        title=link.title,
        description=link.description,
        amount_minor=link.amount_minor,
        currency=link.currency,
        is_active=link.is_active,
        usage_count=link.usage_count,
        url=f"{_frontend_origin()}/pay/{public_id}",
        created_at=link.created_at,
        customer_count=customer_count,
        price_id=link.price_id,
        product_name=product_name,
        merchant=MerchantBrandingSummary.model_validate(merchant) if merchant else None,
    )


async def _product_name_for(db: AsyncSession, link: PaymentLink) -> str | None:
    if link.price_id is None:
        return None
    result = await db.execute(
        select(Product.name).join(Price, Price.product_id == Product.id).where(Price.id == link.price_id)
    )
    return result.scalar_one_or_none()


def _decode_link_ref(link_id: str, expected_mode: Mode | None = None) -> uuid.UUID:
    try:
        decoded = decode_ref(PAYMENT_LINK_PREFIX, link_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found") from exc
    if expected_mode is not None and decoded.mode != expected_mode:
        # A test-mode key/session probing a live-mode id (or vice versa) sees
        # the same 404 a nonexistent id would — the standard cross-mode
        # behavior, and it never reveals whether the id exists in the other mode.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")
    return decoded.id


@router.post("", response_model=PaymentLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_link(
    payload: PaymentLinkCreateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> PaymentLinkResponse:
    result = await db.execute(
        select(Price, Product).join(Product, Price.product_id == Product.id).where(Price.id == payload.price_id)
    )
    row = result.first()
    if row is None or row[0].merchant_id != merchant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Price not found")
    price, product = row
    if not price.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This price has been deactivated")
    if price.interval != BillingInterval.ONE_TIME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recurring prices can't be used for payment links — create a subscription instead",
        )

    # The link copies amount/title at creation time rather than joining live,
    # so a link keeps working exactly as shared even if the
    # price is later deactivated (prices are otherwise immutable — no amount
    # ever changes underneath a link that's already gone out).
    link = PaymentLink(
        merchant_id=merchant.id,
        price_id=price.id,
        title=product.name,
        description=product.description,
        amount_minor=price.amount_minor,
        currency=price.currency,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return _to_response(link, mode, product_name=product.name)


@router.get("", response_model=list[PaymentLinkResponse])
async def list_payment_links(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> list[PaymentLinkResponse]:
    from app.models.transaction import Transaction

    result = await db.execute(
        select(PaymentLink).where(PaymentLink.merchant_id == merchant.id).order_by(PaymentLink.created_at.desc())
    )
    links = list(result.scalars().all())

    counts_result = await db.execute(
        select(CheckoutSession.payment_link_id, func.count(func.distinct(CheckoutSession.customer_email)))
        .join(Transaction, Transaction.checkout_session_id == CheckoutSession.id)
        .where(CheckoutSession.merchant_id == merchant.id, CheckoutSession.payment_link_id.is_not(None))
        .group_by(CheckoutSession.payment_link_id)
    )
    counts = dict(counts_result.all())

    names_result = await db.execute(
        select(Price.id, Product.name)
        .join(Product, Price.product_id == Product.id)
        .where(Price.merchant_id == merchant.id)
    )
    names = dict(names_result.all())

    return [_to_response(link, mode, counts.get(link.id, 0), names.get(link.price_id)) for link in links]


@router.get("/{link_id}", response_model=PaymentLinkDetailResponse)
async def get_payment_link_detail(
    link_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> PaymentLinkDetailResponse:
    from app.models.transaction import Transaction

    real_id = _decode_link_ref(link_id, expected_mode=mode)
    result = await db.execute(select(PaymentLink).where(PaymentLink.id == real_id, PaymentLink.merchant_id == merchant.id))
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")

    tx_result = await db.execute(
        select(Transaction, CheckoutSession.customer_email)
        .join(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
        .where(CheckoutSession.payment_link_id == link.id)
        .order_by(Transaction.created_at.desc())
    )
    rows = tx_result.all()
    customer_count = len({email for _, email in rows if email})
    product_name = await _product_name_for(db, link)

    base = _to_response(link, mode, customer_count, product_name)
    return PaymentLinkDetailResponse(
        **base.model_dump(),
        transactions=[
            TransactionResponse(**TransactionResponse.model_validate(t).model_dump() | {"customer_email": email})
            for t, email in rows
        ],
    )


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_payment_link(
    link_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
    mode: Mode = Depends(get_request_mode),
) -> None:
    real_id = _decode_link_ref(link_id, expected_mode=mode)
    result = await db.execute(
        select(PaymentLink).where(PaymentLink.id == real_id, PaymentLink.merchant_id == merchant.id)
    )
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")
    link.is_active = False
    await db.commit()


@router.get("/{link_id}/public", response_model=PaymentLinkResponse)
async def get_payment_link_public(link_id: str) -> PaymentLinkResponse:
    decoded = decode_ref(PAYMENT_LINK_PREFIX, link_id)
    mode, real_id = decoded.mode, decoded.id
    async with session_factory_for_mode(mode)() as db:
        stamp_mode(db, mode)
        link = await db.get(PaymentLink, real_id)
        if link is None or not link.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")
        product_name = await _product_name_for(db, link)
        merchant = await db.get(Merchant, link.merchant_id)
        return _to_response(link, mode, product_name=product_name, merchant=merchant)


@router.post("/{link_id}/sessions", response_model=CheckoutSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session_from_payment_link(link_id: str) -> CheckoutSessionResponse:
    decoded = decode_ref(PAYMENT_LINK_PREFIX, link_id)
    mode, real_id = decoded.mode, decoded.id
    async with session_factory_for_mode(mode)() as db:
        stamp_mode(db, mode)
        link = await db.get(PaymentLink, real_id)
        if link is None or not link.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")

        session = CheckoutSession(
            merchant_id=link.merchant_id,
            payment_link_id=link.id,
            amount_minor=link.amount_minor,
            currency=link.currency,
            description=link.title,
            idempotency_key=f"paylink_{link.id}_{uuid.uuid4()}",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=SESSION_TTL_MINUTES),
        )
        db.add(session)
        link.usage_count += 1
        await db.commit()
        await db.refresh(session)
        return checkout_to_response(session, mode)
