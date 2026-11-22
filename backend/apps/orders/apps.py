"""Orders, order items and price snapshots. Models are implemented in Phase 2."""

from django.apps import AppConfig


class OrdersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.orders"
    verbose_name = "Orders"
