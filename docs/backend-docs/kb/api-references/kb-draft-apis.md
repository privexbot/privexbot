# KB Draft Management APIs

**Phase 1**: Draft Mode (Redis-only operations)

The KB Draft Management APIs handle the initial phase of Knowledge Base creation where users configure their KB without database writes. All operations are fast (<50ms), stored in Redis with 24-hour TTL, and non-committal until finalization.

## Overview

- **Base Path**: `/api/v1/kb-drafts`
- **Storage**: Redis (24hr TTL)
- **Performance**: <50ms per operation
- **Purpose**: Fast, non-committal KB configuration

## Authentication

All endpoints require authentication:
```http
Authorization: Bearer <jwt_token>
```

## Core Draft Operations

### Create KB Draft

Create a new KB draft in Redis.

```http
POST /api/v1/kb-drafts/
```

**Request Body:**
```json
{
  "name": "API Documentation KB",
  "description": "Knowledge base for API documentation",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "context": "both"
}
```

**Request Parameters:**
- `name` (string, required): KB name (1-255 characters)
- `description` (string, optional): KB description
- `workspace_id` (UUID, required): Target workspace ID
- `context` (string, default="both"): Usage context ("chatbot", "chatflow", "both")

**Response (201 Created):**
```json
{
  "draft_id": "kb_draft_1234567890abcdef",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2024-11-20T15:30:00Z",
  "message": "KB draft created successfully (stored in Redis, no database writes)"
}
```

**Error Responses:**
- `404 Not Found`: Workspace not found
- `403 Forbidden`: No access to workspace

---

### Get KB Draft

Retrieve a KB draft from Redis.

```http
GET /api/v1/kb-drafts/{draft_id}
```

**Path Parameters:**
- `draft_id` (string): Draft identifier

**Response (200 OK):**
```json
{
  "draft_id": "kb_draft_1234567890abcdef",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_by": "user123",
  "created_at": "2024-11-19T15:30:00Z",
  "updated_at": "2024-11-19T15:30:00Z",
  "expires_at": "2024-11-20T15:30:00Z",
  "name": "API Documentation KB",
  "description": "Knowledge base for API documentation",
  "sources": [
    {
      "id": "source_1",
      "type": "web_url",
      "url": "https://docs.example.com",
      "config": {
        "method": "crawl",
        "max_pages": 50,
        "max_depth": 3
      }
    }
  ],
  "chunking_config": {
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "preserve_code_blocks": true
  },
  "embedding_config": {
    "model": "all-MiniLM-L6-v2",
    "device": "cpu",
    "batch_size": 32,
    "normalize_embeddings": true
  }
}
```

**Error Responses:**
- `404 Not Found`: Draft not found or expired
- `403 Forbidden`: Access denied (not draft owner)

---

### Delete KB Draft

Delete a KB draft from Redis.

```http
DELETE /api/v1/kb-drafts/{draft_id}
```

**Response (200 OK):**
```json
{
  "message": "KB draft deleted"
}
```

**Error Responses:**
- `404 Not Found`: Draft not found or expired
- `403 Forbidden`: Access denied

## Source Management

### Add Web Source

Add a web URL to the KB draft.

```http
POST /api/v1/kb-drafts/{draft_id}/sources/web
```

**Request Body:**
```json
{
  "url": "https://docs.example.com/introduction",
  "config": {
    "method": "crawl",
    "max_pages": 50,
    "max_depth": 3,
    "include_patterns": ["/docs/**", "/guides/**"],
    "exclude_patterns": ["/admin/**"],
    "stealth_mode": true,
    "wait_for_selector": null,
    "extract_main_content": true,
    "remove_nav_elements": true
  }
}
```

**Config Options:**
- `method` (string): "scrape" (single page) or "crawl" (multiple pages)
- `max_pages` (int): Maximum pages to crawl (1-1000)
- `max_depth` (int): Maximum crawl depth (1-10)
- `include_patterns` (array): URL patterns to include
- `exclude_patterns` (array): URL patterns to exclude
- `stealth_mode` (bool): Use stealth headers and delays
- `wait_for_selector` (string): CSS selector to wait for
- `extract_main_content` (bool): Extract only main content
- `remove_nav_elements` (bool): Remove navigation elements

