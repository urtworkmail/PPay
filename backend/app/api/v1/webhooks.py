import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, require_role
from app.core.db import get_db
from app.core.security import generate_webhook_secret
from app.models.checkout_session import CheckoutSession
from app.models.merchant import Merchant
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.models.webhook import WebhookDeliveryStatus, WebhookEndpoint, WebhookLog
from app.schemas.transaction import (
    EventLogResponse,
    WebhookEndpointCreateRequest,
    WebhookEndpointResponse,
    WebhookLogResponse,
)
from app.services.audit_log import record_audit_event
from app.services.webhook_dispatcher import deliver_webhook

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# The complete, real set of events this app ever emits (grep-verified against every
# enqueue_webhook_event call site) — kept as the single source of truth for endpoint
# creation validation, the /event-types endpoint, and what the docs site describes.
EVENT_CATALOG = {
    "payment_intent.succeeded": "A checkout session was paid successfully.",
    "payment_intent.failed": "A checkout session payment attempt failed.",
    "charge.refunded": "A succeeded transaction was refunded.",
    "invoice.paid": "A subscription billing-cycle invoice was paid (first charge or renewal).",
    "invoice.payment_failed": "A subscription billing-cycle charge failed (feeds dunning).",
}


@router.get("/event-types")
async def list_event_types() -> list[dict]:
    return [{"type": t, "description": d} for t, d in EVENT_CATALOG.items()]


