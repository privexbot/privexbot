# CLAUDE.md for the backend

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PrivexBot Backend** is a FastAPI-based multi-tenant SaaS platform for building and deploying AI chatbots and chatflows with RAG-powered knowledge bases. It supports multiple deployment channels (Website, Discord, Telegram, WhatsApp, API) and uses a privacy-focused approach with Secret AI integration.

## Development Commands

### Local Development (Docker Compose)

```bash
# Start all services (backend, postgres, redis)
docker compose -f docker-compose.dev.yml up

# Start services in background
docker compose -f docker-compose.dev.yml up -d

# Stop services
docker compose -f docker-compose.dev.yml down

# View logs
docker compose -f docker-compose.dev.yml logs -f backend-dev

# Rebuild after dependency changes
docker compose -f docker-compose.dev.yml up --build
```

The dev environment runs on:

- Backend API: http://localhost:8000
- API docs: http://localhost:8000/api/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Database Migrations

```bash
# Create a new migration
docker compose -f docker-compose.dev.yml exec backend-dev alembic revision --autogenerate -m "description"

# Apply migrations
docker compose -f docker-compose.dev.yml exec backend-dev alembic upgrade head

# Rollback one migration
docker compose -f docker-compose.dev.yml exec backend-dev alembic downgrade -1

# View migration history
docker compose -f docker-compose.dev.yml exec backend-dev alembic history
```

Note: Migrations are automatically applied on container startup via `scripts/docker-entrypoint.sh`.

### Testing

```bash
# Run integration tests
docker compose -f docker-compose.dev.yml exec backend-dev python scripts/test_integration.py

# Run unit tests (when available)
docker compose -f docker-compose.dev.yml exec backend-dev pytest src/app/tests/

# Verify test setup
docker compose -f docker-compose.dev.yml exec backend-dev bash scripts/verify_test_setup.sh
```

### Package Management

This project uses `uv` for Python package management (faster than pip/poetry):

```bash
# Add a new dependency
uv add package-name

# Add a dev dependency
uv add --dev package-name

# Update dependencies
uv lock

# Sync dependencies (after pulling changes)
uv sync
```

## Architecture Overview

### Multi-Tenant Hierarchy

```
Organization (Company)
  ↓
Workspace (Team/Department)
  ↓
├── Chatbots (Simple form-based bots)
├── Chatflows (Visual workflow automation)
├── Knowledge Bases (RAG with multiple sources)
├── Credentials (API keys for chatflow nodes)
└── Leads (Captured from interactions)
```

**CRITICAL**: All data is isolated by organization/workspace. Always check tenant context in API endpoints.

### Draft-First Architecture

**IMPORTANT PRINCIPLE**: ALL entity creation (Chatbots, Chatflows, Knowledge Bases) happens in DRAFT mode (Redis) before database save.

**Flow**:

1. Create Draft → Redis (NOT Database)
2. Configure & Edit → Auto-save to Redis (24hr TTL)
3. Live Preview & Test → Real AI responses from draft
4. Select Deployment Channels → Choose where to deploy
5. Validate → Check required fields
6. DEPLOY → ONLY NOW save to database + register webhooks
7. LIVE → Accessible via selected channels

**Why**: No database pollution, easy to abandon, instant preview, validation before commit.

**Key Services**:

- `draft_service.py` - Unified draft management for ALL entity types
- `kb_draft_service.py` - KB-specific draft operations (chunking preview, source handling)

### Chatbot vs Chatflow

| Aspect     | Chatbot              | Chatflow                                       |
| ---------- | -------------------- | ---------------------------------------------- |
| Creation   | Form-based UI        | Drag-and-drop visual editor (ReactFlow)        |
| Complexity | Simple, linear       | Complex, branching, conditional logic          |
| AI Calls   | Single per message   | Multiple (one per LLM node)                    |
| Database   | `chatbots` table     | `chatflows` table                              |
| Service    | `chatbot_service.py` | `chatflow_service.py` + `chatflow_executor.py` |
| Deployment | Same API (unified)   | Same API (unified)                             |

