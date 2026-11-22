from django.urls import path

from .views import OpeningHoursView, RestaurantView

urlpatterns = [
    path("", RestaurantView.as_view(), name="restaurant"),
    path("hours/", OpeningHoursView.as_view(), name="restaurant-hours"),
]
