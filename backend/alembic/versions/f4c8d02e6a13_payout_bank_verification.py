"""add payout bank account verification (micro-deposit) fields

Revision ID: f4c8d02e6a13
Revises: e2b74a6d1c90
Create Date: 2026-09-07 17:30:00.000000

"Financial Connections" for PPay isn't a third-party bank-aggregator
integration (none broadly exists for Pakistan to integrate with) — it's
proving a merchant actually controls the bank account they've entered for
payouts, the same micro-deposit mechanism major payment platforms use. Two
small pending amounts and an attempt counter, on `merchants` since a merchant
has exactly one payout account at a time (matching the existing
`payout_bank_account_number` field this verifies).
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f4c8d02e6a13'
down_revision = 'e2b74a6d1c90'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("merchants", sa.Column("payout_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("merchants", sa.Column("payout_verification_amount_1", sa.Integer(), nullable=True))
    op.add_column("merchants", sa.Column("payout_verification_amount_2", sa.Integer(), nullable=True))
    op.add_column(
        "merchants",
        sa.Column("payout_verification_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "merchants", sa.Column("payout_verification_sent_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("merchants", "payout_verification_sent_at")
    op.drop_column("merchants", "payout_verification_attempts")
    op.drop_column("merchants", "payout_verification_amount_2")
    op.drop_column("merchants", "payout_verification_amount_1")
    op.drop_column("merchants", "payout_verified_at")
