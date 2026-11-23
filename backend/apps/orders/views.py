from django.db import IntegrityError
from django.db.models import Count, Prefetch
from django.utils.translation import get_language
from django.utils.translation import gettext as _
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.exceptions import BusinessRuleError
from apps.core.views import PublicAPIMixin, StaffAPIMixin

from .dashboard import dashboard_stats
from .dispatch import assign_courier, auto_assign
from .filters import AdminOrderFilter
from .models import Order, OrderItem
from .pricing import price_order
from .serializers import (
    AdminOrderDetailSerializer,
    AdminOrderListSerializer,
    CourierAssignmentSerializer,
    DashboardSerializer,
    OrderCreatedSerializer,
    OrderCreateInputSerializer,
    OrderQuoteInputSerializer,
    OrderQuoteSerializer,
    OrderStatusUpdateSerializer,
)
from .services import change_order_status, create_order, find_order_by_client_token


class OrderQuoteView(PublicAPIMixin, APIView):
    """
    Price a cart without saving anything: authoritative subtotal, delivery
    fee and total, plus per-item errors. Used by the cart and checkout pages.
    """

    @extend_schema(
        tags=["orders"],
        summary="Quote a cart",
        request=OrderQuoteInputSerializer,
        responses=OrderQuoteSerializer,
    )
    def post(self, request):
        serializer = OrderQuoteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quote = price_order(
            order_type=serializer.validated_data.get("order_type"),
            items=serializer.item_requests(),
            delivery_zone_id=serializer.validated_data.get("delivery_zone"),
        )
        return Response(OrderQuoteSerializer(quote).data)


class OrderCreateView(PublicAPIMixin, APIView):
    """
    Create an order and return the WhatsApp hand-off data. The order is saved
    as `pending`: it is only confirmed manually by the restaurant.

    Sending the same `client_token` again returns the existing order (200)
    instead of creating a duplicate, so the client can safely retry.
    """

    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "orders"

    @extend_schema(
        tags=["orders"],
        summary="Place an order",
        request=OrderCreateInputSerializer,
        responses={201: OrderCreatedSerializer, 200: OrderCreatedSerializer},
    )
    def post(self, request):
        serializer = OrderCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        token = data.get("client_token")

        if existing := find_order_by_client_token(token):
            return Response(OrderCreatedSerializer(existing).data, status=status.HTTP_200_OK)
        try:
            order = create_order(
                order_type=data["order_type"],
                items=serializer.item_requests(),
                customer=serializer.customer_details(),
                delivery_zone_id=data.get("delivery_zone"),
                language=get_language(),
                client_token=token,
            )
        except IntegrityError:
            # A concurrent request with the same token won the race.
            existing = find_order_by_client_token(token)
            if existing is None:
                raise
            return Response(OrderCreatedSerializer(existing).data, status=status.HTTP_200_OK)
        return Response(OrderCreatedSerializer(order).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["admin: orders"])
class AdminOrderViewSet(
    StaffAPIMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Orders are read-only for staff, except for their status."""

    filterset_class = AdminOrderFilter
    search_fields = ["reference", "customer_name", "customer_phone"]
    ordering_fields = ["created_at", "total", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = Order.objects.all()
        if self.action == "list":
            return queryset.annotate(item_count=Count("items"))
        return queryset.prefetch_related(
            Prefetch("items", queryset=OrderItem.objects.prefetch_related("addons", "choices"))
        )

    def get_serializer_class(self):
        return AdminOrderListSerializer if self.action == "list" else AdminOrderDetailSerializer

    @extend_schema(
        summary="Change order status",
        description="Manual workflow only. Invalid transitions return 409.",
        request=OrderStatusUpdateSerializer,
        responses=AdminOrderDetailSerializer,
    )
    @action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request, pk=None):
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_order_status(self.get_object(), serializer.validated_data["status"])
        order = self.get_queryset().get(pk=pk)
        return Response(AdminOrderDetailSerializer(order).data)

    @extend_schema(
        summary="Assign or unassign a courier",
        request=CourierAssignmentSerializer,
        responses=AdminOrderDetailSerializer,
    )
    @action(detail=True, methods=["patch"], url_path="courier")
    def assign_courier(self, request, pk=None):
        serializer = CourierAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assign_courier(self.get_object(), serializer.validated_data["courier"])
        return Response(AdminOrderDetailSerializer(self.get_queryset().get(pk=pk)).data)

    @extend_schema(
        summary="Assign the best available courier of the order's zone",
        request=None,
        responses=AdminOrderDetailSerializer,
    )
    @action(detail=True, methods=["post"], url_path="auto-assign")
    def auto_assign_courier(self, request, pk=None):
        if auto_assign(self.get_object()) is None:
            raise BusinessRuleError(
                "no_courier_available", _("No on-duty courier serves this zone."), status_code=409
            )
        return Response(AdminOrderDetailSerializer(self.get_queryset().get(pk=pk)).data)


class DashboardQuerySerializer(serializers.Serializer):
    days = serializers.IntegerField(min_value=1, max_value=365, default=30)


class AdminDashboardView(StaffAPIMixin, APIView):
    @extend_schema(
        tags=["admin: dashboard"],
        summary="Dashboard statistics",
        parameters=[OpenApiParameter("days", int, description="Period for daily stats (1-365)")],
        responses=DashboardSerializer,
    )
    def get(self, request):
        query = DashboardQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        stats = dashboard_stats(days=query.validated_data["days"])
        return Response(DashboardSerializer(stats).data)
