# Backend Architecture
> For backend interns. Understand the FastAPI codebase structure without reading every file.
> All facts verified from actual source files — no assumptions.

---

## Entry Point

**`src/app/main.py`**

The FastAPI application is defined here. On startup it:
1. Runs `init_db()` to ensure tables exist
2. Mounts two layers of CORS middleware (see CORS section below)
3. Registers 24 API routers

All import lines for routers are at the top of `main.py`. When you add a new router, you import it here and mount it with `app.include_router(...)`.

---

## Directory Structure

```
src/app/
├── main.py                     FastAPI app, router mounts, CORS setup
├── core/
│   └── config.py               80+ env-var settings via Pydantic BaseSettings
├── api/
│   └── v1/
│       └── routes/             All HTTP endpoints (one file per domain)
│           ├── auth.py         JWT auth, wallet login, token refresh
│           ├── org.py          Organization CRUD
│           ├── workspace.py    Workspace CRUD
│           ├── chatbot.py      Chatbot management
│           ├── chatflows.py    Chatflow management
│           ├── kb.py           Knowledge base operations
│           ├── kb_draft.py     KB draft creation and finalization
│           ├── kb_pipeline.py  KB processing pipeline control
│           ├── credentials.py  Encrypted credential management
│           ├── leads.py        Lead management
│           ├── analytics.py    Analytics endpoints
│           ├── dashboard.py    Dashboard stats
│           ├── discord_guilds.py  Discord workspace deployments
│           ├── public.py       Unauthenticated widget/embed API
│           ├── files.py        File upload/download
│           ├── integrations.py External service integrations
│           └── webhooks/
│               ├── telegram.py    Telegram webhook handler
│               ├── discord.py     Discord interaction handler
│               ├── zapier.py      Zapier webhook handler
│               └── whatsapp.py    WhatsApp Cloud API handler
├── services/                   Business logic (55 modules)
│   ├── chatbot_service.py      Core chatbot message processing
│   ├── chatflow_service.py     Chatflow persistence
│   ├── chatflow_executor.py    Node execution engine
│   ├── draft_service.py        Redis draft management
│   ├── credential_service.py   Fernet-encrypted credential storage
│   ├── inference_service.py    OpenAI-compat LLM calls
│   ├── secret_ai_sdk_provider.py  SecretAI native SDK integration
│   ├── retrieval_service.py    RAG retrieval from Qdrant
│   ├── chunking_service.py     Document chunking logic
│   ├── embedding_service_local.py  Local ONNX embedding model
│   ├── indexing_service.py     Qdrant indexing
│   ├── qdrant_service.py       Low-level Qdrant client
│   ├── tika_service.py         Apache Tika document parsing
│   ├── storage_service.py      MinIO file storage
│   ├── lead_capture_service.py Lead creation and dedup
│   ├── discord_guild_service.py  Discord deployment management
│   └── ...                     (40+ more)
├── models/                     SQLAlchemy ORM models (25 files)
│   ├── user.py                 User accounts
│   ├── organization.py         Organizations (multi-tenant root)
│   ├── workspace.py            Workspaces within orgs
│   ├── chatbot.py              Simple chatbot configs
│   ├── chatflow.py             Chatflow definitions
│   ├── knowledge_base.py       KB metadata
│   ├── document.py             KB documents
│   ├── chunk.py                Vector chunks
│   ├── credential.py           Encrypted credentials
│   ├── lead.py                 Captured lead data
│   ├── chat_session.py         Conversation sessions
│   ├── chat_message.py         Individual messages
│   ├── discord_guild_deployment.py  Discord workspace mappings
│   └── ...
├── tasks/                      Celery async task definitions
│   └── celery_worker.py        Task registration and Celery app config
├── integrations/               External service adapters
│   ├── discord_integration.py  Discord API wrapper
│   ├── telegram_integration.py Telegram Bot API wrapper
│   ├── whatsapp_integration.py WhatsApp Cloud API wrapper
│   ├── zapier_integration.py   Zapier webhook handler
│   └── google_adapter.py       Google Drive/Docs/Sheets API
├── chatflow/
│   └── nodes/                  Chatflow node implementations (16 types)
│       ├── base_node.py        Abstract base class all nodes inherit
│       ├── llm_node.py         AI inference (calls SecretAI)
│       ├── condition_node.py   If/else branching
│       ├── kb_node.py          RAG knowledge base retrieval
│       ├── email_node.py       Send email (SMTP)
│       ├── http_node.py        HTTP requests to external APIs
│       ├── code_node.py        Python code execution
│       ├── memory_node.py      Conversation history management
│       ├── response_node.py    Format and return final response
│       ├── variable_node.py    Set/get variables in context
│       ├── lead_capture_node.py  Capture user contact info
│       ├── webhook_node.py     Send data to external webhooks
│       ├── notification_node.py  Internal notifications
│       ├── handoff_node.py     Human handoff
│       ├── database_node.py    Database queries
│       └── loop_node.py        Iteration
├── auth/
│   └── strategies/             Auth method implementations
│       ├── email_auth.py       Email+password (bcrypt hashed)
│       ├── evm_auth.py         Ethereum wallet signature (EIP-712)
│       ├── solana_auth.py      Solana wallet signature (Ed25519)
│       └── cosmos_auth.py      Cosmos wallet signature
├── db/
│   ├── session.py              SQLAlchemy session factory
│   ├── base.py                 All model imports (for Alembic autogenerate)
│   └── init_db.py              Table creation on startup
└── utils/
    ├── redis.py                Redis client + helpers
    └── ...
```

