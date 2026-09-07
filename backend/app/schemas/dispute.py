import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DisputeResponse(BaseModel):
    id: uuid.UUID
    charge_id: uuid.UUID
    amount_minor: int
    reason: str | None
    status: str
    evidence_due_by: datetime | None
    evidence_submitted_at: datetime | None
    evidence_details: dict
    created_at: datetime
    # Filled in from the Charge/PaymentIntent it's raised against — a dispute
    # is meaningless without the payment it's disputing.
    transaction_id: uuid.UUID | None = None
    gateway_reference: str | None = None

    model_config = {"from_attributes": True}


class DisputeListResponse(BaseModel):
    items: list[DisputeResponse]
    total: int
    needs_response: int
    page: int
    page_size: int


class DisputeRespondRequest(BaseModel):
    evidence_text: str = Field(min_length=10, max_length=5000)


class DisputeSimulateRequest(BaseModel):
    transaction_id: uuid.UUID | None = Field(
        default=None, description="Dispute this specific transaction; a random eligible one if omitted."
    )
