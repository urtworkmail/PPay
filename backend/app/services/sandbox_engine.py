"""Deterministic sandbox payment authorization engine.

This never touches a real card network, bank, or wallet provider. It exists so
that investor/merchant demos are fully reproducible: specific "magic" test
card numbers and wallet phone numbers always resolve to the same outcome,
the same way test-mode card numbers work industry-wide. See TEST_CARDS.md for the
full reference table shown to demo users.
"""

import asyncio
import random
import secrets
from dataclasses import dataclass

CARD_OUTCOMES: dict[str, tuple[bool, str | None]] = {
    "4242424242424242": (True, None),
    "4000000000000002": (False, "insufficient_funds"),
    "4000000000000069": (False, "expired_card"),
    "4000000000000119": (False, "processing_error"),
}

WALLET_OUTCOMES: dict[str, tuple[bool, str | None]] = {
    "03000000000": (True, None),
    "03000000001": (False, "insufficient_funds"),
    "03000000002": (False, "timeout"),
}

DEFAULT_CARD_OUTCOME: tuple[bool, str | None] = (True, None)
DEFAULT_WALLET_OUTCOME: tuple[bool, str | None] = (True, None)


@dataclass
class AuthorizationResult:
    success: bool
    failure_reason: str | None
    gateway_reference: str
    masked_details: dict


def normalize_digits(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


_normalize = normalize_digits


async def authorize_card(card_number: str) -> AuthorizationResult:
    digits = _normalize(card_number)
    success, reason = CARD_OUTCOMES.get(digits, DEFAULT_CARD_OUTCOME)

    delay = 8.0 if reason == "timeout" else random.uniform(1.0, 3.0)
    await asyncio.sleep(delay)

    return AuthorizationResult(
        success=success,
        failure_reason=reason,
        gateway_reference=f"sbx_{secrets.token_hex(8)}",
        masked_details={"method": "card", "last4": digits[-4:] if len(digits) >= 4 else digits},
    )


async def authorize_wallet(phone: str) -> AuthorizationResult:
    digits = _normalize(phone)
    success, reason = WALLET_OUTCOMES.get(digits, DEFAULT_WALLET_OUTCOME)

    delay = 8.0 if reason == "timeout" else random.uniform(1.0, 3.0)
    await asyncio.sleep(delay)

    return AuthorizationResult(
        success=success,
        failure_reason=reason,
        gateway_reference=f"sbx_{secrets.token_hex(8)}",
        masked_details={"method": "wallet", "phone_last4": digits[-4:] if len(digits) >= 4 else digits},
    )


async def authorize_bank_transfer() -> AuthorizationResult:
    await asyncio.sleep(random.uniform(1.0, 2.0))
    return AuthorizationResult(
        success=True,
        failure_reason=None,
        gateway_reference=f"sbx_{secrets.token_hex(8)}",
        masked_details={"method": "bank_transfer"},
    )


# Off-session (no cardholder present) decline rate for cards that aren't one of
# the known magic test numbers above — mirrors the real-world fact that a card
# which worked once can still fail on a later renewal (expired, insufficient
# funds that day, etc). This is what actually gives the dunning/retry logic in
# subscription_engine.py something to do in the demo.
OFF_SESSION_DECLINE_RATE = 0.15
OFF_SESSION_DECLINE_REASONS = ["insufficient_funds", "card_declined", "expired_card"]


async def authorize_off_session(digits: str, method: str) -> AuthorizationResult:
    """Charges a previously-saved card/wallet with no cardholder present (subscription renewals)."""
    outcomes = CARD_OUTCOMES if method == "card" else WALLET_OUTCOMES
    if digits in outcomes:
        success, reason = outcomes[digits]
    elif random.random() < OFF_SESSION_DECLINE_RATE:
        success, reason = False, random.choice(OFF_SESSION_DECLINE_REASONS)
    else:
        success, reason = True, None

    return AuthorizationResult(
        success=success,
        failure_reason=reason,
        gateway_reference=f"sbx_{secrets.token_hex(8)}",
        masked_details={"method": method, "last4": digits[-4:] if len(digits) >= 4 else digits},
    )
