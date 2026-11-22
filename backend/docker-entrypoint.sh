#!/bin/sh
# Prepare the database, then start the given command (Gunicorn by default).
set -e
python manage.py migrate --noinput
python manage.py createcachetable
exec "$@"
