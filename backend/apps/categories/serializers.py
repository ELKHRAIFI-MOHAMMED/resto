from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.i18n import TranslatedField, translated_field_names

from .models import Category


class PublicCategorySerializer(serializers.ModelSerializer):
    name = TranslatedField("name")
    description = TranslatedField("description")
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "slug", "name", "description", "image", "display_order", "product_count"]
        read_only_fields = fields


class AdminCategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "slug",
            *translated_field_names("name", "description"),
            "image",
            "display_order",
            "is_active",
            "product_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "product_count", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False}, "image": {"allow_null": True}}

    def validate_image(self, value):
        return value or ""  # null clears the image


class CategoryReorderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)

    def validate_ids(self, ids):
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError(_("Duplicate categories."), code="duplicate")
        found = set(Category.objects.filter(pk__in=ids).values_list("pk", flat=True))
        if missing := sorted(set(ids) - found):
            raise serializers.ValidationError(
                _("Unknown categories: %(ids)s") % {"ids": missing}, code="unknown"
            )
        return ids
