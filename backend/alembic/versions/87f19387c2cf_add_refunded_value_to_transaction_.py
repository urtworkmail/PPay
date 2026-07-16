"""add refunded value to transaction status enum

Revision ID: 87f19387c2cf
Revises: 75a7e4a02514
Create Date: 2026-07-16 14:53:47.968402

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '87f19387c2cf'
down_revision = '75a7e4a02514'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'REFUNDED'")


def downgrade() -> None:
    # Postgres doesn't support removing enum values; no-op.
    pass
