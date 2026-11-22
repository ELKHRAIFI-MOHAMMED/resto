from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsOwner
from apps.core.views import PublicAPIMixin

from .models import Restaurant
from .serializers import (
    AdminRestaurantSerializer,
    OpeningHourSerializer,
    OpeningHoursReplaceSerializer,
    PublicRestaurantSerializer,
)


@extend_schema(tags=["restaurant"], summary="Restaurant profile")
class RestaurantView(PublicAPIMixin, generics.RetrieveAPIView):
    serializer_class = PublicRestaurantSerializer

    def get_object(self):
        return Restaurant.objects.prefetch_related("opening_hours").get(pk=Restaurant.load().pk)


@extend_schema(tags=["restaurant"], summary="Opening hours")
class OpeningHoursView(PublicAPIMixin, generics.ListAPIView):
    serializer_class = OpeningHourSerializer
    pagination_class = None
    filter_backends: list = []

    def get_queryset(self):
        return Restaurant.load().opening_hours.all()


@extend_schema(tags=["admin: settings"])
class AdminSettingsView(generics.RetrieveUpdateAPIView):
    """Restaurant profile and ordering settings (owner only)."""

    permission_classes = [IsOwner]
    serializer_class = AdminRestaurantSerializer
    http_method_names = ["get", "patch", "options"]

    def get_object(self):
        return Restaurant.load()


class AdminOpeningHoursView(APIView):
    """Weekly schedule (owner only). PUT replaces every slot."""

    permission_classes = [IsOwner]

    @extend_schema(
        tags=["admin: settings"],
        summary="List opening hours",
        responses=OpeningHourSerializer(many=True),
    )
    def get(self, request):
        hours = Restaurant.load().opening_hours.all()
        return Response(OpeningHourSerializer(hours, many=True).data)

    @extend_schema(
        tags=["admin: settings"],
        summary="Replace opening hours",
        request=OpeningHoursReplaceSerializer,
        responses=OpeningHourSerializer(many=True),
    )
    def put(self, request):
        serializer = OpeningHoursReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        restaurant = Restaurant.load()
        serializer.save(restaurant)
        return Response(OpeningHourSerializer(restaurant.opening_hours.all(), many=True).data)
