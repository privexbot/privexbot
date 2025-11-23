# Knowledge Base API Reference - Complete Index

This is the comprehensive index of all Knowledge Base API endpoints in the PrivexBot Backend. Use this as a quick reference for finding specific endpoints and their documentation.

## Quick Navigation

- **[Overview and Getting Started](#overview-and-getting-started)**
- **[Authentication](#authentication)**
- **[KB Draft Management (Phase 1)](#kb-draft-management-phase-1)**
- **[Pipeline Processing (Phase 3)](#pipeline-processing-phase-3)**
- **[Content Enhancement](#content-enhancement)**
- **[KB Management (Production)](#kb-management-production)**
- **[Error Handling](#error-handling)**

---

## Overview and Getting Started

### Base Configuration
- **Base URL**: `https://api.privexbot.com/api/v1` (Production) | `http://localhost:8000/api/v1` (Development)
- **Authentication**: JWT Bearer tokens required for all endpoints
- **API Version**: v1 (Current)
- **Response Format**: JSON
- **Rate Limits**: Varies by endpoint (see individual documentation)

### Architecture Overview
The KB system follows a **3-Phase Architecture**:

1. **Phase 1: Draft Mode** (`/kb-drafts/*`) - Fast Redis-based configuration
2. **Phase 2: Finalization** - Create DB records and queue processing
3. **Phase 3: Pipeline** (`/kb-pipeline/*`) - Background processing with monitoring

---

## Authentication

### Get Authentication Token
```http
POST /api/v1/auth/email/login
POST /api/v1/auth/email/signup
```
**Returns**: JWT access token for API authentication
**Usage**: Include in all requests as `Authorization: Bearer <token>`

---

## KB Draft Management (Phase 1)

> **Documentation**: [kb-draft-apis.md](./kb-draft-apis.md)
> **Phase**: Draft Mode (Redis Only)
> **Performance**: <50ms per operation

### Core Draft Operations

#### Draft Lifecycle
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/kb-drafts/` | Create new KB draft |
| `GET` | `/kb-drafts/{draft_id}` | Get draft details |
| `DELETE` | `/kb-drafts/{draft_id}` | Delete draft |
| `GET` | `/kb-drafts/{draft_id}/validate` | Validate draft before finalization |
| `POST` | `/kb-drafts/{draft_id}/finalize` | Convert to production KB |

#### Source Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/kb-drafts/{draft_id}/sources/web` | Add web URL source |
| `DELETE` | `/kb-drafts/{draft_id}/sources/{source_id}` | Remove source |

#### Configuration Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/kb-drafts/{draft_id}/chunking` | Update chunking config |
| `POST` | `/kb-drafts/{draft_id}/embedding` | Update embedding config |

### Preview Operations

#### Content Preview
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/kb-drafts/preview` | Single URL preview |
| `POST` | `/kb-drafts/{draft_id}/preview` | Multi-page draft preview |

#### Draft Inspection
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/kb-drafts/{draft_id}/pages` | List scraped pages |
| `GET` | `/kb-drafts/{draft_id}/pages/{page_index}` | Get specific page content |
| `GET` | `/kb-drafts/{draft_id}/chunks` | List generated chunks with pagination |

---

## Pipeline Processing (Phase 3)

> **Documentation**: [kb-pipeline-apis.md](./kb-pipeline-apis.md)
> **Phase**: Background Processing Monitoring
> **Performance**: <10ms status checks

### Pipeline Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/kb-pipeline/{pipeline_id}/status` | Real-time pipeline status |
| `GET` | `/kb-pipeline/{pipeline_id}/logs` | Processing logs |
| `POST` | `/kb-pipeline/{pipeline_id}/cancel` | Cancel running pipeline |

### System Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/kb-pipeline/health` | System health and resources |
| `GET` | `/kb-pipeline/active` | List active pipelines |

### Processing Stages
1. **Discovery**: URL discovery and crawl planning
2. **Scraping**: Content fetching and extraction
3. **Parsing**: Content cleaning and normalization
4. **Chunking**: Text segmentation
5. **Embedding Generation**: Vector embedding creation
6. **Vector Indexing**: Qdrant collection population
7. **Finalization**: Status updates and cleanup

---

## Content Enhancement

> **Documentation**: [content-enhancement-apis.md](./content-enhancement-apis.md)
> **Phase**: Standalone + Pipeline Integration
> **Performance**: <500ms content, 2-10s OCR

### Service Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/content-enhancement/health` | Check service availability |

### Content Processing
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/content-enhancement/enhance-content` | Clean and optimize content |
| `POST` | `/content-enhancement/extract-image-text` | OCR text extraction |
| `POST` | `/content-enhancement/recommend-strategy` | Intelligent strategy recommendations |
| `GET` | `/content-enhancement/presets` | List available strategy presets |

### Enhanced Preview
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/content-enhancement/enhanced-preview` | Complete preview with all features |

### Features Overview

#### Content Enhancement
- **Emoji Removal**: Clean emoji characters
- **Link Filtering**: Remove tracking/ad links
- **Deduplication**: Remove duplicate content blocks
- **Whitespace Normalization**: Standardize formatting
- **Line Merging**: Fix fragmented text

#### OCR Processing
- **Image Detection**: Find images in markdown/HTML
- **Text Extraction**: Extract text with confidence scoring
- **Multi-language Support**: 8+ languages (eng, fra, deu, etc.)
- **Image Enhancement**: Preprocessing for better accuracy

#### Strategy Recommendations
- **Content Type Detection**: Identify content type (documentation, blog, code, etc.)
- **Strategy Mapping**: Recommend optimal chunking strategy
- **Configuration Optimization**: Suggest chunk size and overlap
- **Performance Analysis**: Provide reasoning and alternatives

---

## KB Management (Production)

> **Documentation**: [kb-management-apis.md](./kb-management-apis.md)
> **Phase**: Production CRUD Operations
> **Performance**: <100ms metadata, 2-30s processing

### KB CRUD Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/kbs/` | List knowledge bases |
| `GET` | `/kbs/{kb_id}` | Get KB details |
| `DELETE` | `/kbs/{kb_id}` | Delete KB and all data |

### KB Maintenance
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/kbs/{kb_id}/reindex` | Trigger re-indexing |
| `GET` | `/kbs/{kb_id}/stats` | Detailed statistics |
| `POST` | `/kbs/{kb_id}/preview-rechunk` | Preview re-chunking strategy |

### Document Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/kbs/{kb_id}/documents` | List documents with pagination |
| `GET` | `/kbs/{kb_id}/documents/{doc_id}` | Get document details |
| `POST` | `/kbs/{kb_id}/documents` | Create new document |
| `PUT` | `/kbs/{kb_id}/documents/{doc_id}` | Update document content |
| `DELETE` | `/kbs/{kb_id}/documents/{doc_id}` | Delete document |

### Chunk Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/kbs/{kb_id}/chunks` | List and search chunks |

### Advanced Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/kbs/{kb_id}/documents/bulk-update` | Bulk enable/disable documents |
| `POST` | `/kbs/{kb_id}/documents/bulk-delete` | Bulk delete documents |
| `GET` | `/kbs/{kb_id}/health` | KB health check |
| `POST` | `/kbs/{kb_id}/repair` | Repair operations |

---

## Error Handling

> **Documentation**: [edge-cases-and-errors.md](./edge-cases-and-errors.md)
> **Comprehensive error scenarios and recovery procedures**

### Common HTTP Status Codes
| Code | Description | Common Causes |
|------|-------------|---------------|
| `200` | OK | Successful operation |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid parameters or request format |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist or expired |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side processing error |
| `503` | Service Unavailable | Service dependencies unavailable |

### Error Response Format
```json
{
  "detail": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE",
  "field_errors": {...},
  "suggestion": "How to resolve the issue",
  "retry_after_seconds": 30,
  "error_id": "unique_error_id_for_tracking"
}
```

### Categories of Edge Cases
1. **Authentication & Authorization**: Token expiration, permission changes
2. **Multi-Tenant Access**: Workspace deletion, organization transfer
3. **Draft Mode**: Expiration, Redis issues, size limits
4. **Content Processing**: Malformed content, encoding issues, size extremes
5. **Pipeline Processing**: Scraping failures, embedding errors, vector store issues
6. **Network & Timeouts**: Connection issues, timeout handling
7. **Resource Limits**: Memory, storage, rate limiting
8. **Data Consistency**: Sync issues, transaction failures

---

## Quick Reference by Use Case

### Creating a Knowledge Base
1. `POST /kb-drafts/` - Create draft
2. `POST /kb-drafts/{id}/sources/web` - Add sources
3. `POST /kb-drafts/{id}/chunking` - Configure chunking
4. `POST /kb-drafts/{id}/preview` - Preview results
5. `POST /kb-drafts/{id}/finalize` - Create production KB
6. `GET /kb-pipeline/{pipeline_id}/status` - Monitor processing

### Managing Existing KBs
1. `GET /kbs/` - List all KBs
2. `GET /kbs/{id}` - Get KB details
3. `GET /kbs/{id}/documents` - List documents
4. `POST /kbs/{id}/documents` - Add manual content
5. `GET /kbs/{id}/stats` - Check health and statistics

### Content Enhancement
1. `POST /content-enhancement/recommend-strategy` - Get recommendations
2. `POST /content-enhancement/enhance-content` - Clean content
3. `POST /content-enhancement/enhanced-preview` - Preview with enhancements

### Troubleshooting
1. `GET /content-enhancement/health` - Check service health
2. `GET /kb-pipeline/{id}/logs` - View processing logs
3. `GET /kbs/{id}/health` - Check KB health
4. `POST /kbs/{id}/repair` - Repair inconsistencies

---

## Rate Limits Summary

| Endpoint Category | Limit | Window |
|------------------|-------|---------|
| Draft Operations | 100 req/min | Per user |
| Preview Operations | 20 req/min | Per user |
| Content Enhancement | 100 req/min | Per user |
| OCR Processing | 20 req/min | Per user |
| Management Operations | 200 req/min | Per user |
| Pipeline Monitoring | 1000 req/min | Per user |

---

## API Changes and Versioning

### Current Version: v1
- **Stability**: Production-ready
- **Breaking Changes**: None planned for v1
- **Deprecation Policy**: 6-month notice for breaking changes

### Recent Additions
- **Content Enhancement APIs** (November 2024)
- **Enhanced Preview with AI recommendations** (November 2024)
- **OCR text extraction** (November 2024)
- **Advanced error handling** (November 2024)

### Backward Compatibility
- All existing endpoints maintain compatibility
- New features are additive and optional
- Graceful degradation when services unavailable

---

**Documentation Last Updated**: November 2024
**API Version**: v1.0
**Documentation Version**: 1.0

For questions or support, please refer to:
- **Interactive API Docs**: `/api/docs`
- **OpenAPI Schema**: `/api/openapi.json`
- **Health Check**: `/health`