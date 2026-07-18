import uuid
from datetime import date, datetime

from pydantic import BaseModel


class DailyPoint(BaseModel):
    date: date
    amount_minor: int


class StatusBreakdownItem(BaseModel):
    status: str
    amount_minor: int
    count: int


class FailedPaymentItem(BaseModel):
    id: uuid.UUID
    gateway_reference: str | None
    amount_minor: int
    currency: str
    customer_email: str | None
    failure_reason: str | None
    created_at: datetime


class NewCustomerPoint(BaseModel):
    date: date
    count: int


class TopCustomer(BaseModel):
    email: str
    total_spent_minor: int


class DashboardAnalyticsResponse(BaseModel):
    period_days: int
    currency: str
    gross_volume: list[DailyPoint]
    net_volume: list[DailyPoint]
    gross_volume_total_minor: int
    net_volume_total_minor: int
    payments_breakdown: list[StatusBreakdownItem]
    failed_payments: list[FailedPaymentItem]
    new_customers: list[NewCustomerPoint]
    new_customers_total: int
    top_customers: list[TopCustomer]
