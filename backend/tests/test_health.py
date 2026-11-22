from unittest import mock

import pytest
from django.db import DatabaseError
from django.urls import reverse


@pytest.mark.django_db
def test_health_reports_database_ok(api_client):
    response = api_client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


@pytest.mark.django_db
def test_health_reports_degraded_when_database_unreachable(api_client):
    with mock.patch("apps.core.views.connection.cursor", side_effect=DatabaseError):
        response = api_client.get(reverse("health"))

    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"


@pytest.mark.django_db
def test_openapi_schema_is_served(api_client):
    response = api_client.get(reverse("schema"))

    assert response.status_code == 200
    assert b"RestoFlow API" in response.content
