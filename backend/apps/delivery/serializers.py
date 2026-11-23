from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.i18n import TranslatedField, translated_field_names

from .models import Courier, DeliveryZone


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


class AdminCourierSerializer(serializers.ModelSerializer):
    """A courier account (User with the courier role) and its dispatch profile."""

    email = serializers.EmailField(source="user.email")
    first_name = serializers.CharField(
        source="user.first_name", max_length=150, required=False, allow_blank=True
    )
    last_name = serializers.CharField(
        source="user.last_name", max_length=150, required=False, allow_blank=True
    )
    is_active = serializers.BooleanField(source="user.is_active", required=False, default=True)
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    zones = serializers.PrimaryKeyRelatedField(
        many=True, queryset=DeliveryZone.objects.all(), required=False
    )
    active_orders = serializers.IntegerField(read_only=True)

    class Meta:
        model = Courier
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "zones",
            "is_on_duty",
            "is_active",
            "password",
            "active_orders",
            "last_assigned_at",
            "created_at",
        ]
        read_only_fields = ["id", "active_orders", "last_assigned_at", "created_at"]

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        users = get_user_model().objects.filter(email__iexact=email)
        if self.instance:
            users = users.exclude(pk=self.instance.user_id)
        if users.exists():
            raise serializers.ValidationError(
                _("An account with this email already exists."), code="unique"
            )
        return email

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError(
                {"password": [_("A password is required for a new courier.")]}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user_data = validated_data.pop("user", {})
        password = validated_data.pop("password")
        zones = validated_data.pop("zones", [])
        user = get_user_model().objects.create_user(
            email=user_data["email"],
            password=password,
            first_name=user_data.get("first_name", ""),
            last_name=user_data.get("last_name", ""),
            is_active=user_data.get("is_active", True),
            role=get_user_model().Role.COURIER,
            is_staff=False,
        )
        courier = Courier.objects.create(user=user, **validated_data)
        courier.zones.set(zones)
        return courier

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        password = validated_data.pop("password", None)
        zones = validated_data.pop("zones", None)
        user = instance.user
        for field, value in user_data.items():
            setattr(user, field, value)
        if password:
            user.set_password(password)
        user.save()
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if zones is not None:
            instance.zones.set(zones)
        return instance
