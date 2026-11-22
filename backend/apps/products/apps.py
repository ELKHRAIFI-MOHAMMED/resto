"""Products, variants, add-ons and gallery images. Models are implemented in Phase 2."""

from django.apps import AppConfig


class ProductsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.products"
    verbose_name = "Products"
