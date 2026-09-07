"""add notifications, email verification, and platform status monitoring

Revision ID: b3f21c9d47ae
Revises: 70d1e48157a7
Create Date: 2026-09-07 10:00:00.000000

- `notifications`: tenant-scoped (sandbox/production) — the merchant's activity
  feed, so sandbox noise never appears in a live-mode inbox.
- `notification_preferences`, `email_verifications`: global (`public`) — a
  person's contact address and delivery preferences aren't mode-specific.
- `service_status_checks`, `service_status_incidents`: global (`public`) —
  platform infrastructure owned by the super admin, not by any merchant.
- `users`: email verification state plus a few personal-profile columns.
"""
from alembic import op
import sqlalchemy as sa

from app.core.db import TENANT_SCHEMA, Base
from app.models import *  # noqa: F401,F403 -- register every model on Base.metadata

# revision identifiers, used by Alembic.
revision = 'b3f21c9d47ae'
down_revision = '70d1e48157a7'
branch_labels = None
depends_on = None

NEW_TENANT_TABLES = ["notifications"]
NEW_GLOBAL_TABLES = [
    "notification_preferences",
    "email_verifications",
    "service_status_checks",
    "service_status_incidents",
]

NEW_USER_COLUMNS = [
    sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("phone", sa.String(length=32), nullable=True),
    sa.Column("job_title", sa.String(length=120), nullable=True),
    sa.Column("timezone_name", sa.String(length=64), nullable=True),
]


def upgrade() -> None:
    bind = op.get_bind()

    for column in NEW_USER_COLUMNS:
        op.add_column("users", column)

    global_tables = [t for t in Base.metadata.sorted_tables if t.schema is None and t.name in NEW_GLOBAL_TABLES]
    Base.metadata.create_all(bind=bind, tables=global_tables, checkfirst=True)

    new_tenant_tables = [
        t for t in Base.metadata.sorted_tables if t.schema == TENANT_SCHEMA and t.name in NEW_TENANT_TABLES
    ]

    bind.execution_options(schema_translate_map={TENANT_SCHEMA: "production"})
    Base.metadata.create_all(bind=bind, tables=new_tenant_tables, checkfirst=True)

    bind.execution_options(schema_translate_map={TENANT_SCHEMA: "sandbox"})
    Base.metadata.create_all(bind=bind, tables=new_tenant_tables, checkfirst=True)

    bind.execution_options(schema_translate_map={})

    # Existing accounts predate email verification. Treating them as verified
    # keeps them able to receive notification email; re-verifying every live
    # account would silently mute it instead.
    bind.execute(sa.text("UPDATE public.users SET email_verified = true WHERE status = 'ACTIVE'"))


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text('DROP TABLE IF EXISTS sandbox."notifications" CASCADE'))
    bind.execute(sa.text('DROP TABLE IF EXISTS production."notifications" CASCADE'))
    bind.execute(sa.text('DROP TABLE IF EXISTS public."service_status_incidents" CASCADE'))
    bind.execute(sa.text('DROP TABLE IF EXISTS public."service_status_checks" CASCADE'))
    bind.execute(sa.text('DROP TABLE IF EXISTS public."email_verifications" CASCADE'))
    bind.execute(sa.text('DROP TABLE IF EXISTS public."notification_preferences" CASCADE'))

    for column in ("timezone_name", "job_title", "phone", "email_verified_at", "email_verified"):
        op.drop_column("users", column)
