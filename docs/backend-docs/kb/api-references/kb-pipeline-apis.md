# KB Pipeline Processing APIs

**Phase 3**: Background Processing Monitoring

The KB Pipeline APIs provide real-time monitoring and control for background processing tasks. When a KB draft is finalized, Celery tasks handle scraping, parsing, chunking, embedding, and indexing operations while these APIs provide progress tracking.

## Overview

- **Base Path**: `/api/v1/kb-pipeline`
- **Storage**: Redis for status tracking
- **Performance**: <10ms per status check
- **Purpose**: Monitor background processing pipelines
- **Polling**: Frontend polls every 2 seconds

## Authentication

All endpoints require authentication:
```http
Authorization: Bearer <jwt_token>
```

## Pipeline Status Monitoring

### Get Pipeline Status

Get real-time pipeline status and progress.

```http
GET /api/v1/kb-pipeline/{pipeline_id}/status
```

**Path Parameters:**
- `pipeline_id` (string): Pipeline identifier from finalization response

**Response (200 OK):**
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "kb_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "running",
  "current_stage": "embedding_generation",
  "progress_percentage": 65,
  "stats": {
    "pages_discovered": 47,
    "pages_scraped": 45,
    "pages_failed": 2,
    "chunks_created": 234,
    "embeddings_generated": 152,
    "vectors_indexed": 152,
    "total_processing_time_seconds": 892
  },
  "stages_completed": [
    {
      "stage": "discovery",
      "status": "completed",
      "duration_seconds": 15,
      "completed_at": "2024-11-19T15:32:15Z"
    },
    {
      "stage": "scraping",
      "status": "completed",
      "duration_seconds": 320,
      "completed_at": "2024-11-19T15:37:35Z"
    },
    {
      "stage": "parsing",
      "status": "completed",
      "duration_seconds": 45,
      "completed_at": "2024-11-19T15:38:20Z"
    },
    {
      "stage": "chunking",
      "status": "completed",
      "duration_seconds": 89,
      "completed_at": "2024-11-19T15:39:49Z"
    },
    {
      "stage": "embedding_generation",
      "status": "running",
      "progress_percentage": 65,
      "eta_seconds": 180
    }
  ],
  "started_at": "2024-11-19T15:32:00Z",
  "updated_at": "2024-11-19T15:42:15Z",
  "estimated_completion": "2024-11-19T15:45:30Z",
  "processing_rate": {
    "pages_per_minute": 8.5,
    "chunks_per_minute": 45,
    "embeddings_per_minute": 28
  }
}
```

### Pipeline Statuses

**Overall Status:**
- `queued`: Task queued, waiting to start
- `running`: Pipeline actively processing
- `completed`: All stages completed successfully
- `failed`: Pipeline failed with errors
- `cancelled`: Cancelled by user

**Stage Statuses:**
- `pending`: Not started yet
- `running`: Currently processing
- `completed`: Successfully finished
- `failed`: Failed with errors
- `skipped`: Skipped due to configuration

### Processing Stages

1. **Discovery** (`discovery`): URL discovery and crawl planning
2. **Scraping** (`scraping`): Content fetching and extraction
3. **Parsing** (`parsing`): Content cleaning and normalization
4. **Chunking** (`chunking`): Text segmentation and chunking
5. **Embedding Generation** (`embedding_generation`): Vector embedding creation
6. **Vector Indexing** (`vector_indexing`): Qdrant collection population
7. **Finalization** (`finalization`): Status updates and cleanup

**Error Responses:**
- `404 Not Found`: Pipeline not found or expired
- `403 Forbidden`: No access to associated KB

---

### Get Pipeline Logs

Get detailed processing logs for debugging.

```http
GET /api/v1/kb-pipeline/{pipeline_id}/logs?limit=100
```

**Query Parameters:**
- `limit` (int): Maximum number of log entries (default: 100, max: 1000)

**Response (200 OK):**
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "total_logs": 156,
  "logs": [
    {
      "timestamp": "2024-11-19T15:32:00.123Z",
      "level": "info",
      "stage": "discovery",
      "message": "Pipeline started for KB: API Documentation",
      "details": {
        "kb_id": "550e8400-e29b-41d4-a716-446655440001",
        "sources_count": 2,
        "config": {
          "max_pages": 50,
          "max_depth": 3
        }
      }
    },
    {
      "timestamp": "2024-11-19T15:32:15.456Z",
      "level": "info",
      "stage": "discovery",
      "message": "Discovered 47 pages for crawling",
      "details": {
        "pages_found": 47,
        "estimated_duration_minutes": 15
      }
    },
    {
      "timestamp": "2024-11-19T15:34:22.789Z",
      "level": "warning",
      "stage": "scraping",
      "message": "Failed to scrape page: Connection timeout",
      "details": {
        "url": "https://docs.example.com/advanced-concepts",
        "error": "ConnectionTimeoutError",
        "retry_count": 2
      }
    },
    {
      "timestamp": "2024-11-19T15:38:45.012Z",
      "level": "error",
      "stage": "scraping",
      "message": "Page permanently failed after 3 retries",
      "details": {
        "url": "https://docs.example.com/broken-page",
        "final_error": "404 Not Found",
        "will_continue": true
      }
    },
    {
      "timestamp": "2024-11-19T15:42:15.345Z",
      "level": "info",
      "stage": "embedding_generation",
      "message": "Generated embeddings for 50 chunks",
      "details": {
        "batch_size": 32,
        "model": "all-MiniLM-L6-v2",
        "total_chunks_processed": 152,
        "remaining_chunks": 82
      }
    }
  ]
}
```

