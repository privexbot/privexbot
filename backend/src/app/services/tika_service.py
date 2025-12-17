"""
Tika Service - Universal document parsing for file uploads.

WHY:
- Support 15+ file formats (PDF, DOCX, TXT, CSV, JSON, etc.)
- Extract text from binary formats
- Preserve document structure and metadata
- Privacy-focused (local processing via Docker)

HOW:
- Apache Tika REST API via Docker container
- Supports OCR for scanned documents
- Extract metadata (author, created date, page count)
- Handle batch processing

SUPPORTED FORMATS:
- Documents: PDF, DOCX, DOC, ODT, RTF
- Spreadsheets: XLSX, XLS, ODS, CSV
- Presentations: PPTX, PPT, ODP
- Text: TXT, MD, JSON, XML, HTML
- Images: PNG, JPG (with OCR)

ARCHITECTURE:
- Tika Server runs in Docker container
- REST API endpoint: http://tika:9998
- Async requests for non-blocking processing
"""

import os
import asyncio
import requests
from typing import Dict, Any, Optional, BinaryIO, List
from datetime import datetime
from io import BytesIO
import magic  # python-magic for MIME type detection


class TikaConfig:
    """Configuration for Tika service"""

    def __init__(
        self,
        url: str = None,
        timeout: int = 120,  # 2 minutes for large files
        max_file_size_mb: int = 50,
        ocr_enabled: bool = True
    ):
        self.url = url or os.getenv("TIKA_URL", "http://tika:9998")
        self.timeout = timeout
        self.max_file_size_mb = max_file_size_mb
        self.ocr_enabled = ocr_enabled


class ParsedFile:
    """Parsed file result from Tika"""

    def __init__(
        self,
        content: str,
        metadata: Dict[str, Any],
        mime_type: str,
        file_size: int,
        page_count: Optional[int] = None,
        parsing_time_ms: int = 0
    ):
        self.content = content
        self.metadata = metadata
        self.mime_type = mime_type
        self.file_size = file_size
        self.page_count = page_count
        self.parsing_time_ms = parsing_time_ms

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            "content": self.content,
            "metadata": self.metadata,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "page_count": self.page_count,
            "parsing_time_ms": self.parsing_time_ms,
            "char_count": len(self.content),
            "word_count": len(self.content.split()),
            "parsed_at": datetime.utcnow().isoformat()
        }


