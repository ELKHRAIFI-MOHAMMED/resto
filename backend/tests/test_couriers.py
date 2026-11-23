"""Couriers: accounts, permissions, manual and automatic dispatch, courier app."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.delivery.models import Courier, DeliveryZone
from apps.orders.dispatch import pick_courier
from apps.orders.models import Order, OrderStatus
from apps.orders.pricing import ItemRequest
from apps.orders.services import CustomerDetails, change_order_status, create_order
from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db


def make_courier(email, zones=(), on_duty=True, **extra) -> Courier:
    user = User.objects.create_user(
        email=email, password=PASSWORD, role=User.Role.COURIER, first_name=email.split("@")[0]
    )
    courier = Courier.objects.create(user=user, is_on_duty=on_duty, phone="0611111111", **extra)
    courier.zones.set(zones)
    return courier


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_login(user)
    return client


def place_delivery(product, zone) -> Order:
    return create_order(
        order_type="delivery",
        items=[ItemRequest(product.pk, quantity=2)],
        customer=CustomerDetails(
            name="Sara", phone="+212612345678", delivery_address="1 rue X", city="Casablanca"
        ),
        delivery_zone_id=zone.pk,
        language="fr",
    )


@pytest.fixture
def other_zone(db) -> DeliveryZone:
    return DeliveryZone.objects.create(name_fr="Anfa", delivery_fee="20.00")


# --- Accounts and permissions -------------------------------------------------------


def test_courier_can_log_in_but_not_use_the_admin(api_client, zone):
    courier = make_courier("rider@example.com", [zone])

    login = api_client.post(
        "/api/auth/login/", {"email": "rider@example.com", "password": PASSWORD}, format="json"
    )
    assert login.status_code == 200
    assert login.json()["is_courier"] is True

    client = client_for(courier.user)
    assert client.get("/api/admin/orders/").status_code == 403
    assert client.get("/api/admin/dashboard/").status_code == 403
    assert client.get("/api/courier/me/").status_code == 200


def test_staff_cannot_use_the_courier_app(manager_client):
    assert manager_client.get("/api/courier/orders/").status_code == 403


def test_admin_creates_updates_and_deletes_a_courier(manager_client, zone, other_zone):
    created = manager_client.post(
        "/api/admin/couriers/",
        {
            "email": "New.Rider@Example.com",
            "first_name": "Youssef",
            "phone": "0611111111",
            "password": "a-strong-courier-pass",
            "zones": [zone.pk],
        },
        format="json",
    )
    assert created.status_code == 201, created.json()
    body = created.json()
    assert body["email"] == "new.rider@example.com"
    assert "password" not in body
    user = User.objects.get(email="new.rider@example.com")
    assert user.role == User.Role.COURIER
    assert not user.is_staff
    assert user.check_password("a-strong-courier-pass")

    courier_id = body["id"]
    updated = manager_client.patch(
        f"/api/admin/couriers/{courier_id}/",
        {"zones": [zone.pk, other_zone.pk], "is_active": False},
        format="json",
    )
    assert updated.status_code == 200
    assert sorted(updated.json()["zones"]) == sorted([zone.pk, other_zone.pk])
    assert updated.json()["is_active"] is False

    assert manager_client.delete(f"/api/admin/couriers/{courier_id}/").status_code == 204
    assert not User.objects.filter(email="new.rider@example.com").exists()


def test_new_courier_requires_password_and_unique_email(manager_client, admin_user):
    missing = manager_client.post("/api/admin/couriers/", {"email": "x@example.com"}, format="json")
    assert "password" in missing.json()["error"]["details"]

    taken = manager_client.post(
        "/api/admin/couriers/",
        {"email": "OWNER@example.com", "password": "a-strong-courier-pass"},
        format="json",
    )
    assert "email" in taken.json()["error"]["details"]


# --- Dispatch ---------------------------------------------------------------------


def test_auto_assign_on_confirmation_picks_least_busy_courier_of_the_zone(
    restaurant, burger, zone, other_zone
):
    busy = make_courier("busy@example.com", [zone])
    free = make_courier("free@example.com", [zone])
    make_courier("elsewhere@example.com", [other_zone])
    make_courier("off@example.com", [zone], on_duty=False)
    previous = place_delivery(burger, zone)
    previous.courier = busy
    previous.status = OrderStatus.CONFIRMED
    previous.save()

    order = change_order_status(place_delivery(burger, zone), OrderStatus.CONFIRMED)

    assert order.courier == free
    assert order.assigned_at is not None


def test_ties_go_to_the_courier_waiting_longest(restaurant, burger, zone):
    recent = make_courier("recent@example.com", [zone], last_assigned_at=timezone.now())
    waiting = make_courier(
        "waiting@example.com", [zone], last_assigned_at=timezone.now() - timedelta(hours=2)
    )
    assert pick_courier(place_delivery(burger, zone)) == waiting
    assert recent != waiting


def test_auto_assign_can_be_disabled(restaurant, burger, zone):
    restaurant.auto_assign_couriers = False
    restaurant.save()
    make_courier("rider@example.com", [zone])

    order = change_order_status(place_delivery(burger, zone), OrderStatus.CONFIRMED)

    assert order.courier is None


def test_no_courier_for_the_zone_leaves_the_order_unassigned(restaurant, burger, zone, other_zone):
    make_courier("elsewhere@example.com", [other_zone])

    order = change_order_status(place_delivery(burger, zone), OrderStatus.CONFIRMED)

    assert order.courier is None


def test_manual_assignment_and_auto_assign_endpoint(manager_client, restaurant, burger, zone):
    restaurant.auto_assign_couriers = False
    restaurant.save()
    rider = make_courier("rider@example.com", [zone])
    order = place_delivery(burger, zone)

    assigned = manager_client.patch(
        f"/api/admin/orders/{order.pk}/courier/", {"courier": rider.pk}, format="json"
    )
    assert assigned.status_code == 200
    assert assigned.json()["courier_name"] == "rider"

    unassigned = manager_client.patch(
        f"/api/admin/orders/{order.pk}/courier/", {"courier": None}, format="json"
    )
    assert unassigned.json()["courier"] is None

    auto = manager_client.post(f"/api/admin/orders/{order.pk}/auto-assign/")
    assert auto.status_code == 200
    assert auto.json()["courier"] == rider.pk

    listed = manager_client.get("/api/admin/orders/", {"unassigned": "true"}).json()
    assert listed["count"] == 0


def test_auto_assign_without_available_courier_returns_409(
    manager_client, restaurant, burger, zone
):
    order = place_delivery(burger, zone)

    response = manager_client.post(f"/api/admin/orders/{order.pk}/auto-assign/")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "no_courier_available"


def test_pickup_orders_cannot_get_a_courier(manager_client, restaurant, burger, zone):
    rider = make_courier("rider@example.com", [zone])
    order = create_order(
        order_type="pickup",
        items=[ItemRequest(burger.pk, quantity=1)],
        customer=CustomerDetails(name="Sara", phone="+212612345678"),
        language="fr",
    )

    response = manager_client.patch(
        f"/api/admin/orders/{order.pk}/courier/", {"courier": rider.pk}, format="json"
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "not_a_delivery"


# --- Courier app -------------------------------------------------------------------


def test_courier_sees_only_their_orders_and_delivers_them(restaurant, burger, zone):
    rider = make_courier("rider@example.com", [zone])
    other = make_courier("other@example.com", [zone])
    mine = change_order_status(place_delivery(burger, zone), OrderStatus.CONFIRMED)
    assert mine.courier == rider  # first on-duty courier of the zone
    theirs = place_delivery(burger, zone)
    theirs.courier = other
    theirs.status = OrderStatus.CONFIRMED
    theirs.save()
    client = client_for(rider.user)

    active = client.get("/api/courier/orders/").json()
    assert [order["reference"] for order in active] == [mine.reference]
    assert client.get(f"/api/courier/orders/{theirs.pk}/").status_code == 404

    deliver_too_early = client.post(f"/api/courier/orders/{mine.pk}/deliver/")
    assert deliver_too_early.status_code == 409

    picked = client.post(f"/api/courier/orders/{mine.pk}/pickup/")
    assert picked.status_code == 200
    assert picked.json()["status"] == "out_for_delivery"
    assert picked.json()["picked_up_at"]

    delivered = client.post(f"/api/courier/orders/{mine.pk}/deliver/")
    assert delivered.json()["status"] == "completed"
    assert delivered.json()["delivered_at"]
    assert client.get("/api/courier/orders/").json() == []
    assert [o["reference"] for o in client.get("/api/courier/orders/?scope=done").json()] == [
        mine.reference
    ]


def test_courier_cannot_act_on_someone_elses_order(restaurant, burger, zone):
    rider = make_courier("rider@example.com", [zone], on_duty=False)
    other = make_courier("other@example.com", [zone])
    order = change_order_status(place_delivery(burger, zone), OrderStatus.CONFIRMED)
    assert order.courier == other

    response = client_for(rider.user).post(f"/api/courier/orders/{order.pk}/pickup/")

    assert response.status_code == 404


def test_courier_toggles_duty(zone):
    rider = make_courier("rider@example.com", [zone], on_duty=False)
    client = client_for(rider.user)

    response = client.patch("/api/courier/me/", {"is_on_duty": True, "phone": "000"}, format="json")

    assert response.status_code == 200
    rider.refresh_from_db()
    assert rider.is_on_duty is True
    assert rider.phone == "0611111111"  # read-only for couriers
    assert response.json()["zones"] == ["Maârif"]
