"""
Document annotation and enhancement service for KB content.

WHY: Add semantic annotations and enhancements to improve retrieval quality
HOW: Extract entities, topics, keywords, and relationships from documents
BUILDS ON: Existing document_processing_service.py and chunking patterns

PSEUDOCODE:
-----------
from typing import Dict, List, Optional, Union
from dataclasses import dataclass
from enum import Enum
import uuid

class AnnotationType(Enum):
    \"\"\"Types of annotations that can be applied\"\"\"
    ENTITY = "entity"
    KEYWORD = "keyword"
    TOPIC = "topic"
    CATEGORY = "category"
    SENTIMENT = "sentiment"
    SUMMARY = "summary"
    RELATIONSHIP = "relationship"
    LANGUAGE = "language"
    CUSTOM = "custom"

@dataclass
class Annotation:
    \"\"\"Individual annotation with metadata\"\"\"
    annotation_id: str
    type: AnnotationType
    text: str
    confidence: float
    start_offset: Optional[int] = None
    end_offset: Optional[int] = None
    metadata: Dict = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

@dataclass
class DocumentAnnotations:
    \"\"\"Complete set of annotations for a document\"\"\"
    document_id: str
    annotations: List[Annotation]
    summary: Optional[str] = None
    topics: List[str] = None
    entities: List[str] = None
    keywords: List[str] = None
    metadata: Dict = None

    def __post_init__(self):
        if self.topics is None:
            self.topics = []
        if self.entities is None:
            self.entities = []
        if self.keywords is None:
            self.keywords = []
        if self.metadata is None:
            self.metadata = {}

class AnnotationService:
    \"\"\"
    Service for adding semantic annotations to documents.

    PHILOSOPHY: Rich annotations improve retrieval accuracy and user experience
    BUILDS ON: Existing text processing and AI integration patterns
    \"\"\"

    def __init__(self, ai_client=None, config_service=None):
        self.ai_client = ai_client  # For LLM-based annotations
        self.config_service = config_service

        # Configure annotation strategies
        self.annotation_strategies = {
            AnnotationType.ENTITY: self._extract_entities,
            AnnotationType.KEYWORD: self._extract_keywords,
            AnnotationType.TOPIC: self._extract_topics,
            AnnotationType.CATEGORY: self._classify_content,
            AnnotationType.SENTIMENT: self._analyze_sentiment,
            AnnotationType.SUMMARY: self._generate_summary,
            AnnotationType.RELATIONSHIP: self._extract_relationships,
            AnnotationType.LANGUAGE: self._detect_language
        }

    async def annotate_document(
        self,
        document_content: str,
        document_id: str,
        annotation_config: Dict,
        workspace_id: str
    ) -> DocumentAnnotations:
        \"\"\"
        Apply comprehensive annotations to document content.

        annotation_config = {
            "enabled_types": ["entity", "keyword", "topic", "summary"],
            "entity_config": {
                "extract_persons": true,
                "extract_organizations": true,
                "extract_locations": true,
                "confidence_threshold": 0.7
            },
            "keyword_config": {
                "max_keywords": 20,
                "min_frequency": 2,
                "use_tfidf": true
            },
            "topic_config": {
                "max_topics": 5,
                "topic_method": "lda",  # or "clustering", "llm"
                "include_subtopics": false
            },
            "summary_config": {
                "max_length": 200,
                "method": "extractive",  # or "abstractive"
                "include_key_points": true
            }
        }

        PROCESS:
        1. Parse configuration and determine enabled annotation types
        2. Apply each annotation strategy in parallel where possible
        3. Combine results and resolve conflicts
        4. Store annotations for future retrieval enhancement
        5. Return structured annotation results
        \"\"\"

        enabled_types = annotation_config.get("enabled_types", [])
        annotations = []

        # Process each enabled annotation type
        for type_str in enabled_types:
            try:
                annotation_type = AnnotationType(type_str)
                if annotation_type in self.annotation_strategies:
                    type_config = annotation_config.get(f"{type_str}_config", {})
                    type_annotations = await self.annotation_strategies[annotation_type](
                        document_content, type_config
                    )
                    annotations.extend(type_annotations)
            except (ValueError, KeyError) as e:
                # Log warning but continue with other annotations
                print(f"Failed to process annotation type {type_str}: {e}")

        # Extract summary information for easy access
        summary_annotations = [a for a in annotations if a.type == AnnotationType.SUMMARY]
        summary = summary_annotations[0].text if summary_annotations else None

        # Extract categorized information
        topics = list(set([a.text for a in annotations if a.type == AnnotationType.TOPIC]))
        entities = list(set([a.text for a in annotations if a.type == AnnotationType.ENTITY]))
        keywords = list(set([a.text for a in annotations if a.type == AnnotationType.KEYWORD]))

        # Create comprehensive annotation result
        document_annotations = DocumentAnnotations(
            document_id=document_id,
            annotations=annotations,
            summary=summary,
            topics=topics,
            entities=entities,
            keywords=keywords,
            metadata={
                "annotation_config": annotation_config,
                "workspace_id": workspace_id,
                "total_annotations": len(annotations),
                "annotation_types": list(set([a.type.value for a in annotations]))
            }
        )

        # Store annotations for future use
        await self._store_annotations(document_annotations, workspace_id)

        return document_annotations

    async def annotate_chunks(
        self,
        chunks: List[Dict],
        annotation_config: Dict,
        workspace_id: str
    ) -> List[Dict]:
        \"\"\"
        Apply annotations to document chunks for enhanced retrieval.

        PROCESS:
        1. For each chunk, apply lightweight annotations
        2. Focus on keywords, entities, and topics
        3. Add semantic metadata to chunks
        4. Return enhanced chunks with annotation metadata
        \"\"\"

        enhanced_chunks = []

        for chunk in chunks:
            chunk_content = chunk.get("content", "")
            chunk_id = chunk.get("chunk_id", str(uuid.uuid4()))

            # Apply lightweight annotation set for chunks
            chunk_config = {
                "enabled_types": ["keyword", "entity", "topic"],
                "keyword_config": {"max_keywords": 10, "min_frequency": 1},
                "entity_config": {"confidence_threshold": 0.8},
                "topic_config": {"max_topics": 3}
            }

            chunk_annotations = await self.annotate_document(
                chunk_content, chunk_id, chunk_config, workspace_id
            )

            # Enhance chunk with annotation metadata
            enhanced_chunk = {
                **chunk,
                "annotations": {
                    "keywords": chunk_annotations.keywords,
                    "entities": chunk_annotations.entities,
                    "topics": chunk_annotations.topics,
                    "annotation_count": len(chunk_annotations.annotations)
                },
                "semantic_metadata": self._create_semantic_metadata(chunk_annotations)
            }

            enhanced_chunks.append(enhanced_chunk)

        return enhanced_chunks

    async def _extract_entities(self, content: str, config: Dict) -> List[Annotation]:
        \"\"\"
        Extract named entities from content.

        METHODS:
        1. Rule-based extraction (regex patterns)
        2. NLP library extraction (spaCy, NLTK)
        3. AI-powered extraction (LLM-based)

        ENTITY TYPES:
        - PERSON: Names of people
        - ORGANIZATION: Company, institution names
        - LOCATION: Places, addresses
        - DATE: Temporal expressions
        - MONEY: Monetary amounts
        - CUSTOM: Domain-specific entities
        \"\"\"

        entities = []
        confidence_threshold = config.get("confidence_threshold", 0.7)

        # Method 1: Rule-based extraction for common patterns
        if config.get("use_rules", True):
            rule_entities = await self._extract_entities_with_rules(content)
            entities.extend(rule_entities)

        # Method 2: NLP library extraction
        if config.get("use_nlp", True):
            nlp_entities = await self._extract_entities_with_nlp(content)
            entities.extend(nlp_entities)

        # Method 3: AI-powered extraction for complex entities
        if config.get("use_ai", False) and self.ai_client:
            ai_entities = await self._extract_entities_with_ai(content, config)
            entities.extend(ai_entities)

        # Filter by confidence and remove duplicates
        filtered_entities = []
        seen_entities = set()

        for entity in entities:
            if entity.confidence >= confidence_threshold:
                entity_key = f"{entity.text.lower()}:{entity.type.value}"
                if entity_key not in seen_entities:
                    seen_entities.add(entity_key)
                    filtered_entities.append(entity)

        return filtered_entities

    async def _extract_keywords(self, content: str, config: Dict) -> List[Annotation]:
        \"\"\"
        Extract important keywords and phrases.

        METHODS:
        1. TF-IDF based extraction
        2. Frequency-based extraction
        3. Phrase extraction (n-grams)
        4. AI-powered keyword extraction
        \"\"\"

        keywords = []
        max_keywords = config.get("max_keywords", 20)
        min_frequency = config.get("min_frequency", 2)

        # Method 1: TF-IDF extraction
        if config.get("use_tfidf", True):
            tfidf_keywords = await self._extract_keywords_tfidf(content, max_keywords)
            keywords.extend(tfidf_keywords)

        # Method 2: Frequency-based extraction
        if config.get("use_frequency", True):
            freq_keywords = await self._extract_keywords_frequency(content, min_frequency)
            keywords.extend(freq_keywords)

        # Method 3: Phrase extraction
        if config.get("extract_phrases", True):
            phrase_keywords = await self._extract_keyword_phrases(content)
            keywords.extend(phrase_keywords)

        # Sort by confidence and limit results
        keywords.sort(key=lambda x: x.confidence, reverse=True)
        return keywords[:max_keywords]

    async def _extract_topics(self, content: str, config: Dict) -> List[Annotation]:
        \"\"\"
        Extract main topics and themes from content.

        METHODS:
        1. LDA (Latent Dirichlet Allocation)
        2. Clustering-based topic detection
        3. AI-powered topic extraction
        4. Rule-based topic classification
        \"\"\"

        topics = []
        max_topics = config.get("max_topics", 5)
        method = config.get("topic_method", "lda")

        if method == "lda":
            topics = await self._extract_topics_lda(content, max_topics)
        elif method == "clustering":
            topics = await self._extract_topics_clustering(content, max_topics)
        elif method == "llm" and self.ai_client:
            topics = await self._extract_topics_ai(content, max_topics)
        else:
            # Fallback to simple keyword-based topic detection
            topics = await self._extract_topics_simple(content, max_topics)

        return topics

    async def _classify_content(self, content: str, config: Dict) -> List[Annotation]:
        \"\"\"
        Classify content into predefined categories.

        CATEGORIES:
        - Document type (technical, legal, marketing, etc.)
        - Industry domain (healthcare, finance, technology, etc.)
        - Content format (tutorial, reference, FAQ, etc.)
        - Audience level (beginner, intermediate, advanced)
        \"\"\"

        categories = []

        # Document type classification
        doc_type = await self._classify_document_type(content)
        if doc_type:
            categories.append(Annotation(
                annotation_id=str(uuid.uuid4()),
                type=AnnotationType.CATEGORY,
                text=f"document_type:{doc_type['category']}",
                confidence=doc_type['confidence'],
                metadata={"category_type": "document_type"}
            ))

        # Industry domain classification
        if config.get("classify_industry", True):
            industry = await self._classify_industry_domain(content)
            if industry:
                categories.append(Annotation(
                    annotation_id=str(uuid.uuid4()),
                    type=AnnotationType.CATEGORY,
                    text=f"industry:{industry['category']}",
                    confidence=industry['confidence'],
                    metadata={"category_type": "industry"}
                ))

        return categories

    async def _analyze_sentiment(self, content: str, config: Dict) -> List[Annotation]:
        \"\"\"
        Analyze sentiment and emotional tone of content.

        SENTIMENT ANALYSIS:
        - Overall sentiment (positive, negative, neutral)
        - Confidence score
        - Emotional tone detection
        - Section-level sentiment for long documents
        \"\"\"

        sentiments = []

        # Overall document sentiment
        overall_sentiment = await self._get_overall_sentiment(content)
        sentiments.append(Annotation(
            annotation_id=str(uuid.uuid4()),
            type=AnnotationType.SENTIMENT,
            text=f"overall:{overall_sentiment['label']}",
            confidence=overall_sentiment['confidence'],
            metadata={
                "sentiment_score": overall_sentiment['score'],
                "analysis_method": "overall"
            }
        ))

        # Section-level sentiment for longer content
        if len(content) > config.get("section_sentiment_threshold", 1000):
            section_sentiments = await self._get_section_sentiments(content)
            sentiments.extend(section_sentiments)

        return sentiments

    async def _generate_summary(self, content: str, config: Dict) -> List[Annotation]:
        \"\"\"
        Generate document summary and key points.

        SUMMARY TYPES:
        - Extractive: Select important sentences from original text
        - Abstractive: Generate new summary text
        - Key points: Bullet-point style summary
        - Executive summary: Business-focused overview
        \"\"\"

        summaries = []
        max_length = config.get("max_length", 200)
        method = config.get("method", "extractive")

        if method == "extractive":
            summary_text = await self._generate_extractive_summary(content, max_length)
        elif method == "abstractive" and self.ai_client:
            summary_text = await self._generate_abstractive_summary(content, max_length)
        else:
            # Fallback to simple truncation with key sentences
            summary_text = await self._generate_simple_summary(content, max_length)

        if summary_text:
            summaries.append(Annotation(
                annotation_id=str(uuid.uuid4()),
                type=AnnotationType.SUMMARY,
                text=summary_text,
                confidence=0.8,  # Summary confidence
                metadata={
                    "summary_method": method,
                    "original_length": len(content),
                    "summary_length": len(summary_text),
                    "compression_ratio": len(summary_text) / len(content)
                }
            ))

        # Generate key points if requested
        if config.get("include_key_points", True):
            key_points = await self._extract_key_points(content)
            for i, point in enumerate(key_points):
                summaries.append(Annotation(
                    annotation_id=str(uuid.uuid4()),
                    type=AnnotationType.SUMMARY,
                    text=point,
                    confidence=0.7,
                    metadata={
                        "summary_type": "key_point",
                        "point_index": i
                    }
                ))

        return summaries

    async def _extract_relationships(self, content: str, config: Dict) -> List[Annotation]:
        \"\"\"
        Extract relationships between entities and concepts.

        RELATIONSHIP TYPES:
        - Entity relationships (person works at organization)
        - Concept relationships (cause and effect)
        - Temporal relationships (before, after, during)
        - Hierarchical relationships (parent, child, part of)
        \"\"\"

        relationships = []

        # Extract simple entity relationships
        entity_relations = await self._extract_entity_relationships(content)
        relationships.extend(entity_relations)

        # Extract concept relationships
        if config.get("extract_concepts", True):
            concept_relations = await self._extract_concept_relationships(content)
            relationships.extend(concept_relations)

        return relationships

    async def _detect_language(self, content: str, config: Dict) -> List[Annotation]:
        \"\"\"
        Detect document language and confidence.

        LANGUAGE DETECTION:
        - Primary language detection
        - Multi-language content detection
        - Language confidence scoring
        - Script detection (Latin, Cyrillic, etc.)
        \"\"\"

        languages = []

        # Primary language detection
        primary_lang = await self._detect_primary_language(content)
        languages.append(Annotation(
            annotation_id=str(uuid.uuid4()),
            type=AnnotationType.LANGUAGE,
            text=f"primary:{primary_lang['language']}",
            confidence=primary_lang['confidence'],
            metadata={
                "iso_code": primary_lang['iso_code'],
                "script": primary_lang.get('script'),
                "detection_method": "statistical"
            }
        ))

        # Multi-language detection for mixed content
        if config.get("detect_mixed_languages", True):
            mixed_langs = await self._detect_mixed_languages(content)
            languages.extend(mixed_langs)

        return languages

    async def _store_annotations(self, annotations: DocumentAnnotations, workspace_id: str) -> None:
        \"\"\"
        Store annotations for future retrieval and enhancement.

        STORAGE STRATEGY:
        1. Store in Redis for fast access during retrieval
        2. Optionally store in PostgreSQL for persistence
        3. Index annotations for search and filtering
        \"\"\"

        # Store in Redis for fast access
        redis_key = f"annotations:{workspace_id}:{annotations.document_id}"
        annotation_data = self._serialize_annotations(annotations)

        # Use Redis client from existing patterns
        # await self.redis.set(redis_key, annotation_data, ex=7 * 24 * 3600)  # 7 days

        # Store annotation summary in database for persistence
        # This would integrate with existing database patterns
        pass

    def _create_semantic_metadata(self, annotations: DocumentAnnotations) -> Dict:
        \"\"\"
        Create semantic metadata for enhanced retrieval.

        METADATA INCLUDES:
        - Semantic tags derived from annotations
        - Relevance scores for different query types
        - Content complexity indicators
        - Topical clustering information
        \"\"\"

        semantic_metadata = {
            "semantic_tags": annotations.keywords + annotations.topics + annotations.entities,
            "content_complexity": self._calculate_content_complexity(annotations),
            "topical_focus": self._calculate_topical_focus(annotations),
            "entity_density": len(annotations.entities) / max(len(annotations.annotations), 1),
            "annotation_coverage": {
                "has_summary": bool(annotations.summary),
                "has_entities": len(annotations.entities) > 0,
                "has_topics": len(annotations.topics) > 0,
                "has_keywords": len(annotations.keywords) > 0
            }
        }

        return semantic_metadata

    def _calculate_content_complexity(self, annotations: DocumentAnnotations) -> str:
        \"\"\"Calculate content complexity based on annotations\"\"\"
        entity_count = len(annotations.entities)
        topic_count = len(annotations.topics)
        keyword_count = len(annotations.keywords)

        complexity_score = entity_count * 0.3 + topic_count * 0.4 + keyword_count * 0.2

        if complexity_score < 5:
            return "simple"
        elif complexity_score < 15:
            return "moderate"
        else:
            return "complex"

    def _calculate_topical_focus(self, annotations: DocumentAnnotations) -> str:
        \"\"\"Calculate how focused the content is on specific topics\"\"\"
        if len(annotations.topics) <= 2:
            return "focused"
        elif len(annotations.topics) <= 4:
            return "multi_topic"
        else:
            return "broad"

    def _serialize_annotations(self, annotations: DocumentAnnotations) -> str:
        \"\"\"Serialize annotations for storage\"\"\"
        import json
        return json.dumps(annotations, default=str)

    # Placeholder methods for specific extraction techniques
    # These would contain the actual implementation logic

    async def _extract_entities_with_rules(self, content: str) -> List[Annotation]:
        \"\"\"Rule-based entity extraction using regex patterns\"\"\"
        pass

    async def _extract_entities_with_nlp(self, content: str) -> List[Annotation]:
        \"\"\"NLP library-based entity extraction\"\"\"
        pass

    async def _extract_entities_with_ai(self, content: str, config: Dict) -> List[Annotation]:
        \"\"\"AI-powered entity extraction\"\"\"
        pass

    async def _extract_keywords_tfidf(self, content: str, max_keywords: int) -> List[Annotation]:
        \"\"\"TF-IDF based keyword extraction\"\"\"
        pass

    async def _extract_keywords_frequency(self, content: str, min_frequency: int) -> List[Annotation]:
        \"\"\"Frequency-based keyword extraction\"\"\"
        pass

    async def _extract_keyword_phrases(self, content: str) -> List[Annotation]:
        \"\"\"N-gram phrase extraction\"\"\"
        pass

    async def _extract_topics_lda(self, content: str, max_topics: int) -> List[Annotation]:
        \"\"\"LDA-based topic extraction\"\"\"
        pass

    async def _extract_topics_clustering(self, content: str, max_topics: int) -> List[Annotation]:
        \"\"\"Clustering-based topic extraction\"\"\"
        pass

    async def _extract_topics_ai(self, content: str, max_topics: int) -> List[Annotation]:
        \"\"\"AI-powered topic extraction\"\"\"
        pass

    async def _extract_topics_simple(self, content: str, max_topics: int) -> List[Annotation]:
        \"\"\"Simple keyword-based topic detection\"\"\"
        pass

    async def _classify_document_type(self, content: str) -> Optional[Dict]:
        \"\"\"Classify document type\"\"\"
        pass

    async def _classify_industry_domain(self, content: str) -> Optional[Dict]:
        \"\"\"Classify industry domain\"\"\"
        pass

    async def _get_overall_sentiment(self, content: str) -> Dict:
        \"\"\"Get overall document sentiment\"\"\"
        pass

    async def _get_section_sentiments(self, content: str) -> List[Annotation]:
        \"\"\"et section-level sentiments\"\"\"
        pass

    async def _generate_extractive_summary(self, content: str, max_length: int) -> str:
        \"\"\"Generate extractive summary\"\"\"
        pass

    async def _generate_abstractive_summary(self, content: str, max_length: int) -> str:
        \"\"\"Generate abstractive summary using AI\"\"\"
        pass

    async def _generate_simple_summary(self, content: str, max_length: int) -> str:
        \"\"\"Generate simple summary\"\"\"
        pass

    async def _extract_key_points(self, content: str) -> List[str]:
        \"\"\"Extract key points from content\"\"\"
        pass

    async def _extract_entity_relationships(self, content: str) -> List[Annotation]:
        \"\"\"Extract relationships between entities\"\"\"
        pass

    async def _extract_concept_relationships(self, content: str) -> List[Annotation]:
        \"\"\"Extract relationships between concepts\"\"\"
        pass

    async def _detect_primary_language(self, content: str) -> Dict:
        \"\"\"Detect primary language\"\"\"
        pass

    async def _detect_mixed_languages(self, content: str) -> List[Annotation]:
        \"\"\"Detect mixed languages in content\"\"\"
        pass
"""