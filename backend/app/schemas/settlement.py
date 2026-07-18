import uuid
from datetime import datetime

from pydantic import BaseModel


class BalanceSummaryResponse(BaseModel):
    currency: str
    pending_settlement_minor: int
    available_minor: int
    paid_out_minor: int
    next_payout_at: datetime | None
    next_payout_amount_minor: int
    payout_schedule: str


class SettlementResponse(BaseModel):
    id: uuid.UUID
    period_start: datetime
    period_end: datetime
    gross_amount_minor: int
    fee_amount_minor: int
    net_amount_minor: int
    transaction_count: int
    status: str
    paid_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardSummaryResponse(BaseModel):
    total_volume_minor: int
    total_fees_minor: int
    transaction_count: int
    succeeded_count: int
    failed_count: int
    success_rate: float
    pending_settlement_minor: int
