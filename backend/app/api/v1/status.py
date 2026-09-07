"""Platform status: a public read-only projection, plus super-admin management.

The public endpoint is unauthenticated by design — a status page is only useful
if it works when everything else doesn't — but it exposes strictly the
capability names, their current state, and outage windows. The probed path, the
HTTP method, the expected code, and the raw error text stay in the super-admin
projection, so the page can't be mined for a map of the API.

Nothing here is merchant-configurable: there is no merchant-authenticated route
that writes to these tables. Only a `PlatformAdmin` token can create, edit,
pause, or delete a check, or trigger an immediate re-probe.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.platform_admin import get_current_platform_admin
from app.core.db import get_db
from app.models.platform_admin import PlatformAdmin
from app.models.service_status import ServiceStatus, ServiceStatusCheck, ServiceStatusIncident
from app.schemas.status import (
    AdminServiceStatus,
    PublicIncident,
    PublicServiceStatus,
    PublicStatusResponse,
    ServiceCheckCreateRequest,
    ServiceCheckUpdateRequest,
)
from app.services.status_monitor import run_status_checks_job, seed_default_checks

router = APIRouter(prefix="/status", tags=["status"])
admin_router = APIRouter(prefix="/platform-admin/status", tags=["platform-admin"])

_UPTIME_WINDOW_DAYS = 30


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _overall(statuses: list[str]) -> str:
    if not statuses:
        return ServiceStatus.UNKNOWN
    if any(s == ServiceStatus.DOWN for s in statuses):
        return ServiceStatus.DOWN
    if any(s == ServiceStatus.DEGRADED for s in statuses):
        return ServiceStatus.DEGRADED
    if any(s == ServiceStatus.MAINTENANCE for s in statuses):
        return ServiceStatus.MAINTENANCE
    if all(s == ServiceStatus.OPERATIONAL for s in statuses):
        return ServiceStatus.OPERATIONAL
    return ServiceStatus.UNKNOWN


@router.get("", response_model=PublicStatusResponse)
async def public_status(db: AsyncSession = Depends(get_db)) -> PublicStatusResponse:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=_UPTIME_WINDOW_DAYS)

    checks = list(
        (
            await db.execute(
                select(ServiceStatusCheck)
                .where(ServiceStatusCheck.enabled.is_(True))
                .order_by(ServiceStatusCheck.sort_order, ServiceStatusCheck.display_name)
            )
        )
        .scalars()
        .all()
    )
    by_id = {check.id: check for check in checks}

    incidents = list(
        (
            await db.execute(
                select(ServiceStatusIncident)
                .where(ServiceStatusIncident.started_at >= window_start)
                .order_by(ServiceStatusIncident.started_at.desc())
            )
        )
        .scalars()
        .all()
    )

    # Downtime per check across the window, for the uptime figure.
    downtime_seconds: dict[uuid.UUID, float] = {}
    for incident in incidents:
        started = max(_aware(incident.started_at), window_start)
        ended = _aware(incident.resolved_at) or now
        downtime_seconds[incident.check_id] = downtime_seconds.get(incident.check_id, 0.0) + max(
            0.0, (ended - started).total_seconds()
        )

    window_seconds = _UPTIME_WINDOW_DAYS * 24 * 3600
    services = [
        PublicServiceStatus(
            key=check.key,
            name=check.display_name,
            description=check.description,
            category=check.category,
            status=check.status,
            is_critical=check.is_critical,
            last_checked_at=_aware(check.last_checked_at),
            uptime_30d=round(max(0.0, 100.0 * (1 - downtime_seconds.get(check.id, 0.0) / window_seconds)), 3),
        )
        for check in checks
    ]

    return PublicStatusResponse(
        overall=_overall([s.status for s in services if s.is_critical] or [s.status for s in services]),
        updated_at=now,
        services=services,
        incidents=[
            PublicIncident(
                service=by_id[incident.check_id].display_name,
                status=incident.status,
                started_at=_aware(incident.started_at),
                resolved_at=_aware(incident.resolved_at),
            )
            for incident in incidents[:20]
            if incident.check_id in by_id
        ],
    )


# --- Super-admin management -------------------------------------------------


@admin_router.get("/checks", response_model=list[AdminServiceStatus])
async def admin_list_checks(
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> list[ServiceStatusCheck]:
    result = await db.execute(
        select(ServiceStatusCheck).order_by(ServiceStatusCheck.sort_order, ServiceStatusCheck.display_name)
    )
    return list(result.scalars().all())


@admin_router.post("/checks", response_model=AdminServiceStatus, status_code=status.HTTP_201_CREATED)
async def admin_create_check(
    payload: ServiceCheckCreateRequest,
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> ServiceStatusCheck:
    existing = await db.execute(select(ServiceStatusCheck).where(ServiceStatusCheck.key == payload.key))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A check with that key already exists")

    check = ServiceStatusCheck(**payload.model_dump())
    db.add(check)
    await db.commit()
    await db.refresh(check)
    return check


@admin_router.patch("/checks/{check_id}", response_model=AdminServiceStatus)
async def admin_update_check(
    check_id: uuid.UUID,
    payload: ServiceCheckUpdateRequest,
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> ServiceStatusCheck:
    check = await db.get(ServiceStatusCheck, check_id)
    if check is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(check, field, value)
    await db.commit()
    await db.refresh(check)
    return check


@admin_router.post("/checks/seed", response_model=dict)
async def admin_seed_checks(
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    added = await seed_default_checks(db)
    return {"added": added}


@admin_router.post("/run", response_model=dict)
async def admin_run_now(
    _: PlatformAdmin = Depends(get_current_platform_admin),
) -> dict:
    """Probe everything immediately instead of waiting for the next tick."""
    await run_status_checks_job()
    return {"ok": True}


@admin_router.get("/incidents", response_model=list[dict])
async def admin_list_incidents(
    limit: int = Query(default=50, ge=1, le=200),
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    result = await db.execute(
        select(ServiceStatusIncident, ServiceStatusCheck)
        .join(ServiceStatusCheck, ServiceStatusCheck.id == ServiceStatusIncident.check_id)
        .order_by(ServiceStatusIncident.started_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": str(incident.id),
            "service": check.display_name,
            "key": check.key,
            "status": incident.status,
            "started_at": _aware(incident.started_at),
            "resolved_at": _aware(incident.resolved_at),
            "error": incident.error,
            "alerts_sent": incident.alerts_sent,
        }
        for incident, check in result.all()
    ]
