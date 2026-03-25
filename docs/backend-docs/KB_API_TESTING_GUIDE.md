# Knowledge Base API Testing Guide

Complete guide for testing all KB features/endpoints using direct API requests.

Base URL: `http://localhost:8000`
API Version: `v1`
All endpoints are prefixed with: `/api/v1`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Organization Management](#2-organization-management)
3. [Workspace Management](#3-workspace-management)
4. [KB Draft Creation (3-Phase Flow)](#4-kb-draft-creation-3-phase-flow)
5. [KB Management](#5-kb-management)
6. [KB Pipeline Monitoring](#6-kb-pipeline-monitoring)
7. [Complete End-to-End Workflow Examples](#7-complete-end-to-end-workflow-examples)

---

## 1. Authentication

### 1.1 Sign Up (Email/Password)

**Endpoint:** `POST /api/v1/auth/email/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "username": "johndoe"
}
```

**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/email/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "username": "johndoe"
  }'
```

**Python Example:**
```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/auth/email/signup",
    json={
        "email": "user@example.com",
        "password": "SecurePassword123!",
        "username": "johndoe"
    }
)

data = response.json()
access_token = data["access_token"]
print(f"Access Token: {access_token}")
```

---

### 1.2 Login (Email/Password)

**Endpoint:** `POST /api/v1/auth/email/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/email/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

**Python Example:**
```python
response = requests.post(
    "http://localhost:8000/api/v1/auth/email/login",
    json={
        "email": "user@example.com",
        "password": "SecurePassword123!"
    }
)

token = response.json()["access_token"]
```

---

### 1.3 Get Current User

**Endpoint:** `GET /api/v1/auth/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "username": "johndoe",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "auth_methods": [
    {
      "provider": "email",
      "provider_id": "user@example.com",
      "linked_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Python Example:**
```python
headers = {"Authorization": f"Bearer {access_token}"}

response = requests.get(
    "http://localhost:8000/api/v1/auth/me",
    headers=headers
)

user_data = response.json()
user_id = user_data["id"]
```

---

## 2. Organization Management

### 2.1 List Organizations

**Endpoint:** `GET /api/v1/orgs/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response (200 OK):**
```json
{
  "organizations": [
    {
      "id": "org-uuid-here",
      "name": "My Organization",
      "billing_email": "billing@example.com",
      "created_at": "2024-01-15T10:30:00Z",
      "user_role": "owner",
      "member_count": 1,
      "workspace_count": 1
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1,
  "has_next": false,
  "has_previous": false
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/api/v1/orgs/?page=1&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZmJjNmExZi1iM2FmLTRlYmEtOWM0ZC1mN2Y1ZWQ5ZjYwNmIiLCJvcmdfaWQiOiJjMGY3NWVkYS01OGE1LTQ2NjktOWVhNy1mNjUzMGJkZmZhMzgiLCJ3c19pZCI6IjE1ZmI3MmQzLTBiNTQtNDFjYy1iYTA5LTllM2M3NDdmMTM3ZiIsImV4cCI6MTc2MzQwNjYwMCwiaWF0IjoxNzYzMzIwMjAwfQ.T1RxOFhIttagNiSCDwFcvwUBzKWf0gH4xnZaJzpDX_c"
```

---

### 2.2 Create Organization

**Endpoint:** `POST /api/v1/orgs/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "My New Organization",
  "billing_email": "billing@example.com"
}
```

**Response (201 Created):**
```json
{
  "id": "org-uuid-here",
  "name": "My New Organization",
  "billing_email": "billing@example.com",
  "created_at": "2024-01-15T10:30:00Z",
  "user_role": "owner"
}
```

**Python Example:**
```python
response = requests.post(
    "http://localhost:8000/api/v1/orgs/",
    headers={"Authorization": f"Bearer {access_token}"},
    json={
        "name": "My Organization",
        "billing_email": "billing@example.com"
    }
)

org_id = response.json()["id"]
```

---

## 3. Workspace Management

### 3.1 List Workspaces

**Endpoint:** `GET /api/v1/orgs/{org_id}/workspaces`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response (200 OK):**
```json
{
  "workspaces": [
    {
      "id": "workspace-uuid-here",
      "name": "Default Workspace",
      "description": "My default workspace",
      "organization_id": "org-uuid-here",
      "is_default": true,
      "created_at": "2024-01-15T10:30:00Z",
      "user_role": "admin",
      "member_count": 1
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1,
  "has_next": false,
  "has_previous": false
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/api/v1/orgs/c0f75eda-58a5-4669-9ea7-f6530bdffa38/workspaces" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZmJjNmExZi1iM2FmLTRlYmEtOWM0ZC1mN2Y1ZWQ5ZjYwNmIiLCJvcmdfaWQiOiJjMGY3NWVkYS01OGE1LTQ2NjktOWVhNy1mNjUzMGJkZmZhMzgiLCJ3c19pZCI6IjE1ZmI3MmQzLTBiNTQtNDFjYy1iYTA5LTllM2M3NDdmMTM3ZiIsImV4cCI6MTc2MzQwNjYwMCwiaWF0IjoxNzYzMzIwMjAwfQ.T1RxOFhIttagNiSCDwFcvwUBzKWf0gH4xnZaJzpDX_c"
```

---

### 3.2 Create Workspace

**Endpoint:** `POST /api/v1/orgs/{org_id}/workspaces`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "My Workspace",
  "description": "Workspace for AI projects",
  "is_default": false
}
```

**Response (201 Created):**
```json
{
  "id": "workspace-uuid-here",
  "name": "My Workspace",
  "description": "Workspace for AI projects",
  "organization_id": "org-uuid-here",
  "is_default": false,
  "created_at": "2024-01-15T10:30:00Z",
  "user_role": "admin"
}
```

**Python Example:**
```python
response = requests.post(
    f"http://localhost:8000/api/v1/orgs/{org_id}/workspaces",
    headers={"Authorization": f"Bearer {access_token}"},
    json={
        "name": "My Workspace",
        "description": "Workspace for AI projects",
        "is_default": False
    }
)

workspace_id = response.json()["id"]
```

---

## 4. KB Draft Creation (3-Phase Flow)

The KB creation follows a 3-phase flow:
1. **Draft Mode (Redis)** - Configure KB without DB writes
2. **Finalization** - Create DB records and queue background task
3. **Background Processing** - Scrape → Chunk → Embed → Index

### 4.1 Create KB Draft (Phase 1)

**Endpoint:** `POST /api/v1/kb-drafts/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Secret Network Documentation",
  "description": "Complete documentation for Secret Network",
  "workspace_id": "workspace-uuid-here",
  "context": "both"
}
```

**Response (201 Created):**
```json
{
  "draft_id": "draft_kb_abc12345",
  "workspace_id": "workspace-uuid-here",
  "expires_at": "2024-01-15T12:30:00Z",
  "message": "KB draft created successfully (stored in Redis, no database writes)"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/kb-drafts/ \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZmJjNmExZi1iM2FmLTRlYmEtOWM0ZC1mN2Y1ZWQ5ZjYwNmIiLCJvcmdfaWQiOiJjMGY3NWVkYS01OGE1LTQ2NjktOWVhNy1mNjUzMGJkZmZhMzgiLCJ3c19pZCI6IjE1ZmI3MmQzLTBiNTQtNDFjYy1iYTA5LTllM2M3NDdmMTM3ZiIsImV4cCI6MTc2MzQwNjYwMCwiaWF0IjoxNzYzMzIwMjAwfQ.T1RxOFhIttagNiSCDwFcvwUBzKWf0gH4xnZaJzpDX_c" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Secret Network Documentation",
    "description": "Complete documentation for Secret Network",
    "workspace_id": "'"15fb72d3-0b54-41cc-ba09-9e3c747f137f"'",
    "context": "both"
  }'
```

**Python Example:**
```python
response = requests.post(
    "http://localhost:8000/api/v1/kb-drafts/",
    headers={"Authorization": f"Bearer {access_token}"},
    json={
        "name": "Secret Network Documentation",
        "description": "Complete documentation for Secret Network",
        "workspace_id": workspace_id,
        "context": "both"
    }
)

draft_id = response.json()["draft_id"]
print(f"Draft ID: {draft_id}")
```

---

### 4.2 Add Web Source to Draft

**Endpoint:** `POST /api/v1/kb-drafts/{draft_id}/sources/web`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "url": "https://docs.scrt.network/secret-network-documentation",
  "config": {
    "method": "crawl",
    "max_pages": 50,
    "max_depth": 3,
    "stealth_mode": true
  }
}
```

**Response (200 OK):**
```json
{
  "source_id": "source_abc12345",
  "message": "Web source added to draft (not saved to database yet)"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/kb-drafts/draft_kb_b063f89f/sources/web \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZmJjNmExZi1iM2FmLTRlYmEtOWM0ZC1mN2Y1ZWQ5ZjYwNmIiLCJvcmdfaWQiOiJjMGY3NWVkYS01OGE1LTQ2NjktOWVhNy1mNjUzMGJkZmZhMzgiLCJ3c19pZCI6IjE1ZmI3MmQzLTBiNTQtNDFjYy1iYTA5LTllM2M3NDdmMTM3ZiIsImV4cCI6MTc2MzQwNjYwMCwiaWF0IjoxNzYzMzIwMjAwfQ.T1RxOFhIttagNiSCDwFcvwUBzKWf0gH4xnZaJzpDX_c" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://docs.scrt.network/secret-network-documentation",
    "config": {
      "method": "crawl",
      "max_pages": 50,
      "max_depth": 3,
      "stealth_mode": true
    }
  }'
```

**Python Example:**
```python
response = requests.post(
    f"http://localhost:8000/api/v1/kb-drafts/{draft_id}/sources/web",
    headers={"Authorization": f"Bearer {access_token}"},
    json={
        "url": "https://docs.scrt.network/secret-network-documentation",
        "config": {
            "method": "crawl",
            "max_pages": 50,
            "max_depth": 3,
            "stealth_mode": True
        }
    }
)

source_id = response.json()["source_id"]
```

---

### 4.3 Update Chunking Configuration (Optional)

**Endpoint:** `POST /api/v1/kb-drafts/{draft_id}/chunking`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "strategy": "recursive",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "preserve_code_blocks": true
}
```

**Response (200 OK):**
```json
{
  "message": "Chunking configuration updated"
}
```

**Python Example:**
```python
requests.post(
    f"http://localhost:8000/api/v1/kb-drafts/{draft_id}/chunking",
    headers={"Authorization": f"Bearer {access_token}"},
    json={
        "strategy": "recursive",
        "chunk_size": 1000,
        "chunk_overlap": 200,
        "preserve_code_blocks": True
    }
)
```

---

### 4.4 Preview Chunking (Optional - Before Finalization)

**Endpoint:** `POST /api/v1/kb-drafts/{draft_id}/preview`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "max_preview_pages": 5,
  "strategy": "recursive",
  "chunk_size": 1000,
  "chunk_overlap": 200
}
```

**Response (200 OK):**
```json
{
  "draft_id": "draft_kb_abc12345",
  "pages_previewed": 5,
  "total_chunks": 67,
  "strategy": "recursive",
  "config": {
    "chunk_size": 1000,
    "chunk_overlap": 200
  },
  "pages": [
    {
      "url": "https://docs.scrt.network/...",
      "title": "Introduction",
      "chunks": 12,
      "preview_chunks": [
        {
          "content": "Secret Network is a blockchain...",
          "token_count": 245
        }
      ]
    }
  ],
  "estimated_total_chunks": 670,
  "note": "This is a preview based on the first 5 pages"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/kb-drafts/draft_kb_b063f89f/preview \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZmJjNmExZi1iM2FmLTRlYmEtOWM0ZC1mN2Y1ZWQ5ZjYwNmIiLCJvcmdfaWQiOiJjMGY3NWVkYS01OGE1LTQ2NjktOWVhNy1mNjUzMGJkZmZhMzgiLCJ3c19pZCI6IjE1ZmI3MmQzLTBiNTQtNDFjYy1iYTA5LTllM2M3NDdmMTM3ZiIsImV4cCI6MTc2MzQwNjYwMCwiaWF0IjoxNzYzMzIwMjAwfQ.T1RxOFhIttagNiSCDwFcvwUBzKWf0gH4xnZaJzpDX_c" \
  -H "Content-Type: application/json" \
  -d '{
    "max_preview_pages": 5
  }'
```

---

### 4.5 Finalize Draft (Phase 2 - Creates KB & Queues Processing)

**Endpoint:** `POST /api/v1/kb-drafts/{draft_id}/finalize`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:** (none)

**Response (200 OK):**
```json
{
  "kb_id": "kb-uuid-here",
  "pipeline_id": "pipeline:kb-uuid-here:1234567890",
  "status": "processing",
  "message": "KB created and background processing queued",
  "tracking_url": "/api/v1/pipelines/pipeline:kb-uuid-here:1234567890/status",
  "estimated_completion_minutes": 5
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/finalize \
  -H "Authorization: Bearer $TOKEN"
```

**Python Example:**
```python
response = requests.post(
    f"http://localhost:8000/api/v1/kb-drafts/{draft_id}/finalize",
    headers={"Authorization": f"Bearer {access_token}"}
)

result = response.json()
kb_id = result["kb_id"]
pipeline_id = result["pipeline_id"]

print(f"KB ID: {kb_id}")
print(f"Pipeline ID: {pipeline_id}")
print(f"Track progress at: {result['tracking_url']}")
```

---

## 5. KB Management

### 5.1 List Knowledge Bases

**Endpoint:** `GET /api/v1/kbs/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `workspace_id` (optional): Filter by workspace UUID
- `status` (optional): Filter by status (processing, ready, failed, etc.)
- `context` (optional): Filter by context (chatbot, chatflow, both)

**Response (200 OK):**
```json
[
  {
    "id": "kb-uuid-here",
    "name": "Secret Network Documentation",
    "description": "Complete documentation for Secret Network",
    "workspace_id": "workspace-uuid-here",
    "status": "ready",
    "stats": {
      "total_documents": 50,
      "total_chunks": 670,
      "total_embeddings": 670,
      "indexed_vectors": 670
    },
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:35:00Z",
    "created_by": "user-uuid-here"
  }
]
```

**cURL Example:**
```bash
# List all KBs in organization
curl -X GET http://localhost:8000/api/v1/kbs/ \
  -H "Authorization: Bearer $TOKEN"

# Filter by workspace
curl -X GET "http://localhost:8000/api/v1/kbs/?workspace_id=$WORKSPACE_ID" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl -X GET "http://localhost:8000/api/v1/kbs/?status=ready" \
  -H "Authorization: Bearer $TOKEN"
```

**Python Example:**
```python
# List all KBs
response = requests.get(
    "http://localhost:8000/api/v1/kbs/",
    headers={"Authorization": f"Bearer {access_token}"}
)

kbs = response.json()
for kb in kbs:
    print(f"{kb['name']}: {kb['status']} - {kb['stats']}")

# Filter by workspace
response = requests.get(
    "http://localhost:8000/api/v1/kbs/",
    headers={"Authorization": f"Bearer {access_token}"},
    params={"workspace_id": workspace_id}
)
```

---

### 5.2 Get KB Details

**Endpoint:** `GET /api/v1/kbs/{kb_id}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "id": "kb-uuid-here",
  "name": "Secret Network Documentation",
  "description": "Complete documentation for Secret Network",
  "workspace_id": "workspace-uuid-here",
  "status": "ready",
  "config": {
    "chunking_strategy": "recursive",
    "chunk_size": 1000,
    "chunk_overlap": 200
  },
  "embedding_config": {
    "model": "all-MiniLM-L6-v2",
    "dimensions": 384
  },
  "vector_store_config": {
    "provider": "qdrant",
    "collection_name": "kb_abc123"
  },
  "indexing_method": "recursive",
  "stats": {
    "total_documents": 50,
    "total_chunks": 670,
    "total_embeddings": 670,
    "indexed_vectors": 670
  },
  "error_message": null,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z",
  "created_by": "user-uuid-here"
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:8000/api/v1/kbs/$KB_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Python Example:**
```python
response = requests.get(
    f"http://localhost:8000/api/v1/kbs/{kb_id}",
    headers={"Authorization": f"Bearer {access_token}"}
)

kb_details = response.json()
print(f"Status: {kb_details['status']}")
print(f"Stats: {kb_details['stats']}")
```

---

### 5.3 Get KB Statistics

**Endpoint:** `GET /api/v1/kbs/{kb_id}/stats`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "kb_id": "kb-uuid-here",
  "name": "Secret Network Documentation",
  "status": "ready",
  "documents": {
    "total": 50,
    "by_status": {
      "indexed": 50
    }
  },
  "chunks": {
    "total": 670,
    "avg_per_document": 13.4
  },
  "storage": {
    "total_content_size": 1048576,
    "avg_chunk_size": 1565
  },
  "health": {
    "qdrant_healthy": true,
    "vector_count_match": true
  }
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:8000/api/v1/kbs/$KB_ID/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### 5.4 Delete Knowledge Base

**Endpoint:** `DELETE /api/v1/kbs/{kb_id}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "message": "KB 'Secret Network Documentation' deletion queued",
  "kb_id": "kb-uuid-here",
  "note": "Qdrant collection deletion is processing in background"
}
```

**cURL Example:**
```bash
curl -X DELETE http://localhost:8000/api/v1/kbs/$KB_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Python Example:**
```python
response = requests.delete(
    f"http://localhost:8000/api/v1/kbs/{kb_id}",
    headers={"Authorization": f"Bearer {access_token}"}
)

print(response.json()["message"])
```

---

### 5.5 Re-index Knowledge Base

**Endpoint:** `POST /api/v1/kbs/{kb_id}/reindex`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "message": "Re-indexing queued for KB 'Secret Network Documentation'",
  "kb_id": "kb-uuid-here",
  "task_id": "celery-task-id",
  "status": "queued",
  "note": "Re-indexing will regenerate all embeddings and update Qdrant. This may take several minutes."
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/kbs/$KB_ID/reindex \
  -H "Authorization: Bearer $TOKEN"
```

---

## 6. KB Pipeline Monitoring

### 6.1 Get Pipeline Status (Poll Every 2-5 Seconds)

**Endpoint:** `GET /api/v1/pipelines/{pipeline_id}/status`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "pipeline_id": "pipeline:kb-uuid-here:1234567890",
  "kb_id": "kb-uuid-here",
  "status": "running",
  "current_stage": "embedding_generation",
  "progress_percentage": 65,
  "stats": {
    "pages_discovered": 50,
    "pages_scraped": 50,
    "pages_failed": 0,
    "chunks_created": 670,
    "embeddings_generated": 436,
    "vectors_indexed": 0
  },
  "started_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:33:15Z",
  "estimated_completion": "2024-01-15T10:35:00Z"
}
```

**Possible Status Values:**
- `queued` - Pipeline queued, not started yet
- `running` - Currently processing
- `completed` - Successfully completed
- `failed` - Failed with errors

**Possible Stages:**
- `web_scraping` - Scraping web pages
- `content_parsing` - Parsing and cleaning content
- `chunking` - Creating text chunks
- `embedding_generation` - Generating embeddings
- `vector_indexing` - Indexing in Qdrant
- `finalization` - Updating KB status

**cURL Example (Polling Loop):**
```bash
while true; do
  STATUS=$(curl -s -X GET http://localhost:8000/api/v1/pipelines/$PIPELINE_ID/status \
    -H "Authorization: Bearer $TOKEN" | jq -r '.status')

  echo "Pipeline Status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi

  sleep 3
