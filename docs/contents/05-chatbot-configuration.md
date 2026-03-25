# PrivexBot Chatbot Configuration System

## Overview

PrivexBot chatbots are highly configurable AI assistants that can be customized for behavior, appearance, knowledge sources, and deployment channels. All configuration is stored in JSONB columns for flexibility and extensibility.

## Chatbot Lifecycle

```
DRAFT (Redis) → DEPLOY → ACTIVE/PAUSED → ARCHIVED
     ↓              ↓           ↓
  24hr TTL    PostgreSQL   Soft delete
```

### Status Values
- **draft**: Being configured in Redis
- **active**: Deployed and operational
- **paused**: Temporarily disabled
- **archived**: Soft deleted, can be restored

## Configuration Categories

### 1. AI Configuration (`ai_config`)

Controls the AI model and generation parameters.

```python
ai_config = {
    "provider": "secret_ai",      # secret_ai | akash_ml | custom
    "model": "deepseek-r1",       # Model identifier
    "temperature": 0.7,           # 0.0 (deterministic) to 2.0 (creative)
    "max_tokens": 2000,           # Maximum response length
    "top_p": 0.9,                 # Nucleus sampling
    "frequency_penalty": 0.0,     # Discourage repetition
    "presence_penalty": 0.0       # Encourage diverse topics
}
```

#### Supported AI Providers

| Provider | Description | Self-Hosted |
|----------|-------------|-------------|
| Secret AI | Primary provider via TEE | Yes |
| Akash ML | Decentralized inference (fallback) | Yes |
| Custom | OpenAI-compatible endpoints | Configurable |

#### Temperature Guide

| Value | Behavior | Use Case |
|-------|----------|----------|
| 0.0-0.3 | Very focused, deterministic | Factual Q&A |
| 0.4-0.7 | Balanced | General assistant |
| 0.8-1.2 | Creative, varied | Content generation |
| 1.3-2.0 | Very creative | Brainstorming |

### 2. Prompt Configuration (`prompt_config`)

Defines the chatbot's personality and behavior.

```python
prompt_config = {
    "system_prompt": "You are a helpful customer support assistant...",

    "persona": {
        "name": "Alex",
        "role": "Customer Support Specialist",
        "tone": "friendly"  # friendly | professional | casual | formal
    },

    "instructions": [
        {
            "id": "inst_1",
            "priority": 1,
            "text": "Always greet users warmly",
            "enabled": true
        }
    ],

    "restrictions": [
        {
            "id": "rest_1",
            "text": "Never discuss competitor products",
            "enabled": true
        }
    ],

    "messages": {
        "greeting": "Hi! How can I help you today?",
        "fallback": "I'm not sure about that. Would you like to speak with a human?",
        "closing": "Is there anything else I can help with?"
    }
}
```

#### Variable Substitution

Use `{{variable_name}}` syntax in prompts:

```
System Prompt: "You are helping {{user_name}} from {{company}}."
Variables: {"user_name": "John", "company": "Acme Inc"}
Result: "You are helping John from Acme Inc."
```

### 3. Knowledge Base Configuration (`kb_config`)

Connects chatbot to knowledge bases for RAG.

```python
kb_config = {
    "enabled": true,

    "knowledge_bases": [
        {
            "kb_id": "uuid",
            "name": "Product FAQ",
            "enabled": true,
            "priority": 1,  # Higher = searched first
            "retrieval_override": {
                "top_k": 5,
                "score_threshold": 0.7,
                "strategy": "hybrid_search"
            }
        }
    ],

    "merge_strategy": "priority",  # priority | score
    "citation_style": "inline",    # inline | footnote | none
    "max_context_tokens": 4000,
    "grounding_mode": "strict"     # strict | guided | flexible
}
```

#### Grounding Modes Explained

| Mode | Behavior | Use Case |
|------|----------|----------|
| **strict** | Only KB answers, refuses unknown | High accuracy required |
| **guided** | Prefers KB, discloses general knowledge | Balanced flexibility |
| **flexible** | KB enhances, no restrictions | General assistant |

