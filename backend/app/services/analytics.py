import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checkout_session import CheckoutSession
from app.models.refund import Refund
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.analytics import (
    DailyPoint,
    DashboardAnalyticsResponse,
    FailedPaymentItem,
    NewCustomerPoint,
    StatusBreakdownItem,
    TopCustomer,
)
from app.schemas.payments_analytics import (
    MethodBreakdownItem,
    PaymentsAnalyticsResponse,
    PeriodComparison,
    RatePoint,
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


def _pct_change(current: float, previous: float | None) -> float | None:
    if previous is None or previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 2)


def _period_stats(transactions: list[Transaction]) -> dict:
    succeeded = [t for t in transactions if t.status == TransactionStatus.SUCCEEDED]
    gross = sum(t.amount_minor for t in succeeded)
    count = len(transactions)
    success_rate = (len(succeeded) / count * 100) if count else None
    aov = (gross / len(succeeded)) if succeeded else None
    return {"gross": gross, "count": count, "success_rate": success_rate, "aov": aov}


async def get_payments_analytics(
    db: AsyncSession, merchant_id: uuid.UUID, period_days: int
) -> PaymentsAnalyticsResponse:
    """Deeper cuts of the same transaction data Overview already summarises:
    trends instead of a single snapshot, a breakdown by payment method, and a
    period-over-period comparison. No new data source — same `Transaction`
    rows the rest of the dashboard already trusts, aggregated differently.
    """
    now = datetime.now(timezone.utc)
    period_start = (now - timedelta(days=period_days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    previous_period_start = period_start - timedelta(days=period_days)

    # Pull current + previous period in one query — cheap compared to two
    # round trips, and the previous-period rows are discarded from the
    # per-day trends below (only used for the comparison figures).
    tx_result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant_id, Transaction.created_at >= previous_period_start
        )
    )
    all_transactions = list(tx_result.scalars().all())
    current_transactions = [t for t in all_transactions if t.created_at >= period_start]
    previous_transactions = [t for t in all_transactions if t.created_at < period_start]

    refund_result = await db.execute(
        select(Refund).where(Refund.merchant_id == merchant_id, Refund.created_at >= period_start)
    )
    refunds = list(refund_result.scalars().all())
    refunds_by_day: dict = defaultdict(int)
    for r in refunds:
        refunds_by_day[r.created_at.date()] += r.amount_minor

    days = [period_start.date() + timedelta(days=i) for i in range(period_days)]
    by_day: dict = defaultdict(list)
    for t in current_transactions:
        by_day[t.created_at.date()].append(t)

    success_rate_trend, aov_trend, refund_rate_trend = [], [], []
    for d in days:
        day_txns = by_day.get(d, [])
        succeeded = [t for t in day_txns if t.status == TransactionStatus.SUCCEEDED]
        total = len(day_txns)
        gross = sum(t.amount_minor for t in succeeded)

        success_rate_trend.append(
            RatePoint(
                date=d,
                value=round(len(succeeded) / total * 100, 2) if total else None,
                numerator=len(succeeded),
                denominator=total,
            )
        )
        aov_trend.append(
            RatePoint(
                date=d,
                value=round(gross / len(succeeded), 2) if succeeded else None,
                numerator=gross,
                denominator=len(succeeded),
            )
        )
        refunded_minor = refunds_by_day.get(d, 0)
        refund_rate_trend.append(
            RatePoint(
                date=d,
                value=round(refunded_minor / gross * 100, 2) if gross else None,
                numerator=refunded_minor,
                denominator=gross,
            )
        )

    method_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"amount": 0, "count": 0, "success": 0})
    for t in current_transactions:
        method = (t.payment_method_details or {}).get("method", "unknown")
        method_stats[method]["count"] += 1
        if t.status == TransactionStatus.SUCCEEDED:
            method_stats[method]["success"] += 1
            method_stats[method]["amount"] += t.amount_minor
    method_breakdown = [
        MethodBreakdownItem(
            method=method,
            amount_minor=v["amount"],
            count=v["count"],
            success_count=v["success"],
            success_rate=round(v["success"] / v["count"] * 100, 2) if v["count"] else None,
        )
        for method, v in sorted(method_stats.items(), key=lambda kv: -kv[1]["amount"])
    ]

    current_stats = _period_stats(current_transactions)
    previous_stats = _period_stats(previous_transactions)

    def comparison(key: str) -> PeriodComparison:
        current_value = current_stats[key]
        previous_value = previous_stats[key]
        return PeriodComparison(
            current_value=current_value,
            previous_value=previous_value,
            change_pct=_pct_change(current_value, previous_value) if current_value is not None else None,
        )

    hourly = [0] * 24
    for t in current_transactions:
        hourly[t.created_at.astimezone(timezone.utc).hour] += 1

    return PaymentsAnalyticsResponse(
        period_days=period_days,
        currency=DEFAULT_CURRENCY,
        success_rate_trend=success_rate_trend,
        average_order_value_trend=aov_trend,
        refund_rate_trend=refund_rate_trend,
        method_breakdown=method_breakdown,
        gross_volume_comparison=PeriodComparison(
            current_value=current_stats["gross"],
            previous_value=previous_stats["gross"],
            change_pct=_pct_change(current_stats["gross"], previous_stats["gross"]),
        ),
        transaction_count_comparison=PeriodComparison(
            current_value=current_stats["count"],
            previous_value=previous_stats["count"],
            change_pct=_pct_change(current_stats["count"], previous_stats["count"]),
        ),
        success_rate_comparison=comparison("success_rate"),
        average_order_value_comparison=comparison("aov"),
        hourly_distribution=hourly,
    )
