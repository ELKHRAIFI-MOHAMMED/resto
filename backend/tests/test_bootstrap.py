"""Automatic database preparation for deployments without a release step."""

import pytest
from django.core.management import call_command

from apps.accounts.models import User
from apps.categories.models import Category
from apps.core import bootstrap
from apps.delivery.models import Courier, DeliveryZone
from apps.offers.models import Offer
from apps.products.models import Product
from apps.restaurant.models import Restaurant

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner_settings(settings):
    settings.INITIAL_OWNER_EMAIL = "patron@example.com"
    settings.INITIAL_OWNER_PASSWORD = "a-long-initial-password"
    return settings


def test_initial_data_fills_an_untouched_database(owner_settings):
    assert bootstrap.load_initial_data(images=False) is True

    assert Category.objects.count() == 6
    assert Product.objects.count() == 14
    assert Offer.objects.count() == 2
    assert DeliveryZone.objects.count() == 6
    assert Restaurant.load().opening_hours.count() == 14
    # Demo couriers have a public password: never created this way
    assert not Courier.objects.exists()
    owner = User.objects.get()
    assert (owner.email, owner.role, owner.is_superuser) == ("patron@example.com", "owner", True)
    assert owner.check_password("a-long-initial-password")


def test_initial_data_is_never_loaded_twice(owner_settings):
    bootstrap.load_initial_data(images=False)
    Product.objects.all().delete()  # the restaurant emptied its menu on purpose

    assert bootstrap.load_initial_data(images=False) is False
    assert not Product.objects.exists()


def test_existing_accounts_or_menu_are_left_alone(category):
    assert bootstrap.database_is_untouched() is False
    assert bootstrap.load_initial_data(images=False) is False
    assert Product.objects.count() == 0


def test_without_owner_settings_no_account_is_created(settings):
    settings.INITIAL_OWNER_EMAIL = ""
    settings.INITIAL_OWNER_PASSWORD = ""

    bootstrap.load_initial_data(images=False)

    assert not User.objects.exists()
    assert Product.objects.count() == 14


def test_bootstrap_on_a_migrated_untouched_database(owner_settings, tmp_path):
    owner_settings.MEDIA_ROOT = tmp_path  # the demo photos are copied here

    assert bootstrap.pending_migrations() == []
    assert bootstrap.bootstrap_database() == ["loaded the initial data"]
    assert Product.objects.exclude(image="").count() > 0

    # Next cold starts: nothing to do
    assert bootstrap.needs_bootstrap() is False
    assert bootstrap.bootstrap_database() == []


def test_a_failed_bootstrap_never_stops_the_app(monkeypatch, caplog):
    def broken(using="default"):
        raise RuntimeError("database unreachable")

    monkeypatch.setattr(bootstrap, "bootstrap_database", broken)

    bootstrap.bootstrap_on_startup()

    assert "Database bootstrap failed" in caplog.text


def test_serverless_app_bootstraps_when_enabled(settings, monkeypatch):
    from config import serverless

    calls = []
    monkeypatch.setattr(bootstrap, "bootstrap_on_startup", lambda: calls.append(1))

    settings.AUTO_BOOTSTRAP_DATABASE = False
    serverless.build_app()
    settings.AUTO_BOOTSTRAP_DATABASE = True
    serverless.build_app()

    assert calls == [1]


def test_load_initial_data_command(owner_settings, capsys):
    call_command("load_initial_data", "--no-images")
    call_command("load_initial_data", "--no-images")

    output = capsys.readouterr().out
    assert "Initial data loaded." in output
    assert "nothing loaded" in output
