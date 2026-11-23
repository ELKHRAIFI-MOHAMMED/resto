"""
Courier app API (/api/courier/). A courier only ever sees the orders assigned
to them, and can only move them forward: picked up, then delivered.
"""

from django.db.models import Prefetch
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsCourier

from .dispatch import ACTIVE_DELIVERY_STATUSES, courier_deliver, courier_pickup
from .models import Order, OrderItem, OrderStatus
from .serializers import CourierOrderSerializer, CourierProfileSerializer

COURIER_PERMISSIONS = [IsAuthenticated, IsCourier]


class CourierMeView(APIView):
    permission_classes = COURIER_PERMISSIONS

    @extend_schema(
        tags=["courier"], summary="My courier profile", responses=CourierProfileSerializer
    )
    def get(self, request):
        return Response(CourierProfileSerializer(request.user.courier).data)

    @extend_schema(
        tags=["courier"],
        summary="Go on or off duty",
        request=CourierProfileSerializer,
        responses=CourierProfileSerializer,
    )
    def patch(self, request):
        serializer = CourierProfileSerializer(request.user.courier, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@extend_schema(
    tags=["courier"],
    parameters=[
        OpenApiParameter(
            "scope", str, description="`active` (default): to deliver; `done`: last 50 delivered"
        )
    ],
)
class CourierOrderViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = COURIER_PERMISSIONS
    serializer_class = CourierOrderSerializer
    pagination_class = None
    filter_backends: list = []

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation, no user
            return Order.objects.none()
        orders = Order.objects.filter(courier=self.request.user.courier).prefetch_related(
            Prefetch("items", queryset=OrderItem.objects.prefetch_related("addons", "choices"))
        )
        if self.action == "list":
            if self.request.query_params.get("scope") == "done":
                return orders.filter(status=OrderStatus.COMPLETED).order_by("-delivered_at")[:50]
            return orders.filter(status__in=ACTIVE_DELIVERY_STATUSES).order_by("assigned_at")
        return orders

    @extend_schema(summary="I have the order: out for delivery", request=None)
    @action(detail=True, methods=["post"])
    def pickup(self, request, pk=None):
        courier_pickup(self.get_object(), request.user.courier)
        return Response(self.get_serializer(self.get_queryset().get(pk=pk)).data)

    @extend_schema(summary="The customer has the order: delivered", request=None)
    @action(detail=True, methods=["post"])
    def deliver(self, request, pk=None):
        courier_deliver(self.get_object(), request.user.courier)
        return Response(self.get_serializer(self.get_queryset().get(pk=pk)).data)
