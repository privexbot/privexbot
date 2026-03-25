# KB Management APIs

**CRUD Operations**: Production Knowledge Base management

The KB Management APIs handle all operations on finalized Knowledge Bases including listing, inspection, maintenance, and CRUD operations. These endpoints work with production KBs stored in PostgreSQL and Qdrant vector databases.

## Overview

- **Base Path**: `/api/v1/kbs`
- **Storage**: PostgreSQL + Qdrant vector database
- **Performance**: <100ms for metadata operations, 2-30s for processing operations
- **Purpose**: Production KB management and maintenance
- **Access Control**: RBAC-based workspace permissions

## Authentication

All endpoints require authentication:
```http
Authorization: Bearer <jwt_token>
```

## KB CRUD Operations

### List Knowledge Bases

List all KBs accessible to the current user with filtering options.

```http
GET /api/v1/kbs/?workspace_id=550e8400-e29b-41d4-a716-446655440000&status=ready&context=both
```

**Query Parameters:**
- `workspace_id` (UUID, optional): Filter by specific workspace
- `status` (string, optional): Filter by status
- `context` (string, optional): Filter by context ("chatbot", "chatflow", "both")

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "API Documentation",
    "description": "Complete API reference and guides",
    "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ready",
    "stats": {
      "documents": 47,
      "chunks": 234,
      "last_updated": "2024-11-19T15:45:00Z",
      "size_mb": 12.5
    },
    "created_at": "2024-11-19T10:00:00Z",
    "updated_at": "2024-11-19T15:45:00Z",
    "created_by": "user123"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "User Guides",
    "description": "End-user documentation and tutorials",
    "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "stats": {
      "documents": 0,
      "chunks": 0,
      "last_updated": null,
      "size_mb": 0
    },
    "created_at": "2024-11-19T16:00:00Z",
    "updated_at": "2024-11-19T16:00:00Z",
    "created_by": "user456"
  }
]
```

**KB Statuses:**
- `processing`: Currently being processed (from draft finalization)
- `ready`: Successfully processed and available for use
- `ready_with_warnings`: Processed with some warnings (partial failures)
- `failed`: Processing failed
- `maintenance`: Temporarily unavailable for maintenance

**Workspace Scoping:**
- `workspace_id=null`: Returns KBs from ALL workspaces in user's organization
- `workspace_id=<uuid>`: Returns KBs from specific workspace only

**Error Responses:**
- `404 Not Found`: Workspace not found
- `403 Forbidden`: No access to workspace

---

### Get Knowledge Base Details

Get detailed information about a specific KB including configuration and statistics.

```http
GET /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "API Documentation",
  "description": "Complete API reference and guides",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ready",
  "config": {
    "chunking_strategy": "by_heading",
    "chunk_size": 1200,
    "chunk_overlap": 150,
    "preserve_code_blocks": true,
    "max_pages": 100,
    "max_depth": 4
  },
  "embedding_config": {
    "model": "all-MiniLM-L6-v2",
    "device": "cpu",
    "batch_size": 32,
    "normalize_embeddings": true,
    "vector_dimensions": 384
  },
  "vector_store_config": {
    "provider": "qdrant",
    "collection_name": "kb_550e8400_e29b_41d4_a716_446655440001",
    "distance_metric": "cosine",
    "index_size": 234
  },
  "indexing_method": "by_heading",
  "stats": {
    "documents": 47,
    "chunks": 234,
    "average_chunk_size": 956,
    "total_characters": 223704,
    "vector_count": 234,
    "last_updated": "2024-11-19T15:45:00Z",
    "processing_duration_minutes": 15,
    "size_mb": 12.5,
    "health_score": 0.98
  },
  "total_documents": 47,
  "total_chunks": 234,
  "error_message": null,
  "created_at": "2024-11-19T10:00:00Z",
  "updated_at": "2024-11-19T15:45:00Z",
  "created_by": "user123"
}
```

**Error Responses:**
- `404 Not Found`: Knowledge base not found
- `403 Forbidden`: No access to KB

---

### Delete Knowledge Base

Delete a KB and all associated data including vector embeddings.

```http
DELETE /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001
```

**Response (200 OK):**
```json
{
  "message": "KB 'API Documentation' deletion queued",
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "note": "Qdrant collection deletion is processing in background"
}
```

**Deletion Process:**
1. Queue background cleanup task for Qdrant collection
2. Immediately delete PostgreSQL records (CASCADE)
3. Background task deletes vector embeddings
4. Cleanup of temporary files and cache

**Access Control:**
- Only KB creator or workspace admin can delete
- Deletion is irreversible
- Background cleanup ensures complete data removal

**Error Responses:**
- `404 Not Found`: Knowledge base not found
- `403 Forbidden`: Insufficient permissions for deletion

## KB Maintenance Operations

### Re-index Knowledge Base

Manually trigger KB re-indexing to refresh embeddings.

```http
POST /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/reindex
```

**Response (200 OK):**
```json
{
  "message": "Re-indexing queued for KB 'API Documentation'",
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "task_id": "celery_task_xyz789",
  "status": "queued",
  "note": "Re-indexing will regenerate all embeddings and update Qdrant. This may take several minutes."
}
```

**Re-indexing Process:**
1. Set KB status to "processing"
2. Queue high-priority Celery task
3. Re-generate embeddings for all chunks
4. Update Qdrant collection with new vectors
5. Update KB status to "ready"

**When to Re-index:**
- Content freshness for frequently changing websites
- After embedding model upgrades
- Vector store corruption recovery
- Performance optimization

**Access Control:**
- KB creator or workspace admin only
- KB must be in re-indexable state ("ready", "ready_with_warnings", "failed")

**Error Responses:**
- `400 Bad Request`: KB not in re-indexable state
- `404 Not Found`: Knowledge base not found
- `403 Forbidden`: Insufficient permissions

---

### Get KB Statistics

Get detailed statistics about KB content and health.

```http
GET /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/stats
```

**Response (200 OK):**
```json
{
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "API Documentation",
  "status": "ready",
  "documents": {
    "total": 47,
    "active": 45,
    "by_status": {
      "completed": 45,
      "failed": 2
    },
    "active_by_status": {
      "completed": 45
    }
  },
  "chunks": {
    "total": 234,
    "avg_per_document": 5.2
  },
  "storage": {
    "total_content_size": 223704,
    "avg_chunk_size": 956
  },
  "health": {
    "qdrant_healthy": true,
    "vector_count_match": true,
    "last_health_check": "2024-11-19T16:30:00Z"
  },
  "performance": {
    "average_query_time_ms": 45,
    "queries_last_24h": 156,
    "cache_hit_rate": 0.78
  },
  "quality_metrics": {
    "content_coverage": 0.95,
    "chunk_quality_score": 0.87,
    "embedding_quality": 0.91
  }
}
```

**Health Indicators:**
- `qdrant_healthy`: Qdrant collection accessible and consistent
- `vector_count_match`: PostgreSQL chunks count matches Qdrant vectors
- `content_coverage`: Percentage of content successfully processed
- `chunk_quality_score`: Average quality score of chunks
- `embedding_quality`: Embedding generation success rate

**Error Responses:**
- `404 Not Found`: Knowledge base not found
- `500 Internal Server Error`: Health check failed

## Preview and Optimization

### Preview Re-chunking

Preview how existing KB would look with different chunking strategy.

```http
POST /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/preview-rechunk
```

**Request Body:**
```json
{
  "strategy": "semantic",
  "chunk_size": 800,
  "chunk_overlap": 100,
  "sample_documents": 5
}
```

**Request Parameters:**
- `strategy` (string, required): New chunking strategy to test
- `chunk_size` (int, default=1000): New chunk size (100-5000)
- `chunk_overlap` (int, default=200): New chunk overlap (0-1000)
- `sample_documents` (int, default=3): Number of documents to sample (1-10)

**Available Strategies:**
- `recursive`: Recursive text splitting
- `semantic`: AI-powered semantic splitting
- `by_heading`: Split by markdown headings
- `by_section`: Split by document sections
- `adaptive`: Automatically choose best approach
- `sentence_based`: Split by sentences
- `paragraph_based`: Split by paragraphs
- `hybrid`: Combination of multiple strategies

**Response (200 OK):**
```json
{
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "kb_name": "API Documentation",
  "current_config": {
    "strategy": "by_heading",
    "chunk_size": 1200,
    "chunk_overlap": 150
  },
  "new_config": {
    "strategy": "semantic",
    "chunk_size": 800,
    "chunk_overlap": 100
  },
  "comparison": {
    "current": {
      "total_chunks": 234,
      "avg_chunk_size": 956,
      "min_chunk_size": 245,
      "max_chunk_size": 1456
    },
    "new": {
      "total_chunks": 312,
      "avg_chunk_size": 723,
      "min_chunk_size": 156,
      "max_chunk_size": 987
    },
    "delta": {
      "chunks_change": +78,
      "chunks_percent": +33.3,
      "avg_size_change": -233,
      "recommendation": "More chunks with smaller size may improve retrieval precision but could lose some context. Consider testing with sample queries."
    }
  },
  "sample_chunks": [
    {
      "document_name": "Authentication Guide",
      "current_chunk": "# Authentication\n\nOur API uses JWT tokens...",
      "new_chunk": "Our API uses JWT tokens for secure authentication.",
      "improvement_analysis": "Better focused on single concept"
    }
  ],
  "documents_analyzed": 5,
  "total_documents": 47,
  "note": "Preview based on 5 sample documents. Results are representative but may vary across full KB."
}
```

**Preview Benefits:**
- **Fast Performance**: 1-5 seconds (no re-scraping needed)
- **Direct Comparison**: Current vs. new chunking side-by-side
- **Impact Analysis**: Detailed metrics on changes
- **Sample Chunks**: Examples of actual changes
- **Risk Assessment**: Recommendations based on content type

**Error Responses:**
- `400 Bad Request`: Invalid strategy or KB not in ready state
- `404 Not Found`: Knowledge base not found
- `500 Internal Server Error`: Preview generation failed

## Document Management

### List KB Documents

List all documents in a knowledge base with filtering and pagination.

```http
GET /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/documents?page=1&limit=20&status=completed&search=authentication
```

**Query Parameters:**
- `page` (int, default=1): Page number
- `limit` (int, default=20): Items per page (1-100)
- `status` (string, optional): Filter by document status
- `source_type` (string, optional): Filter by source type
- `search` (string, optional): Search in document names/URLs
- `include_disabled` (bool, default=false): Include disabled documents
- `include_archived` (bool, default=false): Include archived documents

**Response (200 OK):**
```json
{
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "total_documents": 47,
  "page": 1,
  "limit": 20,
  "total_pages": 3,
  "documents": [
    {
      "id": "doc_abc123",
      "name": "Authentication Guide",
      "url": "https://docs.example.com/auth",
      "source_type": "web_scraping",
      "status": "completed",
      "content_preview": "# Authentication\n\nOur API uses JWT tokens for secure authentication...",
      "word_count": 1456,
      "character_count": 9234,
      "chunk_count": 8,
      "created_at": "2024-11-19T10:30:00Z",
      "updated_at": "2024-11-19T10:35:00Z",
      "created_by": "user123"
    }
  ],
  "filters_applied": {
    "status": "completed",
    "search": "authentication",
    "include_disabled": false,
    "include_archived": false
  }
}
```

**Document Statuses:**
- `pending`: Created but not processed
- `processing`: Currently being processed
- `completed`: Successfully processed and indexed
- `failed`: Processing failed with errors

**Source Types:**
- `web_scraping`: Scraped from websites
- `file_upload`: Uploaded files (PDF, DOCX, etc.)
- `text_input`: Manually entered text
- `cloud_integration`: Google Docs, Notion, etc.

**Access Control:**
- Requires "read" permission on KB
- Disabled/archived documents only visible to KB admins

---

### Get Document Details

Get complete details of a specific document including full content.

```http
GET /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/documents/doc_abc123
```

**Response (200 OK):**
```json
{
  "id": "doc_abc123",
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Authentication Guide",
  "url": "https://docs.example.com/auth",
  "source_type": "web_scraping",
  "source_metadata": {
    "scraped_at": "2024-11-19T10:30:00Z",
    "scraping_method": "crawl",
    "user_agent": "PrivexBot/1.0",
    "final_url": "https://docs.example.com/auth",
    "redirects": 0
  },
  "content": "# Authentication\n\nOur API uses JWT tokens for secure authentication. Here's how to get started:\n\n## Getting a Token\n\n1. Send POST request to `/auth/login`\n2. Include email and password in request body\n3. Receive JWT token in response\n\n## Using the Token\n\nInclude the token in the Authorization header:\n\n```\nAuthorization: Bearer <your_jwt_token>\n```\n\n## Token Expiration\n\nTokens expire after 24 hours. Refresh tokens are available for extended sessions.",
  "content_preview": "# Authentication\n\nOur API uses JWT tokens for secure authentication. Here's how to get started...",
  "status": "completed",
  "processing_metadata": {
    "processed_at": "2024-11-19T10:35:00Z",
    "processing_duration_seconds": 23,
    "chunks_created": 8,
    "embeddings_generated": 8,
    "indexed_at": "2024-11-19T10:35:23Z"
  },
  "word_count": 1456,
  "character_count": 9234,
  "chunk_count": 8,
  "custom_metadata": {},
  "annotations": {
    "importance": "high",
    "category": "authentication",
    "tags": ["jwt", "security", "api"]
  },
  "is_enabled": true,
  "is_archived": false,
  "created_at": "2024-11-19T10:30:00Z",
  "updated_at": "2024-11-19T10:35:23Z",
  "created_by": "user123"
}
```

---

### Create Document

Manually create a new document in the KB with custom content.

```http
POST /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/documents
```

**Request Body:**
```json
{
  "name": "API Rate Limiting",
  "content": "# API Rate Limiting\n\n## Overview\n\nOur API implements rate limiting to ensure fair usage and maintain service quality.\n\n## Rate Limits\n\n- **Free tier**: 100 requests/hour\n- **Pro tier**: 1,000 requests/hour\n- **Enterprise**: Custom limits\n\n## Headers\n\nEvery API response includes rate limiting headers:\n\n- `X-RateLimit-Limit`: Your rate limit\n- `X-RateLimit-Remaining`: Requests remaining\n- `X-RateLimit-Reset`: Reset time (Unix timestamp)\n\n## Handling Rate Limits\n\nWhen you exceed your rate limit, you'll receive a `429 Too Many Requests` response.",
  "source_type": "text_input",
  "custom_metadata": {
    "category": "api-limits",
    "importance": "high",
    "version": "1.0"
  },
  "annotations": {
    "tags": ["rate-limiting", "api", "headers"],
    "priority": "high",
    "review_required": false
  }
}
```

**Request Parameters:**
- `name` (string, required): Document name (1-500 characters)
- `content` (string, required): Document content in markdown (50 chars - 10MB)
- `source_type` (string, default="text_input"): Source type identifier
- `custom_metadata` (object, optional): Custom metadata fields
- `annotations` (object, optional): Document annotations and tags

**Response (201 Created):**
```json
{
  "id": "doc_def456",
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "API Rate Limiting",
  "status": "processing",
  "message": "Document created and processing started",
  "processing_job_id": "celery_task_abc789",
  "note": "Document will be chunked, embedded, and indexed in Qdrant. Check status via GET /kbs/{kb_id}/documents/{doc_id}"
}
```

**Processing Flow:**
1. Create Document record (status: "processing")
2. Queue background task: `process_document_task`
3. Task performs: chunk → embed → index in Qdrant
4. Update status to "completed"

**Limits:**
- Content: 50 characters minimum, 10MB maximum
- Name: 1-500 characters
- Documents per KB: 10,000 maximum

**Access Control:**
- Requires "edit" permission on KB
- KB creator, workspace admin, KB admin, or KB editor can create

**Error Responses:**
- `400 Bad Request`: Content too short/long or invalid format
- `413 Request Entity Too Large`: Content exceeds 10MB limit
- `403 Forbidden`: Insufficient permissions

---

### Update Document

Update document content and metadata (triggers re-processing).

```http
PUT /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/documents/doc_abc123
```

**Request Body:**
```json
{
  "name": "Updated Authentication Guide",
  "content": "# Authentication (Updated)\n\nOur API uses JWT tokens for secure authentication. This guide has been updated with new information about token refresh and security best practices.\n\n## Getting a Token\n\n1. Send POST request to `/auth/login`\n2. Include email and password in request body\n3. Receive JWT token and refresh token in response\n\n## Token Refresh\n\nUse the refresh token to get new access tokens without re-authentication:\n\n```\nPOST /auth/refresh\nAuthorization: Bearer <refresh_token>\n```",
  "custom_metadata": {
    "version": "2.0",
    "last_reviewer": "security_team"
  },
  "is_enabled": true
}
```

**Request Parameters:**
- `name` (string, optional): New document name
- `content` (string, optional): New document content (triggers re-processing)
- `custom_metadata` (object, optional): Updated metadata
- `annotations` (object, optional): Updated annotations
- `is_enabled` (bool, optional): Enable/disable document and chunks

**Response (200 OK):**
```json
{
  "id": "doc_abc123",
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Updated Authentication Guide",
  "status": "processing",
  "message": "Document updated. Re-chunking and re-indexing in progress.",
  "processing_job_id": "celery_task_ghi012",
  "note": "Old chunks will be deleted and new chunks will be created. Check status via GET /kbs/{kb_id}/documents/{doc_id}"
}
```

**Re-processing Flow (when content updated):**
1. Update document content in PostgreSQL
2. Set status = "processing"
3. Delete old chunks from PostgreSQL
4. Delete old vectors from Qdrant
5. Queue background task: `reprocess_document_task`
6. Task performs: re-chunk → re-embed → re-index

**Critical Synchronization:**
- Old chunks MUST be deleted before new ones are created
- Qdrant and PostgreSQL MUST stay synchronized
- If Qdrant delete fails, document marked for retry

**Access Control:**
- Requires "edit" permission on KB

**Error Responses:**
- `400 Bad Request`: Invalid content or configuration
- `404 Not Found`: Document not found
- `500 Internal Server Error`: Re-processing failed

---

### Delete Document

Delete a document and all associated chunks and embeddings.

```http
DELETE /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/documents/doc_abc123
```

**Response (200 OK):**
```json
{
  "message": "Document 'Authentication Guide' deleted successfully",
  "deleted": {
    "document_id": "doc_abc123",
    "document_name": "Authentication Guide",
    "chunks_deleted": 8,
    "qdrant_points_deleted": 8
  }
}
```

**Deletion Process:**
1. Verify document exists and user has access
2. Delete from Qdrant FIRST (external system)
3. If Qdrant delete succeeds, delete from PostgreSQL
4. PostgreSQL CASCADE deletes associated chunks

**Critical Order:**
- Qdrant delete first (can fail due to network)
- PostgreSQL delete second (reliable with transactions)
- If Qdrant fails, mark document for cleanup retry

**Access Control:**
- Requires "edit" or "delete" permission on KB
- Editors can delete their own documents
- Admins can delete any document in the KB

**Error Responses:**
- `404 Not Found`: Document not found
- `403 Forbidden`: Insufficient permissions (can only delete own documents unless admin)
- `500 Internal Server Error`: Qdrant sync failed (document marked for retry)

## Chunk Management

### List KB Chunks

List and search chunks within a knowledge base.

```http
GET /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/chunks?page=1&limit=20&document_id=doc_abc123&search=JWT
```

**Query Parameters:**
- `page` (int, default=1): Page number
- `limit` (int, default=20): Items per page (1-100)
- `document_id` (UUID, optional): Filter chunks from specific document
- `search` (string, optional): Search in chunk content

**Response (200 OK):**
```json
{
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "total_chunks": 8,
  "page": 1,
  "limit": 20,
  "total_pages": 1,
  "chunks": [
    {
      "id": "chunk_xyz789",
      "document_id": "doc_abc123",
      "document_name": "Authentication Guide",
      "document_url": "https://docs.example.com/auth",
      "content": "Our API uses JWT tokens for secure authentication. Here's how to get started:\n\n## Getting a Token\n\n1. Send POST request to `/auth/login`\n2. Include email and password in request body\n3. Receive JWT token in response",
      "position": 0,
      "page_number": null,
      "word_count": 45,
      "character_count": 287,
      "is_enabled": true,
      "created_at": "2024-11-19T10:35:00Z"
    }
  ],
  "filters_applied": {
    "document_id": "doc_abc123",
    "search": "JWT"
  }
}
```

**Chunk Information:**
- `position`: Order within document (0-indexed)
- `page_number`: PDF page number (if applicable)
- `word_count`: Number of words in chunk
- `character_count`: Number of characters in chunk
- `is_enabled`: Whether chunk is active for search

**Access Control:**
- Requires "read" permission on KB
- Shows chunks from all accessible documents

## Advanced Operations

### Bulk Document Operations

#### Bulk Enable/Disable Documents
```http
POST /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/documents/bulk-update
```

**Request Body:**
```json
{
  "action": "disable",
  "document_ids": [
    "doc_abc123",
    "doc_def456",
    "doc_ghi789"
  ],
  "reason": "Outdated content pending review"
}
```

**Response:**
```json
{
  "updated_documents": 3,
  "updated_chunks": 24,
  "action_performed": "disable",
  "affected_documents": [
    {
      "id": "doc_abc123",
      "name": "Authentication Guide",
      "chunks_updated": 8
    }
  ]
}
```

#### Bulk Delete Documents
```http
POST /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/documents/bulk-delete
```

**Request Body:**
```json
{
  "document_ids": [
    "doc_old123",
    "doc_old456"
  ],
  "confirm_deletion": true
}
```

**Response:**
```json
{
  "deletion_summary": {
    "documents_deleted": 2,
    "chunks_deleted": 15,
    "qdrant_points_deleted": 15,
    "errors": []
  },
  "deleted_documents": [
    {
      "id": "doc_old123",
      "name": "Deprecated API v1",
      "chunks_deleted": 7
    },
    {
      "id": "doc_old456",
      "name": "Old Integration Guide",
      "chunks_deleted": 8
    }
  ]
}
```

### Health and Diagnostics

#### KB Health Check
```http
GET /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/health
```

**Response:**
```json
{
  "overall_health": "healthy",
  "checks": {
    "postgresql": {
      "status": "healthy",
      "documents_count": 47,
      "chunks_count": 234,
      "response_time_ms": 12
    },
    "qdrant": {
      "status": "healthy",
      "collection_exists": true,
      "vector_count": 234,
      "collection_size_mb": 45.6,
      "response_time_ms": 28
    },
    "synchronization": {
      "status": "healthy",
      "chunks_vectors_match": true,
      "last_sync_check": "2024-11-19T16:45:00Z"
    }
  },
  "recommendations": [],
  "last_health_check": "2024-11-19T16:45:00Z"
}
```

#### Repair Operations
```http
POST /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/repair
```

**Request Body:**
```json
{
  "repair_type": "sync_vectors",
  "force": false,
  "dry_run": true
}
```

**Repair Types:**
- `sync_vectors`: Synchronize Qdrant vectors with PostgreSQL chunks
- `rebuild_index`: Rebuild Qdrant collection from scratch
- `cleanup_orphans`: Remove orphaned chunks/vectors
- `update_stats`: Recalculate KB statistics

## Error Handling

### Common Error Patterns

#### Access Control Errors
```json
{
  "detail": "Insufficient permissions for this operation",
  "error_code": "INSUFFICIENT_PERMISSIONS",
  "required_permission": "edit",
  "user_permissions": ["read"],
  "suggestion": "Contact workspace admin to request edit permissions"
}
```

#### Resource Not Found
```json
{
  "detail": "Knowledge base not found",
  "error_code": "KB_NOT_FOUND",
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "suggestion": "Verify KB ID and workspace access"
}
```

#### Processing Errors
```json
{
  "detail": "Document processing failed: Content too large",
  "error_code": "CONTENT_SIZE_EXCEEDED",
  "max_size_mb": 10,
  "actual_size_mb": 15.2,
  "document_name": "Large Technical Manual",
  "suggestion": "Split document into smaller sections or reduce content size"
}
```

#### Vector Store Errors
```json
{
  "detail": "Vector store operation failed",
  "error_code": "QDRANT_ERROR",
  "operation": "delete_vectors",
  "qdrant_error": "Collection not found",
  "recovery_action": "marked_for_retry",
  "suggestion": "Check Qdrant service status and retry operation"
}
```

### Recovery Procedures

#### Document Processing Failures
1. Check document status and error message
2. Verify content format and size
3. Retry with adjusted parameters
4. Contact support if persistent

#### Vector Synchronization Issues
1. Run health check to identify mismatches
2. Use repair operations to resync
3. Consider full re-indexing for severe corruption
4. Monitor health metrics post-repair

#### Performance Issues
1. Check KB statistics for unusual patterns
2. Review chunk size and strategy effectiveness
3. Consider re-chunking with optimized parameters
4. Monitor query performance and adjust as needed

---

**Last Updated**: November 2024
**API Version**: 1.0