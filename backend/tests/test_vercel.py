"""Vercel + Supabase deployment helpers: database URL, media storage, API lockdown."""

import json
from io import BytesIO

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile

from apps.core import storage as storage_module
from apps.core.storage import SupabaseStorage
from apps.core.supabase import secure_supabase_tables
from config.database_url import database_from_url

POOLER = "aws-1-us-east-1.pooler.supabase.com"


def test_transaction_pooler_url():
    config = database_from_url(
        f"postgres://postgres.ref:p%40ss@{POOLER}:6543/postgres"
        "?sslmode=require&supa=base-pooler.x&pgbouncer=true"
    )

    assert config["HOST"] == POOLER
    assert config["PORT"] == "6543"
    assert config["USER"] == "postgres.ref"
    assert config["PASSWORD"] == "p@ss"
    assert config["NAME"] == "postgres"
    # Client hints that libpq does not know are dropped
    assert config["OPTIONS"] == {"sslmode": "require", "connect_timeout": 5}
    assert config["DISABLE_SERVER_SIDE_CURSORS"] is True
    assert config["CONN_MAX_AGE"] == 0


def test_session_url_keeps_server_side_cursors_and_requires_ssl():
    config = database_from_url(f"postgres://u:p@{POOLER}:5432/postgres", conn_max_age=30)

    assert config["DISABLE_SERVER_SIDE_CURSORS"] is False
    assert config["OPTIONS"]["sslmode"] == "require"
    assert config["CONN_MAX_AGE"] == 30


class FakeResponse:
    def __init__(self, body=b""):
        self.body = body

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@pytest.fixture
def requests(monkeypatch):
    sent = []

    def fake_urlopen(request, timeout):
        sent.append(request)
        if "/object/list/" in request.full_url:
            return FakeResponse(json.dumps([{"name": "photo.png"}]).encode())
        return FakeResponse(b'{"Key": "media/x"}')

    monkeypatch.setattr(storage_module, "urlopen", fake_urlopen)
    return sent


def _storage():
    return SupabaseStorage(url="https://ref.supabase.co", key="service-key", bucket="media")


def test_storage_uploads_with_the_service_key_and_links_the_public_url(requests):
    storage = _storage()

    name = storage._save("products/photo.png", ContentFile(b"png-bytes", name="photo.png"))

    request = requests[0]
    assert name == "products/photo.png"
    assert request.get_method() == "POST"
    assert request.full_url == "https://ref.supabase.co/storage/v1/object/media/products/photo.png"
    assert request.get_header("Authorization") == "Bearer service-key"
    assert request.get_header("Content-type") == "image/png"
    assert request.data == b"png-bytes"
    assert (
        storage.url(name)
        == "https://ref.supabase.co/storage/v1/object/public/media/products/photo.png"
    )


def test_storage_exists_and_delete(requests):
    storage = _storage()

    assert storage.exists("products/photo.png") is True
    assert storage.exists("products/other.png") is False
    storage.delete("products/photo.png")

    delete = requests[-1]
    assert delete.get_method() == "DELETE"
    assert json.loads(delete.data) == {"prefixes": ["products/photo.png"]}


def test_storage_refuses_non_https_urls():
    with pytest.raises(ValueError, match="https"):
        SupabaseStorage(url="file:///etc", key="k", bucket="media")


def test_storage_reports_api_errors(monkeypatch):
    from urllib.error import HTTPError

    def failing(request, timeout):
        raise HTTPError(request.full_url, 403, "Forbidden", {}, BytesIO(b"denied"))

    monkeypatch.setattr(storage_module, "urlopen", failing)

    with pytest.raises(storage_module.SupabaseStorageError, match="403"):
        _storage()._save("a.png", ContentFile(b"x", name="a.png"))


@pytest.mark.django_db
def test_lockdown_is_a_no_op_outside_supabase():
    # The test database has no Supabase API roles (anon, authenticated).
    assert secure_supabase_tables() == []


def _call(app):
    captured = {}

    def start_response(status, headers):
        captured["status"] = status

    body = b"".join(app({}, start_response))
    return captured["status"], body.decode()


def test_startup_failure_names_the_missing_setting(monkeypatch):
    import django.core.wsgi

    from config import serverless

    def broken():
        raise ImproperlyConfigured("Set the DJANGO_SECRET_KEY environment variable")

    monkeypatch.setattr(django.core.wsgi, "get_wsgi_application", broken)

    status, body = _call(serverless.build_app())

    assert status.startswith("503")
    assert "DJANGO_SECRET_KEY" in body


def test_other_startup_failures_stay_generic(monkeypatch):
    import django.core.wsgi

    from config import serverless

    def broken():
        raise RuntimeError("password=hunter2")

    monkeypatch.setattr(django.core.wsgi, "get_wsgi_application", broken)

    status, body = _call(serverless.build_app())

    assert status.startswith("503")
    assert "RuntimeError" in body
    assert "hunter2" not in body
