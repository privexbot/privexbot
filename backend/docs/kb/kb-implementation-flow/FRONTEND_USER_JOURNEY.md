# Knowledge Base Management - Frontend User Journey & Implementation Guide

**Version**: 1.0
**Last Updated**: November 16, 2025
**Status**: ✅ Production Ready
**Audience**: Frontend Developers

---

## Table of Contents

1. [Overview](#overview)
2. [Complete User Journeys](#complete-user-journeys)
3. [Detailed Flow Diagrams](#detailed-flow-diagrams)
4. [API Endpoints by Feature](#api-endpoints-by-feature)
5. [Frontend Implementation Patterns](#frontend-implementation-patterns)
6. [Error Handling & Edge Cases](#error-handling--edge-cases)
7. [State Management](#state-management)
8. [UI/UX Best Practices](#uiux-best-practices)

---

## Overview

### What Frontend Developers Need to Know

The KB Management system follows a **3-phase flow**:
1. **Draft Mode** (Phase 1) - Redis-based, fast, non-committal
2. **Finalization** (Phase 2) - Creates DB records, queues processing
3. **Background Processing** (Phase 3) - Celery task processes content

**Key Principles**:
- ⚡ **Fast Feedback**: Draft operations <50ms
- 🎨 **Progressive Enhancement**: Show previews before commitment
- 🔄 **Real-Time Updates**: Poll pipeline status during processing
- 🚫 **Non-Blocking**: Previews don't interfere with main pipeline
- 📊 **Clear Progress**: Show users exactly what's happening

---

## Complete User Journeys

### Journey 1: Create New KB from Web URLs (Happy Path)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER JOURNEY: CREATE KB                       │
└─────────────────────────────────────────────────────────────────┘

Step 1: EXPLORE CHUNKING (Optional but Recommended)
┌──────────────────────────────────────────────────────────────┐
│ User Action: Paste URL to preview                            │
│ Frontend: Call POST /api/v1/kb-drafts/preview/quick          │
│ Response Time: 2-10 seconds                                  │
│ Display: Preview chunks + strategy recommendation            │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 2: CREATE DRAFT
┌──────────────────────────────────────────────────────────────┐
│ User Action: Click "Create Knowledge Base"                   │
│ Frontend: Call POST /api/v1/kb-drafts/                       │
│ Response Time: <50ms                                         │
│ Store: draft_id in state                                     │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 3: CONFIGURE KB SETTINGS
┌──────────────────────────────────────────────────────────────┐
│ User Input: Name, description, workspace, context            │
│ Frontend: Local state (no API call yet)                      │
│ UI: Form with fields:                                        │
│   - Name* (required)                                         │
│   - Description                                              │
│   - Workspace dropdown*                                      │
│   - Context: chatbot | chatflow | both*                      │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 4: ADD WEB SOURCES
┌──────────────────────────────────────────────────────────────┐
│ User Action: Add URLs one by one                             │
│ For each URL:                                                │
│   Frontend: Call POST /api/v1/kb-drafts/{id}/sources/web    │
│   Payload: {                                                 │
│     "url": "https://docs.example.com",                       │
│     "config": {                                              │
│       "method": "crawl",                                     │
│       "max_pages": 50,                                       │
│       "max_depth": 3,                                        │
│       "include_patterns": ["/docs/**"],                      │
│       "exclude_patterns": ["/admin/**"]                      │
│     }                                                        │
│   }                                                          │
│ Response Time: <50ms per URL                                 │
│ UI: Show list of added URLs with remove button               │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 5: CONFIGURE CHUNKING STRATEGY
┌──────────────────────────────────────────────────────────────┐
│ User Action: Select strategy and parameters                  │
│ Frontend: Call POST /api/v1/kb-drafts/{id}/chunking         │
│ Payload: {                                                   │
│   "strategy": "by_heading",                                  │
│   "chunk_size": 1000,                                        │
│   "chunk_overlap": 200                                       │
│ }                                                            │
│ Response Time: <50ms                                         │
│ UI: Dropdown with 8 strategies + size/overlap sliders        │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 6: PREVIEW REALISTIC CHUNKS (Optional but Recommended)
┌──────────────────────────────────────────────────────────────┐
│ User Action: Click "Preview Chunking"                        │
│ Frontend: Call POST /api/v1/kb-drafts/{id}/preview          │
│ Payload: {                                                   │
│   "strategy": "by_heading",  // optional override            │
│   "max_preview_pages": 5                                     │
│ }                                                            │
│ Response Time: 10-30 seconds                                 │
│ UI: Loading spinner → Show preview results                   │
│ Display:                                                     │
│   - Pages previewed: 5                                       │
│   - Total chunks: 123                                        │
│   - Estimated total: ~450 chunks                             │
│   - Per-page breakdown with sample chunks                    │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 7: VALIDATE BEFORE FINALIZATION
┌──────────────────────────────────────────────────────────────┐
│ User Action: Click "Create" (trigger validation)             │
│ Frontend: Call GET /api/v1/kb-drafts/{id}/validate          │
│ Response Time: <50ms                                         │
│ Response: {                                                  │
│   "is_valid": true,                                          │
│   "errors": [],                                              │
│   "warnings": [],                                            │
│   "estimated_duration": 5  // minutes                        │
│ }                                                            │
│ UI: If valid → proceed. If errors → show and block           │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 8: FINALIZE KB
┌──────────────────────────────────────────────────────────────┐
│ User Action: Confirm creation                                │
│ Frontend: Call POST /api/v1/kb-drafts/{id}/finalize         │
│ Response Time: <100ms (synchronous)                          │
│ Response: {                                                  │
│   "kb_id": "uuid",                                           │
│   "pipeline_id": "pipeline:uuid:timestamp",                  │
│   "status": "processing",                                    │
│   "tracking_url": "/api/v1/pipelines/{id}/status",          │
│   "estimated_completion_minutes": 5                          │
│ }                                                            │
│ Store: kb_id and pipeline_id                                 │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 9: MONITOR PROCESSING
┌──────────────────────────────────────────────────────────────┐
│ Frontend: Poll GET /api/v1/pipelines/{id}/status            │
│ Poll Interval: Every 3-5 seconds                             │
│ Response: {                                                  │
│   "status": "processing" | "completed" | "failed",           │
│   "progress": {                                              │
│     "current_page": 23,                                      │
│     "total_pages": 50,                                       │
│     "percent": 46                                            │
│   },                                                         │
│   "current_step": "chunking",                                │
│   "message": "Chunking document 23 of 50..."                 │
│ }                                                            │
│ UI: Progress bar + status message                            │
│ Stop Polling: When status = "completed" or "failed"          │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 10: REDIRECT TO KB DETAILS
┌──────────────────────────────────────────────────────────────┐
│ Frontend: Navigate to /kbs/{kb_id}                           │
│ Call: GET /api/v1/kbs/{kb_id}                               │
│ Display: KB details, stats, documents                        │
└──────────────────────────────────────────────────────────────┘
```

---

### Journey 2: Optimize Existing KB (Re-chunking)

```
┌─────────────────────────────────────────────────────────────────┐
│              USER JOURNEY: OPTIMIZE EXISTING KB                  │
└─────────────────────────────────────────────────────────────────┘

Step 1: VIEW KB DETAILS
┌──────────────────────────────────────────────────────────────┐
│ Frontend: GET /api/v1/kbs/{kb_id}                           │
│ Display: Current configuration, stats, performance           │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 2: PREVIEW DIFFERENT STRATEGY
┌──────────────────────────────────────────────────────────────┐
│ User Action: Click "Optimize Chunking"                       │
│ UI: Modal/panel with strategy selector                       │
│ User Selects: New strategy (e.g., "semantic")                │
│ Frontend: Call POST /api/v1/kbs/{kb_id}/preview-rechunk     │
│ Payload: {                                                   │
│   "strategy": "semantic",                                    │
│   "chunk_size": 1500,                                        │
│   "chunk_overlap": 300,                                      │
│   "sample_documents": 3                                      │
│ }                                                            │
│ Response Time: 1-5 seconds (FAST! No scraping)               │
│ Response: {                                                  │
│   "current_config": {...},                                   │
│   "new_config": {...},                                       │
│   "comparison": {                                            │
│     "current": {                                             │
│       "total_chunks": 847,                                   │
│       "avg_chunk_size": 956                                  │
│     },                                                       │
│     "new": {                                                 │
│       "total_chunks": 623,                                   │
│       "avg_chunk_size": 1247                                 │
│     },                                                       │
│     "delta": {                                               │
│       "chunks_change": -224,                                 │
│       "chunks_percent": -26.4,                               │
│       "recommendation": "Fewer, larger chunks..."            │
│     }                                                        │
│   },                                                         │
│   "sample_chunks": [...]                                     │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 3: COMPARE STRATEGIES (User Can Test Multiple)
┌──────────────────────────────────────────────────────────────┐
│ UI: Show comparison table                                    │
│ Allow: Testing multiple strategies side-by-side              │
│ Frontend: Call preview-rechunk for each strategy             │
│ Display: Comparison chart with recommendations               │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 4: APPLY CHANGES (RE-INDEX)
┌──────────────────────────────────────────────────────────────┐
│ User Action: Click "Apply & Re-index"                        │
│ Frontend: Call POST /api/v1/kbs/{kb_id}/reindex             │
│ Response: {                                                  │
│   "task_id": "uuid",                                         │
│   "status": "queued",                                        │
│   "message": "Re-indexing queued..."                         │
│ }                                                            │
│ UI: Show progress (similar to Step 9 above)                  │
└──────────────────────────────────────────────────────────────┘
```

---

### Journey 3: Browse & Filter KBs

```
┌─────────────────────────────────────────────────────────────────┐
│                USER JOURNEY: BROWSE KBs                          │
└─────────────────────────────────────────────────────────────────┘

Step 1: LIST ALL KBs (Organization-Wide)
┌──────────────────────────────────────────────────────────────┐
│ Frontend: GET /api/v1/kbs/                                   │
│ Query Params: (none)                                         │
│ Result: All KBs from all workspaces in user's org            │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 2: FILTER BY WORKSPACE
┌──────────────────────────────────────────────────────────────┐
│ User Action: Select workspace from dropdown                  │
│ Frontend: GET /api/v1/kbs/?workspace_id={uuid}               │
│ Result: Only KBs from selected workspace                     │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 3: FILTER BY CONTEXT
┌──────────────────────────────────────────────────────────────┐
│ User Action: Filter by chatbot/chatflow/both                 │
│ Frontend: GET /api/v1/kbs/?context=chatbot                   │
│ Result: Only KBs accessible to chatbots                      │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 4: FILTER BY STATUS
┌──────────────────────────────────────────────────────────────┐
│ User Action: Filter by status                                │
│ Frontend: GET /api/v1/kbs/?status=ready                      │
│ Result: Only ready KBs                                       │
└──────────────────────────────────────────────────────────────┘
         ↓
Step 5: COMBINE FILTERS
┌──────────────────────────────────────────────────────────────┐
│ Frontend: GET /api/v1/kbs/?workspace_id={uuid}&context=both  │
│           &status=ready                                      │
│ Result: Filtered list                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## Detailed Flow Diagrams

### Draft Creation Flow (Phase 1)

```
Frontend                     Backend (Redis)              Response
────────                     ───────────────              ────────

1. Create Draft
POST /kb-drafts/
{
  "workspace_id": "uuid",
  "created_by": "user_uuid"
}
                    ────────────────────────────>
                    Create draft in Redis
                    Set 24hr TTL
                    <────────────────────────────
                                                  {
                                                    "draft_id": "uuid",
                                                    "expires_at": "ISO"
                                                  }
Store draft_id

2. Add URLs (Repeat for each)
POST /kb-drafts/{id}/sources/web
{
  "url": "https://...",
  "config": {
    "method": "crawl",
    "max_pages": 50,
    "max_depth": 3
  }
}
                    ────────────────────────────>
                    Append to sources array
                    <────────────────────────────
                                                  {
                                                    "source_id": "uuid"
                                                  }

3. Configure Chunking
POST /kb-drafts/{id}/chunking
{
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200
}
                    ────────────────────────────>
                    Update chunking_config
                    <────────────────────────────
                                                  {
                                                    "message": "Updated"
                                                  }

4. Preview (Optional)
POST /kb-drafts/{id}/preview
{
  "max_preview_pages": 5
}
                    ────────────────────────────>
                    Fetch draft from Redis
                    Crawl first 5 URLs
                    Apply chunking
                    <────────────────────────────
                                                  {
                                                    "pages_previewed": 5,
                                                    "total_chunks": 123,
                                                    "estimated_total": 450,
                                                    "pages": [...]
                                                  }
Show preview results
```

### Finalization Flow (Phase 2 → 3)

```
Frontend            Backend (API)         PostgreSQL       Redis         Celery
────────            ─────────────         ──────────       ─────         ──────

POST /kb-drafts/{id}/finalize
                 ─────────────>
                 Validate draft

                 Create KB record ───────────>
                 (status=processing)

                 Create Documents ───────────>
                 (placeholders)

                                               Store pipeline ──>
                                               tracking data

                                                           Queue task ──>
                                                                     Process in
                                                                     background

                 <────────────
                 {
                   "kb_id": "uuid",
                   "pipeline_id": "...",
                   "status": "processing"
                 }

Start polling
GET /pipelines/{id}/status
(every 3-5s)
                 ─────────────>
                                               Get status ────>
                 <────────────
                 {
                   "status": "processing",
                   "progress": {"percent": 46}
                 }

Continue polling...

                                                                     Task
                                                                     completes
                                               Update status ─>
                 Update KB ──────────────────>
                 (status=ready)

Next poll
GET /pipelines/{id}/status
                 ─────────────>
                                               Get status ────>
                 <────────────
                 {
                   "status": "completed",
                   "progress": {"percent": 100}
                 }

Stop polling
Navigate to KB details
```

---

## API Endpoints by Feature

### 🎨 Preview & Exploration (Before Creating KB)

#### 1. Quick Single-Page Preview
```http
POST /api/v1/kb-drafts/preview/quick
Content-Type: application/json

{
  "url": "https://docs.example.com/intro",
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "max_preview_chunks": 10
}
```

**Use Case**: User wants to quickly test chunking on a single page before creating KB

**Response**:
```json
{
  "url": "https://docs.example.com/intro",
  "title": "Introduction",
  "strategy": "by_heading",
  "strategy_recommendation": "by_heading (optimized for GitBook)",
  "optimized_for": "gitbook",
  "preview_chunks": [
    {
      "index": 0,
      "content": "# Introduction\nWelcome to...",
      "full_length": 456,
      "token_count": 112
    }
  ],
  "total_chunks_estimated": 47,
  "document_stats": {
    "heading_count": 12,
    "structure_type": "highly_structured"
  }
}
```

**Frontend Display**:
- Show first 10 chunks with expandable content
- Display recommendation badge
- Show total chunks estimate
- Allow strategy switching without re-fetching

---

### 📝 Draft Management (Phase 1)

#### 2. Create Draft
```http
POST /api/v1/kb-drafts/
Content-Type: application/json

{
  "workspace_id": "workspace-uuid",
  "data": {
    "name": "Product Documentation",
    "description": "Complete product docs",
    "context": "both"
  }
}
```

**Response**:
```json
{
  "draft_id": "draft-uuid",
  "workspace_id": "workspace-uuid",
  "created_by": "user-uuid",
  "created_at": "2025-11-16T12:00:00Z",
  "expires_at": "2025-11-17T12:00:00Z",
  "data": {
    "name": "Product Documentation",
    "context": "both"
  }
}
```

#### 3. Add Web Source
```http
POST /api/v1/kb-drafts/{draft_id}/sources/web
Content-Type: application/json

{
  "url": "https://docs.example.com",
  "config": {
    "method": "crawl",
    "max_pages": 50,
    "max_depth": 3,
    "include_patterns": ["/docs/**", "/api/**"],
    "exclude_patterns": ["/admin/**", "/auth/**"]
  }
}
```

**Response**:
```json
{
  "source_id": "source-uuid",
  "url": "https://docs.example.com",
  "config": {...}
}
```

**Frontend UI**:
- URL input field
- Advanced options (collapsible):
  - Method: Single page / Crawl
  - Max pages slider (1-1000)
  - Max depth slider (1-10)
  - Include patterns (chips input)
  - Exclude patterns (chips input)

#### 4. Remove Source
```http
DELETE /api/v1/kb-drafts/{draft_id}/sources/{source_id}
```

**Response**:
```json
{
  "message": "Source removed"
}
```

#### 5. Update Chunking Config
```http
POST /api/v1/kb-drafts/{draft_id}/chunking
Content-Type: application/json

{
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200
}
```

**Frontend UI**:
- Strategy dropdown with 8 options:
  - Recursive (default)
  - Semantic (smart topic detection)
  - By Heading (GitBook, docs)
  - By Section (long-form)
  - Adaptive (auto-select)
  - Sentence Based (precise)
  - Paragraph Based (articles)
  - Hybrid (maximum quality)
- Chunk size slider (100-5000)
- Chunk overlap slider (0-1000)

#### 6. Draft Preview (Multi-Page)
```http
POST /api/v1/kb-drafts/{draft_id}/preview
Content-Type: application/json

{
  "strategy": "by_heading",
  "max_preview_pages": 5
}
```

**Response**:
```json
{
  "draft_id": "draft-uuid",
  "pages_previewed": 5,
  "total_chunks": 123,
  "strategy": "by_heading",
  "pages": [
    {
      "url": "https://docs.example.com/intro",
      "title": "Introduction",
      "chunks": 23,
      "preview_chunks": [...]
    }
  ],
  "estimated_total_chunks": 450,
  "note": "Preview based on 5 of 50 sources..."
}
```

**Frontend Display**:
- Loading state (10-30s)
- Grouped by page with expandable sections
- Show per-page chunk count
- Display estimated total chunks
- Comparison table if multiple strategies tested

#### 7. Validate Draft
```http
GET /api/v1/kb-drafts/{draft_id}/validate
```

**Response**:
```json
{
  "is_valid": true,
  "errors": [],
  "warnings": ["Large number of pages may take 10+ minutes"],
  "estimated_duration": 8,
  "total_sources": 12,
  "estimated_pages": 156
}
```

**Frontend Logic**:
```javascript
// Call before finalization
const validation = await validateDraft(draftId);

if (!validation.is_valid) {
  // Block submission
  showErrors(validation.errors);
  return;
}

if (validation.warnings.length > 0) {
  // Show warning modal
  const confirmed = await showWarningDialog({
    warnings: validation.warnings,
    estimatedDuration: validation.estimated_duration
  });

  if (!confirmed) return;
}

// Proceed to finalization
await finalizeDraft(draftId);
```

#### 8. Get Draft
```http
GET /api/v1/kb-drafts/{draft_id}
```

**Use Case**: Restore draft state, show draft summary

---

### ✅ Finalization (Phase 2)

#### 9. Finalize Draft
```http
POST /api/v1/kb-drafts/{draft_id}/finalize
```

**Response**:
```json
{
  "kb_id": "kb-uuid",
  "pipeline_id": "pipeline:kb-uuid:1731758400",
  "status": "processing",
  "message": "KB created successfully. Processing in background.",
  "tracking_url": "/api/v1/pipelines/pipeline:kb-uuid:1731758400/status",
  "estimated_completion_minutes": 5
}
```

**Frontend Flow**:
```javascript
// 1. Finalize
const result = await finalizeDraft(draftId);

// 2. Store IDs
setKbId(result.kb_id);
setPipelineId(result.pipeline_id);

// 3. Navigate to processing page
navigate(`/kbs/${result.kb_id}/processing`);

// 4. Start polling
startPolling(result.pipeline_id);
```

---

### 📊 Pipeline Monitoring (Phase 3)

#### 10. Get Pipeline Status
```http
GET /api/v1/pipelines/{pipeline_id}/status
```

**Response** (Processing):
```json
{
  "pipeline_id": "pipeline:uuid:timestamp",
  "kb_id": "kb-uuid",
  "status": "processing",
  "progress": {
    "current_page": 23,
    "total_pages": 50,
    "percent": 46,
    "current_step": "chunking"
  },
  "message": "Chunking document 23 of 50: Introduction to Product",
  "started_at": "2025-11-16T12:00:00Z"
}
```

**Response** (Completed):
```json
{
  "pipeline_id": "pipeline:uuid:timestamp",
  "kb_id": "kb-uuid",
  "status": "completed",
  "progress": {
    "percent": 100
  },
  "message": "Processing completed successfully",
  "started_at": "2025-11-16T12:00:00Z",
  "completed_at": "2025-11-16T12:05:23Z",
  "stats": {
    "documents_processed": 50,
    "chunks_created": 847,
    "vectors_indexed": 847
  }
}
```

**Frontend Polling Logic**:
```javascript
function usePipelinePolling(pipelineId) {
  const [status, setStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      const data = await fetchPipelineStatus(pipelineId);
      setStatus(data);

      // Stop polling on completion or failure
      if (data.status === 'completed' || data.status === 'failed') {
        setIsPolling(false);
        clearInterval(interval);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [pipelineId, isPolling]);

  return { status, isPolling };
}
```

#### 11. Get Pipeline Logs
```http
GET /api/v1/pipelines/{pipeline_id}/logs
```

**Use Case**: Show detailed logs for debugging

---

### 📚 KB Management

#### 12. List KBs
```http
GET /api/v1/kbs/
GET /api/v1/kbs/?workspace_id={uuid}
GET /api/v1/kbs/?context=chatbot
GET /api/v1/kbs/?status=ready
GET /api/v1/kbs/?workspace_id={uuid}&context=both&status=ready
```

**Response**:
```json
[
  {
    "id": "kb-uuid",
    "name": "Product Documentation",
    "description": "Complete product docs",
    "workspace_id": "workspace-uuid",
    "status": "ready",
    "stats": {
      "documents": 50,
      "chunks": 847,
      "vectors": 847
    },
    "created_at": "2025-11-16T12:00:00Z",
    "created_by": "user-uuid"
  }
]
```

**Frontend UI Components**:
- Filter bar:
  - Workspace dropdown
  - Context filter (chips: All, Chatbot, Chatflow, Both)
  - Status filter (chips: All, Ready, Processing, Failed)
- KB cards/table with:
  - Name, description
  - Status badge
  - Stats (documents, chunks)
  - Created date
  - Actions (View, Edit, Delete)

#### 13. Get KB Details
```http
GET /api/v1/kbs/{kb_id}
```

**Response**:
```json
{
  "id": "kb-uuid",
  "name": "Product Documentation",
  "description": "Complete product docs",
  "workspace_id": "workspace-uuid",
  "status": "ready",
  "config": {
    "chunk_size": 1000,
    "chunk_overlap": 200
  },
  "embedding_config": {
    "model": "all-MiniLM-L6-v2",
    "device": "cpu"
  },
  "vector_store_config": {
    "provider": "qdrant",
    "collection_name": "kb_kb-uuid"
  },
  "indexing_method": "by_heading",
  "stats": {
    "documents": 50,
    "chunks": 847
  },
  "error_message": null,
  "created_at": "2025-11-16T12:00:00Z",
  "updated_at": "2025-11-16T12:05:23Z"
}
```

#### 14. Get KB Stats
```http
GET /api/v1/kbs/{kb_id}/stats
```

**Response**:
```json
{
  "kb_id": "kb-uuid",
  "name": "Product Documentation",
  "status": "ready",
  "documents": {
    "total": 50,
    "by_status": {
      "ready": 48,
      "processing": 2
    }
  },
  "chunks": {
    "total": 847,
    "avg_per_document": 16.9
  },
  "storage": {
    "total_content_size": 456789,
    "avg_chunk_size": 539
  },
  "health": {
    "qdrant_healthy": true,
    "vector_count_match": true
  }
}
```

**Frontend Display**:
- Stats cards:
  - Total documents
  - Total chunks
  - Avg chunk size
  - Health status
- Charts:
  - Documents by status (pie chart)
  - Chunk size distribution (histogram)

#### 15. Preview Re-chunking
```http
POST /api/v1/kbs/{kb_id}/preview-rechunk
Content-Type: application/json

{
  "strategy": "semantic",
  "chunk_size": 1500,
  "chunk_overlap": 300,
  "sample_documents": 3
}
```

**Response**:
```json
{
  "kb_id": "kb-uuid",
  "kb_name": "Product Documentation",
  "current_config": {
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200
  },
  "new_config": {
    "strategy": "semantic",
    "chunk_size": 1500,
    "chunk_overlap": 300
  },
  "comparison": {
    "current": {
      "total_chunks": 847,
      "avg_chunk_size": 956,
      "min_chunk_size": 234,
      "max_chunk_size": 1456
    },
    "new": {
      "total_chunks": 623,
      "avg_chunk_size": 1247,
      "min_chunk_size": 567,
      "max_chunk_size": 1789
    },
    "delta": {
      "chunks_change": -224,
      "chunks_percent": -26.4,
      "avg_size_change": 291,
      "recommendation": "Fewer, larger chunks (semantic) may improve context retention for complex queries"
    }
  },
  "sample_chunks": [...],
  "documents_analyzed": 3,
  "total_documents": 50,
  "note": "Preview based on 3 sample documents. Apply changes to re-index entire KB."
}
```

**Frontend UI**:
- Strategy comparison tool:
  - Side-by-side comparison table
  - Visual diff (green/red for improvements/degradations)
  - Recommendation badge
  - "Apply Changes" button

#### 16. Re-index KB
```http
POST /api/v1/kbs/{kb_id}/reindex
```

**Response**:
```json
{
  "message": "Re-indexing queued for KB 'Product Documentation'",
  "kb_id": "kb-uuid",
  "task_id": "task-uuid",
  "status": "queued",
  "note": "Re-indexing will regenerate all embeddings..."
}
```

**Frontend Flow**:
- Show confirmation modal with warning
- Start polling task status (similar to pipeline)
- Show progress during re-indexing

#### 17. Delete KB
```http
DELETE /api/v1/kbs/{kb_id}
```

**Response**:
```json
{
  "message": "KB 'Product Documentation' deletion queued",
  "kb_id": "kb-uuid",
  "note": "Qdrant collection deletion is processing in background"
}
```

**Frontend Flow**:
```javascript
async function deleteKB(kbId, kbName) {
  const confirmed = await showConfirmDialog({
    title: "Delete Knowledge Base?",
    message: `Are you sure you want to delete "${kbName}"? This action cannot be undone.`,
    confirmText: "Delete",
    confirmVariant: "destructive"
  });

  if (!confirmed) return;

  await api.delete(`/kbs/${kbId}`);

  showToast({
    title: "KB Deleted",
    message: `"${kbName}" has been deleted successfully`,
    variant: "success"
  });

  navigate('/kbs');
}
```

---

## Frontend Implementation Patterns

### State Management

#### Draft State (React Example)
```javascript
// useDraft.js
import { useState, useCallback } from 'react';

export function useDraft(initialWorkspaceId) {
  const [draft, setDraft] = useState(null);
  const [sources, setSources] = useState([]);
  const [chunkingConfig, setChunkingConfig] = useState({
    strategy: 'by_heading',
    chunk_size: 1000,
    chunk_overlap: 200
  });

  const createDraft = useCallback(async (workspaceId, data) => {
    const result = await api.post('/kb-drafts/', {
      workspace_id: workspaceId,
      data
    });
    setDraft(result);
    return result;
  }, []);

  const addSource = useCallback(async (url, config) => {
    const result = await api.post(
      `/kb-drafts/${draft.draft_id}/sources/web`,
      { url, config }
    );
    setSources(prev => [...prev, { id: result.source_id, url, config }]);
    return result;
  }, [draft]);

  const removeSource = useCallback(async (sourceId) => {
    await api.delete(`/kb-drafts/${draft.draft_id}/sources/${sourceId}`);
    setSources(prev => prev.filter(s => s.id !== sourceId));
  }, [draft]);

  const updateChunking = useCallback(async (config) => {
    await api.post(`/kb-drafts/${draft.draft_id}/chunking`, config);
    setChunkingConfig(config);
  }, [draft]);

  const finalize = useCallback(async () => {
    return await api.post(`/kb-drafts/${draft.draft_id}/finalize`);
  }, [draft]);

  return {
    draft,
    sources,
    chunkingConfig,
    createDraft,
    addSource,
    removeSource,
    updateChunking,
    finalize
  };
}
```

#### Pipeline Polling Hook
```javascript
// usePipelinePolling.js
import { useState, useEffect } from 'react';

export function usePipelinePolling(pipelineId, options = {}) {
  const {
    interval = 3000,
    onComplete,
    onError
  } = options;

  const [status, setStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pipelineId || !isPolling) return;

    let timeoutId;

    const poll = async () => {
      try {
        const data = await api.get(`/pipelines/${pipelineId}/status`);
        setStatus(data);

        if (data.status === 'completed') {
          setIsPolling(false);
          onComplete?.(data);
        } else if (data.status === 'failed') {
          setIsPolling(false);
          onError?.(new Error(data.message));
        } else {
          timeoutId = setTimeout(poll, interval);
        }
      } catch (err) {
        setError(err);
        setIsPolling(false);
        onError?.(err);
      }
    };

    poll();

    return () => clearTimeout(timeoutId);
  }, [pipelineId, isPolling, interval, onComplete, onError]);

  return {
    status,
    isPolling,
    error,
    stopPolling: () => setIsPolling(false)
  };
}
```

---

### Component Examples

#### KB Creation Wizard
```jsx
// KBCreationWizard.jsx
import { useState } from 'react';
import { useDraft } from './hooks/useDraft';

export function KBCreationWizard() {
  const [step, setStep] = useState(1);
  const {
    draft,
    sources,
    chunkingConfig,
    createDraft,
    addSource,
    updateChunking,
    finalize
  } = useDraft();

  const steps = [
    { id: 1, name: 'Basic Info', component: BasicInfoStep },
    { id: 2, name: 'Add Sources', component: AddSourcesStep },
    { id: 3, name: 'Configure Chunking', component: ChunkingStep },
    { id: 4, name: 'Preview', component: PreviewStep },
    { id: 5, name: 'Review & Create', component: ReviewStep }
  ];

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleFinalize = async () => {
    const result = await finalize();
    navigate(`/kbs/${result.kb_id}/processing`);
  };

  const CurrentStepComponent = steps[step - 1].component;

  return (
    <div className="wizard">
      <WizardHeader steps={steps} currentStep={step} />

      <CurrentStepComponent
        draft={draft}
        sources={sources}
        chunkingConfig={chunkingConfig}
        createDraft={createDraft}
        addSource={addSource}
        updateChunking={updateChunking}
        onNext={handleNext}
        onBack={handleBack}
        onFinalize={handleFinalize}
      />

      <WizardFooter
        currentStep={step}
        totalSteps={steps.length}
        onNext={handleNext}
        onBack={handleBack}
        onFinalize={handleFinalize}
      />
    </div>
  );
}
```

#### Processing Page with Progress
```jsx
// KBProcessingPage.jsx
import { usePipelinePolling } from './hooks/usePipelinePolling';

export function KBProcessingPage({ kbId, pipelineId }) {
  const { status, isPolling } = usePipelinePolling(pipelineId, {
    onComplete: () => {
      navigate(`/kbs/${kbId}`);
    },
    onError: (error) => {
      showToast({ title: 'Processing failed', message: error.message });
    }
  });

  if (!status) {
    return <LoadingSpinner />;
  }

  return (
    <div className="processing-page">
      <h1>Processing Knowledge Base</h1>

      <ProgressBar
        value={status.progress?.percent || 0}
        max={100}
      />

      <div className="status-info">
        <p className="status-message">{status.message}</p>

        {status.progress && (
          <p className="progress-detail">
            {status.progress.current_page} of {status.progress.total_pages} pages
          </p>
        )}
      </div>

      {status.status === 'completed' && (
        <div className="completion-message">
          <CheckIcon />
          <h2>Processing Complete!</h2>
          <p>Created {status.stats.chunks_created} chunks from {status.stats.documents_processed} documents</p>
          <Button onClick={() => navigate(`/kbs/${kbId}`)}>
            View Knowledge Base
          </Button>
        </div>
      )}
    </div>
  );
}
```

#### Re-chunking Preview Modal
```jsx
// RechunkingPreviewModal.jsx
import { useState } from 'react';

export function RechunkingPreviewModal({ kb, onApply, onClose }) {
  const [strategy, setStrategy] = useState(kb.indexing_method);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const generatePreview = async () => {
    setLoading(true);
    try {
      const result = await api.post(`/kbs/${kb.id}/preview-rechunk`, {
        strategy,
        chunk_size: 1500,
        chunk_overlap: 300
      });
      setPreview(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2>Optimize Chunking Strategy</h2>

      <StrategySelector
        value={strategy}
        onChange={setStrategy}
        currentStrategy={kb.indexing_method}
      />

      <Button onClick={generatePreview} loading={loading}>
        Generate Preview
      </Button>

      {preview && (
        <ComparisonView
          current={preview.comparison.current}
          new={preview.comparison.new}
          delta={preview.comparison.delta}
        />
      )}

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!preview}
          onClick={() => onApply(strategy)}
        >
          Apply & Re-index
        </Button>
      </ModalFooter>
    </Modal>
  );
}
```

---

## Error Handling & Edge Cases

### Error Codes & Messages

| Error Code | HTTP Status | User Message | Frontend Action |
|------------|-------------|--------------|-----------------|
| `DRAFT_NOT_FOUND` | 404 | "Your draft has expired. Please start over." | Clear state, redirect to create page |
| `DRAFT_INVALID` | 400 | "Please add at least one URL source" | Highlight sources section |
| `KB_NOT_FOUND` | 404 | "Knowledge base not found" | Redirect to list |
| `ACCESS_DENIED` | 403 | "You don't have permission to access this KB" | Show error, redirect to list |
| `WORKSPACE_NOT_FOUND` | 404 | "Workspace not found" | Refresh workspace list |
| `URL_FETCH_FAILED` | 400 | "Unable to fetch URL. Please check and try again." | Highlight failed URL |

### Error Handling Patterns

```javascript
// API wrapper with error handling
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();

      // Handle specific error codes
      switch (error.error_code) {
        case 'DRAFT_NOT_FOUND':
          showToast({
            title: 'Draft Expired',
            message: 'Your draft has expired. Starting fresh.',
            variant: 'warning'
          });
          clearDraftState();
          navigate('/kbs/create');
          break;

        case 'ACCESS_DENIED':
          showToast({
            title: 'Access Denied',
            message: "You don't have permission for this action",
            variant: 'error'
          });
          navigate('/kbs');
          break;

        default:
          throw new Error(error.detail || 'An error occurred');
      }
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

### Edge Cases to Handle

#### 1. Draft Expiration During Creation
```javascript
// Auto-save draft periodically
useEffect(() => {
  if (!draft) return;

  const interval = setInterval(async () => {
    try {
      // Touch draft to reset TTL
      await api.get(`/kb-drafts/${draft.draft_id}`);
    } catch (error) {
      if (error.code === 'DRAFT_NOT_FOUND') {
        // Draft expired, save current state locally
        localStorage.setItem('draft_backup', JSON.stringify({
          sources,
          chunkingConfig,
          timestamp: Date.now()
        }));

        showRecoveryDialog();
      }
    }
  }, 10 * 60 * 1000); // Every 10 minutes

  return () => clearInterval(interval);
}, [draft]);
```

#### 2. Network Interruption During Processing
```javascript
// Graceful reconnection
function usePipelinePolling(pipelineId) {
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 5;

  const poll = async () => {
    try {
      const data = await api.get(`/pipelines/${pipelineId}/status`);
      setRetryCount(0); // Reset on success
      return data;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        // Exponential backoff
        await sleep(Math.pow(2, retryCount) * 1000);
        return poll();
      } else {
        throw new Error('Lost connection to server');
      }
    }
  };

  // ... rest of implementation
}
```

#### 3. Large Number of URLs
```javascript
// Batch URL addition with progress
async function addMultipleUrls(urls, draftId) {
  const total = urls.length;
  let completed = 0;

  showProgressDialog({
    title: 'Adding URLs',
    message: `Adding ${total} URLs...`
  });

  for (const url of urls) {
    try {
      await api.post(`/kb-drafts/${draftId}/sources/web`, { url });
      completed++;
      updateProgress(completed / total * 100);
    } catch (error) {
      console.error(`Failed to add ${url}:`, error);
      // Continue with next URL
    }
  }

  closeProgressDialog();

  showToast({
    title: 'URLs Added',
    message: `Successfully added ${completed} of ${total} URLs`
  });
}
```

---

## State Management

### Recommended State Structure

```typescript
// Global state (Redux/Zustand/Context)
interface KBState {
  // List view
  kbs: KB[];
  filters: {
    workspace_id: string | null;
    context: 'chatbot' | 'chatflow' | 'both' | null;
    status: 'ready' | 'processing' | 'failed' | null;
  };

  // Detail view
  currentKB: KB | null;
  kbStats: KBStats | null;

  // Draft creation
  draft: Draft | null;
  draftSources: Source[];
  draftChunkingConfig: ChunkingConfig;

  // Processing
  activePipelines: Map<string, PipelineStatus>;
}

// Actions
interface KBActions {
  // List
  fetchKBs: (filters?: Filters) => Promise<void>;
  setFilters: (filters: Partial<Filters>) => void;

  // Detail
  fetchKB: (kbId: string) => Promise<void>;
  fetchKBStats: (kbId: string) => Promise<void>;
  deleteKB: (kbId: string) => Promise<void>;

  // Draft
  createDraft: (workspaceId: string, data: any) => Promise<Draft>;
  addSource: (url: string, config: any) => Promise<void>;
  removeSource: (sourceId: string) => Promise<void>;
  updateChunking: (config: ChunkingConfig) => Promise<void>;
  finalizeDraft: () => Promise<{ kb_id: string, pipeline_id: string }>;
  clearDraft: () => void;

  // Processing
  startPipelinePolling: (pipelineId: string) => void;
  stopPipelinePolling: (pipelineId: string) => void;
}
```

### Local Storage Strategy

```javascript
// Persist draft state
const DRAFT_STORAGE_KEY = 'kb_draft_state';

export function saveDraftToLocalStorage(draft) {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
    draft,
    timestamp: Date.now()
  }));
}

export function loadDraftFromLocalStorage() {
  const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!stored) return null;

  const { draft, timestamp } = JSON.parse(stored);

  // Expire after 24 hours
  if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }

  return draft;
}

export function clearDraftFromLocalStorage() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}
```

---

## UI/UX Best Practices

### Loading States

```jsx
// Strategy: Skeleton loaders for list views
<KBListSkeleton count={5} />

// Strategy: Progress indicators for operations
<Button loading={isCreating}>
  {isCreating ? 'Creating...' : 'Create KB'}
</Button>

// Strategy: Inline loading for previews
{loadingPreview ? (
  <div className="preview-loading">
    <Spinner />
    <p>Generating preview... (this may take 10-30 seconds)</p>
  </div>
) : (
  <PreviewResults data={preview} />
)}
```

### Empty States

```jsx
// No KBs yet
<EmptyState
  icon={<BookIcon />}
  title="No Knowledge Bases Yet"
  message="Create your first KB to get started"
  action={
    <Button onClick={() => navigate('/kbs/create')}>
      Create Knowledge Base
    </Button>
  }
/>

// No sources in draft
<EmptyState
  icon={<LinkIcon />}
  title="No Sources Added"
  message="Add web URLs to build your knowledge base"
  action={
    <Button onClick={openAddSourceDialog}>
      Add URL
    </Button>
  }
/>
```

### Confirmation Dialogs

```jsx
// Delete confirmation
<ConfirmDialog
  title="Delete Knowledge Base?"
  message={`Are you sure you want to delete "${kb.name}"? This action cannot be undone.`}
  confirmText="Delete"
  confirmVariant="destructive"
  onConfirm={() => deleteKB(kb.id)}
  onCancel={closeDialog}
/>

// Re-index confirmation
<ConfirmDialog
  title="Re-index Knowledge Base?"
  message={`This will regenerate all ${kb.stats.chunks} chunks and may take several minutes.`}
  confirmText="Re-index"
  confirmVariant="primary"
  onConfirm={() => reindexKB(kb.id)}
  onCancel={closeDialog}
/>
```

### Toast Notifications

```javascript
// Success
showToast({
  title: 'KB Created',
  message: 'Processing in background...',
  variant: 'success',
  duration: 5000
});

// Error
showToast({
  title: 'Failed to Add Source',
  message: 'Unable to fetch URL. Please check and try again.',
  variant: 'error',
  duration: 7000
});

// Info
showToast({
  title: 'Preview Ready',
  message: 'Showing preview for 5 pages',
  variant: 'info',
  duration: 3000
});
```

### Progress Indicators

```jsx
// Linear progress for processing
<div className="processing-card">
  <h3>Processing Knowledge Base</h3>

  <LinearProgress
    value={status.progress.percent}
    max={100}
    label={`${status.progress.percent}%`}
  />

  <p className="status-message">{status.message}</p>

  <div className="estimated-time">
    Estimated time remaining: ~{calculateTimeRemaining(status)} minutes
  </div>
</div>

// Circular progress for quick operations
<CircularProgress
  size="small"
  indeterminate
  label="Validating..."
/>
```

---

## Performance Optimization

### Caching Strategy

```javascript
// Use SWR or React Query for automatic caching
import useSWR from 'swr';

export function useKB(kbId) {
  const { data, error, mutate } = useSWR(
    kbId ? `/kbs/${kbId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    kb: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate
  };
}
```

### Debouncing User Input

```javascript
// Debounce chunking config updates
import { useDebouncedCallback } from 'use-debounce';

export function ChunkingConfigForm({ draftId, initialConfig }) {
  const [config, setConfig] = useState(initialConfig);

  const updateConfig = useDebouncedCallback(
    async (newConfig) => {
      await api.post(`/kb-drafts/${draftId}/chunking`, newConfig);
      showToast({ message: 'Configuration updated' });
    },
    1000 // Wait 1 second after user stops typing
  );

  const handleChange = (field, value) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    updateConfig(newConfig);
  };

  return (
    <form>
      <Slider
        label="Chunk Size"
        value={config.chunk_size}
        onChange={(value) => handleChange('chunk_size', value)}
        min={100}
        max={5000}
      />
      {/* ... */}
    </form>
  );
}
```

---

## Testing Checklist for Frontend

### Unit Tests
- [ ] Draft state management
- [ ] Pipeline polling logic
- [ ] Error handling utilities
- [ ] Form validation

### Integration Tests
- [ ] Complete KB creation flow
- [ ] Preview generation
- [ ] Filter and search
- [ ] Re-chunking workflow

### E2E Tests
- [ ] Create KB from start to finish
- [ ] Monitor processing completion
- [ ] Delete KB
- [ ] Handle network failures gracefully

---

**Last Updated**: November 16, 2025
**Version**: 1.0
**Maintainer**: PrivexBot Team
