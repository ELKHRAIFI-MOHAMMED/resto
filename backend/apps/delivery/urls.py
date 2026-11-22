from django.urls import path

from .views import DeliveryZoneListView

urlpatterns = [
    path("zones/", DeliveryZoneListView.as_view(), name="delivery-zone-list"),
]
