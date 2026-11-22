"""Money helpers. Amounts are always `Decimal`, never `float`."""

from decimal import ROUND_HALF_UP, Decimal

from django.db import models

CENT = Decimal("0.01")
ZERO = Decimal("0.00")

# Shared definition for every monetary column: up to 99,999,999.99.
MONEY_FIELD_KWARGS = {"max_digits": 10, "decimal_places": 2}


def money_field(verbose_name, **kwargs) -> models.DecimalField:
    return models.DecimalField(verbose_name, **MONEY_FIELD_KWARGS, **kwargs)


def quantize(amount: Decimal) -> Decimal:
    return Decimal(amount).quantize(CENT, rounding=ROUND_HALF_UP)


def format_money(amount: Decimal, currency: str) -> str:
    """'130 MAD' for whole amounts, '12.50 MAD' otherwise."""
    value = quantize(amount)
    text = f"{value:.0f}" if value == value.to_integral_value() else f"{value:.2f}"
    return f"{text} {currency}"
