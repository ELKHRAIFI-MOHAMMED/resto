"""
Orders keep **snapshots** of every name and price at the time of ordering.
Foreign keys to the catalog are informational only (SET_NULL): editing or
deleting a product never changes a past order.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.core.money import ZERO, money_field
from apps.delivery.models import DeliveryZone
from apps.products.models import Addon, Product


class OrderStatus(models.TextChoices):
    # The customer was sent to WhatsApp; the restaurant has not confirmed yet.
    PENDING = "pending", _("Pending confirmation")
    CONFIRMED = "confirmed", _("Confirmed")
    PREPARING = "preparing", _("Preparing")
    READY = "ready", _("Ready for pickup")
    OUT_FOR_DELIVERY = "out_for_delivery", _("Out for delivery")
    COMPLETED = "completed", _("Completed")
    CANCELLED = "cancelled", _("Cancelled")


class OrderType(models.TextChoices):
    DELIVERY = "delivery", _("Delivery")
    PICKUP = "pickup", _("Pickup")


class Order(TimeStampedModel):
    reference = models.CharField(_("reference"), max_length=20, unique=True, editable=False)
    status = models.CharField(
        _("status"), max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING
    )
    order_type = models.CharField(_("order type"), max_length=10, choices=OrderType.choices)

    # Customer
    customer_name = models.CharField(_("customer name"), max_length=120)
    customer_phone = models.CharField(_("customer phone"), max_length=20)
    delivery_address = models.CharField(_("delivery address"), max_length=255, blank=True)
    city = models.CharField(_("city"), max_length=100, blank=True)
    delivery_zone = models.ForeignKey(
        DeliveryZone,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name=_("delivery zone"),
    )
    delivery_zone_name = models.CharField(_("delivery zone (snapshot)"), max_length=120, blank=True)
    customer_notes = models.TextField(_("customer notes"), blank=True)
    language = models.CharField(
        _("language"), max_length=5, choices=settings.LANGUAGES, default=settings.LANGUAGE_CODE
    )

    # Amounts (authoritative, computed by the backend)
    subtotal = money_field(_("subtotal"))
    delivery_fee = money_field(_("delivery fee"), default=ZERO)
    total = money_field(_("total"))
    currency = models.CharField(_("currency"), max_length=3)

    # WhatsApp hand-off snapshot: retrying sends exactly the same message.
    whatsapp_number = models.CharField(_("WhatsApp number"), max_length=15)
    whatsapp_message = models.TextField(_("WhatsApp message"), blank=True)

    confirmed_at = models.DateTimeField(_("confirmed at"), null=True, blank=True)

    # Random token sent by the client with each checkout attempt. Retrying the
    # same attempt (e.g. after a dropped connection) returns the existing order
    # instead of creating a duplicate.
    client_token = models.UUIDField(
        _("client token"), null=True, blank=True, unique=True, editable=False
    )

    class Meta:
        verbose_name = _("order")
        verbose_name_plural = _("orders")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["customer_phone"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(subtotal__gte=0) & models.Q(delivery_fee__gte=0),
                name="order_amounts_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(total=models.F("subtotal") + models.F("delivery_fee")),
                name="order_total_matches",
            ),
            models.CheckConstraint(
                condition=~models.Q(order_type=OrderType.PICKUP) | models.Q(delivery_fee=0),
                name="order_pickup_has_no_delivery_fee",
            ),
        ]

    def __str__(self) -> str:
        return self.reference

    @property
    def is_confirmed(self) -> bool:
        return self.confirmed_at is not None


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
        verbose_name=_("product"),
    )
    product_name = models.CharField(_("product name (snapshot)"), max_length=160)
    product_price = money_field(_("product price (snapshot)"))
    variant_name = models.CharField(_("variant (snapshot)"), max_length=120, blank=True)
    variant_price = money_field(_("variant price (snapshot)"), default=ZERO)
    quantity = models.PositiveSmallIntegerField(_("quantity"))
    # Product price + variant price + add-on prices, for one unit.
    unit_price = money_field(_("unit price (snapshot)"))
    line_total = money_field(_("line total"))
    special_instructions = models.CharField(_("special instructions"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("order item")
        verbose_name_plural = _("order items")
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1), name="order_item_quantity_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(line_total=models.F("unit_price") * models.F("quantity")),
                name="order_item_line_total_matches",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.quantity}x {self.product_name}"


class OrderItemAddon(models.Model):
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name="addons")
    addon = models.ForeignKey(
        Addon, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_item_addons"
    )
    addon_name = models.CharField(_("add-on name (snapshot)"), max_length=120)
    addon_price = money_field(_("add-on price (snapshot)"))

    class Meta:
        verbose_name = _("order item add-on")
        verbose_name_plural = _("order item add-ons")
        ordering = ["id"]

    def __str__(self) -> str:
        return self.addon_name


class OrderSequence(models.Model):
    """Per-year counter behind references such as RF-2026-0001."""

    year = models.PositiveIntegerField(primary_key=True)
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = _("order sequence")
        verbose_name_plural = _("order sequences")

    def __str__(self) -> str:
        return f"{self.year}: {self.last_value}"
