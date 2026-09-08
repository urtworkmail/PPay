"""introduce sandbox/production schema separation and Phase 1 core entities

Revision ID: 0a071415ddaf
Revises: 33f037391660
Create Date: 2026-07-23 00:00:00.000000

Architecture note (see pakistan_payments_platform_architecture.md §2-3): account-level
identity tables (merchants, users, sessions, live_access_requests) stay in the default
`public` schema — a merchant is one row with both test and live key material, per spec
§2.2. Every transactional/catalog table (checkout, transactions, products, subscriptions,
invoices, payment links, refunds, webhooks, settlements, api_keys, plus the brand new
customers/payment_intents/charges/coupons/discounts/disputes/ledger_entries/
reconciliation_records/events) is schema-separated: `sandbox` vs `production`. All
existing data predates this migration and is demo/sandbox data per the architecture
audit, so it moves into `sandbox` wholesale; `production` starts empty.

Every ORM model for a tenant table declares `__table_args__ = {"schema": "tenant"}` — a
placeholder token, never a real Postgres schema name. This migration creates the two real
schemas and populates both from that same metadata via `schema_translate_map`, so table
structure (columns, FKs, constraints) has exactly one source of truth: the ORM models.
"""
from alembic import op
import sqlalchemy as sa

from app.core.db import TENANT_SCHEMA, Base
from app.models import *  # noqa: F401,F403 -- register every model on Base.metadata

# revision identifiers, used by Alembic.
revision = '0a071415ddaf'
down_revision = '33f037391660'
branch_labels = None
depends_on = None

# The 14 tenant tables that existed before this migration, currently living in `public`.
EXISTING_TENANT_TABLES = [
    "checkout_sessions",
    "transactions",
    "products",
    "prices",
    "subscriptions",
    "saved_payment_methods",
    "invoices",
    "payment_links",
    "refunds",
    "webhook_endpoints",
    "webhook_logs",
    "settlements",
    "settlement_items",
    "api_keys",
]


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("CREATE SCHEMA IF NOT EXISTS sandbox"))
    bind.execute(sa.text("CREATE SCHEMA IF NOT EXISTS production"))

    # Metadata-only relocation: no rows are touched, no FKs are dropped/recreated.
    for table_name in EXISTING_TENANT_TABLES:
        bind.execute(sa.text(f'ALTER TABLE public."{table_name}" SET SCHEMA sandbox'))

    all_tenant_tables = [t for t in Base.metadata.sorted_tables if t.schema == TENANT_SCHEMA]
    new_tenant_tables = [t for t in all_tenant_tables if t.name not in EXISTING_TENANT_TABLES]

    # `production`: starts completely empty, so every tenant table is created
    # fresh. `checkfirst=True` matters here at the *type* level, not just the
    # table level: several enum types (e.g. `api_key_mode`) were already
    # created by pre-Phase-1 migrations and must not be recreated.
    bind.execution_options(schema_translate_map={TENANT_SCHEMA: "production"})
    Base.metadata.create_all(bind=bind, tables=all_tenant_tables, checkfirst=True)

    # `sandbox`: only pass the 9 brand-new tables here — the 14 existing ones
    # already landed via ALTER above and must not be passed to create_all at
    # all (checkfirst's table-existence check interacting with
    # `schema_translate_map` was unreliable in testing for tables that already
    # exist under the translated schema). Their new enum types were already
    # created in the production pass above, so checkfirst correctly skips them.
    bind.execution_options(schema_translate_map={TENANT_SCHEMA: "sandbox"})
    Base.metadata.create_all(bind=bind, tables=new_tenant_tables, checkfirst=True)

    # Reset the connection's default options so nothing downstream in this
    # migration run (or the next one) inherits a stale translate map.
    bind.execution_options(schema_translate_map={})

    # The pre-existing tables that gained new columns in this same phase only
    # got moved (ALTER ... SET SCHEMA) into sandbox, not recreated, so those
    # columns are missing there. Add each one explicitly, checked against the
    # real schema name so this step is itself safe to re-run.
    inspector = sa.inspect(bind)

    def _add_column_if_missing(table_name: str, column: sa.Column, fk_column: str, fk_target_table: str) -> None:
        existing = {c["name"] for c in inspector.get_columns(table_name, schema="sandbox")}
        if column.name in existing:
            return
        op.add_column(table_name, column, schema="sandbox")
        op.create_foreign_key(
            f"{table_name}_{fk_column}_fkey",
            table_name,
            fk_target_table,
            [fk_column],
            ["id"],
            source_schema="sandbox",
            referent_schema="sandbox",
            ondelete="SET NULL",
        )

    for table_name in ("checkout_sessions", "invoices", "saved_payment_methods"):
        _add_column_if_missing(table_name, sa.Column("customer_id", sa.UUID(), nullable=True), "customer_id", "customers")

    _add_column_if_missing("webhook_logs", sa.Column("event_id", sa.UUID(), nullable=True), "event_id", "events")


def downgrade() -> None:
    bind = op.get_bind()

    new_table_names = {
        t.name for t in Base.metadata.sorted_tables if t.schema == TENANT_SCHEMA
    } - set(EXISTING_TENANT_TABLES)

    for table_name in new_table_names:
        bind.execute(sa.text(f'DROP TABLE IF EXISTS sandbox."{table_name}" CASCADE'))

    bind.execute(sa.text("DROP SCHEMA IF EXISTS production CASCADE"))

    for table_name in EXISTING_TENANT_TABLES:
        bind.execute(sa.text(f'ALTER TABLE sandbox."{table_name}" SET SCHEMA public'))

    bind.execute(sa.text("DROP SCHEMA IF EXISTS sandbox CASCADE"))
