"""
Consistent error envelope for every API error response:

    {
        "error": {
            "code": "validation_error",
            "message": "Invalid input.",
            "details": {"field": ["This field is required."]}
        }
    }

`code` is stable and meant for programs (the frontend translates it);
`message` is a human-readable fallback.
"""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import ProtectedError, RestrictedError
from django.http import Http404
from django.utils.translation import gettext as _
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.serializers import as_serializer_error
from rest_framework.views import exception_handler


class BusinessRuleError(Exception):
    """
    A request that is well-formed but violates a business rule
    (e.g. a product is unavailable). Raised by the service layer, which
    stays independent of DRF.
    """

    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, code: str, message: str, details=None, *, status_code: int | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details
        if status_code is not None:
            self.status_code = status_code


def _envelope(code: str, message: str, details=None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def api_exception_handler(exc, context):
    if isinstance(exc, BusinessRuleError):
        return Response(_envelope(exc.code, exc.message, exc.details), status=exc.status_code)

    if isinstance(exc, ProtectedError | RestrictedError):
        related = getattr(exc, "protected_objects", None) or getattr(exc, "restricted_objects", ())
        return Response(
            _envelope(
                "protected",
                _("This item is still in use and cannot be deleted."),
                {"related_objects": len(related)},
            ),
            status=status.HTTP_409_CONFLICT,
        )

    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(detail=as_serializer_error(exc))
    elif isinstance(exc, Http404):
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

    response.data = _envelope(code, message, details)
    return response
