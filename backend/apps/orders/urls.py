from django.urls import path

from .views import OrderCreateView, OrderQuoteView

urlpatterns = [
    path("", OrderCreateView.as_view(), name="order-create"),
    path("quote/", OrderQuoteView.as_view(), name="order-quote"),
]