done
```

**Python Example (Polling):**
```python
import time

def poll_pipeline_status(pipeline_id, access_token, max_wait=300, poll_interval=3):
    """Poll pipeline status until completion"""
    start_time = time.time()

    while time.time() - start_time < max_wait:
        response = requests.get(
            f"http://localhost:8000/api/v1/pipelines/{pipeline_id}/status",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if response.status_code == 200:
            status_data = response.json()
            current_status = status_data.get("status")
            progress = status_data.get("progress_percentage", 0)
            stats = status_data.get("stats", {})

            print(f"Status: {current_status} | Progress: {progress}% | Stats: {stats}")

            if current_status in ["completed", "failed"]:
                return current_status, status_data

        time.sleep(poll_interval)

    return "timeout", None

# Use the polling function
final_status, final_data = poll_pipeline_status(pipeline_id, access_token)

if final_status == "completed":
    print("✓ Pipeline completed successfully!")
    print(f"Stats: {final_data['stats']}")
else:
    print(f"✗ Pipeline ended with status: {final_status}")
```

---

### 6.2 Get Pipeline Logs

**Endpoint:** `GET /api/v1/pipelines/{pipeline_id}/logs`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `limit` (optional): Number of log entries to return (default: 100)

**Response (200 OK):**
```json
{
  "pipeline_id": "pipeline:kb-uuid-here:1234567890",
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:05Z",
      "level": "info",
      "message": "Started web scraping",
      "details": {
        "urls": ["https://docs.scrt.network/..."]
      }
    },
    {
      "timestamp": "2024-01-15T10:32:15Z",
      "level": "info",
      "message": "Scraped 50 pages successfully"
    },
    {
      "timestamp": "2024-01-15T10:33:00Z",
      "level": "warning",
      "message": "Skipped 2 pages due to errors",
      "details": {
        "failed_urls": ["https://docs.scrt.network/broken-link"]
      }
    }
  ]
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:8000/api/v1/pipelines/$PIPELINE_ID/logs?limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 6.3 Cancel Pipeline

