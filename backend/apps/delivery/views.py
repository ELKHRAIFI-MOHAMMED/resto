from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import generics, viewsets

from apps.core.views import PublicAPIMixin, StaffAPIMixin

from .models import Courier, DeliveryZone
from .serializers import (
    AdminCourierSerializer,
    AdminDeliveryZoneSerializer,
    PublicDeliveryZoneSerializer,
)


@extend_schema(tags=["delivery"], summary="Active delivery zones")
class DeliveryZoneListView(PublicAPIMixin, generics.ListAPIView):
    serializer_class = PublicDeliveryZoneSerializer
    queryset = DeliveryZone.objects.filter(is_active=True)
    pagination_class = None
    filter_backends: list = []


@extend_schema(tags=["admin: delivery"])
class AdminDeliveryZoneViewSet(StaffAPIMixin, viewsets.ModelViewSet):
    """Deleting a zone keeps past orders intact (they store the zone name)."""

    serializer_class = AdminDeliveryZoneSerializer
    queryset = DeliveryZone.objects.all()
    filterset_fields = ["is_active"]
    search_fields = ["name_fr", "name_ar", "name_en"]
    ordering_fields = ["display_order", "name_fr", "delivery_fee"]
    ordering = ["display_order", "name_fr"]


@extend_schema(tags=["admin: delivery"])
class AdminCourierViewSet(StaffAPIMixin, viewsets.ModelViewSet):
    """Courier accounts. Deleting one keeps past orders (their courier becomes empty)."""

    serializer_class = AdminCourierSerializer
    pagination_class = None
    filterset_fields = ["is_on_duty"]
    search_fields = ["user__email", "user__first_name", "user__last_name", "phone"]
    ordering = ["user__first_name", "user__email"]

    def get_queryset(self):
        active = ("confirmed", "preparing", "out_for_delivery")
        return (
            Courier.objects.select_related("user")
            .prefetch_related("zones")
            .annotate(active_orders=Count("orders", filter=Q(orders__status__in=active)))
        )

    def perform_destroy(self, instance):
        instance.user.delete()  # removes the login too; orders keep their snapshots
