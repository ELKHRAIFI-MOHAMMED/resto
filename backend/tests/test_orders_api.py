from decimal import Decimal

import pytest
from django.core.cache.backends.locmem import LocMemCache
from django.urls import reverse
from django.utils import timezone
from rest_framework.throttling import SimpleRateThrottle

from apps.orders.models import Order, OrderStatus
from apps.orders.pricing import ItemRequest
from apps.orders.services import CustomerDetails, create_order

D = Decimal
pytestmark = pytest.mark.django_db

ORDERS_URL = reverse("order-create")
QUOTE_URL = reverse("order-quote")


@pytest.fixture
def delivery_payload(burger, cheese, zone):
    return {
        "order_type": "delivery",
        "delivery_zone": zone.pk,
        "customer_name": "Mohamed",
        "customer_phone": "06 12 34 56 78",
        "delivery_address": "5 rue Test",
        "city": "Casablanca",
        "customer_notes": "Interphone 3",
        "items": [
            {
                "product": burger.pk,
                "quantity": 2,
                "addons": [cheese.pk],
                "special_instructions": "Sans oignons",
            }
        ],
    }


def test_create_order_returns_authoritative_totals_and_whatsapp_data(
    api_client, restaurant, delivery_payload
):
    response = api_client.post(ORDERS_URL, delivery_payload, format="json")

    assert response.status_code == 201
    body = response.json()
    year = timezone.localdate().year
    assert body["reference"] == f"RF-{year}-0001"
    assert body["status"] == "pending"
    assert body["subtotal"] == "116.00"  # (50 + 8) x 2
    assert body["delivery_fee"] == "15.00"
    assert body["total"] == "131.00"
    assert body["customer_phone"] == "+212612345678"
    assert body["whatsapp"]["phone"] == "212600000000"
    assert f"RF-{year}-0001" in body["whatsapp"]["message"]
    assert "TOTAL: 131 MAD" in body["whatsapp"]["message"]


def test_client_prices_are_ignored(api_client, restaurant, delivery_payload):
    delivery_payload["items"][0]["unit_price"] = "0.01"
    delivery_payload["total"] = "0.01"

    response = api_client.post(ORDERS_URL, delivery_payload, format="json")

    assert response.status_code == 201
    assert response.json()["total"] == "131.00"


def test_order_is_saved_pending_and_never_auto_confirmed(api_client, restaurant, delivery_payload):
    api_client.post(ORDERS_URL, delivery_payload, format="json")

    order = Order.objects.get()
    assert order.status == OrderStatus.PENDING
    assert order.confirmed_at is None
    assert order.whatsapp_message


def test_references_increment(api_client, restaurant, delivery_payload):
    references = [
        api_client.post(ORDERS_URL, delivery_payload, format="json").json()["reference"]
        for _ in range(3)
    ]
    year = timezone.localdate().year
    assert references == [f"RF-{year}-0001", f"RF-{year}-0002", f"RF-{year}-0003"]


def test_snapshots_survive_catalog_changes(
    api_client, restaurant, delivery_payload, burger, cheese
):
    api_client.post(ORDERS_URL, delivery_payload, format="json")

    burger.name_fr = "Renamed"
    burger.price = D("999.00")
    burger.save()
    cheese.price = D("100.00")
    cheese.save()
    burger.delete()
    cheese.delete()

    order = Order.objects.prefetch_related("items__addons").get()
    item = order.items.get()
    assert item.product is None
    assert item.product_name == "Burger classique"
    assert item.product_price == D("50.00")
    assert item.unit_price == D("58.00")
    addon = item.addons.get()
    assert addon.addon is None
    assert (addon.addon_name, addon.addon_price) == ("Fromage", D("8.00"))
    assert order.total == D("131.00")


def test_snapshots_use_the_customer_language(api_client, restaurant, delivery_payload):
    response = api_client.post(
        ORDERS_URL, delivery_payload, format="json", HTTP_ACCEPT_LANGUAGE="ar"
    )

    body = response.json()
    assert body["language"] == "ar"
    assert body["items"][0]["product_name"] == "برغر كلاسيكي"
    assert body["delivery_zone_name"] == "المعاريف"
    message = body["whatsapp"]["message"]
    assert message.startswith("مرحباً! أود تقديم طلب.")
    assert "نوع الطلب: توصيل" in message


