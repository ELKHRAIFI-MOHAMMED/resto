from django.urls import path

from .views import OfferDetailView, OfferListView

urlpatterns = [
    path("", OfferListView.as_view(), name="offer-list"),
    path("<slug:slug>/", OfferDetailView.as_view(), name="offer-detail"),
]
