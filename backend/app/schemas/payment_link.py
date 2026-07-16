import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.transaction import TransactionResponse


class PaymentLinkCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=500)
    amount_minor: int = Field(gt=0)
    currency: str = Field(default="PKR", min_length=3, max_length=3)


class PaymentLinkResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    amount_minor: int
    currency: str
    is_active: bool
    usage_count: int
    url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentLinkDetailResponse(PaymentLinkResponse):
    transactions: list[TransactionResponse]
