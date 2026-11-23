"""Parse PostgreSQL connection URLs such as the ones Supabase and Vercel provide."""

from urllib.parse import parse_qsl, unquote, urlsplit

# libpq options worth keeping from a connection URL; others (pgbouncer=true,
# supa=...) are hints for other clients and would make psycopg fail.
_LIBPQ_OPTIONS = {"sslmode", "sslrootcert", "connect_timeout", "target_session_attrs"}


def database_from_url(url: str, *, conn_max_age: int = 0) -> dict:
    """Django DATABASES entry for a postgres:// URL (Supabase pooler URLs included)."""
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    options = {key: value for key, value in query.items() if key in _LIBPQ_OPTIONS}
    options.setdefault("sslmode", "require")
    options.setdefault("connect_timeout", 5)
    # Transaction pooling (Supabase port 6543 / PgBouncer) cannot keep
    # server-side cursors open between statements.
    transaction_pooler = parts.port == 6543 or query.get("pgbouncer") == "true"
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parts.path.lstrip("/")) or "postgres",
        "USER": unquote(parts.username or ""),
        "PASSWORD": unquote(parts.password or ""),
        "HOST": parts.hostname or "",
        "PORT": str(parts.port or 5432),
        "OPTIONS": options,
        "CONN_MAX_AGE": conn_max_age,
        "CONN_HEALTH_CHECKS": True,
        "DISABLE_SERVER_SIDE_CURSORS": transaction_pooler,
    }
