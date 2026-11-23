from django.db import transaction
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.i18n import TranslatedField, localized_value, translated_field_names
from apps.products.models import Product

from .models import MAX_GROUP_QUANTITY, MAX_GROUPS, Offer, OfferGroup
from .selectors import default_variant

# ---------------------------------------------------------------------------
# Public (translated in the request language)
# ---------------------------------------------------------------------------


class PublicOfferProductSerializer(serializers.ModelSerializer):
    name = TranslatedField("name")
    variant_name = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "slug", "name", "image", "is_available", "variant_name"]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField())
    def get_variant_name(self, product: Product) -> str:
        """The size included in the offer ("" when the product has no sizes)."""
        variant = default_variant(product)
        return localized_value(variant, "name") if variant else ""


class PublicOfferGroupSerializer(serializers.ModelSerializer):
    name = TranslatedField("name")
    products = PublicOfferProductSerializer(many=True, read_only=True)

    class Meta:
        model = OfferGroup
        fields = ["id", "name", "quantity", "products"]
        read_only_fields = fields


class PublicOfferSerializer(serializers.ModelSerializer):
    name = TranslatedField("name")
    description = TranslatedField("description")
    groups = PublicOfferGroupSerializer(many=True, read_only=True)
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = Offer
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "price",
            "image",
            "starts_on",
            "ends_on",
            "is_available",
            "groups",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.BooleanField())
    def get_is_available(self, offer: Offer) -> bool:
        """Every group still has at least one dish available today."""
        groups = offer.groups.all()
        return bool(groups) and all(
            any(product.is_available for product in group.products.all()) for group in groups
        )


# ---------------------------------------------------------------------------
# Admin (all translations, writable; groups are written with the offer)
# ---------------------------------------------------------------------------


class AdminOfferGroupSerializer(serializers.ModelSerializer):
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_GROUP_QUANTITY)
    products = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Product.objects.all(), allow_empty=False
    )

    class Meta:
        model = OfferGroup
        fields = ["id", *translated_field_names("name"), "quantity", "products", "display_order"]
        read_only_fields = ["id"]
        extra_kwargs = {"display_order": {"required": False}}


class AdminOfferSerializer(serializers.ModelSerializer):
    groups = AdminOfferGroupSerializer(many=True, allow_empty=False, max_length=MAX_GROUPS)

    class Meta:
        model = Offer
        fields = [
            "id",
            "slug",
            *translated_field_names("name", "description"),
            "price",
            "image",
            "is_active",
            "starts_on",
            "ends_on",
            "display_order",
            "groups",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False}, "image": {"allow_null": True}}

    def validate_image(self, value):
        return value or ""  # null clears the image

    def validate(self, attrs):
        starts_on = attrs.get("starts_on", getattr(self.instance, "starts_on", None))
        ends_on = attrs.get("ends_on", getattr(self.instance, "ends_on", None))
        if starts_on and ends_on and ends_on < starts_on:
            raise serializers.ValidationError(
                {"ends_on": [_("The end date must be on or after the start date.")]},
                code="invalid_period",
            )
        return attrs

    @staticmethod
    def _save_groups(offer: Offer, groups: list[dict]) -> None:
        # Groups are replaced as a whole: past orders keep their own snapshots.
        offer.groups.all().delete()
        for position, data in enumerate(groups):
            products = data.pop("products")
            data.setdefault("display_order", position)
            group = OfferGroup.objects.create(offer=offer, **data)
            group.products.set(products)

    @transaction.atomic
    def create(self, validated_data):
        groups = validated_data.pop("groups")
        offer = super().create(validated_data)
        self._save_groups(offer, groups)
        return offer

    @transaction.atomic
    def update(self, instance, validated_data):
        groups = validated_data.pop("groups", None)
        offer = super().update(instance, validated_data)
        if groups is not None:
            self._save_groups(offer, groups)
        return offer
