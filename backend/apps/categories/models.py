from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.core.uploads import IMAGE_VALIDATORS, UploadTo
from apps.core.utils import unique_slug


class Category(TimeStampedModel):
    name_fr = models.CharField(_("name (French)"), max_length=120)
    name_ar = models.CharField(_("name (Arabic)"), max_length=120, blank=True)
    name_en = models.CharField(_("name (English)"), max_length=120, blank=True)
    slug = models.SlugField(_("slug"), max_length=140, unique=True, blank=True)
    description_fr = models.TextField(_("description (French)"), blank=True)
    description_ar = models.TextField(_("description (Arabic)"), blank=True)
    description_en = models.TextField(_("description (English)"), blank=True)
    image = models.ImageField(
        _("image"), upload_to=UploadTo("categories"), blank=True, validators=IMAGE_VALIDATORS
    )
    display_order = models.PositiveIntegerField(_("display order"), default=0)
    is_active = models.BooleanField(_("active"), default=True)

    class Meta:
        verbose_name = _("category")
        verbose_name_plural = _("categories")
        ordering = ["display_order", "id"]
        indexes = [models.Index(fields=["is_active", "display_order"])]

    def __str__(self) -> str:
        return self.name_fr

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name_fr, fallback="category")
        super().save(*args, **kwargs)
