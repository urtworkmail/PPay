"""Request rate limiting.

In-process sliding-window counters, keyed per caller, checked once per
request in ASGI middleware — before routing, so a limited caller doesn't pay
the cost of dependency injection, auth, or a DB session just to be rejected.

**Scope of this implementation**: state lives in this worker process's memory.
That's correct for how this app runs today (one `uvicorn` process, see
`ppay-api.service`) — every request really does pass through the same
counters. It stops being correct the moment a second worker or a second
instance joins: each would enforce the limit independently, so the *effective*
limit becomes (configured limit × instance count). If this ever moves to
multiple workers/instances behind a load balancer, replace `_Counters` below
with a Redis-backed implementation (`INCR` + `EXPIRE`) so state is shared —
the call sites in `middleware.py` don't need to change, only what's behind
`RateLimiter.check`.

Four tiers, checked in priority order — the most specific caller identity
available wins:

1. **Auth-sensitive paths** (login, register, password reset, etc.), keyed by
   IP — tight, because this is exactly what credential-stuffing and
   brute-force look like, and IP is the only identity available before a
   credential is checked.
2. **API key** callers — keyed by a hash of the key, never the raw secret.
3. **Signed-in dashboard sessions** (JWT), keyed by user id — generous, since
   one person clicking around the dashboard fires many small requests.
4. **Everything else** (public checkout/pay pages, no credential at all),
   keyed by IP.
"""

import hashlib
import time
from collections import deque

from app.core.config import get_settings

WINDOW_SECONDS = 60

# Paths brute-force/credential-stuffing actually targets. Matched by exact
# path (all are POST-only, non-parameterised routes).
AUTH_SENSITIVE_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/auth/password-reset",
    "/api/v1/auth/password-reset/confirm",
    "/api/v1/auth/verify-email",
    "/api/v1/auth/verify-email/token",
    "/api/v1/auth/resend-verification",
    "/api/v1/platform-admin/login",
}

# Never rate-limited: cheap, unauthenticated-by-design, and in the status
# monitor's case, self-limiting it would be actively harmful (a limited probe
# reads as "down" and pages someone for nothing).
EXEMPT_PATHS = {"/health", "/health/db", "/openapi.json", "/docs", "/redoc"}

# The status monitor probes over loopback, not through nginx — no
# X-Forwarded-For to inherit, so it always presents as this literal address.
# Real internet traffic can't reach uvicorn directly (it's bound to
# 127.0.0.1, only nginx can reach it), so this exemption can't be spoofed
# from outside.
LOOPBACK_IPS = {"127.0.0.1", "::1"}


class _SlidingWindowCounters:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = {}

    def check(self, key: str, limit: int, window_seconds: int = WINDOW_SECONDS) -> tuple[bool, int]:
        """Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        bucket = self._buckets.setdefault(key, deque())
        cutoff = now - window_seconds

        while bucket and bucket[0] < cutoff:
            bucket.popleft()

        if len(bucket) >= limit:
            retry_after = max(1, int(window_seconds - (now - bucket[0])) + 1)
            return False, retry_after

        bucket.append(now)
        return True, 0

    def sweep(self, max_idle_seconds: int = 600) -> int:
        """Drop buckets that have gone quiet, so memory doesn't grow
        unbounded across every distinct caller this process has ever seen.
        Called periodically by a scheduler job, not on the request path."""
        now = time.monotonic()
        cutoff = now - max_idle_seconds
        stale = [key for key, bucket in self._buckets.items() if not bucket or bucket[-1] < cutoff]
        for key in stale:
            del self._buckets[key]
        return len(stale)


# One process-wide instance — the middleware and the sweep job share it.
counters = _SlidingWindowCounters()


def hash_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


def sweep_idle_counters() -> None:
    counters.sweep()


def classify_and_check(*, path: str, client_ip: str | None, authorization: str | None) -> tuple[bool, int]:
    """The single decision point middleware calls. Returns (allowed, retry_after)."""
    settings = get_settings()
    if not settings.rate_limit_enabled or path in EXEMPT_PATHS:
        return True, 0

    ip = client_ip or "unknown"
    if ip in LOOPBACK_IPS:
        return True, 0

    if path in AUTH_SENSITIVE_PATHS:
        return counters.check(f"auth:{ip}", settings.rate_limit_auth_requests_per_minute)

    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()

    if token.startswith("sk_"):
        return counters.check(f"key:{hash_key(token)}", settings.rate_limit_requests_per_minute)

    if token:
        # A dashboard JWT — not verified here (that's the real auth
        # dependency's job downstream); the raw token string is enough of a
        # stable per-session identity for rate-limiting purposes, and hashing
        # it means an expired/invalid token still can't leak into logs.
        return counters.check(f"session:{hash_key(token)}", settings.rate_limit_session_requests_per_minute)

    return counters.check(f"ip:{ip}", settings.rate_limit_ip_requests_per_minute)
