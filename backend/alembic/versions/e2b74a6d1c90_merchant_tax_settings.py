"""add merchant tax registration fields

Revision ID: e2b74a6d1c90
Revises: d8a91c3e5f7b
Create Date: 2026-09-07 16:00:00.000000

Merchants are the `public`-schema identity table (shared across sandbox/live,
like the rest of their business settings) — tax registration is a property of
the business, not of which mode you're looking at.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e2b74a6d1c90'
down_revision = 'd8a91c3e5f7b'
branch_labels = None
depends_on = None

# This codebase's convention (see payout_schedule, merchant_status, etc.):
# the Postgres enum stores the Python enum member's *name*, uppercase.
tax_filer_status_enum = postgresql.ENUM("UNKNOWN", "FILER", "NON_FILER", name="tax_filer_status")
tax_province_enum = postgresql.ENUM(
    "PUNJAB", "SINDH", "KHYBER_PAKHTUNKHWA", "BALOCHISTAN", "ISLAMABAD_CAPITAL_TERRITORY", name="tax_province"
)


def upgrade() -> None:
    bind = op.get_bind()
    tax_filer_status_enum.create(bind, checkfirst=True)
    tax_province_enum.create(bind, checkfirst=True)

    op.add_column("merchants", sa.Column("national_tax_number", sa.String(length=32), nullable=True))
    op.add_column("merchants", sa.Column("sales_tax_registration_number", sa.String(length=32), nullable=True))
    op.add_column(
        "merchants",
        sa.Column("tax_filer_status", tax_filer_status_enum, nullable=False, server_default="UNKNOWN"),
    )
    op.add_column("merchants", sa.Column("tax_province", tax_province_enum, nullable=True))


def downgrade() -> None:
    op.drop_column("merchants", "tax_province")
    op.drop_column("merchants", "tax_filer_status")
    op.drop_column("merchants", "sales_tax_registration_number")
    op.drop_column("merchants", "national_tax_number")

    bind = op.get_bind()
    tax_province_enum.drop(bind, checkfirst=True)
    tax_filer_status_enum.drop(bind, checkfirst=True)
