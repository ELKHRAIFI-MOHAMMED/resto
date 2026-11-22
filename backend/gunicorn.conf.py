"""Gunicorn settings for the production container."""

import os

bind = "0.0.0.0:8000"
workers = int(os.environ.get("WEB_CONCURRENCY", "3"))
threads = int(os.environ.get("GUNICORN_THREADS", "2"))
timeout = 30
graceful_timeout = 30
max_requests = 1000  # recycle workers periodically
max_requests_jitter = 100
accesslog = "-"
errorlog = "-"
# Only nginx (same private network) talks to Gunicorn; trust its forwarded headers.
forwarded_allow_ips = "*"
