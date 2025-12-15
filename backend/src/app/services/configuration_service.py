"""
Hierarchical configuration management for KB pipeline.

WHY: Different users need different default settings with override capabilities
HOW: Configuration inheritance from global → org → workspace → KB → document → source
BUILDS ON: Existing tenant_service.py patterns and KnowledgeBase.config

PSEUDOCODE:
-----------
from typing import Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
from uuid import UUID

class ConfigurationLevel(Enum):
    \"\"\"Configuration hierarchy levels\"\"\"
    GLOBAL = \"global\"
    ORGANIZATION = \"organization\"
    WORKSPACE = \"workspace\"
    KNOWLEDGE_BASE = \"knowledge_base\"
    DOCUMENT = \"document\"
    SOURCE = \"source\"  # Per-source overrides

@dataclass
class ChunkingConfiguration:
    \"\"\"Complete chunking configuration with intelligent defaults\"\"\"

    # Strategy Configuration
    strategy: str = \"adaptive\"  # adaptive, heading_based, semantic, recursive, etc.
    max_chunk_size: int = 1000  # Characters
    chunk_overlap: int = 200    # Character overlap between chunks
    min_chunk_size: int = 100   # Minimum viable chunk size

    # Structure Preservation
    preserve_structure: bool = True  # Maintain document hierarchy
    respect_boundaries: bool = True  # Don't split across logical boundaries
    merge_short_paragraphs: bool = False  # Combine very short paragraphs

    # Content-Specific Settings
    code_chunk_size: int = 2000     # Larger chunks for code
    table_handling: str = \"preserve\"  # preserve, split, extract
    list_handling: str = \"preserve\"   # preserve, split, flatten

    # Language and Parsing
    language: str = \"auto\"  # auto-detect or specific language code
    handle_equations: bool = True    # Special handling for mathematical content
    preserve_formatting: bool = True # Maintain markdown/HTML formatting

    # Advanced Options
    adaptive_sizing: bool = True     # Adjust chunk size based on content type
    context_window: int = 2          # Surrounding chunks for context
    semantic_threshold: float = 0.7  # Similarity threshold for semantic chunking

@dataclass
class EmbeddingConfiguration:
    \"\"\"Embedding generation configuration\"\"\"

    # Model Selection
    provider: str = \"openai\"  # openai, huggingface, sentence_transformers, local
    model: str = \"text-embedding-ada-002\"  # Specific model name
    dimensions: int = 1536    # Embedding dimensions

    # Processing Options
    batch_size: int = 100     # Embeddings per batch
    rate_limit: float = 100.0 # Requests per second
    max_retries: int = 3      # Retry failed embeddings

    # Content Preprocessing
    normalize_text: bool = True      # Normalize Unicode, whitespace
    remove_special_chars: bool = False # Clean special characters
    truncate_long_text: bool = True   # Truncate if exceeds model limits

@dataclass
class VectorStoreConfiguration:
    \"\"\"Vector store and indexing configuration\"\"\"

    # Vector Store Settings
    provider: str = \"faiss\"  # faiss, qdrant, weaviate, pinecone, etc.
    index_type: str = \"auto\" # auto-select or specific index type
    similarity_metric: str = \"cosine\"  # cosine, euclidean, dot_product

    # Performance Settings
    cache_enabled: bool = True
    batch_upsert: bool = True
    parallel_processing: bool = True

    # Metadata Indexing
    metadata_fields: list = None  # Fields to index for filtering
    full_text_search: bool = True # Enable keyword search alongside semantic

    def __post_init__(self):
        if self.metadata_fields is None:
            self.metadata_fields = []

@dataclass
class RetrievalConfiguration:
    \"\"\"Search and retrieval configuration\"\"\"

    # Search Strategy
    search_method: str = \"hybrid\"  # semantic, keyword, hybrid
    top_k: int = 5               # Number of chunks to retrieve
    similarity_threshold: float = 0.7  # Minimum similarity score

    # Hybrid Search Weights
    semantic_weight: float = 0.7   # Weight for semantic search
    keyword_weight: float = 0.3    # Weight for keyword search

    # Re-ranking and Filtering
    enable_reranking: bool = True  # Re-rank results for relevance
    diversity_threshold: float = 0.8  # Avoid very similar results
    include_metadata: bool = True     # Return chunk metadata

    # Context Enhancement
    expand_context: bool = True    # Include surrounding chunks
    max_context_chunks: int = 3    # Maximum context chunks per result

@dataclass
class KnowledgeBaseConfiguration:
    \"\"\"Complete KB configuration\"\"\"
    chunking: ChunkingConfiguration
    embedding: EmbeddingConfiguration
    vector_store: VectorStoreConfiguration
    retrieval: RetrievalConfiguration

    # Processing Options
    async_processing: bool = True     # Process documents asynchronously
    error_handling: str = \"continue\"  # continue, stop, retry
    quality_checks: bool = True       # Validate chunks before indexing

    # Monitoring and Debugging
    enable_monitoring: bool = True    # Track processing pipeline
    log_level: str = \"info\"          # debug, info, warning, error
    retain_debug_info: bool = False   # Keep detailed processing logs

class ConfigurationService:
    \"\"\"
    Manage hierarchical configuration with intelligent defaults.

    FEATURES:
    - Configuration inheritance with override capabilities
    - Per-source configuration management
    - Template-based configuration for common scenarios
    - Validation and optimization of configuration settings

    BUILDS ON: Existing tenant_service.py patterns for multi-tenancy
    \"\"\"

    def __init__(self, db: Session, redis_client):
        self.db = db
        self.redis = redis_client

        # Default configurations for different document types
        self.document_type_templates = {
            \"documentation\": self._get_documentation_template(),
            \"research_papers\": self._get_research_template(),
            \"code_repositories\": self._get_code_template(),
            \"customer_support\": self._get_support_template(),
            \"legal_documents\": self._get_legal_template(),
            \"marketing_content\": self._get_marketing_template()
        }

    def get_effective_configuration(
        self,
        organization_id: Optional[UUID] = None,
        workspace_id: Optional[UUID] = None,
        knowledge_base_id: Optional[UUID] = None,
        document_id: Optional[UUID] = None,
        source_config: Optional[Dict] = None
    ) -> KnowledgeBaseConfiguration:
        \"\"\"
        Resolve effective configuration by merging hierarchy levels.

        HIERARCHY (lowest to highest priority):
        1. Global defaults
        2. Organization settings
        3. Workspace settings
        4. Knowledge Base settings
        5. Document settings
        6. Source-specific overrides

        PROCESS:
        1. Start with global defaults
        2. Apply each level of overrides in order
        3. Validate final configuration
        4. Return unified configuration object
        \"\"\"

        # Start with global defaults
        config = self._get_global_defaults()

        # Apply organization-level overrides
        if organization_id:
            org_config = self._get_organization_config(organization_id)
            config = self._merge_configurations(config, org_config)

        # Apply workspace-level overrides
        if workspace_id:
            workspace_config = self._get_workspace_config(workspace_id)
            config = self._merge_configurations(config, workspace_config)

        # Apply knowledge base-level overrides
        if knowledge_base_id:
            kb_config = self._get_knowledge_base_config(knowledge_base_id)
            config = self._merge_configurations(config, kb_config)

        # Apply document-level overrides
        if document_id:
            doc_config = self._get_document_config(document_id)
            config = self._merge_configurations(config, doc_config)

        # Apply source-specific overrides
        if source_config and source_config.get(\"processing_overrides\"):
            source_overrides = source_config[\"processing_overrides\"]
            config = self._merge_configurations(config, source_overrides)

        # Validate and optimize final configuration
        config = self._validate_configuration(config)

        return config

    def get_source_configuration_template(
        self,
        source_type: str,
        document_type: Optional[str] = None
    ) -> Dict:
        \"\"\"
        Get configuration template optimized for specific source and document types.

        TEMPLATES:
        - Web scraping: Larger chunks, preserve structure, handle dynamic content
        - File uploads: Format-specific optimization, metadata extraction
        - Cloud integrations: Real-time sync settings, incremental updates
        - Code repositories: Code-aware chunking, syntax preservation

        PROCESS:
        1. Get base template for source type
        2. Apply document type optimizations
        3. Return merged configuration
        \"\"\"

        # Base template for source type
        if source_type == \"web_scraping\":
            template = {
                \"chunking\": {
                    \"strategy\": \"heading_based\",
                    \"max_chunk_size\": 1500,  # Web content often longer
                    \"preserve_structure\": True,
                    \"respect_boundaries\": True,
                    \"adaptive_sizing\": True
                },
                \"processing\": {
                    \"clean_html\": True,
                    \"extract_metadata\": True,
                    \"handle_dynamic_content\": True
                }
            }

        elif source_type == \"file_upload\":
            template = {
                \"chunking\": {
                    \"strategy\": \"adaptive\",
                    \"preserve_structure\": True,
                    \"adaptive_sizing\": True
                },
                \"processing\": {
                    \"extract_metadata\": True,
                    \"handle_tables\": \"preserve\",
                    \"ocr_enabled\": True  # For images and scanned PDFs
                }
            }

        elif source_type == \"cloud_integration\":
            template = {
                \"chunking\": {
                    \"strategy\": \"heading_based\",
                    \"preserve_structure\": True
                },
                \"processing\": {
                    \"sync_enabled\": True,
                    \"incremental_updates\": True,
                    \"preserve_cloud_metadata\": True
                }
            }

        else:
            template = self._get_global_defaults()

        # Apply document type optimizations
        if document_type and document_type in self.document_type_templates:
            doc_template = self.document_type_templates[document_type]
            template = self._merge_configurations(template, doc_template)

        return template

    def _get_global_defaults(self) -> Dict:
        \"\"\"Get global default configuration\"\"\"
        return {
            \"chunking\": asdict(ChunkingConfiguration()),
            \"embedding\": asdict(EmbeddingConfiguration()),
            \"vector_store\": asdict(VectorStoreConfiguration()),
            \"retrieval\": asdict(RetrievalConfiguration()),
            \"async_processing\": True,
            \"error_handling\": \"continue\",
            \"quality_checks\": True,
            \"enable_monitoring\": True,
            \"log_level\": \"info\",
            \"retain_debug_info\": False
        }

    def _get_organization_config(self, organization_id: UUID) -> Dict:
        \"\"\"Get organization-level configuration overrides\"\"\"
        # Query organization settings from database
        # This would extend the Organization model to include config
        org = self.db.query(Organization).filter(Organization.id == organization_id).first()
        if org and hasattr(org, 'kb_config') and org.kb_config:
            return org.kb_config
        return {}

    def _get_workspace_config(self, workspace_id: UUID) -> Dict:
        \"\"\"Get workspace-level configuration overrides\"\"\"
        # Query workspace settings from database
        # This would extend the Workspace model to include config
        workspace = self.db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if workspace and hasattr(workspace, 'kb_config') and workspace.kb_config:
            return workspace.kb_config
        return {}

    def _get_knowledge_base_config(self, kb_id: UUID) -> Dict:
        \"\"\"Get KB-specific configuration\"\"\"
        # Uses existing KnowledgeBase.config field
        kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        if kb and kb.config:
            return kb.config
        return {}

    def _get_document_config(self, document_id: UUID) -> Dict:
        \"\"\"Get document-level configuration overrides\"\"\"
        # Uses existing Document.chunking_config field
        doc = self.db.query(Document).filter(Document.id == document_id).first()
        if doc and doc.chunking_config:
            return {\"chunking\": doc.chunking_config}
        return {}

    def _merge_configurations(self, base_config: Dict, override_config: Dict) -> Dict:
        \"\"\"
        Merge configuration dictionaries with deep merging.

        LOGIC:
        - Override values take precedence
        - Nested dictionaries are merged recursively
        - Lists are replaced (not merged)
        \"\"\"

        import copy

        merged = copy.deepcopy(base_config)

        for key, value in override_config.items():
            if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                # Recursively merge nested dictionaries
                merged[key] = self._merge_configurations(merged[key], value)
            else:
                # Replace value
                merged[key] = value

        return merged

    def _validate_configuration(self, config: Dict) -> KnowledgeBaseConfiguration:
        \"\"\"
        Validate and optimize configuration settings.

        VALIDATION:
        - Check value ranges
        - Ensure compatibility between settings
        - Apply optimization recommendations
        - Fix invalid configurations
        \"\"\"

        # Validate chunking configuration
        chunking = config.get(\"chunking\", {})

        # Ensure chunk sizes are reasonable
        if chunking.get(\"max_chunk_size\", 1000) < 100:
            chunking[\"max_chunk_size\"] = 100
        if chunking.get(\"max_chunk_size\", 1000) > 10000:
            chunking[\"max_chunk_size\"] = 10000

        # Ensure overlap is less than chunk size
        max_size = chunking.get(\"max_chunk_size\", 1000)
        if chunking.get(\"chunk_overlap\", 200) >= max_size:
            chunking[\"chunk_overlap\"] = max(50, max_size // 4)

        # Validate embedding configuration
        embedding = config.get(\"embedding\", {})

        # Ensure batch size is reasonable
        if embedding.get(\"batch_size\", 100) < 1:
            embedding[\"batch_size\"] = 1
        if embedding.get(\"batch_size\", 100) > 1000:
            embedding[\"batch_size\"] = 1000

        # Validate retrieval configuration
        retrieval = config.get(\"retrieval\", {})

        # Ensure weights sum to 1.0 for hybrid search
        if retrieval.get(\"search_method\") == \"hybrid\":
            semantic_weight = retrieval.get(\"semantic_weight\", 0.7)
            keyword_weight = retrieval.get(\"keyword_weight\", 0.3)
            total_weight = semantic_weight + keyword_weight

            if abs(total_weight - 1.0) > 0.01:  # Allow small floating point errors
                # Normalize weights
                retrieval[\"semantic_weight\"] = semantic_weight / total_weight
                retrieval[\"keyword_weight\"] = keyword_weight / total_weight

        # Build validated configuration object
        try:
            return KnowledgeBaseConfiguration(
                chunking=ChunkingConfiguration(**chunking),
                embedding=EmbeddingConfiguration(**embedding),
                vector_store=VectorStoreConfiguration(**config.get(\"vector_store\", {})),
                retrieval=RetrievalConfiguration(**retrieval),
                async_processing=config.get(\"async_processing\", True),
                error_handling=config.get(\"error_handling\", \"continue\"),
                quality_checks=config.get(\"quality_checks\", True),
                enable_monitoring=config.get(\"enable_monitoring\", True),
                log_level=config.get(\"log_level\", \"info\"),
                retain_debug_info=config.get(\"retain_debug_info\", False)
            )
        except Exception as e:
            # Fallback to defaults if validation fails
            return KnowledgeBaseConfiguration(
                chunking=ChunkingConfiguration(),
                embedding=EmbeddingConfiguration(),
                vector_store=VectorStoreConfiguration(),
                retrieval=RetrievalConfiguration()
            )

    # Document type templates
    def _get_documentation_template(self) -> Dict:
        \"\"\"Configuration optimized for technical documentation\"\"\"
        return {
            \"chunking\": {
                \"strategy\": \"heading_based\",
                \"max_chunk_size\": 1200,
                \"preserve_structure\": True,
                \"respect_boundaries\": True,
                \"code_chunk_size\": 2000,
                \"table_handling\": \"preserve\"
            },
            \"retrieval\": {
                \"search_method\": \"hybrid\",
                \"semantic_weight\": 0.6,
                \"keyword_weight\": 0.4,  # Higher keyword weight for technical terms
                \"top_k\": 5
            }
        }

    def _get_code_template(self) -> Dict:
        \"\"\"Configuration optimized for code repositories\"\"\"
        return {
            \"chunking\": {
                \"strategy\": \"adaptive\",
                \"max_chunk_size\": 2000,  # Larger chunks for code
                \"code_chunk_size\": 3000,
                \"preserve_structure\": True,
                \"handle_equations\": False,  # Not relevant for code
                \"preserve_formatting\": True  # Critical for code
            },
            \"embedding\": {
                \"model\": \"code-search-ada-code-001\",  # Code-specific model if available
                \"normalize_text\": False  # Preserve exact code formatting
            },
            \"retrieval\": {
                \"search_method\": \"hybrid\",
                \"semantic_weight\": 0.5,
                \"keyword_weight\": 0.5  # Equal weight for code search
            }
        }

    def _get_research_template(self) -> Dict:
        \"\"\"Configuration optimized for research papers and academic content\"\"\"
        return {
            \"chunking\": {
                \"strategy\": \"semantic\",
                \"max_chunk_size\": 1500,  # Academic content benefits from larger chunks
                \"preserve_structure\": True,
                \"handle_equations\": True,
                \"table_handling\": \"preserve\",
                \"semantic_threshold\": 0.75  # Higher threshold for academic coherence
            },
            \"retrieval\": {
                \"search_method\": \"semantic\",  # Focus on semantic understanding
                \"semantic_weight\": 0.8,
                \"keyword_weight\": 0.2,
                \"enable_reranking\": True
            }
        }

    def _get_support_template(self) -> Dict:
        \"\"\"Configuration optimized for customer support content\"\"\"
        return {
            \"chunking\": {
                \"strategy\": \"by_heading\",
                \"max_chunk_size\": 800,  # Shorter chunks for quick answers
                \"preserve_structure\": True
            },
            \"retrieval\": {
                \"search_method\": \"hybrid\",
                \"semantic_weight\": 0.5,
                \"keyword_weight\": 0.5,
                \"top_k\": 8  # More results for comprehensive support
            }
        }

    def _get_legal_template(self) -> Dict:
        \"\"\"Configuration optimized for legal documents\"\"\"
        return {
            \"chunking\": {
                \"strategy\": \"paragraph_based\",
                \"max_chunk_size\": 1800,  # Longer chunks to preserve legal context
                \"preserve_structure\": True,
                \"respect_boundaries\": True  # Critical for legal text
            },
            \"retrieval\": {
                \"search_method\": \"hybrid\",
                \"semantic_weight\": 0.6,
                \"keyword_weight\": 0.4,
                \"enable_reranking\": True
            }
        }

    def _get_marketing_template(self) -> Dict:
        \"\"\"Configuration optimized for marketing content\"\"\"
        return {
            \"chunking\": {
                \"strategy\": \"semantic\",
                \"max_chunk_size\": 1000,
                \"preserve_structure\": True
            },
            \"retrieval\": {
                \"search_method\": \"semantic\",
                \"semantic_weight\": 0.8,
                \"keyword_weight\": 0.2,
                \"diversity_threshold\": 0.7  # More diverse results
            }
        }

    def save_configuration(
        self,
        config: KnowledgeBaseConfiguration,
        level: ConfigurationLevel,
        entity_id: UUID
    ) -> bool:
        \"\"\"
        Save configuration at specific hierarchy level.

        PROCESS:
        1. Convert configuration to dict
        2. Store in appropriate database table/field
        3. Return success status
        \"\"\"

        config_dict = {
            \"chunking\": asdict(config.chunking),
            \"embedding\": asdict(config.embedding),
            \"vector_store\": asdict(config.vector_store),
            \"retrieval\": asdict(config.retrieval),
            \"async_processing\": config.async_processing,
            \"error_handling\": config.error_handling,
            \"quality_checks\": config.quality_checks,
            \"enable_monitoring\": config.enable_monitoring,
            \"log_level\": config.log_level,
            \"retain_debug_info\": config.retain_debug_info
        }

        try:
            if level == ConfigurationLevel.ORGANIZATION:
                org = self.db.query(Organization).filter(Organization.id == entity_id).first()
                if org:
                    org.kb_config = config_dict
                    self.db.commit()
                    return True

            elif level == ConfigurationLevel.WORKSPACE:
                workspace = self.db.query(Workspace).filter(Workspace.id == entity_id).first()
                if workspace:
                    workspace.kb_config = config_dict
                    self.db.commit()
                    return True

            elif level == ConfigurationLevel.KNOWLEDGE_BASE:
                kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == entity_id).first()
                if kb:
                    kb.config = config_dict
                    self.db.commit()
                    return True

            elif level == ConfigurationLevel.DOCUMENT:
                doc = self.db.query(Document).filter(Document.id == entity_id).first()
                if doc:
                    doc.chunking_config = config_dict.get(\"chunking\", {})
                    self.db.commit()
                    return True

            return False

        except Exception as e:
            self.db.rollback()
            return False
"""