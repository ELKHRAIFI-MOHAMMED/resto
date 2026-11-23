"""
WSGI app for serverless platforms (Vercel), with a readable startup failure.

When Django cannot start (typically a missing environment variable), the
platform would only show a bare "FUNCTION_INVOCATION_FAILED". Instead, the
traceback goes to the function logs and the response names the problem.
Only configuration errors are described: their messages name a setting or
an environment variable, never a value.
"""

import os
import sys
import traceback


def build_app(settings_module: str = "config.settings.vercel"):
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", settings_module)
    try:
        from django.core.wsgi import get_wsgi_application

        return get_wsgi_application()
    except Exception as error:
        traceback.print_exc(file=sys.stderr)  # Vercel → Deployments → Logs
        return _startup_failure_app(error)


def _startup_failure_app(error: Exception):
    from django.core.exceptions import ImproperlyConfigured

    if isinstance(error, ImproperlyConfigured):
        reason = f"Configuration error: {error}"
    else:
        reason = f"{type(error).__name__} while starting Django (details in the function logs)."
    body = f"RestoFlow backend could not start.\n{reason}\n".encode()

    def app(environ, start_response):
        start_response(
            "503 Service Unavailable",
            [("Content-Type", "text/plain; charset=utf-8"), ("Cache-Control", "no-store")],
        )
        return [body]

    return app
