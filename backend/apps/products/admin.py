from django.contrib import admin

from .models import Addon, Product, ProductImage, ProductVariant


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name_fr", "category", "price", "sale_price", "is_active", "is_available"]
    list_editable = ["is_active", "is_available"]
    list_filter = ["category", "is_active", "is_available", "is_featured"]
    list_select_related = ["category"]
    search_fields = ["name_fr", "name_ar", "name_en", "slug"]
    prepopulated_fields = {"slug": ["name_fr"]}
    filter_horizontal = ["addons"]
    inlines = [ProductVariantInline, ProductImageInline]


@admin.register(Addon)
class AddonAdmin(admin.ModelAdmin):
    list_display = ["name_fr", "price", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name_fr", "name_ar", "name_en"]
