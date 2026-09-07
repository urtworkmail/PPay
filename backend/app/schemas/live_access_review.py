import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class LiveAccessRequestAdminResponse(BaseModel):
    """The platform admin's view — same KYC data the merchant submitted, plus
    review state. No separate document-upload capture exists yet (see
    GO_TO_MARKET.md); review today is against the typed fields the Go-Live
    form already collects."""

    id: uuid.UUID
    merchant_id: uuid.UUID
    merchant_business_name: str
    merchant_email: str

    business_type: str
    legal_business_name: str
    business_category: str
    registration_number: str | None
    national_tax_number: str | None
    business_address: str
    website_url: str | None
    product_description: str

    representative_full_name: str
    representative_cnic: str
    representative_dob: date
    representative_address: str

    bank_name: str
    bank_account_number: str
    contact_phone: str
    notes: str | None

    status: str
    submitted_at: datetime
    reviewed_at: datetime | None
    rejection_reason: str | None

    model_config = {"from_attributes": True}


class LiveAccessRejectRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=2000)
