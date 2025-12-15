"""
Vector Store Service - Abstraction layer for multiple vector database providers.

WHY:
- Flexible support for ANY vector database (FAISS, Weaviate, Qdrant, Milvus, etc.)
- Users choose their preferred provider based on needs/budget
- Consistent interface regardless of backend
- Easy migration between providers

HOW:
- Abstract base class defines interface
- Provider-specific adapters implement interface
- Knowledge Base config specifies which provider to use
- Service routes to appropriate adapter

KEY DESIGN PRINCIPLE:
- Provider-agnostic code in application layer
- All vector store operations go through this service
- Configuration-driven provider selection

PSEUDOCODE:
-----------

PROVIDER SUPPORT:
-----------------
- FAISS (Facebook AI Similarity Search) - Local, file-based, free
- Weaviate - Cloud/self-hosted, open-source
- Qdrant - Cloud/self-hosted, specialized for filtering
- Milvus - Cloud/self-hosted, production-scale
- Pinecone - Cloud, managed, expensive but easy
- Redis (with RediSearch) - In-memory, fast, good for caching
- Chroma - Local/cloud, simple, good for development
- Elasticsearch - Full-text + vector search
- Vespa - Enterprise-scale, complex
- Vald - Distributed, high-performance


ABSTRACT BASE CLASS:
--------------------
class VectorStoreAdapter(ABC):
    WHY: Define interface all providers must implement
    HOW: Abstract methods force implementation

    @abstractmethod
    def create_collection(kb_id: UUID, dimensions: int, metadata_config: dict):
        WHY: Initialize collection/index for knowledge base
        HOW: Provider-specific collection creation
        EXAMPLE:
            FAISS: Create index file
            Qdrant: Create collection with schema
            Weaviate: Create class with properties

    @abstractmethod
    def upsert_embeddings(kb_id: UUID, chunks: list[dict]):
        WHY: Add or update chunk embeddings
        HOW: Batch upsert for performance

        CHUNKS FORMAT:
        [
            {
                "id": "chunk_uuid",
                "embedding": [0.1, 0.2, ...],  # Vector
                "metadata": {
                    "chunk_id": "uuid",
                    "document_id": "uuid",
                    "document_name": "FAQ.pdf",
                    "page_number": 5,
                    "content": "text...",
                    "heading": "Pricing",
                    "custom_metadata": {...}
                }
            }
        ]

    @abstractmethod
    def search(kb_id: UUID, query_embedding: list[float], filters: dict, top_k: int) -> list[dict]:
        WHY: Semantic search for relevant chunks
        HOW: Vector similarity search with metadata filtering

        FILTERS FORMAT:
        {
            "document_id": {"$eq": "uuid"},
            "page_number": {"$gte": 1, "$lte": 10},
            "custom_metadata.department": {"$eq": "Sales"}
        }

        RETURNS:
        [
            {
                "id": "chunk_uuid",
                "score": 0.89,  # Similarity score
                "metadata": {...}
            }
        ]

    @abstractmethod
    def delete_embeddings(kb_id: UUID, chunk_ids: list[UUID]):
        WHY: Remove chunks when deleted
        HOW: Batch delete for performance

    @abstractmethod
    def delete_collection(kb_id: UUID):
        WHY: Remove entire KB
        HOW: Delete index/collection

    @abstractmethod
    def get_stats(kb_id: UUID) -> dict:
        WHY: Get collection statistics
        RETURNS:
        {
            "total_vectors": 1500,
            "dimensions": 1536,
            "storage_size_bytes": 45000000
        }


MAIN SERVICE CLASS:
-------------------
class VectorStoreService:
    WHY: Route operations to correct provider
    HOW: Load provider from KB config, delegate to adapter

    def __init__(self):
        self.adapters = {
            "faiss": FAISSAdapter(),
            "weaviate": WeaviateAdapter(),
            "qdrant": QdrantAdapter(),
            "milvus": MilvusAdapter(),
            "pinecone": PineconeAdapter(),
            "redis": RedisAdapter(),
            "chroma": ChromaAdapter(),
            "elasticsearch": ElasticsearchAdapter(),
            "vespa": VespaAdapter(),
            "vald": ValdAdapter()
        }

    def get_adapter(self, kb: KnowledgeBase) -> VectorStoreAdapter:
        WHY: Select correct adapter for KB
        HOW: Read provider from KB config

        provider = kb.vector_store_config["provider"]

        if provider not in self.adapters:
            raise ValueError(f"Unsupported vector store provider: {provider}")

        return self.adapters[provider]

    def create_collection(self, kb: KnowledgeBase):
        WHY: Initialize vector store for new KB
        HOW: Delegate to provider adapter

        adapter = self.get_adapter(kb)
        dimensions = kb.embedding_config["dimensions"]
        metadata_config = kb.vector_store_config.get("metadata_config", {})

        adapter.create_collection(kb.id, dimensions, metadata_config)

    def upsert_chunks(self, kb: KnowledgeBase, chunks: list[Chunk]):
        WHY: Add/update chunk embeddings
        HOW: Format chunks and delegate to adapter

        adapter = self.get_adapter(kb)

        # Format chunks for vector store
        formatted_chunks = [
            {
                "id": str(chunk.id),
                "embedding": chunk.embedding,
                "metadata": {
                    "chunk_id": str(chunk.id),
                    "document_id": str(chunk.document_id),
                    "document_name": chunk.document.name,
                    "page_number": chunk.page_number,
                    "content": chunk.content,
                    "heading": chunk.chunk_metadata.get("heading"),
                    "custom_metadata": chunk.document.custom_metadata,
                    "created_at": chunk.created_at.isoformat(),
                    "is_enabled": chunk.is_enabled
                }
            }
            for chunk in chunks
        ]

        adapter.upsert_embeddings(kb.id, formatted_chunks)

    def search(self, kb: KnowledgeBase, query_embedding: list[float], filters: dict, top_k: int):
        WHY: Search for relevant chunks
        HOW: Delegate to adapter with filters

        adapter = self.get_adapter(kb)

        # Add default filter for enabled chunks
        filters["is_enabled"] = {"$eq": True}

        results = adapter.search(kb.id, query_embedding, filters, top_k)

        # Results format:
        # [{"id": "chunk_uuid", "score": 0.89, "metadata": {...}}]

        return results

    def delete_chunks(self, kb: KnowledgeBase, chunk_ids: list[UUID]):
        WHY: Remove deleted chunks from vector store
        HOW: Delegate to adapter

        adapter = self.get_adapter(kb)
        adapter.delete_embeddings(kb.id, chunk_ids)

    def delete_kb(self, kb: KnowledgeBase):
        WHY: Remove entire KB from vector store
        HOW: Delegate to adapter

        adapter = self.get_adapter(kb)
        adapter.delete_collection(kb.id)

    def migrate_kb(self, kb: KnowledgeBase, new_provider: str, new_config: dict):
        WHY: Move KB to different vector store
        HOW: Export from old, import to new, verify, update config

        1. Get all chunks with embeddings:
            chunks = db.query(Chunk).filter(Chunk.document.knowledge_base_id == kb.id).all()

        2. Create new collection:
            old_provider = kb.vector_store_config["provider"]
            kb.vector_store_config["provider"] = new_provider
            kb.vector_store_config["connection"] = new_config

            new_adapter = self.get_adapter(kb)
            new_adapter.create_collection(kb.id, kb.embedding_config["dimensions"], {})

        3. Batch upsert to new store:
            for batch in chunks_batched(chunks, batch_size=100):
                self.upsert_chunks(kb, batch)

        4. Verify migration:
            old_adapter = self.adapters[old_provider]
            old_stats = old_adapter.get_stats(kb.id)
            new_stats = new_adapter.get_stats(kb.id)

            if old_stats["total_vectors"] != new_stats["total_vectors"]:
                raise MigrationError("Vector counts don't match")

        5. Delete old collection:
            old_adapter.delete_collection(kb.id)

        6. Update KB config:
            db.commit()


FAISS ADAPTER:
--------------
class FAISSAdapter(VectorStoreAdapter):
    WHY: Free, local, fast for small-medium datasets
    HOW: File-based index stored on disk

    def create_collection(kb_id: UUID, dimensions: int, metadata_config: dict):
        import faiss

        # Choose index type based on size
        index = faiss.IndexFlatIP(dimensions)  # Inner product (cosine similarity)

        # For larger datasets, use IVF for speed
        # index = faiss.IndexIVFFlat(quantizer, dimensions, nlist=100)

        # Save index to disk
        index_path = f"/data/kb_{kb_id}/faiss.index"
        faiss.write_index(index, index_path)

        # Store metadata separately (JSON file)
        metadata_path = f"/data/kb_{kb_id}/metadata.json"
        with open(metadata_path, "w") as f:
            json.dump({}, f)

    def upsert_embeddings(kb_id: UUID, chunks: list[dict]):
        import faiss

        # Load existing index
        index_path = f"/data/kb_{kb_id}/faiss.index"
        index = faiss.read_index(index_path)

        # Extract embeddings and IDs
        embeddings = np.array([chunk["embedding"] for chunk in chunks]).astype("float32")
        ids = [chunk["id"] for chunk in chunks]

        # Add to index
        index.add(embeddings)
        faiss.write_index(index, index_path)

        # Store metadata
        metadata_path = f"/data/kb_{kb_id}/metadata.json"
        with open(metadata_path, "r") as f:
            metadata = json.load(f)

        for chunk in chunks:
            metadata[chunk["id"]] = chunk["metadata"]

        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

    def search(kb_id: UUID, query_embedding: list[float], filters: dict, top_k: int):
        import faiss

        # Load index
        index_path = f"/data/kb_{kb_id}/faiss.index"
        index = faiss.read_index(index_path)

        # Search
        query = np.array([query_embedding]).astype("float32")
        scores, indices = index.search(query, top_k * 2)  # Get more for filtering

        # Load metadata
        metadata_path = f"/data/kb_{kb_id}/metadata.json"
        with open(metadata_path, "r") as f:
            all_metadata = json.load(f)

        # Apply filters and format results
        results = []
        for idx, score in zip(indices[0], scores[0]):
            chunk_id = get_id_by_index(idx)  # Map FAISS index to chunk ID
            metadata = all_metadata[chunk_id]

            # Apply filters
            if not matches_filters(metadata, filters):
                continue

            results.append({
                "id": chunk_id,
                "score": float(score),
                "metadata": metadata
            })

            if len(results) >= top_k:
                break

        return results


QDRANT ADAPTER:
---------------
class QdrantAdapter(VectorStoreAdapter):
    WHY: Excellent filtering, cloud/self-hosted, cost-effective
    HOW: REST API with Python client

    def __init__(self):
        from qdrant_client import QdrantClient
        # Connection configured per KB in vector_store_config

    def create_collection(kb_id: UUID, dimensions: int, metadata_config: dict):
        from qdrant_client import QdrantClient
        from qdrant_client.models import VectorParams, Distance

        client = QdrantClient(url=config["url"], api_key=config["api_key"])

        collection_name = f"kb_{kb_id}"

        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=dimensions,
                distance=Distance.COSINE
            )
        )

    def upsert_embeddings(kb_id: UUID, chunks: list[dict]):
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        client = QdrantClient(url=config["url"], api_key=config["api_key"])

        points = [
            PointStruct(
                id=chunk["id"],
                vector=chunk["embedding"],
                payload=chunk["metadata"]
            )
            for chunk in chunks
        ]

        client.upsert(
            collection_name=f"kb_{kb_id}",
            points=points
        )

    def search(kb_id: UUID, query_embedding: list[float], filters: dict, top_k: int):
        from qdrant_client import QdrantClient
        from qdrant_client.models import Filter, FieldCondition

        client = QdrantClient(url=config["url"], api_key=config["api_key"])

        # Convert filters to Qdrant format
        qdrant_filter = self._build_qdrant_filter(filters)

        results = client.search(
            collection_name=f"kb_{kb_id}",
            query_vector=query_embedding,
            query_filter=qdrant_filter,
            limit=top_k
        )

        return [
            {
                "id": result.id,
                "score": result.score,
                "metadata": result.payload
            }
            for result in results
        ]


WEAVIATE ADAPTER:
-----------------
class WeaviateAdapter(VectorStoreAdapter):
    WHY: Open-source, cloud/self-hosted, good for hybrid search
    HOW: GraphQL API with Python client

    def create_collection(kb_id: UUID, dimensions: int, metadata_config: dict):
        import weaviate

        client = weaviate.Client(url=config["url"], auth_client_secret=config["api_key"])

        class_name = f"KnowledgeBase_{kb_id}".replace("-", "_")

        class_schema = {
            "class": class_name,
            "vectorizer": "none",  # We provide embeddings
            "properties": [
                {"name": "chunk_id", "dataType": ["string"]},
                {"name": "document_id", "dataType": ["string"]},
                {"name": "document_name", "dataType": ["string"]},
                {"name": "page_number", "dataType": ["int"]},
                {"name": "content", "dataType": ["text"]},
                {"name": "heading", "dataType": ["string"]},
                {"name": "custom_metadata", "dataType": ["object"]},
                {"name": "is_enabled", "dataType": ["boolean"]}
            ]
        }

        client.schema.create_class(class_schema)

    def upsert_embeddings(kb_id: UUID, chunks: list[dict]):
        import weaviate

        client = weaviate.Client(url=config["url"], auth_client_secret=config["api_key"])

        class_name = f"KnowledgeBase_{kb_id}".replace("-", "_")

        with client.batch as batch:
            for chunk in chunks:
                batch.add_data_object(
                    data_object=chunk["metadata"],
                    class_name=class_name,
                    uuid=chunk["id"],
                    vector=chunk["embedding"]
                )


PINECONE ADAPTER:
-----------------
class PineconeAdapter(VectorStoreAdapter):
    WHY: Fully managed, easy to use, scales automatically
    HOW: Cloud service with Python SDK

    def create_collection(kb_id: UUID, dimensions: int, metadata_config: dict):
        import pinecone

        pinecone.init(api_key=config["api_key"], environment=config["environment"])

        index_name = f"privexbot-kb-{kb_id}"

        pinecone.create_index(
            name=index_name,
            dimension=dimensions,
            metric="cosine",
            metadata_config={"indexed": ["document_id", "page_number", "is_enabled"]}
        )

    def upsert_embeddings(kb_id: UUID, chunks: list[dict]):
        import pinecone

        pinecone.init(api_key=config["api_key"], environment=config["environment"])
        index = pinecone.Index(f"privexbot-kb-{kb_id}")

        vectors = [
            (chunk["id"], chunk["embedding"], chunk["metadata"])
            for chunk in chunks
        ]

        index.upsert(vectors)


USAGE IN APPLICATION:
---------------------
# Create KB
kb = create_knowledge_base(name="Product Docs", vector_store="qdrant")
vector_store_service.create_collection(kb)

# Add documents
document = upload_document(kb, file)
chunks = chunk_document(document)
embeddings = generate_embeddings(chunks)

for chunk, embedding in zip(chunks, embeddings):
    chunk.embedding = embedding

db.add_all(chunks)
db.commit()

vector_store_service.upsert_chunks(kb, chunks)

# Search
query = "How do I reset my password?"
query_embedding = generate_embedding(query)
results = vector_store_service.search(
    kb=kb,
    query_embedding=query_embedding,
    filters={"document_name": {"$eq": "FAQ.pdf"}},
    top_k=5
)

# Migrate provider
vector_store_service.migrate_kb(
    kb=kb,
    new_provider="weaviate",
    new_config={"url": "https://...", "api_key": "..."}
)


HYBRID SEARCH:
--------------
WHY: Combine semantic and keyword search for better results
HOW: Parallel search + result fusion

def hybrid_search(kb: KnowledgeBase, query: str, top_k: int):
    1. Semantic search:
        query_embedding = embedding_service.embed(query)
        semantic_results = vector_store_service.search(kb, query_embedding, {}, top_k * 2)

    2. Keyword search (database):
        keyword_results = db.query(Chunk).filter(
            Chunk.keywords.overlap(extract_keywords(query)),
            Chunk.is_enabled == True
        ).limit(top_k * 2)

    3. Fusion (Reciprocal Rank Fusion):
        combined = merge_and_rerank(semantic_results, keyword_results)
        return combined[:top_k]


FILTER TRANSLATION:
-------------------
WHY: Different providers use different filter syntax
HOW: Translate standard format to provider-specific

Standard format:
{
    "document_id": {"$eq": "uuid"},
    "page_number": {"$gte": 1, "$lte": 10}
}

Qdrant:
Filter(
    must=[
        FieldCondition(key="document_id", match=MatchValue(value="uuid")),
        FieldCondition(key="page_number", range=Range(gte=1, lte=10))
    ]
)

Weaviate:
{
    "operator": "And",
    "operands": [
        {"path": ["document_id"], "operator": "Equal", "valueString": "uuid"},
        {"path": ["page_number"], "operator": "GreaterThanEqual", "valueInt": 1}
    ]
}


PERFORMANCE OPTIMIZATION:
-------------------------
1. Batch operations (upsert 100+ chunks at once)
2. Connection pooling
3. Async operations where supported
4. Caching frequent queries
5. Index optimization per provider
6. Metadata filtering before vector search (if supported)
"""
