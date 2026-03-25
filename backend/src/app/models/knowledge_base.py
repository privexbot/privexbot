"""
KnowledgeBase model - Centralized knowledge storage for chatbots and chatflows.

WHY:
- Single source of truth for RAG (Retrieval-Augmented Generation)
- Shared knowledge across multiple bots (avoid duplication)
- Context-aware access control (which bot can use which knowledge)
- Platform feature: Users build knowledge once, use in multiple bots

HOW:
- Lives within workspace (tenant isolation)
- Documents are chunked and embedded for semantic search
- Context settings control which chatbot/chatflow can access
- Supports multiple vector store backends

KEY DESIGN PRINCIPLE:
- ONE knowledge base can serve MANY chatbots/chatflows
- Access is controlled via context_settings (not separate link tables)
- This enables flexible knowledge sharing within workspace

PSEUDOCODE:
-----------
class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    # Identity
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier for this knowledge base

    name: str (required, max_length=100)
        WHY: Human-readable name
        EXAMPLE: "Product Documentation", "FAQ Database", "Customer Support KB"

    description: text | None
        WHY: Explain what knowledge this contains
        EXAMPLE: "Contains all product manuals and user guides"

    workspace_id: UUID (foreign key -> workspaces.id, indexed, cascade delete)
        WHY: CRITICAL FOR TENANCY - Links to workspace
        HOW: All knowledge bases isolated by workspace
        SECURITY: Cannot access KB from different workspace

    # Access Control (Context-Aware Design)
    context_settings: JSONB
        WHY: Define which bots can use this knowledge and how
        HOW: Flexible per-bot access configuration

        STRUCTURE:
        {
            "access_mode": "all" | "specific" | "none",
                WHY: Control default access
                - "all": All chatbots/chatflows in workspace can use
                - "specific": Only specified bots can use
                - "none": No automatic access (manual linking required)

            "allowed_chatbots": [UUID, UUID, ...],
                WHY: Specific chatbot IDs that can access (if mode="specific")

            "allowed_chatflows": [UUID, UUID, ...],
                WHY: Specific chatflow IDs that can access (if mode="specific")

            "retrieval_config": {
                "top_k": 5,
                    WHY: How many chunks to retrieve per query

                "similarity_threshold": 0.7,
                    WHY: Minimum similarity score to include chunk

                "search_method": "semantic" | "keyword" | "hybrid",
                    WHY: How to search for relevant chunks

                "rerank": true,
                    WHY: Re-rank results for better relevance

                "include_metadata": true,
                    WHY: Return chunk metadata with results
            },

            "usage_limits": {
                "max_queries_per_day": 1000,
                    WHY: Prevent abuse in API usage

                "max_tokens_per_query": 2000,
                    WHY: Control context size
            }
        }

    # Embedding Configuration
    embedding_config: JSONB
        WHY: Store embedding model and settings
        HOW: Allows switching models or updating settings

        STRUCTURE:
        {
            "provider": "openai" | "secret_ai" | "huggingface" | "custom",
            "model": "text-embedding-ada-002" | "multi-qa-mpnet-base-dot-v1",
            "dimensions": 1536,
                WHY: Vector size for this model
            "batch_size": 100,
                WHY: How many chunks to embed at once
        }

    # Vector Store Configuration (FLEXIBLE DESIGN)
    vector_store_config: JSONB
        WHY: Support ANY vector database backend
        HOW: Abstraction layer handles different providers

        STRUCTURE:
        {
            "provider": "faiss" | "weaviate" | "qdrant" | "milvus" | "chroma" | "pinecone" | "redis" | "elasticsearch" | "vespa" | "vald",
                WHY: Which vector database to use

            "connection": {
                # Provider-specific connection details
                # Examples for different providers:

                # FAISS (local, file-based)
                "type": "faiss",
                "index_path": "/data/kb_{kb_id}/faiss.index",
                "index_type": "IndexFlatIP" | "IndexIVFFlat" | "IndexHNSW",

                # Weaviate (cloud/self-hosted)
                "type": "weaviate",
                "url": "https://your-cluster.weaviate.network",
                "api_key": "encrypted_key",
                "class_name": "KnowledgeChunk",

                # Qdrant (cloud/self-hosted)
                "type": "qdrant",
                "url": "http://localhost:6333",
                "api_key": "encrypted_key",
                "collection_name": "kb_{kb_id}",

                # Milvus (cloud/self-hosted)
                "type": "milvus",
                "host": "localhost",
                "port": 19530,
                "collection_name": "knowledge_base_{kb_id}",

                # Pinecone (cloud)
                "type": "pinecone",
                "api_key": "encrypted_key",
                "environment": "us-west1-gcp",
                "index_name": "privexbot-kb-{kb_id}",

                # Redis (with RediSearch)
                "type": "redis",
                "url": "redis://localhost:6379",
                "index_name": "kb:{kb_id}",

                # Chroma (local/cloud)
                "type": "chroma",
                "host": "localhost",
                "port": 8000,
                "collection_name": "kb_{kb_id}",
            },

            "metadata_config": {
                "store_full_content": true,
                    WHY: Whether to store full chunk text in vector DB or just reference

                "indexed_fields": ["document_name", "page_number", "chunk_type"],
                    WHY: Which metadata fields to index for filtering

                "filterable_fields": ["document_id", "created_at", "custom_tags"],
                    WHY: Enable metadata filtering in queries
            },

            "performance": {
                "cache_enabled": true,
                "cache_ttl": 3600,
                "batch_upsert": true,
            }
        }

    # Indexing Settings
    indexing_method: str (default: "high_quality")
        WHY: Control indexing quality vs speed
        OPTIONS: "high_quality", "balanced", "fast"

    reindex_required: bool (default: False)
        WHY: Flag when settings change require re-indexing
        HOW: Background job processes when True

    # Statistics
    total_documents: int (default: 0)
    total_chunks: int (default: 0)
    total_tokens: int (default: 0)
    last_indexed_at: datetime | None

    # Metadata
    created_by: UUID (foreign key -> users.id)
    created_at: datetime (auto-set)
    updated_at: datetime (auto-update)

    # Relationships
    workspace: Workspace (many-to-one)
        WHY: Access parent workspace and org

    documents: list[Document] (one-to-many, cascade delete)
        WHY: All documents in this KB
        HOW: When KB deleted, all documents and chunks deleted

    creator: User (many-to-one)
        WHY: Audit trail

CONTEXT-AWARE ACCESS PATTERN:
------------------------------
WHY: Single KB serves multiple bots with different access needs

EXAMPLE 1: Public KB for all bots
    context_settings = {
        "access_mode": "all",
        "retrieval_config": {"top_k": 5}
    }
    → All chatbots/chatflows in workspace can use this KB

EXAMPLE 2: Specific bot access
    context_settings = {
        "access_mode": "specific",
        "allowed_chatbots": [chatbot1_id, chatbot2_id],
        "allowed_chatflows": [chatflow1_id]
    }
    → Only specified bots can use this KB

EXAMPLE 3: Different retrieval per bot type
    Query from chatbot: top_k=5, semantic search
    Query from chatflow: top_k=10, hybrid search
    → Can be customized in bot's KB reference

USAGE IN CHATBOT/CHATFLOW:
---------------------------
Instead of many-to-many association table, chatbot/chatflow config includes:

Chatbot config:
{
    "knowledge_bases": [
        {
            "kb_id": "uuid",
            "enabled": true,
            "override_retrieval": {
                "top_k": 3,  # Override default
                "search_method": "hybrid"
            }
        }
    ]
}

WHY this design:
- More flexible than association table
- Bot-specific retrieval overrides
- Can disable KB without deleting link
- Easier to manage in UI

TENANT ISOLATION:
-----------------
def get_knowledge_base(kb_id: UUID, current_user):
    kb = db.query(KnowledgeBase)
        .join(Workspace)
        .join(Organization)
        .filter(
            KnowledgeBase.id == kb_id,
            Organization.id == current_user.org_id
        )
        .first()

    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    return kb

VECTOR STORE FLEXIBILITY:
--------------------------
WHY: Different users have different needs
- Startups: FAISS (free, local)
- Scale-ups: Qdrant/Weaviate (self-hosted, cost-effective)
- Enterprise: Pinecone/Milvus (managed, scalable)

HOW: Abstraction layer (vector_store_service.py) handles all providers:

function search_similar_chunks(kb: KnowledgeBase, query_embedding: list[float]):
    provider = kb.vector_store_config["provider"]

    if provider == "faiss":
        return faiss_adapter.search(kb, query_embedding)
    elif provider == "qdrant":
        return qdrant_adapter.search(kb, query_embedding)
    elif provider == "weaviate":
        return weaviate_adapter.search(kb, query_embedding)
    # ... etc for all providers

DEPLOYMENT & API ACCESS:
-------------------------
WHY: Platform feature - users can call KB API from anywhere

Each Knowledge Base can have:
- API endpoint: POST /api/v1/kb/{kb_id}/query
- Requires API key (generated per KB or workspace)
- Public access for deployed chatbots

EXAMPLE API CALL:
    curl -X POST https://api.privexbot.com/v1/kb/{kb_id}/query \
        -H "Authorization: Bearer {api_key}" \
        -d '{
            "query": "How do I reset my password?",
            "top_k": 5,
            "filters": {"document_name": "FAQ"}
        }'

MIGRATION SUPPORT:
------------------
WHY: Users may want to switch vector stores
HOW: Background task to migrate embeddings

function migrate_vector_store(kb_id: UUID, new_provider: str):
    1. Get all chunks with embeddings
    2. Initialize new vector store
    3. Batch upsert to new store
    4. Verify migration
    5. Update kb.vector_store_config
    6. Delete old vector store data
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class KnowledgeBase(Base):
    """
    Knowledge Base model - Centralized knowledge storage for RAG

    Multi-tenancy: Organization → Workspace → KnowledgeBase
    3-Phase Flow: Draft (Redis) → Finalization (Create DB record) → Background Processing (Populate chunks)
    """
    __tablename__ = "knowledge_bases"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Multi-tenancy (CRITICAL for tenant isolation)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Processing status (3-phase flow)
    status = Column(
        String(50),
        nullable=False,
        default="pending",
        index=True
    )  # pending, processing, ready, ready_with_warnings, failed

    # Configuration (stores all KB configs)
    config = Column(JSONB, nullable=False, default=dict)
    # Example structure:
    # {
    #     "chunking": {"strategy": "by_heading", "chunk_size": 1000, "chunk_overlap": 200},
    #     "embedding": {"model": "all-MiniLM-L6-v2", "device": "cpu"},
    #     "scraping": {"max_pages": 50, "max_depth": 3}
    # }

    # Context-based access control (simplified)
    context = Column(
        String(50),
        nullable=False,
        default="both",
        index=True
    )  # chatbot, chatflow, both

    # Context settings (access control) - deprecated in favor of simpler context field
    context_settings = Column(JSONB, nullable=False, default=dict)

    # Embedding configuration
    embedding_config = Column(JSONB, nullable=False, default=dict)

    # Vector store configuration
    vector_store_config = Column(JSONB, nullable=False, default=dict)

    # Indexing settings
    indexing_method = Column(String(50), nullable=False, default="high_quality")
    reindex_required = Column(Boolean, nullable=False, default=False)

    # Statistics
    total_documents = Column(Integer, nullable=False, default=0)
    total_chunks = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    last_indexed_at = Column(DateTime, nullable=True)

    # Processing metadata
    processed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    stats = Column(JSONB, nullable=True)
    # Example stats:
    # {
    #     "successful_pages": 47,
    #     "failed_pages": 3,
    #     "total_chunks": 850,
    #     "processing_duration_seconds": 165
    # }

    # Audit fields
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="knowledge_bases")
    creator = relationship("User")
    documents = relationship(
        "Document",
        back_populates="knowledge_base",
        cascade="all, delete-orphan"
    )
    members = relationship(
        "KBMember",
        back_populates="kb",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<KnowledgeBase(id={self.id}, name={self.name}, status={self.status})>"
