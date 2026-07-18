import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant
from app.core.db import get_db
from app.models.merchant import Merchant
from app.models.settlement import Settlement, SettlementStatus
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.analytics import DashboardAnalyticsResponse
from app.schemas.settlement import BalanceSummaryResponse, DashboardSummaryResponse, SettlementResponse
from app.services.analytics import get_dashboard_analytics
from app.services.settlement_engine import PAYOUT_DELAY_DAYS

router = APIRouter(tags=["settlements"])

VALID_PERIODS = (7, 30, 90)


@router.get("/settlements", response_model=list[SettlementResponse])
async def list_settlements(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[Settlement]:
    result = await db.execute(
        select(Settlement).where(Settlement.merchant_id == merchant.id).order_by(Settlement.period_end.desc())
    )
    return list(result.scalars().all())


@router.get("/settlements/{settlement_id}", response_model=SettlementResponse)
async def get_settlement(
    settlement_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> Settlement:
    result = await db.execute(
        select(Settlement).where(Settlement.id == settlement_id, Settlement.merchant_id == merchant.id)
    )
    settlement = result.scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settlement not found")
    return settlement


@router.get("/balances/summary", response_model=BalanceSummaryResponse)
async def balances_summary(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> BalanceSummaryResponse:
    pending_settlement = (
        await db.execute(
            select(func.coalesce(func.sum(Transaction.net_amount_minor), 0)).where(
                Transaction.merchant_id == merchant.id,
                Transaction.status == TransactionStatus.SUCCEEDED,
                Transaction.settled.is_(False),
            )
        )
    ).scalar_one()

    pending_settlements_result = await db.execute(
        select(Settlement).where(Settlement.merchant_id == merchant.id, Settlement.status == SettlementStatus.PENDING)
    )
    pending_settlements = list(pending_settlements_result.scalars().all())
    available = sum(s.net_amount_minor for s in pending_settlements)

    paid_out = (
        await db.execute(
            select(func.coalesce(func.sum(Settlement.net_amount_minor), 0)).where(
                Settlement.merchant_id == merchant.id, Settlement.status == SettlementStatus.PAID
            )
        )
    ).scalar_one()

    next_payout_at = None
    next_payout_amount = 0
    if pending_settlements:
        delay_days = PAYOUT_DELAY_DAYS[merchant.payout_schedule]
        due_dates = [s.created_at + timedelta(days=delay_days) for s in pending_settlements]
        next_payout_at = min(due_dates)
        next_payout_amount = sum(
            s.net_amount_minor for s, due in zip(pending_settlements, due_dates) if due == next_payout_at
        )

    return BalanceSummaryResponse(
        currency="PKR",
        pending_settlement_minor=pending_settlement,
        available_minor=available,
        paid_out_minor=paid_out,
        next_payout_at=next_payout_at,
        next_payout_amount_minor=next_payout_amount,
        payout_schedule=merchant.payout_schedule,
    )


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> DashboardSummaryResponse:
    total_count = (
        await db.execute(select(func.count()).select_from(Transaction).where(Transaction.merchant_id == merchant.id))
    ).scalar_one()
    succeeded_count = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.merchant_id == merchant.id, Transaction.status == TransactionStatus.SUCCEEDED)
        )
    ).scalar_one()
    failed_count = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.merchant_id == merchant.id, Transaction.status == TransactionStatus.FAILED)
        )
    ).scalar_one()
    total_volume = (
        await db.execute(
            select(func.coalesce(func.sum(Transaction.amount_minor), 0)).where(
                Transaction.merchant_id == merchant.id, Transaction.status == TransactionStatus.SUCCEEDED
            )
        )
    ).scalar_one()
    total_fees = (
        await db.execute(
            select(func.coalesce(func.sum(Transaction.fee_minor), 0)).where(
                Transaction.merchant_id == merchant.id, Transaction.status == TransactionStatus.SUCCEEDED
            )
        )
    ).scalar_one()
    pending_settlement = (
        await db.execute(
            select(func.coalesce(func.sum(Transaction.net_amount_minor), 0)).where(
                Transaction.merchant_id == merchant.id,
                Transaction.status == TransactionStatus.SUCCEEDED,
                Transaction.settled.is_(False),
            )
        )
    ).scalar_one()

    success_rate = (succeeded_count / total_count * 100) if total_count else 0.0

    return DashboardSummaryResponse(
        total_volume_minor=total_volume,
        total_fees_minor=total_fees,
        transaction_count=total_count,
        succeeded_count=succeeded_count,
        failed_count=failed_count,
        success_rate=round(success_rate, 2),
        pending_settlement_minor=pending_settlement,
    )


@router.get("/dashboard/analytics", response_model=DashboardAnalyticsResponse)
async def dashboard_analytics(
    period_days: int = Query(default=7),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> DashboardAnalyticsResponse:
    if period_days not in VALID_PERIODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="period_days must be one of 7, 30, 90")
    return await get_dashboard_analytics(db, merchant.id, period_days)