**Response (200 OK):**
```json
{
  "source_id": "source_abc123",
  "message": "Web source added to draft (not saved to database yet)"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid URL or configuration
- `404 Not Found`: Draft not found
- `403 Forbidden`: Access denied

---

### Remove Source

Remove a source from the KB draft.

```http
DELETE /api/v1/kb-drafts/{draft_id}/sources/{source_id}
```

**Response (200 OK):**
```json
{
  "message": "Source removed from draft"
}
```

**Error Responses:**
- `404 Not Found`: Source not found in draft
- `403 Forbidden`: Access denied

## Configuration Management

### Update Chunking Configuration

Update chunking strategy and parameters.

```http
POST /api/v1/kb-drafts/{draft_id}/chunking
```

**Request Body:**
```json
{
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "preserve_code_blocks": true
}
```

**Available Strategies:**
- `by_heading`: Split by markdown headings (best for documentation)
- `semantic`: AI-powered semantic splitting
- `by_section`: Split by document sections
- `paragraph_based`: Split by paragraphs (best for articles)
- `sentence_based`: Split by sentences (best for short content)
- `recursive`: Recursive text splitting
- `adaptive`: Automatically choose best strategy
- `hybrid`: Combination of multiple strategies

**Parameters:**
- `strategy` (string): Chunking strategy
- `chunk_size` (int): Target chunk size in characters (100-5000)
- `chunk_overlap` (int): Overlap between chunks (0-1000)
- `preserve_code_blocks` (bool): Keep code blocks intact

**Response (200 OK):**
```json
{
  "message": "Chunking configuration updated"
}
```

---

### Update Embedding Configuration

Update embedding model and parameters.

```http
POST /api/v1/kb-drafts/{draft_id}/embedding
```

**Request Body:**
```json
{
  "model": "all-MiniLM-L6-v2",
  "device": "cpu",
  "batch_size": 32,
  "normalize_embeddings": true
}
```

**Available Models:**
- `all-MiniLM-L6-v2`: Fast, lightweight (384 dimensions)
- `all-mpnet-base-v2`: High quality (768 dimensions)
- `all-distilroberta-v1`: Balanced performance (768 dimensions)

**Parameters:**
- `model` (string): Embedding model name
- `device` (string): "cpu" or "cuda"
- `batch_size` (int): Processing batch size (1-128)
- `normalize_embeddings` (bool): Normalize vectors

**Response (200 OK):**
```json
{
  "message": "Embedding configuration updated"
}
```

## Preview Operations

### Single URL Preview

Preview chunking strategy for a single URL without creating a draft.

```http
POST /api/v1/kb-drafts/preview
```

**Request Body:**
```json
{
  "url": "https://docs.scrt.network/secret-network-documentation/introduction/secret-network-techstack/consensus-for-secret-transactions",
  "strategy": "adaptive",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "max_preview_chunks": 3
}
```

**Response (200 OK):**
```json
{
  "url": "https://docs.scrt.network/...",
  "title": "Consensus for Secret Transactions",
  "strategy": "by_heading",
  "config": {
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "strategy": "by_heading"
  },
  "preview_chunks": [
    {
      "index": 0,
      "content": "# Consensus for Secret Transactions\n\nSecret Network uses...",
      "word_count": 150,
      "character_count": 982,
      "full_length": 982
    }
  ],
  "total_chunks_estimated": 13,
  "document_stats": {
    "word_count": 2450,
    "character_count": 16789,
    "estimated_reading_time": "8 minutes"
  },
  "strategy_recommendation": "by_heading",
  "optimized_for": "documentation",
  "content_enhancement": {
    "applied": true,
    "original_length": 12983,
    "enhanced_length": 12639,
    "emojis_removed": 0,
    "links_filtered": 0,
    "duplicates_removed": 0,
    "improvement_score": 0.50
  },
  "intelligent_analysis": {
    "content_type_detected": "documentation",
    "structure_score": 0.30,
    "complexity_score": 0.45,
    "recommended_strategy": "by_heading",
    "reasoning": "Content type detected: documentation. Structure score: 0.30/1.0..."
  },
  "image_ocr": {
    "applied": false,
    "images_found": 0,
    "text_extracted": 0
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid URL or unable to fetch content
- `500 Internal Server Error`: Preview generation failed

---

### Draft-Based Multi-Page Preview

Generate realistic preview using draft's crawl configuration.

```http
POST /api/v1/kb-drafts/{draft_id}/preview
```

**Request Body:**
```json
{
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "max_preview_pages": 5
}
```

**Response (200 OK):**
```json
{
  "draft_id": "kb_draft_1234567890abcdef",
  "pages_previewed": 5,
  "total_chunks": 47,
  "strategy": "by_heading",
  "config": {
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "strategy": "by_heading"
  },
  "pages": [
    {
      "url": "https://docs.example.com/introduction",
      "title": "Introduction",
      "chunks": 8,
      "preview_chunks": [
        {
          "index": 0,
          "content": "# Introduction\n\nWelcome to...",
          "word_count": 120,
          "character_count": 756
        }
      ]
    }
  ],
  "estimated_total_chunks": 235,
  "crawl_config": {
    "method": "crawl",
    "max_pages": 50,
    "max_depth": 3
  },
  "note": "Preview based on first 5 pages. Full crawl will process up to 50 pages."
}
```

## Draft Inspection

### List Draft Pages

Get all scraped pages from draft preview with full content.

```http
GET /api/v1/kb-drafts/{draft_id}/pages
```

**Response (200 OK):**
```json
{
  "draft_id": "kb_draft_1234567890abcdef",
  "total_pages": 5,
  "pages": [
    {
      "index": 0,
      "url": "https://docs.example.com/introduction",
      "title": "Introduction",
      "content": "# Introduction\n\nComplete markdown content here...",
      "content_preview": "# Introduction\n\nComplete markdown...",
      "word_count": 1250,
      "character_count": 8934,
      "chunks": 8,
      "scraped_at": "2024-11-19T15:45:00Z"
    }
  ]
}
```

**Error Responses:**
- `404 Not Found`: No preview data (run preview first)

---

### Get Specific Page

Get full content of a specific scraped page.

```http
GET /api/v1/kb-drafts/{draft_id}/pages/{page_index}
```

**Response (200 OK):**
```json
{
  "page_index": 0,
  "url": "https://docs.example.com/introduction",
  "title": "Introduction",
  "content": "# Introduction\n\nFull markdown content...",
  "content_type": "text/markdown",
  "metadata": {
    "description": "API introduction and overview",
    "scraped_at": "2024-11-19T15:45:00Z",
    "chunks": 8
  },
  "word_count": 1250,
  "character_count": 8934,
  "chunks_count": 8
}
```

---

### List Draft Chunks

Get chunked content from draft preview with pagination.

```http
GET /api/v1/kb-drafts/{draft_id}/chunks?page=1&limit=20&page_index=0
```

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `limit` (int): Items per page (1-100, default: 20)
- `page_index` (int, optional): Filter chunks from specific page

**Response (200 OK):**
```json
{
  "draft_id": "kb_draft_1234567890abcdef",
  "total_chunks": 47,
  "page": 1,
  "limit": 20,
  "total_pages": 3,
  "chunks": [
    {
      "global_index": 0,
      "page_index": 0,
      "chunk_index": 0,
      "content": "# Introduction\n\nWelcome to our API...",
      "word_count": 120,
      "character_count": 756,
      "source_page": {
        "index": 0,
        "url": "https://docs.example.com/introduction",
        "title": "Introduction"
      }
    }
  ],
  "filter_applied": {
    "page_index": 0
  }
}
```

## Validation

### Validate Draft

Validate draft before finalization.

```http
GET /api/v1/kb-drafts/{draft_id}/validate
```

**Response (200 OK):**
```json
{
  "is_valid": true,
  "errors": [],
  "warnings": [
    "Large number of pages may take significant time to process"
  ],
  "estimated_duration": 15,
  "total_sources": 2,
  "estimated_pages": 47,
  "validation_details": {
    "sources_configured": true,
    "chunking_configured": true,
    "embedding_configured": true,
    "workspace_accessible": true,
    "estimated_cost": "low"
  }
}
```

**Validation Errors:**
- No sources configured
- Invalid chunking configuration
- Workspace not accessible
- Sources contain invalid URLs

**Validation Warnings:**
- Large number of estimated pages
- Aggressive crawl settings
- Mixed content types

## Finalization

### Finalize Draft

Convert draft to database records and start background processing.

```http
POST /api/v1/kb-drafts/{draft_id}/finalize
```

**Response (200 OK):**
```json
{
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "processing",
  "message": "KB created successfully. Processing started in background.",
  "tracking_url": "/api/v1/kb-pipeline/pipeline_1234567890abcdef/status",
  "estimated_completion_minutes": 15
}
```

This transitions from Phase 1 (Draft) to Phase 2 (Finalization) and Phase 3 (Background Processing).

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "detail": "Not authenticated"
}
```

**403 Forbidden:**
```json
{
  "detail": "Access denied"
}
```

**404 Not Found:**
```json
{
  "detail": "KB draft not found or expired"
}
```

**400 Bad Request:**
```json
{
  "detail": "Invalid configuration: chunk_size must be between 100 and 5000"
}
```

**500 Internal Server Error:**
```json
{
  "detail": "Preview generation failed: Network timeout"
}
```

### Edge Cases

#### 1. Draft Expiration
- Drafts expire after 24 hours
- Auto-extended on each modification
- Finalized drafts are preserved

#### 2. Concurrent Access
- Multiple users cannot edit same draft
- Draft locked to creator only
- Workspace admins can view but not modify

#### 3. Source URL Accessibility
- URLs must be publicly accessible
- Authentication not supported
- Redirects followed automatically (max 5)

#### 4. Content Size Limits
- Maximum 1000 pages per crawl
- Maximum 10MB per page
- Preview limited to first 50 pages

#### 5. Resource Limits
- Maximum 10 concurrent drafts per user
- Maximum 100 sources per draft
- Preview timeout after 30 seconds

### Rate Limiting

- **Draft Operations**: 100 requests/minute per user
- **Preview Operations**: 20 requests/minute per user
- **Source Management**: 50 requests/minute per user

Rate limit headers included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1637000000
```

---

**Last Updated**: November 2024
**API Version**: 1.0