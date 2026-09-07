import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class NotificationResponse(BaseModel):
    id: uuid.UUID
    category: str
    severity: str
    title: str
    body: str
    resource_type: str | None
    resource_id: str | None
    link: str | None
    actor_email: str | None
    changes: dict
    read_at: datetime | None
    emailed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    unread: int


class NotificationPreferenceResponse(BaseModel):
    email_enabled: bool
    # The address notifications are sent to, and whether it is confirmed. A
    # null `email_address` means "use my verified login email".
    email_address: str | None
    email_verified: bool
    login_email: EmailStr
    login_email_verified: bool
    email_categories: list[str]
    available_categories: list[str]


class NotificationPreferenceUpdateRequest(BaseModel):
    email_enabled: bool | None = None
    email_categories: list[str] | None = None


class NotificationEmailRequest(BaseModel):
    """Start confirming an alternate delivery address."""

    email: EmailStr


class NotificationEmailVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
