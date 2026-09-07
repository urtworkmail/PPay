"""Fail loudly at startup if production is about to run with a default or
placeholder secret.

This is the actual, most common secrets-management failure mode in practice —
not a missing vault, but someone deploying with the value that shipped in
`.env.example` because rotating it was forgotten. A misconfigured vault
integration is rare; a copy-pasted `change-me` is not.

Deliberately does not attempt to reach an external secrets store (GCP Secret
Manager, Vault, etc.) — this VM's service account doesn't currently have the
OAuth scope for that (a change that needs a VM restart, and is a call for
whoever operates this deployment to make, not something to do silently mid
deploy). This module is the safe, zero-infrastructure floor: config values
still come from the environment, but at least an obviously-wrong one can't
reach production unnoticed.
"""

import logging

from app.core.config import Settings

logger = logging.getLogger(__name__)

_DEFAULT_JWT_SECRET = "change-me-to-a-long-random-string"
_DEFAULT_DB_CREDENTIAL_MARKERS = ("openpay:openpay@", "ppay:ppay@")
_MIN_JWT_SECRET_LENGTH = 32


class InsecureConfigurationError(RuntimeError):
    pass


def check_secrets(settings: Settings) -> list[str]:
    """Returns a list of problems found. Empty means clean."""
    problems: list[str] = []

    if settings.jwt_secret_key == _DEFAULT_JWT_SECRET:
        problems.append("JWT_SECRET_KEY is still the placeholder from .env.example")
    elif len(settings.jwt_secret_key) < _MIN_JWT_SECRET_LENGTH:
        problems.append(f"JWT_SECRET_KEY is shorter than {_MIN_JWT_SECRET_LENGTH} characters")

    if any(marker in settings.database_url for marker in _DEFAULT_DB_CREDENTIAL_MARKERS):
        problems.append("DATABASE_URL appears to use the default local-dev credentials")

    if settings.environment == "production" and not settings.email_enabled:
        # Not a security issue on its own, but a production deployment silently
        # running in email-console-mode (no verification/notification mail
        # ever actually sent) is exactly the kind of thing that should be loud,
        # not discovered days later.
        problems.append("ENVIRONMENT=production but SMTP_HOST is unset — outbound email is in console mode")

    return problems


def enforce_secrets_check(settings: Settings) -> None:
    """Call once at startup. Raises in production; only logs in development,
    where a placeholder secret is expected and fine."""
    problems = check_secrets(settings)
    if not problems:
        return

    for problem in problems:
        logger.warning("[secrets-check] %s", problem)

    if settings.environment == "production":
        # Only the ones that are an actual security defect (not the SMTP
        # advisory) are fatal — a misconfigured mail server shouldn't take the
        # whole API down, but a guessable JWT secret must.
        fatal = [p for p in problems if "JWT_SECRET_KEY" in p or "DATABASE_URL" in p]
        if fatal:
            raise InsecureConfigurationError(
                "Refusing to start in production with insecure configuration: " + "; ".join(fatal)
            )
