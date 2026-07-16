import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TransactionResponse(BaseModel):
    id: uuid.UUID
    checkout_session_id: uuid.UUID
    amount_minor: int
    currency: str
    fee_minor: int
    net_amount_minor: int
    status: str
    gateway_reference: str | None
    failure_reason: str | None
    payment_method_details: dict
    settled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int


class TimelineEvent(BaseModel):
    event: str
    at: datetime


class RefundCreateRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=255)


class RefundResponse(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    amount_minor: int
    reason: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WebhookEndpointCreateRequest(BaseModel):
    url: str
    events: list[str] = ["payment_intent.succeeded", "payment_intent.failed"]


class WebhookEndpointResponse(BaseModel):
    id: uuid.UUID
    url: str
    events: list[str]
    is_active: bool
    secret: str | None = None

    model_config = {"from_attributes": True}


class WebhookLogResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    response_status: int | None
    attempt_count: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionDetailResponse(TransactionResponse):
    customer_email: str | None
    refunds: list[RefundResponse]
    webhook_logs: list[WebhookLogResponse]
    timeline: list[TimelineEvent]
