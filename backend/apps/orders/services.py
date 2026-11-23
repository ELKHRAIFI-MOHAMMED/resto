"""Order creation and the manual status workflow."""

import uuid
from dataclasses import dataclass

from django.conf import settings
from django.db import transaction
from django.utils import timezone, translation
from django.utils.translation import gettext as _

from apps.core.exceptions import BusinessRuleError
from apps.core.i18n import resolve_language
from apps.restaurant.models import Restaurant

from .models import (
    Order,
    OrderItem,
    OrderItemAddon,
    OrderItemChoice,
    OrderSequence,
    OrderStatus,
    OrderType,
)
from .pricing import ItemRequest, price_order
from .whatsapp import build_order_message


@dataclass(frozen=True)
class CustomerDetails:
    name: str
    phone: str  # already normalised
    delivery_address: str = ""
    city: str = ""
    notes: str = ""


def next_order_reference() -> str:
    """
    Next reference for the current year, e.g. RF-2026-0042. Must run inside a
    transaction: the year's counter row is locked until it commits, so
    concurrent orders never get the same number.
    """
    year = timezone.localdate().year
    OrderSequence.objects.bulk_create([OrderSequence(year=year)], ignore_conflicts=True)
    sequence = OrderSequence.objects.select_for_update().get(year=year)
    sequence.last_value += 1
    sequence.save(update_fields=["last_value"])
    return f"{settings.ORDER_REFERENCE_PREFIX}-{year}-{sequence.last_value:04d}"


@transaction.atomic
def create_order(
    *,
    order_type: str,
    items: list[ItemRequest],
    customer: CustomerDetails,
    delivery_zone_id: int | None = None,
    language: str | None = None,
    client_token: uuid.UUID | None = None,
) -> Order:
    """
    Validate and price the order, then save it with snapshots of every name
    and price. The order starts as PENDING: it only becomes confirmed when a
    staff member confirms it after receiving the WhatsApp message.
    """
    restaurant = Restaurant.load()
    language = resolve_language(language)
    # Snapshots (product, variant, add-on and zone names) use the order's language,
    # the same one the WhatsApp message is written in.
    with translation.override(language):
        priced = price_order(
            order_type=order_type,
            items=items,
            delivery_zone_id=delivery_zone_id,
            restaurant=restaurant,
        )
    is_delivery = order_type == OrderType.DELIVERY

    order = Order.objects.create(
        reference=next_order_reference(),
        status=OrderStatus.PENDING,
        order_type=order_type,
        customer_name=customer.name.strip(),
        customer_phone=customer.phone,
        delivery_address=customer.delivery_address.strip() if is_delivery else "",
        city=customer.city.strip(),
        delivery_zone=priced.delivery_zone,
        delivery_zone_name=priced.delivery_zone_name,
        customer_notes=customer.notes.strip(),
        language=language,
        subtotal=priced.subtotal,
        delivery_fee=priced.delivery_fee,
        total=priced.total,
        currency=priced.currency,
        whatsapp_number=restaurant.whatsapp_number,
        client_token=client_token,
    )

    order_items = OrderItem.objects.bulk_create(
        [
            OrderItem(
                order=order,
                product=item.product,
                offer=item.offer,
                product_name=item.product_name,
                product_price=item.product_price,
                variant_name=item.variant_name,
                variant_price=item.variant_price,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.line_total,
                special_instructions=item.special_instructions,
            )
            for item in priced.items
        ]
    )
    OrderItemAddon.objects.bulk_create(
        [
            OrderItemAddon(
                order_item=order_item,
                addon=addon.addon,
                addon_name=addon.name,
                addon_price=addon.price,
            )
            for order_item, item in zip(order_items, priced.items, strict=True)
            for addon in item.addons
        ]
    )

    OrderItemChoice.objects.bulk_create(
        [
            OrderItemChoice(
                order_item=order_item,
                group_name=choice.group_name,
                product=choice.product,
                product_name=choice.product_name,
                quantity=choice.quantity,
            )
            for order_item, item in zip(order_items, priced.items, strict=True)
            for choice in item.choices
        ]
    )

    order = Order.objects.prefetch_related("items__addons", "items__choices").get(pk=order.pk)
    order.whatsapp_message = build_order_message(order)
    order.save(update_fields=["whatsapp_message", "updated_at"])
    return order


def find_order_by_client_token(client_token: uuid.UUID | None) -> Order | None:
    """The order already created for this checkout attempt, if any."""
    if client_token is None:
        return None
    return (
        Order.objects.prefetch_related("items__addons", "items__choices")
        .filter(client_token=client_token)
        .first()
    )


# ---------------------------------------------------------------------------
# Status workflow (staff only, always manual)
# ---------------------------------------------------------------------------
_COMMON = {
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.PREPARING, OrderStatus.CANCELLED},
    OrderStatus.COMPLETED: set(),
    OrderStatus.CANCELLED: set(),
}
ALLOWED_TRANSITIONS: dict[str, dict[str, set[str]]] = {
    OrderType.DELIVERY: {
        **_COMMON,
        # A courier may take a confirmed order straight away (no separate "preparing" step).
        OrderStatus.CONFIRMED: {
            OrderStatus.PREPARING,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.CANCELLED,
        },
        OrderStatus.PREPARING: {OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED},
        OrderStatus.OUT_FOR_DELIVERY: {OrderStatus.COMPLETED, OrderStatus.CANCELLED},
    },
    OrderType.PICKUP: {
        **_COMMON,
        OrderStatus.PREPARING: {OrderStatus.READY, OrderStatus.CANCELLED},
        OrderStatus.READY: {OrderStatus.COMPLETED, OrderStatus.CANCELLED},
    },
}


def allowed_next_statuses(order: Order) -> list[str]:
    allowed = ALLOWED_TRANSITIONS[order.order_type].get(order.status, set())
    return [status for status in OrderStatus.values if status in allowed]


@transaction.atomic
def change_order_status(order: Order, new_status: str) -> Order:
    order = Order.objects.select_for_update().get(pk=order.pk)
    if new_status not in allowed_next_statuses(order):
        raise BusinessRuleError(
            "invalid_status_transition",
            _("An order cannot go from “%(current)s” to “%(new)s”.")
            % {"current": order.get_status_display(), "new": OrderStatus(new_status).label},
            {"current": order.status, "allowed": allowed_next_statuses(order)},
            status_code=409,
        )
    order.status = new_status
    fields = ["status", "updated_at"]
    if new_status == OrderStatus.CONFIRMED and order.confirmed_at is None:
        order.confirmed_at = timezone.now()
        fields.append("confirmed_at")
    order.save(update_fields=fields)

    # Automatic dispatch: a newly confirmed delivery goes to a courier of its zone.
    if (
        new_status == OrderStatus.CONFIRMED
        and order.order_type == OrderType.DELIVERY
        and order.courier_id is None
        and Restaurant.load().auto_assign_couriers
    ):
        from .dispatch import auto_assign  # dispatch imports this module

        auto_assign(order)
        order.refresh_from_db()
    return order
