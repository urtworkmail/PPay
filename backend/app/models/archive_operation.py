import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ArchiveOperation(Base):
    """Accountability record of one super-admin archive action — lives in the
    shared `public` schema (not tenant-scoped) so it survives independent of
    which merchant/mode was archived and can't itself be archived away by the
    same mechanism it's logging.
    """

    __tablename__ = "archive_operations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform_admin_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("platform_admins.id", ondelete="RESTRICT"), nullable=False
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id", ondelete="RESTRICT"), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    row_counts: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
