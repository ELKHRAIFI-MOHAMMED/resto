"""Authoritative pricing: availability, options, delivery fees and minimums."""

from decimal import Decimal

import pytest

from apps.orders.pricing import (
    ItemRequest,
    OrderingUnavailableError,
    OrderValidationError,
    price_order,
)

D = Decimal
pytestmark = pytest.mark.django_db


def _codes(error: OrderValidationError) -> list[str]:
    return [item["code"] for item in error.details["items"]]


def test_prices_simple_pickup_order(restaurant, burger):
    quote = price_order(order_type="pickup", items=[ItemRequest(burger.pk, quantity=3)])

    assert quote.subtotal == D("150.00")
    assert quote.delivery_fee == D("0.00")
    assert quote.total == D("150.00")
    assert quote.currency == "MAD"


def test_sale_price_is_used(restaurant, burger):
    burger.sale_price = D("39.90")
    burger.save()

    quote = price_order(order_type="pickup", items=[ItemRequest(burger.pk, quantity=2)])

    assert quote.items[0].product_price == D("39.90")
    assert quote.total == D("79.80")


def test_addons_are_added_to_the_unit_price(restaurant, burger, cheese, bacon):
    quote = price_order(
        order_type="pickup",
        items=[ItemRequest(burger.pk, quantity=2, addon_ids=(cheese.pk, bacon.pk))],
    )

    item = quote.items[0]
    assert item.unit_price == D("70.50")  # 50 + 8 + 12.50
    assert item.line_total == D("141.00")
    assert [addon.name for addon in item.addons] == ["Fromage", "Bacon"]


def test_variant_price_delta(restaurant, pizza):
    large = pizza.variants.get(name_fr="Grande")

    quote = price_order(
        order_type="pickup", items=[ItemRequest(pizza.pk, quantity=1, variant_id=large.pk)]
    )

    assert quote.items[0].variant_name == "Grande"
    assert quote.total == D("85.00")


def test_decimal_precision_has_no_float_drift(restaurant, burger):
    burger.price = D("0.10")
    burger.save()
    burger.addons.clear()

    quote = price_order(order_type="pickup", items=[ItemRequest(burger.pk, quantity=3)])

    assert quote.total == D("0.30")  # 0.1 * 3 is 0.30000000000000004 with floats


def test_delivery_fee_from_zone(restaurant, burger, zone):
    quote = price_order(
        order_type="delivery", items=[ItemRequest(burger.pk, quantity=1)], delivery_zone_id=zone.pk
    )

    assert quote.delivery_fee == D("15.00")
    assert quote.total == D("65.00")
    assert quote.delivery_zone_name == "Maârif"


def test_free_delivery_above_threshold(restaurant, burger, zone):
    restaurant.free_delivery_threshold = D("100.00")
    restaurant.save()

    quote = price_order(
        order_type="delivery", items=[ItemRequest(burger.pk, quantity=2)], delivery_zone_id=zone.pk
    )

    assert quote.free_delivery_applied
    assert quote.delivery_fee == D("0.00")
    assert quote.total == D("100.00")


def test_minimum_order_uses_the_highest_of_zone_and_restaurant(restaurant, burger, zone):
    restaurant.minimum_order_amount = D("60.00")
    restaurant.save()
    zone.minimum_order_amount = D("80.00")
    zone.save()

    with pytest.raises(OrderValidationError) as error:
        price_order(
            order_type="delivery",
            items=[ItemRequest(burger.pk, quantity=1)],
            delivery_zone_id=zone.pk,
        )
    assert error.value.code == "minimum_order_not_met"
    assert error.value.details["minimum_order_amount"] == "80.00"


def test_pickup_ignores_minimum_order(restaurant, burger):
    restaurant.minimum_order_amount = D("500.00")
    restaurant.save()

    quote = price_order(order_type="pickup", items=[ItemRequest(burger.pk, quantity=1)])

    assert quote.total == D("50.00")


