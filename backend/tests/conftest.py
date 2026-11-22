import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def admin_user(django_user_model):
    return django_user_model.objects.create_superuser(
        email="owner@example.com", password="a-strong-test-password"
    )
