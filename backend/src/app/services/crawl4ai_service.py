"""
Crawl4AI Service - Web scraping with anti-bot detection and JavaScript support.

WHY:
- Privacy-focused web scraping (no external APIs like Firecrawl)
- Anti-bot detection with stealth mode
- JavaScript rendering for dynamic content
- Markdown output for easy parsing

HOW:
- Uses Crawl4AI library with Playwright
- Stealth configuration to avoid detection
- Human-like delays between requests
- Extracts clean markdown content

KEY FEATURES:
- Single URL scraping
- Website crawling with depth limits
- Configurable include/exclude patterns
- Automatic link discovery
- Metadata extraction (title, description, links)
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, HttpUrl
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.extraction_strategy import NoExtractionStrategy
import asyncio
from datetime import datetime
from urllib.parse import urljoin, urlparse
import re


class CrawlConfig(BaseModel):
    """Configuration for web scraping/crawling"""

    # Scraping method
    method: str = Field(
        default="single",
        description="Scraping method: 'single' or 'crawl'"
    )

    # Crawling limits
    max_pages: int = Field(
        default=50,
        description="Maximum pages to crawl (for 'crawl' method)"
    )
    max_depth: int = Field(
        default=3,
        description="Maximum crawl depth (for 'crawl' method)"
    )

    # URL filtering
    include_patterns: List[str] = Field(
        default_factory=list,
        description="URL patterns to include (e.g., ['/docs/**', '/guides/**'])"
    )
    exclude_patterns: List[str] = Field(
        default_factory=list,
        description="URL patterns to exclude (e.g., ['/admin/**', '*.pdf'])"
    )

    # Anti-bot settings
    stealth_mode: bool = Field(
        default=True,
        description="Enable stealth mode to avoid detection"
    )
    delay_between_requests: float = Field(
        default=1.5,
        description="Delay between requests in seconds"
    )

    # Content extraction
    extract_links: bool = Field(
        default=True,
        description="Extract all links from page"
    )
    preserve_code_blocks: bool = Field(
        default=True,
        description="Preserve code blocks in markdown"
    )


class ScrapedPage(BaseModel):
    """Scraped page data"""

    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    content: str  # Markdown content
    links: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    scraped_at: datetime = Field(default_factory=datetime.utcnow)


class Crawl4AIService:
    """
    Self-hosted web scraping service using Crawl4AI.

    PRIVACY: All scraping happens locally, no external APIs.
    PERFORMANCE: ~2-3 seconds per page with stealth mode.

    Architecture:
    - Uses Playwright for JavaScript rendering
    - Stealth mode to avoid bot detection
    - Markdown extraction for easy parsing
    - Configurable crawling depth and patterns
    """

    def __init__(self):
        self.crawler: Optional[AsyncWebCrawler] = None

    def _extract_markdown_content(self, result) -> str:
        """
        Extract markdown content from crawl result.

        Handles API changes in crawl4ai:
        - v0.2.x: result.markdown is a string
        - v0.8.x: result.markdown is a MarkdownGenerationResult object
                  with raw_markdown, markdown_with_citations, etc.
        """
        if not result.markdown:
            return ""

        if hasattr(result.markdown, 'raw_markdown'):
            # crawl4ai 0.8.x: MarkdownGenerationResult object
            return result.markdown.raw_markdown or ""
        elif isinstance(result.markdown, str):
            # Fallback for older API (backward compatibility)
            return result.markdown
        else:
            # Unknown type, try string conversion
            return str(result.markdown) if result.markdown else ""

    async def _initialize_crawler(self, config: CrawlConfig):
        """Initialize crawler with anti-bot configuration"""

        # Browser configuration for stealth
        browser_config = BrowserConfig(
            headless=True,
            viewport_width=1920,
            viewport_height=1080,
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            # Anti-detection flags and SSL handling
            extra_args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--ignore-certificate-errors",
                "--ignore-ssl-errors",
                "--ignore-certificate-errors-spki-list",
                "--disable-web-security",
            ] if config.stealth_mode else [
                "--ignore-certificate-errors",
                "--ignore-ssl-errors",
            ]
        )

        # Create crawler
        self.crawler = AsyncWebCrawler(browser_config)
        await self.crawler.start()

    async def _cleanup_crawler(self):
        """Cleanup crawler resources"""
        if self.crawler:
            await self.crawler.close()
            self.crawler = None

    def _should_crawl_url(self, url: str, config: CrawlConfig, base_url: str) -> bool:
        """Check if URL should be crawled based on patterns"""

        # Must be same domain
        if urlparse(url).netloc != urlparse(base_url).netloc:
            return False

        path = urlparse(url).path

        # Check exclude patterns
        for pattern in config.exclude_patterns:
            if self._match_pattern(path, pattern):
                return False

        # Check include patterns (if any specified)
        if config.include_patterns:
            for pattern in config.include_patterns:
                if self._match_pattern(path, pattern):
                    return True
            return False  # No include pattern matched

        return True  # No patterns specified, crawl everything

    def _match_pattern(self, path: str, pattern: str) -> bool:
        """
        Match URL path against pattern.

        Patterns:
        - /docs/** - Match /docs and all subdirectories
        - *.pdf - Match all PDF files
        - /admin/* - Match /admin/x but not /admin/x/y
        """
        # Convert glob pattern to regex
        regex_pattern = pattern.replace("**", ".*").replace("*", "[^/]*")
        regex_pattern = "^" + regex_pattern + "$"
        return bool(re.match(regex_pattern, path))

    async def scrape_single_url(
        self,
        url: str,
        config: Optional[CrawlConfig] = None
    ) -> ScrapedPage:
        """
        Scrape a single URL.

        Args:
            url: URL to scrape
            config: Scraping configuration

        Returns:
            ScrapedPage with content and metadata

        Raises:
            Exception: If scraping fails
        """

        config = config or CrawlConfig(method="single")

        # Browser configuration for stealth
        browser_config = BrowserConfig(
            headless=True,
            viewport_width=1920,
            viewport_height=1080,
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            # Anti-detection flags and SSL handling
            extra_args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--ignore-certificate-errors",
                "--ignore-ssl-errors",
                "--ignore-certificate-errors-spki-list",
                "--disable-web-security",
            ] if config.stealth_mode else [
                "--ignore-certificate-errors",
                "--ignore-ssl-errors",
            ]
        )

        # Configure crawler run
        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,  # Always fresh content
            wait_for="body",  # Wait for body to load
            delay_before_return_html=2.0 if config.stealth_mode else 0.5,
            # Extraction strategy (just get markdown)
            extraction_strategy=NoExtractionStrategy(),
        )

        # Use crawler as context manager
        async with AsyncWebCrawler(config=browser_config) as crawler:
            # Scrape page
            result = await crawler.arun(
                url=url,
                config=run_config
            )

            if not result.success:
                raise Exception(f"Failed to scrape {url}: {result.error_message}")

            # Extract markdown content (crawl4ai 0.8.x compatibility)
            markdown_content = self._extract_markdown_content(result)

            # Extract metadata
            metadata = {
                "status_code": result.status_code,
                "content_type": "text/html",  # Default for web scraping
                "word_count": len(markdown_content.split()) if markdown_content else 0,
                "character_count": len(markdown_content) if markdown_content else 0,
            }

            # Extract links if requested
            links = []
            if config.extract_links and result.links:
                internal_links = result.links.get("internal", [])
                # Extract href from link objects (can be dict or string)
                links = [
                    link.get("href") if isinstance(link, dict) else link
                    for link in internal_links
                    if link
                ]
                # Filter out None values
                links = [link for link in links if link]

            return ScrapedPage(
                url=url,
                title=result.metadata.get("title"),
                description=result.metadata.get("description"),
                content=markdown_content,
                links=links,
                metadata=metadata,
                scraped_at=datetime.utcnow()
            )

    async def crawl_website(
        self,
        start_url: str,
        config: Optional[CrawlConfig] = None
    ) -> List[ScrapedPage]:
        """
        Crawl a website starting from URL.

        Args:
            start_url: Starting URL
            config: Crawling configuration

        Returns:
            List of ScrapedPage objects

        Raises:
            Exception: If crawling fails completely
        """

        config = config or CrawlConfig(method="crawl")

        # Browser configuration for stealth
        browser_config = BrowserConfig(
            headless=True,
            viewport_width=1920,
            viewport_height=1080,
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            # Anti-detection flags and SSL handling
            extra_args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--ignore-certificate-errors",
                "--ignore-ssl-errors",
                "--ignore-certificate-errors-spki-list",
                "--disable-web-security",
            ] if config.stealth_mode else [
                "--ignore-certificate-errors",
                "--ignore-ssl-errors",
            ]
        )

        # Use crawler as context manager (same pattern as scrape_single_url)
        async with AsyncWebCrawler(config=browser_config) as crawler:
            # Track crawled and pending URLs
            crawled_urls = set()
            pending_urls = [(start_url, 0)]  # (url, depth)
            scraped_pages = []

            while pending_urls and len(scraped_pages) < config.max_pages:
                url, depth = pending_urls.pop(0)

                # Skip if already crawled or too deep
                if url in crawled_urls or depth > config.max_depth:
                    continue

                try:
                    # Scrape page
                    run_config = CrawlerRunConfig(
                        cache_mode=CacheMode.BYPASS,
                        wait_for="body",
                        delay_before_return_html=2.0 if config.stealth_mode else 0.5,
                        extraction_strategy=NoExtractionStrategy(),
                    )

                    result = await crawler.arun(url=url, config=run_config)

                    if not result.success:
                        print(f"Failed to scrape {url}: {result.error_message}")
                        continue

                    # Extract markdown content (crawl4ai 0.8.x compatibility)
                    markdown_content = self._extract_markdown_content(result)

                    # Extract metadata
                    metadata = {
                        "status_code": result.status_code,
                        "depth": depth,
                        "word_count": len(markdown_content.split()) if markdown_content else 0,
                        "character_count": len(markdown_content) if markdown_content else 0,
                    }

                    # Extract links
                    links = []
                    if result.links:
                        internal_links = result.links.get("internal", [])
                        for link in internal_links:
                            if not link:
                                continue

                            # Extract href from link object (can be dict or string)
                            link_url = link.get("href") if isinstance(link, dict) else link
                            if not link_url:
                                continue

                            if self._should_crawl_url(link_url, config, start_url):
                                full_url = urljoin(url, link_url)
                                if full_url not in crawled_urls:
                                    pending_urls.append((full_url, depth + 1))
                                links.append(link_url)

                    # Add to results
                    scraped_pages.append(ScrapedPage(
                        url=url,
                        title=result.metadata.get("title"),
                        description=result.metadata.get("description"),
                        content=markdown_content,
                        links=links,
                        metadata=metadata,
                        scraped_at=datetime.utcnow()
                    ))

                    crawled_urls.add(url)

                    # Human-like delay between requests
                    if config.delay_between_requests > 0:
                        await asyncio.sleep(config.delay_between_requests)

                except Exception as e:
                    print(f"Error scraping {url}: {e}")
                    continue

            return scraped_pages


# Global instance
crawl4ai_service = Crawl4AIService()
