from drf_spectacular.utils import extend_schema
from rest_framework import generics, viewsets

from apps.core.views import PublicAPIMixin, StaffAPIMixin

from .models import DeliveryZone
from .serializers import AdminDeliveryZoneSerializer, PublicDeliveryZoneSerializer


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