**CRITICAL**: Despite different creation methods, they share the same public API (`/v1/bots/{bot_id}/chat`) and widget.

### Knowledge Base Architecture

### KB ETL Pipeline (CRITICAL - Active Development)

**Pipeline Documentation**: `/docs/kb/pipeline/` contains the complete pipeline architecture
**Implementation Plan**: `/docs/kb/KB_WEB_URL_IMPLEMENTATION_RECOMMENDATION.md`

**IMPORTANT**: The KB system follows a comprehensive ETL pipeline architecture:

1. **Draft-First Creation** (Redis before DB)

   - All KB creation starts in draft mode
   - Sources added to Redis draft with 24hr TTL
   - Configuration tested and validated
   - Preview chunks before finalization
   - Only finalize saves to PostgreSQL and triggers processing

2. **Multi-Source Support**

   - **Web Scraping**: Firecrawl (scrape, crawl, map, extract methods)
   - **File Upload**: 15+ formats with OCR
   - **Cloud Integration**: Google Docs/Sheets, Notion (OAuth)
   - **Direct Text**: Paste and process

3. **Processing Pipeline Stages**

   ```
   Source → Smart Parsing → Intelligent Chunking → Embedding → Vector Store
   ```

   **Stage Details**:

   - **Source Extraction**: `firecrawl_service.py` for web, `file_upload_adapter.py` for files
   - **Smart Parsing**: `smart_parsing_service.py` (structure-aware, preserves headings/code)
   - **Intelligent Chunking**: `enhanced_chunking_service.py` (by_heading, semantic, adaptive, hybrid)
   - **Embedding Generation**: `embedding_service_v2.py` (OpenAI CPU-optimized, batched)
   - **Vector Indexing**: `qdrant_service.py` (Qdrant vector store)

4. **Real-Time Monitoring**

   - Pipeline status tracking in Redis: `pipeline:{id}:status`
   - Frontend polls `/api/v1/pipelines/{id}/status` every 2 seconds
   - Progress updates: scraping → parsing → chunking → embedding → indexing
   - Detailed metrics: pages scraped, chunks created, embeddings generated

5. **Configuration Hierarchy**
   ```
   Global Defaults → Organization → Workspace → KB → Document → Source
   ```
   Each level can override parent configuration.

**Sources Supported**:

- File Upload (PDF, Word, Text, CSV, JSON)
- Website Scraping (Firecrawl primary, Crawl4AI, Jina Reader fallback)
- Google Docs/Sheets (OAuth integration)
- Notion (API integration)
- Direct Text Paste

**Processing Pipeline** (after finalize):

1. Parse content → `smart_parsing_service.py`, `unstructured_adapter.py`, PyMuPDF, python-docx
2. Chunk content → `enhanced_chunking_service.py` (strategies: by_heading, semantic, adaptive, hybrid)
3. Generate embeddings → `embedding_service_v2.py` (OpenAI CPU-optimized with batching)
4. Store in vector DB → `qdrant_service.py` (Qdrant primary), `vector_store_service.py` (FAISS, Weaviate, Milvus, Pinecone)

**Background Processing**: Uses Celery with specialized queues:

- `web_scraping` queue: I/O-bound scraping tasks
- `embeddings` queue: API-bound embedding generation
- `indexing` queue: CPU-bound vector indexing
- Configured in `tasks/kb_pipeline_tasks.py`

#### **CRITICAL FIX: Approved Content Storage Issue (Resolved)**

**Problem**: When users approved/edited content in the frontend, chunking strategies other than `no_chunking` were storing scraped content instead of approved content in `document.content_full`.

**Root Cause**: Different processing paths between combined (no_chunking) and individual (other strategies) processing:

- **Combined Processing (worked)**: Directly stored approved content in `document.content_full`
- **Individual Processing (broken)**: Used preview_data fallback instead of approved content due to conditional logic flaws