### 4. Branding Configuration (`branding_config`)

Controls the visual appearance of the widget.

```python
branding_config = {
    "avatar_url": "https://...",
    "avatar_fallback": "AS",        # Initials if no avatar
    "primary_color": "#3b82f6",     # Widget accent color
    "secondary_color": "#8b5cf6",
    "widget_position": "bottom-right",  # bottom-right | bottom-left
    "widget_size": "standard",      # compact | standard | large
    "show_powered_by": true
}
```

### 5. Deployment Configuration (`deployment_config`)

Defines which channels the chatbot is available on.

```python
deployment_config = {
    "web_widget": {
        "enabled": true,
        "domains": ["example.com", "*.example.com"],
        "embed_code_generated": true
    },

    "telegram": {
        "enabled": false,
        "bot_token_credential_id": null,
        "webhook_registered": false
    },

    "discord": {
        "enabled": false,
        "bot_token_credential_id": null,
        "guild_ids": []
    },

    "whatsapp": {
        "enabled": false,
        "phone_number_id": null
    },

    "api": {
        "enabled": true,
        "api_key_id": "uuid"
    }
}
```

#### Supported Channels

| Channel | Credentials Required | Features |
|---------|---------------------|----------|
| Web Widget | None | Embed code, domain restriction |
| Telegram | Bot Token | Webhook auto-registration |
| Discord | Bot Token | Guild-specific deployment |
| WhatsApp | Access Token | Business API integration |
| REST API | API Key | Direct programmatic access |
| Zapier | None | Webhook-based automation |

### 6. Behavior Configuration (`behavior_config`)

Controls response behavior and memory.

```python
behavior_config = {
    "memory": {
        "enabled": true,
        "max_messages": 20      # Keep last N messages in context
    },

    "response": {
        "typing_indicator": true,
        "typing_delay_ms": 500  # Simulated typing delay
    },

    "rate_limiting": {
        "messages_per_minute": 10,
        "messages_per_session": 100
    },

    "follow_up_questions": false,  # Suggest follow-ups
    "show_citations": true         # Show KB sources
}
```

### 7. Lead Capture Configuration (`lead_capture_config`)

Collects user information for sales/support.

```python
lead_capture_config = {
    "enabled": false,
    "timing": "before_chat",  # before_chat | during_chat | after_chat

    "required_fields": ["email"],
    "optional_fields": ["name", "phone"],

    "privacy": {
        "require_consent": false,
        "consent_message": "We'd like to save your information..."
    },

    "platforms": {
        "widget": {"prompt_for_email": true},
        "telegram": {"prompt_for_email": false}  # Auto-captured
    },

    "messages_before_prompt": 3  # Prompt after N messages
}
```

### 8. Variables Configuration (`variables_config`)

Define dynamic variables for personalization.

```python
variables_config = {
    "enabled": false,

    "variables": [
        {
            "id": "var_1",
            "name": "user_name",
            "type": "text",           # text | email | phone | number | select
            "label": "What's your name?",
            "placeholder": "Enter name",
            "required": true,
            "default_value": "",
            "options": []             # For select type
        }
    ],

    "collection_timing": "before_chat"  # before_chat | on_demand
}
```

## Chatbot Creation Flow

### 5-Step Wizard

1. **Basic Information**: Name, description, greeting message
2. **Prompt & AI Config**: System prompt, model, temperature, instructions
3. **Knowledge Bases**: Attach and configure KBs
4. **Appearance & Behavior**: Colors, position, memory, lead capture
5. **Deployment**: Enable channels, generate API key

### Draft-First Architecture

```python
# Phase 1: Create draft (Redis)
POST /api/v1/chatbots/drafts
{
    "workspace_id": "uuid",
    "name": "Support Bot"
}

# Phase 2: Configure (Redis updates)
PATCH /api/v1/chatbots/drafts/{draft_id}
{
    "updates": {
        "system_prompt": "...",
        "temperature": 0.7
    }
}

# Phase 3: Attach KB
POST /api/v1/chatbots/drafts/{draft_id}/kb
{
    "kb_id": "uuid"
}

# Phase 4: Test
POST /api/v1/chatbots/drafts/{draft_id}/test
{
    "message": "Hello, how can you help?"
}

# Phase 5: Deploy (Creates PostgreSQL record)
POST /api/v1/chatbots/drafts/{draft_id}/deploy
{
    "channels": ["website", "telegram"],
    "is_public": false
}
```

