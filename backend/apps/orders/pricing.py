"""
Authoritative order pricing.

The client only sends identifiers and quantities. Every price, availability
rule, delivery fee and minimum order is evaluated here, from the database.
`price_order` has no side effects, so it powers both the checkout quote and
order creation.
"""

from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings
from django.db.models import Prefetch
from django.utils.translation import gettext as _

from apps.core.exceptions import BusinessRuleError
from apps.core.i18n import localized_value
from apps.core.money import ZERO, quantize
from apps.delivery.models import DeliveryZone
from apps.products.models import Addon, Product, ProductVariant
from apps.restaurant.models import Restaurant

from .models import OrderType


class OrderValidationError(BusinessRuleError):
    """An order that cannot be accepted as submitted (400)."""


class OrderingUnavailableError(BusinessRuleError):
    """The restaurant cannot take orders right now (409)."""

    status_code = 409


@dataclass(frozen=True)
class ItemRequest:
    product_id: int
    quantity: int
    variant_id: int | None = None
    addon_ids: tuple[int, ...] = ()
    special_instructions: str = ""


@dataclass
class PricedAddon:
    addon: Addon
    name: str
    price: Decimal


@dataclass
class PricedItem:
    product: Product
    product_name: str
    product_price: Decimal
    variant: ProductVariant | None
    variant_name: str
    variant_price: Decimal
    addons: list[PricedAddon]
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    special_instructions: str


@dataclass
class PricedOrder:
    order_type: str | None
    items: list[PricedItem]
    subtotal: Decimal
    delivery_fee: Decimal
    total: Decimal
    currency: str
    delivery_zone: DeliveryZone | None = None
    delivery_zone_name: str = ""
    minimum_order_amount: Decimal = ZERO
    free_delivery_applied: bool = False


def _item_error(index: int, code: str, message: str) -> dict:
    return {"index": index, "code": code, "message": message}


def _load_products(product_ids: set[int]) -> dict[int, Product]:
    products = (
        Product.objects.filter(pk__in=product_ids, is_active=True, category__is_active=True)
        .select_related("category")
        .prefetch_related(
            Prefetch("variants", queryset=ProductVariant.objects.filter(is_active=True)),
            Prefetch("addons", queryset=Addon.objects.filter(is_active=True)),
        )
    )
    return {product.pk: product for product in products}


def _price_item(index: int, request: ItemRequest, product: Product | None, errors: list[dict]):
    if product is None:
        errors.append(
            _item_error(index, "product_not_found", _("This product is no longer on the menu."))
        )
        return None
    if not product.is_available:
        errors.append(
            _item_error(index, "product_unavailable", _("This product is currently unavailable."))
        )
        return None

    variants = {variant.pk: variant for variant in product.variants.all()}
    variant = None
    if variants:
        if request.variant_id is None:
            errors.append(_item_error(index, "variant_required", _("Please choose an option.")))
            return None
        variant = variants.get(request.variant_id)
        if variant is None:
            errors.append(
                _item_error(index, "variant_invalid", _("The selected option is not available."))
            )
            return None
    elif request.variant_id is not None:
        errors.append(
            _item_error(index, "variant_invalid", _("The selected option is not available."))
        )
        return None

    offered_addons = {addon.pk: addon for addon in product.addons.all()}
    if len(set(request.addon_ids)) != len(request.addon_ids) or not set(request.addon_ids).issubset(
        offered_addons
    ):
        errors.append(
            _item_error(index, "addon_invalid", _("One of the selected extras is not available."))
        )
        return None
    addons = [
        PricedAddon(
            addon=offered_addons[addon_id],
            name=localized_value(offered_addons[addon_id], "name"),
            price=offered_addons[addon_id].price,
        )
        for addon_id in request.addon_ids
    ]

    product_price = product.effective_price
    variant_price = variant.price_delta if variant else ZERO
    unit_price = quantize(product_price + variant_price + sum((a.price for a in addons), ZERO))
    return PricedItem(
        product=product,
        product_name=localized_value(product, "name"),
        product_price=product_price,
        variant=variant,
        variant_name=localized_value(variant, "name") if variant else "",
        variant_price=variant_price,
        addons=addons,
        quantity=request.quantity,
        unit_price=unit_price,
        line_total=quantize(unit_price * request.quantity),
        special_instructions=request.special_instructions.strip(),
    )


