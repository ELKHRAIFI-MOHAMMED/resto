from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import translation

from apps.categories.models import Category
from apps.core.i18n import localized_value, resolve_language
from apps.core.money import format_money, quantize
from apps.core.phone import normalize_customer_phone, normalize_whatsapp_number


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("0612345678", "+212612345678"),
        ("06 12 34 56 78", "+212612345678"),
        ("07-12-34-56-78", "+212712345678"),
        ("0522.00.00.00", "+212522000000"),
        ("+212612345678", "+212612345678"),
        ("00212 612 345 678", "+212612345678"),
        ("+33 6 12 34 56 78", "+33612345678"),
    ],
)
def test_customer_phone_normalisation(raw, expected):
    assert normalize_customer_phone(raw) == expected


@pytest.mark.parametrize("raw", ["", "12345", "0812345678", "06123", "abc", "+0123456789"])
def test_customer_phone_rejects_invalid_numbers(raw):
    with pytest.raises(ValidationError):
        normalize_customer_phone(raw)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("212612345678", "212612345678"),
        ("+212 6 12 34 56 78", "212612345678"),
        ("00212612345678", "212612345678"),
        ("0612345678", "212612345678"),
        ("", ""),
    ],
)
def test_whatsapp_number_normalisation(raw, expected):
    assert normalize_whatsapp_number(raw) == expected


def test_whatsapp_number_rejects_garbage():
    with pytest.raises(ValidationError):
        normalize_whatsapp_number("call me")


def test_money_formatting_and_rounding():
    assert format_money(Decimal("130.00"), "MAD") == "130 MAD"
    assert format_money(Decimal("12.5"), "MAD") == "12.50 MAD"
    assert quantize(Decimal("0.005")) == Decimal("0.01")
    assert quantize(Decimal("10")) == Decimal("10.00")


def test_localized_value_falls_back_to_french():
    category = Category(name_fr="Boissons", name_ar="مشروبات", name_en="")
    assert localized_value(category, "name", "ar") == "مشروبات"
    assert localized_value(category, "name", "en") == "Boissons"
    assert localized_value(category, "name", "de") == "Boissons"
    with translation.override("ar"):
        assert localized_value(category, "name") == "مشروبات"


def test_resolve_language_handles_regional_codes():
    assert resolve_language("en-GB") == "en"
    assert resolve_language("ar-MA") == "ar"
    assert resolve_language("es") == "fr"


@pytest.mark.django_db
def test_slugs_are_generated_and_unique():
    first = Category.objects.create(name_fr="Crème brûlée")
    second = Category.objects.create(name_fr="Crème Brûlée")
    arabic_only = Category.objects.create(name_fr="حلويات")
    assert first.slug == "creme-brulee"
    assert second.slug == "creme-brulee-2"
    assert arabic_only.slug == "category"
