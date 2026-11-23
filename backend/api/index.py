"""
Vercel entry point when the backend is its own Vercel project (Root Directory:
backend). Every path is rewritten here by backend/vercel.json; Django sees
the original path. Vercel calls the WSGI `app`.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from config.serverless import build_app  # noqa: E402 - needs sys.path above

app = build_app()
