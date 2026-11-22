from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.views import PublicAPIMixin, StaffAPIMixin

from .models import Category
from .serializers import (
    AdminCategorySerializer,
    CategoryReorderSerializer,
    PublicCategorySerializer,
)


@extend_schema(tags=["catalog"], summary="Active categories")
class CategoryListView(PublicAPIMixin, generics.ListAPIView):
    """Active categories in display order (unpaginated: a menu has few categories)."""

    serializer_class = PublicCategorySerializer
    pagination_class = None
    filter_backends: list = []

    def get_queryset(self):
        return (
            Category.objects.filter(is_active=True)
            .annotate(product_count=Count("products", filter=Q(products__is_active=True)))
            .order_by("display_order", "id")
        )


@extend_schema_view(
    list=extend_schema(summary="List categories"),
    create=extend_schema(summary="Create a category"),
    retrieve=extend_schema(summary="Get a category"),
    partial_update=extend_schema(summary="Update a category"),
    update=extend_schema(summary="Replace a category"),
    destroy=extend_schema(
        summary="Delete a category",
        description="Returns 409 `protected` while products still belong to the category.",
    ),
)
@extend_schema(tags=["admin: catalog"])
class AdminCategoryViewSet(StaffAPIMixin, viewsets.ModelViewSet):
    serializer_class = AdminCategorySerializer
    filterset_fields = ["is_active"]
    search_fields = ["name_fr", "name_ar", "name_en", "slug"]
    ordering_fields = ["display_order", "name_fr", "created_at"]
    ordering = ["display_order", "id"]

    def get_queryset(self):
        return Category.objects.annotate(product_count=Count("products")).order_by(
            "display_order", "id"
        )

    @extend_schema(
        summary="Reorder categories",
        request=CategoryReorderSerializer,
        responses=AdminCategorySerializer(many=True),
    )
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        serializer = CategoryReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]
        with transaction.atomic():
            categories = {c.pk: c for c in Category.objects.select_for_update().filter(pk__in=ids)}
            now = timezone.now()  # bulk_update does not apply auto_now
            for position, pk in enumerate(ids):
                categories[pk].display_order = position
                categories[pk].updated_at = now
            Category.objects.bulk_update(categories.values(), ["display_order", "updated_at"])
        queryset = self.get_queryset().order_by("display_order", "id")
        return Response(self.get_serializer(queryset, many=True).data)
