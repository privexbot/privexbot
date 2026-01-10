# PrivexBot Technical Documentation Overview

## What is PrivexBot?

PrivexBot is a **privacy-focused, multi-tenant SaaS platform** for building AI chatbots powered by custom knowledge bases. It runs entirely on **Secret VM** - a Trusted Execution Environment (TEE) - ensuring user data remains private and secure.

## Key Features

### RAG-Powered Chatbots
- Connect chatbots to custom knowledge bases
- Retrieve relevant context for accurate answers
- Multiple retrieval strategies (semantic, hybrid, MMR)
- Source citations and attribution

### Privacy-First Architecture
- Self-hosted on Secret VM (TEE)
- No data leaves the secure environment
- Secret AI for private LLM inference
- Hard delete available for all user data

### Multi-Channel Deployment
- Web widget embed
- Telegram bot
- Discord bot
- WhatsApp Business
- REST API
- Zapier integration

### Flexible Configuration
- 11 chunking strategies
- Multiple embedding models
- Configurable retrieval parameters
- Custom prompts and personas

## Documentation Structure

### Core Concepts

| Document | Description |
|----------|-------------|
| [01-knowledge-base-implementation.md](./01-knowledge-base-implementation.md) | KB models, creation flow, source types |
| [02-embedding-vector-storage.md](./02-embedding-vector-storage.md) | Embedding models, vector storage, Qdrant |
| [03-chunking-strategies.md](./03-chunking-strategies.md) | All 11 chunking strategies explained |
| [04-rag-retrieval-pipeline.md](./04-rag-retrieval-pipeline.md) | Complete RAG flow, search strategies |
| [05-chatbot-configuration.md](./05-chatbot-configuration.md) | Chatbot settings, deployment, channels |
| [06-qdrant-vector-database.md](./06-qdrant-vector-database.md) | Qdrant integration, search operations |
| [07-secret-ai-inference.md](./07-secret-ai-inference.md) | AI providers, fallback, privacy |
| [08-data-privacy-security.md](./08-data-privacy-security.md) | TEE, encryption, user rights |

## Architecture Overview

### High-Level Flow

```
User Message
    ↓
[Widget/API] → Authentication
    ↓
[Chatbot Service]
    ├── Session Management
    ├── KB Retrieval (RAG)
    │     ├── Generate Query Embedding
    │     ├── Search Qdrant
    │     └── Return Relevant Chunks
    ├── Build Prompt (with context)
    └── AI Inference (Secret AI)
    ↓
Response (with sources)
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI, Python 3.11 |
| **Database** | PostgreSQL + pgvector |
| **Cache** | Redis |
| **Vector DB** | Qdrant |
| **Queue** | Celery |
| **Embeddings** | sentence-transformers |
| **AI Inference** | Secret AI, Akash ML |
| **Frontend** | React 19, TypeScript, Vite |
| **Widget** | Vanilla JavaScript (~50KB) |
| **Infrastructure** | Secret VM (TEE) |

### Draft-First Architecture

All entities follow a 3-phase creation flow:

```
Phase 1: DRAFT (Redis)
├── 24-hour TTL
├── No database writes
├── Instant preview
└── Configuration freedom

Phase 2: FINALIZE (PostgreSQL)
├── Validate configuration
├── Create database records
├── Queue background task
└── Delete draft

Phase 3: PROCESSING (Celery)
├── Execute pipeline
├── Generate embeddings
├── Index in Qdrant
└── Update status
```

## Key Concepts

### Knowledge Base

A collection of documents and chunks that provide context for chatbot responses.

**Components**:
- **Sources**: Web pages, uploaded files, text input
- **Documents**: Parsed content from sources
- **Chunks**: Text segments for embedding and retrieval

### Chunking

The process of splitting documents into smaller segments optimized for:
- Embedding quality
- Retrieval precision
- LLM context windows

**Strategies**: Recursive, Semantic, By Heading, Hybrid, Adaptive, etc.

### Embedding

Converting text into numerical vectors for similarity search.

**Default Model**: `all-MiniLM-L6-v2` (384 dimensions)

### Retrieval

Finding relevant chunks for a user query using vector similarity.

**Strategies**: Semantic, Hybrid, Keyword, MMR

### Grounding

Controlling how strictly the AI uses knowledge base content.

| Mode | Behavior |
|------|----------|
| **Strict** | Only KB answers, refuses unknown |
| **Guided** | Prefers KB, discloses general knowledge |
| **Flexible** | KB enhances, no restrictions |

## Multi-Tenant Model

```
Organization (Company)
  └── Workspace (Team)
        ├── Knowledge Bases
        │     ├── Documents
        │     └── Chunks
        ├── Chatbots
        │     └── Sessions/Messages
        └── Credentials
```

All queries filter by workspace for data isolation.

## Privacy Architecture

### What's Encrypted

- **At Rest**: API keys (hashed), credentials, passwords
- **In Transit**: All API calls (HTTPS/TLS 1.3)
- **In Use**: AI inference in Secret AI TEE

### What's Not Encrypted

- General user data (isolated in TEE)
- KB content (needs to be searchable)
- Conversation history (analytics access)

### User Rights

- **Access**: View all data via dashboard
- **Delete**: Hard delete available (permanent, immediate)
- **Export**: Data portability supported

## API Endpoints Summary

### Public Chat API
```
POST /api/v1/public/bots/{bot_id}/chat
```

### KB Management
```
POST   /api/v1/kb-drafts           # Create draft
POST   /api/v1/kb-drafts/{id}/finalize  # Create KB
GET    /api/v1/knowledge-bases     # List KBs
DELETE /api/v1/knowledge-bases/{id}     # Delete KB
```

### Chatbot Management
```
POST   /api/v1/chatbots/drafts     # Create draft
POST   /api/v1/chatbots/drafts/{id}/deploy  # Deploy
GET    /api/v1/chatbots            # List chatbots
PATCH  /api/v1/chatbots/{id}       # Update
```

## Configuration Priority

When resolving configuration values:

```
1. Caller Override (highest priority)
   └── Explicit API parameters

2. Entity Config
   └── Chatbot/KB stored settings

3. Service Defaults (lowest priority)
   └── System defaults
```

## Getting Started

1. **Create Workspace** - Set up organization and workspace
2. **Build Knowledge Base** - Add sources, configure chunking
3. **Create Chatbot** - Configure AI, attach KB, set behavior
4. **Deploy** - Enable channels, get API key
5. **Embed** - Add widget to website or integrate via API

## Performance Characteristics

| Operation | Typical Latency |
|-----------|-----------------|
| Embedding (100 chunks) | ~1 second |
| Vector search (100k vectors) | 15-50ms |
| AI inference (500 tokens) | 3-8 seconds |
| Full chat response | 4-10 seconds |

## Support & Resources

- **Documentation**: This docs folder
- **Issues**: GitHub repository
- **Architecture**: `/docs/technical-docs/`
- **API Docs**: `http://localhost:8000/api/docs`
