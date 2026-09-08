"""Resolves a sign-in's approximate location from its IP address.

City-level IP geolocation, not device GPS — there is no browser permission
prompt anywhere in this flow, and the result is only ever as precise as the
IP address a request actually arrived from. This is the same mechanism
every major fintech app uses for a "signed in from Lahore, Pakistan" style
security display; the alternative (asking for the device's real GPS
location at every sign-in) would be both worse UX and needless precision
for a feature whose entire job is "does this session look like someone
else's device."

Looked up once, at session-creation/refresh time, and cached on the
`Session` row — never re-resolved on every request.
"""

import ipaddress
import logging

import httpx

logger = logging.getLogger(__name__)

GEOIP_TIMEOUT_SECONDS = 2.5


def _is_lookupable(ip: str | None) -> bool:
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    # Loopback/private/link-local addresses (local dev, or a request that
    # arrived over an internal network hop) have no public geolocation —
    # skip the network call rather than let it return a useless "unknown".
    return not (addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved)


async def resolve_location(ip: str | None) -> dict[str, str | None]:
    """Best-effort city/region/country for `ip`. Never raises — a failed or
    slow lookup just means the session's location stays null, which the UI
    already renders as "Unknown location" rather than blocking sign-in on a
    third party being slow or down.
    """
    empty = {"city": None, "region": None, "country": None}
    if not _is_lookupable(ip):
        return empty

    try:
        async with httpx.AsyncClient(timeout=GEOIP_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"https://ipapi.co/{ip}/json/",
                headers={"User-Agent": "PPay/1.0"},
            )
        if response.status_code != 200:
            return empty
        data = response.json()
        if data.get("error"):
            return empty
        return {
            "city": data.get("city"),
            "region": data.get("region"),
            "country": data.get("country_name"),
        }
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("geoip lookup failed for %s: %s", ip, exc)
        return empty
