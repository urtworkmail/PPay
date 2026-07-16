"""Sandbox fee model, loosely mirroring typical Pakistani payment-gateway pricing.

Rates are illustrative placeholders for the demo, not a real pricing decision.
"""

FEE_PERCENT_BPS = 290  # 2.90%, expressed in basis points
FEE_FIXED_MINOR = 0  # no fixed fee component for now


def calculate_fee_minor(amount_minor: int) -> int:
    if amount_minor <= 0:
        return 0
    fee = (amount_minor * FEE_PERCENT_BPS) // 10_000
    return fee + FEE_FIXED_MINOR


def calculate_net_minor(amount_minor: int, fee_minor: int) -> int:
    return amount_minor - fee_minor
