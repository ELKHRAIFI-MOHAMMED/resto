from datetime import datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.urls import reverse

from apps.categories.models import Category
from apps.products.models import Product
from apps.restaurant.models import OpeningHour
from apps.restaurant.services import is_open_at

D = Decimal
CASABLANCA = ZoneInfo("Africa/Casablanca")
pytestmark = pytest.mark.django_db


# --- Restaurant ----------------------------------------------------------------


def test_public_restaurant_profile(api_client, restaurant):
    restaurant.description_fr = "Bienvenue"
    restaurant.description_ar = "مرحبا"
    restaurant.save()

    response = api_client.get(reverse("restaurant"), HTTP_ACCEPT_LANGUAGE="ar")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Test Resto"
    assert body["description"] == "مرحبا"
    assert body["whatsapp_number"] == "212600000000"
    assert body["currency"] == "MAD"
    assert "is_open_now" in body


def test_opening_hours_endpoint(api_client, restaurant):
    OpeningHour.objects.create(
        restaurant=restaurant, weekday=0, opens_at=time(12), closes_at=time(15)
    )
    OpeningHour.objects.create(restaurant=restaurant, weekday=6, is_closed=True)

    response = api_client.get(reverse("restaurant-hours"))

    assert response.status_code == 200
    assert [
        (h["weekday"], h["opens_at"], h["closes_at"], h["is_closed"]) for h in response.json()
    ] == [(0, "12:00:00", "15:00:00", False), (6, None, None, True)]


@pytest.mark.parametrize(
    ("moment", "expected"),
    [
        (datetime(2026, 11, 23, 13, 0), True),  # Monday lunch
        (datetime(2026, 11, 23, 16, 0), False),  # Monday afternoon
        (datetime(2026, 11, 27, 23, 59), True),  # Friday late dinner
        (datetime(2026, 11, 28, 0, 30), True),  # Saturday 00:30, still Friday's slot
        (datetime(2026, 11, 28, 1, 30), False),  # after Friday's slot ends
        (datetime(2026, 11, 29, 13, 0), False),  # Sunday closed
    ],
)
def test_is_open_at_handles_split_and_overnight_slots(restaurant, moment, expected):
    slots = [
        OpeningHour(restaurant=restaurant, weekday=0, opens_at=time(12), closes_at=time(15)),
        OpeningHour(restaurant=restaurant, weekday=4, opens_at=time(19), closes_at=time(1)),
        OpeningHour(restaurant=restaurant, weekday=6, is_closed=True),
    ]
    assert is_open_at(slots, moment.replace(tzinfo=CASABLANCA)) is expected


# --- Categories ----------------------------------------------------------------


def test_categories_list_only_active_in_order(api_client, category, burger):
    Category.objects.create(name_fr="Desserts", display_order=0)
    Category.objects.create(name_fr="Archive", is_active=False)
    category.display_order = 1
    category.save()

    response = api_client.get(reverse("category-list"))

    assert response.status_code == 200
    body = response.json()
    assert [c["name"] for c in body] == ["Desserts", "Burgers"]
    assert body[1]["product_count"] == 1


def test_categories_are_translated(api_client, category):
    response = api_client.get(reverse("category-list"), HTTP_ACCEPT_LANGUAGE="ar")
    assert response.json()[0]["name"] == "برغر"


# --- Products -------------------------------------------------------------------


def test_product_list_is_paginated_and_hides_inactive(api_client, burger, pizza, category):
    Product.objects.create(category=category, name_fr="Caché", price=D("10"), is_active=False)
    hidden_category = Category.objects.create(name_fr="Off", is_active=False)
    Product.objects.create(category=hidden_category, name_fr="Hors carte", price=D("10"))

    response = api_client.get(reverse("product-list"))

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    assert {p["slug"] for p in body["results"]} == {burger.slug, pizza.slug}


def test_product_list_shape(api_client, burger):
    burger.sale_price = D("45.00")
    burger.save()

    product = api_client.get(reverse("product-list"), HTTP_ACCEPT_LANGUAGE="en").json()["results"][
        0
    ]

    assert product["name"] == "Classic burger"
    assert product["price"] == "50.00"
    assert product["sale_price"] == "45.00"
    assert product["effective_price"] == "45.00"
    assert product["is_on_sale"] is True
    assert product["has_options"] is True
    assert product["category"]["slug"] == burger.category.slug


def test_unavailable_products_stay_visible_but_flagged(api_client, burger):
    burger.is_available = False
    burger.save()

    product = api_client.get(reverse("product-list")).json()["results"][0]

    assert product["is_available"] is False


def test_product_filters(api_client, burger, pizza):
    other = Category.objects.create(name_fr="Pizzas")
    pizza.category = other
    pizza.is_featured = True
    pizza.save()
    url = reverse("product-list")

    assert [p["slug"] for p in api_client.get(url, {"category": other.slug}).json()["results"]] == [
        pizza.slug
    ]
    assert [p["slug"] for p in api_client.get(url, {"featured": "true"}).json()["results"]] == [
        pizza.slug
    ]


def test_product_search_covers_all_languages(api_client, burger, pizza):
    url = reverse("product-list")
    assert api_client.get(url, {"search": "كلاسيكي"}).json()["count"] == 1
    assert api_client.get(url, {"search": "classic"}).json()["count"] == 1
    assert api_client.get(url, {"search": "sushi"}).json()["count"] == 0


def test_product_ordering_by_effective_price(api_client, burger, pizza):
    pizza.sale_price = D("30.00")
    pizza.save()
    url = reverse("product-list")

    ascending = [p["slug"] for p in api_client.get(url, {"ordering": "price"}).json()["results"]]
    descending = [p["slug"] for p in api_client.get(url, {"ordering": "-price"}).json()["results"]]

    assert ascending == [pizza.slug, burger.slug]
    assert descending == [burger.slug, pizza.slug]


def test_product_detail_with_active_options(api_client, pizza):
    large = pizza.variants.get(name_fr="Grande")
    medium = pizza.variants.get(name_fr="Moyenne")
    medium.is_active = False
    medium.save()

    response = api_client.get(
        reverse("product-detail", args=[pizza.slug]), HTTP_ACCEPT_LANGUAGE="en"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["variants"] == [{"id": large.pk, "name": "Large", "price_delta": "25.00"}]
    assert body["addons"] == []
    assert body["images"] == []


def test_product_detail_404_for_inactive(api_client, burger):
    burger.is_active = False
    burger.save()

    response = api_client.get(reverse("product-detail", args=[burger.slug]))

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_product_list_query_count_does_not_grow(
    api_client, category, django_assert_max_num_queries
):
    for index in range(15):
        product = Product.objects.create(category=category, name_fr=f"P{index}", price=D("10"))
        product.variants.create(name_fr="S")

    with django_assert_max_num_queries(5):
        response = api_client.get(reverse("product-list"))

    assert response.json()["count"] == 15


def test_delivery_zones_lists_active_only(api_client, zone):
    zone.__class__.objects.create(name_fr="Loin", delivery_fee=D("50"), is_active=False)

    response = api_client.get(reverse("delivery-zone-list"), HTTP_ACCEPT_LANGUAGE="ar")

    assert response.json() == [
        {"id": zone.pk, "name": "المعاريف", "delivery_fee": "15.00", "minimum_order_amount": "0.00"}
    ]
