"""
One-off preparation of a Supabase project for RestoFlow, run after `migrate`:
creates the rate-limit cache table, closes Django's tables to the public Data
API and creates the public bucket for uploaded photos.
"""

from django.core.files.storage import default_storage
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.core.storage import SupabaseStorage
from apps.core.supabase import secure_supabase_tables


class Command(BaseCommand):
    help = "Prepare a Supabase project: cache table, API lockdown, media bucket."

    def handle(self, *args, **options):
        call_command("createcachetable")
        tables = secure_supabase_tables()
        if tables:
            self.stdout.write(f"Closed {len(tables)} tables to the Supabase Data API.")
        else:
            self.stdout.write(self.style.WARNING("Not a Supabase database: nothing to lock."))

        # default_storage is lazy, but isinstance() sees the configured class.
        if isinstance(default_storage, SupabaseStorage):
            created = default_storage.ensure_public_bucket()
            state = "created" if created else "already exists"
            self.stdout.write(f"Media bucket '{default_storage.bucket}' {state}.")
        else:
            self.stdout.write(self.style.WARNING("Media storage is not Supabase: no bucket."))
        self.stdout.write(self.style.SUCCESS("Supabase is ready."))
