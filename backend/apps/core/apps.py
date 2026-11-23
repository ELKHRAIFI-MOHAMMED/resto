"""Cross-cutting API infrastructure: pagination, error format, health check."""

from django.apps import AppConfig
from django.db.models.signals import post_migrate


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    verbose_name = "Core"

    def ready(self):
        from .supabase import secure_after_migrate

        # On Supabase, close every new table to the public Data API.
        post_migrate.connect(secure_after_migrate, sender=self, dispatch_uid="core.supabase")
