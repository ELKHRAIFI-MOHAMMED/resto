#!/bin/sh
# Prepare the database, then start the given command (Gunicorn by default).
set -e
python manage.py migrate --noinput
python manage.py createcachetable
# A brand-new database gets the initial menu, offers and zones (no-op afterwards).
python manage.py load_initial_data
exec "$@"
