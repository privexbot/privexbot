# Backend Documentation - Knowledge Base Deep Dive

This directory contains comprehensive documentation about the PrivexBot backend architecture, with special focus on the Knowledge Base system and document processing capabilities.

## 📚 Documents

### 1. [BACKEND_ARCHITECTURE_ANALYSIS.md](./BACKEND_ARCHITECTURE_ANALYSIS.md)
**Comprehensive backend codebase exploration report**

A 7,000+ line deep-dive analysis covering:
- ✅ Complete authentication system analysis (email, EVM, Solana wallets)
- ✅ Multi-tenancy architecture and enforcement patterns
- ✅ Knowledge Base 3-phase pipeline (Draft → Finalize → Process)
- ✅ Web scraping implementation status (Crawl4AI, Firecrawl, Jina)
- ✅ Document processing current state (100% pseudocode)
- ✅ Service layer implementation status matrix
- ✅ Integration points and external dependencies
- ✅ Security analysis and production readiness assessment

**Key Findings**:
- Authentication: **100% implemented** and production-ready
- Multi-tenancy: **Fully functional** with RBAC
- Web scraping: **Working** (Crawl4AI with Playwright)
- File upload: **Not implemented** (all pseudocode)
- Chatbot/Chatflow: **Routes not registered** in main.py

### 2. [DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md](./DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md)
**Detailed implementation roadmap for document processing**

Complete implementation guide including:
- 🎯 Two-track approach (Quick win + Native implementation)
- 📝 Phase-by-phase code examples
- 🛠️ Technology stack recommendations
- 📊 Timeline with milestones (2-10 weeks)
- 🔒 Security considerations
- 💰 Cost analysis
- 🧪 Testing strategy

**Recommended Path**:
1. **Week 1-2**: Use Unstructured library for quick launch
2. **Week 3-6**: Build native processors (PDF, DOCX, Excel)
3. **Week 7-8**: Add OCR support
4. **Week 9-10**: Polish and production deployment

---

## 🔑 Key Insights

### What's Production-Ready ✅

1. **Authentication System**
   - Email/password with bcrypt
   - EVM wallet (Ethereum) auth
   - Solana wallet auth
   - JWT tokens with 30min expiry
   - Redis-based nonce management

2. **Multi-Tenancy**
   - Organization → Workspace hierarchy
   - Complete tenant isolation
   - RBAC with 17+ permissions
   - Cascade delete enforcement

3. **Knowledge Base (Web URLs Only)**
   - Draft-first architecture (Redis)
   - Crawl4AI service with Playwright
   - Real-time pipeline progress tracking
   - Celery background processing
   - Qdrant vector store
   - Chunking strategies (5 types)
   - Embedding generation (OpenAI)

### What Needs Work ⚠️

1. **File Upload Processing** - 0% implemented
   - All code is pseudocode documentation
   - Claims support for 15+ formats
   - Zero actual implementation

2. **Smart Parsing Service** - 0% implemented
   - Architectural documentation only
   - No working code

3. **Chatbot/Chatflow Routes** - Not registered
   - Route files exist but not imported in `main.py`
   - All chatflow nodes are pseudocode

### What's Partially Working ⚡

1. **Unstructured Adapter** - Can be leveraged
   - Works with Unstructured.io API (requires key)
   - Works with local library (requires install)
   - Good starting point for quick implementation

2. **Firecrawl Adapter** - Basic wrapper
   - API integration exists
   - Falls back to BeautifulSoup
   - Not using full Firecrawl capabilities

---

## 🏗️ Architecture Overview

### Current KB Pipeline (Web URLs Only)

```
Draft Creation (Redis)
    ↓
Add Web Sources
    ↓
Configure (Chunking, Embedding, Vector Store)
    ↓
Preview & Test
    ↓
Finalize → Creates DB records, queues Celery task
    ↓
Background Processing (Celery)
    ├─→ Scrape pages (Crawl4AI)
    ├─→ Parse content
    ├─→ Apply chunking strategy
    ├─→ Generate embeddings
    └─→ Index to Qdrant
    ↓
KB Status: "ready"
```

