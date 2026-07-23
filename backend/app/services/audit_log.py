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
) -> AuditLogEntry:
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
    return entry
