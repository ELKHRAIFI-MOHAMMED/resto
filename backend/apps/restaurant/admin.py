from django.contrib import admin

from .models import OpeningHour, Restaurant


class OpeningHourInline(admin.TabularInline):
    model = OpeningHour
    extra = 0


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    inlines = [OpeningHourInline]
    list_display = ["name", "whatsapp_number", "is_accepting_orders"]

    def has_add_permission(self, request):
        return not Restaurant.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
