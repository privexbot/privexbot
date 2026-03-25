"""
StorageService - MinIO S3-compatible object storage wrapper.

Provides file upload, download (presigned URLs), and deletion for:
- avatars: Public-read bucket for profile images
- kb-files: Private bucket for knowledge base source files
- chat-files: Private bucket for widget chat file uploads

Object key convention (multi-tenant isolation via prefix):
  avatars/{entity_type}/{entity_id}/avatar.{ext}
  kb-files/{workspace_id}/{kb_id}/{document_id}/{filename}
  chat-files/{workspace_id}/{session_id}/{timestamp}_{filename}
"""

import io
import json
from datetime import timedelta
from typing import Optional
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from app.core.config import settings


# Bucket definitions
BUCKET_AVATARS = "avatars"
BUCKET_KB_FILES = "kb-files"
BUCKET_CHAT_FILES = "chat-files"

ALL_BUCKETS = [BUCKET_AVATARS, BUCKET_KB_FILES, BUCKET_CHAT_FILES]

# Public read policy for avatars bucket
AVATARS_PUBLIC_POLICY = json.dumps({
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {"AWS": ["*"]},
            "Action": ["s3:GetObject"],
            "Resource": [f"arn:aws:s3:::{BUCKET_AVATARS}/*"]
        }
    ]
})



class StorageService:
    """Wraps MinIO Python SDK for file storage operations."""

    def __init__(self):
        self._client: Optional[Minio] = None
        self._public_client: Optional[Minio] = None

    @property
    def client(self) -> Minio:
        """Lazy-initialize the internal MinIO client (Docker network)."""
        if self._client is None:
            self._client = Minio(
                endpoint=settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ROOT_USER,
                secret_key=settings.MINIO_ROOT_PASSWORD,
                secure=settings.MINIO_SECURE,
            )
        return self._client

    @property
    def public_client(self) -> Minio:
        """
        Lazy-initialize the public MinIO client for presigned URLs.

        Presigned URLs must use the external URL (MINIO_PUBLIC_URL),
        not the internal Docker endpoint.
        """
        if self._public_client is None:
            parsed = urlparse(settings.MINIO_PUBLIC_URL)
            host = parsed.hostname
            port = parsed.port
            endpoint = f"{host}:{port}" if port else host
            secure = parsed.scheme == "https"
            self._public_client = Minio(
                endpoint=endpoint,
                access_key=settings.MINIO_ROOT_USER,
                secret_key=settings.MINIO_ROOT_PASSWORD,
                secure=secure,
            )
        return self._public_client

    def ensure_buckets(self) -> None:
        """
        Create required buckets on startup (idempotent).
        Sets public-read policy on avatars bucket.
        """
        for bucket in ALL_BUCKETS:
            try:
                if not self.client.bucket_exists(bucket):
                    self.client.make_bucket(bucket)
                    print(f"  Created bucket: {bucket}")
                else:
                    print(f"  Bucket exists: {bucket}")
            except S3Error as e:
                print(f"  Warning: Could not create bucket {bucket}: {e}")

        # Set public read policy on avatars bucket
        try:
            self.client.set_bucket_policy(BUCKET_AVATARS, AVATARS_PUBLIC_POLICY)
            print(f"  Set public-read policy on: {BUCKET_AVATARS}")
        except S3Error as e:
            print(f"  Warning: Could not set policy on {BUCKET_AVATARS}: {e}")

    def upload_file(
        self,
        bucket: str,
        object_key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        """
        Upload a file to MinIO.

        Args:
            bucket: Target bucket name
            object_key: Object path within bucket
            data: File content as bytes
            content_type: MIME type of the file

        Returns:
            The object key (for storage in database)
        """
        self.client.put_object(
            bucket_name=bucket,
            object_name=object_key,
            data=io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return object_key

    def upload_stream(
        self,
        bucket: str,
        object_key: str,
        stream: io.IOBase,
        length: int,
        content_type: str = "application/octet-stream",
    ) -> str:
        """
        Upload a file from a stream to MinIO.

        Args:
            bucket: Target bucket name
            object_key: Object path within bucket
            stream: File-like object to read from
            length: Total size of the stream in bytes
            content_type: MIME type of the file

        Returns:
            The object key
        """
        self.client.put_object(
            bucket_name=bucket,
            object_name=object_key,
            data=stream,
            length=length,
            content_type=content_type,
        )
        return object_key

    def get_presigned_download_url(
        self,
        bucket: str,
        object_key: str,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        """
        Generate a presigned download URL using the public endpoint.

        Args:
            bucket: Bucket name
            object_key: Object path
            expires: URL expiry duration (default: 1 hour)

        Returns:
            Presigned HTTPS/HTTP URL for download
        """
        return self.public_client.presigned_get_object(
            bucket_name=bucket,
            object_name=object_key,
            expires=expires,
        )

    def get_presigned_upload_url(
        self,
        bucket: str,
        object_key: str,
        expires: timedelta = timedelta(minutes=10),
    ) -> str:
        """
        Generate a presigned upload URL using the public endpoint.

        Args:
            bucket: Bucket name
            object_key: Object path
            expires: URL expiry duration (default: 10 minutes)

        Returns:
            Presigned URL for PUT upload
        """
        return self.public_client.presigned_put_object(
            bucket_name=bucket,
            object_name=object_key,
            expires=expires,
        )

    def get_public_url(self, bucket: str, object_key: str) -> str:
        """
        Get the direct public URL for an object in a public bucket (e.g., avatars).

        Args:
            bucket: Bucket name (should be public-read)
            object_key: Object path

        Returns:
            Direct URL (no signature, no expiry)
        """
        return f"{settings.MINIO_PUBLIC_URL}/{bucket}/{object_key}"

    def delete_file(self, bucket: str, object_key: str) -> None:
        """Delete a single object from MinIO."""
        self.client.remove_object(
            bucket_name=bucket,
            object_name=object_key,
        )

    def delete_prefix(self, bucket: str, prefix: str) -> None:
        """
        Delete all objects under a given prefix (path).

        Useful for cleaning up all files for an entity (e.g., all KB files).
        """
        objects = self.client.list_objects(bucket, prefix=prefix, recursive=True)
        for obj in objects:
            self.client.remove_object(bucket, obj.object_name)

    def file_exists(self, bucket: str, object_key: str) -> bool:
        """Check if a file exists in MinIO."""
        try:
            self.client.stat_object(bucket, object_key)
            return True
        except S3Error:
            return False

    def get_file(self, bucket: str, object_key: str) -> bytes:
        """
        Download a file from MinIO and return its content as bytes.

        Args:
            bucket: Bucket name
            object_key: Object path

        Returns:
            File content as bytes
        """
        response = self.client.get_object(bucket, object_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()


# Singleton instance
storage_service = StorageService()
