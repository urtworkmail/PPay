import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditLogEntryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    user_email: str | None
    action: str
    resource_type: str
    resource_id: str | None
    changes: dict
    created_at: datetime

    model_config = {"from_attributes": True}
