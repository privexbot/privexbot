"""
Preview Service - Non-blocking chunking preview for KB creation.

WHY:
- Users need to see how documents will be chunked before committing
- Different strategies produce different results
- Preview helps optimize strategy selection
- Non-blocking to avoid interfering with main pipeline

HOW:
- Fetch sample content from URL
- Apply chunking strategy
- Return preview with metadata
- Cache results for 5 minutes

OPTIMIZED FOR: gitbook, github, notion, documentation sites
"""

from typing import Dict, List, Optional
import asyncio
from datetime import datetime, timedelta

from app.services.crawl4ai_service import crawl4ai_service
from app.services.chunking_service import chunking_service
from app.services.draft_service import draft_service


class PreviewService:
    """
    Dedicated service for chunking strategy previews.

    WHY: Give users clear picture of chunking before finalizing
    HOW: Non-blocking preview with caching
    """

    def __init__(self):
        self.cache_ttl = 300  # 5 minutes cache

    async def preview_chunking_for_url(
        self,
        url: str,
        strategy: str = "by_heading",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        max_preview_chunks: int = 10
    ) -> Dict:
        """
        Generate chunking preview for a web URL.

        WHY: Users want to see how content will be chunked
        HOW: Fetch content, apply strategy, return preview

        ARGS:
            url: Web URL to preview
            strategy: Chunking strategy to apply
            chunk_size: Target chunk size
            chunk_overlap: Chunk overlap
            max_preview_chunks: Max chunks to return in preview

        RETURNS:
            {
                "url": str,
                "strategy": str,
                "config": {...},
                "preview_chunks": [...],
                "total_chunks_estimated": int,
                "document_stats": {...},
                "strategy_recommendation": str,
                "optimized_for": str
            }
        """

        # Check cache first
        cache_key = f"preview:{url}:{strategy}:{chunk_size}:{chunk_overlap}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        try:
            # Step 1: Fetch content from URL (raises exception on failure)
            scrape_result = await crawl4ai_service.scrape_single_url(url)

            # ScrapedPage object - access attributes directly
            raw_content = scrape_result.content or ""
            metadata = scrape_result.metadata or {}

            if not raw_content:
                return {
                    "error": "No content found",
                    "message": "The URL did not return any content"
                }

            # Step 2: Enhanced content processing
            try:
                from app.services.content_enhancement_service import content_enhancement_service
                from app.services.ocr_service import ocr_service
                from app.services.content_strategy_service import content_strategy_service

                # Get intelligent strategy recommendation
                recommended_preset, content_analysis, reasoning = content_strategy_service.recommend_strategy(
                    raw_content, url
                )

                # Apply content enhancement
                enhanced_content, enhancement_stats = content_enhancement_service.enhance_content(
                    raw_content,
                    url,
                    recommended_preset.content_enhancement
                )

                # Apply OCR if enabled
                if recommended_preset.ocr_config.enabled:
                    enhanced_content, ocr_results = await ocr_service.extract_text_from_images(
                        enhanced_content,
                        url,
                        recommended_preset.ocr_config
                    )
                else:
                    ocr_results = []

                content = enhanced_content

            except Exception as e:
                # If enhancement fails, use original content with warning
                print(f"Warning: Content enhancement failed: {e}")
                content = raw_content
                content_analysis = None
                enhancement_stats = None
                ocr_results = []
                reasoning = "Content enhancement unavailable"

            # Step 3: Analyze document structure (use enhanced analysis if available)
            if content_analysis:
                doc_stats = {
                    "total_characters": content_analysis.total_characters,
                    "total_lines": content.count('\n'),
                    "heading_count": content_analysis.heading_count,
                    "heading_density": content_analysis.heading_density,
                    "list_count": content_analysis.list_count,
                    "list_density": content_analysis.list_density,
                    "code_block_count": content_analysis.code_block_count,
                    "avg_paragraph_length": content_analysis.avg_paragraph_length,
                    "structure_type": content_analysis.content_type.value,
                    "structure_score": content_analysis.structure_score,
                    "complexity_score": content_analysis.complexity_score
                }
            else:
                doc_stats = self._analyze_document(content)

            # Step 4: Get strategy recommendation (use intelligent recommendation if available)
            if content_analysis:
                recommendation = reasoning
            else:
                recommendation = self._get_strategy_recommendation(url, doc_stats)

            # Step 4: Apply chunking strategy
            chunks = chunking_service.chunk_document(
                text=content,
                strategy=strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )

            # Step 5: Prepare preview (first N chunks)
            preview_chunks = chunks[:max_preview_chunks]

            # Step 6: Build enhanced preview response
            preview_data = {
                "url": url,
                "title": metadata.get("title", "Untitled"),
                "strategy": strategy,
                "config": {
                    "chunk_size": chunk_size,
                    "chunk_overlap": chunk_overlap
                },
                "preview_chunks": [
                    {
                        "index": chunk["index"],
                        "content": chunk["content"][:500] + "..." if len(chunk["content"]) > 500 else chunk["content"],
                        "full_length": len(chunk["content"]),
                        "token_count": chunk["token_count"],
                        "preview": True
                    }
                    for chunk in preview_chunks
                ],
                "total_chunks_estimated": len(chunks),
                "document_stats": doc_stats,
                "strategy_recommendation": recommendation,
                "optimized_for": self._detect_site_type(url),
                "metadata": {
                    "generated_at": datetime.utcnow().isoformat(),
                    "content_length": len(content),
                    "showing_chunks": f"{len(preview_chunks)} of {len(chunks)}"
                }
            }

            # Add content enhancement information if available
            if 'enhancement_stats' in locals() and enhancement_stats:
                preview_data["content_enhancement"] = {
                    "applied": True,
                    "original_length": enhancement_stats.original_length,
                    "enhanced_length": enhancement_stats.cleaned_length,
                    "emojis_removed": enhancement_stats.emojis_removed,
                    "links_filtered": enhancement_stats.links_filtered,
                    "duplicates_removed": enhancement_stats.duplicates_removed,
                    "improvement_score": enhancement_stats.improvement_score,
                }
            else:
                preview_data["content_enhancement"] = {"applied": False}

            # Add OCR information if available
            if 'ocr_results' in locals() and ocr_results:
                preview_data["image_ocr"] = {
                    "applied": True,
                    "images_processed": len(ocr_results),
                    "text_extracted": sum(len(result.extracted_text) for result in ocr_results),
                    "average_confidence": sum(result.confidence_score for result in ocr_results) / len(ocr_results),
                    "ocr_results": [
                        {
                            "image_url": result.image_url,
                            "text_length": len(result.extracted_text),
                            "confidence": result.confidence_score
                        }
                        for result in ocr_results
                    ]
                }
            else:
                preview_data["image_ocr"] = {"applied": False}

            # Add intelligent recommendations if available
            if 'content_analysis' in locals() and content_analysis:
                preview_data["intelligent_analysis"] = {
                    "content_type_detected": content_analysis.content_type.value,
                    "structure_score": content_analysis.structure_score,
                    "complexity_score": content_analysis.complexity_score,
                    "recommended_strategy": getattr(recommended_preset, 'chunking_strategy', strategy),
                    "reasoning": reasoning
                }

            # Cache result
            self._set_cache(cache_key, preview_data)

            return preview_data

        except Exception as e:
            return {
                "error": "Preview generation failed",
                "message": str(e)
            }


    async def preview_chunking_for_text(
        self,
        text: str,
        strategy: str = "recursive",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        max_preview_chunks: int = 10
    ) -> Dict:
        """
        Generate chunking preview for raw text.

        WHY: Allow users to preview chunking for pasted text
        HOW: Apply strategy directly, return preview
        """

        try:
            # Step 1: Analyze document structure
            doc_stats = self._analyze_document(text)

            # Step 2: Get strategy recommendation
            recommendation = self._get_strategy_recommendation(None, doc_stats)

            # Step 3: Apply chunking strategy
            chunks = chunking_service.chunk_document(
                text=text,
                strategy=strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )

            # Step 4: Prepare preview
            preview_chunks = chunks[:max_preview_chunks]

            return {
                "source": "text_input",
                "strategy": strategy,
                "config": {
                    "chunk_size": chunk_size,
                    "chunk_overlap": chunk_overlap
                },
                "preview_chunks": [
                    {
                        "index": chunk["index"],
                        "content": chunk["content"][:500] + "..." if len(chunk["content"]) > 500 else chunk["content"],
                        "full_length": len(chunk["content"]),
                        "token_count": chunk["token_count"],
                        "preview": True
                    }
                    for chunk in preview_chunks
                ],
                "total_chunks_estimated": len(chunks),
                "document_stats": doc_stats,
                "strategy_recommendation": recommendation,
                "metadata": {
                    "generated_at": datetime.utcnow().isoformat(),
                    "content_length": len(text),
                    "showing_chunks": f"{len(preview_chunks)} of {len(chunks)}"
                }
            }

        except Exception as e:
            return {
                "error": "Preview generation failed",
                "message": str(e)
            }


    def _analyze_document(self, text: str) -> Dict:
        """
        Analyze document structure for strategy selection.

        WHY: Understand content characteristics
        HOW: Count headings, paragraphs, lists, code blocks
        """

        lines = text.split("\n")
        total_lines = len(lines)

        # Count different elements
        heading_count = len([line for line in lines if line.strip().startswith("#")])
        paragraph_count = len([p for p in text.split("\n\n") if p.strip()])
        list_count = len([line for line in lines if line.strip().startswith(("- ", "* ", "1. ", "2. ", "3. "))])
        code_block_count = text.count("```")

        # Calculate densities
        heading_density = heading_count / total_lines if total_lines > 0 else 0
        list_density = list_count / total_lines if total_lines > 0 else 0

        return {
            "total_characters": len(text),
            "total_lines": total_lines,
            "total_paragraphs": paragraph_count,
            "heading_count": heading_count,
            "heading_density": round(heading_density, 3),
            "list_count": list_count,
            "list_density": round(list_density, 3),
            "code_block_count": code_block_count // 2,  # Divide by 2 (opening and closing)
            "avg_paragraph_length": len(text) // paragraph_count if paragraph_count > 0 else 0,
            "structure_type": self._determine_structure_type(heading_density, list_density, paragraph_count)
        }


    def _determine_structure_type(
        self,
        heading_density: float,
        list_density: float,
        paragraph_count: int
    ) -> str:
        """Determine document structure type."""

        if heading_density > 0.1:
            return "highly_structured"
        elif heading_density > 0.05:
            return "moderately_structured"
        elif list_density > 0.2:
            return "list_heavy"
        elif paragraph_count > 20:
            return "long_form_text"
        else:
            return "unstructured"


    def _get_strategy_recommendation(self, url: Optional[str], doc_stats: Dict) -> str:
        """
        Recommend chunking strategy based on URL and content.

        WHY: Help users choose optimal strategy
        HOW: Analyze URL pattern and document structure

        OPTIMIZATION:
        - GitBook docs → by_heading
        - GitHub README → hybrid
        - Notion pages → by_section
        - Documentation sites → by_heading
        - Blogs → paragraph_based
        - Q&A content → semantic
        """

        # URL-based recommendations
        if url:
            url_lower = url.lower()

            if "gitbook.io" in url_lower or "docs" in url_lower:
                return "by_heading (optimized for GitBook/Documentation)"

            elif "github.com" in url_lower:
                return "hybrid (optimized for GitHub README/docs)"

            elif "notion.so" in url_lower or "notion.site" in url_lower:
                return "by_section (optimized for Notion pages)"

            elif "blog" in url_lower or "article" in url_lower:
                return "paragraph_based (optimized for blog/article)"

        # Content-based recommendations
        structure_type = doc_stats.get("structure_type", "unstructured")
        heading_density = doc_stats.get("heading_density", 0)

        if structure_type == "highly_structured" or heading_density > 0.1:
            return "by_heading (high structure detected)"

        elif structure_type == "list_heavy":
            return "paragraph_based (list-heavy content)"

        elif structure_type == "long_form_text":
            return "semantic (long-form text)"

        elif structure_type == "moderately_structured":
            return "hybrid (mixed structure)"

        else:
            return "adaptive (let system choose)"


    def _detect_site_type(self, url: str) -> str:
        """Detect website type for optimization."""

        url_lower = url.lower()

        if "gitbook.io" in url_lower:
            return "gitbook"
        elif "github.com" in url_lower:
            return "github"
        elif "notion" in url_lower:
            return "notion"
        elif "docs" in url_lower or "documentation" in url_lower:
            return "documentation"
        elif "blog" in url_lower:
            return "blog"
        elif "wiki" in url_lower:
            return "wiki"
        else:
            return "general"


    async def preview_chunking_for_draft(
        self,
        draft_id: str,
        strategy: Optional[str] = None,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        max_preview_pages: int = 5
    ) -> Dict:
        """
        Generate realistic multi-page preview using draft's crawl configuration.

        WHY: Users want to see realistic preview before finalizing KB
        HOW: Use draft's URLs and crawl config to crawl multiple pages

        TYPE: Draft Preview (Realistic Multi-Page)
        SPEED: 10-30 seconds

        ARGS:
            draft_id: KB draft ID
            strategy: Chunking strategy (overrides draft config if provided)
            chunk_size: Chunk size (overrides draft config if provided)
            chunk_overlap: Chunk overlap (overrides draft config if provided)
            max_preview_pages: Max pages to crawl for preview (default: 5)

        RETURNS:
            {
                "draft_id": str,
                "pages_previewed": int,
                "total_chunks": int,
                "strategy": str,
                "pages": [
                    {
                        "url": str,
                        "title": str,
                        "chunks": int,
                        "preview_chunks": [...]
                    }
                ],
                "estimated_total_chunks": int,
                "crawl_config": {...},
                "note": str
            }
        """

        try:
            # Step 1: Get draft from Redis
            from app.services.draft_service import DraftType
            draft = draft_service.get_draft(DraftType.KB, draft_id)

            if not draft:
                return {
                    "error": "Draft not found",
                    "message": f"KB draft {draft_id} not found or expired"
                }

            data = draft.get("data", {})
            sources = data.get("sources", [])

            if not sources:
                return {
                    "error": "No sources found",
                    "message": "Draft has no web URLs configured"
                }

            # Step 2: Get configuration (use override or draft config)
            chunking_config = data.get("chunking_config", {})
            final_strategy = strategy or chunking_config.get("strategy", "by_heading")
            final_chunk_size = chunk_size or chunking_config.get("chunk_size", 1000)
            final_chunk_overlap = chunk_overlap or chunking_config.get("chunk_overlap", 200)

            # Step 3: Collect all web sources to crawl
            # Process ALL sources, not limited by max_preview_pages (that's for crawl depth)
            pages_to_crawl = []
            for source in sources:
                if source.get("type") == "web_scraping":
                    url = source.get("url")
                    config = source.get("config", {})
                    pages_to_crawl.append({
                        "url": url,
                        "config": config
                    })

            if not pages_to_crawl:
                return {
                    "error": "No valid web sources",
                    "message": "No web scraping sources found in draft"
                }

            # Step 4: Scrape or crawl ALL sources based on their individual configuration
            # max_preview_pages limits crawl depth per URL, not number of URLs
            pages_preview = []
            total_chunks = 0

            for page_info in pages_to_crawl:
                url = page_info["url"]
                crawl_config = page_info["config"]

                try:
                    # Check if we should use crawl or single scraping
                    method = crawl_config.get("method", "single")

                    if method == "crawl":
                        # Use crawl_website with proper configuration
                        from app.services.crawl4ai_service import CrawlConfig

                        # Use URL-specific configuration, max_preview_pages only limits pages per URL
                        config = CrawlConfig(
                            method="crawl",
                            max_pages=min(crawl_config.get("max_pages", 10), max_preview_pages),
                            max_depth=crawl_config.get("max_depth", 2),
                            include_patterns=crawl_config.get("include_patterns", []),
                            exclude_patterns=crawl_config.get("exclude_patterns", []),
                            stealth_mode=True,
                            delay_between_requests=1.5,
                            extract_links=True,
                            preserve_code_blocks=True
                        )

                        # Crawl multiple pages
                        scraped_pages = await crawl4ai_service.crawl_website(url, config)

                        # Process each crawled page
                        for scrape_result in scraped_pages:
                            content = scrape_result.content or ""
                            if not content:
                                continue

                            # Generate title with fallback
                            title = scrape_result.title or self._extract_title_fallback(content, scrape_result.url)

                            # Generate chunks for this page
                            chunks = chunking_service.chunk_document(
                                text=content,
                                strategy=final_strategy,
                                chunk_size=final_chunk_size,
                                chunk_overlap=final_chunk_overlap
                            )

                            # Add page to preview
                            pages_preview.append({
                                "url": scrape_result.url,
                                "title": title,
                                "content": content,  # Store FULL content, no truncation
                                "content_preview": content[:500] + "..." if len(content) > 500 else content,
                                "chunks": len(chunks),
                                "preview_chunks": [
                                    {
                                        "index": chunk["index"],
                                        "content": chunk["content"][:300] + "..." if len(chunk["content"]) > 300 else chunk["content"],
                                        "full_length": len(chunk["content"]),
                                        "token_count": chunk.get("token_count", 0)
                                    }
                                    for chunk in chunks[:3]  # Show first 3 chunks per page
                                ],
                                "metadata": scrape_result.metadata,
                                "word_count": scrape_result.metadata.get("word_count", 0)
                            })

                            total_chunks += len(chunks)
                    else:
                        # Single page scraping (original logic)
                        scrape_result = await crawl4ai_service.scrape_single_url(url)
                        content = scrape_result.content or ""

                        if not content:
                            continue

                        # Generate title with fallback
                        title = scrape_result.title or self._extract_title_fallback(content, scrape_result.url)

                        # Generate chunks for this page
                        chunks = chunking_service.chunk_document(
                            text=content,
                            strategy=final_strategy,
                            chunk_size=final_chunk_size,
                            chunk_overlap=final_chunk_overlap
                        )

                        # Add page to preview
                        pages_preview.append({
                            "url": scrape_result.url,
                            "title": title,
                            "content": content,  # Store FULL content, no truncation
                            "content_preview": content[:500] + "..." if len(content) > 500 else content,
                            "chunks": len(chunks),
                            "preview_chunks": [
                                {
                                    "index": chunk["index"],
                                    "content": chunk["content"][:300] + "..." if len(chunk["content"]) > 300 else chunk["content"],
                                    "full_length": len(chunk["content"]),
                                    "token_count": chunk.get("token_count", 0)
                                }
                                for chunk in chunks[:3]  # Show first 3 chunks per page
                            ],
                            "metadata": scrape_result.metadata or {},
                            "word_count": scrape_result.metadata.get("word_count", 0) if scrape_result.metadata else 0
                        })

                        total_chunks += len(chunks)

                except Exception as e:
                    pages_preview.append({
                        "url": url,
                        "error": str(e),
                        "chunks": 0,
                        "preview_chunks": []
                    })
                    continue

            # Step 5: Estimate total chunks for all sources
            total_sources = len(sources)
            avg_chunks_per_page = total_chunks / len(pages_preview) if pages_preview else 0
            estimated_total_chunks = int(avg_chunks_per_page * total_sources)

            # Step 6: Build response
            return {
                "draft_id": draft_id,
                "pages_previewed": len(pages_preview),
                "total_chunks": total_chunks,
                "strategy": final_strategy,
                "config": {
                    "chunk_size": final_chunk_size,
                    "chunk_overlap": final_chunk_overlap
                },
                "pages": pages_preview,
                "estimated_total_chunks": estimated_total_chunks,
                "crawl_config": {
                    "total_sources": total_sources,
                    "sources_previewed": len(pages_preview),
                    "note": f"Preview based on {len(pages_preview)} of {total_sources} sources"
                },
                "note": f"Preview based on {len(pages_preview)} of {total_sources} sources. Actual processing will process all sources."
            }

        except Exception as e:
            return {
                "error": "Preview generation failed",
                "message": str(e)
            }


    async def preview_rechunking_for_kb(
        self,
        db_session,
        kb_id: str,
        strategy: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        sample_documents: int = 3
    ) -> Dict:
        """
        Preview re-chunking for existing KB with comparison.

        WHY: Users want to optimize chunking strategy for existing KB
        HOW: Re-chunk existing documents and compare with current state

        TYPE: KB Re-chunking Preview (Optimization)
        SPEED: 1-5 seconds (no scraping needed!)

        ARGS:
            db_session: Database session
            kb_id: Knowledge base ID
            strategy: New chunking strategy to test
            chunk_size: New chunk size
            chunk_overlap: New chunk overlap
            sample_documents: Number of documents to sample (default: 3)

        RETURNS:
            {
                "kb_id": str,
                "current_config": {...},
                "new_config": {...},
                "comparison": {
                    "current": {...},
                    "new": {...},
                    "delta": {...}
                },
                "sample_chunks": [...],
                "note": str
            }
        """

        try:
            from uuid import UUID
            from app.models.knowledge_base import KnowledgeBase
            from app.models.document import Document

            # Step 1: Get KB from database
            kb = db_session.query(KnowledgeBase).filter(
                KnowledgeBase.id == UUID(kb_id)
            ).first()

            if not kb:
                return {
                    "error": "KB not found",
                    "message": f"Knowledge base {kb_id} not found"
                }

            # Step 2: Get sample documents
            documents = db_session.query(Document).filter(
                Document.kb_id == UUID(kb_id),
                Document.status == "ready"
            ).limit(sample_documents).all()

            if not documents:
                return {
                    "error": "No documents found",
                    "message": "No ready documents found in KB"
                }

            # Step 3: Get current configuration
            current_config = {
                "strategy": kb.indexing_method or "by_heading",
                "chunk_size": kb.config.get("chunk_size", 1000) if kb.config else 1000,
                "chunk_overlap": kb.config.get("chunk_overlap", 200) if kb.config else 200
            }

            new_config = {
                "strategy": strategy,
                "chunk_size": chunk_size,
                "chunk_overlap": chunk_overlap
            }

            # Step 4: Re-chunk sample documents with both strategies
            current_stats = {"total_chunks": 0, "chunk_sizes": []}
            new_stats = {"total_chunks": 0, "chunk_sizes": []}
            sample_chunks = []

            for doc in documents:
                # Get document content (from scraped_content or raw_content)
                content = doc.scraped_content or doc.raw_content or ""

                if not content:
                    continue

                # Chunk with current strategy
                current_chunks = chunking_service.chunk_document(
                    text=content,
                    strategy=current_config["strategy"],
                    chunk_size=current_config["chunk_size"],
                    chunk_overlap=current_config["chunk_overlap"]
                )

                # Chunk with new strategy
                new_chunks = chunking_service.chunk_document(
                    text=content,
                    strategy=strategy,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap
                )

                # Collect stats
                current_stats["total_chunks"] += len(current_chunks)
                current_stats["chunk_sizes"].extend([len(c["content"]) for c in current_chunks])

                new_stats["total_chunks"] += len(new_chunks)
                new_stats["chunk_sizes"].extend([len(c["content"]) for c in new_chunks])

                # Add to sample
                sample_chunks.append({
                    "document_name": doc.name,
                    "old_chunks": len(current_chunks),
                    "new_chunks": len(new_chunks),
                    "preview": [
                        {
                            "content": chunk["content"][:200] + "..." if len(chunk["content"]) > 200 else chunk["content"],
                            "full_length": len(chunk["content"])
                        }
                        for chunk in new_chunks[:2]
                    ]
                })

            # Step 5: Calculate comparison metrics
            current_avg = sum(current_stats["chunk_sizes"]) / len(current_stats["chunk_sizes"]) if current_stats["chunk_sizes"] else 0
            current_min = min(current_stats["chunk_sizes"]) if current_stats["chunk_sizes"] else 0
            current_max = max(current_stats["chunk_sizes"]) if current_stats["chunk_sizes"] else 0

            new_avg = sum(new_stats["chunk_sizes"]) / len(new_stats["chunk_sizes"]) if new_stats["chunk_sizes"] else 0
            new_min = min(new_stats["chunk_sizes"]) if new_stats["chunk_sizes"] else 0
            new_max = max(new_stats["chunk_sizes"]) if new_stats["chunk_sizes"] else 0

            chunks_change = new_stats["total_chunks"] - current_stats["total_chunks"]
            chunks_percent = (chunks_change / current_stats["total_chunks"] * 100) if current_stats["total_chunks"] > 0 else 0
            avg_size_change = new_avg - current_avg

            # Generate recommendation
            recommendation = self._generate_rechunk_recommendation(
                chunks_change, avg_size_change, strategy
            )

            # Step 6: Build response
            return {
                "kb_id": kb_id,
                "kb_name": kb.name,
                "current_config": current_config,
                "new_config": new_config,
                "comparison": {
                    "current": {
                        "total_chunks": current_stats["total_chunks"],
                        "avg_chunk_size": int(current_avg),
                        "min_chunk_size": current_min,
                        "max_chunk_size": current_max
                    },
                    "new": {
                        "total_chunks": new_stats["total_chunks"],
                        "avg_chunk_size": int(new_avg),
                        "min_chunk_size": new_min,
                        "max_chunk_size": new_max
                    },
                    "delta": {
                        "chunks_change": chunks_change,
                        "chunks_percent": round(chunks_percent, 1),
                        "avg_size_change": int(avg_size_change),
                        "recommendation": recommendation
                    }
                },
                "sample_chunks": sample_chunks,
                "documents_analyzed": len(documents),
                "total_documents": db_session.query(Document).filter(
                    Document.kb_id == UUID(kb_id)
                ).count(),
                "note": f"Preview based on {len(documents)} sample documents. Apply changes to re-index entire KB."
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "error": "Preview generation failed",
                "message": str(e)
            }


    def _generate_rechunk_recommendation(
        self,
        chunks_change: int,
        avg_size_change: float,
        new_strategy: str
    ) -> str:
        """Generate recommendation for re-chunking."""

        if chunks_change < 0 and avg_size_change > 0:
            return f"Fewer, larger chunks ({new_strategy}) may improve context retention for complex queries"
        elif chunks_change > 0 and avg_size_change < 0:
            return f"More, smaller chunks ({new_strategy}) may improve precision for specific queries"
        elif abs(chunks_change) < 10:
            return f"Similar chunk count. {new_strategy} may provide better semantic boundaries"
        else:
            return f"Strategy {new_strategy} produces significantly different chunking pattern"


    def _get_from_cache(self, key: str) -> Optional[Dict]:
        """Get preview from Redis cache."""

        try:
            cached_data = draft_service.redis_client.get(f"preview_cache:{key}")
            if cached_data:
                import json
                return json.loads(cached_data)
        except Exception as e:
            print(f"Cache read error: {e}")

        return None


    def _set_cache(self, key: str, data: Dict) -> None:
        """Store preview in Redis cache with TTL."""

        try:
            import json
            draft_service.redis_client.setex(
                f"preview_cache:{key}",
                self.cache_ttl,
                json.dumps(data, default=str)
            )
        except Exception as e:
            print(f"Cache write error: {e}")

    def _extract_title_fallback(self, content: str, url: str) -> str:
        """
        Extract page title with fallbacks when metadata title is empty.

        WHY: Many pages don't have proper title metadata, but have titles in content
        HOW: Try multiple fallback strategies for title extraction
        """
        if not content:
            return self._generate_title_from_url(url)

        # Strategy 1: Look for markdown # heading at start
        lines = content.split('\n')
        for line in lines[:10]:  # Check first 10 lines
            line = line.strip()
            if line.startswith('# ') and len(line) > 2:
                title = line[2:].strip()
                if len(title) > 5 and len(title) < 100:  # Reasonable title length
                    return title

        # Strategy 2: Look for <h1> tags in content
        import re
        h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', content, re.IGNORECASE | re.DOTALL)
        if h1_match:
            title = re.sub(r'<[^>]+>', '', h1_match.group(1)).strip()
            if len(title) > 5 and len(title) < 100:
                return title

        # Strategy 3: Look for first substantial text paragraph
        for line in lines[:20]:  # Check first 20 lines
            line = line.strip()
            if (len(line) > 10 and len(line) < 80 and
                not line.startswith(('#', '-', '*', '```', 'http')) and
                not line.startswith('[') and
                line.count(' ') >= 2):  # At least 3 words
                return line

        # Strategy 4: Generate from URL
        return self._generate_title_from_url(url)

    def _generate_title_from_url(self, url: str) -> str:
        """Generate a reasonable title from URL when all else fails"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)

            # Get path and clean it up
            path = parsed.path.strip('/')
            if path:
                # Convert path to title
                parts = path.split('/')
                # Take the last meaningful part
                for part in reversed(parts):
                    if part and part not in ('index', 'home', 'readme'):
                        # Convert hyphens/underscores to spaces and title case
                        title = part.replace('-', ' ').replace('_', ' ').title()
                        if len(title) > 3:
                            return title

            # Fallback to domain name
            domain = parsed.netloc.replace('www.', '')
            return domain.split('.')[0].title() if domain else "Untitled"

        except Exception:
            return "Untitled"


# Global instance
preview_service = PreviewService()
