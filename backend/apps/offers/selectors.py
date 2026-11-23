"""Querysets shared by the offer API and order pricing."""

from django.db.models import Prefetch

from apps.products.models import Product, ProductVariant

from .models import Offer, OfferGroup


def _menu_products():
    return (
        Product.objects.filter(is_active=True, category__is_active=True)
        .select_related("category")
        .prefetch_related(
            Prefetch("variants", queryset=ProductVariant.objects.filter(is_active=True))
        )
        .order_by("category__display_order", "category_id", "display_order", "id")
    )


def current_offers():
    """Offers customers can order today, with their groups and menu products prefetched."""
    groups = OfferGroup.objects.prefetch_related(Prefetch("products", queryset=_menu_products()))
    return Offer.objects.current().prefetch_related(Prefetch("groups", queryset=groups))


def default_variant(product: Product) -> ProductVariant | None:
    """The size served in an offer: the product's first active variant (prefetched)."""
    variants = list(product.variants.all())
    return variants[0] if variants else None
