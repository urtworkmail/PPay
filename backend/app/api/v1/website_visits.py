"""Marketing-site visitor tracking.

A visit is recorded by an unauthenticated beacon fired from
`website/shared.js` on every page load of the public marketing site
(ppay.silicatelabs.site) — separate from, and not to be confused with, the
merchant dashboard's own per-session IP/location tracking on `Session` (see
`services/geoip.py`, `api/v1/auth.py`).

Write side is public by necessity (a page load has no credential to attach
to). Read side is platform-admin-only — visitor IP/location is operational
data for the internal review team, never merchant- or public-facing.
"""

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.platform_admin import get_current_platform_admin
from app.core.db import get_db
from app.models.platform_admin import PlatformAdmin
from app.models.website_visit import WebsiteVisit
from app.schemas.website_visit import TrackVisitRequest, WebsiteVisitResponse
from app.services.geoip import resolve_location

router = APIRouter(prefix="/public", tags=["public"])
admin_router = APIRouter(prefix="/platform-admin/website-visits", tags=["platform-admin"])


@router.post("/track-visit", status_code=status.HTTP_202_ACCEPTED)
async def track_visit(
    payload: TrackVisitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    ip = request.client.host if request.client else None
    location = await resolve_location(ip)

    visit = WebsiteVisit(
        path=payload.path,
        referrer=payload.referrer,
        ip_address=ip,
        city=location["city"],
        region=location["region"],
        country=location["country"],
        user_agent=request.headers.get("user-agent"),
    )
    db.add(visit)
    await db.commit()
    return {"ok": True}


@admin_router.get("", response_model=list[WebsiteVisitResponse])
async def list_website_visits(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> list[WebsiteVisit]:
    result = await db.execute(
        select(WebsiteVisit).order_by(WebsiteVisit.created_at.desc()).offset(offset).limit(limit)
    )
    return list(result.scalars().all())
