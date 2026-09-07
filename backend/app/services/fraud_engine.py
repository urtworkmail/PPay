"""Rule-based risk scoring at charge time — the real, buildable slice of what
the "Sentinel" roadmap page describes.

Deliberately scoped down from that page's full vision:

- **Built here**: a risk score (0-100) and named flags, computed from signals
  that actually exist in this system (recent velocity, first-time customer,
  amount deviation from the merchant's own history, recent declines) — and a
  small, fixed set of block rules that run *before* the sandbox rail is
  called, so a blocked attempt genuinely never reaches
  `sandbox_engine.authorize_*` (matching the "blocked attempt never touches
  the rail" promise on the Sentinel page).
- **Not built**: a no-code custom rule builder UI, device/browser
  fingerprinting beyond IP, ML-based scoring, and dispute-evidence
  auto-assembly. `pages/Sentinel.jsx` says so explicitly — this module backs
  the parts of that page now marked "Live," not the rest of it.

Every signal is a plain SQL aggregate over this merchant's own tenant-scoped
data (see core/db.py's schema separation) — no cross-merchant signal sharing,
by design: one merchant's fraud pattern is not evidence against another's
customer.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checkout_session import CheckoutSession
from app.models.transaction import Transaction, TransactionStatus

VELOCITY_WINDOW_MINUTES = 10
VELOCITY_EMAIL_THRESHOLD = 4  # attempts from the same email in the window
VELOCITY_IP_THRESHOLD = 6  # attempts from the same IP in the window (shared devices/NAT are common)
RECENT_DECLINE_WINDOW_MINUTES = 30
RECENT_DECLINE_THRESHOLD = 3
AMOUNT_DEVIATION_MULTIPLE = 5  # vs. this merchant's own trailing average successful amount

BLOCK_SCORE_THRESHOLD = 75


@dataclass
class FraudAssessment:
    score: int
    flags: list[str] = field(default_factory=list)
    blocked: bool = False
    block_reason: str | None = None


async def _count_since(db: AsyncSession, *, merchant_id: UUID, since: datetime, email: str | None, ip: str | None) -> tuple[int, int]:
    """Returns (attempts_by_email, attempts_by_ip) in the window, each 0 if
    there's no email/ip to match against."""
    by_email = 0
    if email:
        by_email = await db.scalar(
            select(func.count())
            .select_from(Transaction)
            .join(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
            .where(
                Transaction.merchant_id == merchant_id,
                CheckoutSession.customer_email == email,
                Transaction.created_at >= since,
            )
        ) or 0

    by_ip = 0
    if ip:
        by_ip = await db.scalar(
            select(func.count())
            .select_from(Transaction)
            .join(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
            .where(
                Transaction.merchant_id == merchant_id,
                CheckoutSession.buyer_ip == ip,
                Transaction.created_at >= since,
            )
        ) or 0

    return by_email, by_ip


async def assess(
    db: AsyncSession,
    *,
    merchant_id: UUID,
    customer_email: str | None,
    buyer_ip: str | None,
    amount_minor: int,
) -> FraudAssessment:
    now = datetime.now(timezone.utc)
    score = 0
    flags: list[str] = []

    # Signal 1: velocity — many attempts from the same identity in a short window.
    velocity_since = now - timedelta(minutes=VELOCITY_WINDOW_MINUTES)
    email_count, ip_count = await _count_since(db, merchant_id=merchant_id, since=velocity_since, email=customer_email, ip=buyer_ip)
    if customer_email and email_count >= VELOCITY_EMAIL_THRESHOLD:
        score += 35
        flags.append("velocity_email")
    if buyer_ip and ip_count >= VELOCITY_IP_THRESHOLD:
        score += 25
        flags.append("velocity_ip")

    # Signal 2: first-time customer — not inherently bad, but a real factor
    # (a first purchase at an unusually high amount is the classic pattern).
    is_first_time = True
    if customer_email:
        prior = await db.scalar(
            select(func.count())
            .select_from(Transaction)
            .join(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
            .where(
                Transaction.merchant_id == merchant_id,
                CheckoutSession.customer_email == customer_email,
                Transaction.status == TransactionStatus.SUCCEEDED,
            )
        )
        is_first_time = (prior or 0) == 0
    if is_first_time:
        flags.append("first_time_customer")

    # Signal 3: amount deviation from this merchant's own trailing average —
    # what's "high" is relative to what this specific business normally
    # charges, not a fixed rupee threshold.
    avg_amount = await db.scalar(
        select(func.avg(Transaction.amount_minor))
        .where(Transaction.merchant_id == merchant_id, Transaction.status == TransactionStatus.SUCCEEDED)
    )
    if avg_amount and amount_minor > avg_amount * AMOUNT_DEVIATION_MULTIPLE:
        score += 20
        flags.append("amount_deviation")
        if is_first_time:
            # The combination — not either signal alone — is what's actually
            # suspicious, so it's weighted as its own thing.
            score += 15
            flags.append("high_amount_first_time")

    # Signal 4: recent declines from the same identity — a card-testing pattern.
    decline_since = now - timedelta(minutes=RECENT_DECLINE_WINDOW_MINUTES)
    decline_count = 0
    if customer_email or buyer_ip:
        filters = [Transaction.merchant_id == merchant_id, Transaction.status == TransactionStatus.FAILED, Transaction.created_at >= decline_since]
        identity_filter = []
        if customer_email:
            identity_filter.append(CheckoutSession.customer_email == customer_email)
        if buyer_ip:
            identity_filter.append(CheckoutSession.buyer_ip == buyer_ip)

        decline_count = await db.scalar(
            select(func.count())
            .select_from(Transaction)
            .join(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
            .where(*filters, or_(*identity_filter))
        ) or 0
    if decline_count >= RECENT_DECLINE_THRESHOLD:
        score += 30
        flags.append("recent_declines")

    score = min(100, score)
    blocked = score >= BLOCK_SCORE_THRESHOLD
    block_reason = f"Risk score {score} exceeded the block threshold ({', '.join(flags)})" if blocked else None

    return FraudAssessment(score=score, flags=flags, blocked=blocked, block_reason=block_reason)
