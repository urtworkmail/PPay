import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, get_current_user, require_role
from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.models.merchant import Merchant
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import TokenPair
from app.services.audit_log import record_audit_event
from app.services.email import send_team_invite
from app.schemas.user import (
    AcceptInviteRequest,
    InviteContextResponse,
    TeamInviteRequest,
    TeamInviteResponse,
    TeamMemberResponse,
    TeamMemberRoleUpdateRequest,
)

router = APIRouter(prefix="/team", tags=["team"])

INVITE_TTL_DAYS = 7
VALID_ROLES = {r.value for r in UserRole}


def _frontend_origin() -> str:
    settings = get_settings()
    return settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"


async def _count_active_owners(db: AsyncSession, merchant_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(User.merchant_id == merchant_id, User.role == UserRole.OWNER, User.status == UserStatus.ACTIVE)
    )
    return result.scalar_one()


@router.post("/invite", response_model=TeamInviteResponse, status_code=status.HTTP_201_CREATED)
async def invite_team_member(
    payload: TeamInviteRequest,
    merchant: Merchant = Depends(get_current_merchant),
    inviter: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TeamInviteResponse:
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    token = secrets.token_urlsafe(32)
    invited = User(
        merchant_id=merchant.id,
        email=payload.email,
        name=payload.name,
        role=UserRole(payload.role),
        status=UserStatus.INVITED,
        invite_token=token,
        invite_token_expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invited)
    await db.flush()
    await record_audit_event(
        db,
        merchant_id=merchant.id,
        action="invite",
        resource_type="User",
        resource_id=invited.id,
        changes={"email": invited.email, "role": invited.role.value},
    )
    await db.commit()
    await db.refresh(invited)

    invite_url = f"{_frontend_origin()}/accept-invite/{token}"
    # The URL is still returned so the inviter can copy it manually — mail
    # delivery is best-effort and must not be the only way in.
    await send_team_invite(
        to_email=invited.email,
        business_name=merchant.business_name,
        invited_by=inviter.email,
        invite_url=invite_url,
    )

    return TeamInviteResponse(
        id=invited.id,
        email=invited.email,
        role=invited.role,
        invite_url=invite_url,
    )


@router.get("/members", response_model=list[TeamMemberResponse])
async def list_team_members(
    merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[User]:
    result = await db.execute(
        select(User).where(User.merchant_id == merchant.id).order_by(User.created_at.asc())
    )
    return list(result.scalars().all())


@router.patch("/members/{member_id}/role", response_model=TeamMemberResponse)
async def update_member_role(
    member_id: uuid.UUID,
    payload: TeamMemberRoleUpdateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> User:
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    result = await db.execute(select(User).where(User.id == member_id, User.merchant_id == merchant.id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    if member.role == UserRole.OWNER and payload.role != UserRole.OWNER.value:
        if await _count_active_owners(db, merchant.id) <= 1:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot demote the last remaining owner")

    previous_role = member.role.value
    member.role = UserRole(payload.role)
    await record_audit_event(
        db,
        merchant_id=merchant.id,
        action="update",
        resource_type="User",
        resource_id=member.id,
        changes={"role": {"from": previous_role, "to": member.role.value}},
    )
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(User).where(User.id == member_id, User.merchant_id == merchant.id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    if member.role == UserRole.OWNER and await _count_active_owners(db, merchant.id) <= 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot remove the last remaining owner")

    # No account data is ever hard-deleted (only the platform super admin can
    # archive live data, via a separate passphrase-gated action) — removing a
    # team member revokes access instead, preserving their audit trail.
    member.status = UserStatus.SUSPENDED
    member.invite_token = None
    member.invite_token_expires_at = None
    await record_audit_event(
        db,
        merchant_id=merchant.id,
        action="remove",
        resource_type="User",
        resource_id=member.id,
        changes={"email": member.email},
    )
    await db.commit()


@router.get("/invite/{token}", response_model=InviteContextResponse)
async def get_invite_context(token: str, db: AsyncSession = Depends(get_db)) -> InviteContextResponse:
    result = await db.execute(select(User).where(User.invite_token == token))
    invited = result.scalar_one_or_none()
    if (
        invited is None
        or invited.status != UserStatus.INVITED
        or invited.invite_token_expires_at is None
        or invited.invite_token_expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found or expired")

    merchant = await db.get(Merchant, invited.merchant_id)
    return InviteContextResponse(email=invited.email, business_name=merchant.business_name if merchant else "")


@router.post("/accept-invite", response_model=TokenPair)
async def accept_invite(payload: AcceptInviteRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    result = await db.execute(select(User).where(User.invite_token == payload.token))
    invited = result.scalar_one_or_none()
    if (
        invited is None
        or invited.status != UserStatus.INVITED
        or invited.invite_token_expires_at is None
        or invited.invite_token_expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found or expired")

    invited.password_hash = hash_password(payload.password)
    if payload.name:
        invited.name = payload.name
    invited.status = UserStatus.ACTIVE
    invited.invite_token = None
    invited.invite_token_expires_at = None
    invited.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(invited)

    return TokenPair(
        access_token=create_access_token(str(invited.id)),
        refresh_token=create_refresh_token(str(invited.id)),
    )
