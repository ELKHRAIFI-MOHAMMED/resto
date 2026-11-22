"""
Consistent error envelope for every API error response:

    {
        "error": {
            "code": "validation_error",
            "message": "Invalid input.",
            "details": {"field": ["This field is required."]}
        }
    }
"""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from django.utils.translation import gettext as _
from rest_framework import exceptions
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        # Unhandled exceptions become a standard 500 handled by Django.
        return None

    if isinstance(exc, exceptions.ValidationError):
        code = "validation_error"
        message = _("Invalid input.")
        details = response.data
    else:
        detail = getattr(exc, "detail", None)
        code = getattr(detail, "code", None) or getattr(exc, "default_code", "error")
        message = str(detail) if detail is not None else str(exc)
        details = None
        if isinstance(exc, exceptions.Throttled) and exc.wait is not None:
            details = {"retry_after_seconds": int(exc.wait)}

    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
