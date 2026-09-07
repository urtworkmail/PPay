from datetime import date

from pydantic import BaseModel


class RatePoint(BaseModel):
    """A day's value plus the raw counts it was computed from, so the frontend
    can render "no data" differently from "0%" — an empty day isn't a 0%
    success rate, it's an undefined one."""

    date: date
    value: float | None
    numerator: int
    denominator: int


class MethodBreakdownItem(BaseModel):
    method: str
    amount_minor: int
    count: int
    success_count: int
    success_rate: float | None


class PeriodComparison(BaseModel):
    """Current period vs. the immediately preceding period of equal length —
    the "+12.5% vs last period" figure. Either value is None (rather than a
    fabricated 0) when that period has no data to compute it from — a 0%
    success rate and "no payments happened" are different claims."""

    current_value: float | None
    previous_value: float | None
    change_pct: float | None


class PaymentsAnalyticsResponse(BaseModel):
    period_days: int
    currency: str

    success_rate_trend: list[RatePoint]
    average_order_value_trend: list[RatePoint]  # value is the AOV in minor units, numerator=gross, denominator=count
    refund_rate_trend: list[RatePoint]

    method_breakdown: list[MethodBreakdownItem]

    gross_volume_comparison: PeriodComparison
    transaction_count_comparison: PeriodComparison
    success_rate_comparison: PeriodComparison
    average_order_value_comparison: PeriodComparison

    # Local hour-of-day (0-23) the merchant's transactions concentrate in —
    # UTC-bucketed, since transactions have no per-merchant timezone to convert
    # against yet (see User.timezone_name, which is per-person, not per-account).
    hourly_distribution: list[int]
