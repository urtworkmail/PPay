from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.services.settlement_engine import run_settlement_batch_job
from app.services.webhook_dispatcher import retry_pending_webhooks

settings = get_settings()
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(retry_pending_webhooks, "interval", seconds=15, id="webhook_retry")
    scheduler.add_job(run_settlement_batch_job, "cron", hour=0, minute=5, id="nightly_settlement")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="PPay API", version="0.1.0", lifespan=lifespan)

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
