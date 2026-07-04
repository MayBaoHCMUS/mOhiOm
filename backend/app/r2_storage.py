import base64
import logging
import re
import uuid
from typing import Any, Optional

import boto3
from botocore.client import Config

from app.config import settings

logger = logging.getLogger(__name__)

_DATA_URL_RE = re.compile(r"^data:image/([a-zA-Z0-9.+-]+);base64,(.*)$", re.DOTALL)


def configured() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET_NAME
        and settings.R2_PUBLIC_URL_BASE
    )


def _client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _public_url(key: str) -> str:
    return f"{settings.R2_PUBLIC_URL_BASE.rstrip('/')}/{key}"


def upload_bytes(data: bytes, folder: str = "misc", content_type: str = "image/png") -> Optional[str]:
    """Upload raw bytes to R2 and return the public URL, or None if R2 isn't configured."""
    if not configured():
        logger.warning("R2 not configured; skipping upload (folder=%s, %d bytes)", folder, len(data))
        return None
    ext = content_type.split("/")[-1].split("+")[0] or "png"
    key = f"{folder}/{uuid.uuid4().hex}.{ext}"
    _client().put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )
    url = _public_url(key)
    logger.info("Uploaded image to R2: %s (%d bytes)", url, len(data))
    return url


def upload_image_base64(data_url_or_raw_b64: str, folder: str = "misc") -> Optional[str]:
    """Strip an optional `data:image/...;base64,` prefix, upload the decoded bytes,
    and return the public URL. Safe to call with either a pure base64 string or a
    full data URL."""
    match = _DATA_URL_RE.match(data_url_or_raw_b64)
    if match:
        content_type = f"image/{match.group(1)}"
        raw_b64 = match.group(2)
    else:
        content_type = "image/png"
        raw_b64 = data_url_or_raw_b64

    try:
        raw_bytes = base64.b64decode(raw_b64)
    except Exception:
        logger.exception("Failed to decode base64 image payload for folder=%s", folder)
        return None

    return upload_bytes(raw_bytes, folder=folder, content_type=content_type)


def _key_from_url(url: str) -> Optional[str]:
    base = settings.R2_PUBLIC_URL_BASE.rstrip("/")
    if not url or not base or not url.startswith(base + "/"):
        return None
    return url[len(base) + 1 :]


def delete_by_url(url: str) -> None:
    """Delete an R2 object given its public URL. No-op if the URL doesn't belong
    to this bucket, or R2 isn't configured."""
    if not configured():
        return
    key = _key_from_url(url)
    if not key:
        logger.warning("delete_by_url: URL not from R2, skipping: %s", url)
        return
    try:
        _client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        logger.info("Deleted from R2: %s", key)
    except Exception:
        logger.exception("Failed to delete R2 object for url=%s", url)


def delete_by_prefix(prefix: str) -> None:
    """Delete every object under a folder prefix (e.g. a project's steps folder).
    Uses the list_objects_v2 paginator so it correctly handles more than 1000 objects."""
    if not configured():
        return
    client = _client()
    paginator = client.get_paginator("list_objects_v2")
    try:
        deleted = 0
        for page in paginator.paginate(Bucket=settings.R2_BUCKET_NAME, Prefix=prefix):
            keys = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
            if keys:
                client.delete_objects(Bucket=settings.R2_BUCKET_NAME, Delete={"Objects": keys})
                deleted += len(keys)
        logger.info("Deleted %d objects from R2 with prefix '%s'", deleted, prefix)
    except Exception:
        logger.exception("Failed to delete R2 objects under prefix=%s", prefix)


def sanitize_base64_in_place(value: Any, folder: str = "steps") -> Any:
    """Recursively walk a dict/list and replace any `data:image/...;base64,...`
    string with its uploaded R2 URL. Leaves already-URL strings and everything
    else untouched. No-op (returns the input unchanged) when R2 isn't configured,
    so a dev environment without R2 credentials keeps working exactly as before."""
    if isinstance(value, str):
        if value.startswith("data:image/") and configured():
            uploaded = upload_image_base64(value, folder=folder)
            return uploaded or value
        return value
    if isinstance(value, list):
        return [sanitize_base64_in_place(v, folder=folder) for v in value]
    if isinstance(value, dict):
        return {k: sanitize_base64_in_place(v, folder=folder) for k, v in value.items()}
    return value
