from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import generics, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.core.views import PublicAPIMixin, StaffAPIMixin

from .models import Offer, OfferGroup
from .selectors import current_offers
from .serializers import AdminOfferSerializer, PublicOfferSerializer


@extend_schema(tags=["catalog"], summary="Current offers (packs)")
class OfferListView(PublicAPIMixin, generics.ListAPIView):
    """Offers available today, with the dishes the customer can choose in each group."""

    serializer_class = PublicOfferSerializer
    pagination_class = None
    filter_backends: list = []

    def get_queryset(self):
        return current_offers().order_by("display_order", "id")


@extend_schema(tags=["catalog"], summary="Offer detail")
class OfferDetailView(PublicAPIMixin, generics.RetrieveAPIView):
    serializer_class = PublicOfferSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return current_offers()


@extend_schema(tags=["admin: catalog"])
class AdminOfferViewSet(StaffAPIMixin, viewsets.ModelViewSet):
    """Offers with their groups. Deleting an offer keeps past orders intact (snapshots)."""

    serializer_class = AdminOfferSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = None
    filterset_fields = ["is_active"]
    search_fields = ["name_fr", "name_ar", "name_en", "slug"]
    ordering_fields = ["display_order", "price", "name_fr", "created_at"]
    ordering = ["display_order", "id"]

    def get_queryset(self):
        groups = OfferGroup.objects.prefetch_related("products")
        return Offer.objects.prefetch_related(Prefetch("groups", queryset=groups))
