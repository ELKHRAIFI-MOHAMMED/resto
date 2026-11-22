"""Local development settings."""

from .base import *  # noqa: F403
from .base import DATABASES, REST_FRAMEWORK, env

DEBUG = env.bool("DJANGO_DEBUG", default=True)

# The browsable API is handy locally; production serves JSON only.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# The dev server handles each request in a new thread, so persistent
# connections would pile up (one per thread) until PostgreSQL refuses new
# clients. Keep them for production only.
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=0)