**Solution Implemented**: Applied "no_chunking success pattern" to all strategies:

1. **Content Source Guarantee System**:

```python
# Automatically use edited_content when available in fallback scenarios
if content_source == "preview_data" and isinstance(scraped_page, dict):
    edited_content = scraped_page.get("edited_content")
    if edited_content and edited_content.strip():
        page_content = edited_content  # Use approved content instead
        content_source = "corrected_to_approved"
```

2. **Enhanced Metadata-Based Document Matching**:

- Primary: Match documents using `source_id` + `page_index` from metadata
- Fallback: URL-based matching for legacy compatibility
- Prevents placeholder document matching failures

3. **Final Safety Verification**:

```python
# Prevent storing wrong content when approved content exists
if content_source in ("user_approved", "approved_content", "corrected_to_approved"):
    print("✅ STORING APPROVED CONTENT")
else:
    if doc_metadata.get("approved_sources"):
        print("🚨 CRITICAL WARNING: Document has approved_sources but using wrong content!")
```

**Files Modified**:

- `tasks/kb_pipeline_tasks.py` - Applied content guarantee system and enhanced document matching
- `services/kb_draft_service.py` - Enhanced metadata propagation for reliable document matching

**Result**: ALL chunking strategies now consistently store approved/edited content in `document.content_full`, matching the behavior of `no_chunking`.

### Multi-Channel Deployment

**Channels**:

1. Website Embed (JS widget or iframe) - Primary channel
2. Telegram Bot (webhook auto-registered on deploy)
3. Discord Bot (webhook auto-registered on deploy)
4. WhatsApp Business (WhatsApp Business API)
5. Zapier Webhook (auto-generated on deploy)
6. API Direct (REST API with API key auth)

**Integration Files**:

- `integrations/telegram_integration.py`
- `integrations/discord_integration.py`
- `integrations/whatsapp_integration.py`
- `integrations/zapier_integration.py`

**Deployment Flow**: When user clicks "Deploy", backend saves to DB, generates API keys, and registers webhooks for enabled channels.

## Directory Structure

