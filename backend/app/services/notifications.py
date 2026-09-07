"""Create in-app notifications and fan them out to email.

Two entry points:

* `notify(...)` — an explicit call for something worth telling the merchant
  about (a payment succeeded, a payout landed, a new sign-in).
* `notify_from_audit_event(...)` — called by `services.audit_log` so that every
  recorded data change also lands in the notification feed, without every
  mutating endpoint needing a second call. Audit coverage and notification
  coverage therefore grow together instead of drifting apart.

Email delivery is fire-and-forget: the SMTP round-trip runs as a background
task so a slow or unreachable mail server never delays the API response that
triggered it. `services.email.send_email` swallows its own failures, so a task
can't die unobserved.
"""

import asyncio
import logging
import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit_context import current_user_email, current_user_id
from app.core.config import get_settings
from app.models.notification import (
    Notification,
    NotificationCategory,
    NotificationPreference,
    NotificationSeverity,
)
from app.models.user import User, UserStatus
from app.services.email import send_notification_email

logger = logging.getLogger(__name__)
settings = get_settings()


# How an audit entry (resource_type, action) becomes a human notification.
# Anything not listed still produces a notification — it just falls back to the
# generic ACCOUNT category and a plain "<resource> <action>" sentence, so new
# audited resources are never silently dropped from the feed.
_RESOURCE_CATEGORY: dict[str, str] = {
    "transaction": NotificationCategory.PAYMENT,
    "payment_intent": NotificationCategory.PAYMENT,
    "charge": NotificationCategory.PAYMENT,
    "checkout_session": NotificationCategory.PAYMENT,
    "refund": NotificationCategory.REFUND,
    "dispute": NotificationCategory.DISPUTE,
    "settlement": NotificationCategory.PAYOUT,
    "customer": NotificationCategory.CUSTOMER,
    "invoice": NotificationCategory.INVOICE,
    "subscription": NotificationCategory.SUBSCRIPTION,
    "payment_link": NotificationCategory.PAYMENT_LINK,
    "product": NotificationCategory.PRODUCT,
    "price": NotificationCategory.PRODUCT,
    "team_member": NotificationCategory.TEAM,
    "user": NotificationCategory.TEAM,
    "api_key": NotificationCategory.API_KEY,
    "webhook_endpoint": NotificationCategory.WEBHOOK,
    "session": NotificationCategory.SECURITY,
    "password": NotificationCategory.SECURITY,
    "totp": NotificationCategory.SECURITY,
    "merchant": NotificationCategory.ACCOUNT,
    "live_access_request": NotificationCategory.ACCOUNT,
}

# Where a notification about this resource should take you in the dashboard.
_RESOURCE_LINK: dict[str, str] = {
    "transaction": "/dashboard/transactions/{id}",
    "refund": "/dashboard/transactions",
    "dispute": "/dashboard/disputes/{id}",
    "settlement": "/dashboard/balances",
    "customer": "/dashboard/customers",
    "invoice": "/dashboard/invoices/{id}",
    "subscription": "/dashboard/subscriptions/{id}",
    "payment_link": "/dashboard/payment-links/{id}",
    "product": "/dashboard/products/{id}",
    "team_member": "/dashboard/team",
    "api_key": "/dashboard/api-keys",
    "webhook_endpoint": "/dashboard/webhooks/{id}",
    "session": "/dashboard/settings/sessions",
    "password": "/dashboard/settings/personal",
    "totp": "/dashboard/settings/personal",
    "merchant": "/dashboard/settings",
    "live_access_request": "/dashboard/go-live",
}

_ACTION_VERB: dict[str, str] = {
    "create": "created",
    "created": "created",
    "update": "updated",
    "updated": "updated",
    "delete": "deleted",
    "deleted": "deleted",
    "archive": "archived",
    "revoke": "revoked",
    "revoked": "revoked",
    "deactivate": "deactivated",
    "invite": "invited",
    "accept": "accepted",
    "succeed": "succeeded",
    "fail": "failed",
}


# Audit call sites name resources inconsistently — some pass the ORM class
# ("ApiKey", "User"), some a snake_case noun ("payment_link"). Normalising here
# rather than rewriting every call site keeps this mapping working for audit
# events that already exist in the database.
_CAMEL_BOUNDARY = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")

# Nouns that don't survive naive prettification.
_DISPLAY_NAMES: dict[str, str] = {
    "api_key": "API key",
    "totp": "Two-factor authentication",
    "webhook_endpoint": "Webhook endpoint",
    "live_access_request": "Go-live request",
    "payment_intent": "Payment",
    "checkout_session": "Checkout session",
    "team_member": "Team member",
    "merchant": "Account settings",
    "user": "Team member",
}


