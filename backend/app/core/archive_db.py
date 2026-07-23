"""Connection to the archive database — a fully separate Postgres
instance/database from the main app DB (see `Settings.archive_database_url`),
so that a compromised main-DB credential can never reach archived live data.

Only `app.services.archive_engine` should import this module. Tables here
mirror the tenant tables from the main schema (same `Base.metadata`, same
columns/FKs) under an `archive` schema token, translated the same way
sandbox/production are in `core/db.py` — one physical schema, `archive`, is
enough here since this database exists for exactly one purpose.
"""

from collections.abc import AsyncGenerator

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.db import TENANT_SCHEMA, Base

# Load every model so Base.metadata is fully populated before we filter it.
from app.models import *  # noqa: F401,F403

settings = get_settings()

archive_engine = create_async_engine(settings.archive_database_url, pool_pre_ping=True)
_archive_engine_scoped = archive_engine.execution_options(schema_translate_map={TENANT_SCHEMA: "archive"})
ArchiveSessionLocal = async_sessionmaker(_archive_engine_scoped, expire_on_commit=False, class_=AsyncSession)


async def get_archive_db() -> AsyncGenerator[AsyncSession, None]:
    async with ArchiveSessionLocal() as session:
        yield session


# Global identity tables mirrored into the archive DB too (per the "same
# schemas as the live one" requirement) — several tenant tables FK-reference
# `merchants`/`users`, which a standalone archive database otherwise wouldn't
# have at all. `platform_admins`/`archive_operations` are excluded: they're
# platform-level bookkeeping, not merchant data, and are never archived.
_MIRRORED_GLOBAL_TABLES = {"merchants", "users", "sessions", "live_access_requests"}


async def ensure_archive_schema() -> None:
    """Creates the `archive` schema (tenant tables) and the mirrored global
    identity tables (public schema) inside the archive DB if not already
    present. Called explicitly (from api/v1/platform_admin.py before each
    archive operation) rather than via Alembic — the archive DB is a mirror
    target, not a separately evolving system with its own migration history.
    """
    tenant_tables = [t for t in Base.metadata.sorted_tables if t.schema == TENANT_SCHEMA]
    global_tables = [
        t for t in Base.metadata.sorted_tables if t.schema is None and t.name in _MIRRORED_GLOBAL_TABLES
    ]

    async with archive_engine.begin() as conn:
        await conn.execute(sa.text("CREATE SCHEMA IF NOT EXISTS archive"))

        def _create_global(sync_conn):
            Base.metadata.create_all(bind=sync_conn, tables=global_tables, checkfirst=True)

        await conn.run_sync(_create_global)

        await conn.execution_options(schema_translate_map={TENANT_SCHEMA: "archive"})

        def _create_tenant(sync_conn):
            Base.metadata.create_all(bind=sync_conn, tables=tenant_tables, checkfirst=True)

        await conn.run_sync(_create_tenant)