### Proposed KB Pipeline (With File Upload)

```
Draft Creation (Redis)
    ↓
Add Sources (Web URLs OR File Upload OR Text Input)
    ├─→ Web URL: Existing flow (working)
    ├─→ File Upload: NEW - Process with FileUploadAdapter
    └─→ Text Input: Existing flow (working)
    ↓
Configure (Same as current)
    ↓
Preview & Test
    ↓
Finalize → Creates DB records, queues Celery task
    ↓
Background Processing (Celery)
    ├─→ Route by source type
    │   ├─→ web_url: Crawl4AI (existing)
    │   ├─→ file_upload: FileUploadAdapter (NEW)
    │   └─→ text_input: Direct processing (existing)
    ├─→ Parse content
    ├─→ Apply chunking strategy
    ├─→ Generate embeddings
    └─→ Index to Qdrant
    ↓
KB Status: "ready"
```

---

## 🎯 Immediate Next Steps

### Priority 1: Enable File Upload (Week 1-2)

**Goal**: Get basic file upload working using Unstructured library

**Tasks**:
1. Install dependencies
   ```bash
   cd backend
   uv add unstructured[all-docs]
   uv add pytesseract
   uv add Pillow
   uv add python-magic
   ```

2. Implement `FileUploadAdapter` wrapper class
   - Route simple formats (TXT, CSV, MD) to native Python
   - Route complex formats (PDF, DOCX) to Unstructured

3. Add API endpoint: `POST /api/v1/kb-drafts/{draft_id}/sources/file`

4. Update Celery pipeline to handle `file_upload` source type

5. Test with sample files (TXT, PDF, DOCX)

**Success Criteria**: Can upload PDF and create KB from it

### Priority 2: Register Chatbot/Chatflow Routes (Week 1)

**Goal**: Make chatbot/chatflow routes accessible

**Task**: Edit `/backend/src/app/main.py`

```python
# Add to imports (line 10)
from app.api.v1.routes import (
    auth,
    org,
    workspace,
    context,
    invitation,
    kb_draft,
    kb_pipeline,
    kb,
    content_enhancement,
    enhanced_search,
    chatbot,      # ADD THIS
    chatflows,    # ADD THIS
    credentials,  # ADD THIS
    leads,        # ADD THIS
    public,       # ADD THIS
)

# Add route registrations (after line 60)
app.include_router(chatbot.router, prefix="/api/v1", tags=["chatbots"])
app.include_router(chatflows.router, prefix="/api/v1", tags=["chatflows"])
app.include_router(credentials.router, prefix="/api/v1", tags=["credentials"])
app.include_router(leads.router, prefix="/api/v1", tags=["leads"])
app.include_router(public.router, prefix="/api/v1", tags=["public"])
```

**Success Criteria**: Routes visible in `/api/docs`

### Priority 3: Native PDF Processing (Week 3-4)

**Goal**: Replace Unstructured with native PyMuPDF for better control

**Tasks**:
1. Install PyMuPDF and pdfplumber
   ```bash
   uv add PyMuPDF pdfplumber
   ```

2. Implement `PDFProcessor` class with:
   - Text extraction with layout preservation
   - Table detection and extraction
   - OCR detection for scanned pages

3. Update `FileUploadAdapter` to use native processor for PDFs

4. Benchmark performance vs Unstructured

**Success Criteria**: Process 100-page PDF in < 30 seconds

---

## 📊 Implementation Status Matrix

