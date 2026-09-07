"""Outbound email — SMTP delivery plus the small set of templates PPay sends.

Kept deliberately dependency-free: stdlib `smtplib` run in a worker thread via
`asyncio.to_thread`, rather than adding an async SMTP client. Sending a handful
of transactional messages per request is not throughput-sensitive, and this
keeps the deployment surface (and the audit surface) smaller.

Credentials are read from the environment through `core.config` and are never
logged. With `SMTP_HOST` unset the module runs in console mode — the message is
logged and nothing leaves the machine — so local development and CI need no
mail server and no real credentials.
"""

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _build_message(*, to_email: str, subject: str, text_body: str, html_body: str | None) -> EmailMessage:
    settings = get_settings()
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message["To"] = to_email
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")
    return message


def _send_sync(message: EmailMessage) -> None:
    settings = get_settings()
    context = ssl.create_default_context()

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds, context=context
        ) as client:
            if settings.smtp_username:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as client:
        client.ehlo()
        if settings.smtp_use_tls:
            client.starttls(context=context)
            client.ehlo()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)


async def send_email(*, to_email: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
    """Deliver one message. Returns True if it was handed to the SMTP server.

    Never raises on delivery failure: a mail outage must not fail the request
    that triggered the message (a signup, a settings change). Callers that need
    the user to act on the mail — email verification — surface a "resend" path
    instead of blocking on delivery.
    """
    settings = get_settings()
    message = _build_message(to_email=to_email, subject=subject, text_body=text_body, html_body=html_body)

    if not settings.email_enabled:
        logger.info("[email:console] to=%s subject=%s\n%s", to_email, subject, text_body)
        return False

    try:
        await asyncio.to_thread(_send_sync, message)
        logger.info("[email:sent] to=%s subject=%s", to_email, subject)
        return True
    except Exception:  # noqa: BLE001 - delivery must never break the caller
        # Logged without the message body or any credential material.
        logger.exception("[email:failed] to=%s subject=%s", to_email, subject)
        return False


# --- Templates -------------------------------------------------------------
#
# Plain, single-column HTML with an inline style block only — no external CSS,
# images, or tracking pixels, which is what keeps these out of spam folders and
# readable in every client.

_WRAPPER = """\
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f9fc;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e8ee;border-radius:12px;padding:32px">
    <div style="font-size:18px;font-weight:700;color:#0a2540;margin-bottom:20px">PPay</div>
    {content}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e3e8ee;font-size:12px;color:#8792a2">
      You received this because of activity on your PPay account. If this wasn't you, secure your account and
      contact support.
    </div>
  </div>
</div>"""

_CODE_BLOCK = """\
<div style="font-family:ui-monospace,'IBM Plex Mono',monospace;font-size:30px;font-weight:600;letter-spacing:6px;
  color:#0a2540;background:#f6f9fc;border:1px solid #e3e8ee;border-radius:8px;padding:16px;text-align:center;
  margin:20px 0">{code}</div>"""

_PARAGRAPH = '<p style="font-size:14px;line-height:1.6;color:#425466;margin:0 0 14px">{text}</p>'

_BUTTON = """\
<a href="{url}" style="display:inline-block;background:#635bff;color:#ffffff;text-decoration:none;font-weight:600;
  font-size:14px;padding:11px 20px;border-radius:6px;margin:6px 0 16px">{label}</a>"""


def _html(*parts: str) -> str:
    return _WRAPPER.format(content="".join(parts))


async def send_verification_code(*, to_email: str, code: str, purpose_label: str, link: str | None = None) -> bool:
    subject = f"Your PPay verification code: {code}"
    text_lines = [
        f"Your PPay verification code is {code}.",
        "",
        f"Use it to {purpose_label}. The code expires in "
        f"{get_settings().otp_expiry_minutes} minutes and can only be used once.",
    ]
    if link:
        text_lines += ["", f"Or open this link: {link}"]
    text_lines += ["", "If you didn't request this, you can ignore this email."]

    parts = [
        _PARAGRAPH.format(text=f"Use this code to {purpose_label}:"),
        _CODE_BLOCK.format(code=code),
        _PARAGRAPH.format(
            text=f"It expires in {get_settings().otp_expiry_minutes} minutes and can only be used once."
        ),
    ]
    if link:
        parts.append(_BUTTON.format(url=link, label="Verify email"))
    parts.append(_PARAGRAPH.format(text="If you didn't request this, you can safely ignore this email."))

    return await send_email(to_email=to_email, subject=subject, text_body="\n".join(text_lines), html_body=_html(*parts))


async def send_team_invite(*, to_email: str, business_name: str, invited_by: str, invite_url: str) -> bool:
    subject = f"{invited_by} invited you to {business_name} on PPay"
    text_body = (
        f"{invited_by} invited you to join {business_name} on PPay.\n\n"
        f"Accept the invitation: {invite_url}\n\n"
        "If you weren't expecting this, you can ignore this email."
    )
    html_body = _html(
        _PARAGRAPH.format(text=f"<strong>{invited_by}</strong> invited you to join <strong>{business_name}</strong> on PPay."),
        _BUTTON.format(url=invite_url, label="Accept invitation"),
        _PARAGRAPH.format(text="If you weren't expecting this, you can ignore this email."),
    )
    return await send_email(to_email=to_email, subject=subject, text_body=text_body, html_body=html_body)


async def send_notification_email(*, to_email: str, title: str, body: str, link: str | None = None) -> bool:
    subject = f"PPay: {title}"
    text_body = f"{title}\n\n{body}"
    if link:
        text_body += f"\n\nView it in your dashboard: {link}"

    parts = [
        _PARAGRAPH.format(text=f"<strong>{title}</strong>"),
        _PARAGRAPH.format(text=body),
    ]
    if link:
        parts.append(_BUTTON.format(url=link, label="Open in dashboard"))
    parts.append(
        _PARAGRAPH.format(
            text='<span style="font-size:12px;color:#8792a2">Manage which events email you in '
            "Settings &rsaquo; Notifications.</span>"
        )
    )
    return await send_email(to_email=to_email, subject=subject, text_body=text_body, html_body=_html(*parts))
