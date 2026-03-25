# Knowledge Base API Reference

This directory contains comprehensive API reference documentation for all Knowledge Base-related endpoints in the PrivexBot Backend.

## Documentation Structure

### 1. [KB Draft Management APIs](./kb-draft-apis.md)
- **Phase 1**: Draft Mode (Redis-only operations)
- Draft creation, source management, configuration
- Preview and validation endpoints
- Real-time preview with content enhancement

### 2. [KB Pipeline Processing APIs](./kb-pipeline-apis.md)
- **Phase 3**: Background Processing Monitoring
- Real-time status tracking and progress updates
- Pipeline logs and cancellation
- Celery task monitoring

### 3. [Content Enhancement APIs](./content-enhancement-apis.md)
- **New Features**: Content enhancement and optimization
- Content cleaning and normalization
- OCR text extraction from images
- Intelligent strategy recommendations

### 4. [KB Management APIs](./kb-management-apis.md)
- **CRUD Operations**: Production KB management
- KB listing, inspection, and statistics
- Document and chunk management
- Re-indexing and maintenance operations

### 5. [Edge Cases & Error Handling](./edge-cases-and-errors.md)
- Comprehensive error scenarios and responses
- Timeout handling and retry strategies
- Multi-tenant access control edge cases
- Data consistency and synchronization issues

## API Overview

The Knowledge Base system follows a **3-Phase Architecture**:

### Phase 1: Draft Mode (Redis Only)
- **Duration**: <50ms per operation
- **Storage**: Redis with 24hr TTL
- **Purpose**: Fast, non-committal configuration
- **Endpoints**: `/api/v1/kb-drafts/*`

### Phase 2: Finalization (DB Creation)
- **Duration**: <100ms (synchronous)
- **Storage**: PostgreSQL + Redis pipeline tracking
- **Purpose**: Create database records and queue background processing
- **Endpoints**: `/api/v1/kb-drafts/{draft_id}/finalize`

### Phase 3: Background Processing
- **Duration**: 2-60 minutes (depending on content size)
- **Processing**: Celery background tasks
- **Purpose**: Scrape → Parse → Chunk → Embed → Index
- **Monitoring**: `/api/v1/kb-pipeline/*`

### Production Management
- **Operations**: CRUD, inspection, maintenance
- **Access Control**: RBAC-based permissions
- **Endpoints**: `/api/v1/kbs/*`

## Key Features

### 🚀 **Performance Optimized**
- Draft mode operations: <50ms
- Real-time progress tracking
- Concurrent processing pipelines
- Background task management

### 🔒 **Multi-Tenant Security**
- Organization-scoped access control
- Workspace-based permissions
- RBAC for KB operations
- User isolation and data privacy

### 🧠 **Enhanced Processing**
- Intelligent content type detection
- Automatic content enhancement
- OCR text extraction from images
- Strategy recommendations with AI

### 📊 **Comprehensive Monitoring**
- Real-time pipeline status
- Detailed processing logs
- Health checks and statistics
- Error tracking and recovery

### 🔄 **Backward Compatibility**
- All existing endpoints preserved
- Enhanced features automatically integrated
- Graceful degradation for missing dependencies
- API versioning support

## Authentication

All endpoints require authentication via JWT tokens:

```http
Authorization: Bearer <jwt_token>
```

Get authentication tokens from:
- `POST /api/v1/auth/email/login`
- `POST /api/v1/auth/email/signup`

## Base URL

All endpoints are prefixed with:
```
https://api.privexbot.com/api/v1
```

Development environment:
```
http://localhost:8000/api/v1
```

## Rate Limits

- **Draft Operations**: 100 requests/minute per user
- **Preview Operations**: 20 requests/minute per user
- **Background Processing**: 10 concurrent pipelines per workspace
- **Management Operations**: 200 requests/minute per user

## API Versions

- **Current Version**: v1
- **Stability**: Production-ready
- **Deprecation Policy**: 6-month notice for breaking changes
- **Migration Guides**: Provided for major version updates

## Support

- **API Documentation**: Interactive docs at `/api/docs`
- **Schema Definitions**: OpenAPI spec at `/api/openapi.json`
- **Health Checks**: Service status at `/health`
- **Error Reporting**: Structured error responses with request IDs

---

**Last Updated**: November 2024
**API Version**: 1.0
**Documentation Version**: 1.0