def ensure_ordering_available(restaurant: Restaurant, order_type: str | None) -> None:
    if not restaurant.is_accepting_orders:
        raise OrderingUnavailableError(
            "ordering_closed", _("The restaurant is not accepting orders at the moment.")
        )
    if not restaurant.whatsapp_number:
        raise OrderingUnavailableError(
            "whatsapp_not_configured", _("Online ordering is not configured yet.")
        )
    if order_type is None:
        return  # cart quote: the order type is chosen later, at checkout
    enabled = {
        OrderType.DELIVERY: restaurant.delivery_enabled,
        OrderType.PICKUP: restaurant.pickup_enabled,
    }
    if not enabled.get(order_type, False):
        raise OrderValidationError(
            "order_type_unavailable",
            _("This order type is not available."),
            {"order_type": order_type},
        )


def price_order(
    *,
    order_type: str | None,
    items: list[ItemRequest],
    delivery_zone_id: int | None = None,
    restaurant: Restaurant | None = None,
) -> PricedOrder:
    """
    Price an order. Without `order_type` (the cart page), only the items are
    validated and priced; delivery rules apply once a type is chosen.
    """
    restaurant = restaurant or Restaurant.load()
    ensure_ordering_available(restaurant, order_type)

    if not items:
        raise OrderValidationError("empty_order", _("Your order is empty."))
    if len(items) > settings.ORDER_MAX_LINES:
        raise OrderValidationError("too_many_items", _("Your order has too many items."))

    products = _load_products({item.product_id for item in items})
    errors: list[dict] = []
    priced_items = []
    for index, request in enumerate(items):
        priced = _price_item(index, request, products.get(request.product_id), errors)
        if priced:
            priced_items.append(priced)
    if errors:
        raise OrderValidationError(
            "invalid_items", _("Some items in your order need attention."), {"items": errors}
        )

    subtotal = quantize(sum((item.line_total for item in priced_items), ZERO))
    delivery_fee = ZERO
    zone = None
    minimum = ZERO
    free_delivery = False

    if order_type == OrderType.DELIVERY:
        if delivery_zone_id is None:
            raise OrderValidationError(
                "delivery_zone_required", _("Please choose your delivery zone.")
            )
        zone = DeliveryZone.objects.filter(pk=delivery_zone_id, is_active=True).first()
        if zone is None:
            raise OrderValidationError(
                "delivery_zone_invalid", _("We do not deliver to this zone.")
            )
        minimum = max(zone.minimum_order_amount, restaurant.minimum_order_amount)
        if subtotal < minimum:
            raise OrderValidationError(
                "minimum_order_not_met",
                _("The minimum order for delivery is %(amount)s %(currency)s.")
                % {"amount": minimum, "currency": restaurant.currency},
                {"minimum_order_amount": str(minimum), "subtotal": str(subtotal)},
            )
        threshold = restaurant.free_delivery_threshold
        free_delivery = threshold is not None and subtotal >= threshold
        delivery_fee = ZERO if free_delivery else zone.delivery_fee

    return PricedOrder(
        order_type=order_type,
        items=priced_items,
        subtotal=subtotal,
        delivery_fee=quantize(delivery_fee),
        total=quantize(subtotal + delivery_fee),
        currency=restaurant.currency,
        delivery_zone=zone,
        delivery_zone_name=localized_value(zone, "name") if zone else "",
        minimum_order_amount=minimum,
        free_delivery_applied=free_delivery,
    )
