"""
Content Enhancement Service - Clean and optimize scraped content.

WHY:
- Remove noise (emojis, unwanted links, ads)
- Normalize text for better chunking and embedding
- Deduplicate content across pages
- Improve content quality for RAG retrieval

HOW:
- Pattern-based text cleaning
- Link filtering with configurable patterns
- Content deduplication using text similarity
- Language normalization and cleanup

INTEGRATES WITH: preview_service.py, document_processing_service.py
"""

import re
import unicodedata
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from urllib.parse import urlparse, parse_qs
import hashlib
from difflib import SequenceMatcher

from pydantic import BaseModel, Field


@dataclass
class ContentStats:
    """Statistics about content after enhancement"""
    original_length: int
    cleaned_length: int
    emojis_removed: int
    links_filtered: int
    duplicates_removed: int
    improvement_score: float  # 0-1 score of content quality improvement


class ContentEnhancementConfig(BaseModel):
    """Configuration for content enhancement"""

    # Emoji and Unicode Cleanup
    remove_emojis: bool = Field(
        default=True,
        description="Remove emoji characters from content"
    )
    normalize_unicode: bool = Field(
        default=True,
        description="Normalize unicode characters (accents, etc.)"
    )

    # Link Filtering
    filter_unwanted_links: bool = Field(
        default=True,
        description="Remove tracking, ad, and unwanted links"
    )
    unwanted_link_patterns: List[str] = Field(
        default_factory=lambda: [
            # Tracking and analytics
            r'.*google-analytics\.com.*',
            r'.*googletagmanager\.com.*',
            r'.*facebook\.com/tr\?.*',
            r'.*doubleclick\.net.*',
            # Social media tracking
            r'.*utm_source=.*',
            r'.*utm_medium=.*',
            r'.*fbclid=.*',
            r'.*gclid=.*',
            # Generic ad patterns
            r'.*\?ref=.*',
            r'.*affiliate.*',
            r'.*\?campaign=.*',
        ],
        description="Regex patterns for unwanted links"
    )
    preserve_internal_links: bool = Field(
        default=True,
        description="Keep internal navigation and content links"
    )

    # Content Deduplication
    enable_deduplication: bool = Field(
        default=True,
        description="Remove duplicate content blocks"
    )
    similarity_threshold: float = Field(
        default=0.85,
        ge=0.0, le=1.0,
        description="Similarity threshold for considering content duplicate"
    )
    min_content_length: int = Field(
        default=50,
        ge=10,
        description="Minimum length for content blocks to consider for deduplication"
    )

    # Text Normalization
    normalize_whitespace: bool = Field(
        default=True,
        description="Normalize excessive whitespace and line breaks"
    )
    remove_special_chars: bool = Field(
        default=False,
        description="Remove special characters (be careful with code content)"
    )

    # Quality Improvement
    merge_short_lines: bool = Field(
        default=True,
        description="Merge very short lines that seem fragmented"
    )
    min_line_length: int = Field(
        default=10,
        ge=1,
        description="Minimum line length before merging with next line"
    )


