# Key Patterns
> Deep dive into patterns that appear throughout the codebase.
> Read this after `02-backend-architecture.md` and `03-frontend-architecture.md`.
> All facts verified from actual source files.

---

## 1. Draft-First Pattern

### The Problem It Solves

Building a chatbot involves many configuration steps. If we wrote to the database on every change, users would create hundreds of orphaned, incomplete records. The draft-first pattern solves this by keeping in-progress work in Redis until the user explicitly deploys.

### How It Works

```
User starts building → Redis draft created (24hr TTL)
User makes changes  → Draft updated (TTL extended)
User closes tab     → Draft expires after 24hr (no cleanup needed)
User clicks Deploy  → Draft validated → PostgreSQL record created → Draft deleted
```

### Implementation

**Backend — `src/app/services/draft_service.py`**

The service stores JSON in Redis under this key format:
```
draft:{entity_type}:{user_id}:{workspace_id}
```

Examples:
- `draft:chatbot:abc123:ws456`
- `draft:chatflow:abc123:ws456`
- `draft:kb:abc123:ws456`

Key design details from `draft_service.py`:
- Drafts have a **24-hour TTL** that resets on every save
- `slugify()` converts the bot name to a URL-safe slug at deploy time
- Deployment triggers integration registrations (e.g., Telegram webhook registration)
- Each entity type (chatbot/chatflow/KB) has separate validation logic

**Frontend — `src/store/draft-store.ts`**

The frontend Zustand draft store mirrors the backend draft state. On every form change:
1. Local Zustand state updates instantly (zero lag)
2. `PATCH /api/v1/kb-draft/{id}` (or chatbot/chatflow equivalent) fires to sync with Redis
3. If the user reloads the page, the draft is refetched from Redis

**What "Finalize" means:**
- KB: `POST /api/v1/kb-draft/{draft_id}/finalize` → creates `KnowledgeBase` record, triggers Celery embedding job
- Chatbot: `POST /api/v1/chatbots/deploy` → creates `Chatbot` record, registers webhooks
- Chatflow: `POST /api/v1/chatflows/{id}/deploy` → marks `Chatflow` as active

---

## 2. Credential System

### The Problem It Solves

Chatflow nodes (Email, HTTP, Calendly) need API keys, passwords, and OAuth tokens. These must be encrypted at rest and never exposed in API responses.

### How It Works

```
User creates a credential (e.g., SMTP password)
  → POST /api/v1/credentials
  → credential_service.store() encrypts the data with Fernet
  → Encrypted bytes stored in credentials.encrypted_data column
  → Credential ID (UUID) returned to frontend

User configures an Email node
  → Selects the SMTP credential from CredentialSelector dropdown
  → Node config stores: {"credential_id": "uuid-of-smtp-cred", ...}
  → Credential UUID saved in chatflow flow_data

Chatflow executes
  → EmailNodeExecutor reads node config
  → Calls credential_service.get_decrypted_data(db, credential_id)
  → Gets plaintext: {host, port, username, password}
  → Sends email
```

### Implementation

**Encryption — `src/app/services/credential_service.py`**

```python
# Uses Fernet (AES-128 in CBC mode with HMAC authentication)
# Key stored in ENCRYPTION_KEY env var
class CredentialService:
    def store(self, db, workspace_id, name, credential_type, data: dict) -> Credential:
        encrypted = self.fernet.encrypt(json.dumps(data).encode())
        # Saves to credentials table

    def get_decrypted_data(self, db, credential: Credential) -> dict:
        return json.loads(self.fernet.decrypt(credential.encrypted_data))
```

**Database model — `src/app/models/credential.py`**

| Column | Type | Content |
|---|---|---|
| `id` | UUID | Primary key |
| `workspace_id` | UUID | Owner workspace |
| `name` | String | Display name (e.g., "My Gmail") |
| `credential_type` | Enum | `smtp`, `discord_bot`, `google_oauth_gmail`, etc. |
| `encrypted_data` | LargeBinary | Fernet-encrypted JSON |

**Frontend — `src/components/shared/CredentialSelector.tsx`**

A reusable dropdown that lists credentials for the current workspace, filtered by type. Nodes use this to let users pick which stored credential to use.

### Security Note

Credentials are **never** returned in API responses. The `GET /credentials` endpoint returns metadata only (id, name, type, created_at) — never the encrypted data or decrypted values.

---

## 3. Multi-Tenancy

### Model

Every resource belongs to an Organization → Workspace hierarchy:

```
Organization (company)
  └── Workspace (team environment)
        ├── Chatbots
        ├── Chatflows
        ├── Knowledge Bases
        ├── Credentials
        └── Leads
```

- A user can belong to **multiple organizations**
- Each organization has **one or more workspaces**
- All resources have a `workspace_id` foreign key

### Enforcement

**Backend:** Every route that reads or writes data includes `org_id` and `workspace_id` as path or query parameters. Service methods always filter by `workspace_id`:

```python
# Correct — always include workspace_id filter:
db.query(Chatbot).filter(
    Chatbot.workspace_id == workspace_id,
    Chatbot.id == chatbot_id
).first()

# WRONG — never query without workspace scope:
db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
```

**Frontend:** The `AppContext` holds `currentOrg` and `currentWorkspace`. All API calls include the current workspace ID. The user can switch org/workspace from the sidebar; this updates the context and re-fetches all data.

