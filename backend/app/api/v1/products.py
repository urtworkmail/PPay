import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.deps import get_current_merchant, require_role
from app.core.db import get_db
from app.models.merchant import Merchant
from app.models.product import BillingInterval, Price, Product
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User, UserRole
from app.schemas.product import PriceCreateRequest, PriceResponse, PriceUpdateRequest, ProductCreateRequest, ProductResponse

router = APIRouter(prefix="/products", tags=["products"])


def _parse_interval(value: str) -> BillingInterval:
    try:
        return BillingInterval(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing interval") from exc


async def _active_sub_counts(db: AsyncSession, merchant_id: uuid.UUID) -> dict[uuid.UUID, int]:
    result = await db.execute(
        select(Price.id, func.count(Subscription.id))
        .join(Subscription, Subscription.price_id == Price.id)
        .where(
            Price.merchant_id == merchant_id,
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]),
        )
        .group_by(Price.id)
    )
    return dict(result.all())


def _to_response(product: Product, sub_counts: dict[uuid.UUID, int]) -> ProductResponse:
    prices = [
        PriceResponse(
            id=price.id,
            amount_minor=price.amount_minor,
            currency=price.currency,
            interval=price.interval,
            interval_count=price.interval_count,
            is_active=price.is_active,
            created_at=price.created_at,
            active_subscriptions=sub_counts.get(price.id, 0),
        )
        for price in product.prices
    ]
    return ProductResponse(
        id=product.id,
        name=product.name,
        description=product.description,
        is_active=product.is_active,
        created_at=product.created_at,
        prices=prices,
        active_subscriptions=sum(p.active_subscriptions for p in prices),
    )


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    interval = _parse_interval(payload.price.interval)

    product = Product(merchant_id=merchant.id, name=payload.name, description=payload.description)
    db.add(product)
    await db.flush()

    price = Price(
        product_id=product.id,
        merchant_id=merchant.id,
        amount_minor=payload.price.amount_minor,
        currency=payload.price.currency.upper(),
        interval=interval,
        interval_count=payload.price.interval_count,
    )
    db.add(price)
    await db.commit()

    result = await db.execute(
        select(Product).where(Product.id == product.id).options(selectinload(Product.prices))
    )
    return _to_response(result.unique().scalar_one(), {})


@router.get("", response_model=list[ProductResponse])
async def list_products(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[ProductResponse]:
    result = await db.execute(
        select(Product)
        .where(Product.merchant_id == merchant.id)
        .options(selectinload(Product.prices))
        .order_by(Product.created_at.desc())
    )
    sub_counts = await _active_sub_counts(db, merchant.id)
    return [_to_response(p, sub_counts) for p in result.unique().scalars().all()]


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID, merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> ProductResponse:
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id, Product.merchant_id == merchant.id)
        .options(selectinload(Product.prices))
    )
    product = result.unique().scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    sub_counts = await _active_sub_counts(db, merchant.id)
    return _to_response(product, sub_counts)


@router.post("/{product_id}/prices", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def add_price(
    product_id: uuid.UUID,
    payload: PriceCreateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    result = await db.execute(select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    interval = _parse_interval(payload.interval)
    price = Price(
        product_id=product.id,
        merchant_id=merchant.id,
        amount_minor=payload.amount_minor,
        currency=payload.currency.upper(),
        interval=interval,
        interval_count=payload.interval_count,
    )
    db.add(price)
    await db.commit()

    result = await db.execute(select(Product).where(Product.id == product.id).options(selectinload(Product.prices)))
    sub_counts = await _active_sub_counts(db, merchant.id)
    return _to_response(result.unique().scalar_one(), sub_counts)


@router.patch("/{product_id}/prices/{price_id}", response_model=ProductResponse)
async def update_price(
    product_id: uuid.UUID,
    price_id: uuid.UUID,
    payload: PriceUpdateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    result = await db.execute(
        select(Price).where(Price.id == price_id, Price.product_id == product_id, Price.merchant_id == merchant.id)
    )
    price = result.scalar_one_or_none()
    if price is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Price not found")
    price.is_active = payload.is_active
    await db.commit()

    result = await db.execute(select(Product).where(Product.id == product_id).options(selectinload(Product.prices)))
    sub_counts = await _active_sub_counts(db, merchant.id)
    return _to_response(result.unique().scalar_one(), sub_counts)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_product(
    product_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    product.is_active = False
    await db.commit()