class ContentEnhancementService:
    """
    Service for cleaning and optimizing scraped web content.

    PHILOSOPHY: Improve content quality without losing semantic meaning
    INTEGRATES WITH: preview_service.py, crawl4ai_service.py
    """

    def __init__(self):
        self.seen_content_hashes: Set[str] = set()
        self.processed_blocks: List[str] = []

        # Common emoji patterns for removal
        self.emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # emoticons
            "\U0001F300-\U0001F5FF"  # symbols & pictographs
            "\U0001F680-\U0001F6FF"  # transport & map symbols
            "\U0001F1E0-\U0001F1FF"  # flags (iOS)
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE
        )

    def enhance_content(
        self,
        content: str,
        url: Optional[str] = None,
        config: Optional[ContentEnhancementConfig] = None
    ) -> Tuple[str, ContentStats]:
        """
        Main content enhancement function.

        Args:
            content: Raw scraped content
            url: Source URL for context
            config: Enhancement configuration

        Returns:
            Tuple of (enhanced_content, enhancement_stats)
        """

        if not config:
            config = ContentEnhancementConfig()

        original_length = len(content)
        stats = ContentStats(
            original_length=original_length,
            cleaned_length=0,
            emojis_removed=0,
            links_filtered=0,
            duplicates_removed=0,
            improvement_score=0.0
        )

        enhanced_content = content

        try:
            # Step 1: Unicode normalization
            if config.normalize_unicode:
                enhanced_content = self._normalize_unicode(enhanced_content)

            # Step 2: Remove emojis
            if config.remove_emojis:
                enhanced_content, emoji_count = self._remove_emojis(enhanced_content)
                stats.emojis_removed = emoji_count

            # Step 3: Filter unwanted links
            if config.filter_unwanted_links:
                enhanced_content, filtered_count = self._filter_unwanted_links(
                    enhanced_content, config, url
                )
                stats.links_filtered = filtered_count

            # Step 4: Normalize whitespace
            if config.normalize_whitespace:
                enhanced_content = self._normalize_whitespace(enhanced_content)

            # Step 5: Merge short lines
            if config.merge_short_lines:
                enhanced_content = self._merge_short_lines(
                    enhanced_content, config.min_line_length
                )

            # Step 6: Content deduplication (if multiple content blocks)
            if config.enable_deduplication:
                enhanced_content, dup_count = self._deduplicate_content(
                    enhanced_content, config
                )
                stats.duplicates_removed = dup_count

            # Update final stats
            stats.cleaned_length = len(enhanced_content)
            stats.improvement_score = self._calculate_improvement_score(
                original_length, stats
            )

        except Exception as e:
            # If enhancement fails, return original content
            print(f"Warning: Content enhancement failed: {e}")
            return content, stats

        return enhanced_content, stats

    def _normalize_unicode(self, content: str) -> str:
        """Normalize unicode characters to standard forms"""
        # Normalize to NFKC (canonical decomposition, then canonical composition)
        return unicodedata.normalize('NFKC', content)

    def _remove_emojis(self, content: str) -> Tuple[str, int]:
        """Remove emoji characters from content"""
        original_len = len(content)
        cleaned = self.emoji_pattern.sub('', content)
        emojis_removed = original_len - len(cleaned)
        return cleaned, emojis_removed

    def _filter_unwanted_links(
        self,
        content: str,
        config: ContentEnhancementConfig,
        source_url: Optional[str] = None
    ) -> Tuple[str, int]:
        """Remove unwanted links based on patterns"""

        # Find all markdown links [text](url)
        link_pattern = r'\[([^\]]*)\]\(([^)]*)\)'
        links = re.findall(link_pattern, content)

        filtered_count = 0

        for text, url in links:
            # Check if URL matches unwanted patterns
            should_filter = False

            for pattern in config.unwanted_link_patterns:
                if re.match(pattern, url, re.IGNORECASE):
                    should_filter = True
                    break

            # Keep internal links if configured
            if config.preserve_internal_links and source_url:
                source_domain = urlparse(source_url).netloc
                link_domain = urlparse(url).netloc
                if link_domain == source_domain:
                    should_filter = False

            if should_filter:
                # Replace link with just the text
                full_link = f'[{text}]({url})'
                content = content.replace(full_link, text if text else '')
                filtered_count += 1

        return content, filtered_count

    def _normalize_whitespace(self, content: str) -> str:
        """Normalize excessive whitespace and line breaks"""
        # Replace multiple spaces with single space
        content = re.sub(r' +', ' ', content)

        # Replace multiple line breaks with maximum of 2
        content = re.sub(r'\n{3,}', '\n\n', content)

        # Remove trailing whitespace from lines
        lines = content.split('\n')
        lines = [line.rstrip() for line in lines]
        content = '\n'.join(lines)

        return content.strip()

    def _merge_short_lines(self, content: str, min_length: int) -> str:
        """Merge very short lines that appear to be fragments"""
        lines = content.split('\n')
        merged_lines = []
        i = 0

        while i < len(lines):
            current_line = lines[i].strip()

            # If current line is short and not special (header, list, etc.)
            if (len(current_line) < min_length and
                current_line and
                not self._is_special_line(current_line) and
                i < len(lines) - 1):

                next_line = lines[i + 1].strip()
                if next_line and not self._is_special_line(next_line):
                    # Merge with next line
                    merged_lines.append(current_line + ' ' + next_line)
                    i += 2  # Skip next line
                    continue

            merged_lines.append(lines[i])
            i += 1

        return '\n'.join(merged_lines)

    def _is_special_line(self, line: str) -> bool:
        """Check if line is special (header, list, code, etc.) and shouldn't be merged"""
        line = line.strip()

        # Headers
        if line.startswith('#'):
            return True

        # List items
        if re.match(r'^[\*\-\+]\s', line) or re.match(r'^\d+\.\s', line):
            return True

        # Code blocks
        if line.startswith('```') or line.startswith('    '):
            return True

        # Tables
        if '|' in line:
            return True

        # Links
        if line.startswith('[') and '](' in line:
            return True

        return False

    def _deduplicate_content(
        self,
        content: str,
        config: ContentEnhancementConfig
    ) -> Tuple[str, int]:
        """Remove duplicate content blocks"""

        # Split content into paragraphs
        paragraphs = content.split('\n\n')
        unique_paragraphs = []
        removed_count = 0

        for paragraph in paragraphs:
            paragraph = paragraph.strip()

            # Skip very short paragraphs
            if len(paragraph) < config.min_content_length:
                unique_paragraphs.append(paragraph)
                continue

            # Check similarity with existing paragraphs
            is_duplicate = False
            for existing in unique_paragraphs:
                if len(existing) < config.min_content_length:
                    continue

                similarity = SequenceMatcher(None, paragraph, existing).ratio()
                if similarity > config.similarity_threshold:
                    is_duplicate = True
                    removed_count += 1
                    break

            if not is_duplicate:
                unique_paragraphs.append(paragraph)

        return '\n\n'.join(unique_paragraphs), removed_count

    def _calculate_improvement_score(
        self,
        original_length: int,
        stats: ContentStats
    ) -> float:
        """Calculate a 0-1 score of content quality improvement"""

        if original_length == 0:
            return 0.0

        # Factors that improve score
        improvements = 0
        total_possible = 4

        # Length reduction (but not too much)
        length_reduction = (original_length - stats.cleaned_length) / original_length
        if 0.05 <= length_reduction <= 0.30:  # 5-30% reduction is good
            improvements += 1

        # Emoji removal (if any were present)
        if stats.emojis_removed > 0:
            improvements += 1

        # Link filtering (if any were filtered)
        if stats.links_filtered > 0:
            improvements += 1

        # Deduplication (if any duplicates were found)
        if stats.duplicates_removed > 0:
            improvements += 1

        return improvements / total_possible

    def reset_deduplication_cache(self):
        """Reset the deduplication cache for new processing session"""
        self.seen_content_hashes.clear()
        self.processed_blocks.clear()


# Global service instance
content_enhancement_service = ContentEnhancementService()