"""
Fill a brand-new database with the initial menu, offers, delivery zones and
opening hours (and the first owner from INITIAL_OWNER_EMAIL / _PASSWORD).
Does nothing once the database holds any account, category or dish.
"""

from django.core.management.base import BaseCommand

from apps.core.bootstrap import load_initial_data


class Command(BaseCommand):
    help = "Load the initial data into a brand-new database (no-op otherwise)."

    def add_arguments(self, parser):
        parser.add_argument("--no-images", action="store_true", help="Skip the photos.")

    def handle(self, *args, no_images: bool = False, **options):
        if load_initial_data(images=not no_images, stdout=self.stdout):
            self.stdout.write(self.style.SUCCESS("Initial data loaded."))
        else:
            self.stdout.write("The database already holds data: nothing loaded.")
