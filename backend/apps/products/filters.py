import django_filters

from .models import Product


class PublicProductFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(field_name="category__slug", help_text="Category slug")
    featured = django_filters.BooleanFilter(field_name="is_featured")
    available = django_filters.BooleanFilter(field_name="is_available")

    class Meta:
        model = Product
        fields = ["category", "featured", "available"]


class AdminProductFilter(django_filters.FilterSet):
    class Meta:
        model = Product
        fields = ["category", "is_active", "is_available", "is_featured"]
