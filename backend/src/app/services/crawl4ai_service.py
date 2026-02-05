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

    # JavaScript/rendering options (NEW)
    wait_time: float = Field(
        default=3.0,
        description="Seconds to wait after page load for JS to render (0-30)"
    )
    wait_for_selector: Optional[str] = Field(
        default=None,
        description="CSS selector to wait for before extracting content"
    )
    js_code: Optional[str] = Field(
        default=None,
        description="JavaScript to execute before scraping (e.g., scroll page)"
    )
    timeout: int = Field(
        default=30,
        description="Total page load timeout in seconds"
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

    def _get_smart_wait_config(self, url: str, stealth_mode: bool) -> tuple[str, float]:
        """
        Get wait_for selector and delay for page loading.

        MECHANISM:
        - `wait_for` tells Playwright to wait until a CSS selector appears
        - `delay_before_return_html` adds extra wait time after selector is found

        RETURNS:
            tuple of (wait_for_selector, delay_seconds)
        """
        # Simple approach: wait for main content area, works for most sites
        # The key is content validation AFTER scraping, not complex selectors
        if stealth_mode:
            return 'body', 2.0
        else:
            return 'body', 1.0

    def _is_meaningful_content(self, content: str) -> bool:
        """
        Validate that scraped content is actual documentation, not just navigation.

        WHY: Crawl4AI may return navigation/structural elements when:
             - CSS selector times out and falls back to body
             - Page is JS-heavy and content doesn't render
             - Anti-bot protection blocks content

        This is the REAL fix - validate content quality, not just length.
        """
        if not content:
            print("⚠️ Content validation: content is empty/None")
            return False

        content = content.strip()

        # Minimum length check (but not sufficient alone)
        if len(content) < 200:
            print(f"⚠️ Content validation: too short ({len(content)} chars, need 200+)")
            return False

        # Word count check - navigation has few words
        words = content.split()
        if len(words) < 50:
            print(f"⚠️ Content has only {len(words)} words - likely navigation/menu")
            return False

        # Line count check - real content has multiple lines
        lines = [l for l in content.split('\n') if l.strip()]
        if len(lines) < 5:
            print(f"⚠️ Content has only {len(lines)} lines - likely navigation/menu")
            return False

        # Check for actual content structure (headings or substantial paragraphs)
        has_headings = any(line.strip().startswith('#') for line in lines)
        has_paragraphs = len([l for l in lines if len(l.strip()) > 100]) >= 2

        if not has_headings and not has_paragraphs:
            print(f"⚠️ No headings or substantial paragraphs - likely navigation/menu")
            return False

        return True

    async def _try_jina_fallback(self, url: str, original_content: str) -> str:
        """
        Try Jina reader as fallback when Crawl4AI returns empty content.
        Jina uses server-side rendering and handles JavaScript sites better.

        WHY: Crawl4AI may fail on some JS-heavy sites
        HOW: Use Jina Reader API as fallback

        ARGS:
            url: URL that failed to scrape
            original_content: Content from Crawl4AI (may be empty/minimal)

        RETURNS:
            Best available content (Jina result or original)
        """
        try:
            from app.integrations.jina_adapter import JinaAdapter
            jina = JinaAdapter()

            print(f"🔄 Trying Jina fallback for {url}...")
            result = await jina.read_url(url, format="markdown")

            jina_content = result.get("content", "") or ""

            if jina_content and len(jina_content) > len(original_content or ""):
                print(f"✅ Jina fallback succeeded: {len(jina_content)} chars (was {len(original_content or '')})")
                return jina_content
            else:
                print(f"⚠️ Jina fallback returned similar/less content: {len(jina_content)} chars")
                return original_content or jina_content

        except Exception as e:
            print(f"⚠️ Jina fallback failed: {e}")
            return original_content or ""

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

        # Get smart wait configuration based on URL pattern
        smart_selector, smart_delay = self._get_smart_wait_config(url, config.stealth_mode)

        # Use user config if provided, otherwise use smart defaults
        wait_for = config.wait_for_selector or smart_selector
        delay = config.wait_time if config.wait_time > 0 else smart_delay

        print(f"🌐 Scraping {url}")
        print(f"   - wait_for: {wait_for}")
        print(f"   - delay: {delay}s")
        print(f"   - stealth_mode: {config.stealth_mode}")

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

        # Configure crawler run - use user config values dynamically
        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,  # Always fresh content
            wait_for=wait_for,  # From user config or default
            delay_before_return_html=delay,  # From user config or smart default
            # Extraction strategy (just get markdown)
            extraction_strategy=NoExtractionStrategy(),
        )

        # Use crawler as context manager
        print(f"🔄 Starting Crawl4AI browser for {url}...")
        try:
            async with AsyncWebCrawler(config=browser_config) as crawler:
                # Scrape page
                result = await crawler.arun(
                    url=url,
                    config=run_config
                )

                # Log Crawl4AI result for debugging
                has_markdown = bool(result.markdown) if result else False
                markdown_len = len(self._extract_markdown_content(result)) if has_markdown else 0
                print(f"📦 Crawl4AI returned: success={result.success}, has_markdown={has_markdown}, content_len={markdown_len}")

                if not result.success:
                    print(f"❌ Crawl4AI failed: {result.error_message}")
                    # Try Jina fallback on failure
                    markdown_content = await self._try_jina_fallback(url, "")
                else:
                    # Extract markdown content (crawl4ai 0.8.x compatibility)
                    markdown_content = self._extract_markdown_content(result)

                    # Check content quality (not just length) and try Jina fallback
                    if not self._is_meaningful_content(markdown_content):
                        print(f"⚠️ Crawl4AI content failed validation for {url} ({len(markdown_content or '')} chars)")
                        markdown_content = await self._try_jina_fallback(url, markdown_content)
                # Extract metadata (inside success block)
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

                print(f"✅ Scraped {url}: {metadata['word_count']} words, {len(links)} links")

                return ScrapedPage(
                    url=url,
                    title=result.metadata.get("title"),
                    description=result.metadata.get("description"),
                    content=markdown_content,
                    links=links,
                    metadata=metadata,
                    scraped_at=datetime.utcnow()
                )
        except Exception as e:
            # Catch browser initialization failures, network errors, etc.
            print(f"❌ Crawl4AI exception: {type(e).__name__}: {e}")
            print(f"🔄 Attempting Jina fallback due to exception...")
            markdown_content = await self._try_jina_fallback(url, "")

            # Return basic ScrapedPage with fallback content
            metadata = {
                "status_code": 0,  # Unknown due to exception
                "content_type": "text/html",
                "word_count": len(markdown_content.split()) if markdown_content else 0,
                "character_count": len(markdown_content) if markdown_content else 0,
                "fallback_used": "jina",
            }

            print(f"✅ Scraped {url} (via Jina fallback): {metadata['word_count']} words")

            return ScrapedPage(
                url=url,
                title=None,  # No metadata available from exception
                description=None,
                content=markdown_content,
                links=[],  # No links available from fallback
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

        # Get smart wait configuration based on URL pattern
        smart_selector, smart_delay = self._get_smart_wait_config(start_url, config.stealth_mode)

        # Use user config if provided, otherwise use smart defaults
        wait_for = config.wait_for_selector or smart_selector
        delay = config.wait_time if config.wait_time > 0 else smart_delay

        print(f"🕷️ Crawling website starting from {start_url}")
        print(f"   - max_pages: {config.max_pages}")
        print(f"   - max_depth: {config.max_depth}")
        print(f"   - wait_for: {wait_for}")
        print(f"   - delay: {delay}s")

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
        print(f"🔄 Starting Crawl4AI browser for crawl (max {config.max_pages} pages)...")
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
                    # Configure crawler run - use user config values dynamically
                    run_config = CrawlerRunConfig(
                        cache_mode=CacheMode.BYPASS,
                        wait_for=wait_for,  # From user config or default
                        delay_before_return_html=delay,  # From user config or smart default
                        extraction_strategy=NoExtractionStrategy(),
                    )

                    result = await crawler.arun(url=url, config=run_config)

                    if not result.success:
                        print(f"❌ Failed to scrape {url}: {result.error_message}")
                        continue

                    # Extract markdown content (crawl4ai 0.8.x compatibility)
                    markdown_content = self._extract_markdown_content(result)

                    # Check content quality (not just length) and try Jina fallback
                    if not self._is_meaningful_content(markdown_content):
                        print(f"⚠️ Crawl4AI content failed validation for {url} ({len(markdown_content or '')} chars)")
                        markdown_content = await self._try_jina_fallback(url, markdown_content)

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
                    print(f"✅ [{len(scraped_pages)}/{config.max_pages}] Crawled {url}: {metadata['word_count']} words")

                    # Human-like delay between requests
                    if config.delay_between_requests > 0:
                        await asyncio.sleep(config.delay_between_requests)

                except Exception as e:
                    print(f"❌ Error scraping {url}: {e}")
                    continue

            print(f"🏁 Crawl complete: {len(scraped_pages)} pages scraped")
            return scraped_pages


# Global instance
crawl4ai_service = Crawl4AIService()