```
backend/
├── src/app/
│   ├── models/              # SQLAlchemy models
│   │   ├── chatbot.py       # Simple chatbot
│   │   ├── chatflow.py      # Advanced workflow
│   │   ├── knowledge_base.py
│   │   ├── document.py
│   │   ├── chunk.py
│   │   ├── lead.py
│   │   ├── organization.py
│   │   ├── workspace.py
│   │   └── user.py
│   │
│   ├── services/            # Business logic layer
│   │   ├── chatbot_service.py          # Chatbot execution
│   │   ├── chatflow_service.py         # Chatflow execution
│   │   ├── chatflow_executor.py        # Node executor (graph traversal)
│   │   ├── inference_service.py        # Secret AI integration
│   │   ├── draft_service.py            # Draft mode (Redis)
│   │   ├── kb_draft_service.py         # KB draft operations
│   │   ├── document_processing_service.py
│   │   ├── chunking_service.py
│   │   ├── embedding_service.py
│   │   ├── vector_store_service.py
│   │   ├── retrieval_service.py
│   │   ├── session_service.py          # Chat history
│   │   ├── credential_service.py
│   │   ├── geoip_service.py            # IP geolocation for leads
│   │   ├── tenant_service.py           # Multi-tenant operations
│   │   └── auth_service.py
│   │
│   ├── adapters/            # Source adapters for KB import
│   │   ├── web_scraping_adapter.py
│   │   ├── file_upload_adapter.py
│   │   ├── text_input_adapter.py
│   │   └── cloud_integration_adapter.py
│   │
│   ├── integrations/        # External service integrations
│   │   ├── discord_integration.py
│   │   ├── telegram_integration.py
│   │   ├── whatsapp_integration.py
│   │   ├── zapier_integration.py
│   │   ├── crawl4ai_adapter.py         # Website scraping
│   │   ├── firecrawl_adapter.py
│   │   ├── jina_adapter.py
│   │   ├── google_adapter.py           # Google Docs/Sheets
│   │   ├── notion_adapter.py
│   │   └── unstructured_adapter.py     # Document parsing
│   │
│   ├── chatflow/            # Chatflow node implementations
│   │   ├── nodes/
│   │   │   ├── llm_node.py
│   │   │   ├── kb_node.py              # Knowledge base search
│   │   │   ├── condition_node.py       # Branching logic
│   │   │   ├── http_node.py            # HTTP requests
│   │   │   ├── variable_node.py
│   │   │   ├── code_node.py
│   │   │   ├── memory_node.py
│   │   │   ├── database_node.py
│   │   │   ├── loop_node.py
│   │   │   └── response_node.py
│   │   └── utils/
│   │       ├── variable_resolver.py
│   │       └── graph_builder.py        # Build execution graph
│   │
│   ├── tasks/               # Celery background tasks
│   │   ├── kb_pipeline_tasks.py        # KB processing pipeline (primary)
│   │   ├── document_tasks.py           # Document processing (after finalize)
│   │   ├── crawling_tasks.py           # Website crawling
│   │   └── sync_tasks.py               # Cloud sync (Notion, Google)
│   │
│   ├── api/v1/routes/       # API endpoints
│   │   ├── auth.py                     # Authentication (email, wallet)
│   │   ├── org.py                      # Organizations
│   │   ├── workspace.py                # Workspaces
│   │   ├── chatbot.py                  # Chatbot CRUD
│   │   ├── chatflows.py                # Chatflow CRUD
│   │   ├── kb_draft.py                 # Draft mode endpoints
│   │   ├── kb.py                       # KB CRUD and management (primary KB API)
│   │   ├── kb_pipeline.py              # Pipeline status monitoring
│   │   ├── knowledge_bases.py          # Legacy KB routes (deprecated)
│   │   ├── knowledge_base_enhanced.py  # Enhanced KB features
│   │   ├── documents.py                # Document management
│   │   ├── content_enhancement.py      # Content enhancement features
│   │   ├── enhanced_search.py          # Enhanced search capabilities
│   │   ├── credentials.py              # API credentials for chatflow nodes
│   │   ├── leads.py                    # Lead capture
│   │   ├── invitation.py               # Team invitations
│   │   ├── public.py                   # Public API (unified bot access)
│   │   └── webhooks/
│   │       ├── discord.py
│   │       ├── telegram.py
│   │       └── whatsapp.py
│   │
│   ├── auth/                # Authentication strategies
│   │   └── strategies/
│   │       ├── email.py                # Email/password auth
│   │       ├── evm.py                  # Ethereum wallet auth
│   │       ├── solana.py               # Solana wallet auth
│   │       └── cosmos.py               # Cosmos wallet auth
│   │
│   ├── schemas/             # Pydantic models for API
│   ├── core/
│   │   ├── config.py                   # Settings from env vars
│   │   └── security.py                 # JWT, password hashing
│   ├── db/
│   │   ├── session.py                  # Database session
│   │   └── init_db.py                  # DB initialization
│   └── main.py              # FastAPI app entry point
│
├── src/alembic/             # Database migrations
│   └── versions/            # Migration files
│
├── scripts/
│   ├── docker-entrypoint.sh            # Auto-run migrations on startup
│   ├── test_integration.py             # Integration tests
│   └── verify_test_setup.sh            # Test setup verification
│
├── deploy/                  # Deployment configs
├── docs/                    # Technical documentation
├── pyproject.toml           # Python dependencies (uv)
├── uv.lock                  # Locked dependencies
├── .env.example             # Production env template
├── .env.dev.example         # Dev env template
├── docker-compose.dev.yml   # Dev environment
└── docker-compose.yml       # Production environment
```

## Key Architectural Patterns

### 0. KB Route Organization (CRITICAL)

**IMPORTANT**: The KB system uses multiple route files with specific responsibilities:

