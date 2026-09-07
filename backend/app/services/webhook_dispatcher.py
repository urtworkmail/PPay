import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import Mode, livemode_of, session_factory_for_mode, stamp_mode
from app.models.event import Event
from app.models.webhook import WebhookDeliveryStatus, WebhookEndpoint, WebhookLog

MAX_ATTEMPTS = 5
RETRY_BACKOFF_SECONDS = [10, 60, 300, 1800, 7200]


def sign_payload(secret: str, payload_bytes: bytes, timestamp: int) -> str:
    signed_content = f"{timestamp}.{payload_bytes.decode()}"
    signature = hmac.new(secret.encode(), signed_content.encode(), hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={signature}"


async def enqueue_webhook_event(
    db: AsyncSession, merchant_id, event_type: str, data: dict, transaction_id=None
) -> list[WebhookLog]:
    """Records the event, then fans it out to every subscribed endpoint.

    The `Event` row is written unconditionally — it is the immutable record
    that the thing happened, and it has to exist whether or not anyone was
    listening. Only the delivery attempts (`WebhookLog`) depend on having a
    configured endpoint. Writing the event only when an endpoint existed
    meant a merchant with no webhooks configured had no event history at
    all, which is what the dashboard's Events view reads from.
    """
    payload = {"type": event_type, "data": data}

    event = Event(
        merchant_id=merchant_id,
        type=event_type,
        livemode=livemode_of(db),
        payload=payload,
    )
    db.add(event)
    await db.flush()  # assigns event.id for the delivery rows to reference

    result = await db.execute(
        select(WebhookEndpoint).where(
            WebhookEndpoint.merchant_id == merchant_id,
            WebhookEndpoint.is_active.is_(True),
        )
    )
    endpoints = result.scalars().all()

    logs = []
    for endpoint in endpoints:
        if endpoint.events and event_type not in endpoint.events:
            continue
        log = WebhookLog(
            endpoint_id=endpoint.id,
            event_id=event.id,
            transaction_id=transaction_id,
            event_type=event_type,
            payload=payload,
            status=WebhookDeliveryStatus.PENDING,
            attempt_count=0,
        )
        db.add(log)
        logs.append(log)

    if logs:
        await db.flush()
    return logs


async def deliver_webhook(db: AsyncSession, log: WebhookLog, endpoint: WebhookEndpoint) -> None:
    payload_bytes = json.dumps(log.payload).encode()
    timestamp = int(time.time())
    signature = sign_payload(endpoint.secret, payload_bytes, timestamp)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                endpoint.url,
                content=payload_bytes,
                headers={
                    "Content-Type": "application/json",
                    "PPay-Signature": signature,
                },
            )
        log.response_status = response.status_code
        log.attempt_count += 1
        if 200 <= response.status_code < 300:
            log.status = WebhookDeliveryStatus.DELIVERED
            log.next_retry_at = None
        else:
            _schedule_retry_or_fail(log)
    except httpx.HTTPError:
        log.response_status = None
        log.attempt_count += 1
        _schedule_retry_or_fail(log)


async def retry_pending_webhooks() -> None:
    """APScheduler job: delivers any webhook logs whose retry backoff has
    elapsed, once per mode (sandbox and production webhook endpoints/logs are
    entirely separate — see core/db.py)."""
    now = datetime.now(timezone.utc)
    for mode in Mode:
        async with session_factory_for_mode(mode)() as db:
            stamp_mode(db, mode)
            result = await db.execute(
                select(WebhookLog).where(
                    WebhookLog.status == WebhookDeliveryStatus.PENDING,
                    WebhookLog.next_retry_at.is_not(None),
                    WebhookLog.next_retry_at <= now,
                )
            )
            logs = result.scalars().all()
            for log in logs:
                endpoint = await db.get(WebhookEndpoint, log.endpoint_id)
                if endpoint is not None:
                    await deliver_webhook(db, log, endpoint)
            if logs:
                await db.commit()


def _schedule_retry_or_fail(log: WebhookLog) -> None:
    if log.attempt_count >= MAX_ATTEMPTS:
        log.status = WebhookDeliveryStatus.FAILED
        log.next_retry_at = None
        return
    backoff = RETRY_BACKOFF_SECONDS[min(log.attempt_count - 1, len(RETRY_BACKOFF_SECONDS) - 1)]
    log.status = WebhookDeliveryStatus.PENDING
    log.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=backoff)
