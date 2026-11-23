from django.contrib import admin

from .models import Offer, OfferGroup


class OfferGroupInline(admin.StackedInline):
    model = OfferGroup
    extra = 0
    filter_horizontal = ["products"]


@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = ["name_fr", "price", "is_active", "starts_on", "ends_on", "display_order"]
    list_filter = ["is_active"]
    search_fields = ["name_fr", "name_ar", "name_en"]
    inlines = [OfferGroupInline]
