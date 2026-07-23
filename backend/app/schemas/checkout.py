import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.branding import MerchantBrandingSummary


class CheckoutSessionCreateRequest(BaseModel):
    amount_minor: int = Field(gt=0, description="Amount in minor units (paisas)")
    currency: str = Field(default="PKR", min_length=3, max_length=3)
    description: str | None = Field(default=None, max_length=500)
    customer_email: EmailStr | None = None
    customer_phone: str | None = Field(default=None, max_length=32)
    return_url: str | None = Field(default=None, max_length=2048)
    metadata: dict = Field(default_factory=dict)


class CheckoutSessionResponse(BaseModel):
    id: str
    amount_minor: int
    currency: str
    status: str
    method: str | None
    customer_email: str | None
    description: str | None
    return_url: str | None
    checkout_url: str
    created_at: datetime
    expires_at: datetime
    completed_at: datetime | None
    merchant: MerchantBrandingSummary | None = None

    model_config = {"from_attributes": True}


class CheckoutPayRequest(BaseModel):
    method: str = Field(description="card | wallet | bank_transfer")
    card_number: str | None = Field(default=None, description="Sandbox test card number")
    wallet_phone: str | None = Field(default=None, description="Sandbox test wallet phone number")
    save_payment_method: bool = Field(default=False, description="Keep this card/wallet on file for future charges")
    customer_email: EmailStr | None = Field(
        default=None, description="Backfills the session's customer_email when it wasn't captured at creation (e.g. payment links)"
    )
