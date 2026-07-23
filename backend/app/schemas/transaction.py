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
    customer_email: str | None = None
    created_at: datetime
    updated_at: datetime
    payment_intent_status: str | None = Field(
        default=None,
        description=(
            "The orchestrating PaymentIntent's own status, when one exists. Notably "
            "distinguishes 'requires_reconciliation' (rail didn't respond — we're "
            "checking) from 'failed' (rail said no), which `status` above cannot."
        ),
    )

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
    last_delivery_at: datetime | None = None
    failure_count_24h: int = 0

    model_config = {"from_attributes": True}


class WebhookLogResponse(BaseModel):
    id: uuid.UUID
    endpoint_id: uuid.UUID
    transaction_id: uuid.UUID | None
    event_type: str
    payload: dict
    response_status: int | None
    attempt_count: int
    status: str
    next_retry_at: datetime | None
    created_at: datetime
    customer_email: str | None = None

    model_config = {"from_attributes": True}


class EventLogResponse(WebhookLogResponse):
    endpoint_url: str


class RelatedPaymentLink(BaseModel):
    id: uuid.UUID
    title: str


class RelatedInvoice(BaseModel):
    id: uuid.UUID
    status: str


class RelatedSubscription(BaseModel):
    id: uuid.UUID
    status: str


class TransactionDetailResponse(TransactionResponse):
    customer_name: str | None = None
    refunds: list[RefundResponse]
    webhook_logs: list[WebhookLogResponse]
    timeline: list[TimelineEvent]
    payment_link: RelatedPaymentLink | None = None
    invoice: RelatedInvoice | None = None
    subscription: RelatedSubscription | None = None
    api_key_prefix: str | None = None
    charge_attempts: int = 0
