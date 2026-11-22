from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    fields = ["product_name", "variant_name", "quantity", "unit_price", "line_total"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    """Orders are immutable records; status changes go through the dashboard API."""

    list_display = ["reference", "customer_name", "order_type", "status", "total", "created_at"]
    list_filter = ["status", "order_type", "created_at"]
    search_fields = ["reference", "customer_name", "customer_phone"]
    date_hierarchy = "created_at"
    inlines = [OrderItemInline]

    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]

    def has_add_permission(self, request):
        return False
