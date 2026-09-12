"""website visits

Revision ID: a7c3e19f2b44
Revises: c9f2a4e8b6d1
Create Date: 2026-09-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a7c3e19f2b44'
down_revision = 'c9f2a4e8b6d1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'website_visits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('path', sa.String(length=255), nullable=False),
        sa.Column('referrer', sa.String(length=500), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('city', sa.String(length=120), nullable=True),
        sa.Column('region', sa.String(length=120), nullable=True),
        sa.Column('country', sa.String(length=120), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema='public',
    )
    op.create_index(
        'ix_website_visits_created_at', 'website_visits', ['created_at'], unique=False, schema='public'
    )


def downgrade() -> None:
    op.drop_index('ix_website_visits_created_at', table_name='website_visits', schema='public')
    op.drop_table('website_visits', schema='public')