## Message Processing Flow

```python
async def process_message(chatbot, user_message, session_id):
    # 1. Get/create session
    session = get_or_create_session(chatbot.id, session_id)

    # 2. Save user message
    save_message(session.id, "user", user_message)

    # 3. Retrieve KB context (if configured)
    context, sources = await retrieve_context(chatbot, user_message)

    # 4. Get chat history (memory)
    history = get_context_messages(session.id, max_messages=20)

    # 5. Build prompt
    messages = build_messages(chatbot, user_message, context, history)

    # 6. Call AI
    response = await inference_service.generate_chat(
        messages=messages,
        model=chatbot.ai_config.get("model"),
        temperature=chatbot.ai_config.get("temperature")
    )

    # 7. Save response
    save_message(session.id, "assistant", response.text, sources=sources)

    return {
        "response": response.text,
        "sources": sources,
        "session_id": session.id
    }
```

## API Endpoints

### Draft Management
- `POST /api/v1/chatbots/drafts` - Create draft
- `GET /api/v1/chatbots/drafts/{id}` - Get draft
- `PATCH /api/v1/chatbots/drafts/{id}` - Update draft
- `DELETE /api/v1/chatbots/drafts/{id}` - Delete draft
- `POST /api/v1/chatbots/drafts/{id}/deploy` - Deploy

### Chatbot Operations
- `GET /api/v1/chatbots` - List chatbots
- `GET /api/v1/chatbots/{id}` - Get chatbot
- `PATCH /api/v1/chatbots/{id}` - Update chatbot
- `DELETE /api/v1/chatbots/{id}` - Archive (soft delete)
- `POST /api/v1/chatbots/{id}/status` - Change status

### Public Chat API
- `POST /api/v1/public/bots/{id}/chat` - Send message
- `GET /api/v1/public/config/{id}` - Get widget config

## Multi-Channel Context

When messages arrive from different channels:

```python
channel_context = {
    "platform": "telegram",      # web | telegram | discord | whatsapp | api
    "user_id": "123456789",      # Platform user ID
    "username": "@john_doe",
    "first_name": "John",
    "guild_id": "...",           # Discord only
    "from_number": "+1234567"    # WhatsApp only
}
```

This context is available in the session for personalization.

## Session Management

### Session Model

```python
class ChatSession:
    bot_type: "chatbot" | "chatflow"
    bot_id: UUID
    workspace_id: UUID
    session_metadata: JSONB  # User info, channel, preferences
    status: "active" | "idle" | "closed" | "expired"
    message_count: int
    expires_at: datetime  # Default: 24 hours
```

### Message Storage

```python
class ChatMessage:
    session_id: UUID
    role: "user" | "assistant" | "system"
    content: str
    response_metadata: JSONB  # Model, tokens, sources
    feedback: JSONB           # User rating
    prompt_tokens: int
    completion_tokens: int
```

## Analytics & Metrics

Cached metrics updated after each message:

```python
cached_metrics = {
    "total_conversations": 12450,
    "total_messages": 87500,
    "avg_satisfaction": 4.2,
    "resolution_rate": 0.73,
    "avg_response_time_ms": 850,
    "last_updated": "2024-01-15T10:30:00Z"
}
```

## Security

### API Key Authentication

```bash
Authorization: Bearer {api_key}
```

- Keys are hashed (never stored plaintext)
- Shown only once at creation
- Usage tracked (`last_used_at`)
- Can be revoked/regenerated

### Domain Restriction

Web widget can be restricted to specific domains:
```python
"domains": ["example.com", "*.example.com"]
```

### Rate Limiting

```python
"rate_limiting": {
    "messages_per_minute": 10,
    "messages_per_session": 100
}
```
