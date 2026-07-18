import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checkout_session import CheckoutSession
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.analytics import (
    DailyPoint,
    DashboardAnalyticsResponse,
    FailedPaymentItem,
    NewCustomerPoint,
    StatusBreakdownItem,
    TopCustomer,
)

DEFAULT_CURRENCY = "PKR"
FAILED_PAYMENTS_LIMIT = 5
TOP_CUSTOMERS_LIMIT = 5


async def get_dashboard_analytics(
    db: AsyncSession, merchant_id: uuid.UUID, period_days: int
) -> DashboardAnalyticsResponse:
    now = datetime.now(timezone.utc)
    period_start = (now - timedelta(days=period_days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    tx_result = await db.execute(
        select(Transaction).where(Transaction.merchant_id == merchant_id, Transaction.created_at >= period_start)
    )
    transactions = list(tx_result.scalars().all())

    days = [period_start.date() + timedelta(days=i) for i in range(period_days)]
    gross_by_day = {d: 0 for d in days}
    net_by_day = {d: 0 for d in days}
    breakdown: dict[str, dict[str, int]] = defaultdict(lambda: {"amount": 0, "count": 0})

    for tx in transactions:
        d = tx.created_at.date()
        breakdown[tx.status]["amount"] += tx.amount_minor
        breakdown[tx.status]["count"] += 1
        if tx.status == TransactionStatus.SUCCEEDED and d in gross_by_day:
            gross_by_day[d] += tx.amount_minor
            net_by_day[d] += tx.net_amount_minor

    gross_volume = [DailyPoint(date=d, amount_minor=gross_by_day[d]) for d in days]
    net_volume = [DailyPoint(date=d, amount_minor=net_by_day[d]) for d in days]
    payments_breakdown = [
        StatusBreakdownItem(status=status, amount_minor=v["amount"], count=v["count"])
        for status, v in sorted(breakdown.items())
    ]

    failed_result = await db.execute(
        select(Transaction, CheckoutSession.customer_email)
        .join(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
        .where(Transaction.merchant_id == merchant_id, Transaction.status == TransactionStatus.FAILED)
        .order_by(Transaction.created_at.desc())
        .limit(FAILED_PAYMENTS_LIMIT)
    )
    failed_payments = [
        FailedPaymentItem(
            id=tx.id,
            gateway_reference=tx.gateway_reference,
            amount_minor=tx.amount_minor,
            currency=tx.currency,
            customer_email=email,
            failure_reason=tx.failure_reason,
            created_at=tx.created_at,
        )
        for tx, email in failed_result.all()
    ]

    # First-ever checkout session date per customer, all-time — used to tell which
    # customers are "new" within this period rather than just active in it.
    first_seen_result = await db.execute(
        select(CheckoutSession.customer_email, func.min(CheckoutSession.created_at))
        .where(CheckoutSession.merchant_id == merchant_id, CheckoutSession.customer_email.is_not(None))
        .group_by(CheckoutSession.customer_email)
    )
    new_customers_by_day = {d: 0 for d in days}
    new_customers_total = 0
    for _email, first_seen in first_seen_result.all():
        d = first_seen.date()
        if d in new_customers_by_day:
            new_customers_by_day[d] += 1
            new_customers_total += 1
    new_customers = [NewCustomerPoint(date=d, count=new_customers_by_day[d]) for d in days]

    top_customers_result = await db.execute(
        select(CheckoutSession.customer_email, func.sum(Transaction.amount_minor).label("total"))
        .join(Transaction, Transaction.checkout_session_id == CheckoutSession.id)
        .where(
            CheckoutSession.merchant_id == merchant_id,
            CheckoutSession.customer_email.is_not(None),
            Transaction.status == TransactionStatus.SUCCEEDED,
        )
        .group_by(CheckoutSession.customer_email)
        .order_by(func.sum(Transaction.amount_minor).desc())
        .limit(TOP_CUSTOMERS_LIMIT)
    )
    top_customers = [
        TopCustomer(email=email, total_spent_minor=total) for email, total in top_customers_result.all()
    ]

    return DashboardAnalyticsResponse(
        period_days=period_days,
        currency=DEFAULT_CURRENCY,
        gross_volume=gross_volume,
        net_volume=net_volume,
        gross_volume_total_minor=sum(gross_by_day.values()),
        net_volume_total_minor=sum(net_by_day.values()),
        payments_breakdown=payments_breakdown,
        failed_payments=failed_payments,
        new_customers=new_customers,
        new_customers_total=new_customers_total,
        top_customers=top_customers,
    )
