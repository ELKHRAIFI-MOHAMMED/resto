"""
An offer (pack) has a fixed price and one or more groups of choices, e.g.
"Family offer, 500 MAD": 3 main dishes, 3 desserts and 3 drinks, each chosen
from the products the restaurant allowed for that group. The customer may pick
the same product several times in a group.

A chosen product is served in its default size (its first active variant), with
no extras: the offer price covers everything.
"""

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.core.money import money_field
from apps.core.uploads import IMAGE_VALIDATORS, UploadTo
from apps.core.utils import unique_slug
from apps.products.models import Product

MAX_GROUP_QUANTITY = 20
MAX_GROUPS = 10


class OfferQuerySet(models.QuerySet):
    def current(self, today=None):
        """Active offers whose promotion period (if any) includes today."""
        today = today or timezone.localdate()
        return self.filter(is_active=True).filter(
            models.Q(starts_on__isnull=True) | models.Q(starts_on__lte=today),
            models.Q(ends_on__isnull=True) | models.Q(ends_on__gte=today),
        )


class Offer(TimeStampedModel):
    name_fr = models.CharField(_("name (French)"), max_length=160)
    name_ar = models.CharField(_("name (Arabic)"), max_length=160, blank=True)
    name_en = models.CharField(_("name (English)"), max_length=160, blank=True)
    slug = models.SlugField(_("slug"), max_length=180, unique=True, blank=True)
    description_fr = models.TextField(_("description (French)"), blank=True)
    description_ar = models.TextField(_("description (Arabic)"), blank=True)
    description_en = models.TextField(_("description (English)"), blank=True)
    price = money_field(_("price"), validators=[MinValueValidator(Decimal("0.01"))])
    image = models.ImageField(
        _("image"), upload_to=UploadTo("offers"), blank=True, validators=IMAGE_VALIDATORS
    )
    is_active = models.BooleanField(_("active"), default=True)
    starts_on = models.DateField(_("starts on"), null=True, blank=True)
    ends_on = models.DateField(_("ends on"), null=True, blank=True)
    display_order = models.PositiveIntegerField(_("display order"), default=0)

    objects = OfferQuerySet.as_manager()

    class Meta:
        verbose_name = _("offer")
        verbose_name_plural = _("offers")
        ordering = ["display_order", "id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(price__gt=0), name="offer_price_positive"),
            models.CheckConstraint(
                condition=models.Q(starts_on__isnull=True)
                | models.Q(ends_on__isnull=True)
                | models.Q(ends_on__gte=models.F("starts_on")),
                name="offer_period_ordered",
            ),
        ]

    def __str__(self) -> str:
        return self.name_fr

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name_fr, fallback="offer")
        super().save(*args, **kwargs)


class OfferGroup(models.Model):
    """One choice to make, e.g. "3 main dishes" among tacos, pizzas and burgers."""

    offer = models.ForeignKey(Offer, on_delete=models.CASCADE, related_name="groups")
    name_fr = models.CharField(_("name (French)"), max_length=120)
    name_ar = models.CharField(_("name (Arabic)"), max_length=120, blank=True)
    name_en = models.CharField(_("name (English)"), max_length=120, blank=True)
    quantity = models.PositiveSmallIntegerField(
        _("number of items to choose"),
        validators=[MinValueValidator(1), MaxValueValidator(MAX_GROUP_QUANTITY)],
    )
    products = models.ManyToManyField(
        Product, related_name="offer_groups", verbose_name=_("products to choose from")
    )
    display_order = models.PositiveIntegerField(_("display order"), default=0)

    class Meta:
        verbose_name = _("offer group")
        verbose_name_plural = _("offer groups")
        ordering = ["display_order", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1) & models.Q(quantity__lte=MAX_GROUP_QUANTITY),
                name="offer_group_quantity_range",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.offer} — {self.name_fr} (x{self.quantity})"
