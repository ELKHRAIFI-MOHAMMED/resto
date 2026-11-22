from django.db.models import Prefetch
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, viewsets
from rest_framework.filters import SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.core.filters import AliasedOrderingFilter
from apps.core.views import PublicAPIMixin, StaffAPIMixin

from .filters import AdminProductFilter, PublicProductFilter
from .models import Addon, Product, ProductImage, ProductVariant
from .serializers import (
    AdminAddonSerializer,
    AdminProductImageSerializer,
    AdminProductSerializer,
    AdminVariantSerializer,
    PublicProductDetailSerializer,
    PublicProductListSerializer,
)


def public_products():
    """Products visible on the menu, with their active options prefetched."""
    return (
        Product.objects.filter(is_active=True, category__is_active=True)
        .select_related("category")
        .prefetch_related(
            Prefetch("variants", queryset=ProductVariant.objects.filter(is_active=True)),
            Prefetch("addons", queryset=Addon.objects.filter(is_active=True)),
        )
        .annotate(current_price=Coalesce("sale_price", "price"))
    )


@extend_schema(
    tags=["catalog"],
    summary="Menu products",
    parameters=[
        OpenApiParameter(
            "search", str, description="Search names and descriptions (all languages)"
        ),
        OpenApiParameter(
            "ordering", str, description="`price`, `-price`, `created_at`, `-created_at`"
        ),
    ],
)
class ProductListView(PublicAPIMixin, generics.ListAPIView):
    serializer_class = PublicProductListSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, AliasedOrderingFilter]
    filterset_class = PublicProductFilter
    search_fields = [
        "name_fr",
        "name_ar",
        "name_en",
        "description_fr",
        "description_ar",
        "description_en",
    ]
    ordering_aliases = {"price": "current_price", "created_at": "created_at"}

    def get_queryset(self):
        # Default: grouped as on the menu (category order, then product order).
        return public_products().order_by(
            "category__display_order", "category_id", "display_order", "id"
        )


@extend_schema(tags=["catalog"], summary="Product detail")
class ProductDetailView(PublicAPIMixin, generics.RetrieveAPIView):
    serializer_class = PublicProductDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return public_products().prefetch_related("images")


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
_PARSERS = [JSONParser, MultiPartParser, FormParser]


@extend_schema_view(
    destroy=extend_schema(
        description="Past orders keep their snapshots; their product link becomes null."
    )
)
@extend_schema(tags=["admin: catalog"])
class AdminProductViewSet(StaffAPIMixin, viewsets.ModelViewSet):
    serializer_class = AdminProductSerializer
    parser_classes = _PARSERS
    filterset_class = AdminProductFilter
    search_fields = ["name_fr", "name_ar", "name_en", "slug"]
    ordering_fields = ["display_order", "price", "name_fr", "created_at", "updated_at"]
    ordering = ["category__display_order", "display_order", "id"]

    def get_queryset(self):
        return Product.objects.select_related("category").prefetch_related(
            "addons", "variants", "images"
        )


@extend_schema(tags=["admin: catalog"])
class AdminAddonViewSet(StaffAPIMixin, viewsets.ModelViewSet):
    serializer_class = AdminAddonSerializer
    queryset = Addon.objects.all()
    filterset_fields = ["is_active"]
    search_fields = ["name_fr", "name_ar", "name_en"]
    ordering_fields = ["display_order", "name_fr", "price"]
    ordering = ["display_order", "name_fr"]


class _ProductChildViewSet(StaffAPIMixin, viewsets.ModelViewSet):
    """Base for resources nested under /admin/products/{product_pk}/."""

    pagination_class = None
    filter_backends: list = []

    def get_product(self) -> Product:
        if not hasattr(self, "_product"):
            self._product = get_object_or_404(Product, pk=self.kwargs["product_pk"])
        return self._product

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if "product_pk" in self.kwargs:
            context["product"] = self.get_product()
        return context

    def perform_create(self, serializer):
        serializer.save(product=self.get_product())


@extend_schema(tags=["admin: catalog"], parameters=[OpenApiParameter("product_pk", int, "path")])
class AdminVariantViewSet(_ProductChildViewSet):
    serializer_class = AdminVariantSerializer

    def get_queryset(self):
        return ProductVariant.objects.filter(product_id=self.kwargs.get("product_pk"))


@extend_schema(tags=["admin: catalog"], parameters=[OpenApiParameter("product_pk", int, "path")])
class AdminProductImageViewSet(_ProductChildViewSet):
    serializer_class = AdminProductImageSerializer
    parser_classes = _PARSERS

    def get_queryset(self):
        return ProductImage.objects.filter(product_id=self.kwargs.get("product_pk"))
