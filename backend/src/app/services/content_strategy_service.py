"""
Content Strategy Service - Intelligent configuration presets and recommendations.

WHY:
- Provide optimal settings for different content types
- Automate strategy selection based on content analysis
- Offer best practices without requiring deep knowledge
- Improve RAG quality through intelligent defaults

HOW:
- Analyze content structure and domain
- Recommend chunking strategies and configurations
- Provide presets for common use cases
- Auto-detect content type and suggest optimizations

INTEGRATES WITH: preview_service.py, chunking_service.py, kb_draft_service.py
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum
from urllib.parse import urlparse
import re

from pydantic import BaseModel, Field

# Import at class level to avoid circular imports
try:
    from .content_enhancement_service import ContentEnhancementConfig
    from .ocr_service import OCRConfig
except ImportError:
    # Fallback if services not available
    ContentEnhancementConfig = dict
    OCRConfig = dict


class ContentType(Enum):
    """Detected content types for strategy recommendation"""
    DOCUMENTATION = "documentation"
    BLOG = "blog"
    CODE_REPOSITORY = "code_repository"
    ACADEMIC_PAPER = "academic_paper"
    NEWS_ARTICLE = "news_article"
    TUTORIAL = "tutorial"
    REFERENCE_MANUAL = "reference_manual"
    FORUM_DISCUSSION = "forum_discussion"
    PRODUCT_SPECS = "product_specs"
    UNKNOWN = "unknown"


@dataclass
class ContentAnalysis:
    """Analysis of content structure and characteristics"""
    content_type: ContentType
    heading_count: int
    heading_density: float  # headings per 1000 characters
    code_block_count: int
    code_density: float
    list_count: int
    list_density: float
    table_count: int
    avg_paragraph_length: float
    total_characters: int
    language: str
    structure_score: float  # 0-1, higher means more structured
    complexity_score: float  # 0-1, higher means more complex


class StrategyPreset(BaseModel):
    """Complete configuration preset for a content type"""

    name: str = Field(description="Preset name")
    description: str = Field(description="What this preset is optimized for")

    # Chunking configuration
    chunking_strategy: str = Field(description="Recommended chunking strategy")
    chunk_size: int = Field(description="Optimal chunk size")
    chunk_overlap: int = Field(description="Chunk overlap")

    # Crawling configuration
    max_pages: int = Field(description="Recommended page limit")
    max_depth: int = Field(description="Recommended crawl depth")
    stealth_mode: bool = Field(description="Whether to use stealth mode")
    delay_between_requests: float = Field(description="Request delay in seconds")

    # Content enhancement
    content_enhancement: ContentEnhancementConfig = Field(
        description="Content enhancement settings"
    )

    # OCR settings
    ocr_config: OCRConfig = Field(description="OCR processing settings")

    # Additional metadata
    use_cases: List[str] = Field(description="Best use cases for this preset")
    performance_notes: str = Field(description="Performance expectations")


class ContentStrategyService:
    """
    Service for intelligent content strategy recommendations.

    PHILOSOPHY: Automate the expertise of choosing optimal configurations
    PROVIDES: Smart defaults, content analysis, and strategy recommendations
    """

    def __init__(self):
        self.presets = self._initialize_presets()
        self.domain_patterns = self._initialize_domain_patterns()

    def analyze_content(self, content: str, url: Optional[str] = None) -> ContentAnalysis:
        """
        Analyze content structure and characteristics.

        Args:
            content: The content to analyze
            url: Source URL for additional context

        Returns:
            ContentAnalysis with detected characteristics
        """

        total_chars = len(content)
        if total_chars == 0:
            return ContentAnalysis(
                content_type=ContentType.UNKNOWN,
                heading_count=0, heading_density=0.0,
                code_block_count=0, code_density=0.0,
                list_count=0, list_density=0.0,
                table_count=0,
                avg_paragraph_length=0.0,
                total_characters=0,
                language="en",
                structure_score=0.0,
                complexity_score=0.0
            )

        # Count structural elements
        heading_count = len(re.findall(r'^#{1,6}\s', content, re.MULTILINE))
        code_block_count = len(re.findall(r'```[\s\S]*?```|`[^`]+`', content))
        list_count = len(re.findall(r'^\s*[-*+]\s|\d+\.\s', content, re.MULTILINE))
        table_count = len(re.findall(r'\|.*\|', content))

        # Calculate densities (per 1000 characters)
        heading_density = (heading_count / total_chars) * 1000
        code_density = (code_block_count / total_chars) * 1000
        list_density = (list_count / total_chars) * 1000

        # Calculate paragraph stats
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        avg_paragraph_length = sum(len(p) for p in paragraphs) / len(paragraphs) if paragraphs else 0

        # Determine content type
        content_type = self._detect_content_type(content, url, {
            'heading_density': heading_density,
            'code_density': code_density,
            'list_density': list_density,
            'avg_paragraph_length': avg_paragraph_length
        })

        # Calculate scores
        structure_score = self._calculate_structure_score(
            heading_density, list_density, table_count, total_chars
        )
        complexity_score = self._calculate_complexity_score(
            code_density, heading_count, avg_paragraph_length, total_chars
        )

        return ContentAnalysis(
            content_type=content_type,
            heading_count=heading_count,
            heading_density=heading_density,
            code_block_count=code_block_count,
            code_density=code_density,
            list_count=list_count,
            list_density=list_density,
            table_count=table_count,
            avg_paragraph_length=avg_paragraph_length,
            total_characters=total_chars,
            language=self._detect_language(content),
            structure_score=structure_score,
            complexity_score=complexity_score
        )

    def recommend_strategy(
        self,
        content: str,
        url: Optional[str] = None,
        user_preferences: Optional[Dict[str, Any]] = None
    ) -> Tuple[StrategyPreset, ContentAnalysis, str]:
        """
        Recommend optimal strategy configuration.

        Args:
            content: Content to analyze
            url: Source URL for context
            user_preferences: User-specified preferences to consider

        Returns:
            Tuple of (recommended_preset, content_analysis, reasoning)
        """

        # Analyze content
        analysis = self.analyze_content(content, url)

        # Get preset for content type
        preset = self.presets.get(analysis.content_type, self.presets[ContentType.UNKNOWN])

        # Apply user preferences if provided
        if user_preferences:
            preset = self._apply_user_preferences(preset, user_preferences)

        # Generate reasoning
        reasoning = self._generate_reasoning(analysis, preset)

        return preset, analysis, reasoning

    def get_preset(self, content_type: ContentType) -> StrategyPreset:
        """Get preset configuration for specific content type"""
        return self.presets.get(content_type, self.presets[ContentType.UNKNOWN])

    def list_presets(self) -> Dict[str, StrategyPreset]:
        """List all available presets"""
        return {ct.value: preset for ct, preset in self.presets.items()}

    def _detect_content_type(
        self,
        content: str,
        url: Optional[str],
        metrics: Dict[str, float]
    ) -> ContentType:
        """Detect content type based on URL and content characteristics"""

        # Check URL patterns first
        if url:
            domain = urlparse(url).netloc.lower()
            path = urlparse(url).path.lower()

            for pattern, content_type in self.domain_patterns.items():
                if pattern in domain or pattern in path:
                    return content_type

        # Analyze content characteristics
        heading_density = metrics['heading_density']
        code_density = metrics['code_density']
        list_density = metrics['list_density']
        avg_paragraph_length = metrics['avg_paragraph_length']

        # High code density suggests code repository or tutorial
        if code_density > 2.0:
            if 'github.com' in (url or '') or 'gitlab.com' in (url or ''):
                return ContentType.CODE_REPOSITORY
            return ContentType.TUTORIAL

        # High structure with moderate length suggests documentation
        if heading_density > 1.0 and 200 < avg_paragraph_length < 800:
            return ContentType.DOCUMENTATION

        # High structure with short paragraphs suggests reference
        if heading_density > 1.5 and avg_paragraph_length < 200:
            return ContentType.REFERENCE_MANUAL

        # Long paragraphs with low structure suggests blog/article
        if avg_paragraph_length > 800 and heading_density < 0.5:
            if any(term in (url or '') for term in ['blog', 'article', 'post']):
                return ContentType.BLOG
            return ContentType.NEWS_ARTICLE

        # High list density suggests specs or forum
        if list_density > 3.0:
            if any(term in (url or '') for term in ['spec', 'specification', 'requirements']):
                return ContentType.PRODUCT_SPECS
            return ContentType.FORUM_DISCUSSION

        # Academic patterns
        if any(term in content.lower() for term in ['abstract', 'methodology', 'conclusion', 'references']):
            return ContentType.ACADEMIC_PAPER

        return ContentType.UNKNOWN

    def _detect_language(self, content: str) -> str:
        """
        Detect content language using simple heuristics.

        Uses common word frequency detection for major languages.
        Falls back to "en" for ambiguous or short content.
        """
        if not content or len(content) < 50:
            return "en"

        # Sample first 2000 chars for performance
        sample = content[:2000].lower()

        # Common words by language (high-frequency function words)
        lang_markers = {
            "en": ["the", "and", "is", "in", "to", "of", "that", "for", "with"],
            "es": ["el", "la", "de", "en", "que", "los", "del", "las", "por"],
            "fr": ["le", "la", "de", "les", "des", "est", "en", "que", "une"],
            "de": ["der", "die", "und", "den", "das", "ist", "ein", "nicht", "von"],
            "pt": ["de", "que", "os", "não", "uma", "para", "como", "das", "por"],
            "zh": [],  # Detect by character range
            "ja": [],  # Detect by character range
            "ar": [],  # Detect by character range
        }

        # Check for CJK characters (Chinese/Japanese/Korean)
        cjk_count = sum(1 for c in sample if '\u4e00' <= c <= '\u9fff')
        if cjk_count > len(sample) * 0.1:
            # Check for Japanese-specific characters (hiragana/katakana)
            jp_count = sum(1 for c in sample if '\u3040' <= c <= '\u30ff')
            return "ja" if jp_count > 10 else "zh"

        # Check for Arabic characters
        ar_count = sum(1 for c in sample if '\u0600' <= c <= '\u06ff')
        if ar_count > len(sample) * 0.1:
            return "ar"

        # Word frequency detection for Latin-script languages
        import re
        words = re.findall(r'\b[a-z]+\b', sample)
        if not words:
            return "en"

        word_set = set(words)
        scores = {}
        for lang, markers in lang_markers.items():
            if markers:
                scores[lang] = sum(1 for m in markers if m in word_set)

        if scores:
            best_lang = max(scores, key=scores.get)
            if scores[best_lang] >= 3:
                return best_lang

        return "en"

    def _calculate_structure_score(
        self,
        heading_density: float,
        list_density: float,
        table_count: int,
        total_chars: int
    ) -> float:
        """Calculate how well-structured the content is (0-1)"""

        score = 0.0

        # Heading structure contributes to score
        if heading_density > 0.5:
            score += min(heading_density / 2.0, 0.4)  # Max 0.4

        # List structure contributes
        if list_density > 0.5:
            score += min(list_density / 4.0, 0.3)  # Max 0.3

        # Tables contribute
        if table_count > 0:
            table_density = (table_count / total_chars) * 1000
            score += min(table_density / 2.0, 0.3)  # Max 0.3

        return min(score, 1.0)

    def _calculate_complexity_score(
        self,
        code_density: float,
        heading_count: int,
        avg_paragraph_length: float,
        total_chars: int
    ) -> float:
        """Calculate content complexity (0-1)"""

        score = 0.0

        # Code increases complexity
        if code_density > 0:
            score += min(code_density / 5.0, 0.4)  # Max 0.4

        # Deep heading structure increases complexity
        if heading_count > 5:
            score += min((heading_count - 5) / 15.0, 0.3)  # Max 0.3

        # Very long or very short paragraphs increase complexity
        if avg_paragraph_length > 1000 or avg_paragraph_length < 50:
            score += 0.2

        # Long documents tend to be more complex
        if total_chars > 10000:
            score += min((total_chars - 10000) / 50000, 0.1)  # Max 0.1

        return min(score, 1.0)

    def _apply_user_preferences(
        self,
        preset: StrategyPreset,
        preferences: Dict[str, Any]
    ) -> StrategyPreset:
        """Apply user preferences to modify preset"""

        # Create a copy of the preset
        preset_dict = preset.dict()

        # Apply overrides
        for key, value in preferences.items():
            if key in preset_dict:
                preset_dict[key] = value

        return StrategyPreset(**preset_dict)

    def _generate_reasoning(
        self,
        analysis: ContentAnalysis,
        preset: StrategyPreset
    ) -> str:
        """Generate human-readable reasoning for the recommendation"""

        reasoning_parts = [
            f"Content type detected: {analysis.content_type.value}",
            f"Structure score: {analysis.structure_score:.2f}/1.0",
            f"Complexity score: {analysis.complexity_score:.2f}/1.0"
        ]

        # Strategy reasoning
        if preset.chunking_strategy == "by_heading":
            reasoning_parts.append("Recommended by_heading strategy to preserve document structure")
        elif preset.chunking_strategy == "semantic":
            reasoning_parts.append("Recommended semantic strategy for content-aware chunking")
        elif preset.chunking_strategy == "by_section":
            reasoning_parts.append("Recommended by_section strategy for logical separation")

        # Chunk size reasoning
        if preset.chunk_size >= 1500:
            reasoning_parts.append("Larger chunks to maintain context for complex content")
        elif preset.chunk_size <= 800:
            reasoning_parts.append("Smaller chunks for better granularity and search precision")

        return ". ".join(reasoning_parts) + "."

    def _initialize_presets(self) -> Dict[ContentType, StrategyPreset]:
        """Initialize all strategy presets"""

        presets = {}

        try:
            # Try to import configuration classes
            from .content_enhancement_service import ContentEnhancementConfig
            from .ocr_service import OCRConfig

            # Documentation preset (highest quality)
            presets[ContentType.DOCUMENTATION] = StrategyPreset(
                name="Documentation Optimized",
                description="Optimized for technical documentation with clear structure",
                chunking_strategy="by_heading",
                chunk_size=1000,
                chunk_overlap=200,
                max_pages=50,
                max_depth=3,
                stealth_mode=True,
                delay_between_requests=1.5,
                content_enhancement=ContentEnhancementConfig(
                    remove_emojis=True,
                    filter_unwanted_links=True,
                    enable_deduplication=True,
                    normalize_whitespace=True,
                    merge_short_lines=True
                ),
                ocr_config=OCRConfig(
                    enabled=False  # Usually not needed for documentation
                ),
                use_cases=["API docs", "User guides", "Technical specifications"],
                performance_notes="Balanced performance with high quality chunking"
            )

        except ImportError:
            # Fallback simplified presets without complex configuration
            presets[ContentType.DOCUMENTATION] = {
                "name": "Documentation Optimized",
                "description": "Optimized for technical documentation with clear structure",
                "chunking_strategy": "by_heading",
                "chunk_size": 1000,
                "chunk_overlap": 200,
                "max_pages": 50,
                "max_depth": 3,
                "stealth_mode": True,
                "delay_between_requests": 1.5,
                "use_cases": ["API docs", "User guides", "Technical specifications"],
                "performance_notes": "Balanced performance with high quality chunking"
            }

        # Blog preset
        presets[ContentType.BLOG] = StrategyPreset(
            name="Blog Optimized",
            description="Optimized for blog posts and articles",
            chunking_strategy="paragraph_based",
            chunk_size=800,
            chunk_overlap=150,
            max_pages=20,
            max_depth=2,
            stealth_mode=True,
            delay_between_requests=2.0,
            content_enhancement=ContentEnhancementConfig(
                remove_emojis=True,
                filter_unwanted_links=True,
                enable_deduplication=True,
                similarity_threshold=0.9,  # More strict for articles
                normalize_whitespace=True
            ),
            ocr_config=OCRConfig(
                enabled=True,  # Blogs often have informative images
                max_images_per_page=5
            ),
            use_cases=["Blog posts", "News articles", "Opinion pieces"],
            performance_notes="Fast processing with good content preservation"
        )

        # Code repository preset
        presets[ContentType.CODE_REPOSITORY] = StrategyPreset(
            name="Code Repository Optimized",
            description="Optimized for code repositories with documentation",
            chunking_strategy="by_section",
            chunk_size=1500,  # Larger to preserve code context
            chunk_overlap=300,
            max_pages=100,
            max_depth=4,
            stealth_mode=False,  # GitHub doesn't require stealth
            delay_between_requests=1.0,
            content_enhancement=ContentEnhancementConfig(
                remove_emojis=False,  # Keep emojis in READMEs
                filter_unwanted_links=False,  # Preserve all links
                enable_deduplication=False,  # Don't dedupe code examples
                normalize_whitespace=False,  # Preserve code formatting
                remove_special_chars=False
            ),
            ocr_config=OCRConfig(
                enabled=True,  # For screenshots of code/diagrams
                max_images_per_page=10
            ),
            use_cases=["GitHub repos", "GitLab projects", "Code documentation"],
            performance_notes="Slower processing but preserves code structure"
        )

        # Academic paper preset
        presets[ContentType.ACADEMIC_PAPER] = StrategyPreset(
            name="Academic Paper Optimized",
            description="Optimized for academic papers and research",
            chunking_strategy="semantic",
            chunk_size=1200,
            chunk_overlap=250,
            max_pages=1,  # Usually single document
            max_depth=1,
            stealth_mode=True,
            delay_between_requests=2.0,
            content_enhancement=ContentEnhancementConfig(
                remove_emojis=True,
                filter_unwanted_links=True,
                enable_deduplication=True,
                similarity_threshold=0.8,
                normalize_unicode=True,
                merge_short_lines=False  # Preserve citation formatting
            ),
            ocr_config=OCRConfig(
                enabled=True,  # For charts, graphs, tables
                max_images_per_page=15,
                language='eng'
            ),
            use_cases=["Research papers", "Academic articles", "Scientific documents"],
            performance_notes="High quality semantic understanding"
        )

        # Tutorial preset
        presets[ContentType.TUTORIAL] = StrategyPreset(
            name="Tutorial Optimized",
            description="Optimized for step-by-step tutorials and guides",
            chunking_strategy="by_heading",
            chunk_size=900,
            chunk_overlap=180,
            max_pages=30,
            max_depth=3,
            stealth_mode=True,
            delay_between_requests=1.5,
            content_enhancement=ContentEnhancementConfig(
                remove_emojis=False,  # Tutorials often use emojis for steps
                filter_unwanted_links=True,
                enable_deduplication=True,
                merge_short_lines=True
            ),
            ocr_config=OCRConfig(
                enabled=True,  # Screenshots are common in tutorials
                max_images_per_page=20
            ),
            use_cases=["How-to guides", "Step-by-step tutorials", "Learning materials"],
            performance_notes="Optimized for sequential content flow"
        )

        # Default/Unknown preset
        presets[ContentType.UNKNOWN] = StrategyPreset(
            name="Adaptive Default",
            description="Adaptive configuration for unknown content types",
            chunking_strategy="adaptive",
            chunk_size=1000,
            chunk_overlap=200,
            max_pages=30,
            max_depth=3,
            stealth_mode=True,
            delay_between_requests=1.5,
            content_enhancement=ContentEnhancementConfig(
                remove_emojis=True,
                filter_unwanted_links=True,
                enable_deduplication=True,
                normalize_whitespace=True
            ),
            ocr_config=OCRConfig(
                enabled=False  # Conservative default
            ),
            use_cases=["Unknown content", "Mixed content types", "General web pages"],
            performance_notes="Balanced approach with good general performance"
        )

        # Add other content types with similar patterns...
        presets[ContentType.NEWS_ARTICLE] = presets[ContentType.BLOG]
        presets[ContentType.REFERENCE_MANUAL] = presets[ContentType.DOCUMENTATION]
        presets[ContentType.FORUM_DISCUSSION] = presets[ContentType.BLOG]
        presets[ContentType.PRODUCT_SPECS] = presets[ContentType.DOCUMENTATION]

        return presets

    def _initialize_domain_patterns(self) -> Dict[str, ContentType]:
        """Initialize domain-based content type detection patterns"""

        return {
            # Documentation domains
            'docs.': ContentType.DOCUMENTATION,
            '/docs/': ContentType.DOCUMENTATION,
            'documentation': ContentType.DOCUMENTATION,
            'api.': ContentType.DOCUMENTATION,

            # Code repositories
            'github.com': ContentType.CODE_REPOSITORY,
            'gitlab.com': ContentType.CODE_REPOSITORY,
            'bitbucket.org': ContentType.CODE_REPOSITORY,

            # Blogs and news
            'blog': ContentType.BLOG,
            'medium.com': ContentType.BLOG,
            'dev.to': ContentType.BLOG,
            'news': ContentType.NEWS_ARTICLE,

            # Academic
            'arxiv.org': ContentType.ACADEMIC_PAPER,
            'scholar.google': ContentType.ACADEMIC_PAPER,
            'research': ContentType.ACADEMIC_PAPER,

            # Tutorials
            'tutorial': ContentType.TUTORIAL,
            'guide': ContentType.TUTORIAL,
            'learn': ContentType.TUTORIAL,

            # Forums
            'stackoverflow': ContentType.FORUM_DISCUSSION,
            'reddit.com': ContentType.FORUM_DISCUSSION,
            'forum': ContentType.FORUM_DISCUSSION,
        }


# Global service instance
content_strategy_service = ContentStrategyService()