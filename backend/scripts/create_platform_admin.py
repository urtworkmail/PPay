"""One-off CLI to provision a PlatformAdmin account (super admin), including
2FA enrollment — done here rather than over HTTP because login requires
`totp_enabled=True` with no bypass, so there is no way to enable 2FA for a
brand-new admin via the API (a chicken-and-egg problem the CLI sidesteps by
having direct DB access).

There is deliberately no HTTP signup endpoint for this at all — a platform
admin can act across every merchant's live data, so provisioning one is an
operator action, not something reachable over the API.

Usage: python scripts/create_platform_admin.py <email> <password>
"""

import asyncio
import sys

sys.path.insert(0, ".")

from app.core.db import AsyncSessionLocal  # noqa: E402
from app.core.security import generate_totp_secret, hash_password, totp_uri, verify_totp_code  # noqa: E402
from app.models.platform_admin import PlatformAdmin  # noqa: E402
from sqlalchemy import select  # noqa: E402


async def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python scripts/create_platform_admin.py <email> <password>")
        raise SystemExit(1)
    email, password = sys.argv[1], sys.argv[2]

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(PlatformAdmin).where(PlatformAdmin.email == email))
        if existing.scalar_one_or_none() is not None:
            print(f"A platform admin with email {email!r} already exists.")
            raise SystemExit(1)

        secret = generate_totp_secret()
        admin = PlatformAdmin(email=email, password_hash=hash_password(password), totp_secret=secret)
        db.add(admin)
        await db.flush()

        print(f"Created platform admin {email!r} (id={admin.id}).")
        print()
        print(f"TOTP secret: {secret}")
        print(f"otpauth URI: {totp_uri(secret, email, issuer='PPay Admin')}")
        print("Add this to an authenticator app now, then enter the 6-digit code to confirm and enable 2FA.")

        code = input("Enter code: ").strip()
        if not verify_totp_code(secret, code):
            await db.rollback()
            print("Incorrect code — admin account NOT created. Run the script again.")
            raise SystemExit(1)

        admin.totp_enabled = True
        await db.commit()
        print("2FA enabled. This admin can now log in via POST /api/v1/platform-admin/login.")


if __name__ == "__main__":
    asyncio.run(main())
