"""
Vercel entry point: the Django backend as one serverless Python function.

vercel.json rewrites /api, /django-admin, /static, /sitemap.xml and
/robots.txt here; Django sees the original path. Vercel calls the WSGI `app`.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from config.serverless import build_app  # noqa: E402 - needs sys.path above

app = build_app()