| Component | Status | Lines | Implementation % | Notes |
|-----------|--------|-------|-----------------|-------|
| **Authentication** |
| Email/Password | ✅ Complete | 1273 | 100% | Production-ready |
| EVM Wallet | ✅ Complete | 404 | 100% | EIP-4361 compliant |
| Solana Wallet | ✅ Complete | 401 | 100% | Ed25519 verification |
| Cosmos Wallet | ⚠️ Unknown | ? | ? | Not examined |
| JWT/Security | ✅ Complete | 467 | 100% | HS256, 30min expiry |
| **Multi-Tenancy** |
| Organization Model | ✅ Complete | 180 | 100% | With subscriptions |
| Workspace Model | ✅ Complete | ? | 100% | With RBAC |
| Tenant Isolation | ✅ Complete | - | 100% | Enforced in queries |
| **Knowledge Base** |
| Draft Service | ✅ Complete | ? | 100% | Redis-based |
| Pipeline Task | ✅ Complete | 500+ | 100% | Celery orchestration |
| Crawl4AI Service | ✅ Complete | 300+ | 100% | Playwright-based |
| Qdrant Service | ✅ Complete | ? | 100% | Vector store |
| Embedding Service | ✅ Complete | ? | 100% | OpenAI integration |
| **Web Scraping** |
| Crawl4AI Service | ✅ Complete | 300+ | 100% | Production-ready |
| Firecrawl Adapter | ⚠️ Basic | 225 | 40% | API wrapper + fallback |
| Crawl4AI Adapter | ⚠️ Misleading | 286 | 30% | Just requests+BS4 |
| Jina Adapter | ❓ Unknown | ? | ? | Not examined |
| **Document Processing** |
| File Upload Adapter | ❌ Pseudocode | 450 | 0% | All documentation |
| Smart Parsing | ❌ Pseudocode | 200+ | 0% | Architectural docs |
| Unstructured Adapter | ✅ Functional | 311 | 70% | API/Library wrapper |
| **Chatbot/Chatflow** |
| Chatbot Routes | ⚠️ Not Registered | ? | 90% | Exists but not imported |
| Chatflow Routes | ⚠️ Not Registered | ? | 90% | Exists but not imported |
| Chatflow Nodes (11) | ❌ Pseudocode | ? | 10% | All pseudocode headers |
| Public API | ⚠️ Not Registered | ? | 90% | Exists but not imported |
| **Integrations** |
| Email Service | ✅ Complete | ? | 100% | SMTP with retry |
| Invitation Service | ✅ Complete | ? | 100% | Token-based |
| Discord | ❓ Unknown | ? | ? | Not examined |
| Telegram | ❓ Unknown | ? | ? | Not examined |
| WhatsApp | ❓ Unknown | ? | ? | Not examined |
| Zapier | ❓ Unknown | ? | ? | Not examined |

---

## 🛠️ Technology Stack

### Core Framework
- **FastAPI** 0.117.1+ - Web framework
- **Pydantic** 2.11.9+ - Data validation
- **SQLAlchemy** 2.0.43+ - ORM
- **Alembic** 1.16.5+ - Migrations

### Authentication
- **passlib[bcrypt]** - Password hashing
- **python-jose** - JWT tokens
- **web3** 6.0.0+ - EVM wallet verification
- **pynacl** 1.5.0+ - Solana wallet verification

### Knowledge Base
- **crawl4ai** 0.2.0+ - Web scraping
- **playwright** 1.40.0+ - Browser automation
- **qdrant-client** 1.7.0+ - Vector database
- **sentence-transformers** 2.2.0+ - Embeddings
- **torch** 2.0.0+ - ML backend

### Background Processing
- **celery[redis]** 5.4.0+ - Task queue
- **redis** 5.0.0+ - Cache & broker
- **flower** 2.0.0+ - Celery monitoring

### Missing (for file upload)
- ❌ **unstructured** - Document parsing
- ❌ **PyMuPDF** - PDF processing
- ❌ **python-docx** - DOCX processing
- ❌ **pandas** - Excel/CSV processing
- ❌ **pytesseract** - OCR
- ❌ **Pillow** - Image processing
- ❌ **beautifulsoup4** - HTML parsing
- ❌ **requests** - HTTP client

---

## 🔐 Security Analysis

### Strengths ✅
- Bcrypt password hashing with auto-salting
- Constant-time password comparison
- Cryptographic nonce management (Redis)
- JWT with 30-minute expiration
- Multi-tenant data isolation
- RBAC with granular permissions

### Concerns ⚠️
- CORS allows all methods/headers (too permissive)
- Rate limiting dependency installed but not observed in use
- API keys stored in settings without encryption
- Missing file upload validation (size limits, MIME verification)

