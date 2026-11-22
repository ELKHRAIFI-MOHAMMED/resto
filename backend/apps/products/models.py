from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.categories.models import Category
from apps.core.models import TimeStampedModel
from apps.core.money import money_field
from apps.core.uploads import IMAGE_VALIDATORS, UploadTo
from apps.core.utils import unique_slug


class Addon(TimeStampedModel):
    """An optional extra (sauce, cheese, …) that can be offered on several products."""

    name_fr = models.CharField(_("name (French)"), max_length=120)
    name_ar = models.CharField(_("name (Arabic)"), max_length=120, blank=True)
    name_en = models.CharField(_("name (English)"), max_length=120, blank=True)
    price = money_field(
        _("additional price"),
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    display_order = models.PositiveIntegerField(_("display order"), default=0)
    is_active = models.BooleanField(_("active"), default=True)

    class Meta:
        verbose_name = _("add-on")
        verbose_name_plural = _("add-ons")
        ordering = ["display_order", "name_fr"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=0), name="addon_price_non_negative"
            ),
        ]

    def __str__(self) -> str:
        return self.name_fr


class Product(TimeStampedModel):
    # PROTECT: a category that still holds products cannot be deleted by accident.
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="products", verbose_name=_("category")
    )
    name_fr = models.CharField(_("name (French)"), max_length=160)
    name_ar = models.CharField(_("name (Arabic)"), max_length=160, blank=True)
    name_en = models.CharField(_("name (English)"), max_length=160, blank=True)
    slug = models.SlugField(_("slug"), max_length=180, unique=True, blank=True)
    description_fr = models.TextField(_("description (French)"), blank=True)
    description_ar = models.TextField(_("description (Arabic)"), blank=True)
    description_en = models.TextField(_("description (English)"), blank=True)
    price = money_field(_("price"), validators=[MinValueValidator(Decimal("0.01"))])
    sale_price = money_field(
        _("sale price"),
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_("Optional discounted price; must be lower than the price."),
    )
    image = models.ImageField(
        _("image"), upload_to=UploadTo("products"), blank=True, validators=IMAGE_VALIDATORS
    )
    # is_active hides the product from the menu entirely;
    # is_available keeps it visible but marked as unavailable (e.g. sold out today).
    is_active = models.BooleanField(_("active"), default=True)
    is_available = models.BooleanField(_("available"), default=True)
    is_featured = models.BooleanField(_("featured"), default=False)
    display_order = models.PositiveIntegerField(_("display order"), default=0)
    addons = models.ManyToManyField(
        Addon, blank=True, related_name="products", verbose_name=_("add-ons")
    )

    class Meta:
        verbose_name = _("product")
        verbose_name_plural = _("products")
        ordering = ["display_order", "id"]
        indexes = [
            models.Index(fields=["category", "is_active", "display_order"]),
            models.Index(fields=["is_active", "is_featured"]),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(price__gt=0), name="product_price_positive"),
            models.CheckConstraint(
                condition=models.Q(sale_price__isnull=True)
                | (models.Q(sale_price__gte=0) & models.Q(sale_price__lt=models.F("price"))),
                name="product_sale_price_below_price",
            ),
        ]

    def __str__(self) -> str:
        return self.name_fr

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name_fr, fallback="product")
        super().save(*args, **kwargs)

    @property
    def effective_price(self) -> Decimal:
        """The price the customer pays before options: the sale price when set."""
        return self.sale_price if self.sale_price is not None else self.price

    @property
    def is_on_sale(self) -> bool:
        return self.sale_price is not None


class ProductVariant(models.Model):
    """
    A mutually exclusive option such as a size. When a product has active
    variants, the customer must choose exactly one.
    """

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    name_fr = models.CharField(_("name (French)"), max_length=120)
    name_ar = models.CharField(_("name (Arabic)"), max_length=120, blank=True)
    name_en = models.CharField(_("name (English)"), max_length=120, blank=True)
    price_delta = money_field(
        _("additional price"),
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    display_order = models.PositiveIntegerField(_("display order"), default=0)
    is_active = models.BooleanField(_("active"), default=True)

    class Meta:
        verbose_name = _("product variant")
        verbose_name_plural = _("product variants")
        ordering = ["display_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["product", "name_fr"], name="variant_unique_name"),
            models.CheckConstraint(
                condition=models.Q(price_delta__gte=0), name="variant_price_delta_non_negative"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product} — {self.name_fr}"


class ProductImage(models.Model):
    """Additional gallery images; the main image lives on Product.image."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(
        _("image"), upload_to=UploadTo("products/gallery"), validators=IMAGE_VALIDATORS
    )
    display_order = models.PositiveIntegerField(_("display order"), default=0)

    class Meta:
        verbose_name = _("product image")
        verbose_name_plural = _("product images")
        ordering = ["display_order", "id"]

    def __str__(self) -> str:
        return f"{self.product} image #{self.pk}"
