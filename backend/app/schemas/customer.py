from datetime import datetime

from pydantic import BaseModel

from app.schemas.invoice import InvoiceResponse
from app.schemas.transaction import TransactionResponse


class CustomerSummary(BaseModel):
    email: str
    total_spent_minor: int
    currency: str
    transaction_count: int
    last_transaction_at: datetime


class CustomerDetailResponse(BaseModel):
    email: str
    name: str | None
    total_spent_minor: int
    currency: str
    transaction_count: int
    first_seen_at: datetime | None
    last_transaction_at: datetime | None
    transactions: list[TransactionResponse]
    invoices: list[InvoiceResponse]
