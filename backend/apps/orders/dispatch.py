"""
Courier dispatch: manual or automatic assignment of delivery orders, and the
two actions a courier performs (pick up, deliver).

Automatic assignment picks, among active on-duty couriers serving the order's
zone, the one with the fewest active deliveries (ties: the one waiting the
longest since their last assignment).
"""

from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.core.exceptions import BusinessRuleError
from apps.delivery.models import Courier

from .models import Order, OrderStatus, OrderType

ACTIVE_DELIVERY_STATUSES = (
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.OUT_FOR_DELIVERY,
)
FINAL_STATUSES = (OrderStatus.COMPLETED, OrderStatus.CANCELLED)


def couriers_with_load():
    """Active couriers annotated with their number of deliveries in progress."""
    return Courier.objects.filter(user__is_active=True).annotate(
        active_orders=Count("orders", filter=Q(orders__status__in=ACTIVE_DELIVERY_STATUSES))
    )


def _ensure_assignable(order: Order) -> None:
    if order.order_type != OrderType.DELIVERY:
        raise BusinessRuleError(
            "not_a_delivery",
            _("Only delivery orders can be assigned to a courier."),
            status_code=409,
        )
    if order.status in FINAL_STATUSES:
        raise BusinessRuleError("order_closed", _("This order is already closed."), status_code=409)


@transaction.atomic
def assign_courier(order: Order, courier: Courier | None) -> Order:
    """Assign (or with None, unassign) a courier, chosen by staff."""
    order = Order.objects.select_for_update().get(pk=order.pk)
    _ensure_assignable(order)
    if courier is not None and not courier.user.is_active:
        raise BusinessRuleError(
            "courier_inactive", _("This courier account is deactivated."), status_code=409
        )
    if order.picked_up_at and courier != order.courier:
        raise BusinessRuleError(
            "already_picked_up", _("The courier has already picked up this order."), status_code=409
        )
    now = timezone.now()
    order.courier = courier
    order.assigned_at = now if courier else None
    order.save(update_fields=["courier", "assigned_at", "updated_at"])
    if courier:
        Courier.objects.filter(pk=courier.pk).update(last_assigned_at=now)
    return order


def pick_courier(order: Order) -> Courier | None:
    """The best on-duty courier for the order's zone, or None."""
    if order.delivery_zone_id is None:
        return None
    return (
        couriers_with_load()
        .filter(is_on_duty=True, zones=order.delivery_zone_id)
        .order_by("active_orders", F("last_assigned_at").asc(nulls_first=True), "id")
        .first()
    )


def auto_assign(order: Order) -> Courier | None:
    """Assign the best available courier; leaves the order unassigned if none."""
    _ensure_assignable(order)
    courier = pick_courier(order)
    if courier is not None:
        assign_courier(order, courier)
    return courier


# ---------------------------------------------------------------------------
# Courier actions
# ---------------------------------------------------------------------------
def _courier_order(order: Order, courier: Courier) -> None:
    if order.courier_id != courier.pk:
        raise BusinessRuleError(
            "not_your_order", _("This order is not assigned to you."), status_code=404
        )


@transaction.atomic
def courier_pickup(order: Order, courier: Courier) -> Order:
    """The courier has the order in hand: it is now out for delivery."""
    from .services import change_order_status  # local import: services imports dispatch

    _courier_order(order, courier)
    if order.status not in (OrderStatus.CONFIRMED, OrderStatus.PREPARING):
        raise BusinessRuleError(
            "invalid_status_transition", _("This order cannot be picked up now."), status_code=409
        )
    order = change_order_status(order, OrderStatus.OUT_FOR_DELIVERY)
    order.picked_up_at = timezone.now()
    order.save(update_fields=["picked_up_at", "updated_at"])
    return order


@transaction.atomic
def courier_deliver(order: Order, courier: Courier) -> Order:
    """The customer has the order: it is completed."""
    from .services import change_order_status

    _courier_order(order, courier)
    if order.status != OrderStatus.OUT_FOR_DELIVERY:
        raise BusinessRuleError(
            "invalid_status_transition",
            _("Pick up the order before marking it delivered."),
            status_code=409,
        )
    order = change_order_status(order, OrderStatus.COMPLETED)
    order.delivered_at = timezone.now()
    order.save(update_fields=["delivered_at", "updated_at"])
    return order
