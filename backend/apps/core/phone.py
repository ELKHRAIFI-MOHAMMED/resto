"""Phone number normalisation for customers and the restaurant's WhatsApp line."""

import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

MOROCCO_COUNTRY_CODE = "212"

_SEPARATORS = re.compile(r"[\s\-.()/]")
# Moroccan national numbers: 0 + 9 digits starting with 5, 6 or 7.
_MOROCCAN_NATIONAL = re.compile(r"^0([5-7]\d{8})$")
_MOROCCAN_INTERNATIONAL = re.compile(r"^(?:\+|00)212([5-7]\d{8})$")
_INTERNATIONAL = re.compile(r"^(?:\+|00)([1-9]\d{7,14})$")
_WHATSAPP_DIGITS = re.compile(r"^[1-9]\d{7,14}$")


def normalize_customer_phone(raw: str) -> str:
    """
    Accept common Moroccan formats (06…, 07…, 05…, +212…, 00212…) and other
    international numbers (+33…, 0033…). Returns the number in `+<digits>` form.
    """
    value = _SEPARATORS.sub("", raw or "")
    if match := _MOROCCAN_NATIONAL.match(value) or _MOROCCAN_INTERNATIONAL.match(value):
        return f"+{MOROCCO_COUNTRY_CODE}{match.group(1)}"
    if match := _INTERNATIONAL.match(value):
        return f"+{match.group(1)}"
    raise ValidationError(_("Enter a valid phone number."), code="invalid_phone")


def normalize_whatsapp_number(raw: str) -> str:
    """
    WhatsApp click-to-chat needs the international number with digits only
    (no '+', spaces or dashes), e.g. '212612345678'.
    """
    value = _SEPARATORS.sub("", raw or "")
    if not value:
        return ""
    if value.startswith("+"):
        value = value[1:]
    elif value.startswith("00"):
        value = value[2:]
    elif match := _MOROCCAN_NATIONAL.match(value):
        value = f"{MOROCCO_COUNTRY_CODE}{match.group(1)}"
    if not _WHATSAPP_DIGITS.match(value):
        raise ValidationError(
            _("Enter the WhatsApp number in international format, e.g. 212612345678."),
            code="invalid_whatsapp_number",
        )
    return value


def validate_whatsapp_number(value: str) -> None:
    if value and not _WHATSAPP_DIGITS.match(value):
        raise ValidationError(
            _("The WhatsApp number must contain digits only, in international format."),
            code="invalid_whatsapp_number",
        )
