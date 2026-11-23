"""
Uploaded media on Supabase Storage (used on Vercel, whose disk is not kept).

Files go to a public bucket through the Storage REST API, authenticated with
the server-side service key; the site links to their public URL. Only the
standard library is used, to keep the serverless bundle small.
"""

import json
import mimetypes
import posixpath
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

TIMEOUT = 20  # seconds


class SupabaseStorageError(Exception):
    pass


@deconstructible
class SupabaseStorage(Storage):
    def __init__(self, url=None, key=None, bucket=None):
        self.base_url = (url or settings.SUPABASE_URL).rstrip("/")
        self.key = key or settings.SUPABASE_SERVICE_KEY
        self.bucket = bucket or settings.SUPABASE_STORAGE_BUCKET
        # Every request below goes to this base URL: never a file:// or custom scheme.
        if not self.base_url.startswith("https://"):
            raise ValueError("SUPABASE_URL must be an https:// URL.")

    # --- HTTP -------------------------------------------------------------------
    def _request(self, method: str, path: str, *, data=None, headers=None, json_body=None):
        headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}", **(headers or {})}
        if json_body is not None:
            data = json.dumps(json_body).encode()
            headers["Content-Type"] = "application/json"
        request = Request(  # noqa: S310 - https base URL checked in __init__
            f"{self.base_url}/storage/v1/{path}", data=data, headers=headers, method=method
        )
        try:
            with urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310 - https only
                body = response.read()
        except HTTPError as error:
            raise SupabaseStorageError(
                f"Supabase Storage {method} {path}: HTTP {error.code} {error.read()[:200]!r}"
            ) from error
        return json.loads(body) if body else None

    def _object_path(self, name: str) -> str:
        return f"{quote(self.bucket)}/{quote(name)}"

    # --- Storage API ----------------------------------------------------------------
    def _save(self, name, content):
        name = name.replace("\\", "/")
        content.seek(0)
        content_type = (
            getattr(content, "content_type", None)
            or mimetypes.guess_type(name)[0]
            or "application/octet-stream"
        )
        self._request(
            "POST",
            f"object/{self._object_path(name)}",
            data=content.read(),
            headers={"Content-Type": content_type, "x-upsert": "false"},
        )
        return name

    def _open(self, name, mode="rb"):
        request = Request(self.url(name))  # noqa: S310 - https base URL checked in __init__
        with urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310 - https only
            return ContentFile(response.read(), name=name)

    def delete(self, name):
        if name:
            self._request("DELETE", f"object/{quote(self.bucket)}", json_body={"prefixes": [name]})

    def exists(self, name):
        folder, filename = posixpath.split(name.replace("\\", "/"))
        found = self._request(
            "POST",
            f"object/list/{quote(self.bucket)}",
            json_body={"prefix": folder, "search": filename, "limit": 100},
        )
        return any(item.get("name") == filename for item in found or [])

    def url(self, name):
        return f"{self.base_url}/storage/v1/object/public/{self._object_path(name)}"

    def size(self, name):
        raise NotImplementedError("Sizes are not tracked for Supabase Storage files.")

    # --- Setup -------------------------------------------------------------------------
    def ensure_public_bucket(self) -> bool:
        """Create the public bucket if missing; returns True when it was created."""
        try:
            self._request("GET", f"bucket/{quote(self.bucket)}")
            return False
        except SupabaseStorageError:
            self._request(
                "POST",
                "bucket",
                json_body={
                    "id": self.bucket,
                    "name": self.bucket,
                    "public": True,
                    "file_size_limit": settings.MAX_IMAGE_UPLOAD_SIZE,
                    "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"],
                },
            )
            return True
