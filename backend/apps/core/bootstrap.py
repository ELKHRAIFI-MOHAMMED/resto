"""
Automatic database preparation, for deployments without a release step
(Vercel): a new deployment brings its own schema and a brand-new database
gets its initial data, with nothing to run by hand.

- Pending migrations are applied, then the Supabase preparation runs (cache
  table, Data API lockdown, media bucket).
- An *untouched* database (no account, no category, no dish) receives the
  initial menu, offers, delivery zones and opening hours, plus the first owner
  account when INITIAL_OWNER_EMAIL and INITIAL_OWNER_PASSWORD are set. Once
  anything exists it is never loaded again, so real data is never touched.

Several serverless instances can start at the same moment: the work happens
in one transaction holding a PostgreSQL advisory lock (transaction scoped,
so it also works through a transaction pooler). The others wait, then find
nothing left to do.
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connections, transaction
from django.db.migrations.executor import MigrationExecutor

logger = logging.getLogger(__name__)

# Arbitrary, fixed key for pg_advisory_xact_lock ("RestoFlow bootstrap").
LOCK_KEY = 7_302_026


def pending_migrations(using: str = "default") -> list[str]:
    connection = connections[using]
    executor = MigrationExecutor(connection)
    plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
    return [f"{migration.app_label}.{migration.name}" for migration, _backwards in plan]


def database_is_untouched(using: str = "default") -> bool:
    """True when the database holds no account, category or dish yet."""
    from apps.categories.models import Category
    from apps.products.models import Product

    return not (
        get_user_model().objects.using(using).exists()
        or Category.objects.using(using).exists()
        or Product.objects.using(using).exists()
    )


def _has_tables(using: str) -> bool:
    connection = connections[using]
    return "accounts_user" in connection.introspection.table_names()


def needs_bootstrap(using: str = "default") -> bool:
    if pending_migrations(using):
        return True
    return _has_tables(using) and database_is_untouched(using)


def load_initial_data(*, images: bool = True, stdout=None) -> bool:
    """Fill an untouched database; returns False (and does nothing) otherwise."""
    if not database_is_untouched():
        return False
    call_command("seed_demo", force=True, no_couriers=True, no_images=not images, stdout=stdout)
    email = getattr(settings, "INITIAL_OWNER_EMAIL", "")
    password = getattr(settings, "INITIAL_OWNER_PASSWORD", "")
    if email and password:
        get_user_model().objects.create_superuser(email=email, password=password)
    return True


def bootstrap_database(using: str = "default") -> list[str]:
    """Migrate and fill the database if needed; returns what was done."""
    if not needs_bootstrap(using):
        return []
    done = []
    with transaction.atomic(using=using):
        connection = connections[using]
        if connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(%s)", [LOCK_KEY])
        # Another instance may have finished while this one waited for the lock.
        if pending := pending_migrations(using):
            call_command("migrate", interactive=False, verbosity=0, database=using)
            call_command("setup_supabase", verbosity=0)
            done.append(f"applied {len(pending)} migrations")
        if load_initial_data():
            done.append("loaded the initial data")
    return done


def bootstrap_on_startup() -> None:
    """Called once per serverless instance; never prevents the app from starting."""
    try:
        done = bootstrap_database()
    except Exception:
        # Rolled back; the next cold start tries again. /api/health/ reports the
        # database state, the function logs have the traceback.
        logger.exception("Database bootstrap failed")
        return
    if done:
        logger.warning("Database bootstrap: %s", ", ".join(done))
