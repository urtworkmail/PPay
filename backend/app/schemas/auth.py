import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class MerchantRegisterRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class MerchantLoginRequest(BaseModel):
    email: EmailStr
    password: str


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

    model_config = {"from_attributes": True}


class GoLiveRequest(BaseModel):
    legal_business_name: str = Field(min_length=2, max_length=255)
    business_category: str = Field(min_length=2, max_length=120)
    registration_number: str | None = Field(default=None, max_length=120)
    website_url: str | None = Field(default=None, max_length=2048)
    bank_name: str = Field(min_length=2, max_length=120)
    bank_account_number: str = Field(min_length=4, max_length=64)
    contact_phone: str = Field(min_length=6, max_length=32)
    notes: str | None = None


class GoLiveResponse(BaseModel):
    status: str
    legal_business_name: str
    business_category: str
    submitted_at: datetime
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class ApiKeyCreateResponse(BaseModel):
    id: uuid.UUID
    key_prefix: str
    mode: str
    full_key: str


class ApiKeyPublic(BaseModel):
    id: uuid.UUID
    key_prefix: str
    mode: str
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None = None

    model_config = {"from_attributes": True}
