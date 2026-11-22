"""
Database translations.

Translatable content is stored in one column per language (`name_fr`,
`name_ar`, `name_en`, ...). French is the reference language and is always
filled; the other languages fall back to French when left empty.
"""

from django.conf import settings
from django.utils.translation import get_language
from rest_framework import serializers

LANGUAGE_CODES: tuple[str, ...] = tuple(code for code, _name in settings.LANGUAGES)
DEFAULT_LANGUAGE: str = settings.LANGUAGE_CODE


def resolve_language(language: str | None = None) -> str:
    """Return a supported language code for `language` (or the active one)."""
    code = (language or get_language() or DEFAULT_LANGUAGE).split("-")[0].lower()
    return code if code in LANGUAGE_CODES else DEFAULT_LANGUAGE


def localized_value(instance, base: str, language: str | None = None) -> str:
    """Value of `<base>_<language>`, falling back to the default language."""
    code = resolve_language(language)
    value = getattr(instance, f"{base}_{code}", "") or ""
    if value:
        return value
    return getattr(instance, f"{base}_{DEFAULT_LANGUAGE}", "") or ""


def translated_field_names(*bases: str) -> list[str]:
    """['name_fr', 'name_ar', 'name_en', ...] for the given base names."""
    return [f"{base}_{code}" for base in bases for code in LANGUAGE_CODES]


class TranslatedField(serializers.CharField):
    """Read-only serializer field exposing a translated column in the request language."""

    def __init__(self, base: str, **kwargs):
        self.base = base
        kwargs["source"] = "*"
        kwargs["read_only"] = True
        super().__init__(**kwargs)

    def to_representation(self, instance) -> str:
        return localized_value(instance, self.base)
