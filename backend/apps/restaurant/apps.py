"""Restaurant profile, settings and opening hours. Models are implemented in Phase 2."""

from django.apps import AppConfig


class RestaurantConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.restaurant"
    verbose_name = "Restaurant"
