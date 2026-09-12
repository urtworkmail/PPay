import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TrackVisitRequest(BaseModel):
    path: str = Field(max_length=255)
    referrer: str | None = Field(default=None, max_length=500)


class WebsiteVisitResponse(BaseModel):
    id: uuid.UUID
    path: str
    referrer: str | None
    ip_address: str | None
    city: str | None
    region: str | None
    country: str | None
    user_agent: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
