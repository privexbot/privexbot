"""
Firecrawl Adapter - Alternative web scraping service.

WHY:
- Alternative to Crawl4AI for web scraping
- Handle complex JavaScript-heavy sites
- Better at handling modern SPAs
- Structured data extraction

HOW:
- Use Firecrawl API for scraping
- Support various output formats
- Handle authentication and rate limiting
- Clean and normalize content

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Optional, List
import requests


class FirecrawlAdapter:
    """
    Firecrawl API integration for web scraping.

    WHY: Alternative scraping solution
    HOW: API-based scraping with JSON responses
    """

    def __init__(self):
        """
        Initialize Firecrawl adapter.

        WHY: Setup API configuration
        HOW: Load API key from settings
        """
        from app.core.config import settings

        self.api_key = getattr(settings, "FIRECRAWL_API_KEY", None)
        self.api_url = "https://api.firecrawl.dev/v1"


    async def scrape_url(
        self,
        url: str,
        format: str = "markdown",
        include_html: bool = False
    ) -> dict:
        """
        Scrape single URL using Firecrawl.

        WHY: Extract content from URL
        HOW: Call Firecrawl API

        ARGS:
            url: URL to scrape
            format: "markdown" | "html" | "text"
            include_html: Whether to include raw HTML

        RETURNS:
            {
                "url": "https://example.com",
                "title": "Page Title",
                "content": "Extracted content...",
                "metadata": {
                    "description": "...",
                    "keywords": [...],
                    "author": "..."
                }
            }
        """

        if not self.api_key:
            # Fallback to basic scraping
            return await self._fallback_scrape(url)

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "url": url,
                "format": format,
                "includeHtml": include_html
            }

            response = requests.post(
                f"{self.api_url}/scrape",
                headers=headers,
                json=payload,
                timeout=60
            )

            response.raise_for_status()
            data = response.json()

            return {
                "url": url,
                "title": data.get("title", ""),
                "content": data.get("content", ""),
                "metadata": data.get("metadata", {})
            }

        except Exception as e:
            print(f"Firecrawl API error: {e}")
            return await self._fallback_scrape(url)


    async def crawl_website(
        self,
        url: str,
        max_pages: int = 10,
        include_paths: Optional[List[str]] = None,
        exclude_paths: Optional[List[str]] = None
    ) -> List[dict]:
        """
        Crawl entire website using Firecrawl.

        WHY: Multi-page crawling
        HOW: Use Firecrawl crawl endpoint

        ARGS:
            url: Starting URL
            max_pages: Maximum pages to crawl
            include_paths: URL patterns to include
            exclude_paths: URL patterns to exclude

        RETURNS:
            List of scraped pages
        """

        if not self.api_key:
            return []

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "url": url,
                "maxPages": max_pages,
                "includePaths": include_paths or [],
                "excludePaths": exclude_paths or []
            }

            response = requests.post(
                f"{self.api_url}/crawl",
                headers=headers,
                json=payload,
                timeout=120
            )

            response.raise_for_status()
            data = response.json()

            # Process results
            results = []
            for page in data.get("pages", []):
                results.append({
                    "url": page.get("url"),
                    "title": page.get("title"),
                    "content": page.get("content"),
                    "metadata": page.get("metadata", {})
                })

            return results

        except Exception as e:
            print(f"Firecrawl crawl error: {e}")
            return []


    async def _fallback_scrape(self, url: str) -> dict:
        """
        Fallback scraping using requests + BeautifulSoup.

        WHY: Work without API key
        HOW: Basic HTML parsing
        """

        from bs4 import BeautifulSoup

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Extract title
            title = soup.find("title")
            title_text = title.get_text().strip() if title else url

            # Remove unwanted elements
            for element in soup(["script", "style", "nav", "header", "footer"]):
                element.decompose()

            # Extract text
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            text = "\n".join(line for line in lines if line)

            return {
                "url": url,
                "title": title_text,
                "content": text,
                "metadata": {}
            }

        except Exception as e:
            return {
                "url": url,
                "title": None,
                "content": None,
                "metadata": {"error": str(e)}
            }


# Global instance
firecrawl_adapter = FirecrawlAdapter()
