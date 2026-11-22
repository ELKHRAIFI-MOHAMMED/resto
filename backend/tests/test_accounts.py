import pytest
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError
from django.db import IntegrityError

pytestmark = pytest.mark.django_db


def test_create_user_uses_email_and_hashes_password(django_user_model):
    user = django_user_model.objects.create_user(
        email="Manager@Example.COM", password="a-strong-test-password"
    )

    assert user.email == "manager@example.com"
    assert user.password != "a-strong-test-password"
    assert user.check_password("a-strong-test-password")
    assert user.role == django_user_model.Role.MANAGER
    assert not user.is_staff
    assert not user.is_superuser


def test_create_superuser_is_owner(admin_user):
    assert admin_user.is_staff
    assert admin_user.is_superuser
    assert admin_user.is_owner


def test_email_is_required(django_user_model):
    with pytest.raises(ValueError):
        django_user_model.objects.create_user(email="", password="x")


def test_email_is_unique_case_insensitively(django_user_model, admin_user):
    with pytest.raises(ValidationError):
        django_user_model.objects.create_user(
            email="OWNER@example.com", password="another-password"
        )


def test_database_enforces_case_insensitive_uniqueness(django_user_model, admin_user):
    # Bypass model save() normalisation: the DB constraint must still hold.
    with pytest.raises(IntegrityError):
        django_user_model.objects.bulk_create([django_user_model(email="Owner@Example.com")])


def test_authentication_by_email_is_case_insensitive(admin_user):
    assert authenticate(username="OWNER@EXAMPLE.COM", password="a-strong-test-password")
    assert authenticate(username="owner@example.com", password="wrong") is None
