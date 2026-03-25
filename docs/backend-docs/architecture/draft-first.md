# Draft Mode Architecture - Unified for KB, Chatbot, and Chatflow

**CRITICAL: ALL entity creation happens in DRAFT mode BEFORE database save**

---

## Table of Contents

1. [Overview](#overview)
2. [Draft Storage Strategy](#storage)
3. [Chatbot Draft Mode](#chatbot-draft)
4. [Chatflow Draft Mode](#chatflow-draft)
5. [Knowledge Base Draft Mode](#kb-draft)
6. [Unified Draft Service](#unified-service)
7. [Auto-Save vs Manual Save](#auto-save)
8. [Live Preview & Testing](#live-preview)
9. [Deployment Flow](#deployment)
10. [Implementation Guide](#implementation)

---

## 1. Overview {#overview}

### The Draft-First Principle

**ALL entities** (Chatbots, Chatflows, Knowledge Bases) are created in **draft mode** before saving to the database.

**WHY:**
- ✅ Users can preview and test before deploying
- ✅ No database pollution during creation
- ✅ Easy to abandon without cleanup
- ✅ Live preview without affecting production
- ✅ Auto-save without database writes
- ✅ Validation before deployment

---

### The Universal Flow

```
1. START
   ↓
2. Create Draft (Redis)
   - Generate draft_id
   - Store in Redis with TTL
   ↓
3. Configure (Auto-save to Redis)
   - Basic settings
   - Knowledge bases
   - Instructions
   - Variables
   - Customization
   ↓
4. Live Preview & Test
   - Real AI responses
   - Test with actual data
   - No database impact
   ↓
5. Validate
   - Check required fields
   - Verify configurations
   - Test connections
   ↓
6. DEPLOY (Save to Database)
   - Create database record
   - Generate API keys
   - Initialize services
   - Delete draft from Redis
   ↓
7. DEPLOYED
   - Live and accessible
   - Can be edited (creates new draft)
```

---

## 2. Draft Storage Strategy {#storage}

### Redis Structure

**WHY Redis:**
- Fast read/write (in-memory)
- Automatic expiration (TTL)
- No schema constraints
- Perfect for temporary data

**Key Structure:**

```
# Chatbot drafts
draft:chatbot:{draft_id} = {...}

# Chatflow drafts
draft:chatflow:{draft_id} = {...}

# KB drafts
draft:kb:{draft_id} = {...}
```

**TTL (Time To Live):**
- Default: 24 hours
- Extended on each auto-save
- Explicit delete on deploy or abandon

---

### Draft Data Structure

**Common Fields (All Types):**

```json
{
  "id": "draft_uuid",
  "type": "chatbot" | "chatflow" | "kb",
  "workspace_id": "uuid",
  "created_by": "user_uuid",
  "status": "draft" | "deploying" | "failed",

  "created_at": "2025-01-10T10:00:00Z",
  "updated_at": "2025-01-10T10:15:00Z",
  "expires_at": "2025-01-11T10:00:00Z",

  "auto_save_enabled": true,
  "last_auto_save": "2025-01-10T10:14:30Z",

  // Entity-specific data
  "data": {
    // Chatbot, Chatflow, or KB config
  }
}
```

---

## 3. Chatbot Draft Mode {#chatbot-draft}

### Draft Structure

```json
{
  "id": "draft_chatbot_abc123",
  "type": "chatbot",
  "workspace_id": "workspace_uuid",
  "created_by": "user_uuid",
  "status": "draft",

  "data": {
    // Step 1: Basic
    "name": "My Chatbot",
    "category": "customer_support",
    "visibility": "private",
    "description": "Customer support assistant",

    // Step 2: Knowledge Base
    "knowledge_bases": [
      {
        "kb_id": "kb_uuid",
        "enabled": true,
        "override_retrieval": {
          "top_k": 5,
          "search_method": "hybrid"
        }
      }
    ],

    // Step 3: Instructions & Behavior
    "model": "secret-ai-v1",
    "system_prompt": "You are a helpful customer support assistant...",
    "temperature": 0.7,
    "max_tokens": 2000,
    "memory": {
      "enabled": true,
      "max_messages": 10
    },

    // Step 4: Variables
    "variables": [
      {
        "name": "user_name",
        "type": "text",
        "required": false,
        "default": "",
        "collect_before_chat": false
      },
      {
        "name": "user_email",
        "type": "email",
        "required": true,
        "collect_before_chat": true
      }
    ],

    // Step 5: Customize & Features
    "appearance": {
      "theme": "light",
      "primary_color": "#4F46E5",
      "avatar_url": null,
      "welcome_message": "Hello! How can I help you today?",
      "suggested_prompts": [
        "Get started",
        "Learn more",
        "Contact support"
      ]
    },

    "features": {
      "enable_citations": true,
      "enable_follow_up_suggestions": true,
      "enable_feedback": true,
      "rate_limiting": {
        "enabled": true,
        "max_messages_per_hour": 50
      }
    },

    // Step 6: Lead Capture (optional)
    "lead_capture": {
      "enabled": false,
      "timing": "before_chat",
      "required_fields": ["email"],
      "optional_fields": ["name", "phone"]
    },

    // Step 6: Multi-Channel Deployment (configured during draft, activated on deploy)
    "deployment": {
      "channels": [
        {
          "type": "website",
          "enabled": true,
          "config": {
            "widget_position": "bottom-right",
            "allowed_domains": ["example.com", "*.example.com"]
          }
        },
        {
          "type": "telegram",
          "enabled": true,
          "config": {
            "bot_token": "credential_id_ref",  // Reference to credential
            "webhook_url": null  // Set on deploy
          }
        },
        {
          "type": "discord",
          "enabled": false,
          "config": {
            "bot_token": "credential_id_ref",
            "webhook_url": null
          }
        },
        {
          "type": "whatsapp",
          "enabled": false,
          "config": {
            "phone_number": "+1234567890",
            "webhook_url": null
          }
        },
        {
          "type": "zapier",
          "enabled": false,
          "config": {
            "webhook_url": null  // Generated on deploy
          }
        }
      ],
      "api_keys": []  // Generated on deploy
    }
  },

  // Preview state
  "preview": {
    "session_id": "preview_session_123",
    "messages": [
      {
        "role": "assistant",
        "content": "Hello! I'm your AI assistant. How can I help you today?",
        "timestamp": "2025-01-10T10:10:00Z"
      },
      {
        "role": "user",
        "content": "Hi",
        "timestamp": "2025-01-10T10:10:30Z"
      },
      {
        "role": "assistant",
        "content": "I understand you're asking about \"Hi\"...",
        "timestamp": "2025-01-10T10:10:35Z",
        "sources": ["Knowledge Base"],
        "citations": [...]
      }
    ]
  }
}
```

---

### Chatbot Builder UI (Step-by-Step)

**Sidebar Navigation:**

```
✓ Basic              (completed)
✓ Knowledge          (completed)
• Instructions       (active)
  Variables
  Customize
  Deploy
```

**Main Content Area:**

```
┌─────────────────────────────────────────────────┐
│ Instructions & Behavior                          │
│                                                  │
│ AI Model Settings                                │
│ ┌─────────────────────────────────────────────┐ │
│ │ Model: Secret AI ▼                          │ │
│ │ Temperature: [====·····] 0.7                │ │
│ │ Max Tokens: 2000                            │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ System Prompt                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ You are a helpful customer support          │ │
│ │ assistant. Use {user_name} when available.  │ │
│ │                                              │ │
│ │ Type "/" for variables ▼                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Auto-save enabled ✓] Last saved: 2 min ago    │
│                                                  │
│ [← Back]                    [Continue →]        │
└─────────────────────────────────────────────────┘
```

**Right Sidebar - Live Preview:**

```
┌─────────────────────────────┐
│ My Chatbot                  │
│ 🔒 Private • Live Preview   │
├─────────────────────────────┤
│                             │
│ My Assistant                │
│ Online • Secret AI          │
│                             │
│ Suggested topics:           │
│ • Get started               │
│ • Learn more                │
│ • Contact support           │
│                             │
│ ┌─────────────────────────┐ │
│ │ Hello! I'm your AI      │ │
│ │ assistant. How can I    │ │
│ │ help you today?         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Hi                      │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ I understand you're     │ │
│ │ asking about "Hi"...    │ │
│ │                         │ │
│ │ Sources:                │ │
│ │ • Knowledge Base        │ │
│ │                         │ │
│ │ Tell me more • How it   │ │
│ │ works • Benefits?       │ │
│ └─────────────────────────┘ │
│                             │
│ [Type a message... ⌨]      │
└─────────────────────────────┘
```

---

### API Endpoints (Chatbot Draft)

```python
# Create draft
POST /api/v1/chatbots/draft
{
  "name": "My Chatbot",
  "category": "customer_support"
}
→ Returns: {"draft_id": "...", "status": "draft"}

# Get draft
GET /api/v1/chatbots/draft/{draft_id}
→ Returns: Full draft object

# Update draft (auto-save)
PATCH /api/v1/chatbots/draft/{draft_id}
{
  "data": {
    "system_prompt": "Updated prompt..."
  }
}
→ Returns: {"status": "saved", "updated_at": "..."}

# Test/Preview (Live AI response)
POST /api/v1/chatbots/draft/{draft_id}/preview
{
  "message": "Hello",
  "session_id": "preview_session_123"
}
→ Returns: AI response using draft config

# Validate draft
POST /api/v1/chatbots/draft/{draft_id}/validate
→ Returns: {"valid": true, "errors": []}

# Deploy (save to database)
POST /api/v1/chatbots/draft/{draft_id}/deploy
→ Returns: {"chatbot_id": "...", "status": "deployed"}

# Abandon draft
DELETE /api/v1/chatbots/draft/{draft_id}
→ Deletes from Redis
```

---

## 4. Chatflow Draft Mode {#chatflow-draft}

### Draft Structure

```json
{
  "id": "draft_chatflow_xyz789",
  "type": "chatflow",
  "workspace_id": "workspace_uuid",
  "created_by": "user_uuid",
  "status": "draft",

  "data": {
    // Basic
    "name": "Customer Support Flow",
    "category": "automation",
    "visibility": "private",
    "description": "Multi-step support workflow",

    // Workflow (ReactFlow nodes and edges)
    "nodes": [
      {
        "id": "start",
        "type": "trigger",
        "position": {"x": 100, "y": 100},
        "data": {
          "trigger_type": "chat_message"
        }
      },
      {
        "id": "llm1",
        "type": "llm",
        "position": {"x": 300, "y": 100},
        "data": {
          "provider": "secret_ai",
          "model": "secret-ai-v1",
          "prompt": "Classify user intent: {{input}}",
          "temperature": 0.3
        }
      },
      {
        "id": "condition1",
        "type": "condition",
        "position": {"x": 500, "y": 100},
        "data": {
          "condition": "{{llm1.intent}} === 'billing'",
          "true_branch": "kb_search",
          "false_branch": "general_response"
        }
      },
      {
        "id": "kb_search",
        "type": "knowledge_base",
        "position": {"x": 700, "y": 50},
        "data": {
          "kb_id": "kb_uuid",
          "query": "{{input}}",
          "top_k": 5
        }
      },
      {
        "id": "response",
        "type": "response",
        "position": {"x": 900, "y": 100},
        "data": {
          "message": "{{kb_search.response}}"
        }
      }
    ],

    "edges": [
      {"id": "e1", "source": "start", "target": "llm1"},
      {"id": "e2", "source": "llm1", "target": "condition1"},
      {"id": "e3", "source": "condition1", "target": "kb_search", "label": "True"},
      {"id": "e4", "source": "condition1", "target": "response", "label": "False"},
      {"id": "e5", "source": "kb_search", "target": "response"}
    ],

    // Variables
    "variables": {
      "user_intent": "",
      "kb_context": ""
    },

    // Settings
    "settings": {
      "enable_logging": true,
      "max_iterations": 10,
      "timeout_seconds": 30
    },

    // Appearance
    "appearance": {
      "theme": "light",
      "primary_color": "#4F46E5",
      "welcome_message": "Hello! I'm your automated assistant."
    }
  },

  // Preview state
  "preview": {
    "session_id": "preview_session_456",
    "execution_log": [
      {
        "node_id": "start",
        "timestamp": "2025-01-10T10:20:00Z",
        "output": {"message": "Hi, I need help with billing"}
      },
      {
        "node_id": "llm1",
        "timestamp": "2025-01-10T10:20:02Z",
        "output": {"intent": "billing"}
      },
      {
        "node_id": "condition1",
        "timestamp": "2025-01-10T10:20:02Z",
        "output": {"result": true, "next": "kb_search"}
      },
      {
        "node_id": "kb_search",
        "timestamp": "2025-01-10T10:20:03Z",
        "output": {"results": [...], "response": "..."}
      },
      {
        "node_id": "response",
        "timestamp": "2025-01-10T10:20:04Z",
        "output": {"message": "Based on our billing docs..."}
      }
    ],
    "messages": [
      {"role": "user", "content": "Hi, I need help with billing"},
      {"role": "assistant", "content": "Based on our billing docs..."}
    ]
  }
}
```

---

### Chatflow Builder UI

**Sidebar Navigation:**

```
✓ Basic              (completed)
• Workflow           (active - drag and drop)
  Variables
  Settings
  Deploy
```

**Main Content Area (ReactFlow Canvas):**

```
┌────────────────────────────────────────────────────┐
│ Node Palette                                        │
│ ┌────┬────┬────┬────┬────┬────┬────┐              │
│ │LLM │ KB │IF  │HTTP│VAR │LOOP│RES │              │
│ └────┴────┴────┴────┴────┴────┴────┘              │
├────────────────────────────────────────────────────┤
│                                                     │
│    [Start]                                          │
│       ↓                                             │
│    [LLM Node]                                       │
│    Classify Intent                                  │
│       ↓                                             │
│    [Condition]                                      │
│    intent === 'billing'?                            │
│       ↓        ↓                                    │
│   True     False                                    │
│      ↓        ↓                                     │
│   [KB]    [Response]                                │
│      ↓                                              │
│   [Response]                                        │
│                                                     │
│ [Auto-save enabled ✓] Last saved: 1 min ago        │
│                                                     │
│ [Test Flow]  [Validate]  [Deploy →]                │
└────────────────────────────────────────────────────┘
```

**Right Sidebar - Node Config + Preview:**

```
┌─────────────────────────────┐
│ Selected Node: LLM Node     │
├─────────────────────────────┤
│ Provider: Secret AI ▼       │
│ Model: secret-ai-v1 ▼       │
│                             │
│ Prompt:                     │
│ ┌─────────────────────────┐ │
│ │ Classify user intent:   │ │
│ │ {{input}}               │ │
│ └─────────────────────────┘ │
│                             │
│ Temperature: 0.3            │
│                             │
│ [Save]                      │
├─────────────────────────────┤
│ Live Preview                │
├─────────────────────────────┤
│ Input: "Hi, I need help     │
│ with billing"               │
│                             │
│ Execution Log:              │
│ ✓ Start (0.0s)              │
│ ✓ LLM1 (2.1s)               │
│   → intent: "billing"       │
│ ✓ Condition (0.0s)          │
│   → True branch             │
│ ✓ KB Search (1.2s)          │
│   → 5 results found         │
│ ✓ Response (0.1s)           │
│                             │
│ Output:                     │
│ "Based on our billing       │
│ docs..."                    │
└─────────────────────────────┘
```

---

### API Endpoints (Chatflow Draft)

```python
# Create draft
POST /api/v1/chatflows/draft
{
  "name": "Customer Support Flow"
}

# Update workflow (auto-save)
PATCH /api/v1/chatflows/draft/{draft_id}
{
  "data": {
    "nodes": [...],
    "edges": [...]
  }
}

# Test execution (Live preview)
POST /api/v1/chatflows/draft/{draft_id}/execute
{
  "input": "Hi, I need help with billing",
  "session_id": "preview_session_456"
}
→ Returns: Execution log + final output

# Validate workflow
POST /api/v1/chatflows/draft/{draft_id}/validate
→ Returns: {"valid": true, "errors": [], "warnings": []}

# Deploy
POST /api/v1/chatflows/draft/{draft_id}/deploy
```

---

## 5. Knowledge Base Draft Mode {#kb-draft}

### Draft Structure

(See KB_DRAFT_MODE_ARCHITECTURE.md for complete details)

```json
{
  "id": "draft_kb_def456",
  "type": "kb",
  "workspace_id": "workspace_uuid",

  "data": {
    "name": "Product Knowledge Base",
    "description": "Combined product docs",
    "embedding_config": {...},
    "vector_store_config": {...},

    "sources": [
      {
        "id": "temp_source_1",
        "type": "file_upload",
        "temp_file_path": "/tmp/...",
        "content": "...",
        "annotations": {...}
      }
    ],

    "chunks_preview": [...]
  }
}
```

---

## 6. Unified Draft Service {#unified-service}

### Architecture

**One service to rule them all:**

```python
# backend/src/app/services/draft_service.py

from enum import Enum
from typing import Literal

class DraftType(str, Enum):
    CHATBOT = "chatbot"
    CHATFLOW = "chatflow"
    KB = "kb"

class UnifiedDraftService:
    """
    Unified draft management for all entity types.

    WHY: Consistent draft pattern across chatbots, chatflows, KBs
    HOW: Single service, type-specific handlers
    """

    def __init__(self):
        self.redis_client = redis.Redis(
            host='localhost',
            port=6379,
            db=1,  # Drafts database
            decode_responses=True
        )
        self.default_ttl = 24 * 60 * 60  # 24 hours

    def create_draft(
        self,
        draft_type: DraftType,
        workspace_id: str,
        created_by: str,
        initial_data: dict
    ) -> str:
        """
        Create new draft (any type).

        FLOW:
        1. Generate draft_id
        2. Create draft structure
        3. Store in Redis with TTL
        4. Return draft_id
        """

        draft_id = f"draft_{draft_type.value}_{uuid4().hex[:8]}"

        draft = {
            "id": draft_id,
            "type": draft_type.value,
            "workspace_id": workspace_id,
            "created_by": created_by,
            "status": "draft",
            "auto_save_enabled": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(seconds=self.default_ttl)).isoformat(),
            "data": initial_data,
            "preview": {}
        }

        # Store in Redis
        redis_key = f"draft:{draft_type.value}:{draft_id}"
        self.redis_client.setex(
            redis_key,
            self.default_ttl,
            json.dumps(draft)
        )

        return draft_id

    def get_draft(self, draft_type: DraftType, draft_id: str) -> dict | None:
        """Get draft by type and ID."""

        redis_key = f"draft:{draft_type.value}:{draft_id}"
        data = self.redis_client.get(redis_key)

        if not data:
            return None

        return json.loads(data)

    def update_draft(
        self,
        draft_type: DraftType,
        draft_id: str,
        updates: dict,
        extend_ttl: bool = True
    ):
        """
        Update draft (auto-save).

        WHY: Auto-save on every change
        HOW: Update Redis, extend TTL
        """

        draft = self.get_draft(draft_type, draft_id)
        if not draft:
            raise ValueError("Draft not found or expired")

        # Update data
        draft["data"].update(updates.get("data", {}))
        draft["updated_at"] = datetime.utcnow().isoformat()
        draft["last_auto_save"] = datetime.utcnow().isoformat()

        # Update preview if provided
        if "preview" in updates:
            draft["preview"] = updates["preview"]

        # Save back to Redis
        redis_key = f"draft:{draft_type.value}:{draft_id}"
        ttl = self.default_ttl if extend_ttl else self.redis_client.ttl(redis_key)

        self.redis_client.setex(
            redis_key,
            ttl,
            json.dumps(draft)
        )

    def validate_draft(self, draft_type: DraftType, draft_id: str) -> dict:
        """
        Validate draft before deployment.

        WHY: Ensure all required fields present
        HOW: Type-specific validation
        """

        draft = self.get_draft(draft_type, draft_id)
        if not draft:
            raise ValueError("Draft not found")

        errors = []
        warnings = []

        if draft_type == DraftType.CHATBOT:
            errors, warnings = self._validate_chatbot(draft)
        elif draft_type == DraftType.CHATFLOW:
            errors, warnings = self._validate_chatflow(draft)
        elif draft_type == DraftType.KB:
            errors, warnings = self._validate_kb(draft)

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }

    def _validate_chatbot(self, draft: dict) -> tuple[list, list]:
        """Validate chatbot draft."""

        errors = []
        warnings = []
        data = draft["data"]

        # Required fields
        if not data.get("name"):
            errors.append("Name is required")

        if not data.get("system_prompt"):
            errors.append("System prompt is required")

        # Warnings
        if not data.get("knowledge_bases"):
            warnings.append("No knowledge bases configured")

        if not data.get("appearance", {}).get("welcome_message"):
            warnings.append("Welcome message not set")

        return errors, warnings

    def _validate_chatflow(self, draft: dict) -> tuple[list, list]:
        """Validate chatflow draft."""

        errors = []
        warnings = []
        data = draft["data"]

        # Required fields
        if not data.get("name"):
            errors.append("Name is required")

        if not data.get("nodes"):
            errors.append("Workflow has no nodes")

        # Check for start node
        nodes = data.get("nodes", [])
        has_start = any(node["type"] == "trigger" for node in nodes)
        if not has_start:
            errors.append("Workflow must have a start/trigger node")

        # Check for response node
        has_response = any(node["type"] == "response" for node in nodes)
        if not has_response:
            errors.append("Workflow must have a response node")

        # Check for disconnected nodes
        edges = data.get("edges", [])
        node_ids = {node["id"] for node in nodes}
        connected_nodes = set()
        for edge in edges:
            connected_nodes.add(edge["source"])
            connected_nodes.add(edge["target"])

        disconnected = node_ids - connected_nodes
        if disconnected:
            warnings.append(f"Disconnected nodes: {', '.join(disconnected)}")

        return errors, warnings

    def _validate_kb(self, draft: dict) -> tuple[list, list]:
        """Validate KB draft."""

        errors = []
        warnings = []
        data = draft["data"]

        if not data.get("name"):
            errors.append("Name is required")

        if not data.get("sources"):
            errors.append("No sources added")

        if not data.get("embedding_config"):
            errors.append("Embedding config required")

        return errors, warnings

    def deploy_draft(
        self,
        draft_type: DraftType,
        draft_id: str,
        db
    ) -> str:
        """
        Deploy draft → Save to database.

        FLOW:
        1. Validate draft
        2. Create database record
        3. Type-specific initialization
        4. Delete draft from Redis
        5. Return entity ID
        """

        # Validate
        validation = self.validate_draft(draft_type, draft_id)
        if not validation["valid"]:
            raise ValueError(f"Validation failed: {validation['errors']}")

        draft = self.get_draft(draft_type, draft_id)

        # Deploy based on type
        if draft_type == DraftType.CHATBOT:
            entity_id = self._deploy_chatbot(draft, db)
        elif draft_type == DraftType.CHATFLOW:
            entity_id = self._deploy_chatflow(draft, db)
        elif draft_type == DraftType.KB:
            entity_id = self._deploy_kb(draft, db)

        # Delete draft from Redis
        redis_key = f"draft:{draft_type.value}:{draft_id}"
        self.redis_client.delete(redis_key)

        return entity_id

    def _deploy_chatbot(self, draft: dict, db) -> dict:
        """
        Deploy chatbot to database + initialize multi-channel deployments.

        Returns deployment results per channel.
        """

        from app.models.chatbot import Chatbot
        from app.models.api_key import APIKey
        from app.integrations.telegram_integration import TelegramIntegration
        from app.integrations.discord_integration import DiscordIntegration
        from app.integrations.whatsapp_integration import WhatsAppIntegration

        data = draft["data"]

        # Create chatbot record
        chatbot = Chatbot(
            workspace_id=draft["workspace_id"],
            name=data["name"],
            config=data,  # Store entire config as JSONB (includes deployment config)
            created_by=draft["created_by"]
        )

        db.add(chatbot)
        db.flush()

        # Generate primary API key
        api_key = APIKey(
            workspace_id=draft["workspace_id"],
            entity_type="chatbot",
            entity_id=chatbot.id,
            created_by=draft["created_by"]
        )

        db.add(api_key)
        db.commit()

        # Initialize multi-channel deployments
        deployment_results = self._initialize_channels(
            entity_id=chatbot.id,
            entity_type="chatbot",
            deployment_config=data.get("deployment", {}),
            api_key=api_key.key
        )

        return deployment_results

    def _initialize_channels(
        self,
        entity_id: str,
        entity_type: str,
        deployment_config: dict,
        api_key: str
    ) -> dict:
        """
        Initialize multi-channel deployments (shared by chatbot & chatflow).

        WHY: Both chatbots and chatflows deploy to same channels
        HOW: Iterate enabled channels, register webhooks, generate codes
        """

        from app.integrations.telegram_integration import TelegramIntegration
        from app.integrations.discord_integration import DiscordIntegration
        from app.integrations.whatsapp_integration import WhatsAppIntegration

        deployment_results = {
            f"{entity_type}_id": str(entity_id),
            "channels": {}
        }

        channels = deployment_config.get("channels", [])

        for channel in channels:
            if not channel.get("enabled"):
                continue

            channel_type = channel["type"]

            try:
                if channel_type == "website":
                    # Generate embed code
                    deployment_results["channels"]["website"] = {
                        "status": "success",
                        "embed_code": self._generate_embed_code(entity_id, api_key),
                        "allowed_domains": channel["config"].get("allowed_domains", [])
                    }

                elif channel_type == "telegram":
                    # Register Telegram webhook
                    telegram = TelegramIntegration()
                    webhook_url = telegram.register_webhook(entity_id, entity_type, channel["config"])
                    deployment_results["channels"]["telegram"] = {
                        "status": "success",
                        "webhook_url": webhook_url,
                        "bot_username": telegram.get_bot_info(channel["config"]["bot_token"])["username"]
                    }

                elif channel_type == "discord":
                    # Register Discord webhook
                    discord = DiscordIntegration()
                    webhook_url = discord.register_webhook(entity_id, entity_type, channel["config"])
                    deployment_results["channels"]["discord"] = {
                        "status": "success",
                        "webhook_url": webhook_url
                    }

                elif channel_type == "whatsapp":
                    # Configure WhatsApp Business API
                    whatsapp = WhatsAppIntegration()
                    webhook_url = whatsapp.register_webhook(entity_id, entity_type, channel["config"])
                    deployment_results["channels"]["whatsapp"] = {
                        "status": "success",
                        "webhook_url": webhook_url,
                        "phone_number": channel["config"]["phone_number"]
                    }

                elif channel_type == "zapier":
                    # Generate Zapier webhook URL
                    zapier_webhook = f"https://api.privexbot.com/webhooks/zapier/{entity_id}"
                    deployment_results["channels"]["zapier"] = {
                        "status": "success",
                        "webhook_url": zapier_webhook
                    }

            except Exception as e:
                deployment_results["channels"][channel_type] = {
                    "status": "error",
                    "error": str(e)
                }

        return deployment_results

    def _generate_embed_code(self, entity_id: str, api_key: str) -> str:
        """Generate embed code for website widget."""
        return f"""<script>
  window.privexbotConfig = {{
    botId: '{entity_id}',
    apiKey: '{api_key}'
  }};
</script>
<script src="https://cdn.privexbot.com/widget.js"></script>"""

    def _deploy_chatflow(self, draft: dict, db) -> dict:
        """
        Deploy chatflow to database + initialize multi-channel deployments.

        Chatflows support the SAME channels as chatbots.
        Returns deployment results per channel.
        """

        from app.models.chatflow import Chatflow
        from app.models.api_key import APIKey

        data = draft["data"]

        # Create chatflow record
        chatflow = Chatflow(
            workspace_id=draft["workspace_id"],
            name=data["name"],
            config=data,  # Store entire config as JSONB (includes deployment config)
            version=1,
            is_active=True,
            created_by=draft["created_by"]
        )

        db.add(chatflow)
        db.flush()

        # Generate API key
        api_key = APIKey(
            workspace_id=draft["workspace_id"],
            entity_type="chatflow",
            entity_id=chatflow.id,
            created_by=draft["created_by"]
        )

        db.add(api_key)
        db.commit()

        # Reuse chatbot multi-channel deployment logic
        # (Chatflows support same channels as chatbots)
        deployment_results = self._initialize_channels(
            entity_id=chatflow.id,
            entity_type="chatflow",
            deployment_config=data.get("deployment", {}),
            api_key=api_key.key
        )

        return deployment_results

    def _deploy_kb(self, draft: dict, db) -> str:
        """Deploy KB to database (see KB_DRAFT_MODE_ARCHITECTURE.md)."""

        from app.services.kb_draft_service import KBDraftService

        kb_draft_service = KBDraftService()
        return kb_draft_service.finalize_draft(draft["id"], db)
```

---

## 7. Auto-Save vs Manual Save {#auto-save}

### Auto-Save Strategy

**ENABLED by default** for all drafts.

**How it works:**

```javascript
// Frontend - Auto-save hook
function useAutoSave(draftId, draftType) {
  const [data, setData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Debounced save (500ms after last change)
  const debouncedSave = useMemo(
    () => debounce(async (updates) => {
      setIsSaving(true);

      await fetch(`/api/v1/${draftType}/draft/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updates })
      });

      setLastSaved(new Date());
      setIsSaving(false);
    }, 500),
    [draftId, draftType]
  );

  // Trigger save on data change
  useEffect(() => {
    if (Object.keys(data).length > 0) {
      debouncedSave(data);
    }
  }, [data]);

  return { setData, isSaving, lastSaved };
}
```

**Manual Save:**

Users can also manually save (Ctrl+S or Save button).

**Benefits:**
- ✅ Never lose work
- ✅ No explicit save button needed
- ✅ Seamless UX
- ✅ Automatic TTL extension

---

## 8. Live Preview & Testing {#live-preview}

### Chatbot Live Preview

**How it works:**

```python
@router.post("/api/v1/chatbots/draft/{draft_id}/preview")
async def preview_chatbot(
    draft_id: str,
    message: str,
    session_id: str,
    draft_service: UnifiedDraftService = Depends()
):
    """
    Test chatbot with live AI response.

    WHY: Preview before deploy
    HOW: Use draft config, call Secret AI, don't save to DB
    """

    # Get draft
    draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)
    if not draft:
        raise HTTPException(404, "Draft not found")

    # Get preview session (in-memory or Redis)
    session = get_preview_session(session_id)

    # Build prompt from draft config
    data = draft["data"]
    system_prompt = data.get("system_prompt", "")

    # Retrieve from KB (if configured)
    context = ""
    if data.get("knowledge_bases"):
        kb_ids = [kb["kb_id"] for kb in data["knowledge_bases"] if kb["enabled"]]
        context = await retrieve_from_kbs(kb_ids, message)

    # Get chat history
    history = session.get("messages", [])

    # Build prompt
    prompt = f"""
    System: {system_prompt}

    Context:
    {context}

    History:
    {format_history(history)}

    User: {message}
    """

    # Call Secret AI
    response = await secret_ai.generate(
        prompt=prompt,
        model=data.get("model", "secret-ai-v1"),
        temperature=data.get("temperature", 0.7),
        max_tokens=data.get("max_tokens", 2000)
    )

    # Update preview session
    session["messages"].append({"role": "user", "content": message})
    session["messages"].append({"role": "assistant", "content": response})
    save_preview_session(session_id, session)

    # Update draft preview state
    draft_service.update_draft(
        DraftType.CHATBOT,
        draft_id,
        {"preview": {"session_id": session_id, "messages": session["messages"]}},
        extend_ttl=True
    )

    return {
        "message": response,
        "sources": ["Knowledge Base"] if context else [],
        "citations": extract_citations(response) if data.get("features", {}).get("enable_citations") else []
    }
```

---

### Chatflow Live Execution

```python
@router.post("/api/v1/chatflows/draft/{draft_id}/execute")
async def execute_chatflow(
    draft_id: str,
    input_message: str,
    session_id: str,
    draft_service: UnifiedDraftService = Depends()
):
    """
    Test chatflow with live execution.

    WHY: Preview workflow before deploy
    HOW: Execute workflow, return execution log
    """

    from app.services.chatflow_executor import ChatflowExecutor

    # Get draft
    draft = draft_service.get_draft(DraftType.CHATFLOW, draft_id)
    if not draft:
        raise HTTPException(404, "Draft not found")

    # Execute workflow
    executor = ChatflowExecutor()
    result = await executor.execute_from_draft(
        draft_config=draft["data"],
        input_message=input_message,
        session_id=session_id
    )

    # Update draft preview state
    draft_service.update_draft(
        DraftType.CHATFLOW,
        draft_id,
        {
            "preview": {
                "session_id": session_id,
                "execution_log": result["execution_log"],
                "messages": result["messages"]
            }
        }
    )

    return {
        "output": result["output"],
        "execution_log": result["execution_log"],
        "execution_time_ms": result["execution_time_ms"]
    }
```

---

## 9. Multi-Channel Deployment Flow {#deployment}

### Deploy Step UI (Final Step Before Going Live)

**Sidebar Navigation:**

```
✓ Basic              (completed)
✓ Knowledge          (completed)
✓ Instructions       (completed)
✓ Variables          (completed)
✓ Customize          (completed)
• Deploy             (active)
```

**Main Content Area - Channel Selection:**

```
┌─────────────────────────────────────────────────────────┐
│ Deploy Your Chatbot                                      │
│                                                          │
│ Choose where your chatbot will be available:            │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☑ Website Widget                        [Configure] │ │
│ │   Embed on your website                             │ │
│ │   Domains: example.com, *.example.com               │ │
│ │   Position: Bottom Right                            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☑ Telegram Bot                          [Configure] │ │
│ │   Deploy to Telegram                                │ │
│ │   Bot Token: •••••••••••• (from Credentials)        │ │
│ │   Status: Ready to deploy                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☐ Discord Bot                           [Configure] │ │
│ │   Deploy to Discord server                          │ │
│ │   Not configured                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☐ WhatsApp Business                     [Configure] │ │
│ │   Connect to WhatsApp Business API                  │ │
│ │   Not configured                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☐ Zapier Webhook                        [Configure] │ │
│ │   Integrate with Zapier workflows                   │ │
│ │   Not configured                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [Auto-save enabled ✓] Last saved: 30 sec ago            │
│                                                          │
│ [← Back]    [Test Preview]    [Deploy to Channels →]   │
└─────────────────────────────────────────────────────────┘
```

---

### Complete Deployment Process

```
1. User configures deployment channels in "Deploy" step
   ↓
2. User clicks "Deploy to Channels"
   ↓
3. Frontend calls validate endpoint
   POST /api/v1/{type}/draft/{draft_id}/validate
   ↓
4. If validation passes, show channel summary
   ┌─────────────────────────────────────┐
   │ Ready to Deploy?                    │
   │                                     │
   │ Your chatbot will go live on:       │
   │ • Website Widget (2 domains)        │
   │ • Telegram Bot                      │
   │                                     │
   │ [Cancel]  [Deploy Now]              │
   └─────────────────────────────────────┘
   ↓
5. User confirms "Deploy Now"
   ↓
6. Frontend calls deploy endpoint
   POST /api/v1/{type}/draft/{draft_id}/deploy
   ↓
7. Backend (Multi-Channel Deployment):
   a. Final validation
   b. Create database record
   c. Generate API keys for each channel
   d. Initialize enabled channels:
      - Website: Generate embed code
      - Telegram: Register webhook with Telegram API
      - Discord: Register webhook with Discord API
      - WhatsApp: Configure Business API webhook
      - Zapier: Generate webhook URL
   e. Delete draft from Redis
   ↓
8. Return deployment results per channel
   ↓
9. Frontend shows deployment success page
   ┌─────────────────────────────────────────────┐
   │ ✓ Deployed Successfully!                    │
   │                                             │
   │ Website Widget                              │
   │ ┌─────────────────────────────────────────┐ │
   │ │ <script src="https://...">             │ │
   │ │ </script>                               │ │
   │ │ [Copy Embed Code]                       │ │
   │ └─────────────────────────────────────────┘ │
   │                                             │
   │ Telegram Bot                                │
   │ Status: ✓ Live                              │
   │ Bot: @your_bot_name                         │
   │ [Open in Telegram]                          │
   │                                             │
   │ [Go to Dashboard]  [Deploy More Channels]  │
   └─────────────────────────────────────────────┘
```

---

### Deployment API Response

**Successful Multi-Channel Deployment:**

```json
{
  "chatbot_id": "chatbot_uuid",
  "status": "deployed",
  "channels": {
    "website": {
      "status": "success",
      "embed_code": "<script>...</script>",
      "allowed_domains": ["example.com", "*.example.com"]
    },
    "telegram": {
      "status": "success",
      "webhook_url": "https://api.privexbot.com/webhooks/telegram/chatbot_uuid",
      "bot_username": "@your_support_bot"
    },
    "discord": {
      "status": "error",
      "error": "Invalid bot token"
    }
  }
}
```

**Frontend Handling:**

```javascript
// After deployment
const response = await deployDraft(draftId);

// Show success for working channels
response.channels.forEach((channel, type) => {
  if (channel.status === 'success') {
    showChannelSuccess(type, channel);
  } else {
    showChannelError(type, channel.error);
  }
});

// Redirect to deployment details page
router.push(`/chatbots/${response.chatbot_id}/deployment`);
```

---

### Error Handling

**Validation Errors:**

```json
{
  "valid": false,
  "errors": [
    "Name is required",
    "System prompt is required"
  ],
  "warnings": [
    "No knowledge bases configured"
  ]
}
```

**UI Response:**

```
⚠ Cannot deploy yet

Required fixes:
• Name is required
• System prompt is required

Suggestions:
• No knowledge bases configured

[Fix Issues]
```

**Deployment Errors:**

```json
{
  "error": "Deployment failed",
  "details": "Database connection error",
  "draft_preserved": true
}
```

**UI Response:**

```
❌ Deployment failed

Database connection error

Your draft has been preserved. Please try again.

[Retry]  [Contact Support]
```

---

## 10. Implementation Guide {#implementation}

### Step 1: Setup Redis for Drafts

```python
# backend/src/app/config.py

REDIS_DRAFT_CONFIG = {
    "host": "localhost",
    "port": 6379,
    "db": 1,  # Separate DB for drafts
    "decode_responses": True
}
```

---

### Step 2: Create Unified Draft Service

```bash
backend/src/app/services/draft_service.py
```

(See full implementation above)

---

### Step 3: Create Draft Endpoints

```python
# backend/src/app/api/v1/routes/drafts.py

from fastapi import APIRouter, Depends
from app.services.draft_service import UnifiedDraftService, DraftType

router = APIRouter()

@router.post("/{entity_type}/draft")
async def create_draft(
    entity_type: Literal["chatbots", "chatflows", "kb"],
    initial_data: dict,
    current_user: User = Depends(get_current_user),
    draft_service: UnifiedDraftService = Depends()
):
    """Create new draft."""

    draft_type = DraftType(entity_type.rstrip('s'))  # Remove plural

    draft_id = draft_service.create_draft(
        draft_type=draft_type,
        workspace_id=current_user.workspace_id,
        created_by=current_user.id,
        initial_data=initial_data
    )

    return {"draft_id": draft_id, "status": "draft"}

@router.get("/{entity_type}/draft/{draft_id}")
async def get_draft(
    entity_type: str,
    draft_id: str,
    draft_service: UnifiedDraftService = Depends()
):
    """Get draft."""

    draft_type = DraftType(entity_type.rstrip('s'))
    draft = draft_service.get_draft(draft_type, draft_id)

    if not draft:
        raise HTTPException(404, "Draft not found or expired")

    return draft

@router.patch("/{entity_type}/draft/{draft_id}")
async def update_draft(
    entity_type: str,
    draft_id: str,
    updates: dict,
    draft_service: UnifiedDraftService = Depends()
):
    """Update draft (auto-save)."""

    draft_type = DraftType(entity_type.rstrip('s'))

    draft_service.update_draft(
        draft_type=draft_type,
        draft_id=draft_id,
        updates=updates
    )

    return {"status": "saved", "updated_at": datetime.utcnow().isoformat()}

@router.post("/{entity_type}/draft/{draft_id}/validate")
async def validate_draft(
    entity_type: str,
    draft_id: str,
    draft_service: UnifiedDraftService = Depends()
):
    """Validate draft."""

    draft_type = DraftType(entity_type.rstrip('s'))
    return draft_service.validate_draft(draft_type, draft_id)

@router.post("/{entity_type}/draft/{draft_id}/deploy")
async def deploy_draft(
    entity_type: str,
    draft_id: str,
    db: Session = Depends(get_db),
    draft_service: UnifiedDraftService = Depends()
):
    """Deploy draft to database."""

    draft_type = DraftType(entity_type.rstrip('s'))

    try:
        entity_id = draft_service.deploy_draft(draft_type, draft_id, db)

        return {
            "entity_id": entity_id,
            "status": "deployed",
            "message": f"{entity_type.rstrip('s').capitalize()} deployed successfully"
        }

    except ValueError as e:
        raise HTTPException(400, str(e))

@router.delete("/{entity_type}/draft/{draft_id}")
async def abandon_draft(
    entity_type: str,
    draft_id: str,
    draft_service: UnifiedDraftService = Depends()
):
    """Abandon/delete draft."""

    draft_type = DraftType(entity_type.rstrip('s'))
    redis_key = f"draft:{draft_type.value}:{draft_id}"
    draft_service.redis_client.delete(redis_key)

    return {"status": "deleted"}
```

---

### Step 4: Frontend Auto-Save Hook

```javascript
// frontend/src/hooks/useAutoSave.js

import { useState, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';

export function useAutoSave(draftId, draftType) {
  const [data, setData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  const debouncedSave = useMemo(
    () => debounce(async (updates) => {
      setIsSaving(true);
      setError(null);

      try {
        await fetch(`/api/v1/${draftType}/draft/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: updates })
        });

        setLastSaved(new Date());
      } catch (err) {
        setError(err.message);
      } finally {
        setIsSaving(false);
      }
    }, 500),
    [draftId, draftType]
  );

  useEffect(() => {
    if (Object.keys(data).length > 0) {
      debouncedSave(data);
    }
  }, [data, debouncedSave]);

  return {
    updateData: setData,
    isSaving,
    lastSaved,
    error
  };
}
```

---

### Step 5: Frontend Builder Components

```javascript
// frontend/src/pages/ChatbotBuilder.jsx

function ChatbotBuilder({ draftId }) {
  const { updateData, isSaving, lastSaved } = useAutoSave(draftId, 'chatbots');
  const [draft, setDraft] = useState(null);

  // Load draft
  useEffect(() => {
    fetch(`/api/v1/chatbots/draft/${draftId}`)
      .then(res => res.json())
      .then(setDraft);
  }, [draftId]);

  // Update field
  const handleChange = (field, value) => {
    setDraft(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [field]: value
      }
    }));

    // Trigger auto-save
    updateData({ [field]: value });
  };

  return (
    <div>
      {/* Auto-save indicator */}
      <div>
        {isSaving ? '💾 Saving...' : `✓ Saved ${formatRelativeTime(lastSaved)}`}
      </div>

      {/* Builder UI */}
      <ChatbotBuilderUI
        data={draft?.data}
        onChange={handleChange}
      />
    </div>
  );
}
```

---

## Summary

**Unified Draft Architecture:**

1. ✅ **All entities use draft mode** (Chatbot, Chatflow, KB)
2. ✅ **Stored in Redis** (fast, expiring storage)
3. ✅ **Auto-save enabled** (never lose work)
4. ✅ **Live preview & testing** (real AI responses)
5. ✅ **Validation before deploy** (catch errors early)
6. ✅ **Deploy = save to database** (only when ready)
7. ✅ **Consistent UX** (same flow for all entities)

**Key Benefits:**

- 🚀 Fast and responsive UX
- 💾 Never lose work (auto-save)
- 🔍 Preview before deploy
- 🧹 No database pollution
- ✅ Validation before commit
- 🔄 Easy rollback (abandon draft)

This architecture ensures a **consistent, robust, and user-friendly** creation experience across all entity types.