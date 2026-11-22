# RestoFlow API: Django + Gunicorn (production image)
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app
RUN useradd --create-home --uid 10001 app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
# collectstatic needs settings but no database or real secret.
RUN DJANGO_SECRET_KEY="build-only-$(python -c 'import secrets; print(secrets.token_urlsafe(64))')" \
    python manage.py collectstatic --noinput \
 && mkdir -p /app/media \
 && chown -R app:app /app/media \
 && chmod +x docker-entrypoint.sh

USER app
EXPOSE 8000
# Probe as nginx would: an allowed Host header and the forwarded HTTPS scheme.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request as r; host = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost').split(',')[0]; r.urlopen(r.Request('http://127.0.0.1:8000/api/health/', headers={'Host': host, 'X-Forwarded-Proto': 'https'}), timeout=4)"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "-c", "gunicorn.conf.py"]