@router.post("/endpoints", response_model=WebhookEndpointResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook_endpoint(
    payload: WebhookEndpointCreateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> WebhookEndpoint:
    unknown = [e for e in payload.events if e not in EVENT_CATALOG]
    if unknown:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown event type(s): {', '.join(unknown)}")
    if not payload.events:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select at least one event")

    endpoint = WebhookEndpoint(
        merchant_id=merchant.id,
        url=payload.url,
        secret=generate_webhook_secret(),
        events=payload.events,
    )
    db.add(endpoint)
    await db.flush()
    await record_audit_event(
        db,
        merchant_id=merchant.id,
        action="create",
        resource_type="WebhookEndpoint",
        resource_id=endpoint.id,
        changes={"url": endpoint.url, "events": endpoint.events},
    )
    await db.commit()
    await db.refresh(endpoint)
    return endpoint


@router.get("/endpoints", response_model=list[WebhookEndpointResponse])
async def list_webhook_endpoints(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[WebhookEndpointResponse]:
    result = await db.execute(select(WebhookEndpoint).where(WebhookEndpoint.merchant_id == merchant.id))
    endpoints = result.scalars().all()

    last_delivery_result = await db.execute(
        select(WebhookLog.endpoint_id, func.max(WebhookLog.created_at))
        .join(WebhookEndpoint, WebhookLog.endpoint_id == WebhookEndpoint.id)
        .where(WebhookEndpoint.merchant_id == merchant.id)
        .group_by(WebhookLog.endpoint_id)
    )
    last_delivery = dict(last_delivery_result.all())

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    failures_result = await db.execute(
        select(WebhookLog.endpoint_id, func.count(WebhookLog.id))
        .join(WebhookEndpoint, WebhookLog.endpoint_id == WebhookEndpoint.id)
        .where(
            WebhookEndpoint.merchant_id == merchant.id,
            WebhookLog.status == WebhookDeliveryStatus.FAILED,
            WebhookLog.created_at >= since,
        )
        .group_by(WebhookLog.endpoint_id)
    )
    failures = dict(failures_result.all())

    # never re-expose the signing secret after creation
    return [
        WebhookEndpointResponse(
            id=e.id,
            url=e.url,
            events=e.events,
            is_active=e.is_active,
            secret=None,
            last_delivery_at=last_delivery.get(e.id),
            failure_count_24h=failures.get(e.id, 0),
        )
        for e in endpoints
    ]


@router.get("/endpoints/{endpoint_id}", response_model=WebhookEndpointResponse)
async def get_webhook_endpoint(
    endpoint_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> WebhookEndpointResponse:
    result = await db.execute(
        select(WebhookEndpoint).where(WebhookEndpoint.id == endpoint_id, WebhookEndpoint.merchant_id == merchant.id)
    )
    endpoint = result.scalar_one_or_none()
    if endpoint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook endpoint not found")
    return WebhookEndpointResponse(id=endpoint.id, url=endpoint.url, events=endpoint.events, is_active=endpoint.is_active, secret=None)


async def _logs_with_customer_email(db: AsyncSession, query) -> list[WebhookLogResponse]:
    """Left-joins each log's transaction -> checkout session to surface who the event was about."""
    enriched = query.add_columns(CheckoutSession.customer_email).outerjoin(
        Transaction, WebhookLog.transaction_id == Transaction.id
    ).outerjoin(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
    result = await db.execute(enriched)
    return [
        WebhookLogResponse(**WebhookLogResponse.model_validate(log).model_dump() | {"customer_email": email})
        for log, email in result.all()
    ]


@router.get("/endpoints/{endpoint_id}/logs", response_model=list[WebhookLogResponse])
async def get_webhook_endpoint_logs(
    endpoint_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> list[WebhookLogResponse]:
    endpoint = await db.get(WebhookEndpoint, endpoint_id)
    if endpoint is None or endpoint.merchant_id != merchant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook endpoint not found")

    query = select(WebhookLog).where(WebhookLog.endpoint_id == endpoint_id).order_by(WebhookLog.created_at.desc())
    return await _logs_with_customer_email(db, query)


@router.post("/logs/{log_id}/resend", response_model=WebhookLogResponse)
async def resend_webhook_log(
    log_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> WebhookLog:
    result = await db.execute(
        select(WebhookLog, WebhookEndpoint)
        .join(WebhookEndpoint, WebhookLog.endpoint_id == WebhookEndpoint.id)
        .where(WebhookLog.id == log_id, WebhookEndpoint.merchant_id == merchant.id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook log not found")
    log, endpoint = row

    await deliver_webhook(db, log, endpoint)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/events", response_model=list[EventLogResponse])
async def list_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> list[EventLogResponse]:
    result = await db.execute(
        select(WebhookLog, WebhookEndpoint.url, CheckoutSession.customer_email)
        .join(WebhookEndpoint, WebhookLog.endpoint_id == WebhookEndpoint.id)
        .outerjoin(Transaction, WebhookLog.transaction_id == Transaction.id)
        .outerjoin(CheckoutSession, Transaction.checkout_session_id == CheckoutSession.id)
        .where(WebhookEndpoint.merchant_id == merchant.id)
        .order_by(WebhookLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [
        EventLogResponse(
            **(WebhookLogResponse.model_validate(log).model_dump() | {"customer_email": email}),
            endpoint_url=url,
        )
        for log, url, email in result.all()
    ]


@router.delete("/endpoints/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook_endpoint(
    endpoint_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(WebhookEndpoint).where(WebhookEndpoint.id == endpoint_id, WebhookEndpoint.merchant_id == merchant.id)
    )
    endpoint = result.scalar_one_or_none()
    if endpoint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook endpoint not found")
    # No account data is ever hard-deleted — deactivating stops future
    # deliveries (enqueue_webhook_event only selects is_active endpoints)
    # while preserving the endpoint's delivery history.
    endpoint.is_active = False
    await record_audit_event(
        db, merchant_id=merchant.id, action="deactivate", resource_type="WebhookEndpoint", resource_id=endpoint.id
    )
    await db.commit()


@router.get("/logs/{transaction_id}", response_model=list[WebhookLogResponse])
async def get_webhook_logs_for_transaction(
    transaction_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> list[WebhookLog]:
    result = await db.execute(
        select(WebhookLog)
        .join(WebhookEndpoint, WebhookLog.endpoint_id == WebhookEndpoint.id)
        .where(WebhookLog.transaction_id == transaction_id, WebhookEndpoint.merchant_id == merchant.id)
        .order_by(WebhookLog.created_at.desc())
    )
    return list(result.scalars().all())
