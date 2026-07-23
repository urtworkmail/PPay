import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.branding import MerchantBrandingSummary
from app.schemas.transaction import RelatedSubscription, TransactionResponse


class InvoiceCreateRequest(BaseModel):
    customer_name: str | None = Field(default=None, max_length=255)
    customer_email: EmailStr
    amount_minor: int = Field(gt=0)
    currency: str = Field(default="PKR", min_length=3, max_length=3)
    description: str | None = Field(default=None, max_length=500)
    due_date: datetime | None = None


class InvoiceResponse(BaseModel):
    id: str
    customer_name: str | None
    customer_email: str
    amount_minor: int
    currency: str
    description: str | None
    status: str
    due_date: datetime | None
    url: str | None
    subscription_id: uuid.UUID | None = None
    billing_reason: str | None = None
    merchant: MerchantBrandingSummary | None = None
    created_at: datetime
    sent_at: datetime | None
    paid_at: datetime | None

    model_config = {"from_attributes": True}


class InvoiceDetailResponse(InvoiceResponse):
    transaction: TransactionResponse | None
    subscription: RelatedSubscription | None = None