**Endpoint:** `POST /api/v1/pipelines/{pipeline_id}/cancel`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "message": "Pipeline cancellation requested",
  "pipeline_id": "pipeline:kb-uuid-here:1234567890",
  "status": "cancelled"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/pipelines/$PIPELINE_ID/cancel \
  -H "Authorization: Bearer $TOKEN"
```

---

## 7. Complete End-to-End Workflow Examples

### 7.1 Python: Complete Workflow from Signup to KB Ready

```python
#!/usr/bin/env python3
"""
Complete KB creation workflow using direct API calls
"""
import requests
import time
from typing import Optional, Tuple

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"


class KBAPIClient:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.org_id: Optional[str] = None
        self.workspace_id: Optional[str] = None

    def _headers(self):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def signup(self, email: str, password: str, username: str) -> str:
        """Sign up and get access token"""
        response = requests.post(
            f"{self.base_url}{API_PREFIX}/auth/email/signup",
            json={
                "email": email,
                "password": password,
                "username": username
            }
        )
        response.raise_for_status()
        self.token = response.json()["access_token"]
        print(f"✓ Signed up successfully")
        return self.token

    def get_current_user(self) -> dict:
        """Get current user details"""
        response = requests.get(
            f"{self.base_url}{API_PREFIX}/auth/me",
            headers=self._headers()
        )
        response.raise_for_status()
        user = response.json()
        print(f"✓ Current user: {user['username']}")
        return user

    def list_organizations(self) -> list:
        """List user's organizations"""
        response = requests.get(
            f"{self.base_url}{API_PREFIX}/orgs/",
            headers=self._headers()
        )
        response.raise_for_status()
        orgs = response.json()["organizations"]
        if orgs:
            self.org_id = orgs[0]["id"]
            print(f"✓ Found organization: {orgs[0]['name']} ({self.org_id})")
        return orgs

    def list_workspaces(self) -> list:
        """List workspaces in organization"""
        response = requests.get(
            f"{self.base_url}{API_PREFIX}/orgs/{self.org_id}/workspaces",
            headers=self._headers()
        )
        response.raise_for_status()
        workspaces = response.json()["workspaces"]
        if workspaces:
            self.workspace_id = workspaces[0]["id"]
            print(f"✓ Found workspace: {workspaces[0]['name']} ({self.workspace_id})")
        return workspaces

    def create_kb_draft(self, name: str, description: str) -> str:
        """Create KB draft"""
        response = requests.post(
            f"{self.base_url}{API_PREFIX}/kb-drafts/",
            headers=self._headers(),
            json={
                "name": name,
                "description": description,
                "workspace_id": self.workspace_id,
                "context": "both"
            }
        )
        response.raise_for_status()
        draft_id = response.json()["draft_id"]
        print(f"✓ Created draft: {draft_id}")
        return draft_id

    def add_web_source(self, draft_id: str, url: str, max_pages: int = 10) -> str:
        """Add web source to draft"""
        response = requests.post(
            f"{self.base_url}{API_PREFIX}/kb-drafts/{draft_id}/sources/web",
            headers=self._headers(),
            json={
                "url": url,
                "config": {
                    "method": "crawl",
                    "max_pages": max_pages,
                    "max_depth": 2,
                    "stealth_mode": True
                }
            }
        )
        response.raise_for_status()
        source_id = response.json()["source_id"]
        print(f"✓ Added web source: {url}")
        return source_id

    def finalize_draft(self, draft_id: str) -> Tuple[str, str]:
        """Finalize draft and start processing"""
        response = requests.post(
            f"{self.base_url}{API_PREFIX}/kb-drafts/{draft_id}/finalize",
            headers=self._headers()
        )
        response.raise_for_status()
        result = response.json()
        kb_id = result["kb_id"]
        pipeline_id = result["pipeline_id"]
        print(f"✓ KB created: {kb_id}")
        print(f"✓ Pipeline started: {pipeline_id}")
        return kb_id, pipeline_id

    def poll_pipeline(self, pipeline_id: str, max_wait: int = 300) -> Tuple[str, dict]:
        """Poll pipeline until completion"""
        print(f"\n⏳ Polling pipeline (max {max_wait}s)...")
        start_time = time.time()
        last_progress = -1

        while time.time() - start_time < max_wait:
            try:
                response = requests.get(
                    f"{self.base_url}{API_PREFIX}/pipelines/{pipeline_id}/status",
                    headers=self._headers()
                )

                if response.status_code == 200:
                    status_data = response.json()
                    current_status = status_data.get("status")
                    progress = status_data.get("progress_percentage", 0)
                    stats = status_data.get("stats", {})

                    if progress != last_progress:
                        print(f"   Status: {current_status} | Progress: {progress}% | "
                              f"Chunks: {stats.get('chunks_created', 0)} | "
                              f"Vectors: {stats.get('vectors_indexed', 0)}")
                        last_progress = progress

                    if current_status in ["completed", "ready", "ready_with_warnings"]:
                        print(f"✓ Pipeline completed successfully!")
                        return current_status, status_data

                    if current_status == "failed":
                        print(f"✗ Pipeline failed!")
                        return current_status, status_data

            except requests.exceptions.RequestException as e:
                print(f"⚠ Connection error: {e}")

            time.sleep(3)

        print("⚠ Polling timeout reached")
        return "timeout", {}

    def get_kb_stats(self, kb_id: str) -> dict:
        """Get KB statistics"""
        response = requests.get(
            f"{self.base_url}{API_PREFIX}/kbs/{kb_id}/stats",
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()

    def list_kbs(self) -> list:
        """List all KBs"""
        response = requests.get(
            f"{self.base_url}{API_PREFIX}/kbs/",
            headers=self._headers(),
            params={"workspace_id": self.workspace_id}
        )
        response.raise_for_status()
        return response.json()


def main():
    """Run complete KB creation workflow"""
    print("=" * 80)
    print("KB CREATION - COMPLETE WORKFLOW")
    print("=" * 80)

    # Initialize client
    client = KBAPIClient()

    # 1. Authentication
    print("\n1. AUTHENTICATION")
    print("-" * 80)
    timestamp = int(time.time())
    client.signup(
        email=f"test_{timestamp}@example.com",
        password="SecurePassword123!",
        username=f"test_user_{timestamp}"
    )
    client.get_current_user()

    # 2. Organization & Workspace Setup
    print("\n2. ORGANIZATION & WORKSPACE SETUP")
    print("-" * 80)
    client.list_organizations()
    client.list_workspaces()

    # 3. Create KB Draft
    print("\n3. CREATE KB DRAFT")
    print("-" * 80)
    draft_id = client.create_kb_draft(
        name=f"Test KB {timestamp}",
        description="Test knowledge base for API testing"
    )

    # 4. Add Web Source
    print("\n4. ADD WEB SOURCE")
    print("-" * 80)
    client.add_web_source(
        draft_id=draft_id,
        url="https://docs.scrt.network/secret-network-documentation",
        max_pages=10
    )

    # 5. Finalize Draft
    print("\n5. FINALIZE DRAFT")
    print("-" * 80)
    kb_id, pipeline_id = client.finalize_draft(draft_id)

    # 6. Monitor Pipeline
    print("\n6. MONITOR PIPELINE")
    print("-" * 80)
    status, data = client.poll_pipeline(pipeline_id, max_wait=180)

    if status in ["completed", "ready", "ready_with_warnings"]:
        # 7. Get Final Stats
        print("\n7. KB STATISTICS")
        print("-" * 80)
        stats = client.get_kb_stats(kb_id)
        print(f"KB Name: {stats['name']}")
        print(f"Status: {stats['status']}")
        print(f"Documents: {stats['documents']['total']}")
        print(f"Chunks: {stats['chunks']['total']}")
        print(f"Avg Chunks/Doc: {stats['chunks']['avg_per_document']:.1f}")
        print(f"Qdrant Healthy: {stats['health']['qdrant_healthy']}")
        print(f"Vector Count Match: {stats['health']['vector_count_match']}")

        print("\n" + "=" * 80)
        print("✅ KB CREATION SUCCESSFUL!")
        print("=" * 80)
        print(f"KB ID: {kb_id}")
    else:
        print("\n" + "=" * 80)
        print("⚠️ KB CREATION FAILED OR TIMED OUT")
        print("=" * 80)


if __name__ == "__main__":
    main()
```

---

### 7.2 Shell Script: Complete Workflow

```bash
#!/bin/bash
# Complete KB creation workflow using cURL

set -e  # Exit on error

BASE_URL="http://localhost:8000"
API_PREFIX="/api/v1"

echo "================================================================================"
echo "KB CREATION - COMPLETE WORKFLOW (SHELL)"
echo "================================================================================"

# 1. Authentication
echo ""
echo "1. AUTHENTICATION"
echo "--------------------------------------------------------------------------------"

TIMESTAMP=$(date +%s)
EMAIL="test_${TIMESTAMP}@example.com"
USERNAME="test_user_${TIMESTAMP}"
PASSWORD="SecurePassword123!"

echo "Signing up as: $EMAIL"
SIGNUP_RESPONSE=$(curl -s -X POST "${BASE_URL}${API_PREFIX}/auth/email/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"username\": \"$USERNAME\"
  }")

TOKEN=$(echo $SIGNUP_RESPONSE | jq -r '.access_token')
echo "✓ Access Token: ${TOKEN:0:50}..."

# 2. Get Organization & Workspace
echo ""
echo "2. ORGANIZATION & WORKSPACE SETUP"
echo "--------------------------------------------------------------------------------"

ORGS_RESPONSE=$(curl -s -X GET "${BASE_URL}${API_PREFIX}/orgs/" \
  -H "Authorization: Bearer $TOKEN")

ORG_ID=$(echo $ORGS_RESPONSE | jq -r '.organizations[0].id')
echo "✓ Organization ID: $ORG_ID"

WORKSPACES_RESPONSE=$(curl -s -X GET "${BASE_URL}${API_PREFIX}/orgs/${ORG_ID}/workspaces" \
  -H "Authorization: Bearer $TOKEN")

WORKSPACE_ID=$(echo $WORKSPACES_RESPONSE | jq -r '.workspaces[0].id')
echo "✓ Workspace ID: $WORKSPACE_ID"

# 3. Create KB Draft
echo ""
echo "3. CREATE KB DRAFT"
echo "--------------------------------------------------------------------------------"

DRAFT_RESPONSE=$(curl -s -X POST "${BASE_URL}${API_PREFIX}/kb-drafts/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test KB ${TIMESTAMP}\",
    \"description\": \"Test knowledge base\",
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"context\": \"both\"
  }")

DRAFT_ID=$(echo $DRAFT_RESPONSE | jq -r '.draft_id')
echo "✓ Draft ID: $DRAFT_ID"

# 4. Add Web Source
echo ""
echo "4. ADD WEB SOURCE"
echo "--------------------------------------------------------------------------------"

SOURCE_RESPONSE=$(curl -s -X POST "${BASE_URL}${API_PREFIX}/kb-drafts/${DRAFT_ID}/sources/web" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://docs.scrt.network/secret-network-documentation",
    "config": {
      "method": "crawl",
      "max_pages": 10,
      "max_depth": 2,
      "stealth_mode": true
    }
  }')

echo "✓ Web source added"

# 5. Finalize Draft
echo ""
echo "5. FINALIZE DRAFT"
echo "--------------------------------------------------------------------------------"

FINALIZE_RESPONSE=$(curl -s -X POST "${BASE_URL}${API_PREFIX}/kb-drafts/${DRAFT_ID}/finalize" \
  -H "Authorization: Bearer $TOKEN")

KB_ID=$(echo $FINALIZE_RESPONSE | jq -r '.kb_id')
PIPELINE_ID=$(echo $FINALIZE_RESPONSE | jq -r '.pipeline_id')

echo "✓ KB ID: $KB_ID"
echo "✓ Pipeline ID: $PIPELINE_ID"

# 6. Monitor Pipeline
echo ""
echo "6. MONITOR PIPELINE"
echo "--------------------------------------------------------------------------------"
echo "Polling pipeline status (max 180s)..."

START_TIME=$(date +%s)
MAX_WAIT=180

while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  if [ $ELAPSED -gt $MAX_WAIT ]; then
    echo "⚠ Timeout reached"
    break
  fi

  STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}${API_PREFIX}/pipelines/${PIPELINE_ID}/status" \
    -H "Authorization: Bearer $TOKEN")

  STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
  PROGRESS=$(echo $STATUS_RESPONSE | jq -r '.progress_percentage')
  CHUNKS=$(echo $STATUS_RESPONSE | jq -r '.stats.chunks_created')
  VECTORS=$(echo $STATUS_RESPONSE | jq -r '.stats.vectors_indexed')

  echo "   Status: $STATUS | Progress: $PROGRESS% | Chunks: $CHUNKS | Vectors: $VECTORS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "ready" ] || [ "$STATUS" = "ready_with_warnings" ]; then
    echo "✓ Pipeline completed successfully!"
    break
  fi

  if [ "$STATUS" = "failed" ]; then
    echo "✗ Pipeline failed!"
    exit 1
  fi

  sleep 3
