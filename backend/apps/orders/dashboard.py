"""Aggregated statistics for the administration dashboard."""

from datetime import timedelta

from django.db.models import Count, Max, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.core.money import ZERO
from apps.products.models import Product

from .models import Order, OrderItem, OrderStatus

POPULAR_PRODUCTS_LIMIT = 5
# Revenue only counts orders the restaurant actually confirmed and did not cancel.
_COUNTED_REVENUE = Q(confirmed_at__isnull=False) & ~Q(status=OrderStatus.CANCELLED)


def dashboard_stats(*, days: int = 30) -> dict:
    orders = Order.objects.all()

    status_counts = dict(
        orders.order_by()
        .values_list("status")
        .annotate(count=Count("id"))
        .values_list("status", "count")
    )
    totals = orders.aggregate(
        initiated=Count("id"),
        confirmed=Count("id", filter=Q(confirmed_at__isnull=False)),
        revenue=Sum("total", filter=_COUNTED_REVENUE),
    )

    products = Product.objects.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(is_active=True)),
        available=Count("id", filter=Q(is_active=True, is_available=True)),
    )

    popular = (
        OrderItem.objects.filter(product__isnull=False)
        .exclude(order__status=OrderStatus.CANCELLED)
        .values("product_id")
        .annotate(
            name=Max("product__name_fr"),
            quantity=Sum("quantity"),
            revenue=Sum("line_total"),
            orders=Count("order", distinct=True),
        )
        .order_by("-quantity", "product_id")[:POPULAR_PRODUCTS_LIMIT]
    )

    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    daily_rows = {
        row["day"]: row
        for row in orders.filter(created_at__date__gte=start)
        .annotate(day=TruncDate("created_at"))
        .order_by()
        .values("day")
        .annotate(
            orders=Count("id"),
            confirmed=Count("id", filter=Q(confirmed_at__isnull=False)),
            revenue=Sum("total", filter=_COUNTED_REVENUE),
        )
    }
    by_date = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        row = daily_rows.get(day, {})
        by_date.append(
            {
                "date": day,
                "orders": row.get("orders", 0),
                "confirmed": row.get("confirmed", 0),
                "revenue": row.get("revenue") or ZERO,
            }
        )

    return {
        "orders": {
            "initiated": totals["initiated"],
            "confirmed": totals["confirmed"],
            "revenue": totals["revenue"] or ZERO,
            "by_status": {status: status_counts.get(status, 0) for status in OrderStatus.values},
        },
        "products": products,
        "popular_products": [
            {
                "product_id": row["product_id"],
                "name": row["name"],
                "quantity": row["quantity"],
                "revenue": row["revenue"],
                "orders": row["orders"],
            }
            for row in popular
        ],
        "orders_by_date": by_date,
        "period_days": days,
    }
