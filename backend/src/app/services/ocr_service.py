"""
OCR Service - Extract text from images in web content.

WHY:
- Images often contain important textual information
- Charts, diagrams, and infographics have valuable content
- Screenshots of code or documentation need to be searchable
- Improve content completeness for RAG systems

HOW:
- Use pytesseract for local OCR processing
- Support multiple image formats
- Extract text while preserving context
- Handle images from web scraping results

INTEGRATES WITH: content_enhancement_service.py, crawl4ai_service.py
"""

import re
import asyncio
import tempfile
import os
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
from urllib.parse import urlparse, urljoin
import hashlib

import requests
from PIL import Image, ImageEnhance, ImageFilter
from pydantic import BaseModel, Field

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


@dataclass
class OCRResult:
    """Result of OCR processing"""
    image_url: str
    extracted_text: str
    confidence_score: float
    processing_time: float
    image_size: Tuple[int, int]
    success: bool
    error_message: Optional[str] = None


class OCRConfig(BaseModel):
    """Configuration for OCR processing"""

    # Enable/Disable OCR
    enabled: bool = Field(
        default=False,  # Disabled by default due to processing overhead
        description="Enable OCR text extraction from images"
    )

    # Image Processing
    max_image_size: Tuple[int, int] = Field(
        default=(1920, 1080),
        description="Maximum image dimensions for processing"
    )
    enhance_image: bool = Field(
        default=True,
        description="Apply image enhancement before OCR"
    )
    supported_formats: List[str] = Field(
        default_factory=lambda: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'],
        description="Supported image formats for OCR"
    )

    # OCR Settings
    language: str = Field(
        default='eng',
        description="Tesseract language code (eng, fra, deu, etc.)"
    )
    psm_mode: int = Field(
        default=3,  # Fully automatic page segmentation
        ge=0, le=13,
        description="Tesseract Page Segmentation Mode (0-13)"
    )
    min_confidence: float = Field(
        default=30.0,
        ge=0.0, le=100.0,
        description="Minimum confidence threshold for OCR results"
    )

    # Content Filtering
    min_text_length: int = Field(
        default=10,
        ge=1,
        description="Minimum length of extracted text to include"
    )
    filter_noise: bool = Field(
        default=True,
        description="Filter out noisy/garbage OCR results"
    )

    # Performance
    max_images_per_page: int = Field(
        default=10,
        ge=1, le=50,
        description="Maximum images to process per page"
    )
    timeout_seconds: int = Field(
        default=30,
        ge=5, le=120,
        description="Timeout for image download and processing"
    )


