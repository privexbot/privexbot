"""
Crawl4AI Adapter - Website crawling and scraping integration.

WHY:
- Extract content from websites for knowledge bases
- Support dynamic websites (JavaScript rendering)
- Handle pagination and multi-page crawling
- Extract structured data

HOW:
- Use Crawl4AI library for web scraping
- Support various extraction strategies
- Clean and normalize HTML content
- Handle rate limiting and retries

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Optional, List
import requests
from bs4 import BeautifulSoup


class Crawl4AIAdapter:
    """
    Crawl4AI integration for website scraping.

    WHY: Advanced web scraping for KB content
    HOW: Use Crawl4AI library with fallback to requests
    """

    def __init__(self):
        """
        Initialize Crawl4AI adapter.

        WHY: Setup crawler configuration
        HOW: Configure user agent and defaults
        """
        self.user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        self.timeout = 30


    async def crawl_url(
        self,
        url: str,
        max_depth: int = 1,
        max_pages: int = 10,
        extract_strategy: str = "text"
    ) -> dict:
        """
        Crawl website and extract content.

        WHY: Extract content from single or multiple pages
        HOW: Fetch, parse, extract based on strategy

        ARGS:
            url: Starting URL to crawl
            max_depth: How many levels deep to crawl (1 = single page)
            max_pages: Maximum pages to crawl
            extract_strategy: "text" | "markdown" | "html"

        RETURNS:
            {
                "url": "https://example.com",
                "title": "Page Title",
                "content": "Extracted text content...",
                "links": ["url1", "url2"],
                "metadata": {
                    "crawled_pages": 5,
                    "depth": 1,
                    "timestamp": "2025-01-15T10:30:00Z"
                }
            }
        """

        try:
            # Fetch page
            response = requests.get(
                url,
                headers={"User-Agent": self.user_agent},
                timeout=self.timeout
            )
            response.raise_for_status()

            # Parse HTML
            soup = BeautifulSoup(response.text, "html.parser")

            # Extract title
            title = soup.find("title")
            title_text = title.get_text().strip() if title else url

            # Remove unwanted elements
            for element in soup(["script", "style", "nav", "header", "footer", "aside"]):
                element.decompose()

            # Extract content based on strategy
            if extract_strategy == "text":
                content = self._extract_text(soup)
            elif extract_strategy == "markdown":
                content = self._extract_markdown(soup)
            else:  # html
                content = str(soup)

            # Extract links for crawling
            links = self._extract_links(soup, url)

            return {
                "url": url,
                "title": title_text,
                "content": content,
                "links": links[:max_pages],  # Limit links
                "metadata": {
                    "crawled_pages": 1,
                    "depth": max_depth,
                    "content_length": len(content),
                    "links_found": len(links)
                }
            }

        except Exception as e:
            return {
                "url": url,
                "title": None,
                "content": None,
                "links": [],
                "metadata": {
                    "error": str(e)
                }
            }


    def _extract_text(self, soup: BeautifulSoup) -> str:
        """
        Extract clean text from HTML.

        WHY: Get text content without HTML tags
        HOW: Parse and clean BeautifulSoup object
        """

        # Get text
        text = soup.get_text()

        # Clean whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = "\n".join(chunk for chunk in chunks if chunk)

        return text


    def _extract_markdown(self, soup: BeautifulSoup) -> str:
        """
        Extract content as markdown.

        WHY: Preserve formatting for better readability
        HOW: Convert HTML to markdown
        """

        # Simplified markdown conversion
        # Production would use html2text library

        text = ""

        # Headers
        for i in range(1, 7):
            for header in soup.find_all(f"h{i}"):
                text += f"{'#' * i} {header.get_text().strip()}\n\n"

        # Paragraphs
        for p in soup.find_all("p"):
            text += f"{p.get_text().strip()}\n\n"

        # Lists
        for ul in soup.find_all("ul"):
            for li in ul.find_all("li"):
                text += f"- {li.get_text().strip()}\n"
            text += "\n"

        return text.strip()


    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """
        Extract all links from page.

        WHY: Enable multi-page crawling
        HOW: Find all <a> tags, normalize URLs
        """

        from urllib.parse import urljoin, urlparse

        links = []
        base_domain = urlparse(base_url).netloc

        for a in soup.find_all("a", href=True):
            href = a["href"]

            # Convert relative to absolute URL
            absolute_url = urljoin(base_url, href)

            # Only include links from same domain
            if urlparse(absolute_url).netloc == base_domain:
                links.append(absolute_url)

        # Remove duplicates
        return list(set(links))


    async def crawl_multiple_pages(
        self,
        start_url: str,
        max_pages: int = 10
    ) -> List[dict]:
        """
        Crawl multiple pages from website.

        WHY: Build comprehensive KB from website
        HOW: Breadth-first crawling with queue

        ARGS:
            start_url: Starting URL
            max_pages: Maximum pages to crawl

        RETURNS:
            List of crawled page results
        """

        crawled = []
        to_crawl = [start_url]
        visited = set()

        while to_crawl and len(crawled) < max_pages:
            url = to_crawl.pop(0)

            if url in visited:
                continue

            visited.add(url)

            # Crawl page
            result = await self.crawl_url(url, max_depth=1)

            if result.get("content"):
                crawled.append(result)

                # Add new links to queue
                for link in result.get("links", [])[:5]:  # Limit links per page
                    if link not in visited and link not in to_crawl:
                        to_crawl.append(link)

        return crawled


    def extract_sitemap(self, sitemap_url: str) -> List[str]:
        """
        Extract URLs from sitemap.xml.

        WHY: Efficient way to discover all pages
        HOW: Parse XML sitemap

        ARGS:
            sitemap_url: URL to sitemap.xml

        RETURNS:
            List of URLs found in sitemap
        """

        try:
            response = requests.get(sitemap_url, timeout=self.timeout)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, "xml")

            # Extract all <loc> tags
            urls = [loc.get_text().strip() for loc in soup.find_all("loc")]

            return urls

        except Exception as e:
            print(f"Failed to parse sitemap: {e}")
            return []


# Global instance
crawl4ai_adapter = Crawl4AIAdapter()
