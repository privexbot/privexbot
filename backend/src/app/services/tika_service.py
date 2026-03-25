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
- Handle batch processing with adaptive timeouts

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
- Adaptive timeouts based on file size/complexity
- Retry logic with exponential backoff

ROBUSTNESS FEATURES:
- Adaptive timeout: 30s base + 1s per 100KB + OCR multiplier
- Max timeout: 10 minutes for very large/complex files
- Retry with exponential backoff (3 attempts)
- Graceful fallback: text-only extraction on OCR failure
- Progress callbacks for long operations
- Memory-efficient streaming for large files
"""

import os
import asyncio
import requests
from typing import Dict, Any, Optional, BinaryIO, List, Callable
from datetime import datetime
from io import BytesIO
import magic  # python-magic for MIME type detection
import time


class TikaConfig:
    """Configuration for Tika service with adaptive settings"""

    def __init__(
        self,
        url: str = None,
        base_timeout: int = 30,  # Base timeout in seconds
        timeout_per_100kb: float = 1.0,  # Additional seconds per 100KB
        ocr_multiplier: float = 3.0,  # Timeout multiplier for OCR-enabled files
        max_timeout: int = 600,  # Maximum timeout (10 minutes)
        min_timeout: int = 30,  # Minimum timeout
        max_file_size_mb: int = 100,  # Increased from 50MB
        ocr_enabled: bool = True,
        max_retries: int = 3,  # Number of retry attempts
        retry_backoff_base: float = 2.0,  # Exponential backoff base
        retry_backoff_max: int = 30,  # Max backoff seconds
    ):
        self.url = url or os.getenv("TIKA_URL", "http://tika:9998")
        self.base_timeout = base_timeout
        self.timeout_per_100kb = timeout_per_100kb
        self.ocr_multiplier = ocr_multiplier
        self.max_timeout = max_timeout
        self.min_timeout = min_timeout
        self.max_file_size_mb = max_file_size_mb
        self.ocr_enabled = ocr_enabled
        self.max_retries = max_retries
        self.retry_backoff_base = retry_backoff_base
        self.retry_backoff_max = retry_backoff_max


class ParsedFile:
    """Parsed file result from Tika"""

    def __init__(
        self,
        content: str,
        metadata: Dict[str, Any],
        mime_type: str,
        file_size: int,
        page_count: Optional[int] = None,
        parsing_time_ms: int = 0,
        warnings: Optional[List[str]] = None,
        ocr_used: bool = False
    ):
        self.content = content
        self.metadata = metadata
        self.mime_type = mime_type
        self.file_size = file_size
        self.page_count = page_count
        self.parsing_time_ms = parsing_time_ms
        self.warnings = warnings or []
        self.ocr_used = ocr_used

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
            "parsed_at": datetime.utcnow().isoformat(),
            "warnings": self.warnings,
            "ocr_used": self.ocr_used
        }


class FileComplexityAnalyzer:
    """Analyze file complexity to estimate processing time"""

    # File types that typically require OCR
    OCR_HEAVY_TYPES = {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/tiff",
        "image/bmp"
    }

    # File types that are typically fast to parse
    FAST_PARSE_TYPES = {
        "text/plain",
        "text/csv",
        "text/markdown",
        "application/json",
        "text/html",
        "application/xml"
    }

    # File types that are moderately complex
    MODERATE_TYPES = {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint"
    }

    @classmethod
    def estimate_complexity(
        cls,
        file_size_bytes: int,
        mime_type: str,
        ocr_enabled: bool = True
    ) -> Dict[str, Any]:
        """
        Estimate file complexity and processing time.

        Returns:
            Dictionary with complexity analysis:
            - complexity_level: 'low', 'medium', 'high', 'very_high'
            - estimated_time_seconds: Estimated processing time
            - ocr_likely: Whether OCR will likely be needed
            - warnings: Any warnings for the user
        """
        file_size_mb = file_size_bytes / (1024 * 1024)
        warnings = []

        # Determine if OCR is likely
        ocr_likely = ocr_enabled and mime_type in cls.OCR_HEAVY_TYPES

        # Base time estimation
        if mime_type in cls.FAST_PARSE_TYPES:
            base_time = 2 + (file_size_mb * 0.5)
            complexity = "low"
        elif mime_type in cls.MODERATE_TYPES:
            base_time = 5 + (file_size_mb * 1.5)
            complexity = "medium"
        else:
            base_time = 10 + (file_size_mb * 2)
            complexity = "high"

        # OCR multiplier
        if ocr_likely:
            base_time *= 4  # OCR is much slower
            complexity = "high" if complexity == "medium" else "very_high"
            warnings.append("OCR processing may be required, which can take several minutes for large files")

        # Size-based warnings
        if file_size_mb > 20:
            warnings.append(f"Large file ({file_size_mb:.1f} MB) - processing may take longer")
            if complexity in ("low", "medium"):
                complexity = "medium" if complexity == "low" else "high"

        if file_size_mb > 50:
            complexity = "very_high"
            warnings.append("Very large file - consider splitting into smaller documents")

        return {
            "complexity_level": complexity,
            "estimated_time_seconds": int(base_time),
            "ocr_likely": ocr_likely,
            "warnings": warnings,
            "file_size_mb": round(file_size_mb, 2)
        }


class TikaService:
    """
    Apache Tika document parsing service with production-ready robustness.

    FEATURES:
    - Adaptive timeouts based on file size and complexity
    - Retry logic with exponential backoff
    - Graceful fallback (OCR failure -> text-only extraction)
    - Progress callbacks for long operations
    - Comprehensive error handling with actionable messages

    PRIVACY: Runs locally in Docker (no external API calls)
    FORMATS: 15+ document formats supported
    SPEED: Adaptive based on file complexity
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
        print(f"[TikaService] Adaptive timeout: {self.config.base_timeout}s base + {self.config.timeout_per_100kb}s/100KB")
        print(f"[TikaService] Max timeout: {self.config.max_timeout}s")

    def calculate_adaptive_timeout(
        self,
        file_size_bytes: int,
        mime_type: str,
        use_ocr: bool = True
    ) -> int:
        """
        Calculate adaptive timeout based on file characteristics.

        Formula:
            timeout = base + (file_size_kb / 100) * timeout_per_100kb
            if OCR: timeout *= ocr_multiplier

        Args:
            file_size_bytes: Size of file in bytes
            mime_type: MIME type of file
            use_ocr: Whether OCR processing is enabled

        Returns:
            Calculated timeout in seconds
        """
        file_size_kb = file_size_bytes / 1024

        # Base timeout + size-based timeout
        timeout = self.config.base_timeout + (file_size_kb / 100) * self.config.timeout_per_100kb

        # Apply OCR multiplier for image-heavy formats
        if use_ocr and mime_type in FileComplexityAnalyzer.OCR_HEAVY_TYPES:
            timeout *= self.config.ocr_multiplier

        # Apply moderate multiplier for Office documents
        if mime_type in FileComplexityAnalyzer.MODERATE_TYPES:
            timeout *= 1.5

        # Clamp to min/max
        timeout = max(self.config.min_timeout, min(timeout, self.config.max_timeout))

        return int(timeout)

    async def parse_file(
        self,
        file_stream: BinaryIO,
        filename: str,
        metadata_only: bool = False,
        progress_callback: Optional[Callable[[str, int], None]] = None
    ) -> ParsedFile:
        """
        Parse file and extract text content + metadata with robust error handling.

        Args:
            file_stream: File binary stream
            filename: Original filename (for extension detection)
            metadata_only: If True, only extract metadata (no content)
            progress_callback: Optional callback for progress updates
                               Signature: callback(status_message, progress_percent)

        Returns:
            ParsedFile object with content and metadata

        Raises:
            ValueError: If file is invalid or too large
            ConnectionError: If Tika service is unavailable
            RuntimeError: If parsing fails after all retries
        """
        start_time = datetime.utcnow()
        warnings = []

        def report_progress(message: str, percent: int):
            if progress_callback:
                progress_callback(message, percent)
            print(f"[TikaService] {message} ({percent}%)")

        report_progress("Reading file", 5)

        # Read file content
        file_content = file_stream.read()
        file_size = len(file_content)

        # Check file size limit
        max_size_bytes = self.config.max_file_size_mb * 1024 * 1024
        if file_size > max_size_bytes:
            raise ValueError(
                f"File too large: {file_size / 1024 / 1024:.1f} MB "
                f"(max: {self.config.max_file_size_mb} MB). "
                f"Please split the document into smaller parts."
            )

        # Handle empty files
        if file_size == 0:
            raise ValueError("File is empty. Please upload a file with content.")

        report_progress("Detecting file type", 10)

        # Detect MIME type
        mime_type = self._detect_mime_type(file_content, filename)

        # Analyze file complexity
        complexity = FileComplexityAnalyzer.estimate_complexity(
            file_size, mime_type, self.config.ocr_enabled
        )
        warnings.extend(complexity.get("warnings", []))

        # Calculate adaptive timeout
        timeout = self.calculate_adaptive_timeout(
            file_size, mime_type, self.config.ocr_enabled
        )

        print(f"[TikaService] Parsing file: {filename}")
        print(f"[TikaService] Size: {file_size / 1024:.1f} KB, MIME: {mime_type}")
        print(f"[TikaService] Complexity: {complexity['complexity_level']}, Est. time: {complexity['estimated_time_seconds']}s")
        print(f"[TikaService] Calculated timeout: {timeout}s")

        report_progress(f"Starting document parsing (complexity: {complexity['complexity_level']})", 15)

        # Parse with retry logic
        last_error = None
        ocr_used = self.config.ocr_enabled and mime_type in FileComplexityAnalyzer.OCR_HEAVY_TYPES

        for attempt in range(self.config.max_retries):
            try:
                if metadata_only:
                    report_progress(f"Extracting metadata (attempt {attempt + 1})", 20)
                    metadata = await self._extract_metadata(
                        file_content, mime_type, timeout
                    )
                    content = ""
                else:
                    report_progress(
                        f"Extracting content {'with OCR' if ocr_used else ''} (attempt {attempt + 1})",
                        20 + (attempt * 10)
                    )
                    content, metadata = await self._extract_content_and_metadata(
                        file_content, mime_type, timeout, use_ocr=ocr_used
                    )

                # Success!
                break

            except requests.exceptions.Timeout as e:
                last_error = e
                print(f"[TikaService] Timeout on attempt {attempt + 1}/{self.config.max_retries}")

                # If OCR was enabled, try without OCR as fallback
                if ocr_used and attempt == 0:
                    print("[TikaService] Retrying without OCR (fallback mode)")
                    warnings.append("OCR processing timed out - extracted text without OCR")
                    ocr_used = False
                    continue

                # Exponential backoff before retry
                if attempt < self.config.max_retries - 1:
                    backoff = min(
                        self.config.retry_backoff_base ** attempt,
                        self.config.retry_backoff_max
                    )
                    report_progress(f"Retrying in {backoff:.1f}s", 30 + (attempt * 15))
                    await asyncio.sleep(backoff)
                    # Increase timeout for next attempt
                    timeout = min(timeout * 1.5, self.config.max_timeout)
                    print(f"[TikaService] Increased timeout to {timeout}s for retry")

            except requests.exceptions.ConnectionError as e:
                last_error = e
                print(f"[TikaService] Connection error on attempt {attempt + 1}")

                if attempt < self.config.max_retries - 1:
                    backoff = min(
                        self.config.retry_backoff_base ** attempt,
                        self.config.retry_backoff_max
                    )
                    await asyncio.sleep(backoff)

            except Exception as e:
                last_error = e
                print(f"[TikaService] Error on attempt {attempt + 1}: {str(e)}")

                if attempt < self.config.max_retries - 1:
                    backoff = min(
                        self.config.retry_backoff_base ** attempt,
                        self.config.retry_backoff_max
                    )
                    await asyncio.sleep(backoff)

        else:
            # All retries exhausted
            return self._handle_parsing_failure(
                last_error, filename, file_size, mime_type, timeout, complexity
            )

        report_progress("Processing results", 90)

        # Calculate parsing time
        parsing_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        # Extract page count from metadata if available
        page_count = self._extract_page_count(metadata)

        # Content quality check
        if content and len(content.strip()) < 10:
            warnings.append("Extracted content is very short - file may be mostly images or empty")

        report_progress("Parsing completed", 100)

        print(f"[TikaService] Parsing completed in {parsing_time_ms}ms")
        print(f"[TikaService] Extracted {len(content)} characters")
        if page_count:
            print(f"[TikaService] Document has {page_count} pages")
        if warnings:
            print(f"[TikaService] Warnings: {warnings}")

        return ParsedFile(
            content=content,
            metadata=metadata,
            mime_type=mime_type,
            file_size=file_size,
            page_count=page_count,
            parsing_time_ms=parsing_time_ms,
            warnings=warnings,
            ocr_used=ocr_used
        )

    def _handle_parsing_failure(
        self,
        error: Exception,
        filename: str,
        file_size: int,
        mime_type: str,
        timeout: int,
        complexity: Dict[str, Any]
    ) -> ParsedFile:
        """
        Handle parsing failure with detailed error message and suggestions.

        Raises:
            RuntimeError or ConnectionError with actionable message
        """
        file_size_mb = file_size / (1024 * 1024)

        # Build helpful error message
        suggestions = []

        if isinstance(error, requests.exceptions.Timeout):
            base_message = f"Document parsing timed out after {timeout}s"

            if complexity['complexity_level'] == 'very_high':
                suggestions.append("This file is very complex. Try splitting it into smaller parts.")
            if complexity.get('ocr_likely'):
                suggestions.append("The file may contain scanned images requiring OCR.")
                suggestions.append("Try re-saving the PDF with text layer if available.")
            if file_size_mb > 20:
                suggestions.append(f"The file is large ({file_size_mb:.1f} MB). Consider compressing or splitting it.")

            suggestions.append("If this is a scanned document, try using a clearer scan.")
            suggestions.append("For PDFs, try converting to searchable PDF first.")

        elif isinstance(error, requests.exceptions.ConnectionError):
            base_message = "Cannot connect to document parsing service"
            suggestions.append("The Tika service may be starting up. Please try again in a moment.")
            suggestions.append("If the problem persists, contact support.")

        else:
            base_message = f"Document parsing failed: {str(error)}"
            suggestions.append("The file format may not be supported or the file may be corrupted.")
            suggestions.append("Try opening and re-saving the file in its native application.")

        # Format the full error message
        error_message = f"{base_message}.\n\nSuggestions:\n" + "\n".join(f"• {s}" for s in suggestions)

        if isinstance(error, requests.exceptions.ConnectionError):
            raise ConnectionError(error_message) from error
        else:
            raise RuntimeError(error_message) from error

    async def _extract_content_and_metadata(
        self,
        file_content: bytes,
        mime_type: str,
        timeout: int,
        use_ocr: bool = True
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

        # OCR configuration - only applies to PDFs and images
        if use_ocr and mime_type in FileComplexityAnalyzer.OCR_HEAVY_TYPES:
            if mime_type == "application/pdf":
                headers["X-Tika-PDFOcrStrategy"] = "ocr_and_text"
            # For images, Tika uses OCR by default

        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.put(
                url,
                data=file_content,
                headers=headers,
                timeout=timeout
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
                # CRITICAL: Normalize each section's content to remove leading/trailing whitespace
                section_content = section["X-TIKA:content"]
                if section_content:
                    # Strip whitespace and normalize multiple consecutive newlines
                    normalized = section_content.strip()
                    if normalized:
                        content_parts.append(normalized)

        content = "\n\n".join(content_parts)

        # CRITICAL: Final content normalization to prevent empty space in preview
        # Remove excessive blank lines (more than 2 consecutive newlines -> 2)
        import re
        content = re.sub(r'\n{3,}', '\n\n', content)
        content = content.strip()

        # Metadata is in the first section
        metadata = self._clean_metadata(result[0])

        return content, metadata

    async def _extract_metadata(
        self,
        file_content: bytes,
        mime_type: str,
        timeout: int
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
                timeout=timeout
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
                "ppt": "application/vnd.ms-powerpoint",
                "txt": "text/plain",
                "csv": "text/csv",
                "json": "application/json",
                "html": "text/html",
                "xml": "application/xml",
                "md": "text/markdown",
                "rtf": "application/rtf",
                "odt": "application/vnd.oasis.opendocument.text",
                "ods": "application/vnd.oasis.opendocument.spreadsheet",
                "odp": "application/vnd.oasis.opendocument.presentation",
                "epub": "application/epub+zip",
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "tiff": "image/tiff",
                "tif": "image/tiff",
                "bmp": "image/bmp"
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
        max_concurrent: int = 3,
        progress_callback: Optional[Callable[[str, int, int], None]] = None
    ) -> List[ParsedFile]:
        """
        Parse multiple files concurrently with progress tracking.

        Args:
            files: List of (file_stream, filename) tuples
            max_concurrent: Maximum concurrent parsing tasks
            progress_callback: Optional callback for progress updates
                               Signature: callback(filename, current, total)

        Returns:
            List of ParsedFile objects (successful parses only)
        """
        total = len(files)
        semaphore = asyncio.Semaphore(max_concurrent)
        completed = {"count": 0}

        async def parse_with_semaphore(file_stream, filename):
            async with semaphore:
                try:
                    result = await self.parse_file(file_stream, filename)
                    completed["count"] += 1
                    if progress_callback:
                        progress_callback(filename, completed["count"], total)
                    return result
                except Exception as e:
                    completed["count"] += 1
                    if progress_callback:
                        progress_callback(f"{filename} (failed)", completed["count"], total)
                    print(f"[TikaService] Failed to parse {filename}: {e}")
                    return e

        tasks = [
            parse_with_semaphore(stream, name)
            for stream, name in files
        ]

        results = await asyncio.gather(*tasks, return_exceptions=False)

        # Filter out exceptions and return successful parses
        parsed_files = []
        failures = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failures.append({"filename": files[i][1], "error": str(result)})
            else:
                parsed_files.append(result)

        if failures:
            print(f"[TikaService] Batch parsing: {len(parsed_files)} succeeded, {len(failures)} failed")

        return parsed_files

    async def check_health(self) -> Dict[str, Any]:
        """
        Check if Tika service is available and get service info.

        Returns:
            Dictionary with health status and service info
        """
        try:
            loop = asyncio.get_event_loop()

            # Check basic connectivity
            response = await loop.run_in_executor(
                None,
                lambda: requests.get(
                    f"{self.config.url}/tika",
                    timeout=10
                )
            )

            if response.status_code == 200:
                return {
                    "healthy": True,
                    "status": "operational",
                    "url": self.config.url,
                    "message": "Tika service is running",
                    "config": {
                        "max_file_size_mb": self.config.max_file_size_mb,
                        "ocr_enabled": self.config.ocr_enabled,
                        "max_timeout": self.config.max_timeout
                    }
                }
            else:
                return {
                    "healthy": False,
                    "status": "error",
                    "url": self.config.url,
                    "message": f"Tika returned status {response.status_code}"
                }

        except requests.exceptions.ConnectionError:
            return {
                "healthy": False,
                "status": "unavailable",
                "url": self.config.url,
                "message": "Cannot connect to Tika service. Is the container running?"
            }

        except Exception as e:
            return {
                "healthy": False,
                "status": "error",
                "url": self.config.url,
                "message": f"Health check failed: {str(e)}"
            }

    async def analyze_file(
        self,
        file_stream: BinaryIO,
        filename: str
    ) -> Dict[str, Any]:
        """
        Analyze file without parsing (for complexity estimation).

        Useful for showing users estimated processing time before upload.

        Args:
            file_stream: File binary stream
            filename: Original filename

        Returns:
            Complexity analysis with estimated time
        """
        file_content = file_stream.read()
        file_size = len(file_content)

        # Reset stream position
        file_stream.seek(0)

        mime_type = self._detect_mime_type(file_content, filename)
        complexity = FileComplexityAnalyzer.estimate_complexity(
            file_size, mime_type, self.config.ocr_enabled
        )

        timeout = self.calculate_adaptive_timeout(file_size, mime_type)

        return {
            "filename": filename,
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "mime_type": mime_type,
            "complexity": complexity,
            "estimated_timeout_seconds": timeout,
            "can_process": file_size <= (self.config.max_file_size_mb * 1024 * 1024)
        }


# Global instance (singleton)
tika_service = TikaService()
