"""
Supabase hardening.

Supabase publishes the `public` schema through its Data API (PostgREST): with
the public "anon" key anyone could read or write tables there unless access
is revoked. Django owns its tables and connects as their owner, so it does not
need these grants: every Django table is closed to the API roles and gets row
level security (with no policy, the API roles see nothing).

Runs after every `migrate` (see CoreConfig.ready); a no-op outside Supabase.
"""

from django.conf import settings
from django.db import connections

API_ROLES = ("anon", "authenticated")


def _django_tables(connection) -> list[str]:
    tables = set(connection.introspection.django_table_names(only_existing=True))
    existing = set(connection.introspection.table_names())
    tables.add("django_migrations")
    for cache in settings.CACHES.values():
        if cache.get("BACKEND", "").endswith("DatabaseCache"):
            tables.add(cache["LOCATION"])
    return sorted(tables & existing)


def secure_supabase_tables(using: str = "default") -> list[str]:
    """Revoke API access to Django's tables; returns the tables secured."""
    connection = connections[using]
    if connection.vendor != "postgresql":
        return []
    with connection.cursor() as cursor:
        cursor.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", [list(API_ROLES)])
        roles = [row[0] for row in cursor.fetchall()]
        if not roles:
            return []  # not a Supabase database
        quote = connection.ops.quote_name
        grantees = ", ".join(quote(role) for role in roles)
        tables = _django_tables(connection)
        for table in tables:
            cursor.execute(f"REVOKE ALL ON TABLE {quote(table)} FROM {grantees}")
            cursor.execute(f"ALTER TABLE {quote(table)} ENABLE ROW LEVEL SECURITY")
        cursor.execute(
            "SELECT sequence_name FROM information_schema.sequences "
            "WHERE sequence_schema = current_schema()"
        )
        for (sequence,) in cursor.fetchall():
            if any(sequence.startswith(f"{table}_") for table in tables):
                cursor.execute(f"REVOKE ALL ON SEQUENCE {quote(sequence)} FROM {grantees}")
    return tables


def secure_after_migrate(sender, using="default", **kwargs):
    secure_supabase_tables(using)
