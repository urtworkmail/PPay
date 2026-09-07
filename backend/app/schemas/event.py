import uuid
from datetime import datetime

from pydantic import BaseModel


class EventDeliveryAttempt(BaseModel):
    """One endpoint's delivery state for an event."""

    id: uuid.UUID
    endpoint_id: uuid.UUID
    endpoint_url: str
    status: str
    response_status: int | None
    attempt_count: int
    next_retry_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class EventResponse(BaseModel):
    """An immutable record that something happened on the account.

    Independent of webhooks: an event exists whether or not any endpoint was
    subscribed to it. `delivery_count` / `delivered_count` summarise the
    attempts so a list view can show delivery state without a second call.
    """

    id: uuid.UUID
    type: str
    livemode: bool
    created_at: datetime
    delivery_count: int = 0
    delivered_count: int = 0
    failed_count: int = 0
    pending_count: int = 0

    model_config = {"from_attributes": True}


class EventDetailResponse(EventResponse):
    payload: dict
    deliveries: list[EventDeliveryAttempt] = []


class EventListResponse(BaseModel):
    events: list[EventResponse]
    total: int
    page: int
    page_size: int
