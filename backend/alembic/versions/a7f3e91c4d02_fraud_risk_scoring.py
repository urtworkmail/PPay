"""add fraud risk scoring fields

Revision ID: a7f3e91c4d02
Revises: f4c8d02e6a13
Create Date: 2026-09-07 19:00:00.000000

The real, buildable slice of "Sentinel" (see `services/fraud_engine.py`):
rule-based risk scoring computed at charge time, using signals that actually
exist in this system (velocity, first-time customer, amount deviation, recent
declines) — not the ML/device-fingerprinting/custom-rule-builder-UI vision the
Sentinel marketing page describes, which stays explicitly out of scope here.

`checkout_sessions.buyer_ip` is new — nothing captured the buyer's IP before
this, so velocity-by-IP had nothing to query against.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = 'a7f3e91c4d02'
down_revision = 'f4c8d02e6a13'
branch_labels = None
depends_on = None

TENANT_SCHEMAS = ["sandbox", "production"]


def upgrade() -> None:
    for schema in TENANT_SCHEMAS:
        op.add_column("checkout_sessions", sa.Column("buyer_ip", sa.String(length=64), nullable=True), schema=schema)
        op.add_column(
            "transactions",
            sa.Column("risk_score", sa.Integer(), nullable=False, server_default="0"),
            schema=schema,
        )
        op.add_column(
            "transactions",
            sa.Column("risk_flags", JSONB(), nullable=False, server_default="[]"),
            schema=schema,
        )


def downgrade() -> None:
    for schema in TENANT_SCHEMAS:
        op.drop_column("transactions", "risk_flags", schema=schema)
        op.drop_column("transactions", "risk_score", schema=schema)
        op.drop_column("checkout_sessions", "buyer_ip", schema=schema)
