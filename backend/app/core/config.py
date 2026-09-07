from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://openpay:openpay@localhost:5432/openpay"
    # Deliberately a separate physical database/instance, not another schema
    # in the main DB — a compromised main-DB credential must not be able to
    # reach archived live data. Only app.services.archive_engine connects here.
    archive_database_url: str = "postgresql+asyncpg://openpay:openpay@localhost:5435/openpay_archive"
    jwt_secret_key: str = "change-me-to-a-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    environment: str = "development"
    cors_origins: str = "http://localhost:5173"

    # Where the dashboard is served from — used to build links in outbound
    # email (verification, invites, notification deep links).
    app_base_url: str = "http://localhost:5173"

    # --- Outbound email (SMTP) ---
    # Credentials come from the environment only; never commit them. With no
    # host configured, `services.email` runs in console mode: messages are
    # logged instead of sent, so local development needs no mail server.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True  # STARTTLS on a submission port (587)
    smtp_use_ssl: bool = False  # implicit TLS instead (465)
    smtp_from_email: str = "notifications@ppay.silicatelabs.site"
    smtp_from_name: str = "PPay"
    smtp_timeout_seconds: int = 20

    # Emailed one-time codes: short-lived, few attempts.
    otp_expiry_minutes: int = 15
    otp_max_attempts: int = 5

    # --- Platform status monitor (super-admin owned, not merchant-configurable) ---
    # Where the monitor probes itself. Loopback by default so a probe never
    # leaves the host and never depends on public DNS or the CDN being healthy.
    status_probe_base_url: str = "http://localhost:8000"
    status_alert_email: str = "silicatelabs@gmail.com"
    status_check_interval_seconds: int = 60  # cadence while a check is healthy
    status_down_recheck_seconds: int = 10  # cadence once it has failed
    status_alert_repeat_minutes: int = 10  # re-alert cadence while still down
    status_monitor_enabled: bool = True

    # --- Rate limiting ---
    # In-process token buckets (see core/rate_limit.py) — no Redis in this
    # stack, so this is per-worker, not cluster-wide. Correct today (a single
    # uvicorn worker); if this ever runs multiple workers/instances behind a
    # load balancer, move the bucket state to Redis so limits are shared
    # rather than each instance separately allowing the full quota.
    rate_limit_enabled: bool = True
    rate_limit_requests_per_minute: int = 120  # per API key
    rate_limit_session_requests_per_minute: int = 300  # per signed-in dashboard user (JWT)
    rate_limit_ip_requests_per_minute: int = 60  # per IP, unauthenticated/public traffic (checkout pages etc.)
    rate_limit_auth_requests_per_minute: int = 10  # login/register/password-reset — brute-force-sensitive

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host)


@lru_cache
def get_settings() -> Settings:
    return Settings()
