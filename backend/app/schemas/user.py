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
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


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
