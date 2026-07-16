import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_merchant_flexible
from app.core.db import get_db
from app.models.merchant import Merchant
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.transaction import TransactionListResponse, TransactionResponse

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    status_filter: TransactionStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    merchant: Merchant = Depends(get_merchant_flexible),
    db: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    base_query = select(Transaction).where(Transaction.merchant_id == merchant.id)
    count_query = select(func.count()).select_from(Transaction).where(Transaction.merchant_id == merchant.id)

    if status_filter is not None:
        base_query = base_query.where(Transaction.status == status_filter)
        count_query = count_query.where(Transaction.status == status_filter)

    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(
        base_query.order_by(Transaction.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = [TransactionResponse.model_validate(t) for t in result.scalars().all()]

    return TransactionListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: uuid.UUID,
    merchant: Merchant = Depends(get_merchant_flexible),
    db: AsyncSession = Depends(get_db),
) -> Transaction:
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.merchant_id == merchant.id)
    )
    transaction = result.scalar_one_or_none()
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return transaction
