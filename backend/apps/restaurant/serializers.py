from django.db import transaction
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.i18n import TranslatedField, translated_field_names
from apps.core.phone import normalize_whatsapp_number

from .models import OpeningHour, Restaurant
from .services import is_open_now


class OpeningHourSerializer(serializers.ModelSerializer):
    class Meta:
        model = OpeningHour
        fields = ["id", "weekday", "opens_at", "closes_at", "is_closed"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        if attrs.get("is_closed"):
            attrs["opens_at"] = attrs["closes_at"] = None
            return attrs
        opens, closes = attrs.get("opens_at"), attrs.get("closes_at")
        if opens is None or closes is None:
            raise serializers.ValidationError(
                _("Opening and closing times are required unless the day is closed."),
                code="times_required",
            )
        if opens == closes:
            raise serializers.ValidationError(
                _("Opening and closing times must differ."), code="times_equal"
            )
        return attrs


class OpeningHoursReplaceSerializer(serializers.Serializer):
    """Replaces the whole weekly schedule in one request."""

    hours = OpeningHourSerializer(many=True)

    def validate_hours(self, hours):
        slots = [(h["weekday"], h.get("opens_at")) for h in hours if not h.get("is_closed")]
        if len(slots) != len(set(slots)):
            raise serializers.ValidationError(
                _("Two slots on the same day cannot start at the same time."),
                code="duplicate_slot",
            )
        return hours

    @transaction.atomic
    def save(self, restaurant: Restaurant):
        restaurant.opening_hours.all().delete()
        return OpeningHour.objects.bulk_create(
            [OpeningHour(restaurant=restaurant, **slot) for slot in self.validated_data["hours"]]
        )


class PublicRestaurantSerializer(serializers.ModelSerializer):
    description = TranslatedField("description")
    is_open_now = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            "name",
            "logo",
            "description",
            "address",
            "city",
            "phone",
            "whatsapp_number",
            "email",
            "currency",
            "facebook_url",
            "instagram_url",
            "tiktok_url",
            "google_maps_url",
            "is_accepting_orders",
            "delivery_enabled",
            "pickup_enabled",
            "minimum_order_amount",
            "free_delivery_threshold",
            "is_open_now",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.BooleanField())
    def get_is_open_now(self, restaurant: Restaurant) -> bool:
        return is_open_now(restaurant)


class AdminRestaurantSerializer(serializers.ModelSerializer):
    # Declared explicitly: the model validators would reject formatted input
    # ("+212 6 12…") before validate_whatsapp_number can normalise it.
    whatsapp_number = serializers.CharField(max_length=30, allow_blank=True, required=False)

    class Meta:
        model = Restaurant
        fields = [
            "name",
            "logo",
            *translated_field_names("description"),
            "address",
            "city",
            "phone",
            "whatsapp_number",
            "email",
            "currency",
            "facebook_url",
            "instagram_url",
            "tiktok_url",
            "google_maps_url",
            "is_accepting_orders",
            "delivery_enabled",
            "pickup_enabled",
            "minimum_order_amount",
            "free_delivery_threshold",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
        extra_kwargs = {"logo": {"allow_null": True}}

    def validate_whatsapp_number(self, value: str) -> str:
        return normalize_whatsapp_number(value)

    def validate_logo(self, value):
        return value or ""  # null clears the logo
