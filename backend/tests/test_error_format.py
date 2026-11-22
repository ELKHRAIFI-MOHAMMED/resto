"""The custom exception handler must wrap every API error in one envelope."""

import pytest
from django.urls import path
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class _EchoSerializer(serializers.Serializer):
    name = serializers.CharField()


class _ValidatingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        _EchoSerializer(data=request.data).is_valid(raise_exception=True)
        return Response({"ok": True})


class _ProtectedView(APIView):
    def get(self, request):
        return Response({"secret": True})


urlpatterns = [
    path("validate/", _ValidatingView.as_view()),
    path("protected/", _ProtectedView.as_view()),
]


@pytest.fixture(autouse=True)
def _use_test_urls(settings):
    settings.ROOT_URLCONF = __name__


def test_validation_errors_use_envelope(api_client):
    response = api_client.post("/validate/", {}, format="json")

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "name" in error["details"]


def test_endpoints_deny_anonymous_access_by_default(api_client):
    response = api_client.get("/protected/")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "not_authenticated"


def test_error_messages_follow_accept_language(api_client):
    response = api_client.post("/validate/", {}, format="json", HTTP_ACCEPT_LANGUAGE="fr")

    assert response.json()["error"]["details"]["name"] == ["Ce champ est obligatoire."]