**Log Levels:**
- `debug`: Detailed debugging information
- `info`: General information about processing
- `warning`: Recoverable issues (retries, skipped content)
- `error`: Serious errors (permanent failures)
- `critical`: Pipeline-stopping errors

**Error Responses:**
- `404 Not Found`: Pipeline not found or no logs available

---

### Cancel Pipeline

Cancel a running pipeline.

```http
POST /api/v1/kb-pipeline/{pipeline_id}/cancel
```

**Response (200 OK):**
```json
{
  "message": "Pipeline cancellation requested",
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "cancelled",
  "note": "Pipeline may take a few moments to fully stop. Check status for confirmation."
}
```

**Cancellation Behavior:**
- Currently processing stage completes before stopping
- Partial results are preserved
- KB status set to "failed"
- Qdrant collection may contain partial data
- Can be retried by triggering re-indexing

**Error Responses:**
- `400 Bad Request`: Cannot cancel completed/failed pipeline
- `404 Not Found`: Pipeline not found
- `403 Forbidden`: No access to associated KB

## Advanced Monitoring

### Pipeline Health Check

Check overall pipeline health and system resources.

```http
GET /api/v1/kb-pipeline/health
```

**Response (200 OK):**
```json
{
  "system_status": "healthy",
  "active_pipelines": 3,
  "queued_pipelines": 1,
  "total_pipelines_today": 28,
  "resource_usage": {
    "celery_workers": {
      "available": 5,
      "busy": 3,
      "idle": 2
    },
    "queue_lengths": {
      "web_scraping": 2,
      "embeddings": 1,
      "indexing": 0
    },
    "memory_usage": {
      "embedding_cache": "2.3GB",
      "redis_usage": "456MB"
    }
  },
  "performance_metrics": {
    "avg_pipeline_duration_minutes": 12.5,
    "avg_pages_per_pipeline": 34,
    "success_rate_24h": 94.2
  },
  "last_updated": "2024-11-19T15:45:00Z"
}
```

---

### List Active Pipelines

Get all active pipelines for monitoring.

```http
GET /api/v1/kb-pipeline/active?workspace_id=550e8400-e29b-41d4-a716-446655440000
```

**Query Parameters:**
- `workspace_id` (UUID, optional): Filter by workspace