---

## Key Patterns

### 1. Settings (Environment Variables)

All configuration lives in **`src/app/core/config.py`**.

```python
# config.py pattern
class Settings(BaseSettings):
    DATABASE_URL: str = Field(default="...", description="...")
    REDIS_URL: str = Field(default="...", description="...")
    # 80+ more fields

settings = Settings()  # Singleton, loaded once at startup
```

To add a new env var:
1. Add a field to the `Settings` class in `config.py`
2. Add the var to `.env.dev` for local dev
3. Add to `.env.example` so production knows it exists
4. Access anywhere via `from app.core.config import settings` → `settings.MY_VAR`

### 2. Authentication Dependency

Every authenticated route uses `get_current_user_with_org`:

```python
from app.api.v1.routes.auth import get_current_user_with_org

@router.get("/my-resource")
async def get_resource(
    org_id: UUID,
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_org),
):
    # current_user contains the authenticated user
    # org_id and workspace_id come from query/path params
```

The JWT token contains `user_id`. The dependency extracts and validates it.

### 3. Draft-First Pattern

Every entity (chatbot, chatflow, KB) goes through a two-stage lifecycle:

```
Stage 1: Redis Draft (24hr TTL)
  - Fast writes, no database
  - Key format: "draft:{entity_type}:{user_id}:{workspace_id}"
  - Managed by: draft_service.py, kb_draft_service.py

Stage 2: PostgreSQL Record (permanent)
  - Triggered by user clicking "Deploy" or "Save"
  - API endpoint: POST /finalize or POST /deploy
  - Managed by: chatbot_service.py, chatflow_service.py, kb_draft_service.py
```

Why: Users iterate on their bot configuration many times before saving. Redis drafts give instant feedback without creating orphaned database records.

### 4. Multi-Tenancy

Every table that holds business data has `workspace_id` (and usually `org_id`). The route handler receives `org_id` and `workspace_id` as path or query parameters, and all service calls pass them through.

```python
# Every data-creating route looks like this:
@router.post("/chatbots")
async def create_chatbot(
    org_id: UUID,
    workspace_id: UUID,
    body: CreateChatbotRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_org),
):
    return chatbot_service.create(db, org_id, workspace_id, body, current_user.id)
```

The service layer always filters queries by `workspace_id`:
```python
db.query(Chatbot).filter(
    Chatbot.workspace_id == workspace_id,
    Chatbot.id == chatbot_id
).first()
```

### 5. Chatflow Node Execution

The chatflow engine works as a registry of named executors:

```python
# chatflow_executor.py — simplified
class ChatflowExecutor:
    def __init__(self):
        self.executors = {
            "llm": LLMNodeExecutor(),
            "condition": ConditionNodeExecutor(),
            "kb_retrieval": KBRetrievalNodeExecutor(),
            "email": EmailNodeExecutor(),
            "http": HTTPNodeExecutor(),
            "code": CodeNodeExecutor(),
            "memory": MemoryNodeExecutor(),
            "response": ResponseNodeExecutor(),
            "variable": VariableNodeExecutor(),
            "lead_capture": LeadCaptureNodeExecutor(),
            "webhook": WebhookNodeExecutor(),
            "notification": NotificationNodeExecutor(),
            "handoff": HandoffNodeExecutor(),
            "database": DatabaseNodeExecutor(),
            "loop": LoopNodeExecutor(),
            # New nodes added here
        }
```

Each executor wraps a `BaseNode` subclass and calls its `execute(db, context, inputs)` method.

### 6. Credential Encryption

All API keys, tokens, and passwords are stored encrypted using Fernet symmetric encryption:

```python
# credential_service.py pattern (simplified)
def store_credential(db, workspace_id, name, credential_type, data: dict) -> Credential:
    encrypted = fernet.encrypt(json.dumps(data).encode())
    # Store encrypted bytes in DB

def get_decrypted_data(db, credential: Credential) -> dict:
    return json.loads(fernet.decrypt(credential.encrypted_data))
```

