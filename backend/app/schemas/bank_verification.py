from datetime import datetime

from pydantic import BaseModel, Field


class PayoutVerificationStatusResponse(BaseModel):
    bank_name: str | None
    account_number_masked: str | None
    verified_at: datetime | None
    verification_sent_at: datetime | None
    attempts_remaining: int | None  # None when there's no pending verification to spend attempts on


class PayoutVerificationConfirmRequest(BaseModel):
    amount_1: int = Field(ge=1, le=99)
    amount_2: int = Field(ge=1, le=99)
