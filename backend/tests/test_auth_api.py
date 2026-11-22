import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db


@pytest.fixture
def csrf_client() -> APIClient:
    """A client that enforces CSRF like a real browser session."""
    return APIClient(enforce_csrf_checks=True)


def _csrf_token(client: APIClient) -> str:
    response = client.get(reverse("auth-csrf"))
    assert response.status_code == 204
    return response.cookies["csrftoken"].value


def test_login_flow_with_csrf(csrf_client, admin_user):
    token = _csrf_token(csrf_client)

    response = csrf_client.post(
        reverse("auth-login"),
        {"email": "OWNER@example.com", "password": PASSWORD},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )

    assert response.status_code == 200
    assert response.json()["email"] == "owner@example.com"
    assert response.json()["is_owner"] is True
    assert response.cookies["sessionid"]["httponly"]
    assert csrf_client.get(reverse("auth-me")).json()["role"] == "owner"


def test_login_requires_csrf_token(csrf_client, admin_user):
    response = csrf_client.post(
        reverse("auth-login"), {"email": "owner@example.com", "password": PASSWORD}, format="json"
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    ("email", "password"),
    [("owner@example.com", "wrong-password"), ("nobody@example.com", PASSWORD)],
)
def test_login_rejects_bad_credentials_generically(api_client, admin_user, email, password):
    response = api_client.post(
        reverse("auth-login"), {"email": email, "password": password}, format="json"
    )

    assert response.status_code == 400
    assert response.json()["error"]["details"]["non_field_errors"] == ["Invalid email or password."]


def test_non_staff_and_inactive_users_cannot_log_in(api_client, django_user_model):
    django_user_model.objects.create_user(email="customer@example.com", password=PASSWORD)
    django_user_model.objects.create_user(
        email="former@example.com", password=PASSWORD, is_staff=True, is_active=False
    )

    for email in ("customer@example.com", "former@example.com"):
        response = api_client.post(
            reverse("auth-login"), {"email": email, "password": PASSWORD}, format="json"
        )
        assert response.status_code == 400


def test_logout(owner_client):
    assert owner_client.post(reverse("auth-logout")).status_code == 204
    assert owner_client.get(reverse("auth-me")).status_code == 403


def test_me_requires_authentication(api_client):
    response = api_client.get(reverse("auth-me"))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "not_authenticated"
