"""
Production settings (Gunicorn behind nginx, see docs/deployment.md).

- Static files (Django admin, API docs) are served by WhiteNoise.
- Uploaded media is stored on a volume and served directly by nginx.
- Rate limits use a database cache shared by every worker.
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import ALLOWED_HOSTS, DJANGO_ADMIN_URL, MIDDLEWARE, SECRET_KEY, env

DEBUG = False

if SECRET_KEY.startswith("change-me") or len(SECRET_KEY) < 50:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be a long, random, secret value.")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set in production.")
# nginx forwards only /django-admin/ to Django: a private admin path must live under it.
if not DJANGO_ADMIN_URL.startswith("django-admin/"):
    raise ImproperlyConfigured("DJANGO_ADMIN_URL must start with 'django-admin/'.")

# Static files: compressed, cache-busted names, served by WhiteNoise.
MIDDLEWARE.insert(
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,
    "whitenoise.middleware.WhiteNoiseMiddleware",
)
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# HTTPS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 30)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
SECURE_HSTS_PRELOAD = env.bool("DJANGO_SECURE_HSTS_PRELOAD", default=False)

# Cookies
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Rate limits are counted in the cache: it must be shared by every Gunicorn
# worker. The database cache needs no extra service (`createcachetable`).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "django_cache",
    }
}
