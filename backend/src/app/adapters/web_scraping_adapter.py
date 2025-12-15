"""
Web scraping adapter for advanced web content extraction.

WHY: Support multiple web extraction methods (scrape, crawl, map, search, extract)
HOW: Integrates with Crawl4AI, Firecrawl, and custom scraping
BUILDS ON: Existing document_processing_service.py URL processing

PSEUDOCODE:
-----------
from typing import Dict, List, Optional
import asyncio
import aiohttp
from bs4 import BeautifulSoup

class WebScrapingAdapter(SourceAdapter):
    \"\"\"
    Advanced web scraping with multiple extraction methods.

    FEATURES:
    - Scrape: Single URL content extraction
    - Crawl: Multi-page crawling with depth control
    - Map: Site mapping and URL discovery
    - Search: Web search with content extraction
    - Extract: Structured data extraction with AI
    \"\"\"

    def __init__(self):
        self.crawl4ai_available = self._check_crawl4ai()
        self.firecrawl_available = self._check_firecrawl()

    async def extract_content(self, source_config: Dict) -> DocumentContent:
        \"\"\"
        Extract content based on scraping method.

        source_config = {
            \"method\": \"scrape\" | \"crawl\" | \"map\" | \"search\" | \"extract\",
            \"url\": \"https://example.com\",
            \"options\": {
                # Method-specific options
            }
        }
        \"\"\"

        method = source_config.get(\"method\", \"scrape\")

        if method == \"scrape\":
            return await self._scrape_single_url(source_config)
        elif method == \"crawl\":
            return await self._crawl_website(source_config)
        elif method == \"map\":
            return await self._map_website(source_config)
        elif method == \"search\":
            return await self._search_and_extract(source_config)
        elif method == \"extract\":
            return await self._extract_structured_data(source_config)
        else:
            raise ValueError(f\"Unsupported web scraping method: {method}\")

    async def _scrape_single_url(self, config: Dict) -> DocumentContent:
        \"\"\"
        Scrape single URL and return clean content.

        config[\"options\"] = {
            \"format\": \"markdown\" | \"text\" | \"html\",
            \"include_images\": false,
            \"include_links\": true,
            \"clean_html\": true
        }

        PROCESS:
        1. Try Crawl4AI first (fastest, best quality)
        2. Fallback to Firecrawl
        3. Fallback to custom scraping with BeautifulSoup + requests
        \"\"\"

        url = config[\"url\"]
        options = config.get(\"options\", {})

        # Try Crawl4AI first (fastest, best quality)
        if self.crawl4ai_available:
            return await self._crawl4ai_scrape(url, options)

        # Fallback to Firecrawl
        elif self.firecrawl_available:
            return await self._firecrawl_scrape(url, options)

        # Fallback to custom scraping
        else:
            return await self._custom_scrape(url, options)

    async def _crawl_website(self, config: Dict) -> DocumentContent:
        \"\"\"
        Crawl multiple pages from a website.

        config[\"options\"] = {
            \"max_pages\": 10,
            \"max_depth\": 2,
            \"include_patterns\": [\"*/docs/*\", \"*/guide/*\"],
            \"exclude_patterns\": [\"*/api/*\", \"*/admin/*\"],
            \"delay\": 1.0,  # Seconds between requests
            \"combine_pages\": true  # Combine into single document or create multiple
        }

        PROCESS:
        1. Discover URLs to crawl using _discover_urls()
        2. Limit to max_pages
        3. Scrape each URL with delay
        4. Combine or return multiple documents based on config
        \"\"\"

        base_url = config[\"url\"]
        options = config.get(\"options\", {})
        max_pages = options.get(\"max_pages\", 10)
        max_depth = options.get(\"max_depth\", 2)
        combine_pages = options.get(\"combine_pages\", True)

        # Discover URLs to crawl
        urls_to_crawl = await self._discover_urls(base_url, max_depth, options)
        urls_to_crawl = urls_to_crawl[:max_pages]  # Limit to max_pages

        # Scrape each URL
        scraped_pages = []
        for url in urls_to_crawl:
            try:
                page_content = await self._scrape_single_url({
                    \"url\": url,
                    \"options\": options
                })
                scraped_pages.append({
                    \"url\": url,
                    \"content\": page_content
                })

                # Respect delay
                if options.get(\"delay\", 0) > 0:
                    await asyncio.sleep(options[\"delay\"])

            except Exception as e:
                # Log error but continue crawling
                continue

        # Combine or structure results based on config
        if combine_pages:
            return self._combine_scraped_pages(scraped_pages)
        else:
            return self._structure_multiple_pages(scraped_pages)

    async def _map_website(self, config: Dict) -> DocumentContent:
        \"\"\"
        Map website structure and return URL list.

        config[\"options\"] = {
            \"max_depth\": 3,
            \"include_patterns\": [\"*/docs/*\"],
            \"exclude_patterns\": [\"*/api/*\"],
            \"return_metadata\": true  # Include page titles, descriptions
        }

        PROCESS:
        1. Discover all URLs using breadth-first crawling
        2. Optionally extract metadata (title, description) for each URL
        3. Return structured sitemap as document content
        \"\"\"

        base_url = config[\"url\"]
        options = config.get(\"options\", {})
        max_depth = options.get(\"max_depth\", 3)

        # Discover all URLs
        discovered_urls = await self._discover_urls(base_url, max_depth, options)

        # Optionally get metadata for each URL
        url_metadata = {}
        if options.get(\"return_metadata\", False):
            url_metadata = await self._extract_url_metadata(discovered_urls[:50])

        # Create sitemap document
        sitemap_content = self._generate_sitemap_content(
            base_url, discovered_urls, url_metadata
        )

        return sitemap_content

    async def _search_and_extract(self, config: Dict) -> DocumentContent:
        \"\"\"
        Search web and extract content from results.

        config[\"options\"] = {
            \"query\": \"Python FastAPI documentation\",
            \"max_results\": 5,
            \"search_engine\": \"google\" | \"bing\" | \"duckduckgo\",
            \"extract_content\": true  # Extract full content from each result
        }

        PROCESS:
        1. Perform web search using specified engine
        2. Extract content from top results
        3. Combine into single document with source attribution
        \"\"\"

        query = config[\"options\"][\"query\"]
        max_results = config[\"options\"].get(\"max_results\", 5)
        search_engine = config[\"options\"].get(\"search_engine\", \"duckduckgo\")

        # Perform search (would integrate with search APIs)
        search_results = await self._perform_web_search(query, search_engine, max_results)

        # Extract content from each result
        extracted_content = \"\"
        for result in search_results:
            try:
                page_content = await self._scrape_single_url({
                    \"url\": result[\"url\"],
                    \"options\": {\"format\": \"markdown\"}
                })
                extracted_content += f\"\\n\\n# {result['title']}\\nSource: {result['url']}\\n\\n\"
                extracted_content += page_content.text
            except Exception:
                continue

        return DocumentContent(
            text=extracted_content,
            metadata={
                \"search_query\": query,
                \"search_results\": search_results,
                \"extracted_urls\": [r[\"url\"] for r in search_results]
            },
            preview=extracted_content[:500],
            word_count=len(extracted_content.split()),
            character_count=len(extracted_content)
        )

    async def _extract_structured_data(self, config: Dict) -> DocumentContent:
        \"\"\"
        Extract structured data using AI.

        config[\"options\"] = {
            \"schema\": {
                \"type\": \"product_data\",
                \"fields\": [\"name\", \"price\", \"description\", \"features\"]
            },
            \"format\": \"json\" | \"markdown\" | \"csv\"
        }

        PROCESS:
        1. Scrape page content
        2. Use AI service to extract structured data based on schema
        3. Format according to specified output format
        \"\"\"

        url = config[\"url\"]
        schema = config[\"options\"].get(\"schema\", {})

        # Scrape page first
        page_content = await self._scrape_single_url({
            \"url\": url,
            \"options\": {\"format\": \"text\"}
        })

        # Use AI to extract structured data
        # This would integrate with existing inference_service.py
        extracted_data = await self._ai_extract_structured_data(
            page_content.text, schema
        )

        return self._format_structured_data(extracted_data, url, schema)

    # Helper methods
    async def _discover_urls(self, base_url: str, max_depth: int, options: Dict) -> List[str]:
        \"\"\"
        Discover URLs on website up to max_depth using breadth-first search.

        PROCESS:
        1. Start with base_url at depth 0
        2. For each URL, extract all links
        3. Filter links based on include/exclude patterns
        4. Continue until max_depth reached
        5. Return deduplicated list of URLs
        \"\"\"

        discovered = set()
        to_crawl = [(base_url, 0)]  # (url, depth)

        include_patterns = options.get(\"include_patterns\", [])
        exclude_patterns = options.get(\"exclude_patterns\", [])

        while to_crawl and len(discovered) < 1000:  # Safety limit
            url, depth = to_crawl.pop(0)

            if depth >= max_depth or url in discovered:
                continue

            # Check patterns
            if include_patterns and not any(pattern in url for pattern in include_patterns):
                continue
            if exclude_patterns and any(pattern in url for pattern in exclude_patterns):
                continue

            discovered.add(url)

            # Find links on this page if not at max depth
            if depth < max_depth - 1:
                try:
                    links = await self._extract_page_links(url, base_url)
                    for link in links:
                        to_crawl.append((link, depth + 1))
                except Exception:
                    continue

        return list(discovered)

    async def _crawl4ai_scrape(self, url: str, options: Dict) -> DocumentContent:
        \"\"\"Use Crawl4AI for high-quality content extraction\"\"\"
        # Integration with Crawl4AI library
        pass

    async def _firecrawl_scrape(self, url: str, options: Dict) -> DocumentContent:
        \"\"\"Use Firecrawl managed service for content extraction\"\"\"
        # Integration with Firecrawl API
        pass

    async def _custom_scrape(self, url: str, options: Dict) -> DocumentContent:
        \"\"\"Fallback custom scraping with requests + BeautifulSoup\"\"\"
        # Custom implementation using aiohttp + BeautifulSoup
        pass

    def get_source_metadata(self, source_config: Dict) -> Dict:
        \"\"\"Get web scraping source metadata\"\"\"
        return {
            \"source_type\": \"web_scraping\",
            \"method\": source_config.get(\"method\", \"scrape\"),
            \"url\": source_config.get(\"url\"),
            \"scraping_engine\": self._get_preferred_engine(),
            \"capabilities\": {
                \"can_crawl\": True,
                \"can_map\": True,
                \"can_search\": True,
                \"can_extract_structured\": True
            }
        }

    def can_update(self) -> bool:
        \"\"\"Web sources can be re-scraped\"\"\"
        return True

    def validate_config(self, source_config: Dict) -> bool:
        \"\"\"Validate web scraping configuration\"\"\"
        if \"url\" not in source_config:
            return False

        method = source_config.get(\"method\", \"scrape\")
        if method not in [\"scrape\", \"crawl\", \"map\", \"search\", \"extract\"]:
            return False

        return True

    def _check_crawl4ai(self) -> bool:
        \"\"\"Check if Crawl4AI is available\"\"\"
        try:
            import crawl4ai
            return True
        except ImportError:
            return False

    def _check_firecrawl(self) -> bool:
        \"\"\"Check if Firecrawl is available\"\"\"
        import os
        return bool(os.getenv(\"FIRECRAWL_API_KEY\"))

    def _get_preferred_engine(self) -> str:
        \"\"\"Get preferred scraping engine\"\"\"
        if self.crawl4ai_available:
            return \"crawl4ai\"
        elif self.firecrawl_available:
            return \"firecrawl\"
        else:
            return \"custom\"
"""