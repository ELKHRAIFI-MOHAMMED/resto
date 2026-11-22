from decimal import Decimal

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.categories.models import Category
from apps.orders.models import Order, OrderStatus
from apps.orders.pricing import ItemRequest
from apps.orders.services import CustomerDetails, create_order
from apps.products.models import Product
from tests.conftest import PASSWORD, make_image

D = Decimal
pytestmark = pytest.mark.django_db

ADMIN_URLS = [
    ("get", "/api/admin/dashboard/"),
    ("get", "/api/admin/orders/"),
    ("get", "/api/admin/products/"),
    ("post", "/api/admin/products/"),
    ("get", "/api/admin/categories/"),
    ("post", "/api/admin/categories/"),
    ("get", "/api/admin/addons/"),
    ("get", "/api/admin/delivery/zones/"),
    ("get", "/api/admin/settings/"),
    ("patch", "/api/admin/settings/"),
    ("get", "/api/admin/settings/hours/"),
]


def _place_order(product, order_type="pickup", zone=None, **customer) -> Order:
    return create_order(
        order_type=order_type,
        items=[ItemRequest(product.pk, quantity=2)],
        customer=CustomerDetails(
            name=customer.get("name", "Sara"),
            phone=customer.get("phone", "+212612345678"),
            delivery_address="1 rue X",
            city="Casablanca",
        ),
        delivery_zone_id=zone.pk if zone else None,
        language="fr",
    )


# --- Permissions ------------------------------------------------------------------


@pytest.mark.parametrize(("method", "url"), ADMIN_URLS)
def test_admin_endpoints_reject_anonymous(api_client, method, url):
    response = getattr(api_client, method)(url, {}, format="json")
    assert response.status_code == 403


@pytest.mark.parametrize(("method", "url"), ADMIN_URLS)
def test_admin_endpoints_reject_non_staff(django_user_model, method, url):
    user = django_user_model.objects.create_user(email="user@example.com", password=PASSWORD)
    client = APIClient()
    client.force_login(user)

    response = getattr(client, method)(url, {}, format="json")

    assert response.status_code == 403


def test_settings_are_owner_only(manager_client, owner_client, restaurant):
    assert manager_client.get("/api/admin/settings/").status_code == 403
    assert manager_client.get("/api/admin/settings/hours/").status_code == 403
    assert manager_client.get("/api/admin/products/").status_code == 200
    assert owner_client.get("/api/admin/settings/").status_code == 200


# --- Settings ---------------------------------------------------------------------


def test_update_settings_normalises_whatsapp_number(owner_client, restaurant):
    response = owner_client.patch(
        "/api/admin/settings/",
        {"whatsapp_number": "+212 6 11 22 33 44", "free_delivery_threshold": "250.00"},
        format="json",
    )

    assert response.status_code == 200
    restaurant.refresh_from_db()
    assert restaurant.whatsapp_number == "212611223344"
    assert restaurant.free_delivery_threshold == D("250.00")


def test_invalid_whatsapp_number_is_rejected(owner_client, restaurant):
    response = owner_client.patch(
        "/api/admin/settings/", {"whatsapp_number": "not a number"}, format="json"
    )

    assert response.status_code == 400
    assert "whatsapp_number" in response.json()["error"]["details"]


def test_replace_opening_hours(owner_client, restaurant):
    response = owner_client.put(
        "/api/admin/settings/hours/",
        {
            "hours": [
                {"weekday": 0, "opens_at": "12:00", "closes_at": "15:00"},
                {"weekday": 0, "opens_at": "19:00", "closes_at": "01:00"},
                {"weekday": 6, "is_closed": True, "opens_at": "10:00"},
            ]
        },
        format="json",
    )

    assert response.status_code == 200
    assert len(response.json()) == 3
    assert restaurant.opening_hours.get(weekday=6).opens_at is None


