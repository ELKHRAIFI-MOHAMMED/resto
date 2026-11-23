from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.core.money import money_field


class DeliveryZone(TimeStampedModel):
    """A delivery area (typically a neighbourhood) with its own fee and minimum order."""

    name_fr = models.CharField(_("name (French)"), max_length=120, unique=True)
    name_ar = models.CharField(_("name (Arabic)"), max_length=120, blank=True)
    name_en = models.CharField(_("name (English)"), max_length=120, blank=True)
    delivery_fee = money_field(_("delivery fee"), validators=[MinValueValidator(Decimal("0"))])
    minimum_order_amount = money_field(
        _("minimum order amount"),
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    display_order = models.PositiveIntegerField(_("display order"), default=0)
    is_active = models.BooleanField(_("active"), default=True)

    class Meta:
        verbose_name = _("delivery zone")
        verbose_name_plural = _("delivery zones")
        ordering = ["display_order", "name_fr"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(delivery_fee__gte=0), name="delivery_zone_fee_non_negative"
            ),
            models.CheckConstraint(
                condition=models.Q(minimum_order_amount__gte=0),
                name="delivery_zone_minimum_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return self.name_fr


class Courier(TimeStampedModel):
    """
    A delivery person. Their login is a User with the `courier` role (never
    staff); this profile holds what dispatch needs.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="courier"
    )
    phone = models.CharField(_("phone"), max_length=20, blank=True)
    zones = models.ManyToManyField(
        DeliveryZone, blank=True, related_name="couriers", verbose_name=_("zones served")
    )
    is_on_duty = models.BooleanField(_("on duty"), default=False)
    last_assigned_at = models.DateTimeField(_("last assignment"), null=True, blank=True)

    class Meta:
        verbose_name = _("courier")
        verbose_name_plural = _("couriers")
        ordering = ["user__first_name", "user__email"]

    def __str__(self) -> str:
        return self.display_name

    @property
    def display_name(self) -> str:
        return self.user.get_full_name() or self.user.email
