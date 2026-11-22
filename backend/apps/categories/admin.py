from django.contrib import admin

from .models import Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name_fr", "slug", "display_order", "is_active"]
    list_editable = ["display_order", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name_fr", "name_ar", "name_en"]
    prepopulated_fields = {"slug": ["name_fr"]}