def test_opening_hours_validation(owner_client, restaurant):
    response = owner_client.put(
        "/api/admin/settings/hours/",
        {"hours": [{"weekday": 0, "opens_at": "12:00"}]},
        format="json",
    )
    assert response.status_code == 400


# --- Categories -------------------------------------------------------------------


def test_category_crud_and_translations(manager_client):
    created = manager_client.post(
        "/api/admin/categories/",
        {"name_fr": "Entrées", "name_ar": "مقبلات", "name_en": "Starters", "display_order": 2},
        format="json",
    )
    assert created.status_code == 201
    category_id = created.json()["id"]
    assert created.json()["slug"] == "entrees"

    updated = manager_client.patch(
        f"/api/admin/categories/{category_id}/", {"is_active": False}, format="json"
    )
    assert updated.json()["is_active"] is False

    assert manager_client.delete(f"/api/admin/categories/{category_id}/").status_code == 204


def test_category_with_products_cannot_be_deleted(manager_client, burger):
    response = manager_client.delete(f"/api/admin/categories/{burger.category_id}/")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "protected"


def test_reorder_categories(manager_client):
    first = Category.objects.create(name_fr="A")
    second = Category.objects.create(name_fr="B")

    response = manager_client.post(
        "/api/admin/categories/reorder/", {"ids": [second.pk, first.pk]}, format="json"
    )

    assert response.status_code == 200
    assert [c["id"] for c in response.json()] == [second.pk, first.pk]


def test_category_image_upload(manager_client, category):
    response = manager_client.patch(
        f"/api/admin/categories/{category.pk}/", {"image": make_image()}, format="multipart"
    )

    assert response.status_code == 200
    assert response.json()["image"].startswith("http://testserver/media/categories/")


# --- Products ---------------------------------------------------------------------


