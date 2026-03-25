# Edge Cases and Error Handling

This document provides comprehensive coverage of edge cases, error scenarios, and troubleshooting procedures for the Knowledge Base APIs.

## Table of Contents

1. [Authentication and Authorization Errors](#authentication-and-authorization-errors)
2. [Multi-Tenant Access Control Edge Cases](#multi-tenant-access-control-edge-cases)
3. [Draft Mode Edge Cases](#draft-mode-edge-cases)
4. [Content Processing Edge Cases](#content-processing-edge-cases)
5. [Pipeline Processing Errors](#pipeline-processing-errors)
6. [Vector Store Synchronization Issues](#vector-store-synchronization-issues)
7. [Network and Timeout Handling](#network-and-timeout-handling)
8. [Resource Limits and Rate Limiting](#resource-limits-and-rate-limiting)
9. [Data Consistency Issues](#data-consistency-issues)
10. [Recovery and Cleanup Procedures](#recovery-and-cleanup-procedures)

## Authentication and Authorization Errors

### 1. Expired JWT Tokens

**Scenario**: User's JWT token expires during long-running operations.

```json
{
  "detail": "Token has expired",
  "error_code": "TOKEN_EXPIRED",
  "expired_at": "2024-11-19T14:30:00Z",
  "current_time": "2024-11-19T15:45:00Z",
  "suggestion": "Refresh your token using the refresh endpoint"
}
```

**Edge Cases:**
- Token expires during draft creation
- Token expires while pipeline is running (pipeline continues, but status checks fail)
- Token expires during large file upload

**Recovery:**
```http
POST /api/v1/auth/refresh
Authorization: Bearer <refresh_token>
```

### 2. Invalid JWT Signatures

**Scenario**: JWT signature verification fails (corrupted token, wrong key).

```json
{
  "detail": "Token signature verification failed",
  "error_code": "INVALID_TOKEN_SIGNATURE",
  "token_header": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9",
  "suggestion": "Token may be corrupted. Please log in again."
}
```

### 3. User Permission Changes

**Scenario**: User permissions revoked while they have active drafts or pipelines.

```json
{
  "detail": "User permissions have been revoked",
  "error_code": "PERMISSIONS_REVOKED",
  "revoked_at": "2024-11-19T15:30:00Z",
  "revoked_by": "admin@example.com",
  "affected_operations": ["kb_edit", "document_create"],
  "suggestion": "Contact workspace administrator for access restoration"
}
```

**Impact:**
- Existing drafts become inaccessible
- Running pipelines complete but user cannot view results
- Read-only access may remain for some resources

## Multi-Tenant Access Control Edge Cases

### 1. Workspace Deletion During Operations

**Scenario**: Workspace is deleted while user has active KB operations.

```json
{
  "detail": "Workspace has been deleted",
  "error_code": "WORKSPACE_DELETED",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "deleted_at": "2024-11-19T15:20:00Z",
  "deleted_by": "org_admin@example.com",
  "affected_kbs": 3,
  "affected_drafts": 2,
  "cleanup_status": "in_progress"
}
```

**Cleanup Process:**
1. Mark all KBs in workspace for deletion
2. Cancel running pipelines
3. Clean up Qdrant collections
4. Remove Redis drafts
5. Archive data for recovery period

### 2. Organization Transfer

**Scenario**: Organization ownership changes affecting access rights.

```json
{
  "detail": "Organization access rights have changed",
  "error_code": "ORG_ACCESS_CHANGED",
  "organization_id": "org_123456",
  "transfer_date": "2024-11-19T12:00:00Z",
  "new_permissions": ["read"],
  "old_permissions": ["admin", "edit", "read"],
  "grace_period_ends": "2024-11-26T12:00:00Z"
}
```

### 3. Concurrent Access Conflicts

**Scenario**: Multiple users modifying same draft simultaneously.

```json
{
  "detail": "Draft is currently being modified by another user",
  "error_code": "CONCURRENT_MODIFICATION",
  "draft_id": "kb_draft_1234567890abcdef",
  "locked_by": "user456",
  "locked_at": "2024-11-19T15:40:00Z",
  "lock_expires_at": "2024-11-19T15:50:00Z",
  "suggestion": "Wait for lock to expire or contact the user currently editing"
}
```

## Draft Mode Edge Cases

### 1. Draft Expiration During Editing

**Scenario**: 24-hour TTL expires while user is actively editing.

```json
{
  "detail": "Draft has expired during editing session",
  "error_code": "DRAFT_EXPIRED_DURING_EDIT",
  "draft_id": "kb_draft_1234567890abcdef",
  "expired_at": "2024-11-20T15:30:00Z",
  "last_save": "2024-11-20T15:25:00Z",
  "auto_save_available": true,
  "recovery_data": {
    "sources_count": 3,
    "config_complete": true,
    "preview_generated": true
  }
}
```

**Recovery Process:**
```http
POST /api/v1/kb-drafts/recover
{
  "expired_draft_id": "kb_draft_1234567890abcdef",
  "recovery_key": "auto_save_20241120_1525"
}
```

### 2. Redis Connection Loss

**Scenario**: Redis becomes unavailable, causing draft operations to fail.

```json
{
  "detail": "Draft storage temporarily unavailable",
  "error_code": "DRAFT_STORE_UNAVAILABLE",
  "storage_type": "redis",
  "error_details": "Connection timeout after 5000ms",
  "retry_after_seconds": 30,
  "fallback_options": ["local_cache", "browser_storage"],
  "estimated_recovery_time": "2024-11-19T15:50:00Z"
}
```

### 3. Draft Size Limits

**Scenario**: Draft exceeds Redis memory limits due to large preview data.

```json
{
  "detail": "Draft size exceeds storage limits",
  "error_code": "DRAFT_SIZE_LIMIT_EXCEEDED",
  "current_size_mb": 25.6,
  "limit_size_mb": 20.0,
  "largest_components": [
    {"component": "preview_content", "size_mb": 15.2},
    {"component": "source_configs", "size_mb": 8.4},
    {"component": "metadata", "size_mb": 2.0}
  ],
  "suggestions": [
    "Reduce max_preview_pages",
    "Clear preview data before adding more sources",
    "Finalize current draft and create new one"
  ]
}
```

## Content Processing Edge Cases

### 1. Malformed Content Detection

**Scenario**: Content contains malformed HTML/Markdown that breaks parsing.

```json
{
  "detail": "Content parsing failed due to malformed markup",
  "error_code": "MALFORMED_CONTENT",
  "url": "https://broken-site.example.com/page",
  "parsing_errors": [
    {
      "line": 45,
      "error": "Unclosed HTML tag: <div>",
      "content_snippet": "<div class='content'>Some text..."
    },
    {
      "line": 67,
      "error": "Invalid markdown table syntax",
      "content_snippet": "| Header | Missing |\n|-----"
    }
  ],
  "fallback_strategy": "raw_text_extraction",
  "success": "partial",
  "recovered_content_percentage": 85.4
}
```

### 2. Content Size Extremes

#### Too Large Content
```json
{
  "detail": "Content exceeds maximum processing size",
  "error_code": "CONTENT_TOO_LARGE",
  "content_size_mb": 50.2,
  "limit_size_mb": 25.0,
  "url": "https://huge-doc.example.com/manual.pdf",
  "processing_options": [
    "split_into_sections",
    "extract_main_content_only",
    "process_first_n_pages"
  ],
  "estimated_chunks": 2456,
  "estimated_processing_time_minutes": 45
}
```

#### Too Small Content
```json
{
  "detail": "Content too small to generate meaningful chunks",
  "error_code": "CONTENT_TOO_SMALL",
  "content_size_chars": 35,
  "minimum_size_chars": 100,
  "url": "https://minimal.example.com/snippet",
  "suggestions": [
    "Combine with related content",
    "Add contextual information",
    "Skip this source if not essential"
  ]
}
```

### 3. Character Encoding Issues

**Scenario**: Content contains mixed or invalid character encodings.

```json
{
  "detail": "Character encoding detection failed",
  "error_code": "ENCODING_DETECTION_FAILED",
  "url": "https://mixed-encoding.example.com/page",
  "detected_encodings": ["utf-8", "latin-1", "cp1252"],
  "confidence_scores": [0.45, 0.38, 0.17],
  "corrupted_sections": [
    {
      "position": 1245,
      "length": 67,
      "encoding_issue": "invalid_utf8_sequence"
    }
  ],
  "fallback_encoding": "utf-8",
  "success": "partial",
  "data_loss_percentage": 2.3
}
```

### 4. Content Enhancement Edge Cases

#### OCR Failures
```json
{
  "detail": "OCR processing failed for multiple images",
  "error_code": "OCR_BATCH_FAILURE",
  "total_images": 15,
  "failed_images": 8,
  "failure_reasons": {
    "timeout": 3,
    "low_quality": 2,
    "unsupported_format": 1,
    "service_error": 2
  },
  "successful_extractions": 7,
  "partial_success": true,
  "extracted_text_length": 456,
  "processing_time_seconds": 45.6
}
```

#### Strategy Recommendation Conflicts
```json
{
  "detail": "Content type detection yielded conflicting results",
  "error_code": "STRATEGY_DETECTION_CONFLICT",
  "detected_types": [
    {"type": "documentation", "confidence": 0.52},
    {"type": "blog", "confidence": 0.48}
  ],
  "conflicting_indicators": [
    "High heading density suggests documentation",
    "Narrative flow suggests blog content"
  ],
  "recommended_strategy": "adaptive",
  "fallback_strategies": ["by_heading", "paragraph_based"],
  "manual_review_suggested": true
}
```

## Pipeline Processing Errors

### 1. Web Scraping Failures

#### Rate Limiting by Target Site
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "degraded",
  "current_stage": "scraping",
  "error": {
    "type": "rate_limited",
    "message": "Target website is rate limiting requests",
    "details": {
      "urls_affected": 15,
      "rate_limit_headers": {
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1637001600"
      },
      "retry_after_seconds": 3600,
      "estimated_delay_hours": 1
    },
    "mitigation_strategy": "exponential_backoff",
    "continuation_plan": "resume_after_delay"
  }
}
```

#### Anti-Bot Protection
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "blocked",
  "current_stage": "scraping",
  "error": {
    "type": "bot_protection",
    "message": "Anti-bot protection detected",
    "details": {
      "protection_type": "cloudflare_challenge",
      "urls_blocked": ["https://protected.example.com/*"],
      "challenge_type": "javascript_challenge",
      "user_agent_blocked": true
    },
    "workarounds": [
      "enable_stealth_mode",
      "use_different_user_agent",
      "manual_content_submission"
    ],
    "success_probability": 0.3
  }
}
```

#### Website Structure Changes
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "degraded",
  "current_stage": "scraping",
  "error": {
    "type": "structure_changed",
    "message": "Website structure has changed since last crawl",
    "details": {
      "expected_selectors": [".main-content", "#article-body"],
      "found_selectors": [".content-wrapper", ".post-content"],
      "similarity_score": 0.23,
      "urls_affected": 23,
      "content_extraction_success_rate": 0.34
    },
    "adaptation_strategy": "auto_selector_discovery",
    "manual_review_required": true
  }
}
```

### 2. Embedding Generation Failures

#### Memory Exhaustion
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "failed",
  "current_stage": "embedding_generation",
  "error": {
    "type": "memory_exhaustion",
    "message": "Insufficient memory for embedding generation",
    "details": {
      "memory_required_gb": 12.5,
      "memory_available_gb": 8.0,
      "large_chunks": [
        {"id": "chunk_123", "size": 15000, "document": "Large Manual"},
        {"id": "chunk_456", "size": 18000, "document": "API Reference"}
      ],
      "batch_size": 32,
      "model": "all-mpnet-base-v2"
    },
    "recovery_options": [
      "reduce_chunk_size",
      "reduce_batch_size",
      "use_smaller_model",
      "process_sequentially"
    ]
  }
}
```

#### Model Loading Failures
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "failed",
  "current_stage": "embedding_generation",
  "error": {
    "type": "model_loading_error",
    "message": "Failed to load embedding model",
    "details": {
      "model": "all-MiniLM-L6-v2",
      "error_type": "NetworkError",
      "download_failed": true,
      "local_cache_corrupted": true,
      "disk_space_available_gb": 2.1,
      "model_size_gb": 0.5
    },
    "recovery_actions": [
      "clear_model_cache",
      "retry_download",
      "use_fallback_model"
    ],
    "fallback_models": ["distilbert-base-uncased", "all-distilroberta-v1"]
  }
}
```

### 3. Vector Store (Qdrant) Issues

#### Collection Creation Conflicts
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "failed",
  "current_stage": "vector_indexing",
  "error": {
    "type": "collection_conflict",
    "message": "Qdrant collection already exists with different configuration",
    "details": {
      "collection_name": "kb_550e8400_e29b_41d4_a716_446655440001",
      "existing_config": {
        "vector_size": 384,
        "distance": "cosine"
      },
      "required_config": {
        "vector_size": 768,
        "distance": "cosine"
      },
      "vector_count": 156,
      "created_at": "2024-11-18T10:30:00Z"
    },
    "resolution_options": [
      "delete_existing_collection",
      "use_existing_config",
      "create_new_collection_name"
    ],
    "data_loss_warning": "Deleting existing collection will lose 156 vectors"
  }
}
```

#### Network Connectivity Issues
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "retrying",
  "current_stage": "vector_indexing",
  "error": {
    "type": "qdrant_connectivity",
    "message": "Cannot connect to Qdrant service",
    "details": {
      "qdrant_url": "http://qdrant:6333",
      "connection_timeout_ms": 5000,
      "last_successful_connection": "2024-11-19T15:30:00Z",
      "retry_count": 3,
      "max_retries": 5,
      "backoff_seconds": 60
    },
    "health_check": {
      "qdrant_service_status": "unknown",
      "network_reachable": false,
      "dns_resolution": true
    },
    "next_retry": "2024-11-19T15:47:00Z"
  }
}
```

## Network and Timeout Handling

### 1. Scraping Timeouts

#### Individual Page Timeout
```json
{
  "url": "https://slow-site.example.com/large-page",
  "error": "timeout",
  "timeout_seconds": 30,
  "bytes_received": 1048576,
  "expected_size_estimate": 5242880,
  "completion_percentage": 20.0,
  "retry_count": 2,
  "will_retry": true,
  "increased_timeout": 60,
  "fallback_options": ["skip_page", "partial_content"]
}
```

#### Bulk Timeout Handling
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "timeout_summary": {
    "total_urls": 47,
    "timed_out": 8,
    "timeout_rate": 0.17,
    "average_timeout_duration": 28.5,
    "slowest_urls": [
      {"url": "https://slow1.example.com", "duration": 45.6},
      {"url": "https://slow2.example.com", "duration": 42.3}
    ]
  },
  "adaptive_timeout_strategy": {
    "base_timeout": 30,
    "adaptive_timeout": 45,
    "timeout_multiplier": 1.5,
    "max_timeout": 120
  }
}
```

### 2. API Timeout Scenarios

#### Preview Timeout
```json
{
  "detail": "Preview generation timed out",
  "error_code": "PREVIEW_TIMEOUT",
  "url": "https://complex-site.example.com/heavy-page",
  "timeout_seconds": 30,
  "processing_stage": "content_extraction",
  "partial_results": {
    "content_length": 2456,
    "chunks_generated": 0,
    "extraction_progress": 0.65
  },
  "suggestions": [
    "Try with simpler content",
    "Increase timeout in client",
    "Use draft preview for complex content"
  ]
}
```

### 3. Database Query Timeouts

#### Long-Running Queries
```json
{
  "detail": "Database query timeout",
  "error_code": "DB_QUERY_TIMEOUT",
  "query_type": "chunk_search",
  "timeout_seconds": 30,
  "affected_operation": "document_listing",
  "query_complexity": {
    "joins": 3,
    "filters": 5,
    "sort_operations": 2,
    "estimated_rows": 15000
  },
  "optimization_suggestions": [
    "Add database indexes",
    "Reduce filter complexity",
    "Use pagination",
    "Cache frequent queries"
  ]
}
```

## Resource Limits and Rate Limiting

### 1. Processing Resource Limits

#### Concurrent Pipeline Limit
```json
{
  "detail": "Maximum concurrent pipelines exceeded",
  "error_code": "CONCURRENT_LIMIT_EXCEEDED",
  "current_pipelines": 5,
  "max_allowed": 5,
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "active_pipelines": [
    {"id": "pipeline_1", "started": "2024-11-19T15:30:00Z", "eta": "2024-11-19T15:45:00Z"},
    {"id": "pipeline_2", "started": "2024-11-19T15:32:00Z", "eta": "2024-11-19T15:47:00Z"}
  ],
  "queue_position": 3,
  "estimated_wait_minutes": 12
}
```

#### Memory Resource Limits
```json
{
  "detail": "System memory usage too high",
  "error_code": "MEMORY_RESOURCE_LIMIT",
  "current_memory_usage": 0.92,
  "memory_threshold": 0.90,
  "affected_operations": ["embedding_generation", "large_document_processing"],
  "memory_breakdown": {
    "embedding_cache": "3.2GB",
    "processing_buffers": "1.8GB",
    "database_connections": "0.5GB",
    "other": "0.7GB"
  },
  "recovery_actions": [
    "Pause new operations",
    "Clear embedding cache",
    "Reduce batch sizes"
  ]
}
```

### 2. API Rate Limiting

#### User Rate Limits
```json
{
  "detail": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "limit_type": "user",
  "current_requests": 101,
  "limit_requests": 100,
  "window_minutes": 60,
  "reset_time": "2024-11-19T16:30:00Z",
  "retry_after_seconds": 420,
  "rate_limit_headers": {
    "X-RateLimit-Limit": 100,
    "X-RateLimit-Remaining": 0,
    "X-RateLimit-Reset": 1637001800
  }
}
```

#### Workspace Rate Limits
```json
{
  "detail": "Workspace rate limit exceeded",
  "error_code": "WORKSPACE_RATE_LIMIT",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "current_operations": 15,
  "limit_operations": 10,
  "operation_type": "kb_creation",
  "active_users": 8,
  "heaviest_users": [
    {"user": "user123", "operations": 6},
    {"user": "user456", "operations": 4}
  ],
  "upgrade_suggestion": "Consider upgrading to higher tier for increased limits"
}
```

### 3. Storage Limits

#### Redis Storage Limits
```json
{
  "detail": "Draft storage limit exceeded",
  "error_code": "REDIS_STORAGE_LIMIT",
  "current_usage_mb": 485.6,
  "limit_mb": 500.0,
  "user_drafts": 12,
  "largest_drafts": [
    {"id": "kb_draft_1", "size_mb": 45.2, "created": "2024-11-19T10:00:00Z"},
    {"id": "kb_draft_2", "size_mb": 38.7, "created": "2024-11-19T11:00:00Z"}
  ],
  "cleanup_suggestions": [
    "Finalize oldest drafts",
    "Delete unused drafts",
    "Clear preview data from drafts"
  ]
}
```

## Data Consistency Issues

### 1. PostgreSQL-Qdrant Synchronization

#### Vector Count Mismatch
```json
{
  "detail": "Vector count mismatch detected",
  "error_code": "VECTOR_COUNT_MISMATCH",
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "postgresql_chunks": 234,
  "qdrant_vectors": 198,
  "missing_vectors": 36,
  "orphaned_vectors": 0,
  "affected_documents": [
    {"id": "doc_123", "chunks": 8, "vectors": 5, "missing": 3},
    {"id": "doc_456", "chunks": 15, "vectors": 12, "missing": 3}
  ],
  "last_sync_check": "2024-11-19T15:45:00Z",
  "auto_repair_available": true,
  "manual_intervention_required": false
}
```

#### Partial Update Failures
```json
{
  "detail": "Document update partially failed",
  "error_code": "PARTIAL_UPDATE_FAILURE",
  "document_id": "doc_abc123",
  "operation": "content_update",
  "postgresql_status": "updated",
  "qdrant_status": "failed",
  "failure_point": "vector_deletion",
  "qdrant_error": "Collection temporarily unavailable",
  "rollback_required": true,
  "data_integrity_risk": "medium",
  "recovery_actions": [
    "Retry Qdrant operation",
    "Rollback PostgreSQL changes",
    "Mark document for manual repair"
  ]
}
```

### 2. Transaction Handling

#### Distributed Transaction Failures
```json
{
  "detail": "Distributed transaction failed",
  "error_code": "DISTRIBUTED_TRANSACTION_FAILURE",
  "transaction_id": "tx_789012",
  "operation": "bulk_document_delete",
  "affected_documents": 5,
  "failure_breakdown": {
    "postgresql": {
      "status": "committed",
      "documents_deleted": 5,
      "chunks_deleted": 23
    },
    "qdrant": {
      "status": "failed",
      "vectors_deleted": 0,
      "error": "Network timeout"
    }
  },
  "consistency_impact": "high",
  "recovery_strategy": "compensating_transaction",
  "rollback_complexity": "complex"
}
```

## Recovery and Cleanup Procedures

### 1. Automatic Recovery

#### Self-Healing Pipeline
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "recovery_initiated": true,
  "recovery_type": "automatic",
  "failure_stage": "embedding_generation",
  "recovery_actions": [
    {
      "action": "reduce_batch_size",
      "from": 64,
      "to": 32,
      "reason": "memory_optimization"
    },
    {
      "action": "retry_failed_chunks",
      "chunk_count": 15,
      "retry_strategy": "exponential_backoff"
    },
    {
      "action": "fallback_model",
      "from": "all-mpnet-base-v2",
      "to": "all-MiniLM-L6-v2",
      "reason": "resource_constraints"
    }
  ],
  "recovery_eta": "2024-11-19T16:15:00Z",
  "success_probability": 0.85
}
```

### 2. Manual Recovery Procedures

#### KB Repair Operations
```http
POST /api/v1/kbs/550e8400-e29b-41d4-a716-446655440001/repair
```

**Request:**
```json
{
  "repair_type": "full_synchronization",
  "force": true,
  "dry_run": false,
  "backup_before_repair": true
}
```

**Response:**
```json
{
  "repair_id": "repair_789012",
  "repair_type": "full_synchronization",
  "estimated_duration_minutes": 25,
  "steps": [
    {"step": "backup_current_state", "estimated_minutes": 3},
    {"step": "identify_inconsistencies", "estimated_minutes": 2},
    {"step": "rebuild_missing_vectors", "estimated_minutes": 15},
    {"step": "cleanup_orphaned_data", "estimated_minutes": 3},
    {"step": "verify_consistency", "estimated_minutes": 2}
  ],
  "warnings": [
    "KB will be temporarily unavailable during repair",
    "Some queries may fail during synchronization"
  ],
  "rollback_available": true
}
```

#### Emergency Data Recovery
```json
{
  "recovery_scenario": "catastrophic_vector_store_loss",
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "recovery_options": [
    {
      "option": "rebuild_from_documents",
      "description": "Regenerate all embeddings from PostgreSQL documents",
      "duration_estimate": "45-60 minutes",
      "data_loss": "none",
      "cost": "high_compute"
    },
    {
      "option": "restore_from_backup",
      "description": "Restore from last known good backup",
      "duration_estimate": "10-15 minutes",
      "data_loss": "changes_since_backup",
      "last_backup": "2024-11-19T12:00:00Z"
    },
    {
      "option": "hybrid_recovery",
      "description": "Restore backup + process recent changes",
      "duration_estimate": "25-35 minutes",
      "data_loss": "minimal",
      "recommended": true
    }
  ]
}
```

### 3. Prevention Strategies

#### Health Monitoring
```json
{
  "monitoring_config": {
    "health_check_interval_minutes": 5,
    "consistency_check_interval_hours": 1,
    "alert_thresholds": {
      "vector_count_mismatch": 10,
      "failed_queries_percentage": 5.0,
      "response_time_ms": 1000
    },
    "auto_repair_enabled": true,
    "auto_repair_max_attempts": 3,
    "escalation_after_failures": 2
  }
}
```

#### Circuit Breaker Patterns
```json
{
  "circuit_breaker_status": {
    "qdrant_operations": {
      "state": "half_open",
      "failure_count": 3,
      "failure_threshold": 5,
      "last_failure": "2024-11-19T15:30:00Z",
      "next_attempt": "2024-11-19T15:35:00Z",
      "success_threshold": 3
    },
    "embedding_generation": {
      "state": "closed",
      "success_count": 156,
      "last_success": "2024-11-19T15:44:00Z"
    }
  }
}
```

### 4. Escalation Procedures

#### Automatic Escalation
```json
{
  "escalation_triggered": true,
  "escalation_level": "critical",
  "trigger_event": "multiple_kb_failures",
  "affected_operations": [
    "kb_creation", "document_processing", "vector_search"
  ],
  "impact_assessment": {
    "affected_users": 25,
    "affected_workspaces": 8,
    "affected_kbs": 12,
    "estimated_revenue_impact": "medium"
  },
  "automatic_actions": [
    "Enable fallback processing",
    "Notify engineering team",
    "Activate backup infrastructure"
  ],
  "manual_intervention_required": true,
  "estimated_resolution_time": "30-60 minutes"
}
```

---

**Last Updated**: November 2024
**API Version**: 1.0