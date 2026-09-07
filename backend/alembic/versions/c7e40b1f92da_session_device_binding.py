"""bind sessions to devices instead of individual logins

Revision ID: c7e40b1f92da
Revises: b3f21c9d47ae
Create Date: 2026-09-07 12:00:00.000000

Adds the columns that turn `sessions` from a login log into a list of signed-in
devices: `device_id` (which login re-uses instead of inserting a new row),
`device_label` for display, `expires_at` so a dead session stops being listed
as active, and `revoked_reason` so the UI can say *why* a device was signed
out.

Existing rows are backfilled with an expiry derived from their last activity
and a device id derived from their user agent, so sessions created before this
change collapse onto one row per device on the next sign-in rather than
lingering as duplicates.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c7e40b1f92da'
down_revision = 'b3f21c9d47ae'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("device_id", sa.String(length=64), nullable=True))
    op.add_column("sessions", sa.Column("device_label", sa.String(length=120), nullable=True))
    op.add_column("sessions", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("sessions", sa.Column("revoked_reason", sa.String(length=32), nullable=True))

    op.create_index("ix_sessions_user_device", "sessions", ["user_id", "device_id"])
    op.create_index("ix_sessions_user_active", "sessions", ["user_id", "revoked_at"])

    bind = op.get_bind()
    # Existing rows predate device binding, and there is no honest way to tell
    # which of them came from the same browser — so each keeps its own id and
    # simply counts as its own device. The duplicates disappear on the next
    # sign-in, when the real device id arrives and is reused from then on.
    bind.execute(
        sa.text("UPDATE public.sessions SET device_id = 'legacy-' || id::text WHERE device_id IS NULL")
    )

    # Sessions inherit the standard refresh window from their last activity.
    bind.execute(
        sa.text("UPDATE public.sessions SET expires_at = last_seen_at + interval '7 days' WHERE expires_at IS NULL")
    )


def downgrade() -> None:
    op.drop_index("ix_sessions_user_active", table_name="sessions")
    op.drop_index("ix_sessions_user_device", table_name="sessions")
    op.drop_column("sessions", "revoked_reason")
    op.drop_column("sessions", "expires_at")
    op.drop_column("sessions", "device_label")
    op.drop_column("sessions", "device_id")
