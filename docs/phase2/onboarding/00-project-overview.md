# PrivexBot — Project Overview
> For new team members. Read this first before touching any code.
> All facts verified from source files, no assumptions.

---

## What Is PrivexBot?

PrivexBot is a **no-code AI chatbot builder** that lets businesses create, customize, and deploy AI assistants in minutes — without writing code. It is built on [Secret Network](https://scrt.network), a privacy-first blockchain, and runs AI inference inside **SecretVM** (Trusted Execution Environments) for confidential processing.

**Funded by SCRT Labs**

**Core promise to users:**
1. **Import your data** — websites, PDFs, Google Docs, Notion, spreadsheets
2. **Build your bot** — simple form-based chatbot or advanced drag-and-drop chatflow
3. **Deploy everywhere** — websites, Telegram, Discord, Slack, WhatsApp

---

## Three Product Pillars

### 1. Simple Chatbot Builder
A traditional form-based bot configuration. Users fill in fields: system prompt, KB attachment, tone, greeting, appearance. Suitable for "customer support bot for my store."

**Backend:** `src/app/api/v1/routes/chatbot.py`, `src/app/services/chatbot_service.py`
**Frontend:** `frontend/src/pages/chatbots/`

### 2. Advanced Chatflow Builder (Visual)
A drag-and-drop workflow editor powered by ReactFlow. Users connect nodes (LLM → Condition → Email → Response) to build complex automated conversation flows. Suitable for "lead qualification pipeline that books demos via Calendly."

**Backend:** `src/app/api/v1/routes/chatflows.py`, `src/app/services/chatflow_service.py`, `src/app/chatflow/nodes/`
**Frontend:** `frontend/src/pages/ChatflowBuilder.tsx`, `frontend/src/components/chatflow/`

### 3. Knowledge Base (RAG Pipeline)
Upload documents and web pages → they are chunked, embedded, and indexed in a vector database. Chatbots then retrieve relevant context before generating responses. The RAG (Retrieval-Augmented Generation) pipeline runs inside SecretVM.

**Backend:** `src/app/api/v1/routes/kb.py`, `src/app/services/` (chunking, embedding, indexing, retrieval)
**Frontend:** `frontend/src/pages/knowledge-bases/`, `frontend/src/components/kb/`

---

## Technology Stack

### Backend
Verified from `backend/pyproject.toml` and `backend/docker-compose.dev.yml`.

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.12 | Language |
| FastAPI | 0.117+ | Web framework (async, auto-docs) |
| SQLAlchemy | 2.0 | ORM (PostgreSQL) |
| Alembic | — | Database migrations |
| Celery | — | Async task queue (embeddings, crawling) |
| Pydantic | 2.x | Settings, request/response validation |
| PostgreSQL | 16 + pgvector | Primary database + vector search |
| Redis | 7 | Cache, drafts (TTL), Celery broker |
| Qdrant | — | Dedicated vector database for KB embeddings |
| MinIO | — | S3-compatible object storage (file uploads) |
| Apache Tika | — | Document parsing (PDF, Word, Excel, images) |
| Playwright | — | Headless browser for web crawling |
| uv | — | Fast Python package manager |

### AI / Inference
| Technology | Purpose |
|---|---|
| SecretAI SDK (`secret-ai-sdk`) | Native SDK for Secret Network's confidential AI |
| SecretAI API (OpenAI-compat) | `https://secretai-api-url.scrtlabs.com:443/v1` |
| DeepSeek-R1-Distill-Llama-70B | Default model |
| sentence-transformers / ONNX | Local embedding models for KB indexing |

### Frontend
Verified from `frontend/package.json`.

| Technology | Version | Purpose |
|---|---|---|
| React | 19.1.1 | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite | 7.1.7 | Build tool + dev server (HMR) |
| React Router | 6.21.3 | Client-side routing |
| Zustand | — | Feature-level state management |
| TanStack Query | 5.17.19 | Server state caching |
| ReactFlow | 11.10.4 | Visual node editor (chatflow builder) |
| Radix UI | — | Accessible UI primitives |
| Tailwind CSS | — | Utility CSS |
| Framer Motion | — | Animations |
| React Hook Form | — | Form state + validation |
| Zod | — | Schema validation |
| Axios | — | HTTP client (with interceptors) |

### Widget
Verified from `widget/package.json`, `widget/webpack.config.js`.

| Technology | Purpose |
|---|---|
| Vanilla JavaScript (ES6) | Zero-dependency widget |
| Webpack | Build bundler → `widget/build/widget.js` (64KB) |
| CSS (scoped to `.privexbot-widget`) | Styling |

---

## Repository Structure

```
privexbot/
├── backend/                          Backend API server
│   ├── docker-compose.dev.yml        Local dev stack (5 services)
│   ├── docker-compose.yml            Production stack (8 services)
│   ├── Dockerfile.dev                Dev image (hot reload)
│   ├── Dockerfile / Dockerfile.cpu   Production images
│   ├── Dockerfile.secretvm           SecretVM deployment
│   ├── .env.dev                      Dev secrets (committed, safe for dev only)
│   ├── .env.example                  Production env template
│   ├── pyproject.toml                Python dependencies
│   ├── scripts/
│   │   ├── docker/dev.sh             One-command dev helper
│   │   └── docker-entrypoint.sh      Auto-migration + server start
│   └── src/
│       ├── app/                      Application code
│       │   ├── main.py               FastAPI app entry (24 routers)
│       │   ├── core/config.py        80+ env-var settings
│       │   ├── api/v1/routes/        HTTP endpoints
│       │   ├── services/             Business logic
│       │   ├── models/               Database models (SQLAlchemy)
│       │   ├── tasks/                Celery async tasks
│       │   ├── integrations/         External service adapters
│       │   ├── chatflow/nodes/       16 workflow node types
│       │   ├── auth/strategies/      4 auth methods
│       │   └── db/                   Session, init, base
│       └── alembic/                  Database migrations
│           ├── alembic.ini
│           └── versions/             Migration files
│
├── frontend/                         React dashboard
│   ├── vite.config.ts                Vite config (aliases, build)
│   ├── package.json                  Node dependencies
│   ├── Dockerfile / Dockerfile.dev   Frontend images
│   ├── .env.dev.example              Frontend env template
│   └── src/
│       ├── main.tsx                  React entry point
│       ├── components/App/App.tsx    Router + providers
│       ├── contexts/                 AuthContext, AppContext, ThemeContext
│       ├── api/                      API client modules (chatbot, kb, auth, etc.)
│       ├── lib/                      api-client.ts (axios), kb-client.ts
│       ├── store/                    Zustand stores
│       ├── pages/                    ~52 route pages
│       ├── components/               Reusable components
│       └── config/env.ts             Dual-mode env (dev/prod)
│
├── widget/                           Embeddable chat widget
│   ├── src/index.js                  Main widget controller
│   ├── src/api/client.js             API communication
│   ├── src/ui/                       5 UI components
│   ├── webpack.config.js             Build config
│   ├── build/widget.js               Bundled output (64KB)
│   ├── nginx.conf                    CDN serve config
│   └── wrangler.jsonc                Cloudflare Workers config
│
└── docs/                             Project documentation
    ├── phase2/
    │   ├── features/                 MOU gap analysis + integration designs
    │   ├── onboarding/               ← You are here
    │   └── pm-plan/                  Project completion plan
    └── ...
```

---

## Multi-Tenancy Model

Every resource in PrivexBot is scoped to an **Organization → Workspace** hierarchy.

```
Organization (company account, e.g., "Acme Corp")
  └── Workspace (team environment, e.g., "Support Team", "Sales Team")
        ├── Chatbots        (simple bots)
        ├── Chatflows       (visual workflow bots)
        ├── Knowledge Bases (document collections)
        ├── Credentials     (encrypted API tokens)
        └── Leads           (captured user data)
```

- A user can belong to multiple organizations
- Each organization has one or more workspaces
- All API calls are scoped to the current `org_id` + `workspace_id`
- The current context is stored in `localStorage` and the JWT token

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  User Browser                                           │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │  Dashboard   │    │  Embedded Widget             │   │
│  │  (port 5173) │    │  (widget.js on any site)     │   │
│  └──────┬───────┘    └──────────────┬───────────────┘   │
└─────────┼────────────────────────── ┼ ───────────────────┘
          │ REST API calls             │ REST API calls
          ▼                            ▼
┌─────────────────────────────────────────────────────────┐
│  FastAPI Backend (port 8000)                            │
│  - 24 API routers                                       │
│  - Auth (JWT + wallet signatures)                       │
│  - Draft-first pattern (Redis → PostgreSQL)             │
│  - Chatflow node executor registry (16 node types)      │
└────────┬──────────┬──────────┬─────────────┬────────────┘
         │          │          │             │
         ▼          ▼          ▼             ▼
   PostgreSQL     Redis      Qdrant        MinIO
   (primary DB)  (drafts,   (vector       (file
   port 5434     cache,     embeddings)   storage)
                 Celery)    port 6333     port 9000
         │
         ▼
   Celery Workers
   (embedding, crawling,
    indexing, maintenance)
         │
         ▼
   Apache Tika (port 9998)
   (PDF, Word, Excel, OCR)
         │
         ▼
   SecretAI (remote)
   (confidential LLM inference
    via SecretVM/TEE)
```

---

## Deployment Channels

A deployed chatbot/chatflow can receive messages from:

| Channel | Status | How |
|---|---|---|
| Website embed | ✅ | `widget.js` script tag on any site |
| Telegram | ✅ | Webhook via `POST /webhooks/telegram/{bot_id}` |
| Discord | ✅ | Shared bot architecture, guild → chatbot mapping |
| WhatsApp | ✅ | WhatsApp Cloud API webhook |
| Zapier | ✅ | Zapier → `POST /webhooks/zapier/{bot_id}` |
| Slack | ❌ In progress | Slack Events API (being built) |
| Internal link | ✅ | Direct URL with API key auth |

---

## Key Concepts Glossary

| Term | Meaning |
|---|---|
| **Draft** | A Redis-stored, temporary (24hr TTL) version of a chatbot/chatflow/KB before it's deployed to the database |
| **Finalize** | Converting a Redis draft into a permanent PostgreSQL record |
| **Node** | A step in a chatflow (e.g., LLM, Condition, Email, KB Retrieval) |
| **Chatflow** | A visual drag-and-drop workflow made of connected nodes |
| **Chatbot** | A simpler form-configured assistant (no visual builder) |
| **Knowledge Base (KB)** | A collection of documents that have been chunked, embedded, and indexed for semantic search |
| **Chunk** | A segment of text from a document, stored as an embedding vector in Qdrant |
| **RAG** | Retrieval-Augmented Generation — retrieve relevant chunks from KB before generating an AI response |
| **SecretVM** | Secret Network's Trusted Execution Environment — runs code in a confidential enclave |
| **SecretAI** | The AI inference service running inside SecretVM |
| **Credential** | An encrypted API key or OAuth token stored in the database (e.g., Discord bot token, Gmail OAuth, SMTP password) |
| **Workspace** | A team environment within an organization that owns all resources |
| **Session** | A conversation thread between a user and a bot, identified by `session_id` |
| **Lead** | Contact information captured from a chat user |
| **Variable interpolation** | `{{variable_name}}` syntax in prompts/messages replaced with actual values at runtime |

---

## Useful URLs (Local Development)

| URL | Purpose |
|---|---|
| http://localhost:8000/api/docs | Interactive Swagger API documentation |
| http://localhost:8000/api/redoc | ReDoc API documentation |
| http://localhost:8000/health | Health check |
| http://localhost:5173 | Frontend dashboard |
| http://localhost:6333/dashboard | Qdrant vector DB dashboard |
| http://localhost:9000 | MinIO object storage console |

---

## Next Steps

1. Read `01-local-setup.md` to get your environment running
2. Read `02-backend-architecture.md` if you'll work on the API
3. Read `03-frontend-architecture.md` if you'll work on the dashboard/widget
4. Read `04-key-patterns.md` for cross-cutting concepts
5. Bookmark `05-common-tasks.md` as a daily reference
