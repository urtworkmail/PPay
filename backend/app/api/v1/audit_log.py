from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, require_role
from app.core.db import get_db
from app.models.audit_log import AuditLogEntry
from app.models.merchant import Merchant
from app.models.user import User, UserRole
from app.schemas.audit_log import AuditLogEntryResponse

router = APIRouter(prefix="/audit-log", tags=["audit-log"])


@router.get("", response_model=list[AuditLogEntryResponse])
async def list_audit_log(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    merchant: Merchant = Depends(get_current_merchant),
    # Visible only to the account Owner — not other team members, per the
    # no-delete/audit design: everyone's actions are logged, only the Owner
    # can review the log.
    _: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogEntry]:
    result = await db.execute(
        select(AuditLogEntry)
        .where(AuditLogEntry.merchant_id == merchant.id)
        .order_by(AuditLogEntry.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all())
