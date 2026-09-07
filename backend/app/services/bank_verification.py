"""Micro-deposit verification for a merchant's payout bank account.

This is what "Financial Connections" actually means for PPay: proving the
merchant controls the account they've entered, not a third-party
bank-aggregator integration — no broadly-available one exists to integrate
with for Pakistani banks. The mechanism is the same one Stripe/PayPal/
GoCardless use for ACH: send two small amounts, have the account holder read
them off their real statement and confirm.

In a live deployment the two amounts would actually be transferred by the
settlement bank and only become visible on the merchant's own statement after
1-2 business days — deliberately not revealed anywhere else. In sandbox mode
there's no real bank to make that transfer, so the amounts are surfaced
directly via an in-app/email notification (the same "sandbox tells you the
values that would otherwise take days" pattern already used for the OTP flow),
clearly labeled as what it is.
"""

import secrets
from datetime import datetime, timezone

from app.models.merchant import Merchant, MerchantLiveStatus
from app.models.notification import NotificationCategory
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.notifications import notify

MAX_ATTEMPTS = 5
# Real micro-deposits are sub-currency-unit amounts (a few cents/paisa) —
# small enough to be obviously not a real payment, large enough to not
# round to zero.
MIN_AMOUNT = 1
MAX_AMOUNT = 49


def _random_amount() -> int:
    return secrets.randbelow(MAX_AMOUNT - MIN_AMOUNT + 1) + MIN_AMOUNT


async def start_verification(db: AsyncSession, merchant: Merchant) -> None:
    amount_1 = _random_amount()
    amount_2 = _random_amount()
    while amount_2 == amount_1:  # distinct amounts — makes order-independent matching unambiguous
        amount_2 = _random_amount()

    merchant.payout_verification_amount_1 = amount_1
    merchant.payout_verification_amount_2 = amount_2
    merchant.payout_verification_attempts = 0
    merchant.payout_verification_sent_at = datetime.now(timezone.utc)
    merchant.payout_verified_at = None

    # Gated on this merchant's mode, not the deployment environment — a
    # merchant still on `sandbox_only` has no real settlement bank behind
    # them regardless of where the app itself is deployed.
    is_sandbox = merchant.live_status != MerchantLiveStatus.LIVE
    sandbox_note = (
        f" (sandbox: {amount_1} paisa and {amount_2} paisa — a live deployment would not show these; "
        "you'd read them off your actual bank statement in 1-2 business days)"
        if is_sandbox
        else ""
    )
    await notify(
        db,
        merchant_id=merchant.id,
        category=NotificationCategory.ACCOUNT,
        title="Verify your payout bank account",
        body=f"Two small deposits were sent to {merchant.payout_bank_name or 'your bank account'}.{sandbox_note}",
        link="/dashboard/financial-connections",
    )


def clear_verification(merchant: Merchant) -> None:
    """Call whenever the account number changes — a new, unproven account."""
    merchant.payout_verified_at = None
    merchant.payout_verification_amount_1 = None
    merchant.payout_verification_amount_2 = None
    merchant.payout_verification_attempts = 0
    merchant.payout_verification_sent_at = None


def confirm_verification(merchant: Merchant, submitted_1: int, submitted_2: int) -> bool:
    """Returns True on success. Raises no exceptions — callers decide how to
    surface an over-attempt or no-pending-verification state."""
    if merchant.payout_verification_amount_1 is None or merchant.payout_verification_amount_2 is None:
        return False
    if merchant.payout_verification_attempts >= MAX_ATTEMPTS:
        return False

    expected = {merchant.payout_verification_amount_1, merchant.payout_verification_amount_2}
    submitted = {submitted_1, submitted_2}

    merchant.payout_verification_attempts += 1

    if expected == submitted:
        merchant.payout_verified_at = datetime.now(timezone.utc)
        merchant.payout_verification_amount_1 = None
        merchant.payout_verification_amount_2 = None
        return True
    return False
