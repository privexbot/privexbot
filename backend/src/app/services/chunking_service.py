"""
Chunking Service - Split documents into chunks for embedding.

WHY:
- Documents too large for single embedding
- Need semantic chunks for retrieval
- Different strategies for different content types
- Overlap for context preservation

HOW:
- Recursive character splitting
- Sentence-based splitting
- Token-aware chunking
- Semantic chunking with configurable threshold
- Preserve metadata per chunk

CONFIGURATION:
- All thresholds and parameters are configurable
- Backward compatible defaults match previous hardcoded values
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from dataclasses import dataclass, field
import re

from sqlalchemy.orm import Session


# ============================================================================
# CONFIGURATION
# ============================================================================

@dataclass
class ChunkingConfig:
    """
    Chunking configuration with sensible defaults.

    All parameters are configurable per-request or globally.
    Default values maintain backward compatibility.
    """

    # Semantic chunking configuration
    semantic_threshold: float = 0.65  # Topic change threshold (0.0-1.0, lower = more splits)
    semantic_min_paragraph_length: int = 20  # Min chars for paragraph to be considered

    # Adaptive chunking thresholds
    adaptive_heading_density_threshold: float = 0.05  # >5% headings triggers by_heading
    adaptive_paragraph_count_threshold: int = 10  # >10 paragraphs triggers paragraph_based

    # Size constraints
    default_chunk_size: int = 1000
    default_chunk_overlap: int = 200
    min_chunk_size: int = 50  # Chunks smaller than this are merged or dropped
    max_chunk_size_multiplier: float = 1.5  # For hybrid/adaptive overflow handling

    # Token estimation
    chars_per_token: int = 4  # Approximate chars per token for estimation

    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary for serialization."""
        return {
            "semantic_threshold": self.semantic_threshold,
            "semantic_min_paragraph_length": self.semantic_min_paragraph_length,
            "adaptive_heading_density_threshold": self.adaptive_heading_density_threshold,
            "adaptive_paragraph_count_threshold": self.adaptive_paragraph_count_threshold,
            "default_chunk_size": self.default_chunk_size,
            "default_chunk_overlap": self.default_chunk_overlap,
            "min_chunk_size": self.min_chunk_size,
            "max_chunk_size_multiplier": self.max_chunk_size_multiplier,
            "chars_per_token": self.chars_per_token
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChunkingConfig":
        """Create config from dictionary, using defaults for missing values."""
        return cls(
            semantic_threshold=data.get("semantic_threshold", 0.65),
            semantic_min_paragraph_length=data.get("semantic_min_paragraph_length", 20),
            adaptive_heading_density_threshold=data.get("adaptive_heading_density_threshold", 0.05),
            adaptive_paragraph_count_threshold=data.get("adaptive_paragraph_count_threshold", 10),
            default_chunk_size=data.get("default_chunk_size", 1000),
            default_chunk_overlap=data.get("default_chunk_overlap", 200),
            min_chunk_size=data.get("min_chunk_size", 50),
            max_chunk_size_multiplier=data.get("max_chunk_size_multiplier", 1.5),
            chars_per_token=data.get("chars_per_token", 4)
        )


# Global default configuration (can be overridden per-request)
DEFAULT_CHUNKING_CONFIG = ChunkingConfig()


class ChunkingService:
    """
    Document chunking with multiple strategies.

    WHY: Split documents into embeddable chunks
    HOW: Strategy pattern for different chunking methods

    CONFIGURATION:
    - Pass config dict to chunk_document() for per-request configuration
    - Or set self.config for instance-level defaults
    - All parameters have backward-compatible defaults
    """

    def __init__(self, config: Optional[ChunkingConfig] = None):
        """
        Initialize chunking service with optional configuration.

        Args:
            config: ChunkingConfig instance (uses defaults if not provided)
        """
        self.config = config or DEFAULT_CHUNKING_CONFIG

    def chunk_document(
        self,
        text: str,
        strategy: str = "recursive",
        chunk_size: int = None,
        chunk_overlap: int = None,
        separators: Optional[List[str]] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> List[dict]:
        """
        Chunk document text.

        WHY: Split text into manageable pieces
        HOW: Use specified strategy with configurable parameters

        ARGS:
            text: Document text to chunk
            strategy: "recursive" | "sentence_based" | "token" | "semantic" | "by_heading" | "by_section" | "adaptive" | "paragraph_based" | "hybrid"
            chunk_size: Target chunk size (None = use config default)
            chunk_overlap: Overlap between chunks (None = use config default)
            separators: Custom separators (for recursive)
            config: Optional config dict to override defaults (e.g., {"semantic_threshold": 0.7})

        RETURNS:
            [
                {
                    "content": "Chunk text...",
                    "index": 0,
                    "start_pos": 0,
                    "end_pos": 1000,
                    "token_count": 250,
                    "metadata": {...}
                }
            ]
        """

        # Merge request-level config with instance config
        effective_config = self._get_effective_config(config)

        # Resolve defaults from config
        chunk_size = chunk_size if chunk_size is not None else effective_config.default_chunk_size
        chunk_overlap = chunk_overlap if chunk_overlap is not None else effective_config.default_chunk_overlap

        if strategy == "recursive":
            return self._recursive_chunk(text, chunk_size, chunk_overlap, separators)

        elif strategy in ("sentence", "sentence_based", "by_sentence"):
            return self._sentence_chunk(text, chunk_size, chunk_overlap)

        elif strategy in ("no_chunking", "full_content"):
            return self._full_content_chunk(text)

        elif strategy == "token":
            return self._token_chunk(text, chunk_size, chunk_overlap, effective_config)

        elif strategy == "semantic":
            return self._semantic_chunk(text, chunk_size, chunk_overlap, effective_config)

        elif strategy in ("by_heading", "heading"):
            return self._heading_chunk(text, chunk_size, chunk_overlap)

        elif strategy in ("by_section", "section"):
            return self._section_chunk(text, chunk_size, chunk_overlap)

        elif strategy in ("paragraph_based", "by_paragraph"):
            return self._paragraph_chunk(text, chunk_size, chunk_overlap)

        elif strategy == "adaptive":
            return self._adaptive_chunk(text, chunk_size, chunk_overlap, effective_config)

        elif strategy == "hybrid":
            return self._hybrid_chunk(text, chunk_size, chunk_overlap, effective_config)

        elif strategy == "custom":
            return self._custom_chunk(text, chunk_size, chunk_overlap, separators)

        else:
            raise ValueError(f"Unknown chunking strategy: {strategy}")

    def _get_effective_config(self, request_config: Optional[Dict[str, Any]]) -> ChunkingConfig:
        """
        Merge request-level config with instance config.

        Priority: request_config > self.config > DEFAULT_CHUNKING_CONFIG
        """
        if not request_config:
            return self.config

        # Create a merged config
        base_dict = self.config.to_dict()
        base_dict.update(request_config)
        return ChunkingConfig.from_dict(base_dict)

    @staticmethod
    def validate_chunking_config(config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and sanitize chunking configuration values.

        WHY: Prevent invalid configurations from causing errors
        HOW: Check types, ranges, and allowed values; return sanitized config

        ARGS:
            config: Raw chunking_config from KB or caller

        RETURNS:
            Sanitized config with invalid values corrected to defaults

        VALIDATION RULES:
            - strategy: str, must be in allowed strategies
            - chunk_size: int, 100-10000 (default: 1000)
            - chunk_overlap: int, 0-2000 (default: 200)
            - semantic_threshold: float, 0.0-1.0 (default: 0.65)
            - min_chunk_size: int, 10-500 (default: 50)
        """
        if not config:
            return {}

        # Define validation constraints
        constraints = {
            "strategy": {
                "type": str,
                "allowed": [
                    "recursive", "semantic", "by_heading", "by_section",
                    "adaptive", "sentence_based", "paragraph_based", "hybrid",
                    "no_chunking", "full_content", "token", "custom"
                ]
            },
            "chunk_size": {"type": int, "min": 100, "max": 10000},
            "chunk_overlap": {"type": int, "min": 0, "max": 2000},
            "semantic_threshold": {"type": (int, float), "min": 0.0, "max": 1.0},
            "semantic_min_paragraph_length": {"type": int, "min": 5, "max": 500},
            "adaptive_heading_density_threshold": {"type": (int, float), "min": 0.0, "max": 1.0},
            "adaptive_paragraph_count_threshold": {"type": int, "min": 1, "max": 100},
            "min_chunk_size": {"type": int, "min": 10, "max": 500},
            "max_chunk_size_multiplier": {"type": (int, float), "min": 1.0, "max": 3.0},
            "chars_per_token": {"type": int, "min": 2, "max": 10},
        }

        validated = {}
        warnings = []

        for key, value in config.items():
            if key not in constraints:
                # Unknown key - pass through (forward compatibility)
                validated[key] = value
                continue

            constraint = constraints[key]
            expected_type = constraint.get("type")

            # Type check
            if expected_type and not isinstance(value, expected_type):
                warnings.append(f"{key}: expected {expected_type}, got {type(value).__name__}")
                continue  # Skip invalid type

            # Range check for numeric values
            if "min" in constraint and value < constraint["min"]:
                warnings.append(f"{key}: {value} < min {constraint['min']}, using min")
                value = constraint["min"]
            if "max" in constraint and value > constraint["max"]:
                warnings.append(f"{key}: {value} > max {constraint['max']}, using max")
                value = constraint["max"]

            # Allowed values check
            if "allowed" in constraint and value not in constraint["allowed"]:
                warnings.append(f"{key}: '{value}' not in allowed values, skipping")
                continue  # Skip invalid value

            validated[key] = value

        # Cross-field validation: overlap must be < chunk_size
        if "chunk_size" in validated and "chunk_overlap" in validated:
            if validated["chunk_overlap"] >= validated["chunk_size"]:
                warnings.append(f"chunk_overlap ({validated['chunk_overlap']}) >= chunk_size ({validated['chunk_size']}), adjusting")
                validated["chunk_overlap"] = int(validated["chunk_size"] * 0.2)  # Default to 20%

        if warnings:
            print(f"[ChunkingService] Config validation warnings: {warnings}")

        return validated

    @staticmethod
    def get_available_strategies() -> List[Dict[str, Any]]:
        """
        Get list of available chunking strategies with descriptions.

        Returns:
            List of strategy info dicts
        """
        return [
            {"value": "recursive", "name": "Recursive", "description": "Split by separators recursively", "best_for": "General content"},
            {"value": "semantic", "name": "Semantic", "description": "Split by topic boundaries", "best_for": "Q&A, retrieval"},
            {"value": "by_heading", "name": "By Heading", "description": "Split at markdown headings", "best_for": "Documentation"},
            {"value": "by_section", "name": "By Section", "description": "Group into logical sections", "best_for": "Technical guides"},
            {"value": "adaptive", "name": "Adaptive", "description": "Auto-select based on content", "best_for": "Mixed content"},
            {"value": "sentence_based", "name": "Sentence-Based", "description": "Split at sentences", "best_for": "Chat logs"},
            {"value": "paragraph_based", "name": "Paragraph-Based", "description": "Split at paragraphs", "best_for": "Articles"},
            {"value": "hybrid", "name": "Hybrid", "description": "Combines multiple strategies", "best_for": "Complex documents"},
            {"value": "no_chunking", "name": "No Chunking", "description": "Keep as single chunk", "best_for": "Short documents"},
            {"value": "full_content", "name": "Full Content", "description": "Alias for no_chunking", "best_for": "Short documents"},
            {"value": "token", "name": "Token-Based", "description": "Split by token count", "best_for": "LLM context windows"},
        ]

    def _recursive_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
        separators: Optional[List[str]] = None
    ) -> List[dict]:
        """
        Recursive character-based chunking.

        WHY: Most versatile strategy
        HOW: Try separators in order (paragraphs → sentences → words)

        DEFAULT SEPARATORS:
        1. Double newline (paragraphs)
        2. Single newline (lines)
        3. Space (words)
        4. Empty string (character level) - handled specially
        """

        if separators is None:
            separators = ["\n\n", "\n", " ", ""]

        # Filter out empty separators except the last one (for character splitting)
        valid_separators = [sep for sep in separators if sep]

        # If we've exhausted all separators or only have empty separators, do character-level splitting
        if not valid_separators:
            chunks = []
            chunk_index = 0
            for i in range(0, len(text), chunk_size - chunk_overlap):
                chunk_text = text[i:i + chunk_size]
                if chunk_text.strip():  # Only add non-empty chunks
                    chunks.append(self._create_chunk_metadata(chunk_text, chunk_index))
                    chunk_index += 1
            return chunks

        # Use the first valid separator
        current_separator = valid_separators[0]
        remaining_separators = valid_separators[1:] + [""]  # Add empty string at the end for final character splitting

        chunks = []
        current_chunk = ""
        chunk_index = 0

        # Split by current separator
        splits = text.split(current_separator)

        for split in splits:
            # Calculate size with separator
            separator_size = len(current_separator) if current_chunk else 0

            # If split fits in current chunk
            if len(current_chunk) + len(split) + separator_size <= chunk_size:
                if current_chunk:
                    current_chunk += current_separator + split
                else:
                    current_chunk = split

            # If split itself is larger than chunk size
            elif len(split) > chunk_size:
                # Save current chunk
                if current_chunk:
                    chunks.append(self._create_chunk_metadata(
                        current_chunk,
                        chunk_index
                    ))
                    chunk_index += 1
                    current_chunk = ""

                # Recursively chunk the large split
                if remaining_separators:
                    sub_chunks = self._recursive_chunk(
                        split,
                        chunk_size,
                        chunk_overlap,
                        remaining_separators
                    )
                    for sub_chunk in sub_chunks:
                        sub_chunk["index"] = chunk_index
                        chunks.append(sub_chunk)
                        chunk_index += 1
                else:
                    # Force split at character level (fallback)
                    for i in range(0, len(split), chunk_size - chunk_overlap):
                        chunk_text = split[i:i + chunk_size]
                        if chunk_text.strip():
                            chunks.append(self._create_chunk_metadata(chunk_text, chunk_index))
                            chunk_index += 1

            # Start new chunk
            else:
                if current_chunk:
                    chunks.append(self._create_chunk_metadata(
                        current_chunk,
                        chunk_index
                    ))
                    chunk_index += 1

                # Start with overlap from previous chunk
                if current_chunk and chunk_overlap > 0:
                    overlap_start = max(0, len(current_chunk) - chunk_overlap)
                    current_chunk = current_chunk[overlap_start:] + current_separator + split
                else:
                    current_chunk = split

        # Save final chunk
        if current_chunk and current_chunk.strip():
            chunks.append(self._create_chunk_metadata(
                current_chunk,
                chunk_index
            ))

        return chunks


    def _sentence_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[dict]:
        """
        Sentence-based chunking.

        WHY: Preserve sentence boundaries
        HOW: Split by sentences, group into chunks
        """

        # Simple sentence splitting (production would use NLTK or spaCy)
        sentences = re.split(r'[.!?]+\s+', text)

        chunks = []
        current_chunk = ""
        chunk_index = 0

        for sentence in sentences:
            if len(current_chunk) + len(sentence) <= chunk_size:
                current_chunk += sentence + ". "
            else:
                if current_chunk:
                    chunks.append(self._create_chunk_metadata(
                        current_chunk.strip(),
                        chunk_index
                    ))
                    chunk_index += 1

                current_chunk = sentence + ". "

        # Save final chunk
        if current_chunk:
            chunks.append(self._create_chunk_metadata(
                current_chunk.strip(),
                chunk_index
            ))

        return chunks


    def _token_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
        config: ChunkingConfig = None
    ) -> List[dict]:
        """
        Token-aware chunking.

        WHY: Respect token limits for embeddings
        HOW: Estimate tokens, chunk accordingly

        TOKEN ESTIMATION:
        - Configurable chars_per_token (default ~4)
        - Production would use tiktoken for exact counts
        """
        config = config or self.config

        # Use configurable chars per token
        char_per_token = config.chars_per_token
        chunk_size_chars = chunk_size * char_per_token
        chunk_overlap_chars = chunk_overlap * char_per_token

        # Use recursive chunking with token-adjusted sizes
        return self._recursive_chunk(
            text,
            chunk_size_chars,
            chunk_overlap_chars
        )


    def _paragraph_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[dict]:
        """
        Paragraph-based chunking.

        WHY: Preserve paragraph boundaries for better context
        HOW: Split by double newlines (paragraphs), group into chunks
        OPTIMIZED FOR: Documentation, articles, blogs
        """
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        chunks = []
        current_chunk = ""
        chunk_index = 0

        for paragraph in paragraphs:
            if len(current_chunk) + len(paragraph) + 2 <= chunk_size:
                current_chunk += paragraph + "\n\n"
            else:
                if current_chunk:
                    chunks.append(self._create_chunk_metadata(
                        current_chunk.strip(),
                        chunk_index
                    ))
                    chunk_index += 1

                # Handle oversized paragraphs
                if len(paragraph) > chunk_size:
                    # Split oversized paragraph with sentence chunking
                    sub_chunks = self._sentence_chunk(paragraph, chunk_size, chunk_overlap)
                    for sub_chunk in sub_chunks:
                        sub_chunk["index"] = chunk_index
                        chunks.append(sub_chunk)
                        chunk_index += 1
                    current_chunk = ""
                else:
                    current_chunk = paragraph + "\n\n"

        if current_chunk:
            chunks.append(self._create_chunk_metadata(
                current_chunk.strip(),
                chunk_index
            ))

        return chunks


    def _heading_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[dict]:
        """
        Heading-based chunking for structured documents.

        WHY: Maintain logical document structure
        HOW: Split at markdown heading boundaries (# ## ### ####)
        OPTIMIZED FOR: Documentation sites (GitBook, GitHub docs, Notion)
        """
        chunks = []
        current_chunk = ""
        current_heading = None
        chunk_index = 0

        # Split by lines and detect headings
        lines = text.split("\n")

        for line in lines:
            # Detect markdown headings
            is_heading = line.strip().startswith("#") and line.strip().split()[0] in ["#", "##", "###", "####", "#####", "######"]

            if is_heading and current_chunk and len(current_chunk) > 100:
                # Save current chunk
                chunks.append(self._create_chunk_metadata(
                    current_chunk.strip(),
                    chunk_index
                ))
                chunk_index += 1
                current_chunk = line + "\n"
                current_heading = line
            else:
                current_chunk += line + "\n"

                # Check if chunk is getting too large
                if len(current_chunk) > chunk_size:
                    chunks.append(self._create_chunk_metadata(
                        current_chunk.strip(),
                        chunk_index
                    ))
                    chunk_index += 1
                    current_chunk = ""

        if current_chunk:
            chunks.append(self._create_chunk_metadata(
                current_chunk.strip(),
                chunk_index
            ))

        return chunks


    def _section_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[dict]:
        """
        Section-based chunking.

        WHY: Group related content into logical sections
        HOW: Detect sections by headings + blank lines, then chunk within sections
        OPTIMIZED FOR: Long-form documentation, technical guides
        """
        # Similar to heading-based but more aggressive at detecting section boundaries
        chunks = []
        current_section = ""
        chunk_index = 0

        # Split by double newline and headings
        paragraphs = text.split("\n\n")

        for paragraph in paragraphs:
            # Check if this is a section boundary (heading or significant blank space)
            is_section_boundary = (
                paragraph.strip().startswith("#") or
                len(paragraph.strip()) < 10 or
                paragraph.strip().isupper()  # All caps headings
            )

            if is_section_boundary and current_section and len(current_section) > 200:
                # Save current section
                chunks.append(self._create_chunk_metadata(
                    current_section.strip(),
                    chunk_index
                ))
                chunk_index += 1
                current_section = paragraph + "\n\n"
            else:
                current_section += paragraph + "\n\n"

                # Split if section gets too large
                if len(current_section) > chunk_size * 1.5:
                    chunks.append(self._create_chunk_metadata(
                        current_section.strip(),
                        chunk_index
                    ))
                    chunk_index += 1
                    current_section = ""

        if current_section:
            chunks.append(self._create_chunk_metadata(
                current_section.strip(),
                chunk_index
            ))

        return chunks


    def _semantic_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
        config: ChunkingConfig = None
    ) -> List[dict]:
        """
        Semantic chunking based on topic boundaries using embedding similarity.

        WHY: Group semantically related content together
        HOW: Use embedding similarity to detect topic changes
        OPTIMIZED FOR: Q&A, retrieval, unstructured content

        CONFIGURATION:
        - semantic_threshold: Topic change detection threshold (0.0-1.0, lower = more splits)
        - semantic_min_paragraph_length: Minimum paragraph length to consider

        ALGORITHM:
        1. Split text into sentences/paragraphs
        2. Generate embeddings for each segment
        3. Calculate cosine similarity between consecutive segments
        4. Detect topic boundaries when similarity drops below threshold
        5. Group similar segments into chunks
        """
        config = config or self.config

        try:
            from app.services.embedding_service_local import embedding_service
            import numpy as np

            # Use configurable minimum paragraph length
            min_para_length = config.semantic_min_paragraph_length

            # Split into paragraphs (more stable than sentences for semantic analysis)
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip() and len(p.strip()) > min_para_length]

            if not paragraphs:
                return []

            # If only one paragraph, return it
            if len(paragraphs) == 1:
                return [self._create_chunk_metadata(paragraphs[0], 0)]

            # Generate embeddings for each paragraph
            import asyncio
            embeddings = []
            # Batch process all paragraphs at once to avoid event loop issues
            try:
                # Try to detect if we're in an async context
                try:
                    current_loop = asyncio.get_running_loop()
                    # We're in an async context, need to create a new thread
                    import concurrent.futures

                    def sync_generate_embeddings():
                        # Run in a new thread with its own event loop
                        new_loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(new_loop)
                        try:
                            return new_loop.run_until_complete(
                                embedding_service.generate_embeddings(paragraphs)
                            )
                        finally:
                            new_loop.close()

                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(sync_generate_embeddings)
                        emb_results = future.result()

                except RuntimeError:
                    # No running loop, we can use asyncio.run directly
                    emb_results = asyncio.run(embedding_service.generate_embeddings(paragraphs))

                # Process results - get dimension from embedding service
                embedding_dim = embedding_service.get_embedding_dimension()

                for i, para in enumerate(paragraphs):
                    if emb_results and i < len(emb_results) and emb_results[i] is not None:
                        embeddings.append(np.array(emb_results[i]))
                    else:
                        # Fallback: use zero vector if embedding fails
                        embeddings.append(np.zeros(embedding_dim))

            except Exception as e:
                # Final fallback: use zero vectors for all paragraphs
                print(f"[ChunkingService] Batch embedding generation failed: {e}")
                embedding_dim = 384  # Default dimension
                embeddings = [np.zeros(embedding_dim) for _ in paragraphs]

            # Calculate similarity between consecutive paragraphs
            similarities = []
            for i in range(len(embeddings) - 1):
                similarity = self._cosine_similarity(embeddings[i], embeddings[i + 1])
                similarities.append(similarity)

            # Use configurable threshold for topic boundary detection
            # Lower similarity = topic change
            similarity_threshold = config.semantic_threshold

            # Group paragraphs into chunks based on semantic similarity
            chunks = []
            current_chunk_paras = [paragraphs[0]]
            current_chunk_size = len(paragraphs[0])
            chunk_index = 0

            for i in range(len(similarities)):
                next_para = paragraphs[i + 1]
                next_para_size = len(next_para)

                # Check if we should start a new chunk
                should_break = False

                # Reason 1: Topic change detected (low similarity)
                if similarities[i] < similarity_threshold:
                    should_break = True

                # Reason 2: Current chunk would exceed max size (using configurable multiplier)
                elif current_chunk_size + next_para_size > chunk_size * config.max_chunk_size_multiplier:
                    should_break = True

                if should_break and current_chunk_paras:
                    # Create chunk from accumulated paragraphs
                    chunk_content = "\n\n".join(current_chunk_paras)
                    chunks.append(self._create_chunk_metadata(chunk_content, chunk_index))
                    chunk_index += 1

                    # Start new chunk with overlap if needed
                    if chunk_overlap > 0 and len(current_chunk_paras) > 0:
                        # Include last paragraph for context continuity
                        current_chunk_paras = [current_chunk_paras[-1], next_para]
                        current_chunk_size = len(current_chunk_paras[-1]) + next_para_size
                    else:
                        current_chunk_paras = [next_para]
                        current_chunk_size = next_para_size
                else:
                    # Add to current chunk
                    current_chunk_paras.append(next_para)
                    current_chunk_size += next_para_size + 2  # +2 for \n\n

            # Add final chunk
            if current_chunk_paras:
                chunk_content = "\n\n".join(current_chunk_paras)
                chunks.append(self._create_chunk_metadata(chunk_content, chunk_index))

            return chunks

        except Exception as e:
            # Fallback to paragraph-based chunking if semantic chunking fails
            print(f"Semantic chunking error: {e}, falling back to paragraph-based chunking")
            return self._paragraph_chunk(text, chunk_size, chunk_overlap)


    def _cosine_similarity(self, vec1, vec2):
        """
        Calculate cosine similarity between two vectors.

        WHY: Measure semantic similarity between text segments
        HOW: Dot product divided by magnitudes

        Returns:
            Float between -1 and 1 (higher = more similar)
        """
        import numpy as np

        # Normalize vectors
        vec1_norm = np.linalg.norm(vec1)
        vec2_norm = np.linalg.norm(vec2)

        if vec1_norm == 0 or vec2_norm == 0:
            return 0.0

        # Calculate cosine similarity
        similarity = np.dot(vec1, vec2) / (vec1_norm * vec2_norm)

        return float(similarity)


    def _adaptive_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
        config: ChunkingConfig = None
    ) -> List[dict]:
        """
        Adaptive chunking that selects best strategy based on content.

        WHY: Automatically optimize for different document types
        HOW: Analyze text structure and choose appropriate strategy

        CONFIGURATION:
        - adaptive_heading_density_threshold: Threshold for heading strategy (default 5%)
        - adaptive_paragraph_count_threshold: Threshold for paragraph strategy (default 10)

        DECISION LOGIC:
        - High heading density (>threshold) → by_heading
        - Many paragraphs (>threshold) → paragraph_based
        - Mixed content → hybrid
        - Fallback → recursive
        """
        config = config or self.config

        # Analyze document structure
        total_lines = len(text.split("\n"))
        heading_count = len([line for line in text.split("\n") if line.strip().startswith("#")])
        paragraph_count = len([p for p in text.split("\n\n") if p.strip()])

        heading_density = heading_count / total_lines if total_lines > 0 else 0

        print(f"[AdaptiveChunking] Analysis - lines: {total_lines}, headings: {heading_count}, paragraphs: {paragraph_count}, heading_density: {heading_density:.3f}")

        # Use configurable thresholds for decision logic
        heading_threshold = config.adaptive_heading_density_threshold
        paragraph_threshold = config.adaptive_paragraph_count_threshold

        # Decision logic with configurable thresholds
        if heading_density > heading_threshold:
            print(f"[AdaptiveChunking] Using by_heading strategy (heading_density: {heading_density:.3f} > {heading_threshold})")
            return self._heading_chunk(text, chunk_size, chunk_overlap)
        elif paragraph_count > paragraph_threshold:
            print(f"[AdaptiveChunking] Using paragraph_based strategy (paragraphs: {paragraph_count} > {paragraph_threshold})")
            return self._paragraph_chunk(text, chunk_size, chunk_overlap)
        elif heading_count > 0:
            print(f"[AdaptiveChunking] Using hybrid strategy (headings: {heading_count})")
            return self._hybrid_chunk(text, chunk_size, chunk_overlap, config)
        else:
            print(f"[AdaptiveChunking] Using recursive strategy (fallback)")
            return self._recursive_chunk(text, chunk_size, chunk_overlap, None)


    def _hybrid_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
        config: ChunkingConfig = None
    ) -> List[dict]:
        """
        Hybrid chunking combining multiple strategies.

        WHY: Get best of multiple approaches
        HOW: Primary chunking by structure, secondary by size

        CONFIGURATION:
        - max_chunk_size_multiplier: Multiplier for oversized chunk detection

        FLOW:
        1. Try heading-based chunking first
        2. For oversized chunks, apply paragraph splitting
        3. Final fallback to recursive splitting
        """
        config = config or self.config
        max_multiplier = config.max_chunk_size_multiplier

        # Step 1: Primary chunking by headings (allow larger initial chunks)
        primary_chunks = self._heading_chunk(text, int(chunk_size * max_multiplier), chunk_overlap)

        # Step 2: Refine oversized chunks
        refined_chunks = []
        for chunk in primary_chunks:
            if len(chunk["content"]) > chunk_size * max_multiplier:
                # Apply paragraph-based splitting
                sub_chunks = self._paragraph_chunk(
                    chunk["content"],
                    chunk_size,
                    chunk_overlap
                )
                refined_chunks.extend(sub_chunks)
            else:
                refined_chunks.append(chunk)

        # Step 3: Re-index chunks
        for i, chunk in enumerate(refined_chunks):
            chunk["index"] = i

        return refined_chunks


    def _full_content_chunk(self, text: str) -> List[dict]:
        """
        No chunking - return the full content as a single chunk.
        """
        if not text.strip():
            return []
        return [self._create_chunk_metadata(text.strip(), 0)]

    def _custom_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
        separators: Optional[List[str]] = None
    ) -> List[dict]:
        """
        Custom chunking with user-defined separators.
        """
        if not separators:
            return self._recursive_chunk(text, chunk_size, chunk_overlap)
        return self._recursive_chunk(text, chunk_size, chunk_overlap, separators)

    def _create_chunk_metadata(self, content: str, index: int) -> dict:
        """
        Create chunk metadata.

        WHY: Track chunk information
        HOW: Add index, position, token count, word count, character count
        """

        # Calculate statistics
        word_count = len(content.split()) if content else 0
        character_count = len(content) if content else 0
        estimated_tokens = len(content) // 4  # 4 chars ≈ 1 token

        return {
            "content": content,
            "index": index,
            "start_pos": 0,  # Would calculate actual position
            "end_pos": character_count,
            "token_count": estimated_tokens,
            "metadata": {
                "word_count": word_count,
                "chunk_length": character_count,  # Match enhanced_chunking_service naming
                "character_count": character_count
            }
        }


    def chunk_content(
        self,
        content: str,
        strategy: str = "recursive",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        preserve_code_blocks: bool = True
    ) -> List[str]:
        """
        Alias for chunk_document that returns just the content strings.

        WHY: Used by chunk preview endpoints
        HOW: Call chunk_document and extract content from metadata

        Returns:
            List of chunk content strings (not metadata objects)
        """
        chunks_data = self.chunk_document(
            text=content,
            strategy=strategy,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        # Extract just the content strings
        return [chunk_data["content"] for chunk_data in chunks_data]

    def create_chunks_for_document(
        self,
        db: Session,
        document_id: UUID,
        strategy: str = "recursive",
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> List[UUID]:
        """
        Create and save chunks for document.

        WHY: Persist chunks to database
        HOW: Chunk document, create Chunk records

        ARGS:
            db: Database session
            document_id: Document to chunk
            strategy: Chunking strategy
            chunk_size: Target chunk size
            chunk_overlap: Overlap between chunks

        RETURNS:
            List of created chunk IDs
        """

        from app.models.document import Document
        from app.models.chunk import Chunk

        # Get document
        document = db.query(Document).get(document_id)
        if not document:
            raise ValueError("Document not found")

        # Chunk text
        chunks = self.chunk_document(
            text=document.content,
            strategy=strategy,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

        # Create Chunk records
        chunk_ids = []
        for chunk_data in chunks:
            chunk = Chunk(
                document_id=document_id,
                kb_id=document.kb_id,
                content=chunk_data["content"],
                chunk_index=chunk_data["index"],
                metadata={
                    "token_count": chunk_data["token_count"],
                    "strategy": strategy,
                    "chunk_size": chunk_size
                }
            )

            db.add(chunk)
            db.flush()
            chunk_ids.append(chunk.id)

        db.commit()

        return chunk_ids


# Global instance
chunking_service = ChunkingService()
