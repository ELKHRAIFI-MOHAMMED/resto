from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    is_owner = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "is_owner"]
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, style={"input_type": "password"})

    def validate(self, attrs):
        user = authenticate(
            self.context.get("request"), username=attrs["email"], password=attrs["password"]
        )
        # Same message whether the account is missing, inactive or not staff:
        # never reveal which emails exist.
        if user is None or not user.is_staff:
            raise serializers.ValidationError(
                _("Invalid email or password."), code="invalid_credentials"
            )
        attrs["user"] = user
        return attrs
