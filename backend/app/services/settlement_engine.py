import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.models.merchant import Merchant, PayoutSchedule
from app.models.settlement import Settlement, SettlementItem, SettlementStatus
from app.models.transaction import Transaction, TransactionStatus

# How long a settlement sits as "pending" before it's swept into a simulated
# payout, based on the merchant's chosen payout schedule — mirrors the way a
# real gateway holds funds for a few days before releasing them to the bank.
PAYOUT_DELAY_DAYS = {
    PayoutSchedule.DAILY: 1,
    PayoutSchedule.WEEKLY: 7,
    PayoutSchedule.MONTHLY: 30,
}


async def run_settlement_batch(db: AsyncSession, period_end: datetime | None = None) -> list[Settlement]:
    """Groups yesterday's unsettled succeeded transactions per merchant into a settlement batch.

    This is a sandbox simulation only — no real bank payout happens here.
    """
    period_end = period_end or datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=1)

    merchants = (await db.execute(select(Merchant))).scalars().all()
    created: list[Settlement] = []

    for merchant in merchants:
        result = await db.execute(
            select(Transaction).where(
                Transaction.merchant_id == merchant.id,
                Transaction.status == TransactionStatus.SUCCEEDED,
                Transaction.settled.is_(False),
                Transaction.created_at >= period_start,
                Transaction.created_at < period_end,
            )
        )
        transactions = result.scalars().all()
        if not transactions:
            continue

        gross = sum(t.amount_minor for t in transactions)
        fees = sum(t.fee_minor for t in transactions)
        net = gross - fees

        settlement = Settlement(
            id=uuid.uuid4(),
            merchant_id=merchant.id,
            period_start=period_start,
            period_end=period_end,
            gross_amount_minor=gross,
            fee_amount_minor=fees,
            net_amount_minor=net,
            transaction_count=len(transactions),
            status=SettlementStatus.PENDING,
        )
        db.add(settlement)
        await db.flush()

        for txn in transactions:
            txn.settled = True
            db.add(SettlementItem(settlement_id=settlement.id, transaction_id=txn.id))

        created.append(settlement)

    await db.flush()
    return created


async def run_settlement_batch_job() -> None:
    """APScheduler job wrapper: runs the settlement batch in its own session."""
    async with AsyncSessionLocal() as db:
        await run_settlement_batch(db)
        await db.commit()


async def process_due_payouts(db: AsyncSession, now: datetime | None = None) -> list[Settlement]:
    """Marks pending settlements as paid once their merchant's payout delay has elapsed."""
    now = now or datetime.now(timezone.utc)

    result = await db.execute(
        select(Settlement, Merchant)
        .join(Merchant, Settlement.merchant_id == Merchant.id)
        .where(Settlement.status == SettlementStatus.PENDING)
    )
    paid: list[Settlement] = []

    for settlement, merchant in result.all():
        delay_days = PAYOUT_DELAY_DAYS[merchant.payout_schedule]
        if now >= settlement.created_at + timedelta(days=delay_days):
            settlement.status = SettlementStatus.PAID
            settlement.paid_at = now
            paid.append(settlement)

    await db.flush()
    return paid


async def process_due_payouts_job() -> None:
    """APScheduler job wrapper: sweeps due payouts in their own session."""
    async with AsyncSessionLocal() as db:
        await process_due_payouts(db)
        await db.commit()
