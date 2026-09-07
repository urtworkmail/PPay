from collections.abc import AsyncGenerator
from enum import StrEnum

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

# All ORM tables are declared against this placeholder schema name (see
# `TENANT_SCHEMA` used in each model's __table_args__). At the physical
# Postgres level there is no schema literally called "tenant" — every
# connection has its logical "tenant" schema swapped for the real one
# (`sandbox` or `production`) via SQLAlchemy's `schema_translate_map` before
# a single query runs. This is what makes cross-mode data leakage a
# structurally impossible bug class instead of a discipline problem: there
# is no shared table for a missed `WHERE is_sandbox = false` to forget.
TENANT_SCHEMA = "tenant"


class Mode(StrEnum):
    SANDBOX = "sandbox"
    LIVE = "live"


SCHEMA_BY_MODE: dict[Mode, str] = {
    Mode.SANDBOX: "sandbox",
    Mode.LIVE: "production",
}

engine = create_async_engine(settings.database_url, pool_pre_ping=True)


class Base(DeclarativeBase):
    pass


def _engine_for_mode(mode: Mode) -> AsyncEngine:
    return engine.execution_options(schema_translate_map={TENANT_SCHEMA: SCHEMA_BY_MODE[mode]})


# One session factory per mode, built once at import time. `engine.execution_options(...)`
# returns a cheap proxy (no new pool/connection), so this is not the same cost as a
# second engine — it just rewrites `tenant.*` to the right physical schema per request.
_SESSION_FACTORIES: dict[Mode, async_sessionmaker[AsyncSession]] = {
    mode: async_sessionmaker(_engine_for_mode(mode), expire_on_commit=False, class_=AsyncSession) for mode in Mode
}

# Back-compat default used by code paths that don't yet resolve a request mode
# (e.g. Alembic, scripts). Defaults to sandbox — never silently touches production.
AsyncSessionLocal = _SESSION_FACTORIES[Mode.SANDBOX]


def session_factory_for_mode(mode: Mode) -> async_sessionmaker[AsyncSession]:
    return _SESSION_FACTORIES[mode]


def stamp_mode(session: AsyncSession, mode: Mode) -> None:
    """Records which mode a session was opened for, in `Session.info` (the
    ORM's built-in slot for exactly this kind of per-session metadata).

    The schema-translate trick above means a query never has to filter by
    mode, but some things — an `Event`'s `livemode` flag, for one — need to
    record which mode they happened in rather than just query correctly
    within it. Reading `mode` back out of the schema a session is bound to
    would work but is indirect; stamping it once at session creation is
    simpler and cannot drift from the schema it's actually using.
    """
    session.sync_session.info["mode"] = mode


def livemode_of(session: AsyncSession) -> bool:
    """Whether `session` was opened against the live (production) schema."""
    return session.sync_session.info.get("mode") == Mode.LIVE


def resolve_request_mode(request: Request) -> Mode:
    """Determine sandbox vs. live for this request, once, from information
    that's available with zero DB lookups — the whole point being that a
    connection is opened against the correct schema from the first query,
    never re-checked mid-request.

    - `sk_sandbox_...` / `sk_live_...` API keys (see `core.security.generate_api_key`
      and `ApiKeyMode`): the prefix *is* the mode.
    - Dashboard JWT sessions carry no key, so the frontend's Test/Live toggle
      (spec §13.3) sends an explicit `X-Mode: live` header; anything else
      (missing header, unrecognized value) safely defaults to sandbox.
    """
    authorization = request.headers.get("authorization", "")
    token = authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""
    if token.startswith("sk_live_"):
        return Mode.LIVE
    if token.startswith("sk_sandbox_"):
        return Mode.SANDBOX

    if request.headers.get("x-mode", "").strip().lower() == "live":
        return Mode.LIVE
    return Mode.SANDBOX


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Request-scoped DB dependency — every route that depends on this gets a
    session already bound to the right schema for the caller's mode.

    Routes reached by an unauthenticated buyer via a mode-prefixed public
    reference (checkout sessions, payment links, invoices — see
    core/public_ref.py) cannot rely on this: there is no API key or dashboard
    header to read mode from. Those handlers decode their path param and open
    a session via `session_factory_for_mode(...)` directly instead of
    depending on this function.
    """
    mode = resolve_request_mode(request)
    async with session_factory_for_mode(mode)() as session:
        stamp_mode(session, mode)
        yield session