def _normalise_resource(value: str) -> str:
    return _CAMEL_BOUNDARY.sub("_", value).lower().strip()


def _humanise(value: str) -> str:
    return value.replace("_", " ").strip()


def _display_name(resource_type: str) -> str:
    if resource_type in _DISPLAY_NAMES:
        return _DISPLAY_NAMES[resource_type]
    return _humanise(resource_type).capitalize()


async def _recipients_for(db: AsyncSession, *, merchant_id: uuid.UUID, category: str) -> list[str]:
    """Verified addresses that have opted into this category.

    An address is only ever mailed once it has been confirmed: the login email
    is confirmed at signup, and an alternate delivery address only counts after
    its own one-time code has been redeemed. Without that rule, notification
    settings would be a way to send PPay-branded mail to a stranger.
    """
    result = await db.execute(
        select(User, NotificationPreference)
        .outerjoin(NotificationPreference, NotificationPreference.user_id == User.id)
        .where(User.merchant_id == merchant_id, User.status == UserStatus.ACTIVE)
    )

    addresses: list[str] = []
    for user, preference in result.all():
        if preference is None:
            # No row yet — fall back to the account defaults.
            from app.models.notification import DEFAULT_EMAIL_CATEGORIES

            if category not in DEFAULT_EMAIL_CATEGORIES or not user.email_verified:
                continue
            addresses.append(user.email)
            continue

        if not preference.email_enabled or category not in (preference.email_categories or []):
            continue

        if preference.email_address:
            if preference.email_verified_at:
                addresses.append(preference.email_address)
        elif user.email_verified:
            addresses.append(user.email)

    # De-duplicate while keeping order stable.
    return list(dict.fromkeys(addresses))


def _dispatch_emails(addresses: list[str], *, title: str, body: str, link: str | None) -> None:
    if not addresses:
        return
    full_link = f"{settings.app_base_url.rstrip('/')}{link}" if link else None

    async def _run() -> None:
        for address in addresses:
            await send_notification_email(to_email=address, title=title, body=body, link=full_link)

    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:  # no loop (sync context, e.g. a script) — send inline
        asyncio.run(_run())


async def notify(
    db: AsyncSession,
    *,
    merchant_id: uuid.UUID,
    category: str,
    title: str,
    body: str,
    severity: str = NotificationSeverity.INFO,
    resource_type: str | None = None,
    resource_id: str | uuid.UUID | None = None,
    link: str | None = None,
    changes: dict | None = None,
    user_id: uuid.UUID | None = None,
    actor_email: str | None = None,
    send_email: bool = True,
) -> Notification:
    notification = Notification(
        merchant_id=merchant_id,
        user_id=user_id,
        category=category,
        severity=severity,
        title=title,
        body=body,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        link=link,
        actor_email=actor_email if actor_email is not None else current_user_email.get(),
        changes=changes or {},
    )
    db.add(notification)
    await db.flush()

    if send_email:
        addresses = await _recipients_for(db, merchant_id=merchant_id, category=category)
        if addresses:
            notification.emailed_at = notification.created_at
            _dispatch_emails(addresses, title=title, body=body, link=link)

    return notification


async def notify_from_audit_event(
    db: AsyncSession,
    *,
    merchant_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: str | None,
    changes: dict | None,
) -> Notification:
    resource_key = _normalise_resource(resource_type)
    category = _RESOURCE_CATEGORY.get(resource_key, NotificationCategory.ACCOUNT)
    verb = _ACTION_VERB.get(action, _humanise(action))
    subject = _display_name(resource_key)

    link_template = _RESOURCE_LINK.get(resource_key)
    link = None
    if link_template:
        link = link_template.format(id=resource_id) if "{id}" in link_template and resource_id else link_template.split("/{")[0]

    actor = current_user_email.get()
    body = f"{subject} was {verb}" + (f" by {actor}." if actor else ".")

    severity = NotificationSeverity.WARNING if action in {"delete", "deleted", "revoke", "revoked"} else NotificationSeverity.INFO

    return await notify(
        db,
        merchant_id=merchant_id,
        category=category,
        title=f"{subject} {verb}",
        body=body,
        severity=severity,
        resource_type=resource_type,
        resource_id=resource_id,
        link=link,
        changes=changes,
        user_id=current_user_id.get() if category == NotificationCategory.SECURITY else None,
    )
