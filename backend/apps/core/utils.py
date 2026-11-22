from django.utils.text import slugify


def unique_slug(instance, value: str, *, field: str = "slug", fallback: str = "item") -> str:
    """Slugify `value` and append -2, -3, ... until it is unique for the model."""
    base = slugify(value)[:120] or fallback
    model = type(instance)
    queryset = model._default_manager.all()
    if instance.pk:
        queryset = queryset.exclude(pk=instance.pk)

    candidate, suffix = base, 2
    while queryset.filter(**{field: candidate}).exists():
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate
