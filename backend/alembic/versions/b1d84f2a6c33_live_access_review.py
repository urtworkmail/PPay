"""add rejection reason to live access requests

Revision ID: b1d84f2a6c33
Revises: a7f3e91c4d02
Create Date: 2026-09-07 20:00:00.000000

Fixes a real gap: nothing anywhere in the codebase ever set a merchant's
`live_status` to LIVE, or a `LiveAccessRequest.status` to APPROVED/REJECTED —
the Go-Live form collected KYC data into a request that could never actually
be reviewed. See the new `api/v1/platform_admin.py` endpoints this migration
supports.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b1d84f2a6c33'
down_revision = 'a7f3e91c4d02'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("live_access_requests", sa.Column("rejection_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("live_access_requests", "rejection_reason")