class OCRService:
    """
    Service for extracting text from images using OCR.

    PHILOSOPHY: Extract valuable text content from images to improve RAG completeness
    INTEGRATES WITH: preview_service.py, content_enhancement_service.py
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        # Check tesseract availability
        if not TESSERACT_AVAILABLE:
            print("Warning: pytesseract not available. OCR functionality disabled.")

    def is_available(self) -> bool:
        """Check if OCR service is available"""
        return TESSERACT_AVAILABLE

    async def extract_text_from_images(
        self,
        content: str,
        base_url: Optional[str] = None,
        config: Optional[OCRConfig] = None
    ) -> Tuple[str, List[OCRResult]]:
        """
        Extract text from all images in content.

        Args:
            content: HTML/Markdown content with image references
            base_url: Base URL for resolving relative image URLs
            config: OCR processing configuration

        Returns:
            Tuple of (enhanced_content_with_image_text, ocr_results)
        """

        if not config:
            config = OCRConfig()

        if not config.enabled or not self.is_available():
            return content, []

        try:
            # Find all image URLs in content
            image_urls = self._extract_image_urls(content, base_url)

            if not image_urls:
                return content, []

            # Limit number of images processed
            image_urls = image_urls[:config.max_images_per_page]

            # Process images concurrently
            ocr_results = await self._process_images_batch(image_urls, config)

            # Generate enhanced content with image text
            enhanced_content = self._integrate_image_text(content, ocr_results)

            return enhanced_content, ocr_results

        except Exception as e:
            print(f"Warning: OCR processing failed: {e}")
            return content, []

    def _extract_image_urls(self, content: str, base_url: Optional[str]) -> List[str]:
        """Extract all image URLs from content"""

        image_urls = []

        # Find markdown images: ![alt](url)
        markdown_images = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', content)
        for alt, url in markdown_images:
            image_urls.append(self._resolve_url(url, base_url))

        # Find HTML img tags: <img src="url">
        html_images = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', content, re.IGNORECASE)
        for url in html_images:
            image_urls.append(self._resolve_url(url, base_url))

        # Filter valid image URLs and formats
        valid_urls = []
        for url in image_urls:
            if self._is_valid_image_url(url):
                valid_urls.append(url)

        return list(set(valid_urls))  # Remove duplicates

    def _resolve_url(self, url: str, base_url: Optional[str]) -> str:
        """Resolve relative URLs to absolute URLs"""
        if not url.startswith(('http://', 'https://')):
            if base_url:
                return urljoin(base_url, url)
        return url

    def _is_valid_image_url(self, url: str) -> bool:
        """Check if URL is a valid image URL"""
        try:
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return False

            # Check file extension
            path = parsed.path.lower()
            return any(path.endswith(f'.{fmt}') for fmt in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'])

        except Exception:
            return False

    async def _process_images_batch(
        self,
        image_urls: List[str],
        config: OCRConfig
    ) -> List[OCRResult]:
        """Process multiple images concurrently"""

        # Create tasks for concurrent processing
        tasks = [
            self._process_single_image(url, config)
            for url in image_urls
        ]

        # Execute with timeout
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=config.timeout_seconds * len(image_urls)
            )

            # Filter successful results
            ocr_results = []
            for result in results:
                if isinstance(result, OCRResult) and result.success:
                    ocr_results.append(result)

            return ocr_results

        except asyncio.TimeoutError:
            print("Warning: OCR processing timed out")
            return []

    async def _process_single_image(self, image_url: str, config: OCRConfig) -> OCRResult:
        """Process a single image with OCR"""

        start_time = asyncio.get_event_loop().time()

        result = OCRResult(
            image_url=image_url,
            extracted_text="",
            confidence_score=0.0,
            processing_time=0.0,
            image_size=(0, 0),
            success=False
        )

        try:
            # Download image
            image_data = await self._download_image(image_url, config.timeout_seconds)
            if not image_data:
                result.error_message = "Failed to download image"
                return result

            # Process image with OCR
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                try:
                    # Load and preprocess image
                    image = Image.open(image_data)
                    result.image_size = image.size

                    # Resize if too large
                    if (image.size[0] > config.max_image_size[0] or
                        image.size[1] > config.max_image_size[1]):
                        image.thumbnail(config.max_image_size, Image.Resampling.LANCZOS)

                    # Enhance image for better OCR
                    if config.enhance_image:
                        image = self._enhance_image_for_ocr(image)

                    # Save processed image
                    image.save(temp_file.name, 'PNG')

                    # Perform OCR
                    custom_config = f'--oem 3 --psm {config.psm_mode} -l {config.language}'

                    # Get text with confidence
                    ocr_data = pytesseract.image_to_data(
                        temp_file.name,
                        config=custom_config,
                        output_type=pytesseract.Output.DICT
                    )

                    # Extract text and calculate confidence
                    text_parts = []
                    confidences = []

                    for i, conf in enumerate(ocr_data['conf']):
                        if int(conf) > config.min_confidence:
                            text = ocr_data['text'][i].strip()
                            if text:
                                text_parts.append(text)
                                confidences.append(int(conf))

                    extracted_text = ' '.join(text_parts)
                    avg_confidence = sum(confidences) / len(confidences) if confidences else 0

                    # Filter noise and apply minimum length
                    if (len(extracted_text) >= config.min_text_length and
                        avg_confidence >= config.min_confidence):

                        if config.filter_noise:
                            extracted_text = self._filter_ocr_noise(extracted_text)

                        result.extracted_text = extracted_text
                        result.confidence_score = avg_confidence
                        result.success = True

                finally:
                    # Clean up temp file
                    if os.path.exists(temp_file.name):
                        os.unlink(temp_file.name)

        except Exception as e:
            result.error_message = str(e)

        result.processing_time = asyncio.get_event_loop().time() - start_time
        return result

    async def _download_image(self, url: str, timeout: int) -> Optional[bytes]:
        """Download image data from URL"""
        try:
            loop = asyncio.get_event_loop()

            # Run in thread pool to avoid blocking
            response = await loop.run_in_executor(
                None,
                lambda: self.session.get(url, timeout=timeout, stream=True)
            )

            if response.status_code == 200:
                return response.content

        except Exception as e:
            print(f"Failed to download image {url}: {e}")

        return None

    def _enhance_image_for_ocr(self, image: Image.Image) -> Image.Image:
        """Apply image enhancements to improve OCR accuracy"""

        # Convert to grayscale if not already
        if image.mode != 'L':
            image = image.convert('L')

        # Enhance contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)

        # Enhance sharpness
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(2.0)

        # Apply slight blur to reduce noise
        image = image.filter(ImageFilter.MedianFilter(size=3))

        return image

    def _filter_ocr_noise(self, text: str) -> str:
        """Filter out common OCR noise and artifacts"""

        # Remove single character "words"
        words = text.split()
        filtered_words = [word for word in words if len(word) > 1 or word.isalnum()]

        # Remove excessive punctuation
        filtered_text = ' '.join(filtered_words)
        filtered_text = re.sub(r'[^\w\s\.\,\!\?\;\:\-\(\)]', '', filtered_text)

        # Normalize whitespace
        filtered_text = re.sub(r'\s+', ' ', filtered_text).strip()

        return filtered_text

    def _integrate_image_text(self, content: str, ocr_results: List[OCRResult]) -> str:
        """Integrate OCR results into the original content"""

        if not ocr_results:
            return content

        # Create image text section
        image_sections = []
        for i, result in enumerate(ocr_results):
            if result.extracted_text:
                section = f"""## Image {i+1} Text Content

**Source:** {result.image_url}
**Confidence:** {result.confidence_score:.1f}%

{result.extracted_text}

"""
                image_sections.append(section)

        if image_sections:
            image_content = "\n---\n\n# Extracted Image Text\n\n" + "\n".join(image_sections)
            return content + image_content

        return content


# Global service instance
ocr_service = OCRService()