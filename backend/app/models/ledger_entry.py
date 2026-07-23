import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import TENANT_SCHEMA, Base


class LedgerEntryType(StrEnum):
    DEBIT = "debit"
    CREDIT = "credit"


class LedgerAccount(StrEnum):
    ACQUIRING_SETTLEMENT = "acquiring_settlement"
    MERCHANT_PAYABLE = "merchant_payable"
    FEE_REVENUE = "fee_revenue"
    TAX_PAYABLE = "tax_payable"
    RESERVE_HOLDBACK = "reserve_holdback"


class LedgerEntry(Base):
    """Double-entry, immutable, append-only (architecture spec §2.2/§9). No
    row here is ever updated or deleted by application code — corrections are
    always a new reversing entry, never an edit.

    Not yet the source of `Settlement`/`SettlementItem` balances — that
    recomputation is Phase 5 of the rebuild plan. This table is written
    starting in Phase 2 (charge settlement) and Phase 5 (refund reversal).
    """

    __tablename__ = "ledger_entries"
    __table_args__ = (
        CheckConstraint("amount_minor > 0", name="ck_ledger_entry_amount_positive"),
        {"schema": TENANT_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    charge_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.charges.id", ondelete="SET NULL"), nullable=True
    )
    refund_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{TENANT_SCHEMA}.refunds.id", ondelete="SET NULL"), nullable=True
    )
    entry_type: Mapped[LedgerEntryType] = mapped_column(Enum(LedgerEntryType, name="ledger_entry_type"), nullable=False)
    account: Mapped[LedgerAccount] = mapped_column(Enum(LedgerAccount, name="ledger_account"), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="PKR", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship()
