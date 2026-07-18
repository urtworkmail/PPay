"""One-off script to populate demo data for local/dev exploration.

Targets a specific merchant by email (passed as argv[1], defaults to
silicatelabs@gmail.com) and fills in transactions, invoices, payment links,
refunds, API keys, webhook endpoint/logs and settlements so every dashboard
page has something to show. Safe to re-run: it skips creation of rows that
would violate the merchant's uniqueness constraints (API key, webhook, live
access request) but always adds a fresh batch of transactions/checkout
sessions/invoices/payment links.
"""

import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

sys.path.insert(0, ".")

from app.core.db import AsyncSessionLocal  # noqa: E402
from app.core.security import generate_api_key, generate_webhook_secret, hash_api_key  # noqa: E402
from app.models.checkout_session import CheckoutSession, CheckoutSessionStatus, PaymentMethod  # noqa: E402
from app.models.invoice import Invoice, InvoiceStatus  # noqa: E402
from app.models.merchant import Merchant  # noqa: E402
from app.models.payment_link import PaymentLink  # noqa: E402
from app.models.refund import Refund, RefundStatus  # noqa: E402
from app.models.transaction import Transaction, TransactionStatus  # noqa: E402
from app.models.api_key import ApiKey, ApiKeyMode  # noqa: E402
from app.models.webhook import WebhookDeliveryStatus, WebhookEndpoint, WebhookLog  # noqa: E402
from app.models.settlement import Settlement, SettlementItem, SettlementStatus  # noqa: E402
from app.services.fee_calculator import calculate_fee_minor, calculate_net_minor  # noqa: E402

random.seed(42)

CUSTOMERS = [
    ("Ayesha Khan", "ayesha.khan@example.com"),
    ("Bilal Ahmed", "bilal.ahmed@example.com"),
    ("Sana Malik", "sana.malik@example.com"),
    ("Usman Tariq", "usman.tariq@example.com"),
    ("Hira Farooq", "hira.farooq@example.com"),
    ("Omar Sheikh", "omar.sheikh@example.com"),
    ("Zainab Iqbal", "zainab.iqbal@example.com"),
    ("Fahad Raza", "fahad.raza@example.com"),
]

DESCRIPTIONS = [
    "Order #{n} - Premium subscription",
    "Order #{n} - Store checkout",
    "Order #{n} - Consulting invoice",
    "Order #{n} - Online course purchase",
    "Order #{n} - Gift card top-up",
]

FAILURE_REASONS = ["insufficient_funds", "card_declined", "expired_card", "authentication_failed"]


def now() -> datetime:
    return datetime.now(timezone.utc)


CARD_LAST4_CHOICES = ["4242", "0002", "0069", "0119", "1881", "3155"]


def _payment_method_details(method: PaymentMethod) -> dict:
    """Mirrors the shape app.services.sandbox_engine actually produces for each method."""
    if method == PaymentMethod.CARD:
        return {"method": "card", "last4": random.choice(CARD_LAST4_CHOICES)}
    if method == PaymentMethod.WALLET:
        return {"method": "wallet", "phone_last4": f"{random.randint(0, 9999):04d}"}
    if method == PaymentMethod.BANK_TRANSFER:
        return {"method": "bank_transfer"}
    return {"method": method.value}


async def get_merchant(db, email: str) -> Merchant:
    result = await db.execute(select(Merchant).where(Merchant.email == email))
    merchant = result.scalar_one_or_none()
    if merchant is None:
        raise SystemExit(f"No merchant found with email {email!r}")
    return merchant


async def seed_api_key(db, merchant: Merchant) -> None:
    existing = await db.execute(
        select(ApiKey).where(ApiKey.merchant_id == merchant.id, ApiKey.mode == ApiKeyMode.SANDBOX)
    )
    if existing.scalar_one_or_none() is not None:
        return
    full_key, prefix, _ = generate_api_key("sandbox")
    db.add(
        ApiKey(
            merchant_id=merchant.id,
            key_prefix=prefix,
            hashed_key=hash_api_key(full_key),
            mode=ApiKeyMode.SANDBOX,
            is_active=True,
        )
    )
    print(f"  created sandbox API key: {full_key} (save this, it won't be shown again)")


