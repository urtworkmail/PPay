"""add approximate sign-in location to sessions

Revision ID: c9f2a4e8b6d1
Revises: b1d84f2a6c33
Create Date: 2026-09-08 10:00:00.000000

Every session already records the IP address a sign-in came from (see
`Session.ip_address`), but a raw IP means nothing to a person scanning their
own sessions list for something suspicious. Resolving it to a city/region/
country once, at sign-in time, is what actually lets someone recognize
"that's me" vs. "that's not me" at a glance — the same "signed in from
Lahore, Pakistan" pattern every major fintech app shows. This is IP-based
geolocation (city-level accuracy from the request's source IP), never
device GPS — there's no browser permission prompt, and a session's location
is only ever as precise as its IP already was.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c9f2a4e8b6d1'
down_revision = 'b1d84f2a6c33'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("city", sa.String(length=120), nullable=True))
    op.add_column("sessions", sa.Column("region", sa.String(length=120), nullable=True))
    op.add_column("sessions", sa.Column("country", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "country")
    op.drop_column("sessions", "region")
    op.drop_column("sessions", "city")
