# Knowledge Base Architecture Q&A

## Direct Answers to Your Architecture Questions

### Q: When a user creates a KB using URL, does it create document, chunk, and vector store?

**Yes, but in a specific sequence:**

1. **Phase 1 (Draft)**: Only Redis storage, no database writes
2. **Phase 2 (Finalization)**: Creates KB record + Document placeholders in PostgreSQL
3. **Phase 3 (Background Processing)**: Creates Chunks in PostgreSQL + Vectors in Qdrant

**Detailed Flow:**
```
User creates KB with URL
    ↓
Draft stored in Redis (draft:kb:{id})
    ↓
User clicks "Create KB" (Finalize)
    ↓
PostgreSQL: KnowledgeBase record created
PostgreSQL: Document records created (status="pending", chunk_count=0)
Qdrant: Collection created (kb_{kb_id})
    ↓
Celery Task starts background processing
    ↓
Web scraping/crawling occurs
    ↓
Content chunked using KB's chunking strategy
    ↓
PostgreSQL: Chunk records created
Qdrant: Vectors indexed in collection
PostgreSQL: Document status → "completed", chunk_count updated
```

### Q: How does document adding work? Does it rechunk or create another vector?

**Document adding is ADDITIVE, not destructive:**

- ✅ **Creates new vectors** for the new document
- ❌ **Does NOT rechunk existing documents**
- ✅ **Appends to existing Qdrant collection**
- ❌ **Does NOT reprocess existing content**

**Flow when adding text document:**
```
POST /api/v1/kbs/{kb_id}/documents
    ↓
Create Document record (status="processing")
    ↓
Queue Celery task: process_document_task
    ↓
Chunk NEW document only (inherits KB's chunking config)
    ↓
Generate embeddings for NEW chunks only
    ↓
APPEND vectors to existing Qdrant collection kb_{kb_id}
    ↓
Save NEW chunks to PostgreSQL
    ↓
Update Document status → "completed"
```

**File upload follows identical pattern.**

### Q: How does the new document get stored in vector store (Qdrant) with existing documents?

**Qdrant Collections are ADDITIVE containers:**

```
Collection: kb_123e4567-e89b-12d3-a456-426614174000

BEFORE adding new document:
├── Document 1 (from URL scraping)
│   ├── Vector: doc1_0 + metadata
│   ├── Vector: doc1_1 + metadata
│   └── Vector: doc1_2 + metadata

AFTER adding text document:
├── Document 1 (unchanged)
│   ├── Vector: doc1_0 + metadata
│   ├── Vector: doc1_1 + metadata
│   └── Vector: doc1_2 + metadata
├── Document 2 (NEW - text input)
│   ├── Vector: doc2_0 + metadata
│   ├── Vector: doc2_1 + metadata
│   └── Vector: doc2_3 + metadata

Search queries will find relevant chunks from ANY document in the collection.
```

**Key Technical Details:**
- **Vector ID Format**: `{document_id}_{chunk_index}` (e.g., `doc1_0`, `doc2_1`)
- **Metadata Preservation**: Each vector includes document_id, kb_id, source info
- **No Reprocessing**: Existing vectors remain untouched
- **Unified Search**: All documents searchable together

### Q: Does it combine all docs for that KB?

**Yes, for search purposes:**

- **Storage**: All documents' chunks live in the same Qdrant collection
- **Search**: Queries search across ALL documents simultaneously
- **Ranking**: Results ranked by relevance regardless of source document
- **Filtering**: Can optionally filter by document_id, source_type, etc.

**Search Example:**
```python
# Search across entire KB
results = qdrant_service.search_similar_chunks(
    collection_name="kb_123e4567",
    query_vector=query_embedding,
    limit=10
)
# Returns top 10 most relevant chunks from ANY document

# Search within specific document only
results = qdrant_service.search_similar_chunks(
    collection_name="kb_123e4567",
    query_vector=query_embedding,
    filter_conditions={"document_id": "specific_doc_id"},
    limit=10
)
```

### Q: What are sources, documents, chunks in this project?

**Clear Definitions:**

1. **Sources** (Input Phase):
   - **Definition**: Raw input provided by user during KB creation
   - **Examples**: URL "https://docs.example.com", uploaded "manual.pdf", text paste
   - **Storage**: Redis draft, then source_url/source_metadata in Document record
   - **Lifecycle**: Created during draft phase, processed during finalization

2. **Documents** (Database Records):
   - **Definition**: Database entities representing processed sources
   - **Table**: `documents` in PostgreSQL
   - **Relationship**: 1 Source → 1+ Documents (URL crawling can create multiple docs)
   - **Status**: "pending" → "processing" → "completed" or "failed"

3. **Chunks** (Processing Units):
   - **Definition**: Text segments created from document content
   - **Purpose**: Sized appropriately for embedding models (~1000 chars)
   - **Storage**: PostgreSQL `chunks` table + Qdrant vectors
   - **Creation**: Via chunking strategies (recursive, sentence, heading, etc.)