async def seed_webhook(db, merchant: Merchant) -> WebhookEndpoint:
    existing = await db.execute(select(WebhookEndpoint).where(WebhookEndpoint.merchant_id == merchant.id))
    endpoint = existing.scalar_one_or_none()
    if endpoint is not None:
        return endpoint
    endpoint = WebhookEndpoint(
        merchant_id=merchant.id,
        url="https://example.com/webhooks/openpay",
        secret=generate_webhook_secret(),
        events=["payment_intent.succeeded", "payment_intent.failed", "charge.refunded"],
        is_active=True,
    )
    db.add(endpoint)
    await db.flush()
    return endpoint


async def seed_transactions(db, merchant: Merchant, endpoint: WebhookEndpoint) -> list[Transaction]:
    transactions: list[Transaction] = []
    n_transactions = 60
    outcomes = (
        [("succeeded", None)] * 40
        + [("failed", None)] * 12
        + [("refunded", None)] * 8
    )
    random.shuffle(outcomes)

    for i, (outcome, _) in enumerate(outcomes, start=1):
        name, email = random.choice(CUSTOMERS)
        amount_minor = random.choice([25000, 50000, 75000, 99900, 150000, 250000, 500000])
        currency = "PKR"
        method = random.choice(list(PaymentMethod))
        created_at = now() - timedelta(
            days=random.randint(0, 89), hours=random.randint(0, 23), minutes=random.randint(0, 59)
        )

        session = CheckoutSession(
            merchant_id=merchant.id,
            amount_minor=amount_minor,
            currency=currency,
            status=CheckoutSessionStatus.SUCCEEDED if outcome != "failed" else CheckoutSessionStatus.FAILED,
            method=method,
            customer_email=email,
            customer_phone=None,
            description=random.choice(DESCRIPTIONS).format(n=1000 + i),
            idempotency_key=f"seed-{uuid.uuid4()}",
            session_metadata={"customer_name": name},
            created_at=created_at,
            expires_at=created_at + timedelta(minutes=30),
            completed_at=created_at + timedelta(minutes=2),
        )
        db.add(session)
        await db.flush()

        if outcome == "failed":
            fee_minor = 0
            net_minor = 0
            status = TransactionStatus.FAILED
            failure_reason = random.choice(FAILURE_REASONS)
        else:
            fee_minor = calculate_fee_minor(amount_minor)
            net_minor = calculate_net_minor(amount_minor, fee_minor)
            status = TransactionStatus.REFUNDED if outcome == "refunded" else TransactionStatus.SUCCEEDED
            failure_reason = None

        settled = status == TransactionStatus.SUCCEEDED and created_at < now() - timedelta(days=7)

        transaction = Transaction(
            checkout_session_id=session.id,
            merchant_id=merchant.id,
            amount_minor=amount_minor,
            currency=currency,
            fee_minor=fee_minor,
            net_amount_minor=net_minor,
            status=status,
            gateway_reference=f"gw_{uuid.uuid4().hex[:16]}",
            failure_reason=failure_reason,
            payment_method_details=_payment_method_details(method),
            settled=settled,
            created_at=created_at,
        )
        db.add(transaction)
        await db.flush()
        transactions.append(transaction)

        if outcome == "refunded":
            db.add(
                Refund(
                    transaction_id=transaction.id,
                    merchant_id=merchant.id,
                    amount_minor=amount_minor,
                    reason=random.choice(["Customer request", "Duplicate charge", "Product not delivered"]),
                    status=RefundStatus.SUCCEEDED,
                    created_at=created_at + timedelta(days=1),
                )
            )

        event_type = "payment_intent.succeeded" if status != TransactionStatus.FAILED else "payment_intent.failed"
        delivered = random.random() > 0.1
        db.add(
            WebhookLog(
                endpoint_id=endpoint.id,
                transaction_id=transaction.id,
                event_type=event_type,
                payload={"type": event_type, "data": {"transaction_id": str(transaction.id), "amount_minor": amount_minor}},
                response_status=200 if delivered else 500,
                attempt_count=1 if delivered else 3,
                status=WebhookDeliveryStatus.DELIVERED if delivered else WebhookDeliveryStatus.FAILED,
                created_at=created_at + timedelta(seconds=2),
            )
        )

    print(f"  created {n_transactions} checkout sessions + transactions")
    return transactions


async def seed_invoices(db, merchant: Merchant) -> None:
    statuses = [InvoiceStatus.PAID, InvoiceStatus.PAID, InvoiceStatus.SENT, InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]
    for i, status in enumerate(statuses, start=1):
        name, email = random.choice(CUSTOMERS)
        created_at = now() - timedelta(days=random.randint(1, 60))
        invoice = Invoice(
            merchant_id=merchant.id,
            customer_name=name,
            customer_email=email,
            amount_minor=random.choice([50000, 120000, 250000, 400000]),
            currency="PKR",
            description=f"Invoice for services rendered #{2000 + i}",
            status=status,
            due_date=created_at + timedelta(days=14),
            created_at=created_at,
            sent_at=created_at + timedelta(hours=1) if status != InvoiceStatus.DRAFT else None,
            paid_at=created_at + timedelta(days=2) if status == InvoiceStatus.PAID else None,
        )
        db.add(invoice)
    print(f"  created {len(statuses)} invoices")


async def seed_payment_links(db, merchant: Merchant) -> None:
    links = [
        ("Pro Plan - Monthly", "Recurring access to Pro features", 250000, 34),
        ("Consultation Call", "30-minute 1:1 consultation", 500000, 12),
        ("Digital Download Bundle", "E-book + templates bundle", 99900, 58),
        ("Workshop Ticket", "Access to the live workshop", 150000, 6),
    ]
    for title, description, amount, usage in links:
        db.add(
            PaymentLink(
                merchant_id=merchant.id,
                title=title,
                description=description,
                amount_minor=amount,
                currency="PKR",
                is_active=True,
                usage_count=usage,
                created_at=now() - timedelta(days=random.randint(5, 60)),
            )
        )
    print(f"  created {len(links)} payment links")


async def seed_settlements(db, merchant: Merchant, transactions: list[Transaction]) -> None:
    settled_tx = [t for t in transactions if t.settled]
    if not settled_tx:
        return
    settled_tx.sort(key=lambda t: t.created_at)

    buckets: dict[str, list[Transaction]] = {}
    for t in settled_tx:
        week_key = t.created_at.strftime("%Y-%W")
        buckets.setdefault(week_key, []).append(t)

    for txs in buckets.values():
        period_start = min(t.created_at for t in txs)
        period_end = max(t.created_at for t in txs) + timedelta(days=1)
        gross = sum(t.amount_minor for t in txs)
        fee = sum(t.fee_minor for t in txs)
        net = sum(t.net_amount_minor for t in txs)
        settlement = Settlement(
            merchant_id=merchant.id,
            period_start=period_start,
            period_end=period_end,
            gross_amount_minor=gross,
            fee_amount_minor=fee,
            net_amount_minor=net,
            transaction_count=len(txs),
            status=SettlementStatus.PAID,
            paid_at=period_end + timedelta(days=2),
            created_at=period_end,
        )
        db.add(settlement)
        await db.flush()
        for t in txs:
            db.add(SettlementItem(settlement_id=settlement.id, transaction_id=t.id))
    print(f"  created {len(buckets)} settlements covering {len(settled_tx)} transactions")


async def main() -> None:
    email = sys.argv[1] if len(sys.argv) > 1 else "silicatelabs@gmail.com"
    async with AsyncSessionLocal() as db:
        merchant = await get_merchant(db, email)
        print(f"Seeding demo data for {merchant.business_name} <{merchant.email}> ({merchant.id})")

        await seed_api_key(db, merchant)
        endpoint = await seed_webhook(db, merchant)
        transactions = await seed_transactions(db, merchant, endpoint)
        await seed_invoices(db, merchant)
        await seed_payment_links(db, merchant)
        await seed_settlements(db, merchant, transactions)

        await db.commit()
        print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
