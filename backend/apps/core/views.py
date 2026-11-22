import logging

from django.db import DatabaseError, connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsStaff

logger = logging.getLogger(__name__)


class PublicAPIMixin:
    """
    Public, unauthenticated endpoint. Skipping authentication also means no
    session CSRF check, which public endpoints do not need.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]


class StaffAPIMixin:
    """Back-office endpoint: active staff users only."""

    permission_classes = [IsStaff]


class HealthView(PublicAPIMixin, APIView):
    """Liveness/readiness probe: reports whether the API can reach the database."""

    throttle_classes: list = []

    @extend_schema(
        summary="Service health",
        tags=["system"],
        responses=inline_serializer(
            name="HealthResponse",
            fields={"status": serializers.CharField(), "database": serializers.CharField()},
        ),
    )
    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            database = "ok"
        except DatabaseError:
            logger.exception("Health check: database unreachable")
            database = "unavailable"

        healthy = database == "ok"
        return Response(
            {"status": "ok" if healthy else "degraded", "database": database},
            status=200 if healthy else 503,
        )
