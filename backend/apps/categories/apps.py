"""Menu categories with FR/AR/EN translations. Models are implemented in Phase 2."""

from django.apps import AppConfig


class CategoriesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.categories"
    verbose_name = "Categories"
