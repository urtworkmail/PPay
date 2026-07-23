import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.branding import MerchantBrandingSummary
from app.schemas.transaction import TransactionResponse


class PaymentLinkCreateRequest(BaseModel):
    price_id: uuid.UUID


class PaymentLinkResponse(BaseModel):
    id: str
    title: str
    description: str | None
    amount_minor: int
    currency: str
    is_active: bool
    usage_count: int
    url: str
    created_at: datetime
    customer_count: int = 0
    price_id: uuid.UUID | None = None
    product_name: str | None = None
    merchant: MerchantBrandingSummary | None = None

    model_config = {"from_attributes": True}


class PaymentLinkDetailResponse(PaymentLinkResponse):
    transactions: list[TransactionResponse]
