import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, require_role
from app.core.db import get_db
from app.core.security import generate_webhook_secret
from app.models.merchant import Merchant
from app.models.user import User, UserRole
from app.models.webhook import WebhookEndpoint, WebhookLog
from app.schemas.transaction import WebhookEndpointCreateRequest, WebhookEndpointResponse, WebhookLogResponse

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/endpoints", response_model=WebhookEndpointResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook_endpoint(
    payload: WebhookEndpointCreateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> WebhookEndpoint:
    endpoint = WebhookEndpoint(
        merchant_id=merchant.id,
        url=payload.url,
        secret=generate_webhook_secret(),
        events=payload.events,
    )
    db.add(endpoint)
    await db.commit()
    await db.refresh(endpoint)
    return endpoint


@router.get("/endpoints", response_model=list[WebhookEndpointResponse])
async def list_webhook_endpoints(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[WebhookEndpointResponse]:
    result = await db.execute(select(WebhookEndpoint).where(WebhookEndpoint.merchant_id == merchant.id))
    endpoints = result.scalars().all()
    # never re-expose the signing secret after creation
    return [
        WebhookEndpointResponse(id=e.id, url=e.url, events=e.events, is_active=e.is_active, secret=None)
        for e in endpoints
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
    await db.delete(endpoint)
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
