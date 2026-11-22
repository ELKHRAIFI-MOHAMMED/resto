import django_filters

from .models import Order, OrderStatus


class AdminOrderFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=OrderStatus.choices)
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")
    confirmed = django_filters.BooleanFilter(
        field_name="confirmed_at", lookup_expr="isnull", exclude=True
    )

    class Meta:
        model = Order
        fields = ["status", "order_type", "delivery_zone", "date_from", "date_to", "confirmed"]
