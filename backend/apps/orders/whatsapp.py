"""
WhatsApp order message.

The message is built on the server, in the customer's language, from the
saved order. The frontend only URL-encodes it into
`https://wa.me/<number>?text=<message>`; the customer must still press Send.
"""

import re

from apps.core.money import format_money

from .models import Order, OrderType

MESSAGES = {
    "fr": {
        "greeting": "Bonjour ! Je souhaite passer une commande.",
        "reference": "Référence de commande",
        "details": "DÉTAILS DE LA COMMANDE",
        "note": "Note",
        "subtotal": "Sous-total",
        "delivery": "Livraison",
        "free": "offerte",
        "total": "TOTAL",
        "customer": "Client",
        "phone": "Téléphone",
        "order_type": "Type de commande",
        "address": "Adresse",
        "zone": "Zone",
        "notes": "Remarques",
        OrderType.DELIVERY: "Livraison",
        OrderType.PICKUP: "À emporter",
    },
    "ar": {
        "greeting": "مرحباً! أود تقديم طلب.",
        "reference": "رقم الطلب",
        "details": "تفاصيل الطلب",
        "note": "ملاحظة",
        "subtotal": "المجموع الفرعي",
        "delivery": "التوصيل",
        "free": "مجاني",
        "total": "المجموع",
        "customer": "الزبون",
        "phone": "الهاتف",
        "order_type": "نوع الطلب",
        "address": "العنوان",
        "zone": "المنطقة",
        "notes": "ملاحظات",
        OrderType.DELIVERY: "توصيل",
        OrderType.PICKUP: "استلام من المطعم",
    },
    "en": {
        "greeting": "Hello! I would like to place an order.",
        "reference": "Order reference",
        "details": "ORDER DETAILS",
        "note": "Note",
        "subtotal": "Subtotal",
        "delivery": "Delivery",
        "free": "free",
        "total": "TOTAL",
        "customer": "Customer",
        "phone": "Phone",
        "order_type": "Order type",
        "address": "Address",
        "zone": "Zone",
        "notes": "Notes",
        OrderType.DELIVERY: "Delivery",
        OrderType.PICKUP: "Pickup",
    },
}

_WHITESPACE = re.compile(r"\s+")


def _single_line(value: str) -> str:
    """Customer text is flattened so it cannot fake extra message lines."""
    return _WHITESPACE.sub(" ", value or "").strip()


def _choices_by_group(item) -> list[tuple[str, list[str]]]:
    """Offer choices as [(group, ["2x Tacos Poulet (M)", ...])], in the order picked."""
    groups: dict[str, list[str]] = {}
    for choice in item.choices.all():
        groups.setdefault(choice.group_name, []).append(f"{choice.quantity}x {choice.product_name}")
    return list(groups.items())


def build_order_message(order: Order) -> str:
    """Render the message for a saved order (items and add-ons prefetched or not)."""
    text = MESSAGES.get(order.language, MESSAGES["fr"])

    def money(amount) -> str:
        return format_money(amount, order.currency)

    lines = [text["greeting"], "", f"{text['reference']}: {order.reference}", ""]
    lines.append(f"{text['details']}:")
    for item in order.items.all():
        name = item.product_name
        if item.variant_name:
            name = f"{name} ({item.variant_name})"
        lines.append(f"{item.quantity}x {name} - {money(item.line_total)}")
        for addon in item.addons.all():
            lines.append(f"   + {addon.addon_name}")
        for group_name, picks in _choices_by_group(item):
            lines.append(f"   {group_name}: {', '.join(picks)}")
        if item.special_instructions:
            lines.append(f"   {text['note']}: {_single_line(item.special_instructions)}")

    lines += ["", f"{text['subtotal']}: {money(order.subtotal)}"]
    if order.order_type == OrderType.DELIVERY:
        fee = money(order.delivery_fee) if order.delivery_fee else text["free"]
        lines.append(f"{text['delivery']}: {fee}")
    lines += ["", f"{text['total']}: {money(order.total)}", ""]

    lines.append(f"{text['customer']}: {_single_line(order.customer_name)}")
    lines.append(f"{text['phone']}: {order.customer_phone}")
    lines.append(f"{text['order_type']}: {text[order.order_type]}")
    if order.order_type == OrderType.DELIVERY:
        address = ", ".join(
            part
            for part in (_single_line(order.delivery_address), _single_line(order.city))
            if part
        )
        lines.append(f"{text['address']}: {address}")
        if order.delivery_zone_name:
            lines.append(f"{text['zone']}: {order.delivery_zone_name}")
    if order.customer_notes:
        lines.append(f"{text['notes']}: {_single_line(order.customer_notes)}")

    return "\n".join(lines)
