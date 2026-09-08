import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PriceCreateRequest(BaseModel):
    amount_minor: int = Field(gt=0)
    currency: str = Field(default="PKR", min_length=3, max_length=3)
    interval: str = Field(default="one_time")
    interval_count: int = Field(default=1, ge=1, le=365)


class PriceResponse(BaseModel):
    id: uuid.UUID
    amount_minor: int
    currency: str
    interval: str
    interval_count: int
    is_active: bool
    created_at: datetime
    active_subscriptions: int = 0

    model_config = {"from_attributes": True}


class PriceUpdateRequest(BaseModel):
    """Only is_active can change — amount/currency/interval are immutable once a price
    exists (a price already shared on a link/subscription must never
    change value under someone). Deactivate and create a new price instead."""

    is_active: bool


class ProductCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    price: PriceCreateRequest


class ProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    prices: list[PriceResponse]
    active_subscriptions: int = 0

    model_config = {"from_attributes": True}
