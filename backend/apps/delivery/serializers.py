from rest_framework import serializers

from apps.core.i18n import TranslatedField, translated_field_names

from .models import DeliveryZone


class PublicDeliveryZoneSerializer(serializers.ModelSerializer):
    name = TranslatedField("name")

    class Meta:
        model = DeliveryZone
        fields = ["id", "name", "delivery_fee", "minimum_order_amount"]
        read_only_fields = fields


class AdminDeliveryZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryZone
        fields = [
            "id",
            *translated_field_names("name"),
            "delivery_fee",
            "minimum_order_amount",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
