from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.categories.models import Category
from apps.core.i18n import TranslatedField, translated_field_names
from apps.core.money import MONEY_FIELD_KWARGS

from .models import Addon, Product, ProductImage, ProductVariant

# ---------------------------------------------------------------------------
# Public (read-only, translated in the request language)
# ---------------------------------------------------------------------------


class PublicCategoryRefSerializer(serializers.ModelSerializer):
    name = TranslatedField("name")

    class Meta:
        model = Category
        fields = ["id", "slug", "name"]
        read_only_fields = fields


class PublicVariantSerializer(serializers.ModelSerializer):
    name = TranslatedField("name")

    class Meta:
        model = ProductVariant
        fields = ["id", "name", "price_delta"]
        read_only_fields = fields


class PublicAddonSerializer(serializers.ModelSerializer):
    name = TranslatedField("name")

    class Meta:
        model = Addon
        fields = ["id", "name", "price"]
        read_only_fields = fields


class PublicProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image"]
        read_only_fields = fields


class PublicProductListSerializer(serializers.ModelSerializer):
    name = TranslatedField("name")
    description = TranslatedField("description")
    category = PublicCategoryRefSerializer(read_only=True)
    effective_price = serializers.DecimalField(**MONEY_FIELD_KWARGS, read_only=True)
    is_on_sale = serializers.BooleanField(read_only=True)
    has_options = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "category",
            "price",
            "sale_price",
            "effective_price",
            "is_on_sale",
            "image",
            "is_available",
            "is_featured",
            "has_options",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.BooleanField())
    def get_has_options(self, product: Product) -> bool:
        """True when the product needs the detail view (variant to pick or extras to offer)."""
        return bool(product.variants.all()) or bool(product.addons.all())


class PublicProductDetailSerializer(PublicProductListSerializer):
    variants = PublicVariantSerializer(many=True, read_only=True)
    addons = PublicAddonSerializer(many=True, read_only=True)
    images = PublicProductImageSerializer(many=True, read_only=True)

    class Meta(PublicProductListSerializer.Meta):
        fields = [*PublicProductListSerializer.Meta.fields, "variants", "addons", "images"]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Admin (all translations, writable)
# ---------------------------------------------------------------------------


class AdminAddonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Addon
        fields = [
            "id",
            *translated_field_names("name"),
            "price",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AdminVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "product",
            *translated_field_names("name"),
            "price_delta",
            "display_order",
            "is_active",
        ]
        read_only_fields = ["id", "product"]

    def validate_name_fr(self, value: str) -> str:
        product = self.context["product"]
        duplicates = ProductVariant.objects.filter(product=product, name_fr__iexact=value)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError(
                _("This product already has an option with this name."), code="unique"
            )
        return value


class AdminProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "product", "image", "display_order"]
        read_only_fields = ["id", "product"]


class AdminProductSerializer(serializers.ModelSerializer):
    effective_price = serializers.DecimalField(**MONEY_FIELD_KWARGS, read_only=True)
    addons = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Addon.objects.all(), required=False
    )
    variants = AdminVariantSerializer(many=True, read_only=True)
    images = AdminProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "category",
            "slug",
            *translated_field_names("name", "description"),
            "price",
            "sale_price",
            "effective_price",
            "image",
            "is_active",
            "is_available",
            "is_featured",
            "display_order",
            "addons",
            "variants",
            "images",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "effective_price",
            "variants",
            "images",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"slug": {"required": False}, "image": {"allow_null": True}}

    def validate_image(self, value):
        return value or ""  # null clears the image

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        sale_price = attrs.get("sale_price", getattr(self.instance, "sale_price", None))
        if sale_price is not None and price is not None and sale_price >= price:
            raise serializers.ValidationError(
                {"sale_price": [_("The sale price must be lower than the price.")]},
                code="sale_price_too_high",
            )
        return attrs
