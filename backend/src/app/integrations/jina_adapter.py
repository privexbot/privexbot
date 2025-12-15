"""
Jina Adapter - Jina AI Reader API integration.

WHY:
- Convert web pages to LLM-friendly format
- Extract clean content from URLs
- Handle JavaScript-heavy sites
- Get structured markdown output

HOW:
- Use Jina Reader API (r.jina.ai)
- Get markdown formatted content
- No API key required for basic usage
- Fallback to direct requests

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Optional
import requests


class JinaAdapter:
    """
    Jina AI Reader integration.

    WHY: Clean web content extraction
    HOW: Use r.jina.ai service
    """

    def __init__(self):
        """
        Initialize Jina adapter.

        WHY: Setup API configuration
        HOW: Configure endpoints and defaults
        """
        self.reader_url = "https://r.jina.ai"
        self.timeout = 30


    async def read_url(
        self,
        url: str,
        format: str = "markdown"
    ) -> dict:
        """
        Read URL using Jina Reader.

        WHY: Extract clean content from URL
        HOW: Prepend r.jina.ai to URL

        ARGS:
            url: URL to read
            format: "markdown" | "text"

        RETURNS:
            {
                "url": "https://example.com",
                "title": "Page Title",
                "content": "Markdown formatted content...",
                "metadata": {
                    "description": "...",
                    "reading_time": 5
                }
            }

        EXAMPLE:
            https://r.jina.ai/https://example.com
            Returns markdown formatted content
        """

        try:
            # Construct Jina Reader URL
            reader_url = f"{self.reader_url}/{url}"

            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; PrivexBot/1.0)",
                "Accept": "text/plain" if format == "text" else "text/markdown"
            }

            response = requests.get(
                reader_url,
                headers=headers,
                timeout=self.timeout
            )

            response.raise_for_status()

            content = response.text

            # Extract title from markdown (first # heading)
            title = url
            lines = content.split("\n")
            for line in lines:
                if line.startswith("# "):
                    title = line[2:].strip()
                    break

            return {
                "url": url,
                "title": title,
                "content": content,
                "metadata": {
                    "format": format,
                    "content_length": len(content),
                    "service": "jina_reader"
                }
            }

        except Exception as e:
            return {
                "url": url,
                "title": None,
                "content": None,
                "metadata": {"error": str(e)}
            }


    async def read_url_with_images(
        self,
        url: str
    ) -> dict:
        """
        Read URL and extract image information.

        WHY: Get both text and image data
        HOW: Use Jina Reader with image extraction

        ARGS:
            url: URL to read

        RETURNS:
            {
                "url": "https://example.com",
                "title": "Page Title",
                "content": "Content with image references...",
                "images": [
                    {
                        "url": "https://example.com/image.jpg",
                        "alt": "Image description"
                    }
                ]
            }
        """

        try:
            # Jina Reader with image extraction
            reader_url = f"{self.reader_url}/{url}"

            headers = {
                "X-Return-Format": "markdown",
                "X-With-Images": "true"
            }

            response = requests.get(
                reader_url,
                headers=headers,
                timeout=self.timeout
            )

            response.raise_for_status()

            content = response.text

            # Parse images from markdown
            images = self._extract_images_from_markdown(content)

            # Extract title
            title = url
            lines = content.split("\n")
            for line in lines:
                if line.startswith("# "):
                    title = line[2:].strip()
                    break

            return {
                "url": url,
                "title": title,
                "content": content,
                "images": images,
                "metadata": {
                    "image_count": len(images)
                }
            }

        except Exception as e:
            return {
                "url": url,
                "title": None,
                "content": None,
                "images": [],
                "metadata": {"error": str(e)}
            }


    def _extract_images_from_markdown(self, markdown: str) -> list:
        """
        Extract image references from markdown.

        WHY: Parse image data from content
        HOW: Find markdown image syntax ![alt](url)
        """

        import re

        images = []

        # Find markdown images: ![alt](url)
        pattern = r'!\[(.*?)\]\((.*?)\)'
        matches = re.findall(pattern, markdown)

        for alt, url in matches:
            images.append({
                "url": url,
                "alt": alt
            })

        return images


    async def batch_read_urls(
        self,
        urls: list[str]
    ) -> list[dict]:
        """
        Read multiple URLs in batch.

        WHY: Process multiple URLs efficiently
        HOW: Sequential processing with error handling

        ARGS:
            urls: List of URLs to read

        RETURNS:
            List of read results
        """

        results = []

        for url in urls:
            result = await self.read_url(url)
            results.append(result)

        return results


# Global instance
jina_adapter = JinaAdapter()
