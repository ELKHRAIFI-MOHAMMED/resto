from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower
from django.utils.translation import gettext_lazy as _

from .managers import UserManager


class User(AbstractUser):
    """
    Back-office user. Customers never have accounts: they order as guests
    and confirm through WhatsApp.
    """

    class Role(models.TextChoices):
        OWNER = "owner", _("Owner")  # full access, including restaurant settings
        MANAGER = "manager", _("Manager")  # catalog and order management
        COURIER = "courier", _("Courier")  # delivery app only, never staff

    username = None
    email = models.EmailField(_("email address"), unique=True)
    role = models.CharField(_("role"), max_length=20, choices=Role.choices, default=Role.MANAGER)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        ordering = ["email"]
        constraints = [
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique"),
        ]

    def save(self, *args, **kwargs):
        self.email = UserManager.normalize_email_address(self.email)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.email

    @property
    def is_courier(self) -> bool:
        return self.role == self.Role.COURIER and not self.is_staff

    @property
    def is_owner(self) -> bool:
        return self.is_superuser or self.role == self.Role.OWNER
