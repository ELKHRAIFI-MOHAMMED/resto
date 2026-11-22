from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.money import MONEY_FIELD_KWARGS
from apps.core.phone import normalize_customer_phone

from .models import Order, OrderItem, OrderItemAddon, OrderStatus, OrderType
from .pricing import ItemRequest
from .services import CustomerDetails, allowed_next_statuses


def _money(**kwargs) -> serializers.DecimalField:
    return serializers.DecimalField(**MONEY_FIELD_KWARGS, read_only=True, **kwargs)


# ---------------------------------------------------------------------------
# Checkout input: identifiers and quantities only, never prices
# ---------------------------------------------------------------------------


class OrderItemInputSerializer(serializers.Serializer):
    product = serializers.IntegerField(min_value=1)
    variant = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    addons = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, default=list, max_length=20
    )
    quantity = serializers.IntegerField(min_value=1, max_value=settings.ORDER_MAX_ITEM_QUANTITY)
    special_instructions = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )

    def validate_addons(self, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise serializers.ValidationError(_("An extra can only be selected once."))
        return value

    def to_item_request(self, data) -> ItemRequest:
        return ItemRequest(
            product_id=data["product"],
            quantity=data["quantity"],
            variant_id=data.get("variant"),
            addon_ids=tuple(data.get("addons", ())),
            special_instructions=data.get("special_instructions", ""),
        )


class OrderQuoteInputSerializer(serializers.Serializer):
    order_type = serializers.ChoiceField(choices=OrderType.choices)
    delivery_zone = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    items = OrderItemInputSerializer(
        many=True, allow_empty=False, max_length=settings.ORDER_MAX_LINES
    )

    def item_requests(self) -> list[ItemRequest]:
        item_serializer = OrderItemInputSerializer()
        return [item_serializer.to_item_request(item) for item in self.validated_data["items"]]


class OrderCreateInputSerializer(OrderQuoteInputSerializer):
    customer_name = serializers.CharField(min_length=2, max_length=120)
    customer_phone = serializers.CharField(max_length=30)
    delivery_address = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    customer_notes = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default=""
    )

    def validate_customer_phone(self, value: str) -> str:
        return normalize_customer_phone(value)

    def validate(self, attrs):
        if attrs["order_type"] == OrderType.DELIVERY:
            errors = {}
            if not attrs.get("delivery_address", "").strip():
                errors["delivery_address"] = [_("The delivery address is required.")]
            if not attrs.get("city", "").strip():
                errors["city"] = [_("The city is required.")]
            if not attrs.get("delivery_zone"):
                errors["delivery_zone"] = [_("Please choose your delivery zone.")]
            if errors:
                raise serializers.ValidationError(errors)
        else:
            attrs["delivery_zone"] = None
            attrs["delivery_address"] = ""
        return attrs

    def customer_details(self) -> CustomerDetails:
        data = self.validated_data
        return CustomerDetails(
            name=data["customer_name"],
            phone=data["customer_phone"],
            delivery_address=data["delivery_address"],
            city=data["city"],
            notes=data["customer_notes"],
        )


# ---------------------------------------------------------------------------
# Quote output (built from the pricing dataclasses)
# ---------------------------------------------------------------------------


class PricedAddonSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="addon.pk", read_only=True)
    name = serializers.CharField(read_only=True)
    price = _money()


class PricedItemSerializer(serializers.Serializer):
    product = serializers.IntegerField(source="product.pk", read_only=True)
    product_name = serializers.CharField(read_only=True)
    product_price = _money()
    variant = serializers.IntegerField(
        source="variant.pk", read_only=True, allow_null=True, default=None
    )
    variant_name = serializers.CharField(read_only=True)
    variant_price = _money()
    addons = PricedAddonSerializer(many=True, read_only=True)
    quantity = serializers.IntegerField(read_only=True)
    unit_price = _money()
    line_total = _money()