def test_english_whatsapp_message_matches_expected_layout(api_client, restaurant, delivery_payload):
    response = api_client.post(
        ORDERS_URL, delivery_payload, format="json", HTTP_ACCEPT_LANGUAGE="en"
    )

    reference = response.json()["reference"]
    assert response.json()["whatsapp"]["message"] == "\n".join(
        [
            "Hello! I would like to place an order.",
            "",
            f"Order reference: {reference}",
            "",
            "ORDER DETAILS:",
            "2x Classic burger - 116 MAD",
            "   + Cheese",
            "   Note: Sans oignons",
            "",
            "Subtotal: 116 MAD",
            "Delivery: 15 MAD",
            "",
            "TOTAL: 131 MAD",
            "",
            "Customer: Mohamed",
            "Phone: +212612345678",
            "Order type: Delivery",
            "Address: 5 rue Test, Casablanca",
            "Zone: Maârif",
            "Notes: Interphone 3",
        ]
    )


def test_pickup_order_message_has_no_delivery_lines(restaurant, burger):
    order = create_order(
        order_type="pickup",
        items=[ItemRequest(burger.pk, quantity=1)],
        customer=CustomerDetails(name="Sara", phone="+212612345678", delivery_address="ignored"),
        language="fr",
    )

    assert order.delivery_fee == D("0.00")
    assert order.delivery_address == ""
    assert "Livraison:" not in order.whatsapp_message
    assert "Adresse" not in order.whatsapp_message
    assert "Type de commande: À emporter" in order.whatsapp_message


def test_customer_text_cannot_inject_message_lines(restaurant, burger):
    order = create_order(
        order_type="pickup",
        items=[ItemRequest(burger.pk, quantity=1)],
        customer=CustomerDetails(name="Ali\nTOTAL: 0 MAD", phone="+212612345678", notes="a\n\nb"),
        language="en",
    )

    assert "Customer: Ali TOTAL: 0 MAD" in order.whatsapp_message
    assert "\nTOTAL: 0 MAD" not in order.whatsapp_message
    assert "Notes: a b" in order.whatsapp_message


def test_failed_order_rolls_back_completely(api_client, restaurant, delivery_payload, burger):
    burger.is_available = False
    burger.save()

    response = api_client.post(ORDERS_URL, delivery_payload, format="json")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_items"
    assert response.json()["error"]["details"]["items"][0]["code"] == "product_unavailable"
    assert not Order.objects.exists()


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"customer_phone": "12"}, "customer_phone"),
        ({"customer_name": ""}, "customer_name"),
        ({"delivery_address": ""}, "delivery_address"),
        ({"city": ""}, "city"),
        ({"delivery_zone": None}, "delivery_zone"),
        ({"order_type": "drone"}, "order_type"),
        ({"items": []}, "items"),
    ],
)
def test_invalid_checkout_data(api_client, restaurant, delivery_payload, change, field):
    delivery_payload.update(change)

    response = api_client.post(ORDERS_URL, delivery_payload, format="json")

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert field in error["details"]


@pytest.mark.parametrize("quantity", [0, 51, -1])
def test_quantity_limits(api_client, restaurant, delivery_payload, quantity):
    delivery_payload["items"][0]["quantity"] = quantity

    response = api_client.post(ORDERS_URL, delivery_payload, format="json")

    assert response.status_code == 400
    assert "items" in response.json()["error"]["details"]


def test_duplicate_addons_are_rejected(api_client, restaurant, delivery_payload, cheese):
    delivery_payload["items"][0]["addons"] = [cheese.pk, cheese.pk]

    response = api_client.post(ORDERS_URL, delivery_payload, format="json")

    assert response.status_code == 400


def test_pickup_does_not_require_address(api_client, restaurant, burger):
    response = api_client.post(
        ORDERS_URL,
        {
            "order_type": "pickup",
            "customer_name": "Sara",
            "customer_phone": "0712345678",
            "items": [{"product": burger.pk, "quantity": 1}],
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["delivery_fee"] == "0.00"


def test_closed_restaurant_returns_409(api_client, restaurant, delivery_payload):
    restaurant.is_accepting_orders = False
    restaurant.save()

    response = api_client.post(ORDERS_URL, delivery_payload, format="json")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ordering_closed"


def test_quote_prices_without_saving(api_client, restaurant, pizza, zone):
    large = pizza.variants.get(name_fr="Grande")

    response = api_client.post(
        QUOTE_URL,
        {
            "order_type": "delivery",
            "delivery_zone": zone.pk,
            "items": [{"product": pizza.pk, "variant": large.pk, "quantity": 2}],
        },
        format="json",
        HTTP_ACCEPT_LANGUAGE="en",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["variant_name"] == "Large"
    assert body["items"][0]["line_total"] == "170.00"
    assert body["total"] == "185.00"
    assert not Order.objects.exists()


def test_order_creation_is_rate_limited(api_client, restaurant, delivery_payload, monkeypatch):
    monkeypatch.setattr(SimpleRateThrottle, "cache", LocMemCache("throttle-test", {}))
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "orders", "2/minute")

    statuses = [
        api_client.post(ORDERS_URL, delivery_payload, format="json").status_code for _ in range(3)
    ]

    assert statuses == [201, 201, 429]