def test_product_create_with_translations_and_addons(manager_client, category, cheese):
    response = manager_client.post(
        "/api/admin/products/",
        {
            "category": category.pk,
            "name_fr": "Burger végétarien",
            "name_ar": "برغر نباتي",
            "name_en": "Veggie burger",
            "price": "48.00",
            "sale_price": "42.00",
            "addons": [cheese.pk],
        },
        format="json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "burger-vegetarien"
    assert body["effective_price"] == "42.00"
    assert body["addons"] == [cheese.pk]


def test_product_sale_price_must_be_below_price(manager_client, burger):
    response = manager_client.patch(
        f"/api/admin/products/{burger.pk}/", {"sale_price": "60.00"}, format="json"
    )

    assert response.status_code == 400
    assert "sale_price" in response.json()["error"]["details"]


def test_product_image_upload_and_clear(manager_client, burger):
    uploaded = manager_client.patch(
        f"/api/admin/products/{burger.pk}/", {"image": make_image()}, format="multipart"
    )
    assert uploaded.status_code == 200
    assert "/media/products/" in uploaded.json()["image"]

    cleared = manager_client.patch(
        f"/api/admin/products/{burger.pk}/", {"image": None}, format="json"
    )
    assert cleared.status_code == 200
    assert cleared.json()["image"] is None


def test_upload_rejects_non_images(manager_client, burger):
    from django.core.files.uploadedfile import SimpleUploadedFile

    fake = SimpleUploadedFile("evil.png", b"<script>alert(1)</script>", content_type="image/png")

    response = manager_client.patch(
        f"/api/admin/products/{burger.pk}/", {"image": fake}, format="multipart"
    )

    assert response.status_code == 400


def test_upload_rejects_disallowed_extension(manager_client, burger):
    response = manager_client.patch(
        f"/api/admin/products/{burger.pk}/",
        {"image": make_image(name="photo.gif", fmt="GIF")},
        format="multipart",
    )

    assert response.status_code == 400


@override_settings(MAX_IMAGE_UPLOAD_SIZE=100)
def test_upload_rejects_oversized_files(manager_client, burger):
    response = manager_client.patch(
        f"/api/admin/products/{burger.pk}/",
        {"image": make_image(size=(200, 200))},
        format="multipart",
    )

    assert response.status_code == 400


def test_product_variants_nested_crud(manager_client, burger):
    url = f"/api/admin/products/{burger.pk}/variants/"

    created = manager_client.post(url, {"name_fr": "Double", "price_delta": "20.00"}, format="json")
    assert created.status_code == 201
    assert created.json()["product"] == burger.pk

    duplicate = manager_client.post(url, {"name_fr": "double"}, format="json")
    assert duplicate.status_code == 400

    variant_id = created.json()["id"]
    assert (
        manager_client.patch(f"{url}{variant_id}/", {"is_active": False}, format="json").status_code
        == 200
    )
    assert len(manager_client.get(url).json()) == 1
    assert manager_client.delete(f"{url}{variant_id}/").status_code == 204


def test_product_gallery_images(manager_client, burger):
    url = f"/api/admin/products/{burger.pk}/images/"

    response = manager_client.post(
        url, {"image": make_image(), "display_order": 1}, format="multipart"
    )

    assert response.status_code == 201
    assert burger.images.count() == 1


def test_nested_routes_404_for_unknown_product(manager_client):
    assert (
        manager_client.post(
            "/api/admin/products/999/variants/", {"name_fr": "X"}, format="json"
        ).status_code
        == 404
    )


def test_deleting_a_product_keeps_order_history(manager_client, restaurant, burger):
    order = _place_order(burger)

    assert manager_client.delete(f"/api/admin/products/{burger.pk}/").status_code == 204

    item = order.items.get()
    assert item.product is None
    assert item.product_name == "Burger classique"


def test_admin_product_filters_and_search(manager_client, burger, pizza):
    Product.objects.filter(pk=pizza.pk).update(is_active=False)

    inactive = manager_client.get("/api/admin/products/", {"is_active": "false"}).json()
    search = manager_client.get("/api/admin/products/", {"search": "burger"}).json()

    assert [p["id"] for p in inactive["results"]] == [pizza.pk]
    assert [p["id"] for p in search["results"]] == [burger.pk]


# --- Delivery zones ---------------------------------------------------------------


def test_delivery_zone_crud(manager_client):
    created = manager_client.post(
        "/api/admin/delivery/zones/",
        {"name_fr": "Anfa", "delivery_fee": "20.00", "minimum_order_amount": "80.00"},
        format="json",
    )
    assert created.status_code == 201

    negative = manager_client.post(
        "/api/admin/delivery/zones/", {"name_fr": "Bad", "delivery_fee": "-5"}, format="json"
    )
    assert negative.status_code == 400


# --- Orders -----------------------------------------------------------------------


def test_order_list_filters_and_search(manager_client, restaurant, burger, zone):
    pickup = _place_order(burger, name="Sara")
    delivery = _place_order(burger, order_type="delivery", zone=zone, name="Youssef")

    url = "/api/admin/orders/"
    all_orders = manager_client.get(url).json()
    by_type = manager_client.get(url, {"order_type": "delivery"}).json()
    by_name = manager_client.get(url, {"search": "sara"}).json()
    by_reference = manager_client.get(url, {"search": delivery.reference}).json()
    by_status = manager_client.get(url, {"status": ["pending", "confirmed"]}).json()

    assert all_orders["count"] == 2
    assert all_orders["results"][0]["item_count"] == 1
    assert [o["id"] for o in by_type["results"]] == [delivery.pk]
    assert [o["id"] for o in by_name["results"]] == [pickup.pk]
    assert [o["id"] for o in by_reference["results"]] == [delivery.pk]
    assert by_status["count"] == 2


def test_order_date_filters(manager_client, restaurant, burger):
    order = _place_order(burger)
    today = order.created_at.date().isoformat()

    assert manager_client.get("/api/admin/orders/", {"date_from": today}).json()["count"] == 1
    assert manager_client.get("/api/admin/orders/", {"date_to": "2000-01-01"}).json()["count"] == 0


def test_order_detail_shows_snapshots(manager_client, restaurant, burger):
    order = _place_order(burger)

    body = manager_client.get(f"/api/admin/orders/{order.pk}/").json()

    assert body["reference"] == order.reference
    assert body["items"][0]["product_name"] == "Burger classique"
    assert body["allowed_statuses"] == ["confirmed", "cancelled"]
    assert body["whatsapp_message"].startswith("Bonjour")


def test_manual_status_workflow_for_delivery(manager_client, restaurant, burger, zone):
    order = _place_order(burger, order_type="delivery", zone=zone)
    url = f"/api/admin/orders/{order.pk}/status/"

    for status in ["confirmed", "preparing", "out_for_delivery", "completed"]:
        response = manager_client.patch(url, {"status": status}, format="json")
        assert response.status_code == 200, response.json()

    order.refresh_from_db()
    assert order.status == OrderStatus.COMPLETED
    assert order.confirmed_at is not None


@pytest.mark.parametrize(
    ("order_type", "target"),
    [("pickup", "completed"), ("pickup", "preparing"), ("pickup", "out_for_delivery")],
)
def test_invalid_status_transitions_return_409(
    manager_client, restaurant, burger, order_type, target
):
    order = _place_order(burger, order_type=order_type)

    response = manager_client.patch(
        f"/api/admin/orders/{order.pk}/status/", {"status": target}, format="json"
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_status_transition"
    order.refresh_from_db()
    assert order.status == OrderStatus.PENDING


def test_cancelled_orders_are_final(manager_client, restaurant, burger):
    order = _place_order(burger)
    url = f"/api/admin/orders/{order.pk}/status/"
    manager_client.patch(url, {"status": "cancelled"}, format="json")

    response = manager_client.patch(url, {"status": "confirmed"}, format="json")

    assert response.status_code == 409


def test_orders_are_read_only_except_status(manager_client, restaurant, burger):
    order = _place_order(burger)

    assert (
        manager_client.patch(
            f"/api/admin/orders/{order.pk}/", {"total": "1"}, format="json"
        ).status_code
        == 405
    )
    assert manager_client.delete(f"/api/admin/orders/{order.pk}/").status_code == 405


# --- Dashboard --------------------------------------------------------------------


def test_dashboard_statistics(manager_client, restaurant, burger, pizza):
    confirmed = _place_order(burger)  # 2 x 50 = 100
    _place_order(burger)
    cancelled = _place_order(burger)
    manager_client.patch(
        f"/api/admin/orders/{confirmed.pk}/status/", {"status": "confirmed"}, format="json"
    )
    manager_client.patch(
        f"/api/admin/orders/{cancelled.pk}/status/", {"status": "cancelled"}, format="json"
    )
    Product.objects.filter(pk=pizza.pk).update(is_available=False)

    response = manager_client.get("/api/admin/dashboard/", {"days": 7})

    assert response.status_code == 200
    body = response.json()
    assert body["orders"]["initiated"] == 3
    assert body["orders"]["confirmed"] == 1
    assert body["orders"]["revenue"] == "100.00"
    assert body["orders"]["by_status"]["pending"] == 1
    assert body["orders"]["by_status"]["cancelled"] == 1
    assert body["products"] == {"total": 2, "active": 2, "available": 1}
    assert body["popular_products"][0]["name"] == "Burger classique"
    assert body["popular_products"][0]["quantity"] == 4  # cancelled order excluded
    assert len(body["orders_by_date"]) == 7
    assert body["orders_by_date"][-1]["orders"] == 3


def test_dashboard_rejects_invalid_period(manager_client):
    assert manager_client.get("/api/admin/dashboard/", {"days": 0}).status_code == 400
