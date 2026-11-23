"""Validation of DJANGO_SECRET_KEY for production deployments."""


def secret_key_problem(key: str) -> str | None:
    """Why a secret key is unusable, without ever echoing the key itself."""
    if not key:
        return "it is empty"
    if key != key.strip():
        return "it starts or ends with spaces or a line break"
    if key[:1] in "\"'" or key[-1:] in "\"'":
        return "it is wrapped in quotes (paste the value without quotes)"
    if key.startswith("change-me"):
        return "it is still the example value from .env.example"
    if len(key) < 50:
        return f"it is {len(key)} characters long, at least 50 are required"
    return None
