"""track refunds against charges

Revision ID: d8a91c3e5f7b
Revises: c7e40b1f92da
Create Date: 2026-09-07 14:00:00.000000

`api/v1/transactions.py::refund_transaction` wrote a `Refund` row and flipped
`Transaction.status` to `refunded`, but never touched the `PaymentIntent`/
`Charge` pair that `checkout.py` dual-writes alongside `Transaction` (see
`services/payment_intent_engine.py`) — so a refunded transaction left its
Charge silently claiming to still be fully, unrefundedly `succeeded`. Anything
reading from the new orchestrator objects (the transaction detail view's
`charge_attempts` count, and anything built on top of it going forward) would
disagree with `Transaction` about whether money had gone back.

This mirrors Stripe's own shape: a refund doesn't change a Charge's terminal
`succeeded` status, it accumulates against `refunded_amount_minor`. No new
table, no PaymentIntent status change — `charges.refunded_amount_minor` is
enough for the transaction/refund endpoints to keep both records honest.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd8a91c3e5f7b'
down_revision = 'c7e40b1f92da'
branch_labels = None
depends_on = None

def _column() -> sa.Column:
    # A fresh Column instance per call — SQLAlchemy binds a Column to the
    # single table it's added to, so the same instance can't be reused across
    # both schema's `add_column` calls.
    return sa.Column("refunded_amount_minor", sa.BigInteger(), nullable=False, server_default="0")


def upgrade() -> None:
    op.add_column("charges", _column(), schema="sandbox")
    op.add_column("charges", _column(), schema="production")


def downgrade() -> None:
    op.drop_column("charges", "refunded_amount_minor", schema="production")
    op.drop_column("charges", "refunded_amount_minor", schema="sandbox")
