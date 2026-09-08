"""Mode-bearing public identifiers for objects reached by an unauthenticated buyer.

Under schema-per-mode separation (see core/db.py), a raw UUID path param is not
enough to serve a public checkout/pay-link/invoice page: the server has to know
which schema (`sandbox` vs `production`) to query *before* it can look anything
up, and an anonymous buyer request carries no API key to read that from. The convention
solves the identical problem by encoding the mode into the object id itself
(`cs_test_...` vs `cs_live_...` checkout session ids) — this module reproduces
that convention for the three entities buyers reach directly: CheckoutSession,
PaymentLink, Invoice.

The encoded form is what every API response and URL uses as the object's `id` —
not just an alias for public routes — so there is exactly one id format per
entity, the standard approach for this kind of reference.

Mode tags here match this codebase's existing vocabulary (`ApiKeyMode.SANDBOX`/
`LIVE`, `sk_sandbox_...`/`sk_live_...` — see core/security.py) rather than
the literal `test`/`live` wording some platforms use, so there's one consistent term for
"non-production" across keys, schemas, and now these reference ids.
"""

import uuid
from dataclasses import dataclass

from app.core.db import Mode

_TAG_BY_MODE = {Mode.SANDBOX: "sandbox", Mode.LIVE: "live"}
_MODE_BY_TAG = {tag: mode for mode, tag in _TAG_BY_MODE.items()}


@dataclass(frozen=True)
class DecodedRef:
    mode: Mode
    id: uuid.UUID


def encode_ref(prefix: str, mode: Mode, object_id: uuid.UUID) -> str:
    return f"{prefix}_{_TAG_BY_MODE[mode]}_{object_id.hex}"


def decode_ref(prefix: str, value: str) -> DecodedRef:
    expected_start = f"{prefix}_"
    if not value.startswith(expected_start):
        raise ValueError(f"Not a valid {prefix} reference")
    remainder = value[len(expected_start) :]
    tag, _, hex_id = remainder.partition("_")
    if tag not in _MODE_BY_TAG or not hex_id:
        raise ValueError(f"Not a valid {prefix} reference")
    try:
        object_id = uuid.UUID(hex=hex_id)
    except ValueError as exc:
        raise ValueError(f"Not a valid {prefix} reference") from exc
    return DecodedRef(mode=_MODE_BY_TAG[tag], id=object_id)


# One short, stable prefix per entity — the same `cs_`, `pi_`, `in_` style prefix convention used industry-wide.
CHECKOUT_SESSION_PREFIX = "cs"
PAYMENT_LINK_PREFIX = "plink"
INVOICE_PREFIX = "inv"
