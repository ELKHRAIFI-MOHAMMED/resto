import pytest
from django.core.management import CommandError, call_command
from django.test import override_settings

from apps.categories.models import Category
from apps.delivery.models import DeliveryZone
from apps.products.models import Product
from apps.restaurant.models import Restaurant

pytestmark = pytest.mark.django_db


@override_settings(DEBUG=True)
def test_seed_demo_is_idempotent():
    call_command("seed_demo", stdout=None)
    counts = (Category.objects.count(), Product.objects.count(), DeliveryZone.objects.count())
    call_command("seed_demo", stdout=None)

    assert counts == (6, 14, 6)
    assert (
        Category.objects.count(),
        Product.objects.count(),
        DeliveryZone.objects.count(),
    ) == counts
    assert Restaurant.load().opening_hours.count() == 14


def test_seed_demo_refuses_without_debug():
    with pytest.raises(CommandError):
        call_command("seed_demo")
