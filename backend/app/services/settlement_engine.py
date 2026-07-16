import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.models.merchant import Merchant
from app.models.settlement import Settlement, SettlementItem, SettlementStatus
from app.models.transaction import Transaction, TransactionStatus


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
            status=SettlementStatus.PAID,
            paid_at=datetime.now(timezone.utc),
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