class TikaService:
    """
    Apache Tika document parsing service.

    PRIVACY: Runs locally in Docker (no external API calls)
    FORMATS: 15+ document formats supported
    SPEED: ~1-5 seconds per document (depends on size)
    OCR: Optional for scanned images/PDFs

    Usage:
        service = TikaService()
        result = await service.parse_file(file_stream, filename)
        print(result.content)  # Extracted text
        print(result.metadata)  # Document metadata
    """

    def __init__(self, config: Optional[TikaConfig] = None):
        """
        Initialize Tika service.

        Args:
            config: Tika configuration (optional)
        """
        self.config = config or TikaConfig()
        self._mime_detector = magic.Magic(mime=True)

        print(f"[TikaService] Initialized with URL: {self.config.url}")
        print(f"[TikaService] OCR enabled: {self.config.ocr_enabled}")
        print(f"[TikaService] Max file size: {self.config.max_file_size_mb} MB")

    async def parse_file(
        self,
        file_stream: BinaryIO,
        filename: str,
        metadata_only: bool = False
    ) -> ParsedFile:
        """
        Parse file and extract text content + metadata.

        Args:
            file_stream: File binary stream
            filename: Original filename (for extension detection)
            metadata_only: If True, only extract metadata (no content)

        Returns:
            ParsedFile object with content and metadata

        Raises:
            ValueError: If file is invalid or too large
            ConnectionError: If Tika service is unavailable
            RuntimeError: If parsing fails
        """

        start_time = datetime.utcnow()

        # Read file content
        file_content = file_stream.read()
        file_size = len(file_content)

        # Check file size limit
        max_size_bytes = self.config.max_file_size_mb * 1024 * 1024
        if file_size > max_size_bytes:
            raise ValueError(
                f"File too large: {file_size / 1024 / 1024:.1f} MB "
                f"(max: {self.config.max_file_size_mb} MB)"
            )

        # Detect MIME type
        mime_type = self._detect_mime_type(file_content, filename)

        print(f"[TikaService] Parsing file: {filename}")
        print(f"[TikaService] Size: {file_size / 1024:.1f} KB, MIME: {mime_type}")

        # Parse with Tika
        try:
            if metadata_only:
                # Extract metadata only (faster)
                metadata = await self._extract_metadata(file_content, mime_type)
                content = ""
            else:
                # Extract both content and metadata
                content, metadata = await self._extract_content_and_metadata(
                    file_content, mime_type
                )

            # Calculate parsing time
            parsing_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            # Extract page count from metadata if available
            page_count = self._extract_page_count(metadata)

            print(f"[TikaService] Parsing completed in {parsing_time_ms}ms")
            print(f"[TikaService] Extracted {len(content)} characters")
            if page_count:
                print(f"[TikaService] Document has {page_count} pages")

            return ParsedFile(
                content=content,
                metadata=metadata,
                mime_type=mime_type,
                file_size=file_size,
                page_count=page_count,
                parsing_time_ms=parsing_time_ms
            )

        except requests.exceptions.ConnectionError as e:
            raise ConnectionError(
                f"Cannot connect to Tika service at {self.config.url}. "
                "Is Tika Docker container running?"
            ) from e

        except requests.exceptions.Timeout as e:
            raise RuntimeError(
                f"Tika parsing timeout after {self.config.timeout}s. "
                "File may be too complex or large."
            ) from e

        except Exception as e:
            raise RuntimeError(f"Tika parsing failed: {str(e)}") from e

    async def _extract_content_and_metadata(
        self,
        file_content: bytes,
        mime_type: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Extract both content and metadata using Tika /rmeta endpoint.

        WHY: Single request for both content + metadata (efficient)
        HOW: Use /rmeta/text endpoint which returns JSON with both
        """

        url = f"{self.config.url}/rmeta/text"

        headers = {
            "Content-Type": mime_type,
            "Accept": "application/json"
        }

        # OCR configuration - only applies to PDFs
        if self.config.ocr_enabled and mime_type == "application/pdf":
            headers["X-Tika-PDFOcrStrategy"] = "ocr_and_text"

        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.put(
                url,
                data=file_content,
                headers=headers,
                timeout=self.config.timeout
            )
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Tika API error: {response.status_code} - {response.text}"
            )

        # Parse response (Tika returns list of dicts, one per page/section)
        result = response.json()

        if not result or len(result) == 0:
            return "", {}

        # Extract content from all sections
        content_parts = []
        for section in result:
            if "X-TIKA:content" in section:
                content_parts.append(section["X-TIKA:content"])

        content = "\n\n".join(content_parts)

        # Metadata is in the first section
        metadata = self._clean_metadata(result[0])

        return content, metadata

    async def _extract_metadata(
        self,
        file_content: bytes,
        mime_type: str
    ) -> Dict[str, Any]:
        """
        Extract metadata only (no content) using /meta endpoint.

        WHY: Faster when only metadata is needed
        HOW: Use /meta endpoint which returns metadata JSON
        """

        url = f"{self.config.url}/meta"

        headers = {
            "Content-Type": mime_type,
            "Accept": "application/json"
        }

        # Run in thread pool
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.put(
                url,
                data=file_content,
                headers=headers,
                timeout=self.config.timeout
            )
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Tika API error: {response.status_code} - {response.text}"
            )

        metadata = response.json()
        return self._clean_metadata(metadata)

    def _detect_mime_type(self, file_content: bytes, filename: str) -> str:
        """
        Detect MIME type from file content and extension.

        WHY: Accurate MIME type needed for Tika parsing
        HOW: Use python-magic for content-based detection, fallback to extension
        """

        try:
            # Primary: Detect from content (most accurate)
            mime_type = self._mime_detector.from_buffer(file_content)
            return mime_type

        except Exception:
            # Fallback: Detect from extension
            extension = filename.split(".")[-1].lower()
            mime_map = {
                "pdf": "application/pdf",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "doc": "application/msword",
                "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "xls": "application/vnd.ms-excel",
                "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "txt": "text/plain",
                "csv": "text/csv",
                "json": "application/json",
                "html": "text/html",
                "xml": "application/xml",
                "md": "text/markdown"
            }
            return mime_map.get(extension, "application/octet-stream")

    def _clean_metadata(self, raw_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clean and normalize Tika metadata.

        WHY: Tika returns verbose metadata with Tika-specific keys
        HOW: Extract useful fields, rename keys, remove Tika internals
        """

        cleaned = {}

        # Field mapping (Tika key -> our key)
        field_map = {
            "dc:title": "title",
            "dc:creator": "author",
            "meta:author": "author",
            "dc:subject": "subject",
            "dc:description": "description",
            "created": "created_date",
            "dcterms:created": "created_date",
            "modified": "modified_date",
            "dcterms:modified": "modified_date",
            "meta:page-count": "page_count",
            "xmpTPg:NPages": "page_count",
            "Content-Type": "content_type",
            "Content-Length": "content_length",
            "resourceName": "filename"
        }

        for tika_key, our_key in field_map.items():
            if tika_key in raw_metadata:
                value = raw_metadata[tika_key]
                # Handle list values (take first)
                if isinstance(value, list) and len(value) > 0:
                    value = value[0]
                cleaned[our_key] = value

        # Add any other non-Tika-internal fields
        for key, value in raw_metadata.items():
            if not key.startswith(("X-TIKA", "X-Parsed-By", "Content-Encoding")):
                if key not in field_map:
                    cleaned[key] = value

        return cleaned

    def _extract_page_count(self, metadata: Dict[str, Any]) -> Optional[int]:
        """Extract page count from metadata"""

        # Try various page count fields
        for field in ["page_count", "xmpTPg:NPages", "meta:page-count"]:
            if field in metadata:
                try:
                    return int(metadata[field])
                except (ValueError, TypeError):
                    pass

        return None

    async def parse_batch(
        self,
        files: List[tuple[BinaryIO, str]],
        max_concurrent: int = 3
    ) -> List[ParsedFile]:
        """
        Parse multiple files concurrently.

        Args:
            files: List of (file_stream, filename) tuples
            max_concurrent: Maximum concurrent parsing tasks

        Returns:
            List of ParsedFile objects
        """

        semaphore = asyncio.Semaphore(max_concurrent)

        async def parse_with_semaphore(file_stream, filename):
            async with semaphore:
                return await self.parse_file(file_stream, filename)

        tasks = [
            parse_with_semaphore(stream, name)
            for stream, name in files
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions and return successful parses
        parsed_files = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"[TikaService] Failed to parse file {files[i][1]}: {result}")
            else:
                parsed_files.append(result)

        return parsed_files

    async def check_health(self) -> bool:
        """
        Check if Tika service is available.

        Returns:
            True if service is healthy, False otherwise
        """

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: requests.get(
                    f"{self.config.url}/tika",
                    timeout=5
                )
            )
            return response.status_code == 200

        except Exception as e:
            print(f"[TikaService] Health check failed: {e}")
            return False


# Global instance (singleton)
tika_service = TikaService()
