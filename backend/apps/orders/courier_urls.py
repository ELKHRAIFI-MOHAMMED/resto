from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .courier_views import CourierMeView, CourierOrderViewSet

router = SimpleRouter()
router.register("orders", CourierOrderViewSet, basename="courier-order")

urlpatterns = [
    path("me/", CourierMeView.as_view(), name="courier-me"),
    path("", include(router.urls)),
]
