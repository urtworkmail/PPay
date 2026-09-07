"""Event log — the merchant-facing record of what happened on the account.

This is deliberately separate from `/webhooks`. A webhook is one *transport*
for an event; the event itself exists regardless of whether any endpoint was
subscribed. The old dashboard read delivery attempts (`WebhookLog`) and so
showed an empty history to any merchant who had never configured a webhook,
even though things had plainly happened on their account.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant
from app.core.db import get_db
from app.models.event import Event
from app.models.merchant import Merchant
from app.models.webhook import WebhookDeliveryStatus, WebhookEndpoint, WebhookLog
from app.schemas.event import (
    EventDeliveryAttempt,
    EventDetailResponse,
    EventListResponse,
    EventResponse,
)

router = APIRouter(prefix="/events", tags=["events"])


async def _delivery_counts(db: AsyncSession, event_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    """Per-event delivery tallies, fetched in one grouped query rather than
    one query per row."""
    if not event_ids:
        return {}
    result = await db.execute(
        select(WebhookLog.event_id, WebhookLog.status, func.count())
        .where(WebhookLog.event_id.in_(event_ids))
        .group_by(WebhookLog.event_id, WebhookLog.status)
    )
    counts: dict[uuid.UUID, dict] = {}
    for event_id, log_status, count in result.all():
        bucket = counts.setdefault(
            event_id, {"delivery_count": 0, "delivered_count": 0, "failed_count": 0, "pending_count": 0}
        )
        bucket["delivery_count"] += count
        if log_status == WebhookDeliveryStatus.DELIVERED:
            bucket["delivered_count"] += count
        elif log_status == WebhookDeliveryStatus.FAILED:
            bucket["failed_count"] += count
        else:
            bucket["pending_count"] += count
    return counts


@router.get("", response_model=EventListResponse)
async def list_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    event_type: str | None = Query(default=None, description="Exact event type to filter by."),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> EventListResponse:
    filters = [Event.merchant_id == merchant.id]
    if event_type:
        filters.append(Event.type == event_type)

    total = await db.scalar(select(func.count()).select_from(Event).where(*filters)) or 0

    result = await db.execute(
        select(Event)
        .where(*filters)
        .order_by(Event.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    events = result.scalars().all()
    counts = await _delivery_counts(db, [e.id for e in events])

    return EventListResponse(
        events=[
            EventResponse(
                id=e.id,
                type=e.type,
                livemode=e.livemode,
                created_at=e.created_at,
                **counts.get(e.id, {}),
            )
            for e in events
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{event_id}", response_model=EventDetailResponse)
async def get_event(
    event_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> EventDetailResponse:
    event = await db.scalar(select(Event).where(Event.id == event_id, Event.merchant_id == merchant.id))
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    result = await db.execute(
        select(WebhookLog, WebhookEndpoint.url)
        .join(WebhookEndpoint, WebhookLog.endpoint_id == WebhookEndpoint.id)
        .where(WebhookLog.event_id == event.id)
        .order_by(WebhookLog.created_at.desc())
    )
    rows = result.all()
    counts = (await _delivery_counts(db, [event.id])).get(event.id, {})

    return EventDetailResponse(
        id=event.id,
        type=event.type,
        livemode=event.livemode,
        created_at=event.created_at,
        payload=event.payload,
        deliveries=[
            EventDeliveryAttempt(
                id=log.id,
                endpoint_id=log.endpoint_id,
                endpoint_url=url,
                status=log.status,
                response_status=log.response_status,
                attempt_count=log.attempt_count,
                next_retry_at=log.next_retry_at,
                created_at=log.created_at,
            )
            for log, url in rows
        ],
        **counts,
    )
