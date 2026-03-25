# PrivexBot Chatbot System Architecture

> Complete guide to understanding and testing the chatbot system

## Table of Contents
1. [Overview](#overview)
2. [Architecture Flow](#architecture-flow)
3. [Backend Architecture](#backend-architecture)
4. [Widget System](#widget-system)
5. [Public API](#public-api)
6. [AI Inference Integration](#ai-inference-integration)
7. [Deployment Flow](#deployment-flow)
8. [Test/Preview Feature](#testpreview-feature)
9. [Configuration](#configuration)
10. [Practical Testing Guide](#practical-testing-guide)
11. [Key File Paths](#key-file-paths)

---

## Overview

The PrivexBot chatbot system follows a **3-phase architecture**:

```
DRAFT (Redis) → DEPLOY → ACTIVE (PostgreSQL)
```

**Key Features:**
- Draft-first creation (no DB pollution)
- Multi-channel deployment (Web, Discord, Telegram, WhatsApp, API)
- RAG-powered knowledge base integration
- Decentralized AI inference (Secret AI + Akash ML)
- Lead capture and analytics
- Embeddable JavaScript widget (~50KB)

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            WIDGET                                    │
│  /widget/src/index.js → PrivexBotWidget class                       │
│  - Embedded on customer websites                                     │
│  - Handles UI (ChatBubble, ChatWindow, MessageList, InputBox)       │
│  - Session management (localStorage)                                 │
│  - API communication via WidgetAPIClient                            │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ POST /api/v1/public/bots/{id}/chat
                                   │ Authorization: Bearer {api_key}
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PUBLIC API                                   │
│  /backend/src/app/api/v1/routes/public.py                           │
│  - Validates API key (Bearer token)                                 │
│  - Routes to ChatbotService or ChatflowService                      │
│  - Handles sessions, events, feedback, leads                        │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       CHATBOT SERVICE                                │
│  /backend/src/app/services/chatbot_service.py                       │
│  1. Get/Create Session                                              │
│  2. Save User Message                                               │
│  3. Retrieve Context (RAG from Knowledge Bases)                     │
│  4. Get Chat History                                                │
│  5. Build Structured Messages                                       │
│  6. Call AI via InferenceService                                    │
│  7. Save Assistant Message                                          │
│  8. Return Response                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INFERENCE SERVICE                               │
│  /backend/src/app/services/inference_service.py                     │
│  - Secret AI (PRIMARY) - Privacy via TEE                            │
│  - Akash ML (FALLBACK) - Decentralized AI                          │
│  - OpenAI-compatible API format                                     │
│  - Automatic fallback on network errors                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Chatbot Model

**File:** `/backend/src/app/models/chatbot.py`

```python
class ChatbotStatus(str, Enum):
    DRAFT = "draft"      # In Redis, not deployed
    ACTIVE = "active"    # Deployed, receiving messages
    PAUSED = "paused"    # Temporarily disabled
    ARCHIVED = "archived" # Soft deleted

class Chatbot(Base):
    __tablename__ = "chatbots"

    id: UUID
    workspace_id: UUID
    name: str
    description: str
    status: ChatbotStatus

    # Configuration JSON columns
    ai_config: dict          # model, temperature, max_tokens, provider
    prompt_config: dict      # system_prompt, persona, instructions, restrictions
    kb_config: dict          # knowledge_base_ids, per-KB overrides
    branding_config: dict    # colors, avatar, position, welcome message
    deployment_config: dict  # channels (web, telegram, discord, whatsapp, api)
    lead_capture_config: dict # email collection, custom fields
    variables_config: dict   # {{variable}} substitution mappings
    behavior_config: dict    # memory, typing delays, rate limiting
```

### ChatbotService

**File:** `/backend/src/app/services/chatbot_service.py`

**Main Flow - `process_message()`:**

```python
async def process_message(
    chatbot: Chatbot,
    user_message: str,
    session_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    variables: Optional[dict] = None
) -> ChatResponse:
    """
    Process a user message and generate AI response.

    Flow:
    1. Get or create session
    2. Save user message to session
    3. Retrieve context from knowledge bases (RAG)
    4. Get chat history for context
    5. Build structured messages (system + history + user)
    6. Substitute {{variables}} in prompts
    7. Call InferenceService for AI response
    8. Save assistant message
    9. Update metrics cache
    10. Return response with sources
    """
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `process_message()` | Main handler for all channels |
| `preview_response()` | Test draft chatbots (loads from Redis) |
| `_retrieve_context()` | RAG retrieval from knowledge bases |
| `_build_messages()` | Construct system + history + user messages |
| `_substitute_variables()` | Replace `{{variable_name}}` in prompts |

---

## Widget System

### Location

```
/widget/
├── src/
│   ├── index.js          # Main entry - PrivexBotWidget class
│   ├── api/
│   │   └── client.js     # WidgetAPIClient - HTTP calls
│   ├── ui/
│   │   ├── ChatBubble.js # Floating button
│   │   ├── ChatWindow.js # Main chat container
│   │   ├── MessageList.js # Message rendering
│   │   ├── InputBox.js   # Text input + send
│   │   └── LeadForm.js   # Email/data capture
│   └── styles/
│       └── widget.css    # Embedded styles
├── webpack.config.js     # Build config
├── package.json
└── build/
    └── widget.js         # Built output (~50KB)
```

### Widget Initialization

**Two embedding methods:**

```html
<!-- Method 1: Direct Script -->
<script src="https://cdn.privexbot.com/widget.js"></script>
<script>
  pb('init', {
    id: 'chatbot-uuid',
    apiKey: 'sk-...',
    options: {
      position: 'bottom-right',
      color: '#3b82f6',
      greeting: 'Hello! How can I help?',
      botName: 'Assistant'
    }
  });
</script>

<!-- Method 2: Async Loader (Recommended) -->
<script>
(function(w,d,s,o,f,js,fjs){
  w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
  js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
  js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
}(window,document,'script','pb','https://cdn.privexbot.com/widget.js'));

pb('init', {
  id: 'chatbot-uuid',
  apiKey: 'sk-...',
  options: {
    baseURL: 'https://api.privexbot.com/api/v1'
  }
});
</script>
```

### Widget Commands

```javascript
pb('open');     // Open chat window
pb('close');    // Close chat window
pb('toggle');   // Toggle open/close
pb('reset');    // Clear session
pb('status');   // Get widget status
pb('destroy');  // Remove widget
```

### API Client

**File:** `/widget/src/api/client.js`

```javascript
class WidgetAPIClient {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.timeout = 60000; // 60 seconds
  }

  // Send chat message
  async sendMessage(botId, message, sessionId, metadata) {
    return this.post(`/public/bots/${botId}/chat`, {
      message,
      session_id: sessionId,
      metadata
    });
  }

  // Track events (widget opened, message sent, etc.)
  async trackEvent(botId, eventType, eventData) {
    return this.post(`/public/bots/${botId}/events`, {
      event_type: eventType,
      event_data: eventData
    });
  }

  // Submit feedback
  async submitFeedback(botId, messageId, rating, comment) {
    return this.post(`/public/bots/${botId}/feedback`, {
      message_id: messageId,
      rating,
      comment
    });
  }

  // Capture lead
  async captureLead(email, data) {
    return this.post('/public/leads/capture', { email, ...data });
  }
}
```

### Session Management

- Session ID stored in `localStorage` as `privexbot_session_{botId}`
- Format: `web_{timestamp}_{random}`
- Persists across page reloads (24hr TTL on backend)

---

## Public API

### Unified Chat Endpoint

**File:** `/backend/src/app/api/v1/routes/public.py`

```
POST /api/v1/public/bots/{bot_id}/chat
```

**Request:**
```json
{
  "message": "Hello!",
  "session_id": "web_1704067200_abc123",
  "metadata": {
    "user_agent": "Mozilla/5.0...",
    "referrer": "https://example.com",
    "url": "https://example.com/page",
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "variables": {
    "user_name": "John",
    "company": "Acme Inc"
  }
}
```

**Response:**
```json
{
  "response": "Hi John! How can I help you at Acme Inc today?",
  "sources": [
    {
      "content": "Relevant knowledge base excerpt...",
      "chunk_id": "chunk-uuid",
      "kb_name": "Product Docs",
      "score": 0.92
    }
  ],
  "session_id": "web_1704067200_abc123",
  "message_id": "msg-uuid"
}
```

**Authentication:**
```
Authorization: Bearer sk-xxxxxxxxxxxxx
```

### Other Public Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/public/bots/{id}/chat` | POST | Send message, get AI response |
| `/public/bots/{id}/events` | POST | Track analytics events |
| `/public/bots/{id}/feedback` | POST | Submit message feedback |
| `/public/bots/{id}/config` | GET | Get widget configuration |
| `/public/leads/capture` | POST | Capture lead information |

---

## AI Inference Integration

### Providers

**File:** `/backend/src/app/services/inference_service.py`

| Provider | Role | Base URL | Default Model |
|----------|------|----------|---------------|
| **Secret AI** | PRIMARY | `https://secretai-api-url.scrtlabs.com:443/v1` | `DeepSeek-R1-Distill-Llama-70B` |
| **Akash ML** | FALLBACK | `https://api.akashml.com/v1` | `deepseek-ai/DeepSeek-V3.1` |

### Message Format

```python
messages = [
    {"role": "system", "content": "You are a helpful assistant for Acme Inc..."},
    {"role": "user", "content": "What products do you offer?"},
    {"role": "assistant", "content": "We offer widgets, gadgets, and tools..."},
    {"role": "user", "content": "Tell me about widgets"}
]
```

### Fallback Logic

```python
# If Secret AI fails (network, rate limit, etc.)
FALLBACK_ORDER = [
    InferenceProvider.AKASH_ML,  # Try Akash ML
]

# Enable fallback in .env
INFERENCE_FALLBACK_ENABLED=true
```

---

## Deployment Flow

### 3-Phase Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: DRAFT (Redis)                                              │
│                                                                     │
│ POST /api/v1/chatbots/drafts                                       │
│ → Creates draft in Redis with 24hr TTL                             │
│ → Returns draft_id                                                  │
│ → No database pollution                                             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2: CONFIGURE & TEST                                           │
│                                                                     │
│ PATCH /api/v1/chatbots/drafts/{draft_id}  → Update config          │
│ POST /api/v1/chatbots/drafts/{id}/kb      → Attach KB              │
│ POST /api/v1/chatbots/drafts/{id}/test    → Test before deploy     │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 3: DEPLOY (PostgreSQL)                                        │
│                                                                     │
│ POST /api/v1/chatbots/drafts/{draft_id}/deploy                     │
│ → Validates draft configuration                                     │
│ → Creates Chatbot record in PostgreSQL                              │
│ → Generates API Key (shown only once!)                              │
│ → Initializes deployment channels                                   │
│ → Deletes draft from Redis                                          │
│ → Returns: chatbot_id, api_key, channels                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Deployment Response

```json
{
  "chatbot_id": "550e8400-e29b-41d4-a716-446655440000",
  "api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "api_key_prefix": "sk-xxxx",
  "channels": {
    "website": {
      "status": "success",
      "embed_code": "<script src=\"...\"></script>..."
    },
    "telegram": {
      "status": "success",
      "webhook_url": "https://api.privexbot.com/webhooks/telegram/..."
    }
  }
}
```

> **CRITICAL:** The `api_key` is only returned once during deployment. Store it securely!

---

## Test/Preview Feature

### Draft Testing (Before Deployment)

```
POST /api/v1/chatbots/drafts/{draft_id}/test
```

**Request:**
```json
{
  "message": "Hello, how does your product work?",
  "session_id": "test_session_123"
}
```

**Flow:**
1. Loads draft configuration from Redis
2. Creates temporary chatbot object (not persisted)
3. Calls `ChatbotService.preview_response()`
4. Uses draft's AI config, prompt, KB connections
5. Returns response with sources

**Response:**
```json
{
  "response": "Our product works by...",
  "sources": [...],
  "session_id": "test_session_123",
  "draft_id": "draft-uuid"
}
```

### Deployed Chatbot Testing

```
POST /api/v1/chatbots/{chatbot_id}/test
```

- Loads from PostgreSQL (real deployed chatbot)
- Creates real session
- Useful for testing after deployment

---

## Configuration

### Backend Environment (`.env.dev`)

```bash
# AI Providers (Decentralized Only)
SECRET_AI_API_KEY=sk-your-secret-ai-key
SECRET_AI_BASE_URL=https://secretai-api-url.scrtlabs.com:443/v1
AKASHML_API_KEY=your-akash-ml-key
INFERENCE_FALLBACK_ENABLED=true

# Frontend URL
FRONTEND_URL=http://localhost:5174

# CORS (include widget domains)
BACKEND_CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:9000

# Database
DATABASE_URL=postgresql://privexbot:privexbot_dev@postgres:5432/privexbot_dev
REDIS_URL=redis://redis:6379/0
```

### Frontend Environment (`.env`)

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WIDGET_CDN_URL=http://localhost:9000
VITE_ENV=development
```

### Widget URL Priority

1. Script `data-api-url` attribute
2. `window.PRIVEXBOT_API_URL` global
3. Init config `baseURL` option
4. Runtime detection (localhost vs production)
5. Default: `http://localhost:8000/api/v1`

---

## Practical Testing Guide

### Prerequisites

1. **Backend running:**
   ```bash
   docker compose -f backend/docker-compose.dev.yml up -d
   ```

2. **Frontend running:**
   ```bash
   cd frontend && npm run dev
   ```

3. **Widget running (optional for direct testing):**
   ```bash
   cd widget && npm run dev
   # Runs on http://localhost:9000
   ```

### Step-by-Step Test

#### 1. Create Draft Chatbot

```bash
curl -X POST http://localhost:8000/api/v1/chatbots/drafts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "your-workspace-uuid",
    "name": "Test Support Bot",
    "description": "A test chatbot",
    "ai_config": {
      "model": "DeepSeek-R1-Distill-Llama-70B",
      "temperature": 0.7,
      "max_tokens": 1000
    },
    "prompt_config": {
      "system_prompt": "You are a helpful support assistant for Acme Inc. Be friendly and concise."
    }
  }'
```

**Response:**
```json
{
  "draft_id": "draft-uuid",
  "status": "created"
}
```

#### 2. Test Draft

```bash
curl -X POST http://localhost:8000/api/v1/chatbots/drafts/{draft_id}/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! What can you help me with?"
  }'
```

**Response:**
```json
{
  "response": "Hello! I'm here to help you with any questions about Acme Inc...",
  "sources": [],
  "session_id": "test_xxx"
}
```

#### 3. Deploy Chatbot

```bash
curl -X POST http://localhost:8000/api/v1/chatbots/drafts/{draft_id}/deploy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channels": [
      {"type": "website", "enabled": true},
      {"type": "api", "enabled": true}
    ]
  }'
```

**Response:**
```json
{
  "chatbot_id": "chatbot-uuid",
  "api_key": "sk-xxxxxxxxxxxxxxxx",
  "channels": {
    "website": {"status": "success", "embed_code": "..."},
    "api": {"status": "success"}
  }
}
```

> **SAVE THE API KEY!** It's only shown once.

#### 4. Test Via Public API

```bash
curl -X POST http://localhost:8000/api/v1/public/bots/{chatbot_id}/chat \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi there!"
  }'
```

#### 5. Test Via Widget

Create an HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Widget Test</title>
</head>
<body>
  <h1>Chatbot Widget Test</h1>
  <p>The chat widget should appear in the bottom-right corner.</p>

  <!-- Widget Embed Code -->
  <script src="http://localhost:9000/widget.js"></script>
  <script>
    pb('init', {
      id: 'YOUR_CHATBOT_ID',
      apiKey: 'sk-YOUR_API_KEY',
      options: {
        baseURL: 'http://localhost:8000/api/v1',
        position: 'bottom-right',
        color: '#3b82f6',
        greeting: 'Hello! How can I help you?',
        botName: 'Support Bot'
      }
    });
  </script>
</body>
</html>
```

Open in browser and test the chat widget.

---

## Key File Paths

### Backend

| File | Purpose |
|------|---------|
| `/backend/src/app/models/chatbot.py` | Chatbot database model |
| `/backend/src/app/services/chatbot_service.py` | Message processing logic |
| `/backend/src/app/services/draft_service.py` | Draft management (Redis) |
| `/backend/src/app/services/inference_service.py` | AI provider integration |
| `/backend/src/app/api/v1/routes/chatbot.py` | CRUD API endpoints |
| `/backend/src/app/api/v1/routes/public.py` | Public API (widget calls) |

### Frontend

| File | Purpose |
|------|---------|
| `/frontend/src/api/chatbot.ts` | Chatbot API client |
| `/frontend/src/pages/chatbots/` | Chatbot management pages |
| `/frontend/src/components/deployment/` | Deployment UI components |
| `/frontend/src/config/env.ts` | Environment configuration |

### Widget

| File | Purpose |
|------|---------|
| `/widget/src/index.js` | Main entry point |
| `/widget/src/api/client.js` | API client for backend |
| `/widget/src/ui/*.js` | UI components |
| `/widget/webpack.config.js` | Build configuration |
| `/widget/build/widget.js` | Built output |

---

## Troubleshooting

### Widget Not Loading

1. Check if widget dev server is running: `cd widget && npm run dev`
2. Check browser console for errors
3. Verify CORS settings include widget origin
4. Check API key is valid

### AI Not Responding

1. Check inference service logs: `docker logs privexbot-backend-dev`
2. Verify `SECRET_AI_API_KEY` or `AKASHML_API_KEY` is set
3. Check `INFERENCE_FALLBACK_ENABLED=true`
4. Test network connectivity to AI providers

### Session Issues

1. Clear localStorage: `localStorage.removeItem('privexbot_session_{botId}')`
2. Check Redis is running: `docker logs privexbot-redis`
3. Verify session TTL (24 hours default)

---

## Summary

The PrivexBot chatbot system is a **fully implemented, production-ready** feature with:

- **Draft-first architecture** preventing database pollution
- **Multi-channel deployment** (Web Widget, Discord, Telegram, WhatsApp, API)
- **RAG integration** with knowledge bases
- **Decentralized AI** (Secret AI + Akash ML)
- **Embeddable widget** (~50KB, customizable)
- **Lead capture** and analytics
- **Session persistence** across page reloads

The system is **95% complete** and ready for practical testing.
