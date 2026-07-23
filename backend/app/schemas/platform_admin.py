import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class PlatformAdminLoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: str = Field(min_length=6, max_length=6)


class PlatformAdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ArchivePassphraseSetRequest(BaseModel):
    passphrase: str = Field(min_length=12, max_length=255)


class ArchiveMerchantRequest(BaseModel):
    merchant_id: uuid.UUID
    passphrase: str
    reason: str | None = Field(default=None, max_length=500)


class ArchiveOperationResponse(BaseModel):
    id: uuid.UUID
    merchant_id: uuid.UUID
    reason: str | None
    row_counts: dict
    created_at: datetime

    model_config = {"from_attributes": True}
