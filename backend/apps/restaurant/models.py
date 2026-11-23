from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.core.money import money_field
from apps.core.phone import validate_whatsapp_number
from apps.core.uploads import IMAGE_VALIDATORS, UploadTo


class Restaurant(TimeStampedModel):
    """
    The restaurant's profile and settings. RestoFlow serves exactly one
    restaurant, so this table holds a single row (enforced by a constraint).
    """

    class Currency(models.TextChoices):
        MAD = "MAD", _("Moroccan dirham")

    singleton = models.PositiveSmallIntegerField(default=1, unique=True, editable=False)

    # Identity
    name = models.CharField(_("name"), max_length=120, default="RestoFlow")
    logo = models.ImageField(
        _("logo"), upload_to=UploadTo("restaurant"), blank=True, validators=IMAGE_VALIDATORS
    )
    description_fr = models.TextField(_("description (French)"), blank=True)
    description_ar = models.TextField(_("description (Arabic)"), blank=True)
    description_en = models.TextField(_("description (English)"), blank=True)

    # Contact
    address = models.CharField(_("address"), max_length=255, blank=True)
    city = models.CharField(_("city"), max_length=100, blank=True)
    phone = models.CharField(_("phone"), max_length=20, blank=True)
    whatsapp_number = models.CharField(
        _("WhatsApp number"),
        max_length=15,
        blank=True,
        validators=[validate_whatsapp_number],
        help_text=_("International format, digits only, e.g. 212612345678."),
    )
    email = models.EmailField(_("email"), blank=True)
    currency = models.CharField(
        _("currency"), max_length=3, choices=Currency.choices, default=Currency.MAD
    )

    # Social links
    facebook_url = models.URLField(_("Facebook URL"), blank=True)
    instagram_url = models.URLField(_("Instagram URL"), blank=True)
    tiktok_url = models.URLField(_("TikTok URL"), blank=True)
    google_maps_url = models.URLField(_("Google Maps URL"), max_length=500, blank=True)

    # Ordering & delivery configuration
    is_accepting_orders = models.BooleanField(_("accepting orders"), default=True)
    delivery_enabled = models.BooleanField(_("delivery enabled"), default=True)
    pickup_enabled = models.BooleanField(_("pickup enabled"), default=True)
    auto_assign_couriers = models.BooleanField(
        _("assign couriers automatically"),
        default=True,
        help_text=_(
            "When a delivery order is confirmed, give it to an on-duty courier of its zone."
        ),
    )
    minimum_order_amount = money_field(
        _("minimum order amount for delivery"),
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    free_delivery_threshold = money_field(
        _("free delivery from"),
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_("Subtotal from which delivery is free. Leave empty to disable."),
    )

    class Meta:
        verbose_name = _("restaurant")
        verbose_name_plural = _("restaurant")
        constraints = [
            models.CheckConstraint(condition=models.Q(singleton=1), name="restaurant_singleton"),
            models.CheckConstraint(
                condition=models.Q(minimum_order_amount__gte=0),
                name="restaurant_minimum_order_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(free_delivery_threshold__isnull=True)
                | models.Q(free_delivery_threshold__gte=0),
                name="restaurant_free_delivery_threshold_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        self.singleton = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "Restaurant":
        """Return the restaurant, creating the row with defaults on first use."""
        restaurant, _created = cls.objects.get_or_create(singleton=1)
        return restaurant


class OpeningHour(models.Model):
    """
    One opening slot. A day may have several slots (e.g. lunch and dinner).
    A slot whose closing time is earlier than its opening time runs past
    midnight. A day with no slot, or only `is_closed` rows, is closed.
    """

    class Weekday(models.IntegerChoices):
        MONDAY = 0, _("Monday")
        TUESDAY = 1, _("Tuesday")
        WEDNESDAY = 2, _("Wednesday")
        THURSDAY = 3, _("Thursday")
        FRIDAY = 4, _("Friday")
        SATURDAY = 5, _("Saturday")
        SUNDAY = 6, _("Sunday")

    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name="opening_hours"
    )
    weekday = models.PositiveSmallIntegerField(_("weekday"), choices=Weekday.choices)
    opens_at = models.TimeField(_("opens at"), null=True, blank=True)
    closes_at = models.TimeField(_("closes at"), null=True, blank=True)
    is_closed = models.BooleanField(_("closed"), default=False)

    class Meta:
        verbose_name = _("opening hour")
        verbose_name_plural = _("opening hours")
        ordering = ["weekday", "opens_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(is_closed=True)
                | (
                    models.Q(opens_at__isnull=False, closes_at__isnull=False)
                    & ~models.Q(opens_at=models.F("closes_at"))
                ),
                name="opening_hour_times_required_when_open",
            ),
            models.UniqueConstraint(
                fields=["restaurant", "weekday", "opens_at"], name="opening_hour_unique_slot"
            ),
        ]

    def __str__(self) -> str:
        day = self.get_weekday_display()
        if self.is_closed:
            return f"{day}: closed"
        return f"{day}: {self.opens_at:%H:%M}-{self.closes_at:%H:%M}"