@pytest.mark.parametrize("zone_id", [None, 999_999])
def test_delivery_requires_an_active_zone(restaurant, burger, zone_id):
    with pytest.raises(OrderValidationError) as error:
        price_order(
            order_type="delivery",
            items=[ItemRequest(burger.pk, quantity=1)],
            delivery_zone_id=zone_id,
        )
    assert error.value.code in {"delivery_zone_required", "delivery_zone_invalid"}


def test_inactive_zone_is_rejected(restaurant, burger, zone):
    zone.is_active = False
    zone.save()

    with pytest.raises(OrderValidationError) as error:
        price_order(
            order_type="delivery",
            items=[ItemRequest(burger.pk, quantity=1)],
            delivery_zone_id=zone.pk,
        )
    assert error.value.code == "delivery_zone_invalid"


def test_unavailable_and_hidden_products_are_rejected(restaurant, burger, pizza, category):
    burger.is_available = False
    burger.save()
    pizza.is_active = False
    pizza.save()

    with pytest.raises(OrderValidationError) as error:
        price_order(
            order_type="pickup",
            items=[ItemRequest(burger.pk, quantity=1), ItemRequest(pizza.pk, quantity=1)],
        )
    assert _codes(error.value) == ["product_unavailable", "product_not_found"]


def test_products_in_inactive_categories_are_rejected(restaurant, burger, category):
    category.is_active = False
    category.save()

    with pytest.raises(OrderValidationError) as error:
        price_order(order_type="pickup", items=[ItemRequest(burger.pk, quantity=1)])
    assert _codes(error.value) == ["product_not_found"]


def test_variant_is_required_when_product_has_variants(restaurant, pizza):
    with pytest.raises(OrderValidationError) as error:
        price_order(order_type="pickup", items=[ItemRequest(pizza.pk, quantity=1)])
    assert _codes(error.value) == ["variant_required"]


def test_inactive_or_foreign_variant_is_rejected(restaurant, pizza, burger):
    large = pizza.variants.get(name_fr="Grande")
    large.is_active = False
    large.save()

    with pytest.raises(OrderValidationError) as error:
        price_order(
            order_type="pickup",
            items=[
                ItemRequest(pizza.pk, quantity=1, variant_id=large.pk),
                ItemRequest(burger.pk, quantity=1, variant_id=large.pk),
            ],
        )
    assert _codes(error.value) == ["variant_invalid", "variant_invalid"]


def test_addon_not_offered_on_product_is_rejected(restaurant, pizza, cheese):
    medium = pizza.variants.get(name_fr="Moyenne")
    with pytest.raises(OrderValidationError) as error:
        price_order(
            order_type="pickup",
            items=[ItemRequest(pizza.pk, quantity=1, variant_id=medium.pk, addon_ids=(cheese.pk,))],
        )
    assert _codes(error.value) == ["addon_invalid"]


def test_inactive_addon_is_rejected(restaurant, burger, cheese):
    cheese.is_active = False
    cheese.save()

    with pytest.raises(OrderValidationError) as error:
        price_order(
            order_type="pickup", items=[ItemRequest(burger.pk, quantity=1, addon_ids=(cheese.pk,))]
        )
    assert _codes(error.value) == ["addon_invalid"]


def test_restaurant_not_accepting_orders(restaurant, burger):
    restaurant.is_accepting_orders = False
    restaurant.save()

    with pytest.raises(OrderingUnavailableError) as error:
        price_order(order_type="pickup", items=[ItemRequest(burger.pk, quantity=1)])
    assert error.value.code == "ordering_closed"
    assert error.value.status_code == 409


def test_whatsapp_number_must_be_configured(restaurant, burger):
    restaurant.whatsapp_number = ""
    restaurant.save()

    with pytest.raises(OrderingUnavailableError) as error:
        price_order(order_type="pickup", items=[ItemRequest(burger.pk, quantity=1)])
    assert error.value.code == "whatsapp_not_configured"


def test_disabled_order_type(restaurant, burger):
    restaurant.delivery_enabled = False
    restaurant.save()

    with pytest.raises(OrderValidationError) as error:
        price_order(order_type="delivery", items=[ItemRequest(burger.pk, quantity=1)])
    assert error.value.code == "order_type_unavailable"
