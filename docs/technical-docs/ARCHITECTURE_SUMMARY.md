# PrivexBot Complete Architecture Summary

**Overview of all architectural components and how they fit together**

---

## Table of Contents

1. [System Overview](#overview)
2. [Draft-First Architecture](#draft-first)
3. [Core Entities](#entities)
4. [Knowledge Base Architecture](#kb-architecture)
5. [Chatbot vs Chatflow](#chatbot-chatflow)
6. [Deployment & Multi-Channel](#deployment)
7. [Lead Capture System](#lead-capture)
8. [Folder Structure](#folder-structure)
9. [Technology Stack](#tech-stack)

---

## 1. System Overview {#overview}

### What is PrivexBot?

**PrivexBot** is a **multi-tenant SaaS platform** for building and deploying AI chatbots and chatflows with:

- **RAG-powered Knowledge Bases** - Import from multiple sources
- **Simple Chatbots** - Form-based conversational AI
- **Advanced Chatflows** - Visual workflow automation (like n8n, Dify)
- **Multi-Channel Deployment** - Website, Discord, Telegram, WhatsApp, API
- **Lead Capture** - Generate leads from bot interactions
- **Secret AI Integration** - Privacy-focused AI inference

---

### Tenant Hierarchy

```
Organization (Company)
  ↓
Workspace (Team/Department)
  ↓
├── Chatbots (Simple bots)
├── Chatflows (Advanced workflows)
├── Knowledge Bases (Shared RAG knowledge)
├── Credentials (API keys for chatflow nodes)
└── Leads (Captured from interactions)
```

**Key Principle:** Everything is isolated by organization/workspace.

---

## 2. Draft-First Architecture {#draft-first}

### The Universal Flow

**CRITICAL:** ALL entity creation (Chatbots, Chatflows, Knowledge Bases) happens in **DRAFT mode** before database save.

```
Flow for ALL Entities:

1. Create Draft → Redis (NOT Database)
   ↓
2. Configure & Edit → Auto-save to Redis
   - Add settings
   - Add sources (KB only)
   - Configure appearance
   - Set variables
   ↓
3. Live Preview & Test → Real AI responses
   - Test with actual data
   - No database impact
   - Preview exactly as users will see
   ↓
4. Select Deployment Channels → Choose where to deploy
   - Website widget
   - Telegram, Discord, WhatsApp
   - Zapier, API
   ↓
5. Validate → Check required fields
   - Ensure all required data present
   - Verify configurations
   - Show errors/warnings
   ↓
6. DEPLOY → ONLY NOW save to database
   - Create database record
   - Generate API keys
   - Register webhooks for enabled channels
   - Initialize services
   - Queue background tasks (KB only)
   - Delete draft from Redis
   ↓
7. LIVE → Accessible via selected channels
```

**WHY This Approach:**
- ✅ Users preview and test before deploying
- ✅ No database pollution during creation
- ✅ Easy to abandon (just discard draft)
- ✅ Auto-save without DB writes
- ✅ Faster UX (Redis is fast)
- ✅ Validation before commit

**Storage:**
- **Drafts:** Redis (24hr TTL, auto-extended on save)
- **Deployed Entities:** PostgreSQL

**Key Services:**
- `draft_service.py` - Unified draft management for ALL entity types
- `kb_draft_service.py` - KB-specific draft operations (chunking preview, source handling)
- Integration services - Register webhooks on deployment (telegram_integration.py, discord_integration.py, etc.)

---

## 3. Core Entities {#entities}

### 1. Organization

- Top-level tenant
- Owns workspaces
- Billing and subscription

### 2. Workspace

- Sub-tenant within organization
- Contains chatbots, chatflows, KBs
- Team collaboration unit

### 3. Chatbot (Simple)

- **Creation:** Form-based UI
- **Execution:** Linear, single AI call per message
- **Use Cases:** FAQ bots, simple Q&A
- **Database:** `chatbots` table

### 4. Chatflow (Advanced)

- **Creation:** Visual drag-and-drop (ReactFlow)
- **Execution:** Graph traversal, multiple AI calls
- **Use Cases:** Multi-step workflows, conditional logic
- **Database:** `chatflows` table
- **Nodes:** LLM, KB Search, HTTP, Database, Condition, Loop, etc.

### 5. Knowledge Base

- **Purpose:** RAG (Retrieval-Augmented Generation)
- **Sources:** Files, websites, Google Docs, Notion, Sheets, text
- **Architecture:** Draft mode → Finalize → Background processing
- **Sharing:** One KB can serve multiple chatbots/chatflows
- **Access:** Context-aware (configurable per bot)

### 6. Lead

- **Purpose:** Capture user info from bot interactions
- **Data:** Email, name, phone, geolocation
- **Source:** Website widget, Discord, Telegram, etc.
- **Analytics:** Geographical distribution, conversion tracking

---

## 3. Knowledge Base Architecture {#kb-architecture}

### The Draft-First Approach

**CRITICAL:** KB creation happens in **draft mode** before database save.

```
Flow:
1. Create Draft (Redis)
   ↓
2. Add Sources (temp storage)
   - Upload files → /tmp
   - Scrape websites → content in Redis
   - Import Notion/Google Docs → content in Redis
   ↓
3. Configure & Annotate
   - Chunking settings
   - Indexing method
   - Document annotations
   ↓
4. Preview Chunks (generated on-the-fly)
   - See all chunks from all sources
   - Edit/remove sources
   - Adjust settings
   ↓
5. FINALIZE
   - Save KB to PostgreSQL
   - Create document records
   - Move temp files to permanent storage
   - Queue background processing (Celery)
   - Delete draft from Redis
```

**WHY this approach:**
- ✅ No database pollution during creation
- ✅ Fast preview without DB writes
- ✅ Easy to abandon/rollback (just discard draft)
- ✅ Better UX (instant feedback)

---

### Import Sources

**Supported:**

1. **File Upload** - PDF, Word, Text, CSV, JSON
   - Tools: Unstructured.io, PyMuPDF, python-docx
   - Storage: Temp → Permanent on finalize

2. **Website Scraping** - Any public website
   - Tools: **Crawl4AI** (recommended), Firecrawl, Jina Reader
   - Features: Multi-page crawl, subdomain include/exclude

3. **Google Docs** - Sync with Google Workspace
   - Tool: Google Docs API
   - Features: Auto-sync, preserve formatting

4. **Notion** - Import pages and databases
   - Tool: Notion API
   - Features: Hierarchical import, auto-sync

5. **Google Sheets** - Tabular data
   - Tool: Google Sheets API
   - Features: Convert to structured text

6. **Direct Text Paste** - Manual input
   - Formats: Plain text, Markdown, JSON

---

### Document Annotations

**Purpose:** Help AI understand document context.

**Fields:**
- `category` - document, policy, guide, FAQ, etc.
- `importance` - low, medium, high, critical
- `purpose` - Why this document exists
- `context` - Additional background
- `tags` - Searchable keywords
- `usage_instructions` - How AI should use it
- `constraints` - Limitations or warnings

**How Used:**
- **During Retrieval:** Boost scores based on importance
- **During Response:** Inject context into prompt

---

### Chunking Strategies

**4 Methods:**

1. **Size-Based** - Fixed size with overlap
2. **By Heading** - Split on Markdown/HTML headings
3. **By Page** - One chunk per page (PDFs)
4. **By Similarity** - Semantic grouping

**Configuration Levels:**
- KB-level (default for all documents)
- Document-level (override per document)

---

### Processing Pipeline (Background)

**After Finalize:**

```
Celery Tasks (concurrent):

1. process_document.delay(doc_id)
   ↓
   Parse content (Unstructured.io)
   ↓
   Chunk content (chunking_service)
   ↓
   Generate embeddings (embedding_service)
   ↓
   Store in vector DB (vector_store_service)
   ↓
   Update status: completed
```

**Concurrent Processing:**
- Multiple Celery workers process documents in parallel
- Real-time status updates via polling
- Error handling: Mark as failed with error message

---

## 4. Chatbot vs Chatflow {#chatbot-chatflow}

### Critical Differences

| Aspect | Chatbot | Chatflow |
|--------|---------|----------|
| **Creation** | Form-based UI | Drag-and-drop visual editor |
| **Complexity** | Simple, linear | Complex, branching |
| **AI Calls** | Single per message | Multiple (one per LLM node) |
| **Logic** | No conditionals | Full if/else, loops, branching |
| **API Integration** | No | Yes (HTTP Request nodes) |
| **Database** | `chatbots` table | `chatflows` table |
| **Service** | `chatbot_service.py` | `chatflow_service.py` + `chatflow_executor.py` |
| **Builder** | `ChatbotBuilder.jsx` | `ChatflowBuilder.jsx` (ReactFlow) |
| **Deployment** | ✅ Same (unified) | ✅ Same (unified) |

---

### Chatbot Execution

```python
def process_message(chatbot, message, session):
    # 1. Get chat history
    history = get_chat_history(session)

    # 2. Retrieve from KB (if configured)
    context = ""
    if chatbot.knowledge_bases:
        context = retrieve_from_kb(chatbot, message)

    # 3. Build prompt
    prompt = f"""
    System: {chatbot.system_prompt}

    Context from knowledge base:
    {context}

    Chat history:
    {history}

    User: {message}
    """

    # 4. Single AI call
    response = secret_ai.generate(prompt)

    # 5. Save to history
    save_message(session, message, response)

    return response
```

---

### Chatflow Execution

```python
def execute(chatflow, message, session):
    # 1. Build execution graph
    graph = build_graph(chatflow.nodes, chatflow.edges)

    # 2. Initialize context
    context = {
        "input": message,
        "variables": {},
        "node_outputs": {}
    }

    # 3. Execute nodes (topological order)
    current_node = "start"

    while current_node:
        node = get_node(chatflow, current_node)

        # Execute node based on type
        if node.type == "llm":
            output = execute_llm_node(node, context)
        elif node.type == "kb":
            output = execute_kb_node(node, context)
        elif node.type == "condition":
            output = execute_condition_node(node, context)
            # Branch based on condition result
            current_node = output.next_node
            continue
        elif node.type == "http":
            output = execute_http_node(node, context)

        # Store output
        context["node_outputs"][current_node] = output

        # Get next node
        current_node = get_next_node(node, graph)

    # 4. Return final output
    return context["node_outputs"]["response"]
```

---

## 5. Deployment & Multi-Channel {#deployment}

### Multi-Channel Deployment Flow

**CRITICAL:** Users select deployment channels **during draft creation** (final step before deploying).

**Deploy Step in Builder:**
1. User creates chatbot/chatflow in draft mode
2. Configures all settings (knowledge, instructions, etc.)
3. **Deploy Step** - Select channels to deploy to:
   - ☑ Website Widget
   - ☑ Telegram Bot
   - ☐ Discord Bot
   - ☐ WhatsApp Business
   - ☐ Zapier Webhook
4. Click "Deploy to Channels"
5. Backend:
   - Saves to database
   - Generates API keys
   - **Registers webhooks for enabled channels**
   - Returns deployment results per channel

**Response Example:**
```json
{
  "chatbot_id": "uuid",
  "channels": {
    "website": {
      "status": "success",
      "embed_code": "<script>...</script>"
    },
    "telegram": {
      "status": "success",
      "webhook_url": "https://...",
      "bot_username": "@your_bot"
    }
  }
}
```

---

### Supported Channels

**1. Website Embed** (Primary)
- **Method:** JS widget or iframe
- **Code:** Auto-generated embed code
- **Widget:** Separate package, framework-agnostic
- **Config:** Allowed domains, widget position

**2. Telegram Bot**
- **Method:** Telegram Bot API
- **Integration:** `telegram_integration.py`
- **Setup:** User provides bot token (from @BotFather)
- **Webhook:** Auto-registered on deploy

**3. Discord Bot**
- **Method:** Discord webhook
- **Integration:** `discord_integration.py`
- **Setup:** User provides bot token
- **Webhook:** Auto-registered on deploy

**4. WhatsApp Business**
- **Method:** WhatsApp Business API
- **Integration:** `whatsapp_integration.py`
- **Setup:** Business phone number + API credentials

**5. Zapier Webhook**
- **Method:** Webhook URL
- **Use:** Integrate with Zapier workflows
- **Webhook:** Auto-generated on deploy

**6. API Direct**
- **Method:** REST API
- **Endpoint:** `POST /v1/bots/{bot_id}/chat`
- **Auth:** API key required

---

### Unified Public API

**WHY:** Same API works for both chatbots and chatflows.

```python
@router.post("/v1/bots/{bot_id}/chat")
async def chat(bot_id: UUID, request: ChatRequest):
    # Auto-detect bot type
    bot_type, bot = detect_bot_type(bot_id)

    if bot_type == "chatbot":
        response = await chatbot_service.process_message(bot, request.message)
    elif bot_type == "chatflow":
        response = await chatflow_service.execute(bot, request.message)

    return {"response": response}
```

**Widget doesn't need to know bot type** - it just calls the API.

---

### Secret AI Integration

**CRITICAL:** Secret AI is **backend-only** (never exposed to widget/frontend).

**Location:**
- `backend/src/app/services/inference_service.py`

**Flow:**
1. Widget sends message to backend API
2. Backend calls Secret AI
3. Backend returns response to widget

**WHY:**
- ✅ API keys never exposed
- ✅ Secure inference
- ✅ No client-side AI logic

---

## 6. Lead Capture System {#lead-capture}

### Architecture

**Optional Feature** - Disabled by default.

**Configuration** (in chatbot/chatflow):
```json
{
  "lead_capture": {
    "enabled": false,
    "timing": "before_chat",  // before, during, after
    "required_fields": ["email"],
    "optional_fields": ["name", "phone"],
    "custom_fields": [
      {"name": "company", "label": "Company Name", "type": "text"}
    ],
    "privacy_notice": "We'll use this to improve your experience.",
    "auto_capture_location": true  // IP-based geolocation
  }
}
```

---

### Flow

```
1. Builder enables lead capture in bot config
   ↓
2. Widget detects lead capture enabled
   ↓
3. Shows form (before/during/after chat)
   ↓
4. User submits email + optional fields
   ↓
5. Backend receives lead data
   ↓
6. Resolves geolocation from IP (GeoIP service)
   ↓
7. Stores in leads table
   ↓
8. Builder views leads in dashboard
```

---

### Geolocation

**Tool:** MaxMind GeoIP2 (or IP2Location, ipapi.co)

**Data Captured:**
- Country, country code
- Region/state
- City
- Timezone
- Latitude/longitude

**Used For:**
- Geographical distribution map
- Analytics and insights

---

## 7. Folder Structure {#folder-structure}

### Complete Structure

```
privexbot/
├── backend/
│   ├── src/app/
│   │   ├── models/                  # Database models
│   │   │   ├── organization.py
│   │   │   ├── workspace.py
│   │   │   ├── user.py
│   │   │   ├── chatbot.py           # Simple chatbot
│   │   │   ├── chatflow.py          # Advanced workflow
│   │   │   ├── knowledge_base.py
│   │   │   ├── document.py          # With annotations field
│   │   │   ├── chunk.py
│   │   │   ├── credential.py        # For chatflow nodes
│   │   │   ├── lead.py              # Lead capture
│   │   │   ├── chat_session.py      # Works for BOTH
│   │   │   └── chat_message.py
│   │   │
│   │   ├── services/                # Business logic
│   │   │   ├── chatbot_service.py           # Chatbot execution
│   │   │   ├── chatflow_service.py          # Chatflow execution
│   │   │   ├── chatflow_executor.py         # Node executor
│   │   │   ├── inference_service.py         # Secret AI
│   │   │   ├── session_service.py           # Chat history
│   │   │   ├── credential_service.py        # Credentials
│   │   │   ├── geoip_service.py             # IP geolocation
│   │   │   ├── kb_draft_service.py          # Draft KB (Redis)
│   │   │   ├── document_processing_service.py  # Parse, chunk, embed
│   │   │   ├── chunking_service.py          # Chunking strategies
│   │   │   ├── indexing_service.py          # Vector indexing
│   │   │   ├── retrieval_service.py         # Search with boosting
│   │   │   ├── embedding_service.py         # Generate embeddings
│   │   │   └── vector_store_service.py      # Vector DB abstraction
│   │   │
│   │   ├── integrations/            # External integrations
│   │   │   ├── discord_integration.py
│   │   │   ├── telegram_integration.py
│   │   │   ├── whatsapp_integration.py
│   │   │   ├── zapier_integration.py
│   │   │   ├── crawl4ai_adapter.py          # Website scraping
│   │   │   ├── firecrawl_adapter.py
│   │   │   ├── jina_adapter.py
│   │   │   ├── google_adapter.py            # Google Docs/Sheets
│   │   │   ├── notion_adapter.py
│   │   │   └── unstructured_adapter.py      # Document parsing
│   │   │
│   │   ├── chatflow/                # Chatflow node implementations
│   │   │   ├── nodes/
│   │   │   │   ├── llm_node.py
│   │   │   │   ├── kb_node.py
│   │   │   │   ├── condition_node.py
│   │   │   │   ├── http_node.py
│   │   │   │   ├── variable_node.py
│   │   │   │   ├── code_node.py
│   │   │   │   ├── memory_node.py
│   │   │   │   ├── database_node.py
│   │   │   │   ├── loop_node.py
│   │   │   │   └── response_node.py
│   │   │   └── utils/
│   │   │       ├── variable_resolver.py
│   │   │       └── graph_builder.py
│   │   │
│   │   ├── tasks/                   # Celery background tasks
│   │   │   ├── document_tasks.py    # Process documents (AFTER finalize)
│   │   │   ├── crawling_tasks.py    # Website crawling
│   │   │   └── sync_tasks.py        # Cloud sync (Notion, Google)
│   │   │
│   │   ├── api/v1/routes/           # API endpoints
│   │   │   ├── auth.py
│   │   │   ├── chatbots.py
│   │   │   ├── chatflows.py
│   │   │   ├── kb_draft.py          # NEW - Draft mode endpoints
│   │   │   ├── knowledge_bases.py
│   │   │   ├── documents.py
│   │   │   ├── credentials.py
│   │   │   ├── leads.py
│   │   │   ├── public.py            # Public API (unified)
│   │   │   └── webhooks/
│   │   │       ├── discord.py
│   │   │       ├── telegram.py
│   │   │       └── whatsapp.py
│   │   │
│   │   ├── schemas/                 # Pydantic models
│   │   ├── celery_app.py            # Celery config
│   │   └── main.py
│   │
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ChatbotBuilder.jsx       # Form-based
│   │   │   ├── ChatflowBuilder.jsx      # ReactFlow drag-and-drop
│   │   │   ├── KBCreationWizard.jsx     # Multi-step KB creation (DRAFT)
│   │   │   ├── KnowledgeBase.jsx
│   │   │   ├── Credentials.jsx
│   │   │   ├── LeadsDashboard.jsx
│   │   │   └── Deployments.jsx
│   │   │
│   │   └── components/
│   │       ├── chatbot/                 # Chatbot-specific
│   │       │   ├── ChatbotSettingsForm.jsx
│   │       │   ├── SystemPromptEditor.jsx
│   │       │   └── KnowledgeBaseSelector.jsx
│   │       │
│   │       ├── chatflow/                # Chatflow-specific (ReactFlow)
│   │       │   ├── ReactFlowCanvas.jsx
│   │       │   ├── NodePalette.jsx
│   │       │   ├── NodeConfigPanel.jsx
│   │       │   ├── nodes/               # Custom node UI
│   │       │   │   ├── LLMNode.jsx
│   │       │   │   ├── KnowledgeBaseNode.jsx
│   │       │   │   ├── ConditionNode.jsx
│   │       │   │   └── HTTPRequestNode.jsx
│   │       │   └── VariableInspector.jsx
│   │       │
│   │       ├── kb/                      # KB creation (DRAFT mode)
│   │       │   ├── SourceSelector.jsx
│   │       │   ├── FileUploader.jsx     # Temp upload
│   │       │   ├── WebsiteCrawler.jsx
│   │       │   ├── NotionIntegration.jsx
│   │       │   ├── GoogleDocsIntegration.jsx
│   │       │   ├── TextPasteInput.jsx
│   │       │   ├── DocumentAnnotationForm.jsx
│   │       │   ├── ChunkConfigPanel.jsx
│   │       │   ├── IndexingConfigPanel.jsx
│   │       │   ├── ChunkPreview.jsx     # Preview before save
│   │       │   ├── SourcesList.jsx
│   │       │   └── KBDraftSummary.jsx
│   │       │
│   │       └── shared/                  # Works for both
│   │           ├── EmbedCode.jsx
│   │           ├── IntegrationSetup.jsx
│   │           ├── ChatPreview.jsx
│   │           └── CredentialSelector.jsx
│
├── widget/                              # Separate JS package
│   ├── src/
│   │   ├── index.js                     # Entry point (unified)
│   │   ├── ui/
│   │   │   ├── ChatBubble.js
│   │   │   ├── ChatWindow.js
│   │   │   ├── MessageList.js
│   │   │   ├── InputBox.js
│   │   │   └── LeadCaptureForm.js       # NEW
│   │   ├── api/
│   │   │   └── client.js                # Backend API calls
│   │   └── styles/
│   │       └── widget.css
│   ├── build/
│   │   └── widget.js                    # Compiled bundle
│   └── package.json
│
└── docs/
    └── technical-docs/
        ├── CHATBOT_DEPLOYMENT_ARCHITECTURE.md
        ├── KNOWLEDGE_BASE_CREATION_FLOW.md
        ├── KB_DRAFT_MODE_ARCHITECTURE.md
        └── ARCHITECTURE_SUMMARY.md (this file)
```

---

## 8. Technology Stack {#tech-stack}

### Backend

- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL (main data)
- **Cache/Queue:** Redis (draft storage, Celery broker)
- **Task Queue:** Celery (background processing)
- **Vector Stores:** FAISS, Qdrant, Weaviate, Milvus, Pinecone, etc.
- **Embeddings:** OpenAI, Secret AI, Hugging Face, Cohere

### Frontend

- **Framework:** React
- **Chatbot Builder:** Forms
- **Chatflow Builder:** ReactFlow (drag-and-drop)
- **State:** React Context/Redux
- **UI:** Tailwind CSS / Material UI

### Widget

- **Build:** Vanilla JS (framework-agnostic)
- **Bundle:** Webpack
- **Deploy:** CDN

### Integrations

- **Website Scraping:** Crawl4AI, Firecrawl, Jina Reader
- **Document Parsing:** Unstructured.io, PyMuPDF, python-docx
- **Cloud Sources:** Google Docs API, Notion API, Google Sheets API
- **Messaging:** Discord.py, python-telegram-bot, Twilio (WhatsApp)
- **Geolocation:** MaxMind GeoIP2, IP2Location

---

## Key Architectural Principles

1. **Multi-Tenancy:** Everything isolated by organization/workspace
2. **Separation of Concerns:** Chatbot ≠ Chatflow (different tables, services, builders)
3. **Unified Deployment:** Same API and widget for both types
4. **Draft-First KB Creation:** Preview everything before DB save
5. **Background Processing:** Never block API requests (Celery)
6. **Backend-Only AI:** Secret AI never exposed to frontend
7. **Context-Aware Access:** Settings-based permissions (no junction tables)
8. **Minimal & Robust:** Only essential services, no over-engineering

---

## Documentation Files

1. **CHATBOT_DEPLOYMENT_ARCHITECTURE.md** - Complete deployment guide (chatbot vs chatflow, multi-channel, widget, folder structure)

2. **KNOWLEDGE_BASE_CREATION_FLOW.md** - KB import sources, chunking, indexing, background processing

3. **KB_DRAFT_MODE_ARCHITECTURE.md** - Draft mode flow (Redis-based, preview before save)

4. **ARCHITECTURE_SUMMARY.md** - This file (overview of everything)

---

This architecture is designed to be **minimal**, **secure**, **robust**, and **scalable** while following best practices for production SaaS platforms.