done

# 7. Get Final Stats
echo ""
echo "7. KB STATISTICS"
echo "--------------------------------------------------------------------------------"

STATS_RESPONSE=$(curl -s -X GET "${BASE_URL}${API_PREFIX}/kbs/${KB_ID}/stats" \
  -H "Authorization: Bearer $TOKEN")

echo "$STATS_RESPONSE" | jq '.'

echo ""
echo "================================================================================"
echo "✅ KB CREATION SUCCESSFUL!"
echo "================================================================================"
echo "KB ID: $KB_ID"
echo "================================================================================"
```

---

### 7.3 Testing a Specific URL (AWS Documentation Example)

```python
#!/usr/bin/env python3
"""
Scrape AWS Secrets Manager documentation
"""
from kb_api_client import KBAPIClient  # Use the class from 7.1
import time


def scrape_aws_docs():
    client = KBAPIClient()

    # 1. Sign up
    timestamp = int(time.time())
    client.signup(
        email=f"aws_test_{timestamp}@example.com",
        password="SecurePassword123!",
        username=f"aws_tester_{timestamp}"
    )

    # 2. Setup org/workspace
    client.get_current_user()
    client.list_organizations()
    client.list_workspaces()

    # 3. Create draft for AWS docs
    draft_id = client.create_kb_draft(
        name="AWS Secrets Manager Docs",
        description="Complete AWS Secrets Manager documentation"
    )

    # 4. Add AWS URL
    client.add_web_source(
        draft_id=draft_id,
        url="https://docs.aws.amazon.com/secretsmanager/",
        max_pages=50  # AWS has lots of pages
    )

    # 5. Finalize
    kb_id, pipeline_id = client.finalize_draft(draft_id)

    # 6. Monitor
    status, data = client.poll_pipeline(pipeline_id, max_wait=300)

    if status in ["completed", "ready", "ready_with_warnings"]:
        stats = client.get_kb_stats(kb_id)
        print("\n" + "=" * 80)
        print("AWS DOCS SCRAPING RESULTS")
        print("=" * 80)
        print(f"Documents: {stats['documents']['total']}")
        print(f"Chunks: {stats['chunks']['total']}")
        print(f"Avg Chunk Size: {stats['storage']['avg_chunk_size']} bytes")
        print(f"Health: Qdrant={stats['health']['qdrant_healthy']}, "
              f"Vectors Match={stats['health']['vector_count_match']}")

        return kb_id
    else:
        print(f"Failed with status: {status}")
        return None


