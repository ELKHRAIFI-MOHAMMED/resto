"""
Back-office API, mounted at /api/admin/. Every endpoint requires an active
staff session (restaurant settings additionally require the owner role).
"""

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.categories.views import AdminCategoryViewSet
from apps.delivery.views import AdminCourierViewSet, AdminDeliveryZoneViewSet
from apps.offers.views import AdminOfferViewSet
from apps.orders.views import AdminDashboardView, AdminOrderViewSet
from apps.products.views import (
    AdminAddonViewSet,
    AdminProductImageViewSet,
    AdminProductViewSet,
    AdminVariantViewSet,
)
from apps.restaurant.views import AdminOpeningHoursView, AdminSettingsView

router = SimpleRouter()
router.register("categories", AdminCategoryViewSet, basename="admin-category")
router.register("products", AdminProductViewSet, basename="admin-product")
router.register("addons", AdminAddonViewSet, basename="admin-addon")
router.register("offers", AdminOfferViewSet, basename="admin-offer")
router.register("delivery/zones", AdminDeliveryZoneViewSet, basename="admin-delivery-zone")
router.register("couriers", AdminCourierViewSet, basename="admin-courier")
router.register("orders", AdminOrderViewSet, basename="admin-order")

product_router = SimpleRouter()
product_router.register("variants", AdminVariantViewSet, basename="admin-product-variant")
product_router.register("images", AdminProductImageViewSet, basename="admin-product-image")

urlpatterns = [
    path("dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("settings/", AdminSettingsView.as_view(), name="admin-settings"),
    path("settings/hours/", AdminOpeningHoursView.as_view(), name="admin-settings-hours"),
    path("products/<int:product_pk>/", include(product_router.urls)),
    path("", include(router.urls)),
]
