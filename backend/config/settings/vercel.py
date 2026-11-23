"""
Settings for Vercel (serverless Python function) with a Supabase database.

The whole app is one Vercel project: the React build is served as static
files and `/api`, `/django-admin`, `/static`, `/sitemap.xml` and `/robots.txt`
are rewritten to the Django function (see vercel.json and api/index.py).

What differs from the Docker/nginx production setup:

- Database: Supabase's connection pooler (`POSTGRES_URL`, added to the Vercel
  project by the Supabase integration). Serverless instances are short-lived,
  so connections are not kept between requests.
- Media (uploaded photos): Supabase Storage, because a function's disk is
  read-only and wiped between invocations.
- Static files (Django admin, API docs): served by WhiteNoise straight from
  the installed apps, no collectstatic step.
"""

import os

from django.core.exceptions import ImproperlyConfigured

from config.database_url import database_from_url

from .production import *  # noqa: F403
from .production import ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, STORAGES, env

_database_url = env.str("DATABASE_URL", default="") or env.str("POSTGRES_URL", default="")
if not _database_url:
    raise ImproperlyConfigured(
        "Set DATABASE_URL or POSTGRES_URL (added by the Supabase integration on Vercel)."
    )
DATABASES = {
    "default": database_from_url(_database_url, conn_max_age=env.int("DB_CONN_MAX_AGE", default=0))
}

_LOCAL_HOSTS = ("localhost", "127.0.0.1")

# --- Hosts --------------------------------------------------------------------
# Vercel exposes the deployment's domains as system environment variables.
_vercel_hosts = [
    os.environ.get(name, "")
    for name in ("VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL")
]
ALLOWED_HOSTS = list(dict.fromkeys([*ALLOWED_HOSTS, *filter(None, _vercel_hosts)]))
CSRF_TRUSTED_ORIGINS = list(
    dict.fromkeys(
        [
            *CSRF_TRUSTED_ORIGINS,
            *(f"https://{host}" for host in ALLOWED_HOSTS if host not in _LOCAL_HOSTS),
        ]
    )
)
if os.environ.get("VERCEL_PROJECT_PRODUCTION_URL") and not env.str("PUBLIC_SITE_URL", default=""):
    PUBLIC_SITE_URL = f"https://{os.environ['VERCEL_PROJECT_PRODUCTION_URL']}"

# Vercel terminates HTTPS and already redirects http:// to https://.
SECURE_SSL_REDIRECT = False

# --- Static files: WhiteNoise serves them from the apps, no collectstatic -----
WHITENOISE_USE_FINDERS = True
STATIC_ROOT = None  # nothing is collected on Vercel
WHITENOISE_AUTOREFRESH = False
STORAGES = {
    **STORAGES,
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# --- Media: Supabase Storage ---------------------------------------------------
SUPABASE_URL = env.str("SUPABASE_URL", default="")
# Server-side key only (never sent to the browser).
SUPABASE_SERVICE_KEY = env.str("SUPABASE_SERVICE_ROLE_KEY", default="") or env.str(
    "SUPABASE_SECRET_KEY", default=""
)
SUPABASE_STORAGE_BUCKET = env.str("SUPABASE_STORAGE_BUCKET", default="media")
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    STORAGES["default"] = {"BACKEND": "apps.core.storage.SupabaseStorage"}

# Vercel rejects request bodies over 4.5 MB.
MAX_IMAGE_UPLOAD_SIZE = env.int("MAX_IMAGE_UPLOAD_SIZE", default=4 * 1024 * 1024)