if __name__ == "__main__":
    kb_id = scrape_aws_docs()
    if kb_id:
        print(f"\n✅ Success! KB ID: {kb_id}")
        print(f"You can now query this KB using the query endpoints")
```

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "detail": "Invalid authentication credentials"
}
```
**Solution:** Check your access token is valid and included in Authorization header.

**403 Forbidden:**
```json
{
  "detail": "Access denied"
}
```
**Solution:** You don't have permission to access this resource (wrong org/workspace).

**404 Not Found:**
```json
{
  "detail": "Knowledge base not found"
}
```
**Solution:** Resource doesn't exist or has been deleted.

**400 Bad Request:**
```json
{
  "detail": "Invalid chunking strategy"
}
```
**Solution:** Fix request body parameters.

---

## Additional Resources

### Qdrant Direct Access (For Verification)

After KB is created, you can verify vectors in Qdrant directly:

```bash
# Get collection info
curl http://localhost:6335/collections/kb_{kb_id_with_underscores}

# Sample vectors
curl -X POST http://localhost:6335/collections/kb_{kb_id_with_underscores}/points/scroll \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 3,
    "with_vector": false,
    "with_payload": true
  }'
```

### Python Example:
```python
import requests

kb_id_cleaned = kb_id.replace('-', '_')
collection_name = f"kb_{kb_id_cleaned}"

# Get collection stats
response = requests.get(f"http://localhost:6335/collections/{collection_name}")
print(response.json())

# Sample points
response = requests.post(
    f"http://localhost:6335/collections/{collection_name}/points/scroll",
    json={
        "limit": 5,
        "with_vector": False,
        "with_payload": True
    }
)

points = response.json()["result"]["points"]
for i, point in enumerate(points, 1):
    payload = point["payload"]
    print(f"\nChunk #{i}:")
    print(f"  Page: {payload.get('page_title', 'N/A')}")
    print(f"  URL: {payload.get('page_url', 'N/A')}")
    print(f"  Content: {payload.get('content', '')[:200]}...")
```

---

## Summary

This guide covered:

- ✅ Authentication (signup, login, get current user)
- ✅ Organization management (list, create)
- ✅ Workspace management (list, create)
- ✅ KB Draft creation (3-phase flow)
- ✅ KB Management (list, get, delete, stats, reindex)
- ✅ Pipeline monitoring (status, logs, cancel)
- ✅ Complete workflow examples (Python & Shell)
- ✅ Error handling
- ✅ Direct Qdrant verification

You can now test all KB features using direct API requests without relying on the E2E test scripts!