class OrderQuoteSerializer(serializers.Serializer):
    order_type = serializers.CharField(read_only=True)
    items = PricedItemSerializer(many=True, read_only=True)
    subtotal = _money()
    delivery_fee = _money()
    total = _money()
    currency = serializers.CharField(read_only=True)
    delivery_zone = serializers.IntegerField(
        source="delivery_zone.pk", read_only=True, allow_null=True, default=None
    )
    delivery_zone_name = serializers.CharField(read_only=True)
    minimum_order_amount = _money()
    free_delivery_applied = serializers.BooleanField(read_only=True)


# ---------------------------------------------------------------------------
# Saved orders
# ---------------------------------------------------------------------------


class OrderItemAddonSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItemAddon
        fields = ["id", "addon", "addon_name", "addon_price"]
        read_only_fields = fields


class OrderItemSerializer(serializers.ModelSerializer):
    addons = OrderItemAddonSerializer(many=True, read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "product_name",
            "product_price",
            "variant_name",
            "variant_price",
            "addons",
            "quantity",
            "unit_price",
            "line_total",
            "special_instructions",
        ]
        read_only_fields = fields


class WhatsAppHandoffSerializer(serializers.Serializer):
    phone = serializers.CharField(source="whatsapp_number", read_only=True)
    message = serializers.CharField(source="whatsapp_message", read_only=True)


class OrderCreatedSerializer(serializers.ModelSerializer):
    """
    Returned after checkout. The frontend builds
    https://wa.me/<whatsapp.phone>?text=<encodeURIComponent(whatsapp.message)>.
    """

    items = OrderItemSerializer(many=True, read_only=True)
    whatsapp = WhatsAppHandoffSerializer(source="*", read_only=True)

    class Meta:
        model = Order
        fields = [
            "reference",
            "status",
            "order_type",
            "customer_name",
            "customer_phone",
            "delivery_address",
            "city",
            "delivery_zone_name",
            "customer_notes",
            "items",
            "subtotal",
            "delivery_fee",
            "total",
            "currency",
            "language",
            "created_at",
            "whatsapp",
        ]
        read_only_fields = fields


class AdminOrderListSerializer(serializers.ModelSerializer):
    item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "reference",
            "status",
            "order_type",
            "customer_name",
            "customer_phone",
            "city",
            "delivery_zone_name",
            "item_count",
            "total",
            "currency",
            "created_at",
            "confirmed_at",
        ]
        read_only_fields = fields


class AdminOrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    allowed_statuses = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "reference",
            "status",
            "allowed_statuses",
            "order_type",
            "customer_name",
            "customer_phone",
            "delivery_address",
            "city",
            "delivery_zone",
            "delivery_zone_name",
            "customer_notes",
            "language",
            "items",
            "subtotal",
            "delivery_fee",
            "total",
            "currency",
            "whatsapp_number",
            "whatsapp_message",
            "created_at",
            "updated_at",
            "confirmed_at",
        ]
        read_only_fields = fields

    def get_allowed_statuses(self, order: Order) -> list[str]:
        return allowed_next_statuses(order)


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=OrderStatus.choices)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


class _StatusCountsSerializer(serializers.Serializer):
    def get_fields(self):
        return {status: serializers.IntegerField() for status in OrderStatus.values}


class _OrderTotalsSerializer(serializers.Serializer):
    initiated = serializers.IntegerField()
    confirmed = serializers.IntegerField()
    revenue = serializers.DecimalField(**MONEY_FIELD_KWARGS)
    by_status = _StatusCountsSerializer()


class _ProductTotalsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    active = serializers.IntegerField()
    available = serializers.IntegerField()


class _PopularProductSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    name = serializers.CharField()
    quantity = serializers.IntegerField()
    revenue = serializers.DecimalField(**MONEY_FIELD_KWARGS)
    orders = serializers.IntegerField()


class _DailyStatsSerializer(serializers.Serializer):
    date = serializers.DateField()
    orders = serializers.IntegerField()
    confirmed = serializers.IntegerField()
    revenue = serializers.DecimalField(**MONEY_FIELD_KWARGS)


class DashboardSerializer(serializers.Serializer):
    orders = _OrderTotalsSerializer()
    products = _ProductTotalsSerializer()
    popular_products = _PopularProductSerializer(many=True)
    orders_by_date = _DailyStatsSerializer(many=True)
    period_days = serializers.IntegerField()