### Recommendations
1. Restrict CORS to specific methods/headers
2. Implement rate limiting on auth endpoints
3. Add file upload security (virus scanning, size limits)
4. Encrypt stored API keys/credentials

---

## 📈 Performance Considerations

### Current Bottlenecks

1. **Celery Tasks** - Synchronous processing
   - Single-threaded chunking
   - Sequential embedding generation
   - **Solution**: Batch processing, async operations

2. **Web Scraping** - Playwright overhead
   - Each page requires browser instance
   - **Solution**: Connection pooling, headless optimization

3. **Vector Indexing** - Large batch inserts
   - Can overwhelm Qdrant
   - **Solution**: Smaller batches, rate limiting

### Optimization Opportunities

1. **Embedding Generation**
   - Current: Sequential OpenAI API calls
   - **Improvement**: Batch API calls (up to 100 texts per request)
   - **Expected gain**: 10x faster

2. **Chunking**
   - Current: Single-threaded
   - **Improvement**: Multiprocessing for large documents
   - **Expected gain**: 4x faster on multi-core

3. **Document Processing**
   - Current: Not implemented
   - **Target**: Process 100-page PDF in < 30 seconds
   - **Strategy**: PyMuPDF (faster than PyPDF2)

---

## 📝 Development Workflow

### Database Migrations

```bash
# Create migration
docker compose -f docker-compose.dev.yml exec backend-dev \
  alembic revision --autogenerate -m "description"

# Apply migration
docker compose -f docker-compose.dev.yml exec backend-dev \
  alembic upgrade head

# View history
docker compose -f docker-compose.dev.yml exec backend-dev \
  alembic history
```

### Testing

```bash
# Run integration tests
docker compose -f docker-compose.dev.yml exec backend-dev \
  python scripts/test_integration.py

# Run unit tests
docker compose -f docker-compose.dev.yml exec backend-dev \
  pytest src/app/tests/

# Verify test setup
docker compose -f docker-compose.dev.yml exec backend-dev \
  bash scripts/verify_test_setup.sh
```

### Package Management

```bash
# Add dependency
uv add package-name

# Add dev dependency
uv add --dev package-name

# Update lock file
uv lock

# Sync environment
uv sync
```

---

## 🎓 Learning Resources

### Understanding the Architecture

1. **Start here**: Read `BACKEND_ARCHITECTURE_ANALYSIS.md` (this provides the complete picture)

2. **Deep dive**: Read `DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md` (implementation guide)

3. **Code exploration**:
   - Entry point: `/backend/src/app/main.py`
   - Auth flow: `/backend/src/app/auth/strategies/email.py`
   - KB pipeline: `/backend/src/app/tasks/kb_pipeline_tasks.py`
   - Web scraping: `/backend/src/app/services/crawl4ai_service.py`

### External Documentation

- **FastAPI**: https://fastapi.tiangolo.com/
- **SQLAlchemy**: https://docs.sqlalchemy.org/
- **Celery**: https://docs.celeryq.dev/
- **Qdrant**: https://qdrant.tech/documentation/
- **Crawl4AI**: https://docs.crawl4ai.com/
- **Unstructured**: https://unstructured-io.github.io/unstructured/

---

## 🚀 Quick Start Guide

### Running the Backend

```bash
# Start all services
docker compose -f backend/docker-compose.dev.yml up

# View logs
docker compose -f backend/docker-compose.dev.yml logs -f backend-dev

# Stop services
docker compose -f backend/docker-compose.dev.yml down
```

### Accessing Services

- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Qdrant**: localhost:6333

### Testing the API

```bash
# Health check
curl http://localhost:8000/health

# Signup
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "full_name": "Test User",
    "organization_name": "Test Org"
  }'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

---

## 📞 Support

For questions or issues:
1. Check the detailed analysis documents in this directory
2. Review the main `CLAUDE.md` in project root
3. Examine the specific service/adapter code
4. Create an issue in the repository

---

**Last Updated**: 2025-12-15
**Backend Branch**: kb-docs
**Analysis Confidence**: High (based on actual code examination)