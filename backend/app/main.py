from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.middleware import RateLimitMiddleware
from app.core.rate_limit import sweep_idle_counters
from app.core.secrets_check import enforce_secrets_check
from app.services.settlement_engine import process_due_payouts_job, run_settlement_batch_job
from app.services.status_monitor import run_status_checks_job, seed_default_checks_job
from app.services.subscription_engine import run_subscription_billing_job
from app.services.webhook_dispatcher import retry_pending_webhooks

settings = get_settings()
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    enforce_secrets_check(settings)
    scheduler.add_job(retry_pending_webhooks, "interval", seconds=15, id="webhook_retry")
    scheduler.add_job(run_settlement_batch_job, "cron", hour=0, minute=5, id="nightly_settlement")
    scheduler.add_job(process_due_payouts_job, "interval", hours=1, id="process_due_payouts")
    scheduler.add_job(run_subscription_billing_job, "interval", hours=1, id="subscription_billing")
    # Ticks at the fastest cadence the monitor ever needs; each check decides
    # whether it is due (60s healthy / 10s failing), so one timer serves both.
    scheduler.add_job(
        run_status_checks_job,
        "interval",
        seconds=settings.status_down_recheck_seconds,
        id="status_monitor",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(sweep_idle_counters, "interval", minutes=10, id="rate_limit_sweep")
    scheduler.start()
    await seed_default_checks_job()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="PPay API", version="0.1.0", lifespan=lifespan)

# Order matters: Starlette middleware wraps in reverse of add order, so the
# last one added is outermost. CORSMiddleware is added last so it wraps
# RateLimitMiddleware and still attaches CORS headers to a 429 — otherwise a
# rate-limited browser request would fail as an opaque CORS error instead of
# a readable 429 the frontend can show.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "mode": "sandbox"}


@app.get("/health/db")
async def health_db() -> dict:
    """Deep health check — actually reaches Postgres.

    `/health` only proves the process is answering; the status monitor needs
    one probe that fails when the database is unreachable, which is the
    failure mode that takes every other capability down with it.
    """
    from sqlalchemy import text

    from app.core.db import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - reported as a status, not raised
        return JSONResponse(status_code=503, content={"status": "unavailable", "component": "database"})
    return {"status": "ok", "component": "database"}