- **`kb.py`**: Primary KB CRUD operations, retry functionality, and management

  - Endpoints: `/api/v1/kbs/*`
  - Contains: list, get, delete, retry-processing, reindex
  - This is the MAIN file for KB operations

- **`kb_draft.py`**: Draft creation and management

  - Endpoints: `/api/v1/kb-drafts/*`
  - Contains: create, update, finalize drafts

- **`kb_pipeline.py`**: Real-time pipeline monitoring

  - Endpoints: `/api/v1/kb-pipeline/{id}/status`
  - Contains: pipeline status polling for frontend

- **`knowledge_bases.py`**: Legacy/deprecated KB routes (avoid using)
- **`knowledge_base_enhanced.py`**: Enhanced features
- **`content_enhancement.py`**: Content enhancement features
- **`enhanced_search.py`**: Enhanced search capabilities

**Celery Task Parameters**:

```python
# Correct task signature (from tasks/kb_pipeline_tasks.py)
process_web_kb_task.apply_async(
    kwargs={
        "kb_id": str(kb_id),
        "pipeline_id": new_pipeline_id,
        "sources": sources,     # NOT 'sources_data'
        "config": kb_config     # NOT 'kb_config'
    },
    queue="high_priority"
)
```

**Status Checking Pattern**:

- Pipeline status: For real-time progress monitoring
- KB status: For determining if retry is needed
- Always check actual KB status (from database) when determining business logic

### KB Cancel Flow Architecture (CRITICAL)

**Three Cancel Points with Different Behaviors**:

| Operation | Phase | Backend Type | Cancel Mechanism |
|-----------|-------|--------------|------------------|
| **Cancel Preview** | Draft (Phase 1) | Sync HTTP | Delete temp draft from Redis |
| **Cancel File Upload** | Draft (Phase 1) | Sync HTTP | Disabled during upload (Tika is fast) |
| **Cancel Pipeline** | Processing (Phase 3) | Celery Task | Revoke task + set KB status to failed |

**Cancel Preview** (Frontend: `KBWebSourceForm.tsx`):
- Creates a TEMPORARY draft for scraping preview
- On cancel: Deletes the temporary draft via `DELETE /api/v1/kb-drafts/{draft_id}`
- Backend scraping may continue briefly but draft won't exist to save to
- Aligned with reject/approve behavior which also cleanup draft

**Cancel File Upload** (Frontend: `KBFileUploadForm.tsx`):
- Adds sources to EXISTING main draft (not temporary)
- Cancel button disabled during upload (Tika parsing is fast <5s for most files)
- Successfully uploaded files remain in draft (user explicitly uploaded them)
- User can remove sources later via `removeSource()` action

**Cancel Pipeline** (Backend: `kb_pipeline.py`):
```python
# Proper Celery task cancellation
celery_app.control.revoke(celery_task_id, terminate=True, signal='SIGTERM')

# Update pipeline and KB status
pipeline_status["status"] = "cancelled"
kb.status = "failed"
kb.error_message = "Pipeline cancelled by user"
```

**Key Design Principles**:
1. Preview creates temp draft → Cancel = delete temp draft
2. File upload adds to main draft → Cancel disabled during upload, files stay after
3. Pipeline uses Celery → Cancel = revoke task (proper background job cancellation)
4. All cancels are consistent with their phase (draft vs processing)

### 1. Secret AI Integration (Backend-Only)

**CRITICAL**: Secret AI is NEVER exposed to frontend/widget. All AI inference happens on backend.

**Location**: `services/inference_service.py`

**Flow**:

1. Widget/frontend sends message to backend API
2. Backend calls Secret AI
3. Backend returns response to widget

### 2. Multi-Tenancy

All database queries MUST filter by organization/workspace. Use these dependencies in routes:

```python
from app.api.v1.dependencies import (
    get_current_user,
    get_current_workspace,
    get_current_organization
)
```

**Example**:

