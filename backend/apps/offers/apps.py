"""Offers (packs): a fixed price for a set of dishes the customer picks from groups."""

from django.apps import AppConfig


class OffersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.offers"
    verbose_name = "Offers"
