"""Platform status monitoring.

This is platform infrastructure, not a merchant feature: the checks live in the
global `public` schema, are seeded and edited only by the platform super admin,
and no merchant-facing endpoint can create, pause, or delete one. Merchants and
the public status page read a sanitised projection — capability names and
current state, never the probed paths or the raw error text.

Cadence, per the operational spec:

* healthy check  → probed every `status_check_interval_seconds` (60s);
* failing check  → probed every `status_down_recheck_seconds` (10s), until it
  recovers;
* alerting       → an email the moment a check goes down, then repeated at most
  every `status_alert_repeat_minutes` (10 min) for as long as it stays down
  (re-mailing on every 10s probe would be a self-inflicted mail flood), plus a
  recovery email when it comes back.

The scheduler ticks this job every 10 seconds; each check decides for itself
whether it is due, which is what lets healthy and failing checks run at
different cadences from one timer.
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.models.service_status import ServiceStatus, ServiceStatusCheck, ServiceStatusIncident
from app.services.email import send_email

logger = logging.getLogger(__name__)
settings = get_settings()


# The capability list the status page publishes. `target_path` is the internal
# probe target and is never rendered publicly — only `display_name`.
DEFAULT_CHECKS: list[dict] = [
    {
        "key": "api",
        "display_name": "Core API",
        "description": "The API that powers every integration and the dashboard.",
        "category": "Platform",
        "target_path": "/health",
        "sort_order": 10,
    },
    {
        "key": "database",
        "display_name": "Database",
        "description": "The datastore behind every balance, payment, and account record.",
        "category": "Platform",
        # The one probe that actually reaches Postgres — everything else is
        # rejected by auth before a query runs, so without this a database
        # outage would leave the board green.
        "target_path": "/health/db",
        "sort_order": 15,
    },
    {
        "key": "dashboard_auth",
        "display_name": "Merchant sign-in",
        "description": "Logging in to the dashboard and issuing session tokens.",
        "category": "Platform",
        "target_path": "/api/v1/auth/login",
        "method": "POST",
        # Probed with no body on purpose: a 422 proves the route and its
        # request validation are alive without submitting credentials or
        # generating failed-login noise. The database path behind sign-in is
        # covered by the `database` check above.
        "expected_status": 422,
        "sort_order": 20,
    },
    {
        "key": "hosted_checkout",
        "display_name": "Hosted checkout",
        "description": "The payment page buyers complete a purchase on.",
        "category": "Payments",
        "target_path": "/api/v1/checkout/sessions/status-monitor-probe",
        "expected_status": 404,
        "sort_order": 30,
    },
    {
        "key": "payment_links",
        "display_name": "Payment links",
        "description": "Shareable links that collect a payment without code.",
        "category": "Payments",
        "target_path": "/api/v1/payment-links",
        "expected_status": 401,
        "sort_order": 40,
    },
    {
        "key": "transactions",
        "display_name": "Payments & transactions",
        "description": "Recording, listing, and refunding payments.",
        "category": "Payments",
        "target_path": "/api/v1/transactions",
        "expected_status": 401,
        "sort_order": 50,
    },
    {
        "key": "invoicing",
        "display_name": "Invoicing",
        "description": "Issuing invoices and collecting payment against them.",
        "category": "Billing",
        "target_path": "/api/v1/invoices",
        "expected_status": 401,
        "sort_order": 60,
    },
    {
        "key": "subscriptions",
        "display_name": "Subscriptions",
        "description": "Recurring billing cycles and saved payment methods.",
        "category": "Billing",
        "target_path": "/api/v1/subscriptions",
        "expected_status": 401,
        "sort_order": 70,
    },
    {
        "key": "webhooks",
        "display_name": "Webhooks",
        "description": "Event delivery to merchant endpoints.",
        "category": "Developer",
        "target_path": "/api/v1/webhooks/endpoints",
        "expected_status": 401,
        "sort_order": 80,
    },
    {
        "key": "payouts",
        "display_name": "Payouts & settlements",
        "description": "Batching settled funds and scheduling payouts.",
        "category": "Money movement",
        "target_path": "/api/v1/settlements",
        "expected_status": 401,
        "sort_order": 90,
    },
    {
        "key": "docs",
        "display_name": "API documentation",
        "description": "Reference docs and the OpenAPI schema.",
        "category": "Developer",
        "target_path": "/openapi.json",
        "sort_order": 100,
    },
]


async def seed_default_checks(db: AsyncSession) -> int:
    """Insert any missing built-in check. Never overwrites an existing row —
    the super admin's edits (renames, pauses, thresholds) survive restarts.
    """
    existing = set((await db.execute(select(ServiceStatusCheck.key))).scalars().all())
    added = 0
    for spec in DEFAULT_CHECKS:
        if spec["key"] in existing:
            continue
        db.add(ServiceStatusCheck(**spec))
        added += 1
    if added:
        await db.commit()
    return added


def _is_due(check: ServiceStatusCheck, now: datetime) -> bool:
    if check.last_checked_at is None:
        return True
    last = check.last_checked_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    failing = check.consecutive_failures > 0
    interval = settings.status_down_recheck_seconds if failing else settings.status_check_interval_seconds
    return (now - last).total_seconds() >= interval


async def _probe(client: httpx.AsyncClient, check: ServiceStatusCheck) -> tuple[str, int | None, str | None]:
    """Returns (status, latency_ms, error). Never raises."""
    url = f"{settings.status_probe_base_url.rstrip('/')}{check.target_path}"
    started = datetime.now(timezone.utc)
    try:
        response = await client.request(check.method, url, timeout=check.timeout_seconds)
    except httpx.HTTPError as exc:
        return ServiceStatus.DOWN, None, f"{type(exc).__name__}: {exc}"

    latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
    if response.status_code != check.expected_status:
        return ServiceStatus.DOWN, latency_ms, f"HTTP {response.status_code} (expected {check.expected_status})"
    if latency_ms > check.degraded_ms:
        return ServiceStatus.DEGRADED, latency_ms, f"Slow response: {latency_ms}ms"
    return ServiceStatus.OPERATIONAL, latency_ms, None


async def _send_down_alert(check: ServiceStatusCheck, error: str | None, *, repeat: bool, down_since: datetime) -> None:
    minutes_down = max(0, int((datetime.now(timezone.utc) - down_since).total_seconds() // 60))
    prefix = "STILL DOWN" if repeat else "DOWN"
    subject = f"[PPay status] {prefix}: {check.display_name}"
    body = (
        f"{check.display_name} is not responding as expected.\n\n"
        f"Status: {check.status}\n"
        f"Down since: {down_since.isoformat()} ({minutes_down} min)\n"
        f"Consecutive failed checks: {check.consecutive_failures}\n"
        f"Detail: {error or 'no additional detail'}\n\n"
        f"Re-checking every {settings.status_down_recheck_seconds}s. "
        f"Further alerts at most every {settings.status_alert_repeat_minutes} min until it recovers."
    )
    await send_email(to_email=settings.status_alert_email, subject=subject, text_body=body)


async def _send_recovery_alert(check: ServiceStatusCheck, incident: ServiceStatusIncident | None) -> None:
    duration = ""
    if incident is not None:
        started = incident.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        minutes = max(0, int((datetime.now(timezone.utc) - started).total_seconds() // 60))
        duration = f"\nOutage duration: about {minutes} min"
    subject = f"[PPay status] RECOVERED: {check.display_name}"
    body = (
        f"{check.display_name} is responding normally again.\n"
        f"Latency: {check.last_latency_ms}ms{duration}\n\n"
        f"Back to checking every {settings.status_check_interval_seconds}s."
    )
    await send_email(to_email=settings.status_alert_email, subject=subject, text_body=body)


async def _open_incident(db: AsyncSession, check: ServiceStatusCheck, status: str, error: str | None) -> ServiceStatusIncident:
    result = await db.execute(
        select(ServiceStatusIncident)
        .where(ServiceStatusIncident.check_id == check.id, ServiceStatusIncident.resolved_at.is_(None))
        .order_by(ServiceStatusIncident.started_at.desc())
        .limit(1)
    )
    incident = result.scalar_one_or_none()
    if incident is None:
        incident = ServiceStatusIncident(check_id=check.id, status=status, error=error)
        db.add(incident)
        await db.flush()
    else:
        incident.status = status
        incident.error = error
    return incident


async def _resolve_incident(db: AsyncSession, check: ServiceStatusCheck) -> ServiceStatusIncident | None:
    result = await db.execute(
        select(ServiceStatusIncident)
        .where(ServiceStatusIncident.check_id == check.id, ServiceStatusIncident.resolved_at.is_(None))
        .order_by(ServiceStatusIncident.started_at.desc())
        .limit(1)
    )
    incident = result.scalar_one_or_none()
    if incident is not None:
        incident.resolved_at = datetime.now(timezone.utc)
    return incident


async def run_status_checks_job() -> None:
    """Scheduler entry point — ticks every 10s, probes whatever is due."""
    if not settings.status_monitor_enabled:
        return

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ServiceStatusCheck).where(ServiceStatusCheck.enabled.is_(True)))
        checks = [c for c in result.scalars().all() if _is_due(c, now)]
        if not checks:
            return

        async with httpx.AsyncClient(follow_redirects=False) as client:
            for check in checks:
                status, latency_ms, error = await _probe(client, check)
                was_failing = check.consecutive_failures > 0

                check.last_checked_at = datetime.now(timezone.utc)
                check.last_latency_ms = latency_ms
                check.status = status
                check.last_error = error

                if status == ServiceStatus.OPERATIONAL:
                    check.last_ok_at = check.last_checked_at
                    if was_failing:
                        incident = await _resolve_incident(db, check)
                        check.consecutive_failures = 0
                        check.down_since = None
                        check.last_alert_at = None
                        await db.commit()
                        await _send_recovery_alert(check, incident)
                        continue
                    check.consecutive_failures = 0
                    check.down_since = None
                    continue

                # Failing (down or degraded).
                check.consecutive_failures += 1
                if check.down_since is None:
                    check.down_since = check.last_checked_at
                incident = await _open_incident(db, check, status, error)

                down_since = check.down_since
                if down_since.tzinfo is None:
                    down_since = down_since.replace(tzinfo=timezone.utc)

                last_alert = check.last_alert_at
                if last_alert is not None and last_alert.tzinfo is None:
                    last_alert = last_alert.replace(tzinfo=timezone.utc)

                due_for_alert = last_alert is None or (
                    datetime.now(timezone.utc) - last_alert >= timedelta(minutes=settings.status_alert_repeat_minutes)
                )
                if due_for_alert:
                    check.last_alert_at = datetime.now(timezone.utc)
                    incident.alerts_sent += 1
                    await db.commit()
                    await _send_down_alert(check, error, repeat=last_alert is not None, down_since=down_since)
                    continue

            await db.commit()


async def seed_default_checks_job() -> None:
    """Run once at startup so a fresh deployment monitors itself immediately."""
    async with AsyncSessionLocal() as db:
        try:
            added = await seed_default_checks(db)
            if added:
                logger.info("[status] seeded %s default checks", added)
        except Exception:  # noqa: BLE001 - never block application startup
            logger.exception("[status] failed to seed default checks")
