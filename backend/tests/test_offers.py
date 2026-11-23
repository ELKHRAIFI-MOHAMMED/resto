"""Offers (packs): admin rules, public listing, pricing, orders and WhatsApp."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from apps.categories.models import Category
from apps.offers.models import Offer, OfferGroup
from apps.orders.models import Order
from apps.products.models import Product

D = Decimal
pytestmark = pytest.mark.django_db

ADMIN_URL = "/api/admin/offers/"
QUOTE_URL = reverse("order-quote")
ORDERS_URL = reverse("order-create")


@pytest.fixture
def drinks(db) -> list[Product]:
    category = Category.objects.create(name_fr="Boissons", display_order=2)
    return [
        Product.objects.create(category=category, name_fr="Coca", price=D("10.00")),
        Product.objects.create(category=category, name_fr="Thé", name_ar="شاي", price=D("15.00")),
    ]


@pytest.fixture
def offer(burger, pizza, drinks) -> Offer:
    offer = Offer.objects.create(
        name_fr="Offre Famille", name_ar="عرض العائلة", name_en="Family deal", price=D("299.00")
    )
    mains = OfferGroup.objects.create(
        offer=offer, name_fr="Plats", name_en="Mains", quantity=3, display_order=0
    )
    mains.products.set([burger, pizza])
    group = OfferGroup.objects.create(
        offer=offer, name_fr="Boissons", name_en="Drinks", quantity=2, display_order=1
    )
    group.products.set(drinks)
    return offer


def _choices(offer: Offer, mains: list[int], drinks: list[int]) -> list[dict]:
    first, second = offer.groups.all()
    return [{"group": first.pk, "products": mains}, {"group": second.pk, "products": drinks}]


def _offer_item(offer, burger, pizza, drinks, quantity=1) -> dict:
    return {
        "offer": offer.pk,
        "quantity": quantity,
        "choices": _choices(offer, [burger.pk, burger.pk, pizza.pk], [drinks[0].pk, drinks[1].pk]),
    }


# --- Admin ---------------------------------------------------------------------


def _admin_payload(burger, pizza, drinks, **overrides) -> dict:
    payload = {
        "name_fr": "Offre Famille",
        "name_ar": "عرض العائلة",
        "name_en": "Family deal",
        "price": "500.00",
        "groups": [
            {"name_fr": "Plats", "quantity": 3, "products": [burger.pk, pizza.pk]},
            {"name_fr": "Boissons", "quantity": 3, "products": [d.pk for d in drinks]},
        ],
    }
    payload.update(overrides)
    return payload


def test_staff_create_an_offer_with_its_rules(manager_client, burger, pizza, drinks):
    response = manager_client.post(ADMIN_URL, _admin_payload(burger, pizza, drinks), format="json")

    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["slug"] == "offre-famille"
    assert body["price"] == "500.00"
    assert [(g["name_fr"], g["quantity"], g["display_order"]) for g in body["groups"]] == [
        ("Plats", 3, 0),
        ("Boissons", 3, 1),
    ]
    assert sorted(body["groups"][0]["products"]) == sorted([burger.pk, pizza.pk])


def test_updating_groups_replaces_them(manager_client, offer, burger):
    response = manager_client.patch(
        f"{ADMIN_URL}{offer.pk}/",
        {"groups": [{"name_fr": "Burgers", "quantity": 2, "products": [burger.pk]}]},
        format="json",
    )

    assert response.status_code == 200, response.json()
    assert list(offer.groups.values_list("name_fr", "quantity")) == [("Burgers", 2)]


def test_partial_update_keeps_groups(manager_client, offer):
    response = manager_client.patch(f"{ADMIN_URL}{offer.pk}/", {"price": "279.00"}, format="json")

    assert response.status_code == 200
    assert offer.groups.count() == 2


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"groups": []}, "groups"),
        ({"price": "0"}, "price"),
        ({"starts_on": "2026-12-10", "ends_on": "2026-12-01"}, "ends_on"),
    ],
)
def test_offer_rules_are_validated(manager_client, burger, pizza, drinks, overrides, field):
    response = manager_client.post(
        ADMIN_URL, _admin_payload(burger, pizza, drinks, **overrides), format="json"
    )

    assert response.status_code == 400
    assert field in response.json()["error"]["details"]


def test_groups_need_products_and_a_sensible_quantity(manager_client, burger, pizza, drinks):
    payload = _admin_payload(burger, pizza, drinks)
    payload["groups"][0]["products"] = []
    payload["groups"][1]["quantity"] = 0

    response = manager_client.post(ADMIN_URL, payload, format="json")

    assert response.status_code == 400
    assert "groups" in response.json()["error"]["details"]


def test_offers_admin_requires_staff(api_client, offer):
    assert api_client.get(ADMIN_URL).status_code == 403


def test_deleting_an_offer_keeps_past_orders(
    manager_client, restaurant, offer, burger, pizza, drinks
):
    created = manager_client.post(
        ORDERS_URL,
        {
            "order_type": "pickup",
            "customer_name": "Sara",
            "customer_phone": "0612345678",
            "items": [_offer_item(offer, burger, pizza, drinks)],
        },
        format="json",
    )
    assert created.status_code == 201

    assert manager_client.delete(f"{ADMIN_URL}{offer.pk}/").status_code == 204
    item = Order.objects.get().items.get()
    assert item.offer is None
    assert item.product_name == "Offre Famille"
    assert item.choices.count() == 4


# --- Public --------------------------------------------------------------------


def test_public_list_shows_current_offers_with_choices(api_client, offer, pizza):
    today = timezone.localdate()
    Offer.objects.create(name_fr="Inactive", price=D("10"), is_active=False)
    Offer.objects.create(name_fr="Past", price=D("10"), ends_on=today - timedelta(days=1))
    Offer.objects.create(name_fr="Future", price=D("10"), starts_on=today + timedelta(days=1))

    response = api_client.get("/api/offers/", HTTP_ACCEPT_LANGUAGE="en")

    assert response.status_code == 200
    body = response.json()
    assert [item["name"] for item in body] == ["Family deal"]
    mains = body[0]["groups"][0]
    assert (mains["name"], mains["quantity"]) == ("Mains", 3)
    by_name = {product["name"]: product for product in mains["products"]}
    assert by_name["Pizza"]["variant_name"] == "Medium"  # the size served in the offer
    assert body[0]["is_available"] is True


def test_hidden_products_are_not_offered(api_client, offer, pizza):
    pizza.is_active = False
    pizza.save()

    body = api_client.get(f"/api/offers/{offer.slug}/").json()

    assert [p["name"] for p in body["groups"][0]["products"]] == ["Burger classique"]


def test_offer_is_unavailable_when_a_group_has_nothing_left(api_client, offer, drinks):
    Product.objects.filter(pk__in=[d.pk for d in drinks]).update(is_available=False)

    assert api_client.get(f"/api/offers/{offer.slug}/").json()["is_available"] is False


# --- Pricing and orders ----------------------------------------------------------


def test_quote_prices_an_offer_at_its_fixed_price(
    api_client, restaurant, offer, burger, pizza, drinks
):
    response = api_client.post(
        QUOTE_URL,
        {"items": [_offer_item(offer, burger, pizza, drinks, quantity=2)]},
        format="json",
    )

    assert response.status_code == 200, response.json()
    item = response.json()["items"][0]
    assert response.json()["subtotal"] == "598.00"
    assert (item["product"], item["offer"], item["unit_price"]) == (None, offer.pk, "299.00")
    assert [(c["group_name"], c["product_name"], c["quantity"]) for c in item["choices"]] == [
        ("Plats", "Burger classique", 2),
        ("Plats", "Pizza (Moyenne)", 1),
        ("Boissons", "Coca", 1),
        ("Boissons", "Thé", 1),
    ]


@pytest.mark.parametrize(
    "case",
    ["missing_group", "too_few", "not_allowed", "unknown_group"],
)
def test_incomplete_or_foreign_choices_are_rejected(
    api_client, restaurant, offer, burger, pizza, drinks, case
):
    item = _offer_item(offer, burger, pizza, drinks)
    if case == "missing_group":
        item["choices"] = item["choices"][:1]
    elif case == "too_few":
        item["choices"][0]["products"] = [burger.pk]
    elif case == "not_allowed":
        item["choices"][1]["products"] = [drinks[0].pk, burger.pk]
    else:
        item["choices"][1]["group"] = 999_999

    response = api_client.post(QUOTE_URL, {"items": [item]}, format="json")

    assert response.status_code == 400
    assert response.json()["error"]["details"]["items"][0]["code"] == "offer_choices_invalid"


def test_unavailable_choice_is_reported(api_client, restaurant, offer, burger, pizza, drinks):
    pizza.is_available = False
    pizza.save()

    response = api_client.post(
        QUOTE_URL, {"items": [_offer_item(offer, burger, pizza, drinks)]}, format="json"
    )

    assert response.status_code == 400
    assert response.json()["error"]["details"]["items"][0]["code"] == "offer_choice_unavailable"


def test_expired_offer_cannot_be_ordered(api_client, restaurant, offer, burger, pizza, drinks):
    offer.ends_on = timezone.localdate() - timedelta(days=1)
    offer.save()

    response = api_client.post(
        QUOTE_URL, {"items": [_offer_item(offer, burger, pizza, drinks)]}, format="json"
    )

    assert response.json()["error"]["details"]["items"][0]["code"] == "offer_not_found"


@pytest.mark.parametrize(
    "item",
    [
        {"quantity": 1},
        {"product": 1, "offer": 1, "quantity": 1},
    ],
)
def test_item_needs_exactly_one_of_product_or_offer(api_client, restaurant, item):
    response = api_client.post(QUOTE_URL, {"items": [item]}, format="json")

    assert response.status_code == 400


def test_offer_lines_cannot_carry_extras(
    api_client, restaurant, offer, burger, pizza, drinks, cheese
):
    item = {**_offer_item(offer, burger, pizza, drinks), "addons": [cheese.pk]}

    assert api_client.post(QUOTE_URL, {"items": [item]}, format="json").status_code == 400


def test_order_with_an_offer_keeps_snapshots_and_lists_choices_on_whatsapp(
    api_client, restaurant, offer, burger, pizza, drinks
):
    response = api_client.post(
        ORDERS_URL,
        {
            "order_type": "pickup",
            "customer_name": "Sara",
            "customer_phone": "0612345678",
            "items": [
                _offer_item(offer, burger, pizza, drinks),
                {"product": drinks[1].pk, "quantity": 1},
            ],
        },
        format="json",
    )

    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["total"] == "314.00"
    assert body["status"] == "pending"
    offer_line = body["items"][0]
    assert offer_line["offer"] == offer.pk
    assert offer_line["product_name"] == "Offre Famille"
    assert [c["product_name"] for c in offer_line["choices"]] == [
        "Burger classique",
        "Pizza (Moyenne)",
        "Coca",
        "Thé",
    ]
    message = body["whatsapp"]["message"]
    assert "1x Offre Famille - 299 MAD" in message
    assert "   Plats: 2x Burger classique, 1x Pizza (Moyenne)" in message
    assert "   Boissons: 1x Coca, 1x Thé" in message


def test_offer_snapshots_follow_the_order_language(
    api_client, restaurant, offer, burger, pizza, drinks
):
    response = api_client.post(
        ORDERS_URL,
        {
            "order_type": "pickup",
            "customer_name": "Sara",
            "customer_phone": "0612345678",
            "items": [_offer_item(offer, burger, pizza, drinks)],
        },
        format="json",
        HTTP_ACCEPT_LANGUAGE="ar",
    )

    assert response.status_code == 201
    item = response.json()["items"][0]
    assert item["product_name"] == "عرض العائلة"
    assert "شاي" in [c["product_name"] for c in item["choices"]]


def test_admin_order_detail_shows_choices(
    api_client, manager_client, restaurant, offer, burger, pizza, drinks
):
    api_client.post(
        ORDERS_URL,
        {
            "order_type": "pickup",
            "customer_name": "Sara",
            "customer_phone": "0612345678",
            "items": [_offer_item(offer, burger, pizza, drinks)],
        },
        format="json",
    )
    order = Order.objects.get()

    body = manager_client.get(f"/api/admin/orders/{order.pk}/").json()

    assert len(body["items"][0]["choices"]) == 4


# --- Demo data and sitemap ---------------------------------------------------------


@override_settings(DEBUG=True)
def test_seed_demo_creates_offers_idempotently():
    call_command("seed_demo", "--no-images", stdout=None)
    call_command("seed_demo", "--no-images", stdout=None)

    family = Offer.objects.get(name_fr="Offre Famille")
    assert Offer.objects.count() == 2
    assert [(g.name_fr, g.quantity) for g in family.groups.all()] == [
        ("Plats", 3),
        ("Desserts", 3),
        ("Boissons", 3),
    ]
    assert family.groups.get(name_fr="Plats").products.count() == 7


def test_sitemap_lists_current_offers(client, settings, offer):
    settings.PUBLIC_SITE_URL = "https://resto.example"

    body = client.get("/sitemap.xml").content.decode()

    assert "https://resto.example/offres/offre-famille" in body
