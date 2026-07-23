"""Carries the identity of the dashboard user making the current request so
the audit log (app/services/audit_log.py) can attribute a change to them
without every mutating function needing an explicit `user` parameter plumbed
through several layers of call sites.

Set once per request, in `api/v1/deps.get_current_user`, immediately after the
JWT is verified — never trust a value here that wasn't just set from a
verified token.
"""

import uuid
from contextvars import ContextVar

current_user_id: ContextVar[uuid.UUID | None] = ContextVar("current_user_id", default=None)
current_user_email: ContextVar[str | None] = ContextVar("current_user_email", default=None)
