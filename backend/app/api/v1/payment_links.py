import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.checkout import _to_response as checkout_to_response
from app.api.v1.deps import get_current_merchant
from app.core.config import get_settings
from app.core.db import get_db
from app.models.checkout_session import CheckoutSession
from app.models.merchant import Merchant
from app.models.payment_link import PaymentLink
from app.schemas.checkout import CheckoutSessionResponse
from app.schemas.payment_link import PaymentLinkCreateRequest, PaymentLinkDetailResponse, PaymentLinkResponse
from app.schemas.transaction import TransactionResponse

router = APIRouter(prefix="/payment-links", tags=["payment-links"])
SESSION_TTL_MINUTES = 30


def _frontend_origin() -> str:
    settings = get_settings()
    return settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"


def _to_response(link: PaymentLink) -> PaymentLinkResponse:
    return PaymentLinkResponse(
        id=link.id,
        title=link.title,
        description=link.description,
        amount_minor=link.amount_minor,
        currency=link.currency,
        is_active=link.is_active,
        usage_count=link.usage_count,
        url=f"{_frontend_origin()}/pay/{link.id}",
        created_at=link.created_at,
    )


@router.post("", response_model=PaymentLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_link(
    payload: PaymentLinkCreateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> PaymentLinkResponse:
    link = PaymentLink(
        merchant_id=merchant.id,
        title=payload.title,
        description=payload.description,
        amount_minor=payload.amount_minor,
        currency=payload.currency.upper(),
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return _to_response(link)


@router.get("", response_model=list[PaymentLinkResponse])
async def list_payment_links(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[PaymentLinkResponse]:
    result = await db.execute(
        select(PaymentLink).where(PaymentLink.merchant_id == merchant.id).order_by(PaymentLink.created_at.desc())
    )
    return [_to_response(link) for link in result.scalars().all()]


@router.get("/{link_id}", response_model=PaymentLinkDetailResponse)
async def get_payment_link_detail(
    link_id: uuid.UUID, merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> PaymentLinkDetailResponse:
    from app.models.transaction import Transaction

    result = await db.execute(select(PaymentLink).where(PaymentLink.id == link_id, PaymentLink.merchant_id == merchant.id))
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")

    tx_result = await db.execute(
        select(Transaction)
        .join(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
        .where(CheckoutSession.payment_link_id == link.id)
        .order_by(Transaction.created_at.desc())
    )
    transactions = list(tx_result.scalars().all())

    base = _to_response(link)
    return PaymentLinkDetailResponse(
        **base.model_dump(), transactions=[TransactionResponse.model_validate(t) for t in transactions]
    )


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_payment_link(
    link_id: uuid.UUID, merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(
        select(PaymentLink).where(PaymentLink.id == link_id, PaymentLink.merchant_id == merchant.id)
    )
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")
    link.is_active = False
    await db.commit()


@router.get("/{link_id}/public", response_model=PaymentLinkResponse)
async def get_payment_link_public(link_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> PaymentLinkResponse:
    link = await db.get(PaymentLink, link_id)
    if link is None or not link.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")
    return _to_response(link)


@router.post("/{link_id}/sessions", response_model=CheckoutSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session_from_payment_link(
    link_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> CheckoutSessionResponse:
    link = await db.get(PaymentLink, link_id)
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

    return checkout_to_response(session)
