from django.contrib import admin

from .models import DeliveryZone


@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display = ["name_fr", "delivery_fee", "minimum_order_amount", "display_order", "is_active"]
    list_editable = ["delivery_fee", "minimum_order_amount", "display_order", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name_fr", "name_ar", "name_en"]
