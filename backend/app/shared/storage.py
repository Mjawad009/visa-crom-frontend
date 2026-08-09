"""
Object storage — single seam over Cloudflare R2 (S3-compatible API).

Only this file knows about boto3/R2 specifics. The File Service module
(and later, the full Document Management module) calls these functions
and never touches boto3 directly, so switching providers later is a
one-file change.
"""
import uuid

import boto3
from botocore.client import Config

from app.core.config import get_settings

settings = get_settings()


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def build_storage_key(entity_type: str, entity_id: str, filename: str) -> str:
    """Deterministic, collision-resistant key layout: entity/type/id/uuid_filename."""
    return f"{entity_type}/{entity_id}/{uuid.uuid4()}_{filename}"


def generate_upload_url(storage_key: str, content_type: str, expires_in: int = 900) -> str:
    """Presigned PUT URL — the frontend uploads directly to R2, so file
    bytes never pass through our API server."""
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": storage_key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )


def generate_download_url(storage_key: str, expires_in: int = 900) -> str:
    """Presigned GET URL — enforces that only users who passed our
    permission checks ever get a working link, and links expire quickly."""
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": storage_key},
        ExpiresIn=expires_in,
    )


def delete_object(storage_key: str) -> None:
    _client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=storage_key)


def download_object_bytes(storage_key: str) -> bytes:
    """Server-side fetch of the raw object — used by OCR, which needs
    actual bytes rather than a link the browser follows."""
    response = _client().get_object(Bucket=settings.R2_BUCKET_NAME, Key=storage_key)
    return response["Body"].read()
