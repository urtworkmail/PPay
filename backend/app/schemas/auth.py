import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class MerchantRegisterRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class MerchantLoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: str | None = Field(default=None, min_length=6, max_length=6)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class MerchantProfile(BaseModel):
    id: uuid.UUID
    business_name: str
    email: EmailStr
    status: str
    country: str
    live_status: str
    support_email: str | None
    support_phone: str | None
    business_address: str | None
    business_website: str | None
    statement_descriptor: str | None
    logo_url: str | None
    brand_color: str | None
    payout_bank_name: str | None
    payout_bank_account_number: str | None
    payout_schedule: str
    enabled_payment_methods: list[str]
    checkout_terms_url: str | None
    checkout_privacy_url: str | None
    invoice_footer: str | None

    model_config = {"from_attributes": True}


class BusinessSettingsUpdateRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=255)
    support_email: EmailStr | None = None
    support_phone: str | None = Field(default=None, max_length=32)
    business_address: str | None = Field(default=None, max_length=500)
    business_website: str | None = Field(default=None, max_length=2048)
    statement_descriptor: str | None = Field(default=None, min_length=5, max_length=22)


class BrandingSettingsUpdateRequest(BaseModel):
    logo_url: str | None = Field(default=None, max_length=2048)
    brand_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class PayoutSettingsUpdateRequest(BaseModel):
    payout_bank_name: str = Field(min_length=2, max_length=120)
    payout_bank_account_number: str = Field(min_length=4, max_length=64)
    payout_schedule: str


class GoLiveRequest(BaseModel):
    business_type: str
    legal_business_name: str = Field(min_length=2, max_length=255)
    business_category: str = Field(min_length=2, max_length=120)
    registration_number: str | None = Field(default=None, max_length=120)
    national_tax_number: str | None = Field(default=None, max_length=32)
    business_address: str = Field(min_length=5, max_length=500)
    website_url: str | None = Field(default=None, max_length=2048)
    product_description: str = Field(min_length=10, max_length=2000)
    representative_full_name: str = Field(min_length=2, max_length=255)
    representative_cnic: str = Field(min_length=13, max_length=20)
    representative_dob: date
    representative_address: str = Field(min_length=5, max_length=500)
    bank_name: str = Field(min_length=2, max_length=120)
    bank_account_number: str = Field(min_length=4, max_length=64)
    contact_phone: str = Field(min_length=6, max_length=32)
    notes: str | None = None
    terms_accepted: bool

    @field_validator("terms_accepted")
    @classmethod
    def _must_accept_terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the terms to submit")
        return v


class GoLiveResponse(BaseModel):
    status: str
    business_type: str
    legal_business_name: str
    business_category: str
    product_description: str
    representative_full_name: str
    bank_name: str
    bank_account_number: str
    submitted_at: datetime
    reviewed_at: datetime | None
    rejection_reason: str | None = None

    model_config = {"from_attributes": True}


class ApiKeyCreateResponse(BaseModel):
    id: uuid.UUID
    key_prefix: str
    mode: str
    full_key: str


class PaymentsSettingsUpdateRequest(BaseModel):
    enabled_payment_methods: list[str] = Field(min_length=1)
    checkout_terms_url: str | None = Field(default=None, max_length=2048)
    checkout_privacy_url: str | None = Field(default=None, max_length=2048)


class BillingSettingsUpdateRequest(BaseModel):
    invoice_footer: str | None = Field(default=None, max_length=2000)


class CloseAccountRequest(BaseModel):
    business_name_confirmation: str


class ActivationChecklistItem(BaseModel):
    key: str
    label: str
    complete: bool
    required: bool
    settings_path: str


class ActivationChecklistResponse(BaseModel):
    ready: bool
    items: list[ActivationChecklistItem]


class ApiKeyPublic(BaseModel):
    id: uuid.UUID
    key_prefix: str
    mode: str
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None = None

    model_config = {"from_attributes": True}
