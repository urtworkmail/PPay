import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.invoice import InvoiceResponse
from app.schemas.subscription import SavedPaymentMethodSummary, SubscriptionResponse
from app.schemas.transaction import TransactionResponse

__all__ = ["CustomerSummary", "SavedPaymentMethodSummary", "CustomerDetailResponse", "RelatedPaymentLinkSummary"]


class CustomerSummary(BaseModel):
    email: str
    total_spent_minor: int
    currency: str
    transaction_count: int
    last_transaction_at: datetime
    subscription_count: int = 0


class RelatedPaymentLinkSummary(BaseModel):
    id: uuid.UUID
    title: str


class CustomerDetailResponse(BaseModel):
    email: str
    name: str | None
    total_spent_minor: int
    currency: str
    transaction_count: int
    first_seen_at: datetime | None
    last_transaction_at: datetime | None
    payment_methods: list[str]
    transactions: list[TransactionResponse]
    invoices: list[InvoiceResponse]
    subscriptions: list[SubscriptionResponse]
    saved_payment_methods: list[SavedPaymentMethodSummary]
    payment_links: list[RelatedPaymentLinkSummary] = []
