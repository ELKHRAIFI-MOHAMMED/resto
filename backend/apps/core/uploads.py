"""Image upload storage paths and validation."""

import uuid
from pathlib import PurePath

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.images import get_image_dimensions
from django.core.validators import FileExtensionValidator
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _

ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]
MAX_IMAGE_DIMENSION = 6000  # pixels, guards against decompression bombs


@deconstructible
class UploadTo:
    """Store uploads as `<prefix>/<uuid>.<ext>`: never trust client file names."""

    def __init__(self, prefix: str):
        self.prefix = prefix

    def __call__(self, instance, filename: str) -> str:
        extension = PurePath(filename).suffix.lower().lstrip(".") or "jpg"
        return f"{self.prefix}/{uuid.uuid4().hex}.{extension}"

    def __eq__(self, other) -> bool:
        return isinstance(other, UploadTo) and self.prefix == other.prefix

    def __hash__(self) -> int:
        return hash(self.prefix)


def validate_image_file(file) -> None:
    if file.size > settings.MAX_IMAGE_UPLOAD_SIZE:
        limit_mb = settings.MAX_IMAGE_UPLOAD_SIZE // (1024 * 1024)
        raise ValidationError(
            _("The image is too large (maximum %(limit)s MB).") % {"limit": limit_mb},
            code="image_too_large",
        )
    width, height = get_image_dimensions(file)
    if width and height and max(width, height) > MAX_IMAGE_DIMENSION:
        raise ValidationError(
            _("The image dimensions are too large (maximum %(max)s px).")
            % {"max": MAX_IMAGE_DIMENSION},
            code="image_dimensions_too_large",
        )


IMAGE_VALIDATORS = [
    FileExtensionValidator(allowed_extensions=ALLOWED_IMAGE_EXTENSIONS),
    validate_image_file,
]
