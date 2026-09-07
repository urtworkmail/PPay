import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserProfile(BaseModel):
    id: uuid.UUID
    merchant_id: uuid.UUID
    email: EmailStr
    name: str | None
    role: str
    status: str
    totp_enabled: bool = False
    email_verified: bool = False
    email_verified_at: datetime | None = None
    phone: str | None = None
    job_title: str | None = None
    timezone_name: str | None = None
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class UserProfileUpdateRequest(BaseModel):
    """Personal details a user maintains about themselves. The email address is
    deliberately not editable here — changing it re-runs verification through
    its own endpoint."""

    name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    job_title: str | None = Field(default=None, max_length=120)
    timezone_name: str | None = Field(default=None, max_length=64)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class EmailVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class EmailVerifyTokenRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


class GenericMessageResponse(BaseModel):
    """Deliberately uniform response for flows that must not reveal whether an
    address exists (verification resend, password reset)."""

    message: str


class TeamInviteRequest(BaseModel):
    email: EmailStr
    name: str | None = Field(default=None, max_length=255)
    role: str = Field(default="analyst")


class TeamInviteResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: str
    invite_url: str


class TeamMemberResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str | None
    role: str
    status: str
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class TeamMemberRoleUpdateRequest(BaseModel):
    role: str


class InviteContextResponse(BaseModel):
    email: EmailStr
    business_name: str


class AcceptInviteRequest(BaseModel):
    token: str
    name: str | None = Field(default=None, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class TotpEnrollResponse(BaseModel):
    secret: str
    otpauth_uri: str


class TotpVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class TotpDisableRequest(BaseModel):
    password: str


class SessionResponse(BaseModel):
    id: uuid.UUID
    ip_address: str | None
    user_agent: str | None
    device_label: str | None = None
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime | None = None
    is_current: bool = False

    model_config = {"from_attributes": True}