**JWT:** The JWT token contains `user_id`. The organization and workspace context is passed per-request (not embedded in the JWT), so users can switch between workspaces without getting a new token.

---

## 4. Variable Interpolation

### What It Is

`{{variable_name}}` syntax in prompts, email bodies, and message templates gets replaced with actual values at runtime.

### Where Variables Come From

```
{{user_message}}     — The user's current input
{{chat_history}}     — Previous messages in the session
{{kb_context}}       — Retrieved KB chunks (from KB node output)
{{user_name}}        — Lead name if captured
{{custom_var}}       — Any variable set by a Variable node in the chatflow
```

### Backend Implementation

Resolved by `variable_resolver.py` (referenced in `base_node.py`). The `BaseNode.resolve_variable()` method handles substitution:

```python
# From base_node.py:
def resolve_variable(self, template: str, context: dict) -> str:
    """Replace {{var}} placeholders with values from context."""
    for key, value in context.items():
        template = template.replace(f"{{{{{key}}}}}", str(value))
    return template
```

### Practical Example

LLM node system prompt:
```
You are a support bot. The user said: {{user_message}}
Relevant context: {{kb_context}}
Previous conversation: {{chat_history}}
```

At execution time, `{{user_message}}` is replaced with the actual message text before sending to SecretAI.

---

## 5. Public Bot Access (Widget Authentication)

### The Problem

The embed widget runs on third-party websites and cannot use JWT (no user account). It needs to authenticate as a specific bot without exposing credentials.

### How It Works

```
Widget loads on a customer's website
  → Reads botId and apiKey from config
  → Sends: POST /api/v1/public/bots/{bot_id}/chat
    Headers: X-API-Key: {apiKey}
    Body: { message: "...", session_id: "widget_..." }

Backend (/public routes):
  → PublicAPICORSMiddleware allows any origin (widget embeds everywhere)
  → No JWT required — apiKey is validated against api_keys table
  → session_id identifies the conversation
```

### Session Management (Widget)

Session IDs are generated by the widget and stored in `localStorage`:
```
Key:   privexbot_session_{botId}
Value: widget_{timestamp}_{random}_{browserHash}
```

The `widget_` prefix tells the backend this is an embed session (not a dashboard test session). Sessions starting with `widget_` skip authentication requirements entirely on public routes.

### Routes

All public routes are in `src/app/api/v1/routes/public.py`:

| Endpoint | Purpose |
|---|---|
| `POST /public/bots/{bot_id}/chat` | Send a message (main chat API) |
| `GET /public/bots/{bot_id}/config` | Fetch widget config (name, color, greeting) |
| `POST /public/bots/{bot_id}/events` | Track widget open/close events |
| `POST /public/bots/{bot_id}/feedback` | Submit thumbs up/down |
| `POST /public/leads/capture` | Submit contact information |

---

## 6. Chatflow Execution Pipeline

When a user sends a message to a chatflow:

```
POST /api/v1/public/bots/{bot_id}/chat
  ↓
public.py: Identifies this bot as a Chatflow (not simple Chatbot)
  ↓
chatflow_service.execute(db, chatflow_id, user_message, session_id, platform)
  ↓
ChatflowExecutor.execute(db, chatflow, user_message, context)
  ↓
For each node in topological order:
  1. Find executor: self.executors["llm"] / self.executors["kb_retrieval"] / etc.
  2. executor.execute(node_config, db, context, previous_outputs)
  3. Add outputs to context
  4. Follow edges to next node(s)
  ↓
Return final response from "response" node output
```

Context object grows as nodes execute:
```python
context = {
    "user_message": "How do I reset my password?",
    "session_id": "widget_...",
    "platform": "web",
    "chat_history": [...],
    # After KB node:
    "kb_context": "Relevant docs...",
    # After LLM node:
    "llm_output": "To reset your password...",
    # After Variable node:
    "custom_var": "some value",
}
```

---

## 7. Chatbot vs Chatflow — Two Execution Paths

PrivexBot has two types of bots with different execution paths:

| | Simple Chatbot | Chatflow |
|---|---|---|
| Builder | Form-based | Visual drag-and-drop |
| Config stored | `chatbots` table | `chatflows` table + `flow_data` JSON |
| Execution | `chatbot_service.process_message()` | `chatflow_executor.execute()` |
| Complexity | Fixed: System prompt + KB + guardrails | Flexible: Any node sequence |

When the public API receives a message, it checks whether the `bot_id` belongs to a Chatbot or Chatflow and routes accordingly.

---

## 8. Asynchronous Processing (Celery)

Long-running operations go to Celery workers to avoid blocking the API:

| Operation | Celery Task | Triggered by |
|---|---|---|
| KB document embedding | `embed_documents` task | KB finalization |
| Web crawling | `crawl_url` task | URL-type KB document added |
| Apache Tika parsing | `parse_document` task | File upload |
| Re-indexing | `reindex_kb` task | Chunk strategy change |
| Periodic maintenance | `cleanup_expired_drafts` | Celery Beat (scheduled) |

The API returns immediately with a `task_id`. The frontend polls `GET /api/v1/kb-pipeline/status/{task_id}` to check progress.

Celery uses Redis as both the **broker** (job queue) and **result backend** (task results):
- Broker: `redis://redis:6379/1`
- Results: `redis://redis:6379/2`
- App state (drafts, cache): `redis://redis:6379/0`
