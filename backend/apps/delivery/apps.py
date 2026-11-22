"""Delivery zones, fees and minimum order amounts. Models are implemented in Phase 2."""

from django.apps import AppConfig


class DeliveryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.delivery"
    verbose_name = "Delivery"