```python
@router.get("/chatbots")
async def list_chatbots(
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    # ALWAYS filter by workspace
    chatbots = db.query(Chatbot).filter(
        Chatbot.workspace_id == workspace.id
    ).all()
    return chatbots
```

### 3. Authentication

Supports multiple authentication strategies:

- Email/password (JWT tokens)
- Wallet-based (EVM, Solana, Cosmos)

**Files**:

- `auth/strategies/email.py`
- `auth/strategies/evm.py`
- `auth/strategies/solana.py`
- `auth/strategies/cosmos.py`

**JWT Configuration**:

- Secret key: `SECRET_KEY` env var (generate with `openssl rand -hex 32`)
- Algorithm: HS256
- Expiry: 30 minutes (configurable)

### 4. Background Tasks (Celery)

**When to Use**:

- Document processing (parsing, chunking, embedding)
- Website crawling
- Cloud sync (Notion, Google Docs)

**Configuration**:

- Broker: Redis (same instance as cache)
- Task files: `tasks/*.py`
- Worker command: `celery -A src.app.tasks.celery_worker worker --loglevel=info`

**Note**: Celery worker is commented out in `docker-compose.dev.yml` - uncomment when needed.

### 5. Draft Mode (Redis)

**Storage Key Pattern**: `draft:{entity_type}:{draft_id}`

**TTL**: 24 hours (auto-extended on save)

**Services**:

- `draft_service.py` - Generic draft operations
- `kb_draft_service.py` - KB-specific operations

**When Editing**: Always read from Redis first, NOT from database.

## Common Development Patterns

### Creating a New API Endpoint

1. Define Pydantic schema in `schemas/`
2. Create route in `api/v1/routes/`
3. Register router in `main.py`
4. Add tenant filtering (workspace/organization)
5. Test with `/api/docs` (Swagger UI)

### Adding a New Chatflow Node

1. Create node class in `chatflow/nodes/` extending `BaseNode`
2. Implement `execute(context)` method
3. Register node type in `chatflow_executor.py`
4. Update frontend node palette (outside this repo)

### Adding a New Knowledge Base Source

1. Create adapter in `integrations/` or `adapters/`
2. Implement import logic (fetch, parse, return content)
3. Add source type to `kb_draft_service.py`
4. Create task in `tasks/` if background processing needed

### Creating a Database Migration

1. Modify model in `models/`
2. Generate migration: `alembic revision --autogenerate -m "description"`
3. Review generated migration in `alembic/versions/`
4. Apply: `alembic upgrade head`

## Environment Variables

**Required**:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `SECRET_KEY` - JWT signing key (generate with `openssl rand -hex 32`)
- `BACKEND_CORS_ORIGINS` - Allowed frontend origins (comma-separated)

**Optional**:

- `FRONTEND_URL` - Frontend URL for invitation links
- `SMTP_*` - Email configuration for invitations
- `CELERY_BROKER_URL` - Celery broker (defaults to Redis)
- `DEBUG` - Enable debug mode (default: false)

See `.env.example` for complete list.

## Production Deployment

The backend is deployed on SecretVM with HTTPS via Nginx reverse proxy.

**Files**:

- `docker-compose.secretvm.yml` - Production compose file
- `.env.secretvm.example` - Production env template
- `deploy/` - Deployment scripts and configs

**Health Check**: `GET /health` - Returns service status

## Important Notes

### Security

- Never commit `.env` files
- Rotate `SECRET_KEY` in production
- Use strong PostgreSQL passwords
- Keep dependencies updated

### Database

- Always use Alembic for schema changes
- Never modify production DB directly
- Foreign keys enforce referential integrity

### Redis

- Used for draft storage (24hr TTL)
- Used for Celery broker/backend
- Used for nonce caching (wallet auth)

### Testing

- Integration tests in `scripts/test_integration.py`
- Unit tests in `src/app/tests/`
- Always test in dev environment before deploying

### CORS

- Update `BACKEND_CORS_ORIGINS` with production frontend domain
- Never use `*` in production
