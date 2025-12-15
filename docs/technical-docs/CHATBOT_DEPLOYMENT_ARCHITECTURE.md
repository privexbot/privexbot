# Chatbot & Chatflow Deployment Architecture

**Complete guide from creation to deployment across multiple channels**

---

## Table of Contents

1. [Overview: What Does "Deploy" Mean?](#overview)
2. [Chatbot vs Chatflow: Critical Differences](#chatbot-vs-chatflow)
3. [The Complete Lifecycle](#lifecycle)
4. [Architecture Components](#architecture)
5. [Secret AI Integration](#secret-ai)
6. [Chatflow Node System](#chatflow-nodes)
7. [Website Embed Widget](#embed-widget)
8. [Multi-Channel Deployment](#multi-channel)
9. [Chat Sessions & History](#chat-sessions)
10. [Folder Structure](#folder-structure)
11. [Implementation Guide](#implementation)

---

## 1. Overview: What Does "Deploy" Mean? {#overview}

### What is a Bot in Privexbot?

Privexbot supports two distinct bot types:

1. **Chatbot** - Simple, form-based conversational AI
2. **Chatflow** - Advanced workflow automation with visual node editor

Both are:

- **Deployable services** that can be embedded anywhere
- **API endpoints** that accept messages and returns responses
- **Configurable** with different settings and behaviors

**IMPORTANT:** While both can chat with users, they have completely different internal architectures and creation processes.

### What Does "Deploy" Mean?

**Deploying** a chatbot means making it accessible to end users through various channels:

1. **Website Embed** (JS widget or iframe)

   - User adds `<script>` tag to their website
   - Chat widget appears on the site
   - End users can interact with the bot

2. **Discord/Telegram/WhatsApp Bot**

   - Bot connects to messaging platform APIs
   - Users interact via the messaging app
   - Bot responds using your chatbot logic

3. **Zapier Integration**

   - Chatbot exposed as Zapier action/trigger
   - Other apps can send queries to your bot
   - Bot responses used in automated workflows

4. **Direct API Access**
   - Developers call your bot via REST API
   - Used for custom integrations
   - Mobile apps, backend services, etc.

---

## 2. Chatbot vs Chatflow: Critical Differences {#chatbot-vs-chatflow}

### Overview

**IMPORTANT:** Chatbot and Chatflow are **NOT the same thing** in Privexbot. They are separate entities with different:

- Creation processes (forms vs drag-and-drop)
- Database models (separate tables)
- Execution engines (simple vs workflow-based)
- Configuration structures
- Use cases

### Chatbot (Simple Form-Based)

#### What is a Chatbot?

A **chatbot** is a **simple conversational AI** created through a form-based interface.

**Use Cases:**

- Customer support FAQ bot
- Product documentation assistant
- Simple Q&A bot
- Knowledge base search interface

**Creation Method:**

- Fill out a form with settings
- Configure system prompt
- Link to knowledge bases
- Set appearance and behavior

**Configuration Structure:**

```json
{
  "model": "secret-ai-v1",
  "temperature": 0.7,
  "system_prompt": "You are a helpful support assistant...",
  "knowledge_bases": [
    {
      "kb_id": "uuid",
      "enabled": true,
      "override_retrieval": { "top_k": 5 }
    }
  ],
  "memory": {
    "enabled": true,
    "max_messages": 10
  },
  "branding": {
    "avatar": "url",
    "color": "#007bff",
    "greeting": "Hi! How can I help you today?"
  }
}
```

**Execution Flow:**

```
User Message
  ↓
Search Knowledge Base (if configured)
  ↓
Build Context (KB results + chat history)
  ↓
Single Secret AI Call (system_prompt + context + message)
  ↓
Return Response
```

**Backend Processing:**

```python
# Simple linear execution
def process_chatbot_message(chatbot, message, session):
    # 1. Search KB
    context = search_knowledge_base(chatbot, message)

    # 2. Get history
    history = get_chat_history(session)

    # 3. Call AI once
    response = secret_ai.chat(
        system_prompt=chatbot.config["system_prompt"],
        context=context,
        history=history,
        message=message
    )

    # 4. Return
    return response
```

---

### Chatflow (Advanced Workflow-Based)

#### What is a Chatflow?

A **chatflow** is an **advanced workflow automation system** created through a **visual drag-and-drop node editor** (like n8n, Dify, Flowise).

**Use Cases:**

- Multi-step customer support with escalation
- Lead qualification with CRM integration
- Order processing with external API calls
- Complex decision trees with conditional logic
- Automated workflows with multiple AI calls

**Creation Method:**

- **Drag-and-drop visual editor** (React Flow)
- Connect nodes with edges
- Configure each node individually
- Set up conditions, loops, API calls

**Configuration Structure:**

```json
{
  "nodes": [
    {
      "id": "start",
      "type": "trigger",
      "position": { "x": 100, "y": 100 },
      "data": {}
    },
    {
      "id": "llm1",
      "type": "llm",
      "position": { "x": 300, "y": 100 },
      "data": {
        "provider": "secret_ai",
        "model": "secret-ai-v1",
        "prompt": "Extract user intent: {{input}}",
        "temperature": 0.3
      }
    },
    {
      "id": "condition1",
      "type": "if_else",
      "position": { "x": 500, "y": 100 },
      "data": {
        "condition": "{{llm1.output}} == 'billing'",
        "true_branch": "api_call1",
        "false_branch": "llm2"
      }
    },
    {
      "id": "api_call1",
      "type": "http_request",
      "position": { "x": 700, "y": 50 },
      "data": {
        "method": "GET",
        "url": "https://api.stripe.com/v1/customers/{{user_id}}",
        "headers": {
          "Authorization": "Bearer {{credentials.stripe_api_key}}"
        }
      }
    },
    {
      "id": "llm2",
      "type": "llm",
      "position": { "x": 700, "y": 200 },
      "data": {
        "provider": "secret_ai",
        "model": "secret-ai-v1",
        "prompt": "Answer this general question: {{input}}\n\nContext: {{kb_search.results}}",
        "temperature": 0.7
      }
    },
    {
      "id": "kb_search",
      "type": "knowledge_base",
      "position": { "x": 500, "y": 250 },
      "data": {
        "kb_id": "uuid",
        "query": "{{input}}",
        "top_k": 5
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "llm1" },
    { "id": "e2", "source": "llm1", "target": "condition1" },
    {
      "id": "e3",
      "source": "condition1",
      "target": "api_call1",
      "condition": "true"
    },
    {
      "id": "e4",
      "source": "condition1",
      "target": "kb_search",
      "condition": "false"
    },
    { "id": "e5", "source": "kb_search", "target": "llm2" },
    { "id": "e6", "source": "api_call1", "target": "end" },
    { "id": "e7", "source": "llm2", "target": "end" }
  ],
  "variables": {
    "user_id": "",
    "user_intent": ""
  },
  "settings": {
    "max_iterations": 50,
    "timeout_seconds": 60
  }
}
```

**Execution Flow:**

```
User Message
  ↓
Start Node
  ↓
LLM Node (extract intent) → Set variable "intent"
  ↓
Condition Node (if intent == "billing")
  ├─ TRUE → API Call Node (fetch billing info)
  │            ↓
  │         LLM Node (format response with API data)
  │            ↓
  │         Return Response
  │
  └─ FALSE → Knowledge Base Search Node
                ↓
              LLM Node (answer with KB context)
                ↓
              Return Response
```

**Backend Processing:**

```python
# Complex graph execution
def process_chatflow_message(chatflow, message, session):
    # 1. Initialize execution context
    context = {
        "input": message,
        "variables": chatflow.config["variables"].copy(),
        "node_outputs": {}
    }

    # 2. Build execution graph
    graph = build_execution_graph(chatflow.config["nodes"], chatflow.config["edges"])

    # 3. Execute nodes in order (topological sort)
    current_node = "start"
    visited = set()

    while current_node:
        if current_node in visited:
            raise Exception("Circular dependency detected")

        visited.add(current_node)

        # Execute node
        node = get_node_by_id(current_node)
        output = execute_node(node, context)

        # Store output
        context["node_outputs"][current_node] = output

        # Determine next node
        if node["type"] == "if_else":
            # Conditional branching
            condition_result = evaluate_condition(node["data"]["condition"], context)
            if condition_result:
                current_node = node["data"]["true_branch"]
            else:
                current_node = node["data"]["false_branch"]
        else:
            # Follow edges
            next_edges = get_outgoing_edges(current_node)
            if next_edges:
                current_node = next_edges[0]["target"]
            else:
                current_node = None  # End of flow

    # 4. Return final output
    return context["node_outputs"].get("end", "No response generated")
```

---

### Side-by-Side Comparison

| Feature               | Chatbot                           | Chatflow                           |
| --------------------- | --------------------------------- | ---------------------------------- |
| **Creation Method**   | Form-based UI                     | Drag-and-drop visual editor        |
| **Complexity**        | Simple, linear                    | Complex, branching                 |
| **Configuration**     | Single JSON object                | Graph of nodes + edges             |
| **AI Calls**          | Single call per message           | Multiple calls (one per LLM node)  |
| **Logic Support**     | No conditionals/loops             | Full conditionals, loops, branches |
| **API Integration**   | No direct API calls               | HTTP Request nodes                 |
| **Knowledge Base**    | Single KB search                  | Multiple KB nodes in workflow      |
| **Variables**         | None                              | User-defined variables             |
| **Use Case**          | FAQ, simple Q&A                   | Multi-step workflows               |
| **Target Users**      | Non-technical                     | Technical / power users            |
| **Database Model**    | `chatbots` table                  | `chatflows` table                  |
| **Builder UI**        | `ChatbotBuilder.jsx`              | `ChatflowBuilder.jsx` (ReactFlow)  |
| **Execution Service** | `chatbot_service.py`              | `chatflow_service.py`              |
| **Deployment**        | Same (widget, API, Discord, etc.) | Same (widget, API, Discord, etc.)  |

---

### When to Use Which?

#### Use **Chatbot** When:

- You need a simple FAQ bot
- Single knowledge base search is enough
- No external API calls needed
- Linear conversation flow
- Non-technical users creating bots

#### Use **Chatflow** When:

- You need multi-step workflows
- Conditional logic required (if/else)
- External API integrations (CRM, payment, etc.)
- Multiple AI calls with different prompts
- Complex decision trees
- Technical users or developers

---

### Database Models

#### Chatbot Model

```python
class Chatbot(Base):
    __tablename__ = "chatbots"

    id: UUID
    name: str
    workspace_id: UUID
    config: JSONB  # Simple configuration
    created_at: datetime
    updated_at: datetime
```

#### Chatflow Model

```python
class Chatflow(Base):
    __tablename__ = "chatflows"

    id: UUID
    name: str
    workspace_id: UUID
    config: JSONB  # Complex: nodes + edges + variables
    version: int  # Track workflow versions
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

**KEY DIFFERENCE:** Separate tables, separate models, separate APIs.

---

## 3. The Complete Lifecycle {#lifecycle}

### Phase 1: Creation (Builder UI)

```
User → Dashboard → "Create Chatbot" → Configure Settings → Save
```

**What Happens:**

1. User fills form in React frontend
2. Frontend sends POST request to backend
3. Backend creates `Chatbot` record in database
4. Backend generates **API key** for this chatbot
5. Returns chatbot ID + API key to frontend

**Database Record Created:**

```json
{
  "id": "chatbot_uuid",
  "name": "Support Bot",
  "workspace_id": "workspace_uuid",
  "config": {
    "model": "secret-ai-v1",
    "temperature": 0.7,
    "system_prompt": "You are a helpful support assistant...",
    "knowledge_bases": [
      {
        "kb_id": "kb_uuid",
        "enabled": true,
        "override_retrieval": {
          "top_k": 5
        }
      }
    ]
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

**API Key Generated:**

```
sk_live_abc123def456ghi789...
```

### Phase 2: Configuration

**Settings Managed:**

1. **Model Settings** - Which AI model to use (Secret AI)
2. **System Prompt** - Bot personality and instructions
3. **Knowledge Bases** - Which KBs the bot can access
4. **Integrations** - Discord, Telegram, Slack connections
5. **Appearance** - Widget colors, avatar, name
6. **Behavior** - Response length, temperature, memory

**Where Settings Are Stored:**

- Backend database (`chatbots` table, `config` JSONB field)
- Changes sync immediately to all deployment channels

### Phase 3: Deployment

**User gets deployment options in dashboard:**

#### Option A: Website Embed

```html
<script src="https://cdn.privexbot.com/widget.js"></script>
<script>
  PrivexBot.init({
    botId: "chatbot_uuid",
    apiKey: "pk_live_abc123...",
  });
</script>
```

#### Option B: Discord Bot

- User connects Discord account
- Bot added to Discord server
- Backend sets up Discord webhook

#### Option C: API Access

```bash
curl -X POST https://api.privexbot.com/v1/chatbots/chatbot_uuid/chat \
  -H "Authorization: Bearer sk_live_abc123..." \
  -d '{"message": "Hello!"}'
```

### Phase 4: End User Interaction

**Flow:**

```
End User Types Message
  ↓
Widget/Discord/API sends to Backend
  ↓
Backend retrieves chatbot config
  ↓
Backend searches Knowledge Base (if configured)
  ↓
Backend sends context + message to Secret AI
  ↓
Secret AI generates response
  ↓
Backend saves chat history
  ↓
Response sent back to End User
```

---

## 3. Architecture Components {#architecture}

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S WEBSITE                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Embed Widget (JavaScript)                 │   │
│  │  - Chat UI (React or Vanilla JS)                  │   │
│  │  - Sends messages to Backend API                  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│              PRIVEXBOT BACKEND (Python)                  │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Public API Endpoints                            │    │
│  │  - POST /v1/chatbots/{id}/chat                   │    │
│  │  - GET  /v1/chatbots/{id}/history                │    │
│  │  - Authentication via API Key                     │    │
│  └─────────────────────────────────────────────────┘    │
│                        ↓                                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Chatbot Service (Core Logic)                    │    │
│  │  - Load chatbot config                            │    │
│  │  - Search Knowledge Base                          │    │
│  │  - Build context for AI                           │    │
│  │  - Call Secret AI                                 │    │
│  │  - Save chat history                              │    │
│  └─────────────────────────────────────────────────┘    │
│                        ↓                                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Secret AI Integration                            │    │
│  │  - POST to Secret AI API                          │    │
│  │  - Streaming responses                            │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                  SECRET AI API                           │
│  - Receives: system_prompt + context + user_message     │
│  - Returns: AI-generated response                        │
└─────────────────────────────────────────────────────────┘
```

### Three Core Components

#### 1. **Backend API** (Python FastAPI)

- **Purpose:** Central intelligence - handles all chatbot logic
- **Location:** `backend/src/app/`
- **Responsibilities:**
  - Authenticate API requests (API key validation)
  - Load chatbot configuration
  - Search Knowledge Base for relevant context
  - Call Secret AI with context
  - Store chat sessions and history
  - Handle multi-channel webhooks (Discord, Telegram, etc.)

#### 2. **Embed Widget** (JavaScript)

- **Purpose:** UI component for websites
- **Location:** `widget/` (separate package)
- **Responsibilities:**
  - Render chat UI (chat bubble, message list, input)
  - Send user messages to backend API
  - Display bot responses
  - Handle typing indicators, timestamps
  - **Does NOT contain AI logic** (just UI + API calls)

#### 3. **Dashboard Frontend** (React)

- **Purpose:** User creates/manages chatbots
- **Location:** `frontend/src/`
- **Responsibilities:**
  - Chatbot builder UI
  - Settings management
  - Deployment code generation
  - Analytics/usage dashboard

---

## 4. Secret AI Integration {#secret-ai}

### Where Does Secret AI Fit?

**Secret AI is integrated in the BACKEND, not the widget.**

**Why?**

- Security: API keys stay on backend (never exposed to users)
- Centralized: All channels (website, Discord, API) use same logic
- Consistency: Single source of truth for AI responses

### Integration Architecture

```python
# backend/src/app/services/inference_service.py

class InferenceService:
    """
    WHY: Abstraction layer for Secret AI
    HOW: Call Secret AI API with chatbot config
    """

    def __init__(self):
        self.secret_ai_base_url = "https://api.secret.ai/v1"
        self.api_key = os.getenv("SECRET_AI_API_KEY")

    def generate_response(
        self,
        chatbot: Chatbot,
        user_message: str,
        context: str = None,
        chat_history: list = None
    ) -> str:
        """
        Generate AI response for chatbot query.

        WHY: Centralized inference logic
        HOW: Build prompt + call Secret AI
        """

        # 1. Build system prompt from chatbot config
        system_prompt = chatbot.config["system_prompt"]

        # 2. Add knowledge base context (if available)
        if context:
            system_prompt += f"\n\nRelevant information:\n{context}"

        # 3. Format chat history
        messages = []
        if chat_history:
            for msg in chat_history[-10:]:  # Last 10 messages
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })

        # 4. Add current user message
        messages.append({
            "role": "user",
            "content": user_message
        })

        # 5. Call Secret AI API
        response = requests.post(
            f"{self.secret_ai_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": chatbot.config["model"],  # e.g., "secret-ai-v1"
                "messages": [
                    {"role": "system", "content": system_prompt},
                    *messages
                ],
                "temperature": chatbot.config.get("temperature", 0.7),
                "max_tokens": chatbot.config.get("max_tokens", 500)
            }
        )

        response.raise_for_status()
        data = response.json()

        return data["choices"][0]["message"]["content"]
```

### RAG (Knowledge Base) Flow

```python
# backend/src/app/services/chatbot_service.py

def process_message(chatbot_id: UUID, message: str, session_id: str):
    """
    Process user message through chatbot.

    FLOW:
    1. Load chatbot config
    2. Search Knowledge Base (if configured)
    3. Build context
    4. Call Secret AI
    5. Save to chat history
    6. Return response
    """

    # 1. Load chatbot
    chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()

    # 2. Search Knowledge Base
    context = None
    if chatbot.config.get("knowledge_bases"):
        kb_config = chatbot.config["knowledge_bases"][0]
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_config["kb_id"]
        ).first()

        # Generate embedding for user query
        query_embedding = embedding_service.embed_text(kb, message)

        # Search vector store
        results = vector_store_service.search(
            kb=kb,
            query_embedding=query_embedding,
            filters={},
            top_k=kb_config["override_retrieval"].get("top_k", 5)
        )

        # Build context from results
        context = "\n\n".join([
            f"Source: {r['metadata']['document_name']}\n{r['metadata']['content']}"
            for r in results
        ])

    # 3. Get chat history
    chat_history = get_session_history(session_id)

    # 4. Generate response using Secret AI
    response = inference_service.generate_response(
        chatbot=chatbot,
        user_message=message,
        context=context,
        chat_history=chat_history
    )

    # 5. Save to history
    save_message(session_id, role="user", content=message)
    save_message(session_id, role="assistant", content=response)

    # 6. Return
    return {
        "response": response,
        "sources": [r["metadata"]["document_name"] for r in results] if context else []
    }
```

---

## 6. Chatflow Node System {#chatflow-nodes}

### Overview

The Chatflow node system is the **core differentiator** between chatbots and chatflows. It's a **visual workflow engine** similar to n8n, Dify, or Flowise.

**Key Components:**

1. **Node Types** - Different node categories (LLM, condition, API, etc.)
2. **Node Executor** - Backend service that runs nodes
3. **Credential Manager** - Secure storage for API keys/tokens
4. **Variable System** - Pass data between nodes
5. **Execution Engine** - Graph traversal and execution order

---

### Node Type Categories

#### 1. **Trigger Nodes**

**Start Node**

```json
{
  "id": "start",
  "type": "trigger",
  "data": {
    "description": "Workflow entry point"
  }
}
```

**Purpose:** Entry point for every chatflow execution.

**Webhook Trigger Node**

```json
{
  "id": "webhook_trigger",
  "type": "webhook_trigger",
  "data": {
    "method": "POST",
    "path": "/webhook/custom_endpoint",
    "auth": "api_key"
  }
}
```

**Purpose:** Trigger workflow from external systems.

---

#### 2. **LLM (Language Model) Nodes**

**Secret AI Node**

```json
{
  "id": "llm_secretai",
  "type": "llm",
  "data": {
    "provider": "secret_ai",
    "model": "secret-ai-v1",
    "prompt": "Extract user intent from: {{input}}",
    "temperature": 0.3,
    "max_tokens": 500,
    "system_message": "You are an intent classification expert."
  }
}
```

**Purpose:** Call Secret AI (or other LLM providers).

**Output:** Text response stored in variable.

**OpenAI Node**

```json
{
  "id": "llm_openai",
  "type": "llm",
  "data": {
    "provider": "openai",
    "model": "gpt-4",
    "prompt": "{{input}}",
    "temperature": 0.7,
    "credentials_id": "openai_cred_uuid"
  }
}
```

**Purpose:** Use OpenAI models (requires user's OpenAI API key).

---

#### 3. **Knowledge Base Nodes**

**KB Search Node**

```json
{
  "id": "kb_search",
  "type": "knowledge_base",
  "data": {
    "kb_id": "uuid",
    "query": "{{user_message}}",
    "top_k": 5,
    "similarity_threshold": 0.7,
    "search_method": "hybrid"
  }
}
```

**Purpose:** Search Knowledge Base for relevant chunks.

**Output:**

```json
{
  "results": [
    {
      "content": "chunk text...",
      "document": "FAQ.pdf",
      "page": 5,
      "score": 0.89
    }
  ],
  "formatted": "Source 1: ...\nSource 2: ..."
}
```

---

#### 4. **Condition Nodes**

**If/Else Node**

```json
{
  "id": "condition1",
  "type": "if_else",
  "data": {
    "condition": "{{llm1.output}}.includes('billing')",
    "description": "Check if user intent is billing"
  }
}
```

**Purpose:** Branch workflow based on condition.

**Outputs:** Two edges - one for `true`, one for `false`.

**Switch Node**

```json
{
  "id": "switch1",
  "type": "switch",
  "data": {
    "variable": "{{user_intent}}",
    "cases": [
      { "value": "billing", "target": "billing_flow" },
      { "value": "support", "target": "support_flow" },
      { "value": "sales", "target": "sales_flow" }
    ],
    "default": "fallback_flow"
  }
}
```

**Purpose:** Multi-way branching (like switch/case statement).

---

#### 5. **API/Integration Nodes**

**HTTP Request Node**

```json
{
  "id": "api_call",
  "type": "http_request",
  "data": {
    "method": "GET",
    "url": "https://api.stripe.com/v1/customers/{{user_id}}",
    "headers": {
      "Authorization": "Bearer {{credentials.stripe_api_key}}",
      "Content-Type": "application/json"
    },
    "params": {
      "limit": "10"
    },
    "body": null,
    "timeout": 30
  }
}
```

**Purpose:** Call external APIs (Stripe, HubSpot, custom APIs).

**Output:** API response stored in variable.

**Discord Send Message Node**

```json
{
  "id": "discord_send",
  "type": "discord_send",
  "data": {
    "channel_id": "{{discord_channel}}",
    "message": "{{llm_response}}",
    "credentials_id": "discord_cred_uuid"
  }
}
```

**Purpose:** Send message to Discord channel.

**Slack Send Message Node**

```json
{
  "id": "slack_send",
  "type": "slack_send",
  "data": {
    "channel": "#support",
    "message": "New ticket: {{user_message}}",
    "credentials_id": "slack_cred_uuid"
  }
}
```

**Purpose:** Send message to Slack channel.

---

#### 6. **Data Transformation Nodes**

**Set Variable Node**

```json
{
  "id": "set_var",
  "type": "set_variable",
  "data": {
    "variables": {
      "user_name": "{{extract_name(input)}}",
      "ticket_id": "{{generate_ticket_id()}}",
      "timestamp": "{{now()}}"
    }
  }
}
```

**Purpose:** Set/update workflow variables.

**Code Node** (JavaScript/Python)

```json
{
  "id": "code_transform",
  "type": "code",
  "data": {
    "language": "javascript",
    "code": "return { result: input.toLowerCase().trim() };",
    "input": "{{user_message}}"
  }
}
```

**Purpose:** Custom data transformation logic.

**JSON Parser Node**

```json
{
  "id": "json_parse",
  "type": "json_parser",
  "data": {
    "input": "{{api_response}}",
    "extract": ["data.customer.email", "data.customer.name"]
  }
}
```

**Purpose:** Parse and extract from JSON responses.

---

#### 7. **Memory/State Nodes**

**Save to Memory Node**

```json
{
  "id": "save_memory",
  "type": "save_memory",
  "data": {
    "key": "user_context",
    "value": {
      "name": "{{user_name}}",
      "last_query": "{{input}}",
      "intent": "{{llm_intent}}"
    },
    "ttl": 3600
  }
}
```

**Purpose:** Store data for later use in conversation.

**Load from Memory Node**

```json
{
  "id": "load_memory",
  "type": "load_memory",
  "data": {
    "key": "user_context"
  }
}
```

**Purpose:** Retrieve previously stored data.

---

#### 8. **Database Nodes**

**Database Query Node**

```json
{
  "id": "db_query",
  "type": "database_query",
  "data": {
    "credentials_id": "postgres_cred_uuid",
    "query": "SELECT * FROM customers WHERE email = $1",
    "params": ["{{user_email}}"]
  }
}
```

**Purpose:** Query external databases (PostgreSQL, MySQL, MongoDB).

**Database Insert Node**

```json
{
  "id": "db_insert",
  "type": "database_insert",
  "data": {
    "credentials_id": "mongo_cred_uuid",
    "collection": "chat_logs",
    "document": {
      "user_id": "{{user_id}}",
      "message": "{{input}}",
      "response": "{{llm_output}}",
      "timestamp": "{{now()}}"
    }
  }
}
```

**Purpose:** Insert data into external databases.

---

#### 9. **Loop Nodes**

**For Each Node**

```json
{
  "id": "loop_items",
  "type": "for_each",
  "data": {
    "items": "{{kb_search.results}}",
    "item_variable": "current_item",
    "max_iterations": 10
  }
}
```

**Purpose:** Iterate over array of items.

**Output:** Executes child nodes for each item.

---

#### 10. **Output Nodes**

**Response Node**

```json
{
  "id": "end",
  "type": "response",
  "data": {
    "message": "{{llm_final_response}}",
    "metadata": {
      "sources": "{{kb_search.results}}",
      "execution_time_ms": "{{execution_time}}"
    }
  }
}
```

**Purpose:** Return final response to user.

---

### Credential Management

**Purpose:** Securely store API keys, tokens, and passwords for nodes.

#### Credential Model

```python
# backend/src/app/models/credential.py

class Credential(Base):
    """
    Secure storage for API keys and tokens used in chatflow nodes.

    WHY: Nodes need external API access (Stripe, Discord, databases)
    HOW: Encrypted storage, workspace-scoped
    """

    __tablename__ = "credentials"

    id: UUID
    workspace_id: UUID
    name: str  # e.g., "Stripe API Key", "Discord Bot Token"
    type: str  # "api_key", "oauth2", "basic_auth", "database"

    # Encrypted credentials
    encrypted_data: text
        WHY: Never store credentials in plain text
        HOW: AES encryption with workspace-specific key

    # Metadata
    provider: str  # "stripe", "openai", "discord", "postgres"
    created_by: UUID
    created_at: datetime
    last_used_at: datetime
```

#### Credential Storage

```python
# backend/src/app/services/credential_service.py

class CredentialService:
    """
    Manage credentials for chatflow nodes.
    """

    def create_credential(
        self,
        workspace_id: UUID,
        name: str,
        type: str,
        provider: str,
        data: dict
    ) -> Credential:
        """
        Store encrypted credential.

        EXAMPLE:
        {
          "api_key": "sk_live_abc123...",
          "api_secret": "secret_xyz..."
        }
        """

        # Encrypt
        encrypted = encrypt_with_workspace_key(workspace_id, json.dumps(data))

        credential = Credential(
            workspace_id=workspace_id,
            name=name,
            type=type,
            provider=provider,
            encrypted_data=encrypted
        )
        db.add(credential)
        db.commit()

        return credential

    def get_credential(self, credential_id: UUID) -> dict:
        """
        Retrieve and decrypt credential.
        """

        credential = db.query(Credential).filter(
            Credential.id == credential_id
        ).first()

        # Decrypt
        decrypted = decrypt_with_workspace_key(
            credential.workspace_id,
            credential.encrypted_data
        )

        return json.loads(decrypted)
```

#### Using Credentials in Nodes

```json
// Node configuration references credential
{
  "id": "stripe_api",
  "type": "http_request",
  "data": {
    "url": "https://api.stripe.com/v1/customers",
    "headers": {
      "Authorization": "Bearer {{credentials.stripe_api_key}}"
    },
    "credentials_id": "cred_uuid"
  }
}
```

**Backend resolves credential at runtime:**

```python
def execute_http_request_node(node, context):
    # Resolve credential
    if "credentials_id" in node["data"]:
        cred = credential_service.get_credential(node["data"]["credentials_id"])
        context["credentials"] = cred

    # Replace template variables
    url = replace_variables(node["data"]["url"], context)
    headers = replace_variables(node["data"]["headers"], context)

    # Make request
    response = requests.request(
        method=node["data"]["method"],
        url=url,
        headers=headers
    )

    return response.json()
```

---

### Variable System

**Purpose:** Pass data between nodes.

**Types:**

1. **Input Variables** - Provided by user (e.g., `{{input}}`)
2. **Node Outputs** - Results from nodes (e.g., `{{llm1.output}}`)
3. **Workflow Variables** - Set by Set Variable nodes (e.g., `{{user_name}}`)
4. **System Variables** - Built-in (e.g., `{{now()}}`, `{{session_id}}`)

#### Template Syntax

```
{{variable_name}}           # Simple variable
{{node_id.output}}          # Node output
{{node_id.data.field}}      # Nested field
{{credentials.api_key}}     # Credential field
{{now()}}                   # Function call
{{user_name || "Guest"}}    # Default value
```

#### Variable Resolution

```python
# backend/src/app/services/chatflow_executor.py

def replace_variables(template: str, context: dict) -> str:
    """
    Replace {{variable}} placeholders with actual values.

    CONTEXT:
    {
      "input": "user message",
      "variables": {"user_name": "John"},
      "node_outputs": {
        "llm1": {"output": "billing"}
      },
      "credentials": {"api_key": "sk_..."}
    }
    """

    import re

    def replace_match(match):
        var_path = match.group(1).strip()

        # Handle functions
        if var_path.endswith("()"):
            func_name = var_path[:-2]
            if func_name == "now":
                return datetime.utcnow().isoformat()
            elif func_name == "uuid":
                return str(uuid.uuid4())

        # Handle default values
        if "||" in var_path:
            var_path, default = var_path.split("||")
            var_path = var_path.strip()
            default = default.strip().strip('"\'')
        else:
            default = None

        # Resolve path
        parts = var_path.split(".")
        value = context

        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                value = None
                break

        return str(value) if value is not None else (default or "")

    return re.sub(r'\{\{(.+?)\}\}', replace_match, template)
```

---

### Execution Engine

**Purpose:** Execute chatflow graph in correct order.

```python
# backend/src/app/services/chatflow_executor.py

class ChatflowExecutor:
    """
    Execute chatflow workflow graph.

    ALGORITHM:
    1. Build execution graph from nodes + edges
    2. Topological sort for execution order
    3. Execute nodes one by one
    4. Handle branching (if/else, switch)
    5. Handle loops (for_each)
    6. Return final output
    """

    def execute(
        self,
        chatflow: Chatflow,
        input_message: str,
        session_id: str
    ) -> dict:
        """
        Execute chatflow for user message.
        """

        # 1. Initialize context
        context = {
            "input": input_message,
            "session_id": session_id,
            "variables": chatflow.config["variables"].copy(),
            "node_outputs": {},
            "credentials": {}
        }

        # 2. Build graph
        graph = self.build_graph(
            chatflow.config["nodes"],
            chatflow.config["edges"]
        )

        # 3. Find start node
        current_node_id = self.find_start_node(graph)

        # 4. Execute graph
        visited = set()
        execution_log = []

        while current_node_id:
            # Prevent infinite loops
            if len(visited) > chatflow.config["settings"]["max_iterations"]:
                raise Exception("Max iterations exceeded")

            # Get node
            node = self.get_node_by_id(chatflow, current_node_id)

            # Execute node
            start_time = time.time()
            output = self.execute_node(node, context, chatflow)
            execution_time = int((time.time() - start_time) * 1000)

            # Store output
            context["node_outputs"][current_node_id] = output

            # Log execution
            execution_log.append({
                "node_id": current_node_id,
                "node_type": node["type"],
                "execution_time_ms": execution_time,
                "output": output
            })

            visited.add(current_node_id)

            # Determine next node
            current_node_id = self.get_next_node(
                node=node,
                output=output,
                graph=graph,
                context=context
            )

        # 5. Return final output
        return {
            "response": context["node_outputs"].get("end", {}).get("message", "No response"),
            "execution_log": execution_log,
            "variables": context["variables"]
        }

    def execute_node(
        self,
        node: dict,
        context: dict,
        chatflow: Chatflow
    ) -> dict:
        """
        Execute single node based on type.
        """

        node_type = node["type"]

        if node_type == "trigger":
            return {"triggered": True}

        elif node_type == "llm":
            return self.execute_llm_node(node, context)

        elif node_type == "knowledge_base":
            return self.execute_kb_node(node, context, chatflow)

        elif node_type == "if_else":
            return self.execute_condition_node(node, context)

        elif node_type == "http_request":
            return self.execute_http_node(node, context)

        elif node_type == "set_variable":
            return self.execute_set_variable_node(node, context)

        elif node_type == "code":
            return self.execute_code_node(node, context)

        elif node_type == "response":
            return self.execute_response_node(node, context)

        else:
            raise Exception(f"Unknown node type: {node_type}")

    def execute_llm_node(self, node: dict, context: dict) -> dict:
        """
        Execute LLM node.
        """

        # Replace variables in prompt
        prompt = replace_variables(node["data"]["prompt"], context)
        system_message = replace_variables(
            node["data"].get("system_message", ""),
            context
        )

        # Call LLM
        if node["data"]["provider"] == "secret_ai":
            response = inference_service.call_secret_ai(
                model=node["data"]["model"],
                prompt=prompt,
                system_message=system_message,
                temperature=node["data"].get("temperature", 0.7),
                max_tokens=node["data"].get("max_tokens", 500)
            )
        elif node["data"]["provider"] == "openai":
            # Load credentials
            cred = credential_service.get_credential(node["data"]["credentials_id"])
            response = openai_client.chat(
                api_key=cred["api_key"],
                model=node["data"]["model"],
                prompt=prompt
            )

        return {"output": response}

    def execute_kb_node(
        self,
        node: dict,
        context: dict,
        chatflow: Chatflow
    ) -> dict:
        """
        Execute Knowledge Base search node.
        """

        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == node["data"]["kb_id"]
        ).first()

        # Replace variables in query
        query = replace_variables(node["data"]["query"], context)

        # Generate embedding
        query_embedding = embedding_service.embed_text(kb, query)

        # Search
        results = vector_store_service.search(
            kb=kb,
            query_embedding=query_embedding,
            filters={},
            top_k=node["data"]["top_k"]
        )

        # Format results
        formatted = "\n\n".join([
            f"[Source: {r['metadata']['document_name']}]\n{r['metadata']['content']}"
            for r in results
        ])

        return {
            "results": results,
            "formatted": formatted
        }

    def execute_http_node(self, node: dict, context: dict) -> dict:
        """
        Execute HTTP request node.
        """

        # Load credentials if needed
        if "credentials_id" in node["data"]:
            cred = credential_service.get_credential(node["data"]["credentials_id"])
            context["credentials"] = cred

        # Replace variables
        url = replace_variables(node["data"]["url"], context)
        headers = replace_variables(node["data"]["headers"], context)
        body = replace_variables(node["data"].get("body"), context)

        # Make request
        response = requests.request(
            method=node["data"]["method"],
            url=url,
            headers=headers,
            json=json.loads(body) if body else None,
            timeout=node["data"].get("timeout", 30)
        )

        return {
            "status_code": response.status_code,
            "body": response.json() if response.headers.get("content-type") == "application/json" else response.text,
            "headers": dict(response.headers)
        }

    def get_next_node(
        self,
        node: dict,
        output: dict,
        graph: dict,
        context: dict
    ) -> str | None:
        """
        Determine next node to execute.
        """

        # If/Else node
        if node["type"] == "if_else":
            condition = replace_variables(node["data"]["condition"], context)
            condition_result = eval(condition)  # CAUTION: Use safe eval in production

            if condition_result:
                # Follow true branch
                return self.find_edge_target(graph, node["id"], condition="true")
            else:
                # Follow false branch
                return self.find_edge_target(graph, node["id"], condition="false")

        # Switch node
        elif node["type"] == "switch":
            variable = replace_variables(node["data"]["variable"], context)

            for case in node["data"]["cases"]:
                if variable == case["value"]:
                    return case["target"]

            return node["data"]["default"]

        # Response node (end)
        elif node["type"] == "response":
            return None

        # Regular node - follow edge
        else:
            edges = graph["edges"].get(node["id"], [])
            if edges:
                return edges[0]["target"]
            else:
                return None
```

---

## 5. Website Embed Widget {#embed-widget}

### Widget Architecture

**The widget is a SEPARATE JavaScript package**, not part of the main React frontend.

**Why?**

- Lightweight (users embed on their sites)
- Framework-agnostic (works on any website)
- No React dependencies needed

### Widget Structure

```
widget/
├── src/
│   ├── index.js              # Main entry point
│   ├── ui/
│   │   ├── ChatBubble.js     # Floating chat button
│   │   ├── ChatWindow.js     # Chat interface
│   │   ├── MessageList.js    # Display messages
│   │   └── styles.css        # Widget styles
│   └── api/
│       └── client.js         # Backend API calls
├── build/
│   └── widget.js             # Compiled bundle
└── package.json
```

### Widget Implementation

```javascript
// widget/src/index.js

(function (window) {
  "use strict";

  const PrivexBot = {
    config: null,
    chatWindow: null,
    sessionId: null,

    /**
     * Initialize widget
     *
     * @param {Object} config
     * @param {string} config.botId - Chatbot UUID
     * @param {string} config.apiKey - Public API key (pk_live_...)
     * @param {Object} config.options - Optional customization
     */
    init(config) {
      this.config = config;
      this.sessionId = this.getOrCreateSession();

      // Create chat bubble
      this.createChatBubble();

      // Load chat history
      this.loadHistory();
    },

    createChatBubble() {
      // Create floating chat button
      const bubble = document.createElement("div");
      bubble.id = "privexbot-bubble";
      bubble.innerHTML = `
        <button class="privexbot-bubble-btn">
          <svg><!-- Chat icon --></svg>
        </button>
      `;

      bubble.onclick = () => this.toggleChat();
      document.body.appendChild(bubble);
    },

    toggleChat() {
      if (this.chatWindow) {
        this.chatWindow.style.display =
          this.chatWindow.style.display === "none" ? "block" : "none";
      } else {
        this.createChatWindow();
      }
    },

    createChatWindow() {
      // Create chat UI
      const chatWindow = document.createElement("div");
      chatWindow.id = "privexbot-window";
      chatWindow.innerHTML = `
        <div class="privexbot-header">
          <span>Support Chat</span>
          <button onclick="PrivexBot.toggleChat()">×</button>
        </div>
        <div class="privexbot-messages" id="privexbot-messages"></div>
        <div class="privexbot-input">
          <input type="text" placeholder="Type your message..."
                 id="privexbot-input" />
          <button onclick="PrivexBot.sendMessage()">Send</button>
        </div>
      `;

      document.body.appendChild(chatWindow);
      this.chatWindow = chatWindow;
    },

    async sendMessage() {
      const input = document.getElementById("privexbot-input");
      const message = input.value.trim();
      if (!message) return;

      // Display user message
      this.appendMessage("user", message);
      input.value = "";

      // Show typing indicator
      this.showTyping();

      try {
        // Call backend API
        const response = await fetch(
          `https://api.privexbot.com/v1/chatbots/${this.config.botId}/chat`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: message,
              session_id: this.sessionId,
            }),
          }
        );

        const data = await response.json();

        // Hide typing indicator
        this.hideTyping();

        // Display bot response
        this.appendMessage("assistant", data.response);
      } catch (error) {
        console.error("Privexbot error:", error);
        this.hideTyping();
        this.appendMessage("assistant", "Sorry, something went wrong.");
      }
    },

    appendMessage(role, content) {
      const messagesDiv = document.getElementById("privexbot-messages");
      const messageDiv = document.createElement("div");
      messageDiv.className = `privexbot-message privexbot-message-${role}`;
      messageDiv.textContent = content;
      messagesDiv.appendChild(messageDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    },

    getOrCreateSession() {
      // Check localStorage for existing session
      let sessionId = localStorage.getItem("privexbot_session");
      if (!sessionId) {
        sessionId = "session_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem("privexbot_session", sessionId);
      }
      return sessionId;
    },

    async loadHistory() {
      // Load previous chat history from backend
      try {
        const response = await fetch(
          `https://api.privexbot.com/v1/sessions/${this.sessionId}/history`,
          {
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
            },
          }
        );

        const data = await response.json();
        data.messages.forEach((msg) => {
          this.appendMessage(msg.role, msg.content);
        });
      } catch (error) {
        console.log("No previous history");
      }
    },
  };

  // Expose globally
  window.PrivexBot = PrivexBot;
})(window);
```

### How Users Embed It

**Step 1:** User creates chatbot in dashboard

**Step 2:** Dashboard generates embed code:

```html
<!-- Add this to your website's HTML -->
<script src="https://cdn.privexbot.com/widget.js"></script>
<script>
  PrivexBot.init({
    botId: "abc-123-def-456",
    apiKey: "pk_live_xyz789...",
    options: {
      position: "bottom-right",
      primaryColor: "#007bff",
      greeting: "Hi! How can I help you today?",
    },
  });
</script>
```

**Step 3:** User copies code to their website

**Step 4:** Widget loads and connects to backend API

---

## 6. Multi-Channel Deployment {#multi-channel}

### Discord Bot Integration

```python
# backend/src/app/integrations/discord_integration.py

class DiscordIntegration:
    """
    WHY: Connect chatbot to Discord
    HOW: Discord webhook → Backend → Secret AI → Discord
    """

    def connect_bot(self, chatbot_id: UUID, discord_token: str):
        """
        Connect chatbot to Discord server.

        FLOW:
        1. User provides Discord bot token
        2. Backend registers webhook with Discord
        3. Discord messages forwarded to our backend
        4. Backend processes via chatbot logic
        5. Response sent back to Discord
        """

        # Store Discord credentials
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        chatbot.config["integrations"] = chatbot.config.get("integrations", {})
        chatbot.config["integrations"]["discord"] = {
            "token": encrypt(discord_token),
            "enabled": True,
            "webhook_url": f"https://api.privexbot.com/webhooks/discord/{chatbot_id}"
        }
        db.commit()

        # Register with Discord
        discord_client = DiscordClient(token=discord_token)
        discord_client.set_webhook(chatbot.config["integrations"]["discord"]["webhook_url"])

    async def handle_webhook(self, chatbot_id: UUID, discord_message: dict):
        """
        Handle incoming Discord message.

        WHY: Discord user sends message → Bot responds
        HOW: Use same chatbot logic as website widget
        """

        # Extract message
        user_message = discord_message["content"]
        discord_user_id = discord_message["author"]["id"]
        channel_id = discord_message["channel_id"]

        # Create session ID from Discord user ID
        session_id = f"discord_{discord_user_id}"

        # Process through chatbot service
        response = await chatbot_service.process_message(
            chatbot_id=chatbot_id,
            message=user_message,
            session_id=session_id
        )

        # Send response back to Discord
        await self.send_discord_message(
            channel_id=channel_id,
            content=response["response"]
        )
```

### Telegram Bot Integration

```python
# backend/src/app/integrations/telegram_integration.py

class TelegramIntegration:
    """
    WHY: Connect chatbot to Telegram
    HOW: Similar to Discord - webhook pattern
    """

    def connect_bot(self, chatbot_id: UUID, telegram_token: str):
        # Store credentials
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        chatbot.config["integrations"]["telegram"] = {
            "token": encrypt(telegram_token),
            "enabled": True
        }
        db.commit()

        # Set Telegram webhook
        requests.post(
            f"https://api.telegram.org/bot{telegram_token}/setWebhook",
            json={
                "url": f"https://api.privexbot.com/webhooks/telegram/{chatbot_id}"
            }
        )

    async def handle_webhook(self, chatbot_id: UUID, update: dict):
        # Extract message
        message = update["message"]
        user_message = message["text"]
        telegram_user_id = message["from"]["id"]
        chat_id = message["chat"]["id"]

        # Process
        session_id = f"telegram_{telegram_user_id}"
        response = await chatbot_service.process_message(
            chatbot_id=chatbot_id,
            message=user_message,
            session_id=session_id
        )

        # Send response
        requests.post(
            f"https://api.telegram.org/bot{telegram_token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": response["response"]
            }
        )
```

### WhatsApp Integration (via Twilio)

```python
# backend/src/app/integrations/whatsapp_integration.py

class WhatsAppIntegration:
    """
    WHY: Connect chatbot to WhatsApp
    HOW: Twilio WhatsApp API
    """

    def connect_bot(self, chatbot_id: UUID, twilio_config: dict):
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        chatbot.config["integrations"]["whatsapp"] = {
            "account_sid": twilio_config["account_sid"],
            "auth_token": encrypt(twilio_config["auth_token"]),
            "phone_number": twilio_config["phone_number"],
            "enabled": True
        }
        db.commit()

    async def handle_webhook(self, chatbot_id: UUID, twilio_message: dict):
        # Extract
        user_message = twilio_message["Body"]
        whatsapp_number = twilio_message["From"]

        # Process
        session_id = f"whatsapp_{whatsapp_number}"
        response = await chatbot_service.process_message(
            chatbot_id=chatbot_id,
            message=user_message,
            session_id=session_id
        )

        # Send via Twilio
        twilio_client = TwilioClient(account_sid, auth_token)
        twilio_client.messages.create(
            from_=f"whatsapp:{chatbot.config['integrations']['whatsapp']['phone_number']}",
            to=whatsapp_number,
            body=response["response"]
        )
```

### Zapier Integration

```python
# backend/src/app/integrations/zapier_integration.py

"""
Zapier Integration

WHY: Allow users to use chatbot in Zapier workflows
HOW: Zapier polls our API for new triggers / calls our API for actions

SETUP:
1. We create Zapier app definition
2. Zapier users connect via API key
3. Zapier can:
   - TRIGGER: When new chat message received
   - ACTION: Send message to chatbot
"""

# Zapier Trigger: New Message
@router.get("/zapier/triggers/new-message")
def zapier_new_message_trigger(
    chatbot_id: UUID,
    api_key: str,
    since: datetime = None
):
    """
    Zapier polls this endpoint for new messages.
    Returns recent chat messages.
    """
    authenticate_api_key(api_key)

    # Get recent messages
    messages = db.query(ChatMessage).filter(
        ChatMessage.chatbot_id == chatbot_id,
        ChatMessage.role == "user",
        ChatMessage.created_at > (since or datetime.utcnow() - timedelta(minutes=5))
    ).all()

    return [
        {
            "id": msg.id,
            "message": msg.content,
            "session_id": msg.session_id,
            "created_at": msg.created_at
        }
        for msg in messages
    ]

# Zapier Action: Send Message
@router.post("/zapier/actions/send-message")
async def zapier_send_message_action(
    chatbot_id: UUID,
    message: str,
    session_id: str = None,
    api_key: str = None
):
    """
    Zapier calls this to send message to chatbot.
    Returns bot's response.
    """
    authenticate_api_key(api_key)

    session_id = session_id or f"zapier_{uuid.uuid4()}"

    response = await chatbot_service.process_message(
        chatbot_id=chatbot_id,
        message=message,
        session_id=session_id
    )

    return {
        "response": response["response"],
        "session_id": session_id
    }
```

---

## 7. Chat Sessions & History {#chat-sessions}

### Chat Session Model

```python
# backend/src/app/models/chat_session.py

class ChatSession(Base):
    """
    Chat session - conversation between user and chatbot/chatflow.

    WHY: Track conversations across channels for BOTH chatbots and chatflows
    HOW: Session ID identifies conversation, bot_type distinguishes chatbot vs chatflow
    """

    __tablename__ = "chat_sessions"

    id: UUID
    bot_id: UUID  # Chatbot ID or Chatflow ID
    bot_type: str  # "chatbot" or "chatflow"
    session_id: str  # External session ID
    channel: str  # "website", "discord", "telegram", etc.
    user_identifier: str  # Discord user ID, IP address, etc.

    NOTE: bot_type determines which table to join
          - bot_type="chatbot" → join chatbots table
          - bot_type="chatflow" → join chatflows table

    # Metadata
    started_at: datetime
    last_message_at: datetime
    message_count: int
    is_active: bool

    # Relationships
    messages: list[ChatMessage]  # All messages in session

class ChatMessage(Base):
    """
    Individual message in chat session.
    """

    __tablename__ = "chat_messages"

    id: UUID
    session_id: UUID  # Foreign key -> chat_sessions.id
    bot_id: UUID  # Chatbot ID or Chatflow ID
    bot_type: str  # "chatbot" or "chatflow"

    role: str  # "user" or "assistant"
    content: text  # Message text

    # RAG sources (if knowledge base used)
    sources: JSONB  # List of document chunks used

    # Chatflow execution log (if chatflow)
    execution_log: JSONB | None  # Node execution details for chatflows

    # Metadata
    tokens_used: int  # For billing
    response_time_ms: int  # Performance tracking
    created_at: datetime
```

### Session Management

```python
# backend/src/app/services/session_service.py

class SessionService:
    """
    Manage chat sessions and history.
    """

    def get_or_create_session(
        self,
        chatbot_id: UUID,
        session_id: str,
        channel: str,
        user_identifier: str = None
    ) -> ChatSession:
        """
        Get existing session or create new one.

        WHY: Maintain conversation context
        HOW: Session ID tracks conversation
        """

        session = db.query(ChatSession).filter(
            ChatSession.chatbot_id == chatbot_id,
            ChatSession.session_id == session_id
        ).first()

        if not session:
            session = ChatSession(
                chatbot_id=chatbot_id,
                session_id=session_id,
                channel=channel,
                user_identifier=user_identifier,
                started_at=datetime.utcnow(),
                is_active=True
            )
            db.add(session)
            db.commit()

        return session

    def save_message(
        self,
        session: ChatSession,
        role: str,
        content: str,
        sources: list = None,
        tokens_used: int = 0
    ):
        """
        Save message to session history.
        """

        message = ChatMessage(
            session_id=session.id,
            chatbot_id=session.chatbot_id,
            role=role,
            content=content,
            sources=sources,
            tokens_used=tokens_used,
            created_at=datetime.utcnow()
        )
        db.add(message)

        # Update session
        session.last_message_at = datetime.utcnow()
        session.message_count += 1

        db.commit()

    def get_session_history(
        self,
        session: ChatSession,
        limit: int = 20
    ) -> list[ChatMessage]:
        """
        Get recent messages from session.

        WHY: Provide context to Secret AI
        HOW: Return last N messages
        """

        return db.query(ChatMessage).filter(
            ChatMessage.session_id == session.id
        ).order_by(ChatMessage.created_at.desc()).limit(limit).all()
```

---

## 8. Folder Structure {#folder-structure}

### Complete Project Structure

```
privexbot/
├── backend/                          # Python FastAPI backend
│   ├── src/
│   │   └── app/
│   │       ├── main.py              # FastAPI app entry
│   │       ├── api/v1/
│   │       │   ├── routes/
│   │       │   │   ├── auth.py      # Auth endpoints
│   │       │   │   ├── chatbots.py  # Chatbot CRUD (form-based bots)
│   │       │   │   ├── chatflows.py # Chatflow CRUD (workflow bots)
│   │       │   │   ├── credentials.py  # NEW - Credential management for chatflow nodes
│   │       │   │   ├── knowledge_bases.py
│   │       │   │   ├── documents.py
│   │       │   │   ├── chunks.py
│   │       │   │   └── public.py    # Public API (for widgets, handles BOTH)
│   │       │   └── webhooks/
│   │       │       ├── discord.py   # Discord webhook handler
│   │       │       ├── telegram.py  # Telegram webhook handler
│   │       │       └── whatsapp.py  # WhatsApp webhook handler
│   │       ├── models/              # Database models (SEPARATE tables)
│   │       │   ├── chatbot.py       # Simple chatbot model
│   │       │   ├── chatflow.py      # Complex chatflow model
│   │       │   ├── credential.py    # NEW - For chatflow node credentials
│   │       │   ├── chat_session.py  # NEW - Works for BOTH chatbot & chatflow
│   │       │   ├── chat_message.py  # NEW - Works for BOTH chatbot & chatflow
│   │       │   ├── knowledge_base.py
│   │       │   ├── document.py
│   │       │   ├── chunk.py
│   │       │   └── api_key.py       # Public API keys
│   │       ├── services/
│   │       │   ├── chatbot_service.py       # NEW - Simple chatbot execution
│   │       │   ├── chatflow_service.py      # NEW - Complex chatflow execution
│   │       │   ├── chatflow_executor.py     # NEW - Node execution engine
│   │       │   ├── inference_service.py     # NEW - Secret AI integration
│   │       │   ├── session_service.py       # NEW - Chat history (both types)
│   │       │   ├── credential_service.py    # NEW - Credential management
│   │       │   ├── embedding_service.py
│   │       │   └── vector_store_service.py
│   │       ├── integrations/                # NEW - Multi-channel
│   │       │   ├── discord_integration.py
│   │       │   ├── telegram_integration.py
│   │       │   ├── whatsapp_integration.py
│   │       │   └── zapier_integration.py
│   │       ├── chatflow/                    # NEW - Chatflow node implementations
│   │       │   ├── nodes/
│   │       │   │   ├── __init__.py
│   │       │   │   ├── llm_node.py          # LLM node executor
│   │       │   │   ├── kb_node.py           # Knowledge Base search node
│   │       │   │   ├── condition_node.py    # If/Else, Switch nodes
│   │       │   │   ├── http_node.py         # HTTP Request node
│   │       │   │   ├── variable_node.py     # Set Variable node
│   │       │   │   ├── code_node.py         # Custom code node
│   │       │   │   ├── memory_node.py       # Save/Load memory nodes
│   │       │   │   ├── database_node.py     # Database query/insert nodes
│   │       │   │   ├── loop_node.py         # For Each node
│   │       │   │   └── response_node.py     # Response node
│   │       │   └── utils/
│   │       │       ├── variable_resolver.py # Template variable resolution
│   │       │       └── graph_builder.py     # Build execution graph
│   │       └── schemas/
│   │           ├── chatbot.py
│   │           ├── chatflow.py
│   │           ├── credential.py            # NEW
│   │           ├── chat_session.py          # NEW
│   │           └── ...
│   └── pyproject.toml
│
├── frontend/                        # React dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ChatbotBuilder.jsx   # FORM-BASED chatbot builder
│   │   │   ├── ChatflowBuilder.jsx  # VISUAL drag-and-drop workflow editor
│   │   │   ├── KnowledgeBase.jsx
│   │   │   ├── Credentials.jsx      # NEW - Manage API keys/tokens for chatflow nodes
│   │   │   └── Deployments.jsx      # NEW - Show deployment options (works for both)
│   │   ├── components/
│   │   │   ├── chatbot/             # NEW - Chatbot-specific components
│   │   │   │   ├── ChatbotSettingsForm.jsx  # Form fields
│   │   │   │   ├── SystemPromptEditor.jsx
│   │   │   │   └── KnowledgeBaseSelector.jsx
│   │   │   ├── chatflow/            # NEW - Chatflow-specific components
│   │   │   │   ├── ReactFlowCanvas.jsx      # Drag-and-drop canvas (using reactflow)
│   │   │   │   ├── NodePalette.jsx          # Draggable node types
│   │   │   │   ├── NodeConfigPanel.jsx      # Configure selected node
│   │   │   │   ├── nodes/                   # Custom node components
│   │   │   │   │   ├── LLMNode.jsx
│   │   │   │   │   ├── KnowledgeBaseNode.jsx
│   │   │   │   │   ├── ConditionNode.jsx
│   │   │   │   │   ├── HTTPRequestNode.jsx
│   │   │   │   │   └── ...
│   │   │   │   └── VariableInspector.jsx    # View/debug variables
│   │   │   ├── shared/              # Shared components
│   │   │   │   ├── EmbedCode.jsx            # Generate embed code (both types)
│   │   │   │   ├── IntegrationSetup.jsx     # Discord/Telegram setup (both types)
│   │   │   │   ├── ChatPreview.jsx          # Test chat widget (both types)
│   │   │   │   └── CredentialSelector.jsx   # Select credential for nodes
│   │   │   └── ...
│   │   └── services/
│   │       └── api.js               # Backend API client
│   └── package.json
│
├── widget/                          # NEW - Embed widget (separate package)
│   ├── src/
│   │   ├── index.js                 # Widget entry point
│   │   ├── ui/
│   │   │   ├── ChatBubble.js
│   │   │   ├── ChatWindow.js
│   │   │   ├── MessageList.js
│   │   │   └── InputBox.js
│   │   ├── api/
│   │   │   └── client.js            # Backend API calls
│   │   └── styles/
│   │       └── widget.css
│   ├── build/
│   │   └── widget.js                # Compiled (served via CDN)
│   ├── webpack.config.js
│   └── package.json
│
└── docs/
    └── technical-docs/
        ├── CHATBOT_DEPLOYMENT_ARCHITECTURE.md  # This file
        └── ...
```

---

## 9. Implementation Guide {#implementation}

### Step-by-Step Implementation

#### Step 1: Core Chatbot Service

```python
# backend/src/app/services/chatbot_service.py

class ChatbotService:
    """
    Core chatbot processing logic.
    Used by ALL channels (website, Discord, API, etc.)
    """

    def __init__(self):
        self.inference_service = InferenceService()
        self.session_service = SessionService()
        self.embedding_service = EmbeddingService()
        self.vector_store_service = VectorStoreService()

    async def process_message(
        self,
        chatbot_id: UUID,
        message: str,
        session_id: str,
        channel: str = "website",
        user_identifier: str = None
    ) -> dict:
        """
        Main entry point for all chat interactions.

        USED BY:
        - Website widget
        - Discord webhook
        - Telegram webhook
        - Direct API calls
        - Zapier integration
        """

        # 1. Load chatbot
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not chatbot:
            raise HTTPException(404, "Chatbot not found")

        # 2. Get or create session
        session = self.session_service.get_or_create_session(
            chatbot_id=chatbot_id,
            session_id=session_id,
            channel=channel,
            user_identifier=user_identifier
        )

        # 3. Get chat history for context
        history = self.session_service.get_session_history(session, limit=10)

        # 4. Search Knowledge Base (if configured)
        context = None
        sources = []
        if chatbot.config.get("knowledge_bases"):
            context, sources = await self._search_knowledge_base(
                chatbot=chatbot,
                query=message
            )

        # 5. Generate response using Secret AI
        response = await self.inference_service.generate_response(
            chatbot=chatbot,
            user_message=message,
            context=context,
            chat_history=history
        )

        # 6. Save messages to history
        self.session_service.save_message(
            session=session,
            role="user",
            content=message
        )
        self.session_service.save_message(
            session=session,
            role="assistant",
            content=response,
            sources=sources
        )

        # 7. Return response
        return {
            "response": response,
            "sources": sources,
            "session_id": session_id
        }

    async def _search_knowledge_base(
        self,
        chatbot: Chatbot,
        query: str
    ) -> tuple[str, list]:
        """
        Search Knowledge Base for relevant context.
        """

        kb_config = chatbot.config["knowledge_bases"][0]
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_config["kb_id"]
        ).first()

        # Generate embedding
        query_embedding = self.embedding_service.embed_text(kb, query)

        # Search
        results = self.vector_store_service.search(
            kb=kb,
            query_embedding=query_embedding,
            filters={},
            top_k=kb_config.get("override_retrieval", {}).get("top_k", 5)
        )

        # Build context
        context = "\n\n".join([
            f"[Source: {r['metadata']['document_name']}]\n{r['metadata']['content']}"
            for r in results
        ])

        sources = [
            {
                "document": r["metadata"]["document_name"],
                "page": r["metadata"].get("page_number"),
                "score": r["score"]
            }
            for r in results
        ]

        return context, sources
```

#### Step 2: Public API Endpoints (Unified for Both Types)

```python
# backend/src/app/api/routes/public.py

"""
Public API endpoints for bot interactions.
Handles BOTH chatbots and chatflows through unified endpoints.
Used by embed widget, mobile apps, direct API access.
"""

@router.post("/v1/bots/{bot_id}/chat")
async def chat(
    bot_id: UUID,
    request: ChatRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Send message to chatbot OR chatflow.

    PUBLIC ENDPOINT - Requires API key authentication.
    Automatically detects bot type and routes accordingly.
    """

    # Detect bot type
    bot_type, bot = detect_bot_type(bot_id)

    if bot_type == "chatbot":
        # Simple chatbot execution
        response = await chatbot_service.process_message(
            chatbot_id=bot_id,
            message=request.message,
            session_id=request.session_id or generate_session_id(),
            channel="api",
            user_identifier=request.get("user_id")
        )
    elif bot_type == "chatflow":
        # Complex chatflow execution
        response = await chatflow_service.execute(
            chatflow_id=bot_id,
            input_message=request.message,
            session_id=request.session_id or generate_session_id(),
            channel="api",
            user_identifier=request.get("user_id")
        )
    else:
        raise HTTPException(404, "Bot not found")

    return response

# Legacy endpoints for backward compatibility
@router.post("/v1/chatbots/{chatbot_id}/chat")
async def chat_chatbot(
    chatbot_id: UUID,
    request: ChatRequest,
    api_key: str = Depends(verify_api_key)
):
    """Legacy endpoint - routes to unified /bots endpoint"""
    return await chat(chatbot_id, request, api_key)

@router.post("/v1/chatflows/{chatflow_id}/chat")
async def chat_chatflow(
    chatflow_id: UUID,
    request: ChatRequest,
    api_key: str = Depends(verify_api_key)
):
    """Legacy endpoint - routes to unified /bots endpoint"""
    return await chat(chatflow_id, request, api_key)

def detect_bot_type(bot_id: UUID) -> tuple[str, Chatbot | Chatflow]:
    """
    Detect if ID belongs to chatbot or chatflow.

    WHY: Unified API - widget doesn't need to know bot type
    HOW: Check both tables
    """

    chatbot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if chatbot:
        return ("chatbot", chatbot)

    chatflow = db.query(Chatflow).filter(Chatflow.id == bot_id).first()
    if chatflow:
        return ("chatflow", chatflow)

    return (None, None)

@router.get("/v1/sessions/{session_id}/history")
async def get_history(
    session_id: str,
    api_key: str = Depends(verify_api_key)
):
    """
    Get chat history for session.
    Used by widget to restore previous conversation.
    """

    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id
    ).first()

    if not session:
        return {"messages": []}

    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id
    ).order_by(ChatMessage.created_at).all()

    return {
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at,
                "sources": msg.sources
            }
            for msg in messages
        ]
    }
```

#### Step 3: Widget Build & Deploy

```javascript
// widget/webpack.config.js

module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "widget.js",
    path: path.resolve(__dirname, "build"),
    library: "PrivexBot",
    libraryTarget: "umd",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
};
```

**Build & Deploy:**

```bash
cd widget
npm run build
# Upload widget/build/widget.js to CDN
aws s3 cp build/widget.js s3://cdn.privexbot.com/widget.js --acl public-read
```

#### Step 4: Dashboard Deployment UI

```jsx
// frontend/src/components/EmbedCode.jsx

export function EmbedCode({ chatbot }) {
  const embedCode = `<!-- Privexbot Embed -->
<script src="https://cdn.privexbot.com/widget.js"></script>
<script>
  PrivexBot.init({
    botId: '${chatbot.id}',
    apiKey: '${chatbot.api_key}',
    options: {
      position: 'bottom-right',
      primaryColor: '${chatbot.config.branding?.color || "#007bff"}',
      greeting: '${chatbot.config.greeting || "Hi! How can I help?"}'
    }
  });
</script>`;

  return (
    <div className="embed-code-panel">
      <h3>Website Embed</h3>
      <p>
        Copy this code and paste it before the closing &lt;/body&gt; tag on your
        website:
      </p>

      <pre>
        <code>{embedCode}</code>
      </pre>

      <button onClick={() => navigator.clipboard.writeText(embedCode)}>
        Copy to Clipboard
      </button>

      <div className="preview">
        <h4>Preview</h4>
        <iframe
          src={`/preview/${chatbot.id}`}
          style={{ width: "100%", height: "600px", border: "1px solid #ccc" }}
        />
      </div>
    </div>
  );
}
```

#### Step 5: Multi-Channel Setup UI

```jsx
// frontend/src/components/IntegrationSetup.jsx

export function IntegrationSetup({ chatbot }) {
  const [discordToken, setDiscordToken] = useState("");

  const connectDiscord = async () => {
    await api.post(`/chatbots/${chatbot.id}/integrations/discord`, {
      token: discordToken,
    });

    alert("Discord bot connected!");
  };

  return (
    <div className="integrations-panel">
      <h3>Integrations</h3>

      {/* Discord */}
      <div className="integration-card">
        <img src="/icons/discord.svg" alt="Discord" />
        <h4>Discord</h4>
        <p>Deploy your chatbot to Discord servers</p>

        {chatbot.config.integrations?.discord?.enabled ? (
          <div className="connected">
            ✓ Connected
            <button onClick={disconnectDiscord}>Disconnect</button>
          </div>
        ) : (
          <div className="setup">
            <input
              type="password"
              placeholder="Discord Bot Token"
              value={discordToken}
              onChange={(e) => setDiscordToken(e.target.value)}
            />
            <button onClick={connectDiscord}>Connect</button>
            <a href="/docs/discord-setup" target="_blank">
              How to get Discord token?
            </a>
          </div>
        )}
      </div>

      {/* Telegram */}
      <div className="integration-card">{/* Similar setup for Telegram */}</div>

      {/* WhatsApp */}
      <div className="integration-card">{/* Similar setup for WhatsApp */}</div>

      {/* Zapier */}
      <div className="integration-card">
        <img src="/icons/zapier.svg" alt="Zapier" />
        <h4>Zapier</h4>
        <p>Use your chatbot in Zapier workflows</p>
        <a href="https://zapier.com/apps/privexbot" target="_blank">
          Connect on Zapier →
        </a>
      </div>
    </div>
  );
}
```

---

## Summary

### Key Concepts

1. **Chatbot vs Chatflow = Two Different Bot Types**

   - **Chatbot**: Simple, form-based, linear execution, single AI call
   - **Chatflow**: Advanced, visual workflow, graph execution, multiple AI calls + logic
   - **Separate tables, separate models, separate services**
   - **Same deployment channels** (widget, Discord, API, etc.)
   - **Unified public API** - automatically detects bot type

2. **Both Types = Configuration + API**

   - Created in dashboard (React frontend)
   - Chatbot: Form-based builder
   - Chatflow: Drag-and-drop node editor (ReactFlow)
   - Stored in backend database (separate tables)
   - Exposed via unified API endpoints

3. **Deployment = Making API Accessible (Same for Both)**

   - Website: Embed widget calls `/v1/bots/{id}/chat` API
   - Discord/Telegram: Webhooks call same API
   - Direct: Developers call same API
   - Widget doesn't need to know if it's chatbot or chatflow

4. **Secret AI Integration = Backend Only (Both Types)**

   - Widget doesn't call Secret AI directly
   - Backend handles all AI inference
   - Chatbot: Single AI call with system prompt
   - Chatflow: Multiple AI calls in LLM nodes
   - Keeps API keys secure

5. **Chatflow Node System = Key Differentiator**

   - 10+ node types (LLM, KB, Condition, API, Database, etc.)
   - Credential management for external API access
   - Variable system for passing data between nodes
   - Graph execution engine with conditional branching
   - Similar to n8n, Dify, or Flowise

6. **Widget = Lightweight UI (Same for Both)**

   - Separate JavaScript package
   - No AI logic, just UI + API calls
   - Users embed with single `<script>` tag
   - Works with both chatbots and chatflows transparently

7. **Multi-Channel = Webhooks + Routing Logic**

   - Each channel (Discord, Telegram) sends webhooks
   - Backend detects bot type and routes to correct service
   - Chatbot → `chatbot_service.process_message()`
   - Chatflow → `chatflow_service.execute()`
   - Responses sent back via channel-specific APIs

8. **Chat History = Session-Based (Both Types)**
   - Session ID tracks conversations
   - `bot_type` field distinguishes chatbot vs chatflow
   - Persisted in backend database
   - Available across all channels
   - Chatflow sessions include execution logs

### Best Practices

✅ **DO:**

- Keep AI logic in backend (never in widget)
- Use API keys for authentication
- Make widget lightweight and framework-agnostic
- Maintain separate services for chatbot vs chatflow
- Reuse deployment logic across both bot types
- Store credentials encrypted for chatflow nodes
- Use unified API (`/v1/bots/{id}/chat`) for both types
- Generate embed code automatically
- Provide integration guides for all channels

❌ **DON'T:**

- Put Secret AI keys in widget (security risk)
- Mix chatbot and chatflow logic in same service
- Duplicate deployment logic per bot type
- Hardcode bot type in widget (use auto-detection)
- Store credentials in plain text (encrypt them)
- Expose internal APIs publicly without authentication
- Over-engineer the widget (keep it simple)

### Critical Differences Recap

| Aspect              | Chatbot                        | Chatflow                                       |
| ------------------- | ------------------------------ | ---------------------------------------------- |
| **Creation**        | Form-based                     | Visual drag-and-drop                           |
| **Execution**       | Simple linear                  | Complex graph traversal                        |
| **AI Calls**        | Single per message             | Multiple (one per LLM node)                    |
| **Logic**           | No conditionals                | Full if/else, loops, branching                 |
| **API Integration** | No                             | Yes (HTTP Request nodes)                       |
| **Credentials**     | Not needed                     | Required for external APIs                     |
| **Database Model**  | `chatbots` table               | `chatflows` table                              |
| **Service**         | `chatbot_service.py`           | `chatflow_service.py` + `chatflow_executor.py` |
| **Builder UI**      | `ChatbotBuilder.jsx` (forms)   | `ChatflowBuilder.jsx` (ReactFlow)              |
| **Deployment**      | ✅ Same (widget, Discord, API) | ✅ Same (widget, Discord, API)                 |

### Architecture Benefits

1. **Clear Separation** - Chatbot and chatflow are distinct with no overlap
2. **Unified Deployment** - Both types deploy the same way (reduces complexity)
3. **Flexible Execution** - Chatflow supports complex workflows chatbot cannot
4. **Secure Integration** - All AI inference and credentials stay on backend
5. **Multi-Channel Ready** - Single codebase handles website, Discord, Telegram, etc.
6. **Scalable Design** - Add new node types to chatflow without affecting chatbot

This architecture ensures security, consistency, flexibility, and scalability across all bot types and deployment channels.
