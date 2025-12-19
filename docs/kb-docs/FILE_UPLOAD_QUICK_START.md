# File Upload Quick Start Guide

**Date**: 2025-12-15
**Feature**: Knowledge Base File Upload
**Status**: Ready for Testing

---

## 1. Start the Services

```bash
cd /Users/mac/Downloads/privexbot/backend

# Start all services (including Tika)
docker compose -f docker-compose.dev.yml up --build
```

**Services Started**:
- ✅ Backend API (port 8000)
- ✅ PostgreSQL (port 5434)
- ✅ Redis (port 6380)
- ✅ Qdrant (port 6335)
- ✅ **Tika (port 9998)** ← NEW
- ✅ Celery Worker
- ✅ Flower (port 5555)

**Verify Tika is Running**:
```bash
curl http://localhost:9998/tika
# Should return: "This is Tika Server..."
```

---

## 2. Create a KB Draft

```bash
# Create draft
curl -X POST http://localhost:8000/api/v1/kb-drafts/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "My File KB",
    "description": "Testing file uploads",
    "workspace_id": "YOUR_WORKSPACE_ID",
    "context": "both"
  }'

# Response:
{
  "draft_id": "abc123...",
  "message": "Draft created"
}
```

---

## 3. Upload a File

### Single File Upload

```bash
# Upload PDF file
curl -X POST http://localhost:8000/api/v1/kb-drafts/{draft_id}/sources/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf"

# Response:
{
  "source_id": "uuid",
  "filename": "document.pdf",
  "file_size": 102400,
  "mime_type": "application/pdf",
  "page_count": 5,
  "char_count": 12500,
  "word_count": 2100,
  "parsing_time_ms": 1250,
  "message": "File parsed and added to draft"
}
```

### Bulk File Upload

```bash
# Upload multiple files
curl -X POST http://localhost:8000/api/v1/kb-drafts/{draft_id}/sources/files/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@document1.pdf" \
  -F "files=@document2.docx" \
  -F "files=@document3.csv"

# Response:
{
  "sources_added": 3,
  "source_ids": ["uuid1", "uuid2", "uuid3"],
  "total_chars": 35000,
  "total_pages": 15,
  "failed_files": [],
  "message": "Parsed and added 3 files to draft"
}
```

---

## 4. Configure Chunking

```bash
# Set chunking strategy
curl -X POST http://localhost:8000/api/v1/kb-drafts/{draft_id}/chunking \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200
  }'
```

---

## 5. Preview Chunks (Optional)

```bash
# Preview how content will be chunked
curl -X POST http://localhost:8000/api/v1/kb-drafts/{draft_id}/preview-chunks-live \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "chunking_config": {
      "strategy": "by_heading",
      "chunk_size": 1000,
      "chunk_overlap": 200
    }
  }'

# Response shows estimated chunks, preview samples, etc.
```

---

## 6. Finalize and Deploy

```bash
# Finalize draft (triggers background processing)
curl -X POST http://localhost:8000/api/v1/kb-drafts/{draft_id}/finalize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "chunking_config": {
      "strategy": "by_heading",
      "chunk_size": 1000,
      "chunk_overlap": 200
    }
  }'

# Response:
{
  "kb_id": "kb-uuid",
  "pipeline_id": "kb-uuid:1234567890",
  "status": "processing",
  "message": "KB created successfully. Processing in background.",
  "tracking_url": "/api/v1/pipelines/kb-uuid:1234567890/status"
}
```

---

## 7. Monitor Pipeline Progress

```bash
# Check pipeline status
curl http://localhost:8000/api/v1/pipelines/{pipeline_id}/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "pipeline_id": "kb-uuid:1234567890",
  "kb_id": "kb-uuid",
  "status": "running",  # or "completed", "failed"
  "current_stage": "Generating embeddings",
  "progress_percentage": 75,
  "stats": {
    "chunks_created": 150,
    "embeddings_generated": 150,
    "vectors_indexed": 150
  }
}
```

---

## 8. Query the KB

### For Chatbots

```bash
# Search with chatbot context
curl -X POST http://localhost:8000/api/v1/kbs/{kb_id}/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "How do I reset my password?",
    "context": "chatbot",
    "top_k": 3,
    "score_threshold": 0.75
  }'

# Response:
{
  "results": [
    {
      "content": "To reset your password...",
      "score": 0.85,
      "metadata": {
        "source_type": "file_upload",
        "filename": "user_guide.pdf",
        "page_count": 5
      }
    }
  ]
}
```

### For Chatflows

```bash
# Search with chatflow context
curl -X POST http://localhost:8000/api/v1/kbs/{kb_id}/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Authentication methods",
    "context": "chatflow",
    "top_k": 15,
    "score_threshold": 0.60
  }'

# Returns more comprehensive results for workflow processing
```

---

## 9. Verify Storage

### Check PostgreSQL (Metadata Only)

```bash
# Connect to PostgreSQL
docker exec -it privexbot-postgres-dev psql -U privexbot -d privexbot_dev

# Query document
SELECT id, name, source_type, source_metadata, content_full
FROM documents
WHERE kb_id = 'kb-uuid';

-- Expected:
-- source_type: "file_upload"
-- content_full: NULL ✅
-- source_metadata: Contains filename, file_size, mime_type, etc. ✅
```

