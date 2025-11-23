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
- Preserve metadata per chunk

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import List, Optional
from uuid import UUID
import re

from sqlalchemy.orm import Session


class ChunkingService:
    """
    Document chunking with multiple strategies.

    WHY: Split documents into embeddable chunks
    HOW: Strategy pattern for different chunking methods
    """

    def chunk_document(
        self,
        text: str,
        strategy: str = "recursive",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        separators: Optional[List[str]] = None
    ) -> List[dict]:
        """
        Chunk document text.

        WHY: Split text into manageable pieces
        HOW: Use specified strategy

        ARGS:
            text: Document text to chunk
            strategy: "recursive" | "sentence_based" | "token" | "semantic" | "by_heading" | "by_section" | "adaptive" | "paragraph_based" | "hybrid"
            chunk_size: Target chunk size (characters or tokens)
            chunk_overlap: Overlap between chunks
            separators: Custom separators (for recursive)

        RETURNS:
            [
                {
                    "content": "Chunk text...",
                    "index": 0,
                    "start_pos": 0,
                    "end_pos": 1000,
                    "token_count": 250
                }
            ]
        """

        if strategy == "recursive":
            return self._recursive_chunk(text, chunk_size, chunk_overlap, separators)

        elif strategy in ("sentence", "sentence_based"):
            return self._sentence_chunk(text, chunk_size, chunk_overlap)

        elif strategy == "token":
            return self._token_chunk(text, chunk_size, chunk_overlap)

        elif strategy == "semantic":
            return self._semantic_chunk(text, chunk_size, chunk_overlap)

        elif strategy == "by_heading":
            return self._heading_chunk(text, chunk_size, chunk_overlap)

        elif strategy == "by_section":
            return self._section_chunk(text, chunk_size, chunk_overlap)

        elif strategy == "paragraph_based":
            return self._paragraph_chunk(text, chunk_size, chunk_overlap)

        elif strategy == "adaptive":
            return self._adaptive_chunk(text, chunk_size, chunk_overlap)

        elif strategy == "hybrid":
            return self._hybrid_chunk(text, chunk_size, chunk_overlap)

        else:
            raise ValueError(f"Unknown chunking strategy: {strategy}")


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
        """

        if separators is None:
            separators = ["\n\n", "\n", " ", ""]

        chunks = []
        current_chunk = ""
        chunk_index = 0

        # Split by first separator
        splits = text.split(separators[0]) if separators else [text]

        for split in splits:
            # If split fits in current chunk
            if len(current_chunk) + len(split) + len(separators[0]) <= chunk_size:
                if current_chunk:
                    current_chunk += separators[0] + split
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
                if len(separators) > 1:
                    sub_chunks = self._recursive_chunk(
                        split,
                        chunk_size,
                        chunk_overlap,
                        separators[1:]
                    )
                    for sub_chunk in sub_chunks:
                        sub_chunk["index"] = chunk_index
                        chunks.append(sub_chunk)
                        chunk_index += 1
                else:
                    # Force split at character level
                    for i in range(0, len(split), chunk_size - chunk_overlap):
                        chunks.append(self._create_chunk_metadata(
                            split[i:i + chunk_size],
                            chunk_index
                        ))
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
                overlap_start = max(0, len(current_chunk) - chunk_overlap)
                current_chunk = current_chunk[overlap_start:] + separators[0] + split if current_chunk else split

        # Save final chunk
        if current_chunk:
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
        chunk_overlap: int
    ) -> List[dict]:
        """
        Token-aware chunking.

        WHY: Respect token limits for embeddings
        HOW: Estimate tokens, chunk accordingly

        TOKEN ESTIMATION:
        - ~4 characters = 1 token (rough estimate)
        - Production would use tiktoken
        """

        # Simple token estimation (4 chars ≈ 1 token)
        char_per_token = 4
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
        chunk_overlap: int
    ) -> List[dict]:
        """
        Semantic chunking based on topic boundaries using embedding similarity.

        WHY: Group semantically related content together
        HOW: Use embedding similarity to detect topic changes
        OPTIMIZED FOR: Q&A, retrieval, unstructured content

        ALGORITHM:
        1. Split text into sentences/paragraphs
        2. Generate embeddings for each segment
        3. Calculate cosine similarity between consecutive segments
        4. Detect topic boundaries when similarity drops below threshold
        5. Group similar segments into chunks
        """
        try:
            from app.services.embedding_service_local import embedding_service
            import numpy as np

            # Split into paragraphs (more stable than sentences for semantic analysis)
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip() and len(p.strip()) > 20]

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
                    import threading

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

                # Process results
                for i, para in enumerate(paragraphs):
                    if emb_results and i < len(emb_results) and emb_results[i] is not None:
                        embeddings.append(np.array(emb_results[i]))
                    else:
                        # Fallback: use zero vector if embedding fails
                        embeddings.append(np.zeros(384))  # all-MiniLM-L6-v2 dimension

            except Exception as e:
                # Final fallback: use zero vectors for all paragraphs
                print(f"[ChunkingService] Batch embedding generation failed: {e}")
                embeddings = [np.zeros(384) for _ in paragraphs]

            # Calculate similarity between consecutive paragraphs
            similarities = []
            for i in range(len(embeddings) - 1):
                similarity = self._cosine_similarity(embeddings[i], embeddings[i + 1])
                similarities.append(similarity)

            # Detect topic boundaries (similarity < threshold)
            # Lower similarity = topic change
            similarity_threshold = 0.65  # Empirically determined

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

                # Reason 2: Current chunk would exceed max size
                elif current_chunk_size + next_para_size > chunk_size * 1.5:
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
        chunk_overlap: int
    ) -> List[dict]:
        """
        Adaptive chunking that selects best strategy based on content.

        WHY: Automatically optimize for different document types
        HOW: Analyze text structure and choose appropriate strategy

        DECISION LOGIC:
        - High heading density (>5%) → by_heading
        - Many paragraphs → paragraph_based
        - Mixed content → hybrid
        - Fallback → recursive
        """
        # Analyze document structure
        total_lines = len(text.split("\n"))
        heading_count = len([line for line in text.split("\n") if line.strip().startswith("#")])
        paragraph_count = len([p for p in text.split("\n\n") if p.strip()])

        heading_density = heading_count / total_lines if total_lines > 0 else 0

        # Decision logic
        if heading_density > 0.05:  # >5% headings
            return self._heading_chunk(text, chunk_size, chunk_overlap)
        elif paragraph_count > 10:
            return self._paragraph_chunk(text, chunk_size, chunk_overlap)
        elif heading_count > 0:
            return self._hybrid_chunk(text, chunk_size, chunk_overlap)
        else:
            return self._recursive_chunk(text, chunk_size, chunk_overlap, None)


    def _hybrid_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[dict]:
        """
        Hybrid chunking combining multiple strategies.

        WHY: Get best of multiple approaches
        HOW: Primary chunking by structure, secondary by size

        FLOW:
        1. Try heading-based chunking first
        2. For oversized chunks, apply paragraph splitting
        3. Final fallback to recursive splitting
        """
        # Step 1: Primary chunking by headings
        primary_chunks = self._heading_chunk(text, chunk_size * 1.5, chunk_overlap)

        # Step 2: Refine oversized chunks
        refined_chunks = []
        for chunk in primary_chunks:
            if len(chunk["content"]) > chunk_size * 1.5:
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


    def _create_chunk_metadata(self, content: str, index: int) -> dict:
        """
        Create chunk metadata.

        WHY: Track chunk information
        HOW: Add index, position, token count
        """

        # Estimate token count (4 chars ≈ 1 token)
        estimated_tokens = len(content) // 4

        return {
            "content": content,
            "index": index,
            "start_pos": 0,  # Would calculate actual position
            "end_pos": len(content),
            "token_count": estimated_tokens
        }


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
