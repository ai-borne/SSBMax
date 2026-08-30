"""
Shared upload helper for the Python content-image pipelines (TAT step1/step2,
PPDT step3).

Mirrors scripts/lib/firebaseImageUpload.js: uploads with a
firebaseStorageDownloadTokens metadata token instead of blob.make_public(),
and returns the CSP-allowlisted firebasestorage.googleapis.com download URL
plus the object path (for a future storagePath field), instead of a raw
storage.googleapis.com URL that (a) is blocked by web's CSP img-src and
(b) requires a public GCS ACL that bypasses storage.rules.
"""

import uuid
from typing import Any
from urllib.parse import quote


def upload_image_and_get_url(bucket: Any, data: bytes, destination: str, content_type: str) -> tuple[str, str]:
    """Uploads bytes to Storage and returns (image_url, storage_path)."""
    token = str(uuid.uuid4())
    blob = bucket.blob(destination)
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(data, content_type=content_type)

    encoded_path = quote(destination, safe="")
    image_url = (
        f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/"
        f"{encoded_path}?alt=media&token={token}"
    )
    return image_url, destination
