"""Pakistan tax reporting for what PPay actually taxes: its own platform fee.

Two structurally different taxes apply here, and it matters that they're kept
separate rather than blended into one "tax" number:

- **Provincial Sales Tax on Services** — Pakistan taxes *services* provincially
  (there is no federal sales tax on services), so this is owed on PPay's own
  fee income, charged by whichever province's revenue authority the merchant
  is registered under. This is PPay's own tax liability to report, shown here
  because a merchant's statement should reconcile against what PPay's
  invoice/credit note to them would say.
- **Withholding tax** under the Income Tax Ordinance — the higher rate that
  applies to payments made to a non-filer (someone not on FBR's Active
  Taxpayer List) versus a filer. This is *informational* here: PPay isn't a
  bank making the payout, so this module estimates what a merchant's own
  withholding exposure looks like on their gross volume — it does not withhold
  or remit anything itself.

Rates below are the commonly published provincial Sales Tax on Services rates
and are intentionally each individually documented with their source
authority and a review note — they change by finance-act amendment, and this
is not a substitute for confirming the current rate with the relevant revenue
authority or a tax advisor before filing.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.merchant import Merchant, TaxFilerStatus, TaxProvince
from app.models.transaction import Transaction, TransactionStatus

# Provincial/territorial Sales Tax on Services rate on the *service fee*
# (PPay's take), in basis points. Source authority named so a merchant can go
# verify directly rather than trust a number baked into software.
PROVINCIAL_SALES_TAX_BPS: dict[TaxProvince, int] = {
    TaxProvince.PUNJAB: 1600,  # Punjab Revenue Authority (PRA)
    TaxProvince.SINDH: 1300,  # Sindh Revenue Board (SRB)
    TaxProvince.KHYBER_PAKHTUNKHWA: 1500,  # Khyber Pakhtunkhwa Revenue Authority (KPRA)
    TaxProvince.BALOCHISTAN: 1500,  # Balochistan Revenue Authority (BRA)
    TaxProvince.ISLAMABAD_CAPITAL_TERRITORY: 1600,  # FBR (Islamabad Capital Territory (Tax on Services) Ordinance)
}

# Income Tax Ordinance 2001, s.153-style filer/non-filer differential —
# expressed here as an illustrative estimate on gross volume, not a computed
# withholding on an actual payout instruction.
WITHHOLDING_TAX_BPS: dict[TaxFilerStatus, int] = {
    TaxFilerStatus.FILER: 400,
    TaxFilerStatus.NON_FILER: 800,
    TaxFilerStatus.UNKNOWN: 0,  # can't estimate what we don't know — see TaxFilerStatus docstring
}


@dataclass
class TaxSummary:
    period_start: datetime
    period_end: datetime
    currency: str

    gross_volume_minor: int
    platform_fee_minor: int  # the taxable service value

    province: TaxProvince | None
    sales_tax_rate_bps: int | None
    sales_tax_minor: int | None  # None when province isn't set — nothing to compute against

    filer_status: TaxFilerStatus
    withholding_tax_rate_bps: int
    estimated_withholding_tax_minor: int | None  # None when filer_status is UNKNOWN

    transaction_count: int
    is_estimate: bool = True


async def get_tax_summary(db: AsyncSession, merchant: Merchant, period_days: int) -> TaxSummary:
    period_end = datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=period_days)

    result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant.id,
            Transaction.status == TransactionStatus.SUCCEEDED,
            Transaction.created_at >= period_start,
            Transaction.created_at < period_end,
        )
    )
    transactions = list(result.scalars().all())

    gross = sum(t.amount_minor for t in transactions)
    fee = sum(t.fee_minor for t in transactions)

    sales_tax_bps = PROVINCIAL_SALES_TAX_BPS.get(merchant.tax_province) if merchant.tax_province else None
    sales_tax_minor = (fee * sales_tax_bps) // 10_000 if sales_tax_bps is not None else None

    withholding_bps = WITHHOLDING_TAX_BPS[merchant.tax_filer_status]
    withholding_minor = (
        (gross * withholding_bps) // 10_000 if merchant.tax_filer_status != TaxFilerStatus.UNKNOWN else None
    )

    return TaxSummary(
        period_start=period_start,
        period_end=period_end,
        currency=transactions[0].currency if transactions else "PKR",
        gross_volume_minor=gross,
        platform_fee_minor=fee,
        province=merchant.tax_province,
        sales_tax_rate_bps=sales_tax_bps,
        sales_tax_minor=sales_tax_minor,
        filer_status=merchant.tax_filer_status,
        withholding_tax_rate_bps=withholding_bps,
        estimated_withholding_tax_minor=withholding_minor,
        transaction_count=len(transactions),
    )
