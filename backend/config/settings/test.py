"""Settings used by the pytest suite (still runs against PostgreSQL)."""

import os
import tempfile
from pathlib import Path

# Allow the suite to run in CI without a .env file.
os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-insecure-secret-key")

from .base import *  # noqa: F403

DEBUG = False

# Fast hashing keeps auth tests quick; never use this outside tests.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Uploaded files from tests never touch the real media folder.
MEDIA_ROOT = Path(tempfile.mkdtemp(prefix="restoflow-test-media-"))

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
