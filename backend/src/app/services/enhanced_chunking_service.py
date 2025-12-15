"""
Enhanced chunking service with structure-aware strategies.

WHY: Better chunking improves retrieval accuracy and context preservation
HOW: Multiple chunking strategies that respect document structure
BUILDS ON: Existing chunking_service.py and smart_parsing_service.py

PSEUDOCODE:
-----------
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum
from .smart_parsing_service import DocumentElement, ElementType

class ChunkingStrategy(Enum):
    \"\"\"Available chunking strategies\"\"\"
    RECURSIVE = \"recursive\"              # Existing: Split by separators recursively
    SEMANTIC = \"semantic\"                # NEW: Split by semantic boundaries
    BY_HEADING = \"by_heading\"           # NEW: Split at heading boundaries
    BY_SECTION = \"by_section\"           # NEW: Split by detected sections
    ADAPTIVE = \"adaptive\"               # NEW: Adapt strategy to document type
    SENTENCE_BASED = \"sentence_based\"   # NEW: Split by sentences
    PARAGRAPH_BASED = \"paragraph_based\" # NEW: Split by paragraphs
    HYBRID = \"hybrid\"                   # NEW: Combine multiple strategies

@dataclass
class ChunkConfig:
    \"\"\"Comprehensive chunking configuration\"\"\"
    strategy: ChunkingStrategy
    max_chunk_size: int = 1000          # Characters
    chunk_overlap: int = 200            # Character overlap
    min_chunk_size: int = 100           # Minimum chunk size
    preserve_structure: bool = True     # Maintain element boundaries
    include_metadata: bool = True       # Include structural metadata
    adaptive_sizing: bool = False       # Adjust size based on content type
    context_window: int = 2             # Number of surrounding elements for context

@dataclass
class DocumentChunk:
    \"\"\"Enhanced chunk with structure and context\"\"\"
    content: str
    metadata: Dict
    position: int
    element_type: Optional[ElementType] = None
    parent_heading: Optional[str] = None
    context_before: Optional[str] = None
    context_after: Optional[str] = None
    embedding: Optional[List[float]] = None

class EnhancedChunkingService:
    \"\"\"
    Structure-aware document chunking that preserves context.

    BUILDS ON: Existing chunking_service.py patterns
    ENHANCES: Context preservation, adaptive strategies, intelligent splitting
    \"\"\"

    def __init__(self, smart_parser):
        self.smart_parser = smart_parser

        # Strategy implementations
        self.strategies = {
            ChunkingStrategy.RECURSIVE: self._recursive_chunking,
            ChunkingStrategy.SEMANTIC: self._semantic_chunking,
            ChunkingStrategy.BY_HEADING: self._heading_based_chunking,
            ChunkingStrategy.BY_SECTION: self._section_based_chunking,
            ChunkingStrategy.ADAPTIVE: self._adaptive_chunking,
            ChunkingStrategy.SENTENCE_BASED: self._sentence_based_chunking,
            ChunkingStrategy.PARAGRAPH_BASED: self._paragraph_based_chunking,
            ChunkingStrategy.HYBRID: self._hybrid_chunking
        }

    async def chunk_document(
        self,
        document_content: str,
        source_type: str,
        chunk_config: ChunkConfig,
        parse_config: Optional[Dict] = None
    ) -> List[DocumentChunk]:
        \"\"\"
        Intelligent document chunking with structure preservation.

        FLOW:
        1. Parse document into structured elements
        2. Apply selected chunking strategy
        3. Add context and metadata
        4. Validate and optimize chunks

        BUILDS ON: Existing chunking patterns while adding structure awareness
        \"\"\"

        # Step 1: Parse document structure
        if parse_config is None:
            parse_config = {\"preserve_hierarchy\": True, \"detect_sections\": True}

        elements = await self.smart_parser.parse_document(
            document_content, source_type, parse_config
        )

        # Step 2: Apply chunking strategy
        strategy_func = self.strategies.get(chunk_config.strategy, self._recursive_chunking)
        chunks = await strategy_func(elements, chunk_config)

        # Step 3: Add context and enhance metadata
        enhanced_chunks = self._add_context_to_chunks(chunks, elements, chunk_config)

        # Step 4: Validate and optimize
        optimized_chunks = self._optimize_chunks(enhanced_chunks, chunk_config)

        return optimized_chunks

    async def _heading_based_chunking(
        self,
        elements: List[DocumentElement],
        config: ChunkConfig
    ) -> List[DocumentChunk]:
        \"\"\"
        Chunk document by heading boundaries.

        STRATEGY: Create chunks that start with headings and include all content
        until the next heading of same or higher level.

        BENEFITS:
        - Preserves logical document structure
        - Maintains context within sections
        - Ideal for documentation and articles

        PROCESS:
        1. Iterate through elements
        2. Start new chunk at each heading
        3. Include all content until next heading
        4. Split large chunks if needed
        \"\"\"

        chunks = []
        current_chunk_elements = []
        current_heading = None

        heading_types = {ElementType.HEADING_1, ElementType.HEADING_2,
                        ElementType.HEADING_3, ElementType.HEADING_4}

        for element in elements:
            if element.type in heading_types:
                # Start new chunk if we have content
                if current_chunk_elements:
                    chunk = self._create_chunk_from_elements(
                        current_chunk_elements, current_heading, config
                    )
                    if chunk:
                        chunks.append(chunk)

                # Start new chunk with this heading
                current_chunk_elements = [element]
                current_heading = element.content

            else:
                current_chunk_elements.append(element)

                # Check if chunk is getting too large
                current_size = sum(len(e.content) for e in current_chunk_elements)
                if current_size > config.max_chunk_size:
                    # Split the current chunk
                    chunk = self._create_chunk_from_elements(
                        current_chunk_elements[:-1], current_heading, config
                    )
                    if chunk:
                        chunks.append(chunk)

                    # Start new chunk with last element
                    current_chunk_elements = [current_chunk_elements[-1]]

        # Handle remaining elements
        if current_chunk_elements:
            chunk = self._create_chunk_from_elements(
                current_chunk_elements, current_heading, config
            )
            if chunk:
                chunks.append(chunk)

        return chunks

    async def _semantic_chunking(
        self,
        elements: List[DocumentElement],
        config: ChunkConfig
    ) -> List[DocumentChunk]:
        \"\"\"
        Chunk document by semantic boundaries.

        STRATEGY: Use NLP to detect topic changes and semantic breaks.
        Groups related content together regardless of structure.

        BENEFITS:
        - Maintains semantic coherence
        - Better for Q&A and retrieval
        - Handles poorly structured documents

        PROCESS:
        1. Generate embeddings for paragraphs
        2. Calculate semantic similarity between adjacent paragraphs
        3. Split when similarity drops below threshold
        4. Merge small chunks with similar content
        \"\"\"

        try:
            chunks = []
            current_elements = []
            current_topic_embedding = None

            for element in elements:
                if element.type == ElementType.PARAGRAPH:
                    # Get embedding for this paragraph
                    element_embedding = await self._get_semantic_embedding(element.content)

                    if current_topic_embedding is None:
                        current_topic_embedding = element_embedding
                        current_elements = [element]
                    else:
                        # Calculate semantic similarity
                        similarity = self._calculate_similarity(current_topic_embedding, element_embedding)

                        if similarity < 0.7:  # Topic change threshold
                            # Create chunk from current elements
                            if current_elements:
                                chunk = self._create_chunk_from_elements(current_elements, None, config)
                                if chunk:
                                    chunks.append(chunk)

                            # Start new topic
                            current_elements = [element]
                            current_topic_embedding = element_embedding
                        else:
                            current_elements.append(element)

                            # Update topic embedding (moving average)
                            current_topic_embedding = self._update_topic_embedding(
                                current_topic_embedding, element_embedding
                            )
                else:
                    # Non-paragraph elements (headings, lists, etc.)
                    current_elements.append(element)

            # Handle remaining elements
            if current_elements:
                chunk = self._create_chunk_from_elements(current_elements, None, config)
                if chunk:
                    chunks.append(chunk)

            return chunks

        except Exception as e:
            # Fallback to heading-based chunking
            return await self._heading_based_chunking(elements, config)

    async def _adaptive_chunking(
        self,
        elements: List[DocumentElement],
        config: ChunkConfig
    ) -> List[DocumentChunk]:
        \"\"\"
        Adaptive chunking that selects best strategy based on document characteristics.

        STRATEGY: Analyze document structure and content to choose optimal chunking approach.

        DECISION TREE:
        - High heading density → heading_based
        - Low structure, high text → semantic
        - Lists and tables → paragraph_based
        - Code content → preserve_structure

        PROCESS:
        1. Analyze document characteristics
        2. Select optimal strategy based on analysis
        3. Apply chosen strategy with optimized config
        4. Add adaptive metadata for tracking
        \"\"\"

        # Analyze document characteristics
        doc_stats = self._analyze_document_structure(elements)

        # Decision logic based on document characteristics
        if doc_stats[\"heading_density\"] > 0.1:  # > 10% headings
            chosen_strategy = ChunkingStrategy.BY_HEADING
        elif doc_stats[\"table_density\"] > 0.2:  # > 20% tables/lists
            chosen_strategy = ChunkingStrategy.PARAGRAPH_BASED
        elif doc_stats[\"avg_paragraph_length\"] > 500:  # Long paragraphs
            chosen_strategy = ChunkingStrategy.SEMANTIC
        elif doc_stats[\"code_density\"] > 0.1:  # > 10% code
            chosen_strategy = ChunkingStrategy.PARAGRAPH_BASED
        else:
            chosen_strategy = ChunkingStrategy.RECURSIVE  # Fallback

        # Apply chosen strategy with adapted config
        adapted_config = ChunkConfig(
            strategy=chosen_strategy,
            max_chunk_size=config.max_chunk_size,
            chunk_overlap=config.chunk_overlap,
            preserve_structure=True,  # Always preserve structure in adaptive mode
            include_metadata=True,
            adaptive_sizing=True
        )

        strategy_func = self.strategies[chosen_strategy]
        chunks = await strategy_func(elements, adapted_config)

        # Add adaptive metadata
        for chunk in chunks:
            chunk.metadata[\"adaptive_strategy_used\"] = chosen_strategy.value
            chunk.metadata[\"document_characteristics\"] = doc_stats

        return chunks

    async def _hybrid_chunking(
        self,
        elements: List[DocumentElement],
        config: ChunkConfig
    ) -> List[DocumentChunk]:
        \"\"\"
        Hybrid chunking that combines multiple strategies for optimal results.

        STRATEGY:
        1. Primary chunking by headings/sections
        2. Secondary semantic splitting for large chunks
        3. Tertiary size-based splitting as fallback

        PROCESS:
        1. Apply heading-based chunking first
        2. For oversized chunks, apply semantic splitting
        3. Final size validation and force-splitting
        4. Merge overly small chunks
        \"\"\"

        # Step 1: Primary chunking by structure
        primary_chunks = await self._heading_based_chunking(elements, config)

        # Step 2: Secondary semantic splitting for oversized chunks
        refined_chunks = []
        for chunk in primary_chunks:
            if len(chunk.content) > config.max_chunk_size * 1.5:
                # This chunk is too large, apply semantic splitting
                chunk_elements = self._chunk_content_to_elements(chunk.content)
                semantic_config = ChunkConfig(
                    strategy=ChunkingStrategy.SEMANTIC,
                    max_chunk_size=config.max_chunk_size,
                    chunk_overlap=config.chunk_overlap
                )
                sub_chunks = await self._semantic_chunking(chunk_elements, semantic_config)
                refined_chunks.extend(sub_chunks)
            else:
                refined_chunks.append(chunk)

        # Step 3: Final size validation and splitting
        final_chunks = []
        for chunk in refined_chunks:
            if len(chunk.content) > config.max_chunk_size:
                # Force split by size
                sub_chunks = self._force_split_by_size(chunk, config)
                final_chunks.extend(sub_chunks)
            else:
                final_chunks.append(chunk)

        return final_chunks

    async def _paragraph_based_chunking(
        self,
        elements: List[DocumentElement],
        config: ChunkConfig
    ) -> List[DocumentChunk]:
        \"\"\"
        Chunk by paragraph boundaries.

        STRATEGY: Each paragraph or logical unit becomes a chunk
        Good for content with clear paragraph structure
        \"\"\"

        chunks = []
        current_elements = []
        current_size = 0

        for element in elements:
            element_size = len(element.content)

            # If adding this element would exceed max size, create chunk
            if current_size + element_size > config.max_chunk_size and current_elements:
                chunk = self._create_chunk_from_elements(current_elements, None, config)
                if chunk:
                    chunks.append(chunk)
                current_elements = []
                current_size = 0

            current_elements.append(element)
            current_size += element_size

        # Handle remaining elements
        if current_elements:
            chunk = self._create_chunk_from_elements(current_elements, None, config)
            if chunk:
                chunks.append(chunk)

        return chunks

    async def _sentence_based_chunking(
        self,
        elements: List[DocumentElement],
        config: ChunkConfig
    ) -> List[DocumentChunk]:
        \"\"\"Split content by sentence boundaries\"\"\"
        # Implementation would split text into sentences and group them
        # Use NLTK or spaCy for sentence segmentation
        pass

    async def _recursive_chunking(
        self,
        elements: List[DocumentElement],
        config: ChunkConfig
    ) -> List[DocumentChunk]:
        \"\"\"
        Fallback to existing recursive chunking strategy.

        BUILDS ON: Existing chunking_service.py implementation
        \"\"\"

        # Convert elements back to text and use existing chunking logic
        full_text = \"\\n\\n\".join([e.content for e in elements])

        # Use existing chunking service for recursive splitting
        # This would call the existing chunking_service.chunk_document method
        pass

    def _create_chunk_from_elements(
        self,
        elements: List[DocumentElement],
        parent_heading: Optional[str],
        config: ChunkConfig
    ) -> Optional[DocumentChunk]:
        \"\"\"
        Create chunk from document elements with metadata.

        PROCESS:
        1. Combine element content preserving structure
        2. Build comprehensive metadata
        3. Return DocumentChunk object
        \"\"\"

        if not elements:
            return None

        # Combine element content with structure preservation
        content_parts = []
        for element in elements:
            if element.type in {ElementType.HEADING_1, ElementType.HEADING_2,
                              ElementType.HEADING_3, ElementType.HEADING_4}:
                content_parts.append(f\"\\n## {element.content}\\n\")
            elif element.type == ElementType.LIST_ITEM:
                content_parts.append(f\"• {element.content}\")
            elif element.type == ElementType.CODE_BLOCK:
                content_parts.append(f\"```\\n{element.content}\\n```\")
            else:
                content_parts.append(element.content)

        content = \"\\n\".join(content_parts).strip()

        if len(content) < config.min_chunk_size:
            return None

        # Build comprehensive metadata
        metadata = {
            \"element_count\": len(elements),
            \"element_types\": [e.type.value for e in elements],
            \"primary_element_type\": elements[0].type.value if elements else None,
            \"parent_heading\": parent_heading,
            \"chunk_length\": len(content),
            \"word_count\": len(content.split()),
            \"contains_headings\": any(e.type.value.startswith('h') for e in elements),
            \"contains_tables\": any(e.type == ElementType.TABLE for e in elements),
            \"contains_lists\": any(e.type == ElementType.LIST_ITEM for e in elements),
            \"contains_code\": any(e.type == ElementType.CODE_BLOCK for e in elements)
        }

        # Add page numbers if available
        page_numbers = [e.metadata.get(\"page_number\") for e in elements
                       if e.metadata.get(\"page_number\")]
        if page_numbers:
            metadata[\"page_numbers\"] = sorted(set(page_numbers))

        # Add section information
        section_titles = [e.metadata.get(\"section_title\") for e in elements
                         if e.metadata.get(\"section_title\")]
        if section_titles:
            metadata[\"section_titles\"] = list(set(section_titles))

        return DocumentChunk(
            content=content,
            metadata=metadata,
            position=elements[0].position if elements else 0,
            element_type=elements[0].type if len(elements) == 1 else None,
            parent_heading=parent_heading
        )

    def _add_context_to_chunks(
        self,
        chunks: List[DocumentChunk],
        elements: List[DocumentElement],
        config: ChunkConfig
    ) -> List[DocumentChunk]:
        \"\"\"
        Add contextual information to chunks.

        CONTEXT TYPES:
        - Surrounding chunks (before/after)
        - Parent sections/headings
        - Document position information
        \"\"\"

        if not config.include_metadata:
            return chunks

        enhanced_chunks = []

        for i, chunk in enumerate(chunks):
            enhanced_chunk = chunk

            # Add context from surrounding chunks
            if config.context_window > 0:
                context_before = []
                context_after = []

                # Get context before
                for j in range(max(0, i - config.context_window), i):
                    if j < len(chunks):
                        context_before.append(chunks[j].content[:100] + \"...\")

                # Get context after
                for j in range(i + 1, min(len(chunks), i + config.context_window + 1)):
                    context_after.append(chunks[j].content[:100] + \"...\")

                enhanced_chunk.context_before = \" \".join(context_before) if context_before else None
                enhanced_chunk.context_after = \" \".join(context_after) if context_after else None

            # Add position metadata
            enhanced_chunk.metadata[\"chunk_index\"] = i
            enhanced_chunk.metadata[\"total_chunks\"] = len(chunks)
            enhanced_chunk.metadata[\"relative_position\"] = i / len(chunks) if len(chunks) > 1 else 0

            enhanced_chunks.append(enhanced_chunk)

        return enhanced_chunks

    def _optimize_chunks(
        self,
        chunks: List[DocumentChunk],
        config: ChunkConfig
    ) -> List[DocumentChunk]:
        \"\"\"
        Final optimization of chunks.

        OPTIMIZATIONS:
        - Remove chunks that are too small (unless important)
        - Truncate chunks that are too large
        - Merge adjacent small chunks
        - Validate content quality
        \"\"\"

        optimized = []

        for chunk in chunks:
            # Skip chunks that are too small unless they contain important elements
            if len(chunk.content) < config.min_chunk_size:
                if chunk.element_type not in {ElementType.HEADING_1, ElementType.HEADING_2,
                                            ElementType.TABLE, ElementType.CODE_BLOCK}:
                    continue  # Skip small, unimportant chunks

            # Truncate chunks that are too large (final safety)
            if len(chunk.content) > config.max_chunk_size * 2:
                chunk.content = chunk.content[:config.max_chunk_size * 2]
                chunk.metadata[\"truncated\"] = True

            optimized.append(chunk)

        return optimized

    # Helper methods for analysis and processing
    def _analyze_document_structure(self, elements: List[DocumentElement]) -> Dict:
        \"\"\"
        Analyze document structure characteristics.

        METRICS:
        - Heading density
        - Table/list density
        - Code density
        - Average paragraph length
        - Structure score
        \"\"\"

        total_elements = len(elements)
        if total_elements == 0:
            return {}

        heading_count = sum(1 for e in elements if e.type.value.startswith('h'))
        table_count = sum(1 for e in elements if e.type == ElementType.TABLE)
        list_count = sum(1 for e in elements if e.type == ElementType.LIST_ITEM)
        code_count = sum(1 for e in elements if e.type == ElementType.CODE_BLOCK)
        paragraph_lengths = [len(e.content) for e in elements if e.type == ElementType.PARAGRAPH]

        return {
            \"total_elements\": total_elements,
            \"heading_density\": heading_count / total_elements,
            \"table_density\": (table_count + list_count) / total_elements,
            \"code_density\": code_count / total_elements,
            \"avg_paragraph_length\": sum(paragraph_lengths) / len(paragraph_lengths) if paragraph_lengths else 0,
            \"heading_count\": heading_count,
            \"table_count\": table_count,
            \"list_count\": list_count,
            \"code_count\": code_count
        }

    async def _get_semantic_embedding(self, text: str) -> List[float]:
        \"\"\"Get semantic embedding for text (would use embedding service)\"\"\"
        # This would integrate with existing embedding_service.py
        pass

    def _calculate_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        \"\"\"Calculate cosine similarity between embeddings\"\"\"
        # Vector math for cosine similarity
        pass

    def _update_topic_embedding(self, current: List[float], new: List[float]) -> List[float]:
        \"\"\"Update topic embedding with moving average\"\"\"
        # Weighted average of embeddings
        pass
"""