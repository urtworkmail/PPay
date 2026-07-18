"""expand live access request with kyc fields

Revision ID: 145db93c5523
Revises: a8b28c4812c0
Create Date: 2026-07-17 05:52:55.779092

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '145db93c5523'
down_revision = 'a8b28c4812c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    business_type = postgresql.ENUM(
        'UNREGISTERED', 'SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'NONPROFIT', name='business_type'
    )
    business_type.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'live_access_requests',
        sa.Column('business_type', business_type, nullable=False, server_default='UNREGISTERED'),
    )
    op.alter_column('live_access_requests', 'business_type', server_default=None)

    op.add_column('live_access_requests', sa.Column('national_tax_number', sa.String(length=32), nullable=True))
    op.add_column(
        'live_access_requests', sa.Column('business_address', sa.String(length=500), nullable=False, server_default='')
    )
    op.add_column(
        'live_access_requests', sa.Column('product_description', sa.Text(), nullable=False, server_default='')
    )
    op.add_column(
        'live_access_requests',
        sa.Column('representative_full_name', sa.String(length=255), nullable=False, server_default=''),
    )
    op.add_column(
        'live_access_requests', sa.Column('representative_cnic', sa.String(length=20), nullable=False, server_default='')
    )
    op.add_column(
        'live_access_requests',
        sa.Column('representative_dob', sa.Date(), nullable=False, server_default='2000-01-01'),
    )
    op.add_column(
        'live_access_requests',
        sa.Column('representative_address', sa.String(length=500), nullable=False, server_default=''),
    )
    op.add_column(
        'live_access_requests', sa.Column('terms_accepted', sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column('live_access_requests', sa.Column('terms_accepted_at', sa.DateTime(timezone=True), nullable=True))

    # Backfill existing applications with their known fields rather than leaving
    # placeholder blanks — these are pre-existing sandbox go-live requests.
    op.execute(
        """
        UPDATE live_access_requests
        SET business_address = 'Not provided at time of original application',
            product_description = COALESCE(notes, 'Not provided at time of original application'),
            representative_full_name = legal_business_name,
            representative_cnic = '00000-0000000-0',
            representative_address = 'Not provided at time of original application'
        """
    )

    for column in ('business_address', 'product_description', 'representative_full_name', 'representative_cnic',
                    'representative_dob', 'representative_address', 'terms_accepted'):
        op.alter_column('live_access_requests', column, server_default=None)


def downgrade() -> None:
    op.drop_column('live_access_requests', 'terms_accepted_at')
    op.drop_column('live_access_requests', 'terms_accepted')
    op.drop_column('live_access_requests', 'representative_address')
    op.drop_column('live_access_requests', 'representative_dob')
    op.drop_column('live_access_requests', 'representative_cnic')
    op.drop_column('live_access_requests', 'representative_full_name')
    op.drop_column('live_access_requests', 'product_description')
    op.drop_column('live_access_requests', 'business_address')
    op.drop_column('live_access_requests', 'national_tax_number')
    op.drop_column('live_access_requests', 'business_type')
    postgresql.ENUM(name='business_type').drop(op.get_bind(), checkfirst=True)
