# PrivexBot Backend

Privacy-First AI Chatbot Builder - FastAPI Backend Application

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-CPU--Optimized-brightgreen.svg)](https://www.docker.com/)
[![Production](https://img.shields.io/badge/Prod-SecretVM-purple.svg)](https://harystyles.store)

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Development Environment](#development-environment)
4. [Deployment](#deployment)
5. [CPU-Optimized Deployment](#cpu-optimized-deployment)
6. [Project Structure](#project-structure)
7. [Services & Components](#services--components)
8. [API Reference](#api-reference)

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git
- Python 3.11+ (for local development)

### Development (5 minutes)

```bash
# 1. Clone repository
git clone <repo-url>
cd privexbot/backend

# 2. Start development environment (builds automatically)
./scripts/docker/dev.sh up

# 3. Access services
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/api/docs
# Flower Monitor: http://localhost:5555
```

### Production Deployment (10 minutes)

```bash
# 1. Build and deploy CPU-optimized image
./scripts/docker/deploy-cpu.sh 0.1.0

# 2. Copy files to production server
scp docker-compose.yml .env server:/path/to/app/

# 3. Deploy on server
docker compose pull
docker compose up -d
```

### SecretVM Deployment

```bash
# 1. Build and prepare
./scripts/docker/deploy-cpu.sh 0.1.0 --secretvm

# 2. Show compose file for portal
./scripts/docker/secretvm-deploy.sh show

# 3. Copy-paste to SecretVM Dev Portal and deploy

# 4. Test deployment
./scripts/docker/secretvm-deploy.sh test
```

---

## Architecture Overview

### What is PrivexBot?

**PrivexBot** is a **multi-tenant SaaS platform** for building and deploying AI chatbots and chatflows with:

- **🤖 Simple Chatbots** - Form-based conversational AI
- **🔗 Advanced Chatflows** - Visual workflow automation (like n8n, Dify)
- **📚 RAG Knowledge Bases** - Import from multiple sources (web, files, APIs)
- **🌐 Multi-Channel Deployment** - Website, Discord, Telegram, WhatsApp, API
- **📊 Lead Capture** - Generate leads from bot interactions
- **🔒 Privacy-Focused** - Secret AI integration, secure inference

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🌐 Multi-Channel Access                                   │
│  ├── Website Widget (JS)                                   │
│  ├── Discord Bot                                           │
│  ├── Telegram Bot                                          │
│  ├── WhatsApp Business                                     │
│  └── Direct API                                            │
│                         ↓                                   │
│  🚪 Unified Public API                                     │
│  └── /v1/bots/{id}/chat (works for chatbots & chatflows)  │
│                         ↓                                   │
│  ⚙️  Backend Services                                       │
│  ├── 🖥️  Backend API (FastAPI)                              │
│  ├── 👷 Celery Worker (Background tasks)                    │
│  ├── ⏰ Celery Beat (Scheduled tasks)                       │
│  └── 🌸 Flower (Monitoring UI)                             │
│                         ↓                                   │
│  💾 Data Layer                                             │
│  ├── 🐘 PostgreSQL + pgvector (Main database)              │
│  ├── 🔴 Redis (Cache, drafts, Celery broker)               │
│  └── 🔍 Qdrant (Vector database for KB search)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

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

**Key Principle**: All data is isolated by organization/workspace.

---

## Development Environment

### Services Overview

Our development environment runs **6 services** in Docker containers:

| Service           | Purpose                | Port | URL                    |
| ----------------- | ---------------------- | ---- | ---------------------- |
| **backend-dev**   | Main API server        | 8000 | http://localhost:8000  |
| **celery-worker** | Background tasks       | -    | (monitored via Flower) |
| **celery-beat**   | Scheduled tasks        | -    | (monitored via Flower) |
| **flower**        | Celery monitoring      | 5555 | http://localhost:5555  |
| **postgres**      | Main database          | 5434 | localhost:5434         |
| **redis**         | Cache & message broker | 6380 | localhost:6380         |
| **qdrant**        | Vector database        | 6335 | localhost:6335         |

### Development Commands

```bash
# Service Management
./scripts/docker/dev.sh up              # Start all services
./scripts/docker/dev.sh down            # Stop all services
./scripts/docker/dev.sh restart         # Restart all services
./scripts/docker/dev.sh restart celery  # Restart celery worker only
./scripts/docker/dev.sh build           # Rebuild backend image

# Monitoring & Logs
./scripts/docker/dev.sh status          # Show all service status
./scripts/docker/dev.sh logs            # View all service logs
./scripts/docker/dev.sh logs backend    # Backend logs only
./scripts/docker/dev.sh logs celery     # Celery worker logs only
./scripts/docker/dev.sh logs flower     # Flower logs only

# Database & Development
./scripts/docker/dev.sh migrate         # Run database migrations
./scripts/docker/dev.sh shell           # Access backend container
./scripts/docker/dev.sh db              # Access PostgreSQL shell
./scripts/docker/dev.sh test            # Run tests

# Cleanup
./scripts/docker/dev.sh clean           # Remove all containers and volumes
```

### Development Features

- **🔄 Hot Reload**: Source code mounted, changes reflect immediately
- **🏗️ Build Once**: Same image used for all services (backend, celery, flower)
- **📊 Real-time Monitoring**: Flower UI for Celery tasks
- **💾 Persistent Data**: Volumes for databases survive restarts
- **🔍 Easy Debugging**: Direct shell access to containers

---

## Deployment

### Deployment Environments

| Environment     | Purpose                 | Build Method    | Image Source         |
| --------------- | ----------------------- | --------------- | -------------------- |
| **Development** | Local development       | Build locally   | Local Dockerfile.dev |
| **Production**  | Standalone server       | Registry images | Docker Hub + digest  |
| **SecretVM**    | Production with Traefik | Registry images | Docker Hub + digest  |

### CPU-Optimized Architecture

🔥 **Problem Solved**: Docker builds were failing due to 2GB+ NVIDIA CUDA packages causing timeouts.

✅ **Solution**: CPU-optimized builds using PyTorch CPU-only version.

**Benefits**:

- ⚡ **10x faster builds** (~3 min vs 30+ min)
- 💾 **140MB vs 2GB+** package downloads
- 🏆 **Perfect for production** (most servers are CPU-only)
- ✅ **No timeout issues**
- 📈 **Same performance** for inference workloads

---

## CPU-Optimized Deployment

### Complete Deployment Workflow

```bash
# One-command deployment (recommended)
./scripts/docker/deploy-cpu.sh 0.1.0

# What this does:
# 1. 🔨 Builds CPU-optimized Docker image
# 2. 📤 Pushes to Docker Hub registry
# 3. 🔄 Updates docker-compose files with immutable digest
# 4. 📋 Provides deployment instructions
```

### Individual Scripts

| Script              | Purpose               | Usage                                                             |
| ------------------- | --------------------- | ----------------------------------------------------------------- |
| `deploy-cpu.sh`     | **Complete workflow** | `./scripts/docker/deploy-cpu.sh 0.1.0 [--production\|--secretvm]` |
| `build-push-cpu.sh` | Build and push only   | `./scripts/docker/build-push-cpu.sh 0.1.0 [--no-cache]`           |
| `update-digests.sh` | Update compose files  | `./scripts/docker/update-digests.sh [--production\|--secretvm]`   |
| `test-workflow.sh`  | Validate setup        | `./scripts/docker/test-workflow.sh [--full]`                      |

### Production Deployment

```bash
# 1. Build and push image
./scripts/docker/deploy-cpu.sh 0.1.0

# 2. Copy files to production server
scp docker-compose.yml .env.example server:/path/to/app/
ssh server "cd /path/to/app && mv .env.example .env"

# 3. Configure environment on server
# Edit .env with production values:
POSTGRES_PASSWORD=$(openssl rand -base64 32)
SECRET_KEY=$(openssl rand -hex 32)
FLOWER_PASSWORD=$(openssl rand -base64 16)
BACKEND_CORS_ORIGINS=https://yourdomain.com

# 4. Deploy
ssh server "cd /path/to/app && docker compose pull && docker compose up -d"

# 5. Optional: Enable monitoring
ssh server "cd /path/to/app && docker compose --profile monitoring up -d"
```

### SecretVM Deployment

SecretVM uses **Traefik** for SSL termination and routing.

```bash
# 1. Build and prepare
./scripts/docker/deploy-cpu.sh 0.1.0 --secretvm

# 2. Prepare environment file
./scripts/docker/secretvm-deploy.sh prepare

# 3. Show compose file for portal
./scripts/docker/secretvm-deploy.sh show

# 4. Deploy via SecretVM Dev Portal:
#    - Copy compose file output from step 3
#    - Paste into SecretVM Dev Portal
#    - Upload deploy/secretvm/.env to portal
#    - Click "Deploy"

# 5. Test deployment
./scripts/docker/secretvm-deploy.sh test
```

**SecretVM Services** (after deployment):

- 🔗 Backend API: https://api.harystyles.store
- 📚 API Docs: https://api.harystyles.store/api/docs
- 🌸 Flower Monitor: https://flower.harystyles.store
- 🗄️ PgAdmin: https://pgadmin.harystyles.store
- 🔴 Redis UI: https://redis-ui.harystyles.store
- 🚦 Traefik Dashboard: https://traefik.harystyles.store

---

## Project Structure

### Directory Overview

```
backend/
├── 🐳 Docker Configuration
│   ├── docker-compose.dev.yml         # Development (build locally)
│   ├── docker-compose.yml             # Production (registry images)
│   ├── docker-compose.secretvm.yml    # SecretVM with Traefik
│   ├── Dockerfile.dev                 # Development build
│   ├── Dockerfile.cpu                 # Production CPU-optimized
│   └── Dockerfile                     # Production standard
│
├── 🛠️ Scripts
│   └── scripts/docker/
│       ├── dev.sh                     # Development management
│       ├── deploy-cpu.sh              # Complete deployment workflow
│       ├── build-push-cpu.sh          # Build and push CPU image
│       ├── update-digests.sh          # Update compose digests
│       ├── secretvm-deploy.sh         # SecretVM deployment helper
│       └── test-workflow.sh           # Validate deployment setup
│
├── 📁 Application Code
│   └── src/app/
│       ├── models/                    # Database models (SQLAlchemy)
│       ├── services/                  # Business logic
│       ├── api/v1/routes/             # API endpoints
│       ├── tasks/                     # Celery background tasks
│       ├── chatflow/nodes/            # Chatflow node implementations
│       ├── integrations/              # External service adapters
│       └── main.py                    # FastAPI application
│
├── 📊 Deployment
│   └── deploy/
│       ├── cpu-image-info.json        # Build metadata
│       └── secretvm/
│           └── .env                   # SecretVM environment
│
├── 📖 Documentation
│   ├── docs/DEPLOYMENT_CPU.md         # Detailed deployment guide
│   └── README.md                      # This file
│
├── 🔧 Configuration
│   ├── pyproject.toml                 # Python dependencies
│   ├── uv.lock                        # Locked dependencies
│   ├── .env.dev                       # Development environment
│   ├── .env.example                   # Production template
│   └── .env.secretvm                  # SecretVM template
│
└── 🗄️ Database
    └── src/alembic/                   # Database migrations
```

---

## Services & Components

### Core Services

#### **Backend API** (FastAPI)

- **Purpose**: Main application server
- **Features**: REST API, authentication, business logic
- **Health**: `GET /health`
- **Docs**: `GET /api/docs` (Swagger UI)

#### **Celery Worker**

- **Purpose**: Background task processing
- **Tasks**: KB processing, embeddings, web scraping, document parsing
- **Queues**: `default`, `high_priority`, `low_priority`
- **Monitoring**: Via Flower UI

#### **Celery Beat**

- **Purpose**: Scheduled task execution
- **Tasks**: Maintenance, re-indexing, cleanup
- **Schedule**: Configurable intervals

#### **Flower**

- **Purpose**: Celery monitoring and management
- **Features**: Task monitoring, worker status, task history
- **Access**: http://localhost:5555 (dev), https://flower.harystyles.store (prod)

### Data Layer

#### **PostgreSQL + pgvector**

- **Purpose**: Main application database
- **Features**: ACID transactions, full-text search, vector similarity
- **Tables**: organizations, workspaces, chatbots, chatflows, knowledge_bases

#### **Redis**

- **Purpose**: Cache, session storage, Celery broker
- **Features**: Draft entity storage (24hr TTL), real-time data
- **Usage**: Draft mode, chat sessions, background task queue

#### **Qdrant**

- **Purpose**: Vector database for knowledge base search
- **Features**: Semantic search, embedding storage, similarity queries
- **Usage**: RAG (Retrieval-Augmented Generation)

### Draft-First Architecture

**CRITICAL**: All entity creation (Chatbots, Chatflows, Knowledge Bases) happens in **DRAFT mode** before database save.

```
Universal Flow for ALL Entities:

1. Create Draft → Redis (NOT Database)
   ↓
2. Configure & Edit → Auto-save to Redis (24hr TTL)
   ↓
3. Live Preview & Test → Real AI responses from draft
   ↓
4. Select Deployment Channels → Choose where to deploy
   ↓
5. Validate → Check required fields
   ↓
6. DEPLOY → ONLY NOW save to database + register webhooks
   ↓
7. LIVE → Accessible via selected channels
```

**Benefits**:

- ✅ No database pollution during creation
- ✅ Easy to abandon (just discard draft)
- ✅ Instant preview without DB writes
- ✅ Validation before commit

---

## API Reference

### Authentication

All API endpoints require authentication via JWT tokens or API keys. Support evm, cosmos, and solana wallet sign up/login

```bash
# Get access token
curl -X POST http://localhost:8000/auth/email/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/chatbots
```

### Public API (Multi-Channel)

The public API works for both chatbots and chatflows:

```bash
# Send message to any bot (chatbot or chatflow). From the bot is the systems knows if it is a chatflow or a chatbot
curl -X POST http://localhost:8000/api/v1/bots/{bot_id}/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <api_key>" \
  -d '{"message": "Hello, how can you help me?"}'
```

### Core Endpoints

| Endpoint                  | Method              | Purpose             |
| ------------------------- | ------------------- | ------------------- |
| `/health`                 | GET                 | Health check        |
| `/api/v1/chatbots`        | GET,POST,PUT,DELETE | Chatbot CRUD        |
| `/api/v1/chatflows`       | GET,POST,PUT,DELETE | Chatflow CRUD       |
| `/api/v1/knowledge-bases` | GET,POST,PUT,DELETE | Knowledge base CRUD |
| `/api/v1/kb-draft`        | GET,POST,PUT,DELETE | Draft KB operations |
| `/api/v1/documents`       | GET,POST,DELETE     | Document management |
| `/api/v1/leads`           | GET                 | Lead capture data   |
| `/api/v1/bots/{id}/chat`  | POST                | **Public chat API** |

### Webhook Endpoints

| Endpoint             | Purpose               | Channel  |
| -------------------- | --------------------- | -------- |
| `/webhooks/telegram` | Telegram Bot API      | Telegram |
| `/webhooks/discord`  | Discord webhook       | Discord  |
| `/webhooks/whatsapp` | WhatsApp Business API | WhatsApp |

---

## Environment Variables

### Development (.env.dev)

```bash
# Database
DATABASE_URL=postgresql://privexbot:privexbot_dev@postgres:5432/privexbot_dev

# Redis
REDIS_URL=redis://redis:6379/0

# Celery
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# Vector Database
QDRANT_URL=http://qdrant:6333

# Security
SECRET_KEY=dev-secret-key-change-in-production

# CORS
BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Production (.env)

```bash
# Database (use strong password)
DATABASE_URL=postgresql://privexbot:STRONG_PASSWORD@postgres:5432/privexbot
POSTGRES_PASSWORD=STRONG_PASSWORD

# Redis
REDIS_URL=redis://redis:6379/0

# Celery
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# Vector Database
QDRANT_URL=http://qdrant:6333

# Security (generate with: openssl rand -hex 32)
SECRET_KEY=YOUR_RANDOM_SECRET_KEY_HERE

# Monitoring
FLOWER_PASSWORD=STRONG_PASSWORD_FOR_FLOWER

# CORS (your production domains)
BACKEND_CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Optional: Email configuration
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

---

## Multi-Channel Deployment

### Supported Channels

1. **🌐 Website Embed** (Primary)

   - JS widget or iframe
   - Auto-generated embed code
   - Customizable appearance

2. **📱 Telegram Bot**

   - Telegram Bot API integration
   - Auto-registered webhooks
   - User provides bot token

3. **🎮 Discord Bot**

   - Discord webhook integration
   - Auto-registered webhooks
   - User provides bot token

4. **📞 WhatsApp Business**

   - WhatsApp Business API
   - Business phone integration
   - Requires Business verification

5. **🔌 Zapier Webhook**

   - Auto-generated webhook URL
   - Integrate with 3000+ apps
   - Bidirectional communication

6. **🔗 Direct API**
   - REST API access
   - API key authentication
   - Custom integrations

### Deployment Flow

```
1. User creates chatbot/chatflow in draft mode
   ↓
2. Configures all settings, knowledge bases, etc.
   ↓
3. Deploy Step: Select channels to enable
   ☑ Website Widget
   ☑ Telegram Bot
   ☐ Discord Bot
   ☐ WhatsApp Business
   ☐ Zapier Webhook
   ↓
4. Click "Deploy to Channels"
   ↓
5. Backend:
   - Saves to database
   - Generates API keys
   - Registers webhooks for enabled channels
   - Returns deployment info per channel
```

---

## Troubleshooting

### Development Issues

```bash
# Check service status
./scripts/docker/dev.sh status

# View logs for specific service
./scripts/docker/dev.sh logs backend
./scripts/docker/dev.sh logs celery
./scripts/docker/dev.sh logs postgres

# Restart problematic service
./scripts/docker/dev.sh restart celery

# Full reset
./scripts/docker/dev.sh clean
./scripts/docker/dev.sh up
```

### Build Issues

```bash
# Test deployment workflow
./scripts/docker/test-workflow.sh

# Clean build
./scripts/docker/build-push-cpu.sh --no-cache 0.1.0

# Check Docker space
docker system df
docker system prune -a
```

### Production Issues

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f celery-worker

# Update and restart
docker compose pull
docker compose up -d
```

### SecretVM Issues

```bash
# Test connectivity
./scripts/docker/secretvm-deploy.sh test

# Check specific services
curl -k https://api.harystyles.store/health
curl -k https://flower.harystyles.store
```

---

## Contributing

1. **Development Setup**

   ```bash
   ./scripts/docker/dev.sh up
   ```

2. **Make Changes**

   - Code changes reflect immediately (hot reload)
   - Use `./scripts/docker/dev.sh logs` to monitor

3. **Test Changes**

   ```bash
   ./scripts/docker/dev.sh test
   ./scripts/docker/test-workflow.sh
   ```

4. **Database Migrations**

   ```bash
   # Create migration
   ./scripts/docker/dev.sh shell
   alembic revision --autogenerate -m "description"

   # Apply migration
   ./scripts/docker/dev.sh migrate
   ```

---

## Security

- **🔐 JWT Authentication**: Secure API access
- **🛡️ API Key Auth**: For public chat endpoints
- **🔒 Environment Isolation**: Multi-tenant data separation
- **🏰 Secret AI**: Backend-only AI inference
- **📊 CORS Configuration**: Controlled frontend access
- **🔑 Strong Passwords**: Generated with OpenSSL

---

## Performance

- **⚡ CPU-Optimized**: Fast builds and deployments
- **🚀 Redis Caching**: Sub-millisecond draft operations
- **📈 Horizontal Scaling**: Multiple Celery workers
- **🎯 Vector Search**: Optimized knowledge retrieval
- **🔄 Connection Pooling**: Efficient database usage

---

## Support

- **📖 Documentation**: [docs/DEPLOYMENT_CPU.md](docs/DEPLOYMENT_CPU.md)
- **🔧 Scripts Help**: `./scripts/docker/dev.sh --help`
- **💻 API Docs**: http://localhost:8000/api/docs (development)
- **🌐 Production**: https://api.harystyles.store/api/docs

For issues, check service logs and verify service status first.
