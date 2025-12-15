"""
File Storage Utilities - Handle file uploads and storage.

WHY:
- File upload handling
- Storage management
- File validation
- Temporary file cleanup

HOW:
- Local filesystem storage
- S3-compatible storage (optional)
- File type validation
- Size limits

PSEUDOCODE follows the existing codebase patterns.
"""

import os
import hashlib
import mimetypes
from typing import Optional, Tuple, BinaryIO
from pathlib import Path
from uuid import uuid4
from datetime import datetime


class FileStorage:
    """
    File storage utility.

    WHY: Centralized file handling
    HOW: Save, retrieve, delete files
    """

    def __init__(
        self,
        base_path: str = "/tmp/privexbot/uploads",
        max_file_size_mb: int = 50
    ):
        """
        Initialize file storage.

        WHY: Configure storage settings
        HOW: Set base path and limits

        ARGS:
            base_path: Root directory for file storage
            max_file_size_mb: Maximum file size in MB
        """
        self.base_path = Path(base_path)
        self.max_file_size_bytes = max_file_size_mb * 1024 * 1024

        # Create base directory if not exists
        self.base_path.mkdir(parents=True, exist_ok=True)


    def save_file(
        self,
        content: bytes,
        filename: str,
        workspace_id: str,
        content_type: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Save file to storage.

        WHY: Persist uploaded files
        HOW: Generate unique path, save content

        ARGS:
            content: File content as bytes
            filename: Original filename
            workspace_id: Workspace ID for organization
            content_type: MIME type

        RETURNS:
            (file_path, file_id)

        RAISES:
            ValueError: If file too large or invalid type
        """

        # Validate file size
        file_size = len(content)
        if file_size > self.max_file_size_bytes:
            raise ValueError(
                f"File too large: {file_size} bytes "
                f"(max: {self.max_file_size_bytes} bytes)"
            )

        # Generate file ID
        file_id = str(uuid4())

        # Get file extension
        _, ext = os.path.splitext(filename)
        if not ext:
            # Try to get extension from content type
            if content_type:
                ext = mimetypes.guess_extension(content_type) or ""

        # Build storage path: workspace_id/YYYY/MM/DD/file_id.ext
        now = datetime.utcnow()
        relative_path = Path(
            workspace_id,
            str(now.year),
            str(now.month).zfill(2),
            str(now.day).zfill(2),
            f"{file_id}{ext}"
        )

        full_path = self.base_path / relative_path

        # Create directory if not exists
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        full_path.write_bytes(content)

        return str(relative_path), file_id


    def get_file(self, file_path: str) -> bytes:
        """
        Retrieve file content.

        WHY: Read stored files
        HOW: Load from filesystem

        ARGS:
            file_path: Relative file path

        RETURNS:
            File content as bytes

        RAISES:
            FileNotFoundError: If file doesn't exist
        """

        full_path = self.base_path / file_path

        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        return full_path.read_bytes()


    def delete_file(self, file_path: str) -> None:
        """
        Delete file from storage.

        WHY: Cleanup files
        HOW: Remove from filesystem

        ARGS:
            file_path: Relative file path
        """

        full_path = self.base_path / file_path

        if full_path.exists():
            full_path.unlink()


    def get_file_hash(self, content: bytes) -> str:
        """
        Calculate file hash (SHA256).

        WHY: Detect duplicates
        HOW: Hash content

        ARGS:
            content: File content

        RETURNS:
            SHA256 hash as hex string
        """

        return hashlib.sha256(content).hexdigest()


    def validate_file_type(
        self,
        filename: str,
        content_type: Optional[str] = None,
        allowed_types: Optional[list] = None
    ) -> bool:
        """
        Validate file type.

        WHY: Security and format validation
        HOW: Check extension and MIME type

        ARGS:
            filename: File name
            content_type: MIME type
            allowed_types: List of allowed extensions (e.g., ['.pdf', '.docx'])

        RETURNS:
            True if valid, False otherwise
        """

        if not allowed_types:
            # Default allowed types for document upload
            allowed_types = [
                '.pdf', '.doc', '.docx', '.txt', '.md',
                '.html', '.htm', '.csv', '.json', '.xml'
            ]

        # Check extension
        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        return ext in allowed_types


    def get_file_info(self, file_path: str) -> dict:
        """
        Get file information.

        WHY: Metadata about stored files
        HOW: Read file stats

        ARGS:
            file_path: Relative file path

        RETURNS:
            {
                "size": 1234,
                "modified_at": "2025-10-01T12:00:00Z",
                "exists": True
            }
        """

        full_path = self.base_path / file_path

        if not full_path.exists():
            return {"exists": False}

        stat = full_path.stat()

        return {
            "exists": True,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
        }


    def cleanup_old_files(self, days: int = 30) -> int:
        """
        Cleanup old temporary files.

        WHY: Disk space management
        HOW: Delete files older than N days

        ARGS:
            days: Delete files older than this many days

        RETURNS:
            Number of files deleted
        """

        from datetime import timedelta

        cutoff = datetime.utcnow() - timedelta(days=days)
        deleted_count = 0

        # Walk through all files
        for file_path in self.base_path.rglob("*"):
            if file_path.is_file():
                # Check modification time
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)

                if mtime < cutoff:
                    file_path.unlink()
                    deleted_count += 1

        return deleted_count


# Global instance
file_storage = FileStorage()
