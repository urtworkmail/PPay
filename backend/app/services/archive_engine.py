"""Moves one merchant's live-mode data out of the main database into the
separate archive database — the one sanctioned way data ever leaves the live
DB (see app/models/audit_log.py and the no-delete policy notes throughout
this codebase). Only reachable via `api/v1/platform_admin.py`, which gates it
behind PlatformAdmin login (mandatory TOTP) *and* a separate archive
passphrase — a step-up confirmation so a hijacked login session alone can
never trigger this.

Failure-mode note: archiving and deleting a merchant's ~20 tables can't be one
atomic transaction across two separate physical databases (no two-phase
commit here). Each table is archived (inserted + committed in the archive DB)
and only then deleted (+ committed) from production, one table at a time, in
FK-safe order. If the process is interrupted partway, the failure mode is
"some tables archived-and-removed, the rest untouched" — never "removed but
not archived". Re-running after a partial failure is safe for tables not yet
reached; tables already fully archived-and-removed are simply no-ops (their
rows no longer match the merchant filter in production).
"""

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.archive_db import _MIRRORED_GLOBAL_TABLES, archive_engine
from app.core.db import TENANT_SCHEMA, Base, engine

# Load every model so Base.metadata is fully populated before we filter it.
from app.models import *  # noqa: F401,F403

_TENANT_TABLES = [t for t in Base.metadata.sorted_tables if t.schema == TENANT_SCHEMA]
_GLOBAL_TABLES_BY_NAME = {t.name: t for t in Base.metadata.sorted_tables if t.schema is None}

# Tables with no direct `merchant_id` column: resolved via a join to their
# merchant-scoped parent instead.
_INDIRECT_MERCHANT_RESOLUTION: dict[str, tuple[str, str]] = {
    "charges": ("payment_intent_id", "payment_intents"),
    "discounts": ("coupon_id", "coupons"),
    "reconciliation_records": ("payment_intent_id", "payment_intents"),
    "settlement_items": ("settlement_id", "settlements"),
    "webhook_logs": ("endpoint_id", "webhook_endpoints"),
}


def _merchant_condition(table: sa.Table):
    if "merchant_id" in table.columns:
        return table.c.merchant_id == sa.bindparam("merchant_id")
    if table.name in _INDIRECT_MERCHANT_RESOLUTION:
        fk_col, parent_name = _INDIRECT_MERCHANT_RESOLUTION[table.name]
        parent = next(t for t in _TENANT_TABLES if t.name == parent_name)
        subquery = sa.select(parent.c.id).where(parent.c.merchant_id == sa.bindparam("merchant_id"))
        return table.columns[fk_col].in_(subquery)
    return None


async def _mirror_merchant_identity(merchant_id: uuid.UUID) -> None:
    """Copies (never deletes) the merchant's own row plus its team `users`
    from the main DB's public schema into the archive DB's public schema.
    This is what lets the tenant tables' `merchant_id`/`user_id` foreign keys
    resolve inside a standalone archive database — the merchant's identity
    keeps existing live too; only its bulky transactional history moves.
    `ON CONFLICT DO NOTHING` makes this safe to repeat on a retried archive.
    """
    merchants_table = _GLOBAL_TABLES_BY_NAME["merchants"]
    users_table = _GLOBAL_TABLES_BY_NAME["users"]

    async with engine.connect() as main_conn:
        merchant_rows = [
            dict(row._mapping)
            for row in await main_conn.execute(sa.select(merchants_table).where(merchants_table.c.id == merchant_id))
        ]
        user_rows = [
            dict(row._mapping)
            for row in await main_conn.execute(sa.select(users_table).where(users_table.c.merchant_id == merchant_id))
        ]

    async with archive_engine.begin() as archive_conn:
        if merchant_rows:
            stmt = pg_insert(merchants_table).values(merchant_rows)
            await archive_conn.execute(stmt.on_conflict_do_nothing(index_elements=["id"]))
        if user_rows:
            stmt = pg_insert(users_table).values(user_rows)
            await archive_conn.execute(stmt.on_conflict_do_nothing(index_elements=["id"]))


async def archive_merchant_live_data(merchant_id: uuid.UUID) -> dict[str, int]:
    """Moves every `production`-schema row belonging to `merchant_id` into the
    archive database's `archive` schema, table by table, parents before
    children (`Base.metadata.sorted_tables` order). Returns a
    `{table_name: row_count}` summary of what was moved.
    """
    await _mirror_merchant_identity(merchant_id)

    production_engine = engine.execution_options(schema_translate_map={TENANT_SCHEMA: "production"})
    archive_target_engine = archive_engine.execution_options(schema_translate_map={TENANT_SCHEMA: "archive"})

    row_counts: dict[str, int] = {}
    params = {"merchant_id": merchant_id}

    async with production_engine.connect() as prod_conn:
        for table in _TENANT_TABLES:
            condition = _merchant_condition(table)
            if condition is None:
                continue

            result = await prod_conn.execute(sa.select(table).where(condition), params)
            rows = [dict(row._mapping) for row in result]
            row_counts[table.name] = len(rows)
            if not rows:
                continue

            async with archive_target_engine.begin() as archive_conn:
                await archive_conn.execute(sa.insert(table), rows)

            await prod_conn.execute(sa.delete(table).where(condition), params)
            await prod_conn.commit()

    return row_counts
