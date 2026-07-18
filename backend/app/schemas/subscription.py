import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.invoice import InvoiceDetailResponse
from app.schemas.product import PriceResponse
from app.schemas.transaction import WebhookLogResponse


class SavedPaymentMethodSummary(BaseModel):
    id: uuid.UUID
    method: str
    label: str
    created_at: datetime


class SubscriptionCreateRequest(BaseModel):
    customer_email: EmailStr
    customer_name: str | None = Field(default=None, max_length=255)
    price_id: uuid.UUID


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    customer_email: str
    customer_name: str | None
    price: PriceResponse
    status: str
    current_period_start: datetime
    current_period_end: datetime
    failed_attempt_count: int
    cancel_at_period_end: bool
    canceled_at: datetime | None
    checkout_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionDetailResponse(SubscriptionResponse):
    invoices: list[InvoiceDetailResponse]
    payment_method: SavedPaymentMethodSummary | None = None
    product_name: str | None = None
    webhook_logs: list[WebhookLogResponse] = []


class SubscriptionCancelRequest(BaseModel):
    at_period_end: bool = False
