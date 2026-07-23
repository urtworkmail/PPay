"""add audit log entries, platform admin, and archive operation tables

Revision ID: 70d1e48157a7
Revises: 0a071415ddaf
Create Date: 2026-07-23 03:00:00.000000

- `audit_log_entries`: tenant-scoped (sandbox/production), append-only log of
  data changes made by team members/owners within their own account.
- `platform_admins`, `archive_operations`: global (`public` schema) — the
  platform super admin is not scoped to any merchant or mode.
"""
from alembic import op
import sqlalchemy as sa

from app.core.db import TENANT_SCHEMA, Base
from app.models import *  # noqa: F401,F403 -- register every model on Base.metadata

# revision identifiers, used by Alembic.
revision = '70d1e48157a7'
down_revision = '0a071415ddaf'
branch_labels = None
depends_on = None

NEW_TENANT_TABLES = ["audit_log_entries"]
NEW_GLOBAL_TABLES = ["platform_admins", "archive_operations"]


def upgrade() -> None:
    bind = op.get_bind()

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


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text('DROP TABLE IF EXISTS sandbox."audit_log_entries" CASCADE'))
    bind.execute(sa.text('DROP TABLE IF EXISTS production."audit_log_entries" CASCADE'))
    bind.execute(sa.text('DROP TABLE IF EXISTS public."archive_operations" CASCADE'))
    bind.execute(sa.text('DROP TABLE IF EXISTS public."platform_admins" CASCADE'))
