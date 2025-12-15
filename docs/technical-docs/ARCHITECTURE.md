# PrivexBot Architecture

This document provides a high-level overview of PrivexBot's architecture, design decisions, and system components.

## Table of Contents

- [System Overview](#system-overview)
- [Core Components](#core-components)
- [Architectural Principles](#architectural-principles)
- [Multi-Tenancy](#multi-tenancy)
- [Draft-First Architecture](#draft-first-architecture)
- [Data Flow](#data-flow)
- [Technology Decisions](#technology-decisions)
- [Detailed Documentation](#detailed-documentation)

---

## System Overview

PrivexBot is a multi-tenant SaaS platform built as a **monorepo** with three main packages:

```
┌────────────────────────────────────────────────────────────────┐
│                       PrivexBot Ecosystem                      │
└────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌──────────────┐
│   Frontend    │    │    Backend     │    │    Widget    │
│ (React + TS)  │◄──►│ (FastAPI + Py) │    │ (Vanilla JS) │
│               │    │                │    │              │
│ - Dashboard   │    │ - REST API     │    │ - Chat UI    │
│ - Bot Builder │    │ - Multi-tenant │    │ - Embed      │
│ - Analytics   │    │ - RAG Engine   │    │ - ~50KB      │
└───────────────┘    └────────────────┘    └──────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
        ┌───────────┐  ┌──────────┐  ┌──────────┐
        │ PostgreSQL│  │  Redis   │  │ Vector DB│
        │           │  │          │  │          │
        │ - Data    │  │ - Drafts │  │ - FAISS  │
        │ - Users   │  │ - Cache  │  │ - Qdrant │
        │ - Bots    │  │ - Queue  │  │ - Pinecone│
        └───────────┘  └──────────┘  └──────────┘
```

---

## Core Components

### 1. Frontend (React + TypeScript)

**Purpose:** Admin dashboard for creating and managing chatbots

**Key Features:**

- Form-based chatbot builder
- Visual chatflow builder (ReactFlow)
- Knowledge base creation wizard
- Lead management dashboard
- Analytics and insights

**Technology Stack:**

- React 19 with TypeScript
- Vite for building
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod
- Zustand for state management

**Port:** 3000 (development) / 443 (production)

### 2. Backend (FastAPI + Python)

**Purpose:** Multi-tenant API server with AI inference

**Key Features:**

- RESTful API (versioned)
- Multi-provider authentication
- RAG knowledge base processing
- Secret AI for inference
- Multi-channel integrations
- Background task processing (Celery)

**Technology Stack:**

- FastAPI with Pydantic V2
- SQLAlchemy 2.0 ORM
- PostgreSQL 15+
- Redis for caching and drafts
- Celery for async tasks

**Port:** 8000

### 3. Widget (Vanilla JavaScript)

**Purpose:** Embeddable chat widget for end-user websites

**Key Features:**

- Framework-agnostic
- Lightweight (~50KB)
- Customizable appearance
- Lead capture forms
- Multi-language support

**Technology Stack:**

- Vanilla JavaScript (ES6+)
- Webpack for bundling
- CSS-in-JS for styling

**Deployment:** CDN or backend-served

### 4. Infrastructure

**PostgreSQL** - Primary data store

- User accounts and tenancy
- Chatbot/chatflow configurations
- Chat history and analytics
- Multi-tenant isolation

**Redis** - In-memory store

- Draft storage (before DB commit)
- Session management
- Celery task queue
- Rate limiting cache

**Vector Databases** - Embeddings storage

- FAISS (local, fast)
- Qdrant (self-hosted)
- Pinecone (cloud-based)
- Weaviate, Milvus (options)

---

## Architectural Principles

### 1. Multi-Tenancy

Every resource belongs to an organization and workspace:

```
User → Organization → Workspace → [Chatbots, Chatflows, KBs]
```

**Isolation Enforcement:**

- ALL database queries filter by `workspace_id` or `organization_id`
- JWT tokens contain current tenant context
- API routes verify ownership before operations

**Benefits:**

- Single database serves multiple customers
- Data isolation guarantees
- Scalable pricing per tenant

**📖 Details:** [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md#multi-tenancy)

### 2. Draft-First Architecture

**Critical Principle:** All creation happens in Redis before PostgreSQL

```
Create Entity → Redis Draft → Configure → Test → Deploy → PostgreSQL
```

**Why This Approach:**

- ✅ No database pollution during creation
- ✅ Fast auto-save without DB writes
- ✅ Easy to abandon (just delete Redis key)
- ✅ Live preview with real data
- ✅ Validation before commit

**Applies To:**

- Chatbots
- Chatflows
- Knowledge Bases

**📖 Details:** [KB_DRAFT_MODE_ARCHITECTURE.md](./KB_DRAFT_MODE_ARCHITECTURE.md)

### 3. Separation of Concerns

**Clear boundaries between components:**

| Layer            | Responsibility              | Example                                |
| ---------------- | --------------------------- | -------------------------------------- |
| **API Routes**   | HTTP handling, validation   | `api/v1/routes/chatbot.py`             |
| **Services**     | Business logic              | `services/chatbot_service.py`          |
| **Models**       | Database schema             | `models/chatbot.py`                    |
| **Schemas**      | Request/response validation | `schemas/chatbot.py`                   |
| **Integrations** | External APIs               | `integrations/telegram_integration.py` |

### 4. Backend-Only AI

**Secret AI never exposed to frontend:**

```
Widget → Backend API → Secret VM (TEE) → Response → Widget
```

**Security Benefits:**

- API keys never leave backend
- Zero client-side AI logic
- Confidential computation in TEE
- Remote attestation available

### 5. Unified Public API

**Same API works for both chatbots and chatflows:**

```python
POST /api/v1/bots/{bot_id}/chat

# Auto-detects bot type
# Routes to chatbot_service or chatflow_service
# Widget doesn't care which type
```

### 6. Background Processing

**Never block API requests:**

```python
# GOOD: Queue background task
celery_task.process_document.delay(document_id)
return {"status": "processing"}

# BAD: Block request
process_document(document_id)  # Takes 5 minutes!
return {"status": "complete"}
```

**Use Cases:**

- Document processing (parsing, chunking, embedding)
- Website crawling
- Batch operations
- Email notifications

---

## Multi-Tenancy

### Hierarchy Model

```
┌─────────────────────────────────────────────────┐
│ User (Alice)                                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────────────────────────────────────────┐   │
│  │ Organization: Acme Corp                 │   │
│  ├────────────────────────────────────────┤   │
│  │                                         │   │
│  │  ┌────────────────────────────────┐    │   │
│  │  │ Workspace: Sales Team          │    │   │
│  │  ├────────────────────────────────┤    │   │
│  │  │ - Chatbot: Lead Qualifier      │    │   │
│  │  │ - KB: Product Catalog          │    │   │
│  │  │ - Leads: 150 captured          │    │   │
│  │  └────────────────────────────────┘    │   │
│  │                                         │   │
│  │  ┌────────────────────────────────┐    │   │
│  │  │ Workspace: Support Team        │    │   │
│  │  ├────────────────────────────────┤    │   │
│  │  │ - Chatflow: Ticket Router      │    │   │
│  │  │ - KB: Help Center Articles     │    │   │
│  │  │ - Chatbot: FAQ Bot             │    │   │
│  │  └────────────────────────────────┘    │   │
│  └────────────────────────────────────────┘   │
│                                                 │
│  ┌────────────────────────────────────────┐   │
│  │ Organization: Consulting LLC            │   │
│  ├────────────────────────────────────────┤   │
│  │  ┌────────────────────────────────┐    │   │
│  │  │ Workspace: Client A            │    │   │
│  │  │ Workspace: Client B            │    │   │
│  │  │ Workspace: Client C            │    │   │
│  │  └────────────────────────────────┘    │   │
│  └────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Database Schema

**Key tables:**

- `users` - User accounts
- `auth_identities` - Multi-provider auth (email, wallets)
- `organizations` - Top-level tenants
- `organization_members` - User-to-org membership
- `workspaces` - Subdivisions within orgs
- `workspace_members` - User-to-workspace membership
- `chatbots`, `chatflows`, `knowledge_bases` - Resources (all have `workspace_id`)

---

## Draft-First Architecture

### The Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: CREATE DRAFT                                        │
├─────────────────────────────────────────────────────────────┤
│ POST /api/v1/chatbots/draft                                │
│                                                             │
│ → Creates Redis key: draft:chatbot:{uuid}                  │
│ → Returns draft_id                                          │
│ → TTL: 24 hours (auto-extended on save)                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: CONFIGURE & EDIT                                    │
├─────────────────────────────────────────────────────────────┤
│ PUT /api/v1/chatbots/draft/{draft_id}                      │
│                                                             │
│ → Updates Redis draft                                       │
│ → Auto-save every 5 seconds (frontend)                      │
│ → No PostgreSQL writes                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: LIVE PREVIEW & TEST                                 │
├─────────────────────────────────────────────────────────────┤
│ POST /api/v1/chatbots/draft/{draft_id}/test                │
│                                                             │
│ → Loads draft from Redis                                    │
│ → Uses real AI inference                                    │
│ → Returns actual bot responses                              │
│ → No permanent side effects                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: DEPLOY                                              │
├─────────────────────────────────────────────────────────────┤
│ POST /api/v1/chatbots/draft/{draft_id}/deploy              │
│                                                             │
│ → Validates draft                                           │
│ → Creates PostgreSQL record                                 │
│ → Registers webhooks (if channels selected)                 │
│ → Deletes Redis draft                                       │
│ → Returns chatbot_id + embed code                           │
└─────────────────────────────────────────────────────────────┘
```

### Benefits

1. **Fast Iteration** - Redis is 100x faster than PostgreSQL for frequent writes
2. **Easy Rollback** - Just delete Redis key, no cleanup needed
3. **No DB Clutter** - Abandoned drafts auto-expire
4. **Live Testing** - Test with real AI before committing
5. **User Experience** - Instant saves, no loading spinners

---

## Data Flow

### Creating and Using a Chatbot

```
┌──────────────────────────────────────────────────────────┐
│ 1. USER CREATES BOT                                      │
└──────────────────────────────────────────────────────────┘
User opens ChatbotBuilder
  → Frontend calls POST /api/v1/chatbots/draft
  → Backend creates Redis draft
  → User configures settings
  → Frontend auto-saves to Redis every 5s
  → User clicks "Deploy"
  → Backend validates and saves to PostgreSQL
  → Returns bot_id and embed code

┌──────────────────────────────────────────────────────────┐
│ 2. END-USER VISITS WEBSITE                               │
└──────────────────────────────────────────────────────────┘
Browser loads customer website
  → Encounters <script src="...widget.js"></script>
  → Downloads widget.js from backend/CDN
  → Widget initializes with bot_id
  → Fetches bot config from backend
  → Displays chat bubble

┌──────────────────────────────────────────────────────────┐
│ 3. END-USER SENDS MESSAGE                                │
└──────────────────────────────────────────────────────────┘
User clicks bubble and types message
  → Widget POSTs to /api/v1/bots/{bot_id}/chat
  → Backend:
      1. Loads bot config from PostgreSQL
      2. Retrieves from knowledge base (if enabled)
      3. Calls Secret AI with context
      4. Saves message to chat_sessions/chat_messages
      5. Returns response
  → Widget displays response
```

### Knowledge Base RAG Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. KB CREATION (Draft Mode)                             │
└──────────────────────────────────────────────────────────┘
POST /api/v1/kb/draft
  → Redis: draft:kb:{uuid}

PUT /api/v1/kb/draft/{id}/sources
  → Upload files → /tmp (temp storage)
  → Scrape websites → content in Redis
  → Import Notion/Google Docs → content in Redis

GET /api/v1/kb/draft/{id}/preview-chunks
  → On-the-fly chunking
  → Shows preview without DB save

POST /api/v1/kb/draft/{id}/finalize
  → Moves files from /tmp to permanent storage
  → Creates PostgreSQL kb and documents records
  → Queues Celery tasks for processing
  → Deletes Redis draft

┌──────────────────────────────────────────────────────────┐
│ 2. BACKGROUND PROCESSING (Celery)                        │
└──────────────────────────────────────────────────────────┘
process_document.delay(document_id)
  → Parse content (Unstructured.io)
  → Chunk text (chunking_service)
  → Generate embeddings (embedding_service)
  → Store in vector DB (vector_store_service)
  → Update document status: indexed

┌──────────────────────────────────────────────────────────┐
│ 3. RAG RETRIEVAL (Chat Time)                             │
└──────────────────────────────────────────────────────────┘
User message arrives
  → retrieval_service.retrieve(kb_id, query)
  → Embed query
  → Vector similarity search
  → Retrieve top-k chunks
  → Rerank by relevance
  → Inject into LLM context
  → Generate response with citations
```

---

## Technology Decisions

### Why FastAPI?

- Modern Python web framework
- Automatic API documentation (OpenAPI)
- Native async/await support
- Pydantic for validation
- Performance comparable to Node.js

### Why React 19?

- Server Components support (future optimization)
- Improved hooks and concurrent rendering
- Large ecosystem and community
- TypeScript support out of the box

### Why PostgreSQL over MongoDB?

- Multi-tenancy requires strong ACID guarantees
- Complex relationships (users, orgs, workspaces)
- pg vector extension for embeddings
- Mature and battle-tested

### Why Redis for Drafts?

- 100x faster than PostgreSQL for frequent writes
- Built-in TTL (auto-expiry)
- Atomic operations
- Celery broker compatibility

### Why Monorepo?

- Shared types between frontend/backend
- Single version control
- Coordinated releases
- Easier refactoring

---

## Detailed Documentation

### Technical Specifications

- **[Architecture Summary](./ARCHITECTURE.md)** - Complete technical overview
- **[Multi-Tenancy Details](./ARCHITECTURE_SUMMARY.md#multi-tenancy)** - Tenant isolation implementation
- **[Draft Mode Architecture](./KB_DRAFT_MODE_ARCHITECTURE.md)** - Redis-based draft system
- **[Knowledge Base Flow](./KNOWLEDGE_BASE_CREATION_FLOW.md)** - RAG implementation
- **[Deployment Architecture](./CHATBOT_DEPLOYMENT_ARCHITECTURE.md)** - Multi-channel deployment

### Component Documentation

- **[Backend Guide](./COMPLETE_BACKEND_STRUCTURE.md)** - Python backend architecture
- **[Frontend Guide](./FRONTEND_IMPLEMENTATION_SUMMARY.md)** - React frontend architecture
- **[Widget Guide](./../../widget/README.md)** - Embeddable widget development

### Infrastructure

- **[Docker Setup](./DOCKER_SETUP.md)** - Local development environment
- **[Production Deployment](./DEPLOYMENT_GUIDE.md)** - Deploy to production
- **[Complete Architecture](./ARCHITECTURE_SUMMARY.md)** - Deep dive with diagrams

---

## Design Patterns

### Repository Pattern

Services don't access database directly—they use repository classes:

```python
# services/chatbot_service.py
from repositories.chatbot_repository import ChatbotRepository

class ChatbotService:
    def __init__(self):
        self.repo = ChatbotRepository()

    def get_chatbot(self, chatbot_id, user):
        return self.repo.find_by_id_and_user(chatbot_id, user)
```

### Dependency Injection

FastAPI's dependency injection for auth and database:

```python
@router.get("/chatbots/{chatbot_id}")
async def get_chatbot(
    chatbot_id: UUID,
    current_user: User = Depends(get_current_user),  # DI
    db: Session = Depends(get_db)  # DI
):
    ...
```

### Strategy Pattern

Pluggable authentication strategies:

```python
# auth/strategies/email.py
class EmailAuthStrategy(AuthStrategy):
    def authenticate(self, credentials): ...

# auth/strategies/evm.py
class EVMAuthStrategy(AuthStrategy):
    def authenticate(self, wallet_signature): ...
```

---

## Security Architecture

### Authentication Flow

```
1. User submits credentials
   ↓
2. Strategy validates (email/password or wallet signature)
   ↓
3. Create or retrieve user from database
   ↓
4. Generate JWT with claims (user_id, org_id, ws_id, permissions)
   ↓
5. Return access_token + refresh_token
   ↓
6. Frontend stores in httpOnly cookie or localStorage
   ↓
7. All subsequent requests include JWT in Authorization header
   ↓
8. Dependency injection extracts user from token
```

### Tenant Isolation

**Every API route:**

```python
# Step 1: Extract user from JWT
current_user = Depends(get_current_user)

# Step 2: Verify resource belongs to user's tenant
chatbot = db.query(Chatbot).join(Workspace).filter(
    Chatbot.id == chatbot_id,
    Workspace.organization_id == current_user.org_id  # CRITICAL!
).first()

# Step 3: Return 404 if not found (don't reveal existence)
if not chatbot:
    raise HTTPException(404)
```

### Secret VM (TEE)

All AI inference runs in Trusted Execution Environment:

```
User Message → Backend API → Secret VM (encrypted memory)
                                  ↓
                           AI processes in TEE
                                  ↓
                         Response (encrypted)
                                  ↓
Backend API ← Response ← Secret VM

Benefits:
- Data encrypted in memory during computation
- Remote attestation available
- Zero knowledge to host/admin
```

---

## Scalability Considerations

### Vertical Scaling (Single Server)

**Good for:** 1-1,000 concurrent users

- Increase CPU/RAM
- Optimize database queries
- Add Redis caching
- Use pgvector for embeddings

### Horizontal Scaling (Multiple Servers)

**Good for:** 1,000-100,000 concurrent users

- Load balancer (Nginx, AWS ALB)
- Multiple backend instances
- Shared PostgreSQL (RDS, managed)
- Shared Redis cluster (ElastiCache)
- CDN for widget delivery

### Microservices (Enterprise)

**Good for:** 100,000+ concurrent users

- Split services (API, Inference, Processing)
- Kubernetes orchestration
- Message queue (RabbitMQ, Kafka)
- Distributed vector DB (Pinecone, Weaviate Cloud)
- Multi-region deployment

---

## Performance Optimization

### Database

- Index on `workspace_id`, `organization_id`, `created_at`
- Partition large tables by date
- Use connection pooling (SQLAlchemy)
- Enable query caching in Redis

### API

- Response caching for read-heavy endpoints
- Rate limiting (per-user, per-IP)
- Async endpoints where possible
- Batch operations for bulk updates

### Frontend

- Code splitting by route
- Lazy loading for large components
- React memo for expensive renders
- Virtual scrolling for long lists

### Widget

- Lazy load (only when clicked)
- Bundle size optimization (~50KB)
- CDN delivery for global speed
- Browser caching with versioned URLs

---

**For questions or clarifications, see:**

- [Getting Started](./../intro/GETTING_STARTED.md)
- [Deployment Guide](./../intro/DEPLOYMENT_GUIDE.md)
- [Contributing Guide](./../intro/CONTRIBUTING.md)