**Relationship Diagram:**
```
User Input Sources
    ↓ (Processing)
Database Documents
    ↓ (Chunking)
Text Chunks
    ↓ (Embedding)
Vector Embeddings (Qdrant)
```

### Q: What is collection in Qdrant and how are we using it?

**Qdrant Collection = Vector Database for ONE Knowledge Base**

**Architecture:**
- **One Collection Per KB**: Each KB gets its own isolated collection
- **Naming Convention**: `kb_{kb_id}` (e.g., `kb_123e4567-e89b-12d3-a456-426614174000`)
- **Content**: All chunks from all documents in that KB
- **Configuration**: 1536-dimensional vectors (OpenAI), cosine similarity, HNSW index

**Collection Structure:**
```python
Collection: kb_123e4567
├── Configuration:
│   ├── Vector Size: 1536 (OpenAI text-embedding-ada-002)
│   ├── Distance: Cosine Similarity
│   ├── Index: HNSW (fast approximate search)
│   └── Metadata: Enabled (for filtering)
├── Vectors:
│   ├── doc1_0: [0.1, 0.2, ...] + {"document_id": "doc1", "source": "web"}
│   ├── doc1_1: [0.3, 0.4, ...] + {"document_id": "doc1", "source": "web"}
│   ├── doc2_0: [0.5, 0.6, ...] + {"document_id": "doc2", "source": "text"}
│   └── doc2_1: [0.7, 0.8, ...] + {"document_id": "doc2", "source": "text"}
└── Operations:
    ├── Search: Find similar vectors across all documents
    ├── Filter: Restrict search to specific documents/sources
    └── Upsert: Add new vectors (from new documents)
```

**Key Benefits:**
- **Isolation**: Different KBs can't cross-contaminate search results
- **Performance**: Dedicated index per KB optimized for that content
- **Scalability**: Can handle millions of vectors per collection
- **Flexibility**: Each KB can have different embedding models/dimensions

### Q: How can we allow users to select chunk configuration when adding docs?

**Implementation Strategy** (based on current architecture):

**Backend** (Already Supports This):
```python
# The process_document_task already accepts kb_config parameter
# We can pass document-specific config through this parameter

def process_document_task(document_id, content, kb_config):
    # kb_config can contain document-specific overrides
    chunking_config = kb_config.get("chunking_config", {})

    # Document overrides KB defaults
    strategy = chunking_config.get("strategy", "recursive")
    chunk_size = chunking_config.get("chunk_size", 1000)
    chunk_overlap = chunking_config.get("chunk_overlap", 200)
```

**Frontend Implementation Needed:**
```typescript
// Add to document creation forms
interface DocumentChunkingConfig {
  useKbDefault: boolean;
  customConfig?: {
    strategy: 'recursive' | 'sentence' | 'by_heading' | 'no_chunking';
    chunk_size: number;
    chunk_overlap: number;
  };
}

// In document creation dialog:
<DocumentChunkingConfigSection
  kbDefault={kb.chunking_config}
  value={documentConfig}
  onChange={setDocumentConfig}
/>
```

**API Update Needed:**
```python
# Extend CreateDocumentRequest schema
class CreateDocumentRequest(BaseModel):
    name: str
    content: str
    source_type: str = "text_input"

    # NEW: Optional chunking override
    chunking_config: Optional[ChunkingConfigOverride] = None

class ChunkingConfigOverride(BaseModel):
    use_kb_default: bool = True
    strategy: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
```

## Architecture Best Practices Summary

### ✅ Current Strengths
1. **Draft-First**: Prevents database pollution during experimentation
2. **Additive Documents**: New content doesn't reprocess existing content
3. **Isolated Collections**: Each KB has its own vector space
4. **Background Processing**: Heavy operations don't block UI
5. **Flexible Chunking**: Multiple strategies with configurable parameters

### 🔧 Enhancement Opportunities
1. **Document-Level Chunking UI**: Expose backend capability in frontend
2. **Chunk Preview**: Show users how content will be split before processing
3. **Reprocessing Options**: Allow changing chunking strategy for existing docs
4. **Collection Analytics**: Show chunk distribution, sizes, search performance
5. **Advanced File Support**: PDF, DOCX, etc. (backend foundation exists)

### 🏗️ Architectural Principles
1. **Separation of Concerns**: Draft → DB → Processing → Vector Storage
2. **Configuration Inheritance**: KB → Document → Chunk levels
3. **Privacy-First**: Self-hosted Qdrant, no external vector services
4. **Performance-Optimized**: Background tasks, efficient vector search
5. **User-Friendly**: Progressive disclosure, sensible defaults, clear feedback

The architecture is well-designed and already supports most advanced features at the backend level. The main work needed is exposing these capabilities through improved frontend interfaces and user experience enhancements.