### Check Qdrant (Full Content)

```bash
# Get collection info
curl http://localhost:6335/collections/kb_{kb_id}

# Get a point (chunk)
curl http://localhost:6335/collections/kb_{kb_id}/points/{chunk_id}

# Expected payload:
{
  "content": "Chunk text here...",  # ✅ Full text
  "kb_context": "both",             # ✅ Context filtering
  "source_type": "file_upload",     # ✅ Source identification
  "filename": "document.pdf",
  ...
}
```

---

## Supported File Formats

### Documents
- ✅ PDF (with OCR support)
- ✅ DOCX (Microsoft Word)
- ✅ DOC (Microsoft Word)
- ✅ ODT (OpenDocument Text)
- ✅ RTF (Rich Text Format)

### Spreadsheets
- ✅ XLSX (Microsoft Excel)
- ✅ XLS (Microsoft Excel)
- ✅ ODS (OpenDocument Spreadsheet)
- ✅ CSV (Comma-Separated Values)

### Presentations
- ✅ PPTX (Microsoft PowerPoint)
- ✅ PPT (Microsoft PowerPoint)
- ✅ ODP (OpenDocument Presentation)

### Text
- ✅ TXT (Plain Text)
- ✅ MD (Markdown)
- ✅ JSON
- ✅ XML
- ✅ HTML

### Images (with OCR)
- ✅ PNG
- ✅ JPG/JPEG

---

## Troubleshooting

### Issue: "Tika service unavailable"

**Solution**:
```bash
# Check if Tika is running
docker ps | grep tika

# Check Tika logs
docker logs privexbot-tika-dev

# Restart Tika
docker restart privexbot-tika-dev

# Test Tika directly
curl http://localhost:9998/tika
```

### Issue: "File parsing failed"

**Possible Causes**:
1. File is corrupted
2. File is too large (>50MB)
3. File format not supported
4. OCR failed for scanned document

**Solution**:
- Check file integrity
- Reduce file size
- Convert to supported format
- Try without OCR

### Issue: "Cannot connect to Tika"

**Solution**:
```bash
# Check Docker network
docker network inspect privexbot-dev

# Verify backend can reach Tika
docker exec privexbot-backend-dev curl http://tika:9998/tika
```

### Issue: "Chunks not appearing in Qdrant"

**Solution**:
1. Check pipeline status (may still be processing)
2. Verify Qdrant collection exists
3. Check Celery worker logs for errors
4. Ensure kb_id is correct

---

## Example Workflow

### Complete End-to-End Test

```bash
# 1. Create draft
DRAFT_ID=$(curl -X POST http://localhost:8000/api/v1/kb-drafts/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test KB", "workspace_id": "'$WORKSPACE_ID'", "context": "both"}' \
  | jq -r '.draft_id')

# 2. Upload file
curl -X POST http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/sources/file \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-document.pdf"

# 3. Configure chunking
curl -X POST http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/chunking \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"strategy": "by_heading", "chunk_size": 1000, "chunk_overlap": 200}'

# 4. Finalize
FINALIZE_RESPONSE=$(curl -X POST http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/finalize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"chunking_config": {"strategy": "by_heading", "chunk_size": 1000, "chunk_overlap": 200}}')

KB_ID=$(echo $FINALIZE_RESPONSE | jq -r '.kb_id')
PIPELINE_ID=$(echo $FINALIZE_RESPONSE | jq -r '.pipeline_id')

# 5. Monitor (poll every 2 seconds)
while true; do
  STATUS=$(curl -s http://localhost:8000/api/v1/pipelines/$PIPELINE_ID/status \
    -H "Authorization: Bearer $TOKEN" \
    | jq -r '.status')

  echo "Pipeline status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi

  sleep 2
done

# 6. Query
curl -X POST http://localhost:8000/api/v1/kbs/$KB_ID/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "test query", "context": "both", "top_k": 5}'
```

---

## Performance Expectations

| File Size | Parsing Time | Chunking Time | Embedding Time | Total Time |
|-----------|--------------|---------------|----------------|------------|
| 1MB PDF   | 1-2s         | 0.5s          | 2-3s           | ~5s        |
| 5MB DOCX  | 2-4s         | 1s            | 5-10s          | ~15s       |
| 10MB PDF  | 5-8s         | 2s            | 10-20s         | ~30s       |
| 50MB PDF  | 10-15s       | 5s            | 30-60s         | ~90s       |

**With OCR** (scanned documents): Add 5-10 seconds per document

---

## Next Steps

1. Test with your own documents
2. Experiment with different chunking strategies
3. Compare results with different contexts (chatbot vs chatflow)
4. Mix file uploads with web scraping sources
5. Monitor Celery worker and Qdrant performance

---

**Need Help?**
- Check logs: `docker compose -f docker-compose.dev.yml logs -f`
- Monitor Celery: http://localhost:5555 (admin:admin123)
- Check Qdrant: http://localhost:6335/dashboard
- API docs: http://localhost:8000/api/docs