**Response (200 OK):**
```json
{
  "active_pipelines": [
    {
      "pipeline_id": "pipeline_1234567890abcdef",
      "kb_id": "550e8400-e29b-41d4-a716-446655440001",
      "kb_name": "API Documentation",
      "status": "running",
      "current_stage": "embedding_generation",
      "progress_percentage": 65,
      "started_at": "2024-11-19T15:32:00Z",
      "estimated_completion": "2024-11-19T15:45:30Z",
      "workspace_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  ],
  "total_active": 1
}
```

## Detailed Progress Tracking

### Stage-Specific Progress

Each processing stage provides detailed progress information:

#### Discovery Stage
```json
{
  "stage": "discovery",
  "status": "running",
  "progress": {
    "urls_discovered": 47,
    "estimated_total": 50,
    "crawl_depth_reached": 3,
    "robots_txt_checked": true,
    "sitemaps_found": 2
  }
}
```

#### Scraping Stage
```json
{
  "stage": "scraping",
  "status": "running",
  "progress": {
    "pages_scraped": 45,
    "pages_total": 47,
    "pages_failed": 2,
    "pages_skipped": 0,
    "data_extracted_mb": 12.5,
    "avg_page_size_kb": 278,
    "scraping_rate_per_minute": 8.5
  }
}
```

#### Chunking Stage
```json
{
  "stage": "chunking",
  "status": "running",
  "progress": {
    "documents_chunked": 45,
    "documents_total": 45,
    "chunks_created": 234,
    "avg_chunks_per_doc": 5.2,
    "chunking_strategy": "by_heading",
    "avg_chunk_size": 956
  }
}
```

#### Embedding Generation
```json
{
  "stage": "embedding_generation",
  "status": "running",
  "progress": {
    "chunks_embedded": 152,
    "chunks_total": 234,
    "batches_completed": 5,
    "batches_total": 8,
    "embedding_model": "all-MiniLM-L6-v2",
    "embeddings_per_minute": 28,
    "estimated_remaining_minutes": 3
  }
}
```

#### Vector Indexing
```json
{
  "stage": "vector_indexing",
  "status": "running",
  "progress": {
    "vectors_indexed": 152,
    "vectors_total": 234,
    "collection_created": true,
    "indexing_rate_per_minute": 85,
    "qdrant_collection_size": 152,
    "estimated_collection_size_mb": 45.6
  }
}
```

## Error Handling and Recovery

### Common Pipeline Errors

#### Network Errors
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "failed",
  "current_stage": "scraping",
  "error": {
    "type": "network_error",
    "message": "Multiple page scraping failures",
    "details": {
      "failed_urls": [
        "https://docs.example.com/page1",
        "https://docs.example.com/page2"
      ],
      "error_counts": {
        "timeout": 3,
        "not_found": 2,
        "server_error": 1
      }
    },
    "retry_possible": true,
    "suggestion": "Check URL accessibility and retry"
  }
}
```

#### Embedding Errors
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "failed",
  "current_stage": "embedding_generation",
  "error": {
    "type": "embedding_error",
    "message": "Embedding model failed to process content",
    "details": {
      "model": "all-MiniLM-L6-v2",
      "failed_chunks": 5,
      "error_type": "OutOfMemoryError",
      "chunk_sizes": [15000, 12000, 18000, 14000, 16000]
    },
    "retry_possible": true,
    "suggestion": "Reduce chunk size or switch to smaller model"
  }
}
```

