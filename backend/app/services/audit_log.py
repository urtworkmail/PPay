"""Explicit audit-log recording — called at the point a mutating endpoint
commits a change, mirroring this codebase's existing pattern for webhook
events (`enqueue_webhook_event`) rather than a global ORM-level hook, so
what gets logged and how it's described stays predictable and readable at
each call site.

Every entry is append-only: nothing here is ever updated or deleted by
application code.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit_context import current_user_email, current_user_id
from app.models.audit_log import AuditLogEntry


async def record_audit_event(
    db: AsyncSession,
    *,
    merchant_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: str | uuid.UUID | None = None,
    changes: dict | None = None,
    notify: bool = True,
) -> AuditLogEntry:
    """Record the change and, by default, surface it in the merchant's
    notification feed.

    The two are deliberately coupled at this one point: "what counts as a data
    change" is already decided here, so the notification feed inherits that
    definition instead of maintaining a second, drifting list of call sites.
    Pass `notify=False` for changes that are pure bookkeeping and would only
    add noise (a scheduler touching its own state, say).
    """
    entry = AuditLogEntry(
        merchant_id=merchant_id,
        user_id=current_user_id.get(),
        user_email=current_user_email.get(),
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        changes=changes or {},
    )
    db.add(entry)
    await db.flush()

    if notify:
        # Imported here rather than at module scope: services.notifications
        # imports the email stack, and this module is pulled in by nearly every
        # endpoint. Keeping the import local avoids a circular chain if a
        # notification path ever wants to audit something itself.
        from app.services.notifications import notify_from_audit_event

        await notify_from_audit_event(
            db,
            merchant_id=merchant_id,
            action=action,
            resource_type=resource_type,
            resource_id=entry.resource_id,
            changes=changes,
        )

    return entry
