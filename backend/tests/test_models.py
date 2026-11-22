from datetime import time
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from apps.orders.models import Order, OrderItem
from apps.products.models import Product
from apps.restaurant.models import OpeningHour, Restaurant

D = Decimal
pytestmark = pytest.mark.django_db


def test_restaurant_is_a_singleton():
    first = Restaurant.load()
    second = Restaurant.load()
    assert first.pk == second.pk
    with pytest.raises(IntegrityError), transaction.atomic():
        Restaurant.objects.create()  # save() forces singleton=1 → unique violation


def test_product_effective_price(burger):
    assert burger.effective_price == D("50.00")
    assert not burger.is_on_sale
    burger.sale_price = D("40.00")
    assert burger.effective_price == D("40.00")
    assert burger.is_on_sale


@pytest.mark.parametrize("sale_price", [D("50.00"), D("60.00"), D("-1.00")])
def test_database_rejects_invalid_sale_price(burger, sale_price):
    with pytest.raises(IntegrityError), transaction.atomic():
        Product.objects.filter(pk=burger.pk).update(sale_price=sale_price)


def test_database_rejects_non_positive_price(category):
    with pytest.raises(IntegrityError), transaction.atomic():
        Product.objects.create(category=category, name_fr="Gratuit", price=D("0"))


def test_category_with_products_cannot_be_deleted(category, burger):
    with pytest.raises(ProtectedError):
        category.delete()


def test_opening_hour_requires_times_unless_closed(restaurant):
    OpeningHour.objects.create(restaurant=restaurant, weekday=0, is_closed=True)
    with pytest.raises(IntegrityError), transaction.atomic():
        OpeningHour.objects.create(restaurant=restaurant, weekday=1, opens_at=time(12))


def _order(**overrides) -> Order:
    fields = {
        "reference": "RF-TEST-1",
        "order_type": "delivery",
        "customer_name": "Test",
        "customer_phone": "+212612345678",
        "subtotal": D("100.00"),
        "delivery_fee": D("15.00"),
        "total": D("115.00"),
        "currency": "MAD",
        "whatsapp_number": "212600000000",
    }
    fields.update(overrides)
    return Order.objects.create(**fields)


def test_database_enforces_order_total():
    with pytest.raises(IntegrityError), transaction.atomic():
        _order(total=D("999.00"))


def test_database_forbids_delivery_fee_on_pickup():
    with pytest.raises(IntegrityError), transaction.atomic():
        _order(order_type="pickup")


def test_database_enforces_line_total():
    order = _order()
    with pytest.raises(IntegrityError), transaction.atomic():
        OrderItem.objects.create(
            order=order,
            product_name="X",
            product_price=D("10"),
            quantity=3,
            unit_price=D("10"),
            line_total=D("20"),
        )