#### Qdrant Errors
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "status": "failed",
  "current_stage": "vector_indexing",
  "error": {
    "type": "vector_store_error",
    "message": "Failed to create Qdrant collection",
    "details": {
      "qdrant_error": "Collection already exists",
      "collection_name": "kb_550e8400_e29b_41d4_a716_446655440001",
      "suggested_action": "delete_existing_collection"
    },
    "retry_possible": true,
    "suggestion": "Delete existing collection or use force_recreate option"
  }
}
```

### Recovery Strategies

#### 1. Automatic Retries
- Network timeouts: 3 automatic retries with exponential backoff
- Temporary errors: 2 retries after 5-minute delay
- Rate limiting: Automatic backoff with respectful delays

#### 2. Partial Success Handling
- Continue processing if <20% of pages fail
- Mark KB as "ready_with_warnings" for partial failures
- Provide detailed failure reports

#### 3. Manual Recovery
- Re-indexing API for failed pipelines
- Selective retry for specific stages
- Force recreation of corrupted resources

### Pipeline Metrics and Analytics

#### Performance Metrics
```http
GET /api/v1/kb-pipeline/{pipeline_id}/metrics
```

**Response:**
```json
{
  "pipeline_id": "pipeline_1234567890abcdef",
  "performance_metrics": {
    "total_duration_seconds": 892,
    "stage_durations": {
      "discovery": 15,
      "scraping": 320,
      "parsing": 45,
      "chunking": 89,
      "embedding_generation": 267,
      "vector_indexing": 156
    },
    "throughput": {
      "pages_per_minute": 8.5,
      "chunks_per_minute": 45,
      "embeddings_per_minute": 28,
      "vectors_per_minute": 85
    },
    "resource_usage": {
      "peak_memory_mb": 2048,
      "cpu_time_seconds": 156,
      "network_requests": 94,
      "data_transferred_mb": 12.5
    },
    "quality_metrics": {
      "scraping_success_rate": 95.7,
      "chunk_quality_score": 0.87,
      "embedding_coverage": 100.0
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Slow Processing
**Symptoms:** Pipeline taking longer than estimated
```json
{
  "issue": "slow_processing",
  "current_stage": "scraping",
  "expected_duration_minutes": 5,
  "actual_duration_minutes": 15,
  "possible_causes": [
    "Large page sizes",
    "Slow website response times",
    "High server load",
    "Complex JavaScript rendering"
  ],
  "recommendations": [
    "Check website response times",
    "Consider reducing max_pages",
    "Use stealth_mode for better performance"
  ]
}
```

#### 2. Memory Issues
**Symptoms:** Pipeline failing during embedding generation
```json
{
  "issue": "memory_error",
  "current_stage": "embedding_generation",
  "error_details": {
    "memory_used_gb": 7.2,
    "memory_limit_gb": 8.0,
    "large_chunks_count": 15,
    "avg_chunk_size": 4500
  },
  "recommendations": [
    "Reduce chunk_size to 1000-2000 characters",
    "Use smaller embedding model",
    "Process in smaller batches"
  ]
}
```

#### 3. Access Issues
**Symptoms:** Multiple 403/401 errors during scraping
```json
{
  "issue": "access_denied",
  "current_stage": "scraping",
  "failed_urls": [
    "https://docs.example.com/private/admin",
    "https://docs.example.com/internal/api"
  ],
  "recommendations": [
    "Update include/exclude patterns",
    "Check if authentication is required",
    "Use different user agent or stealth mode"
  ]
}
```

### Debug Commands

#### Force Stage Retry
```http
POST /api/v1/kb-pipeline/{pipeline_id}/retry-stage
```

```json
{
  "stage": "embedding_generation",
  "force": true,
  "options": {
    "clear_partial_results": true,
    "reduce_batch_size": true
  }
}
```

#### Pipeline Diagnosis
```http
GET /api/v1/kb-pipeline/{pipeline_id}/diagnose
```

```json
{
  "pipeline_health": "degraded",
  "issues_found": [
    {
      "severity": "warning",
      "category": "performance",
      "message": "Scraping taking longer than expected",
      "suggestion": "Website may be slow or rate-limiting requests"
    },
    {
      "severity": "error",
      "category": "data_quality",
      "message": "15% of pages failed to scrape",
      "suggestion": "Check URL patterns and website accessibility"
    }
  ],
  "recommendations": {
    "immediate": [
      "Continue monitoring - pipeline likely to complete",
      "Prepare to manually add failed pages if needed"
    ],
    "future": [
      "Adjust crawl settings for this domain",
      "Consider using alternative scraping methods"
    ]
  }
}
```

---

**Last Updated**: November 2024
**API Version**: 1.0