Nodes reference credentials by `credential_id` (UUID). At execution time, the executor calls `credential_service.get_decrypted_data()` to get the actual secret values.

---

## Adding a New API Route

Step-by-step:

**1. Create the route file**

```python
# src/app/api/v1/routes/your_feature.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.session import get_db
from app.api.v1.routes.auth import get_current_user_with_org

router = APIRouter(prefix="/your-feature", tags=["your_feature"])

@router.get("/")
async def list_items(
    org_id: UUID,
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_org),
):
    return []
```

**2. Import and mount in `main.py`**

```python
# In main.py — add to the import line at line 12:
from app.api.v1.routes import ..., your_feature

# Later in the file, add include_router:
app.include_router(
    your_feature.router,
    prefix=settings.API_V1_PREFIX,
    tags=["your_feature"]
)
```

**3. Verify**

Restart the backend: `./scripts/docker/dev.sh restart backend`

Open http://localhost:8000/api/docs — your new endpoints should appear.

---

## Adding a New Chatflow Node

Step-by-step:

**1. Create the node implementation**

```python
# src/app/chatflow/nodes/your_node.py
from app.chatflow.nodes.base_node import BaseNode

class YourNode(BaseNode):
    def validate_config(self) -> bool:
        # Check required config fields
        return bool(self.config.get("required_field"))

    async def execute(self, db, context: dict, inputs: dict) -> dict:
        # context: current conversation state
        # inputs: outputs from preceding nodes
        # self.config: node's saved configuration

        value = self.resolve_variable(
            self.config.get("template", ""),
            context
        )  # resolves {{variable}} syntax

        return {
            "output": value,
            "success": True,
            "error": None,
            "metadata": {"node_id": self.node_id}
        }
```

**2. Create an executor wrapper and register it**

```python
# src/app/services/chatflow_executor.py
# Add this class BEFORE ChatflowExecutor.__init__:

class YourNodeExecutor:
    async def execute(self, node_config: dict, db, context: dict, inputs: dict) -> dict:
        from app.chatflow.nodes.your_node import YourNode
        node = YourNode(node_config)
        return await node.execute(db, context, inputs)

# Then inside ChatflowExecutor.__init__, add to self.executors dict:
# "your_node_type": YourNodeExecutor(),
```

**3. Verify**

Add a chatflow with your new node type via the API and execute it. Check logs for errors.

---

## Database Migrations

When you add a new SQLAlchemy model or change an existing one:

**1. Create the model file**

```python
# src/app/models/your_model.py
from sqlalchemy import Column, UUID, String, Boolean
from app.db.base_class import Base

class YourModel(Base):
    __tablename__ = "your_models"

    id = Column(UUID(as_uuid=True), primary_key=True, ...)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), ...)
    name = Column(String(255), nullable=False)
```

**2. Import it in `src/app/db/base.py`**

```python
# base.py — add import so Alembic autogenerate sees the model:
from app.models.your_model import YourModel  # noqa: F401
```

**3. Generate and run the migration**

```bash
# Open a shell inside the backend container:
./scripts/docker/dev.sh shell

# Inside the container:
cd /app/src
alembic revision --autogenerate -m "add_your_model_table"

# Exit the container shell
exit

# Run the migration:
./scripts/docker/dev.sh migrate
```

**4. Verify**

```bash
./scripts/docker/dev.sh db
# Inside psql:
\dt  -- should show your new table
```

---

## Two-Tier CORS Architecture

The backend has two CORS configurations:

| Layer | Routes | Allowed Origins | Why |
|---|---|---|---|
| `PublicAPICORSMiddleware` | `/api/v1/public/*`, `/api/v1/chat/*` | `*` (any origin) | Widget embeds on customer websites |
| Standard `CORSMiddleware` | All other routes | `BACKEND_CORS_ORIGINS` env var | Dashboard — restrict to known domains |

Both are configured in `main.py`. Do NOT move widget endpoints outside the `/api/v1/public/` prefix or you'll break cross-origin access.

---

## Inference Architecture

Two paths for LLM calls (both in `services/`):

| Path | File | When to use |
|---|---|---|
| Native SecretAI SDK | `secret_ai_sdk_provider.py` | Production on SecretVM — uses TEE attestation |
| OpenAI-compatible API | `inference_service.py` | Any environment — uses HTTP to SecretAI endpoint |

The `LLMNode` in chatflows uses `inference_service.py`. The `chatbot_service.py` uses `secret_ai_sdk_provider.py` when `USE_SECRET_AI_SDK=true` is set, otherwise falls back to the OpenAI-compat path.

Both ultimately call the same SecretAI model: `DeepSeek-R1-Distill-Llama-70B`.
