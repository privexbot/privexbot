# PrivexBot Chatbot Architecture Design Document

> **Version:** 1.0
> **Status:** Design Specification
> **Last Updated:** December 2024
> **Scope:** Complete chatbot feature architecture for PrivexBot platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Multi-Tenancy Architecture](#2-multi-tenancy-architecture)
3. [Chatbot Model Design](#3-chatbot-model-design)
4. [Knowledge Base Integration](#4-knowledge-base-integration)
5. [Complete RAG Flow](#5-complete-rag-flow)
6. [AI Model Configuration](#6-ai-model-configuration)
7. [Prompt Building System](#7-prompt-building-system)
8. [Variable Storage System](#8-variable-storage-system)
9. [Session & Conversation Management](#9-session--conversation-management)
10. [API Key System](#10-api-key-system)
11. [Deployment Channels](#11-deployment-channels)
12. [External Integrations](#12-external-integrations)
13. [Live Support Handoff](#13-live-support-handoff)
14. [Lead Capture System](#14-lead-capture-system)
15. [Dashboard & Analytics](#15-dashboard--analytics)
16. [Security & Compliance](#16-security--compliance)
17. [Implementation Priority](#17-implementation-priority)

---

## 1. Executive Summary

### 1.1 Overview

This document defines the complete architecture for PrivexBot's chatbot feature, designed to seamlessly integrate with the existing Knowledge Base (KB) system. The chatbot feature enables users to create AI-powered conversational agents that leverage RAG (Retrieval-Augmented Generation) to provide accurate, context-aware responses.

### 1.2 Core Value Proposition

PrivexBot differentiates through:
- **Privacy-First**: AI inference runs in Secret VM (Trusted Execution Environments)
- **Draft-First Creation**: Test and configure before deploying
- **Multi-Channel Deployment**: One chatbot, deploy everywhere
- **Flexible RAG**: Multiple KBs with per-chatbot retrieval overrides
- **No-Code Configuration**: UI-based prompt building and branding

### 1.3 Key Design Principles

| Principle | Description |
|-----------|-------------|
| **Tenant Isolation** | Every resource scoped to workspace, verified through org hierarchy |
| **Draft-First** | All creation happens in Redis before PostgreSQL persistence |
| **Unified API** | Same public API for chatbots and chatflows |
| **Separation of Concerns** | Deployment channels vs. external integrations are distinct |
| **Metrics by Design** | Data model supports all 12 dashboard metric categories |

### 1.4 Architecture Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRIVEXBOT PLATFORM                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Organization│  │  Workspace  │  │   Chatbot   │  │   KB       │ │
│  │  (Tenant)   │──│  (Team)     │──│  (Agent)    │──│  (Context) │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                        INFRASTRUCTURE LAYER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ PostgreSQL  │  │    Redis    │  │   Qdrant    │  │ Secret AI  │ │
│  │ (Metadata)  │  │  (Drafts)   │  │  (Vectors)  │  │ (Inference)│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                      DEPLOYMENT CHANNELS                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │
│  │ Widget  │ │Telegram │ │ Discord │ │WhatsApp │ │  Direct API │   │
│  │  (Web)  │ │  (Bot)  │ │  (Bot)  │ │  (Bus.) │ │   (REST)    │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Tenancy Architecture

### 2.1 Hierarchy

```
Organization (Company)
    │
    ├── Settings
    │   ├── subscription_tier: free | pro | enterprise
    │   ├── billing_email
    │   └── organization_settings (JSONB)
    │
    ├── Members
    │   └── OrganizationMember (user_id, role: owner|admin|member)
    │
    └── Workspaces (Teams/Departments)
            │
            ├── Settings
            │   ├── workspace_settings (JSONB)
            │   └── default_ai_config
            │
            ├── Members
            │   └── WorkspaceMember (user_id, role: admin|editor|viewer)
            │
            └── Resources
                ├── Knowledge Bases (Implemented)
                ├── Chatbots (This Design)
                ├── Chatflows (Future)
                ├── Credentials
                ├── API Keys
                └── Leads
```

### 2.2 Tenant Isolation Rules

**CRITICAL**: Every database query MUST verify tenant ownership.

```python
# CORRECT: Always join through hierarchy
def get_chatbot(chatbot_id: UUID, current_user: User, db: Session):
    chatbot = db.query(Chatbot).join(
        Workspace
    ).join(
        Organization
    ).filter(
        Chatbot.id == chatbot_id,
        Organization.id == current_user.organization_id  # CRITICAL
    ).first()

    if not chatbot:
        raise HTTPException(404, "Chatbot not found")
    return chatbot

# WRONG: Direct access without tenant check - SECURITY VULNERABILITY
def get_chatbot_INSECURE(chatbot_id: UUID, db: Session):
    return db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
```

### 2.3 Resource Ownership

| Resource | Primary Key | Tenant Key | Relationship |
|----------|-------------|------------|--------------|
| Chatbot | `id` | `workspace_id` | Workspace → Organization |
| ChatSession | `id` | `workspace_id` | Direct + `bot_id` |
| ChatMessage | `id` | `workspace_id` | Session → Workspace |
| Lead | `id` | `workspace_id` | Direct |
| API Key | `id` | `workspace_id` | Direct |

---

## 3. Chatbot Model Design

### 3.1 SQLAlchemy Model

```python
class ChatbotStatus(str, enum.Enum):
    """Chatbot lifecycle status."""
    DRAFT = "draft"           # In Redis, being configured
    ACTIVE = "active"         # Deployed and operational
    PAUSED = "paused"         # Temporarily disabled
    ARCHIVED = "archived"     # Soft deleted

class Chatbot(Base):
    """Chatbot model - AI conversational agent within a workspace."""

    __tablename__ = "chatbots"

    # ═══════════════════════════════════════════════════════════════
    # IDENTITY
    # ═══════════════════════════════════════════════════════════════
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name = Column(String(100), nullable=False)
    # Display name shown in dashboard and widget header
    # Example: "Customer Support Bot", "Sales Assistant"

    slug = Column(String(100), nullable=False)
    # URL-friendly identifier for public access
    # Format: lowercase, hyphens, no spaces
    # Example: "customer-support-bot"
    # Used in: api.privexbot.com/{workspace_slug}/{chatbot_slug}

    description = Column(Text, nullable=True)
    # Internal description for team reference

    # ═══════════════════════════════════════════════════════════════
    # TENANT ISOLATION (CRITICAL)
    # ═══════════════════════════════════════════════════════════════
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # CRITICAL: Every chatbot belongs to exactly one workspace
    # CASCADE: When workspace deleted, chatbots are deleted

    # ═══════════════════════════════════════════════════════════════
    # LIFECYCLE
    # ═══════════════════════════════════════════════════════════════
    status = Column(
        Enum(ChatbotStatus),
        nullable=False,
        default=ChatbotStatus.DRAFT,
        index=True
    )

    is_public = Column(Boolean, nullable=False, default=False)
    # Whether chatbot is accessible via public URL
    # True: api.privexbot.com/{slug} works
    # False: API key required for all access

    deployed_at = Column(DateTime, nullable=True)
    # When chatbot was first deployed (draft → active)

    # ═══════════════════════════════════════════════════════════════
    # AI CONFIGURATION
    # ═══════════════════════════════════════════════════════════════
    ai_config = Column(JSONB, nullable=False, default={})
    # See Section 6: AI Model Configuration
    # Structure:
    # {
    #     "provider": "secret_ai" | "openai" | "anthropic" | "custom",
    #     "model": "deepseek-r1",
    #     "temperature": 0.7,
    #     "max_tokens": 2000,
    #     "top_p": 0.9,
    #     "frequency_penalty": 0.0,
    #     "presence_penalty": 0.0,
    #     "custom_endpoint": null,  # For custom providers
    #     "credential_id": null     # Reference to Credential model
    # }

    # ═══════════════════════════════════════════════════════════════
    # PROMPT CONFIGURATION
    # ═══════════════════════════════════════════════════════════════
    prompt_config = Column(JSONB, nullable=False, default={})
    # See Section 7: Prompt Building System
    # Structure:
    # {
    #     "system_prompt": "You are a helpful assistant...",
    #     "persona": {
    #         "name": "Alex",
    #         "role": "Customer Support Specialist",
    #         "tone": "friendly",  # friendly | professional | casual
    #         "language": "en"
    #     },
    #     "instructions": [
    #         "Always greet users warmly",
    #         "If unsure, ask clarifying questions"
    #     ],
    #     "restrictions": [
    #         "Never discuss competitor products",
    #         "Do not make up information"
    #     ],
    #     "fallback_message": "I'm not sure about that. Let me connect you with a human.",
    #     "greeting_message": "Hi! How can I help you today?",
    #     "closing_message": "Is there anything else I can help with?"
    # }

    # ═══════════════════════════════════════════════════════════════
    # KNOWLEDGE BASE INTEGRATION
    # ═══════════════════════════════════════════════════════════════
    kb_config = Column(JSONB, nullable=False, default={})
    # See Section 4: Knowledge Base Integration
    # Structure:
    # {
    #     "enabled": true,
    #     "knowledge_bases": [
    #         {
    #             "kb_id": "uuid",
    #             "name": "Product FAQ",  # Cached for display
    #             "enabled": true,
    #             "priority": 1,  # Higher = searched first
    #             "retrieval_override": {
    #                 "top_k": 5,
    #                 "score_threshold": 0.7,
    #                 "strategy": "hybrid_search"
    #             }
    #         }
    #     ],
    #     "context_mode": "chatbot",  # "chatbot" | "both" | "all"
    #     "citation_style": "inline",  # "inline" | "footnote" | "none"
    #     "max_context_tokens": 4000
    # }

    # ═══════════════════════════════════════════════════════════════
    # VARIABLE STORAGE
    # ═══════════════════════════════════════════════════════════════
    variables_config = Column(JSONB, nullable=False, default={})
    # See Section 8: Variable Storage System
    # Structure:
    # {
    #     "system_variables": ["user_name", "user_email", "session_id"],
    #     "custom_variables": [
    #         {
    #             "name": "order_id",
    #             "type": "string",
    #             "capture_method": "extraction",  # "extraction" | "form" | "api"
    #             "extraction_prompt": "Extract order ID from user message"
    #         }
    #     ],
    #     "persistent_across_sessions": ["user_name", "user_email"]
    # }

    # ═══════════════════════════════════════════════════════════════
    # BRANDING & APPEARANCE
    # ═══════════════════════════════════════════════════════════════
    branding_config = Column(JSONB, nullable=False, default={})
    # Structure:
    # {
    #     "avatar_url": "https://...",
    #     "avatar_fallback": "AS",  # Initials if no avatar
    #     "primary_color": "#3b82f6",
    #     "secondary_color": "#8b5cf6",
    #     "text_color": "#1f2937",
    #     "background_color": "#ffffff",
    #     "font_family": "Inter",
    #     "border_radius": "8px",
    #     "widget_position": "bottom-right",  # "bottom-right" | "bottom-left"
    #     "widget_size": "standard",  # "compact" | "standard" | "large"
    #     "show_powered_by": true,
    #     "custom_css": null  # Enterprise only
    # }

    # ═══════════════════════════════════════════════════════════════
    # DEPLOYMENT CHANNELS
    # ═══════════════════════════════════════════════════════════════
    deployment_config = Column(JSONB, nullable=False, default={})
    # See Section 11: Deployment Channels
    # Structure:
    # {
    #     "web_widget": {
    #         "enabled": true,
    #         "domains": ["example.com", "*.example.com"],
    #         "embed_code_generated": true
    #     },
    #     "direct_link": {
    #         "enabled": true,
    #         "url": "https://api.privexbot.com/acme/support-bot"
    #     },
    #     "telegram": {
    #         "enabled": false,
    #         "bot_token_credential_id": null,
    #         "webhook_registered": false
    #     },
    #     "discord": {
    #         "enabled": false,
    #         "bot_token_credential_id": null,
    #         "guild_ids": []
    #     },
    #     "whatsapp": {
    #         "enabled": false,
    #         "phone_number_id": null,
    #         "business_account_id": null
    #     },
    #     "api": {
    #         "enabled": true,
    #         "api_key_id": "uuid"
    #     }
    # }

    # ═══════════════════════════════════════════════════════════════
    # EXTERNAL INTEGRATIONS (Actions/Intents)
    # ═══════════════════════════════════════════════════════════════
    integrations_config = Column(JSONB, nullable=False, default={})
    # See Section 12: External Integrations
    # Structure:
    # {
    #     "enabled_integrations": [
    #         {
    #             "id": "uuid",
    #             "name": "Create Support Ticket",
    #             "type": "webhook",
    #             "trigger": "intent",  # "intent" | "keyword" | "manual"
    #             "intent_name": "create_ticket",
    #             "webhook_url": "https://api.zendesk.com/...",
    #             "method": "POST",
    #             "headers": {"Authorization": "Bearer {{credential:zendesk}}"},
    #             "payload_template": {
    #                 "subject": "{{variables.ticket_subject}}",
    #                 "description": "{{variables.ticket_description}}"
    #             }
    #         }
    #     ],
    #     "zapier": {
    #         "enabled": false,
    #         "webhook_url": null
    #     }
    # }

    # ═══════════════════════════════════════════════════════════════
    # LIVE SUPPORT HANDOFF
    # ═══════════════════════════════════════════════════════════════
    handoff_config = Column(JSONB, nullable=False, default={})
    # See Section 13: Live Support Handoff
    # Structure:
    # {
    #     "enabled": false,
    #     "trigger": "user_request",  # "user_request" | "low_confidence" | "keyword"
    #     "keywords": ["speak to human", "talk to agent"],
    #     "confidence_threshold": 0.3,
    #     "handoff_message": "Let me connect you with a human agent...",
    #     "provider": "internal",  # "internal" | "intercom" | "zendesk" | "freshdesk"
    #     "provider_config": {}
    # }

    # ═══════════════════════════════════════════════════════════════
    # LEAD CAPTURE
    # ═══════════════════════════════════════════════════════════════
    lead_capture_config = Column(JSONB, nullable=False, default={})
    # See Section 14: Lead Capture System
    # Structure:
    # {
    #     "enabled": false,
    #     "timing": "before_chat",  # "before_chat" | "during_chat" | "after_chat"
    #     "required_fields": ["email"],
    #     "optional_fields": ["name", "phone"],
    #     "custom_fields": [
    #         {"name": "company", "label": "Company Name", "type": "text"}
    #     ],
    #     "privacy_notice": "We'll use this to improve your experience.",
    #     "auto_capture_location": true
    # }

    # ═══════════════════════════════════════════════════════════════
    # BEHAVIOR SETTINGS
    # ═══════════════════════════════════════════════════════════════
    behavior_config = Column(JSONB, nullable=False, default={})
    # Structure:
    # {
    #     "memory": {
    #         "enabled": true,
    #         "max_messages": 20,
    #         "summarize_after": 50,  # Summarize context after N messages
    #         "persistence": "session"  # "session" | "user" | "none"
    #     },
    #     "response": {
    #         "typing_indicator": true,
    #         "typing_delay_ms": 500,
    #         "max_response_length": 2000,
    #         "split_long_responses": true
    #     },
    #     "rate_limiting": {
    #         "messages_per_minute": 10,
    #         "messages_per_session": 100
    #     },
    #     "moderation": {
    #         "enabled": true,
    #         "block_profanity": true,
    #         "pii_detection": true,
    #         "custom_blocked_words": []
    #     }
    # }

    # ═══════════════════════════════════════════════════════════════
    # ANALYTICS & METRICS
    # ═══════════════════════════════════════════════════════════════
    analytics_config = Column(JSONB, nullable=False, default={})
    # Structure:
    # {
    #     "track_conversations": true,
    #     "track_satisfaction": true,
    #     "track_intents": true,
    #     "track_sources": true,
    #     "custom_events": ["order_placed", "ticket_created"],
    #     "export_enabled": true,
    #     "retention_days": 90
    # }

    # Cached metrics for fast dashboard display
    cached_metrics = Column(JSONB, nullable=False, default={})
    # Updated by background job every 5 minutes
    # Structure:
    # {
    #     "total_conversations": 12450,
    #     "total_messages": 87500,
    #     "avg_satisfaction": 4.2,
    #     "resolution_rate": 0.73,
    #     "avg_response_time_ms": 850,
    #     "last_updated": "2024-01-15T10:30:00Z"
    # }

    # ═══════════════════════════════════════════════════════════════
    # AUDIT TRAIL
    # ═══════════════════════════════════════════════════════════════
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # ═══════════════════════════════════════════════════════════════
    # RELATIONSHIPS
    # ═══════════════════════════════════════════════════════════════
    workspace = relationship("Workspace", back_populates="chatbots")
    creator = relationship("User", foreign_keys=[created_by])
    api_keys = relationship(
        "APIKey",
        primaryjoin="and_(APIKey.entity_type=='chatbot', "
                    "APIKey.entity_id==Chatbot.id)",
        foreign_keys="APIKey.entity_id",
        viewonly=True
    )

    # ═══════════════════════════════════════════════════════════════
    # INDEXES
    # ═══════════════════════════════════════════════════════════════
    __table_args__ = (
        Index("ix_chatbots_workspace_status", "workspace_id", "status"),
        Index("ix_chatbots_slug", "workspace_id", "slug", unique=True),
        Index("ix_chatbots_created_at", "created_at"),
        {"schema": None}  # Default schema
    )
```

### 3.2 Draft Service Pattern

Following KB's successful pattern, chatbots use draft-first creation:

```python
# Redis key patterns
CHATBOT_DRAFT_KEY = "chatbot_draft:{draft_id}"
CHATBOT_DRAFT_TTL = 86400  # 24 hours

class ChatbotDraftService:
    """Manage chatbot drafts in Redis before PostgreSQL persistence."""

    async def create_draft(
        self,
        workspace_id: UUID,
        name: str,
        created_by: UUID
    ) -> dict:
        """Create new chatbot draft in Redis."""
        draft_id = str(uuid.uuid4())

        draft_data = {
            "id": draft_id,
            "workspace_id": str(workspace_id),
            "name": name,
            "status": "draft",
            "created_by": str(created_by),
            "created_at": datetime.utcnow().isoformat(),

            # Initialize with defaults
            "ai_config": {
                "provider": "secret_ai",
                "model": "deepseek-r1",
                "temperature": 0.7,
                "max_tokens": 2000
            },
            "prompt_config": {
                "system_prompt": "",
                "greeting_message": "Hi! How can I help you today?"
            },
            "kb_config": {
                "enabled": False,
                "knowledge_bases": []
            },
            "branding_config": {
                "primary_color": "#3b82f6",
                "widget_position": "bottom-right"
            },
            # ... other default configs
        }

        await self.redis.set(
            f"chatbot_draft:{draft_id}",
            json.dumps(draft_data),
            ex=CHATBOT_DRAFT_TTL
        )

        return draft_data

    async def update_draft(
        self,
        draft_id: str,
        updates: dict
    ) -> dict:
        """Update draft configuration."""
        draft_data = await self.get_draft(draft_id)
        if not draft_data:
            raise ValueError("Draft not found")

        # Deep merge updates
        draft_data = deep_merge(draft_data, updates)
        draft_data["updated_at"] = datetime.utcnow().isoformat()

        await self.redis.set(
            f"chatbot_draft:{draft_id}",
            json.dumps(draft_data),
            ex=CHATBOT_DRAFT_TTL  # Extend TTL on update
        )

        return draft_data

    async def preview_chat(
        self,
        draft_id: str,
        message: str,
        session_id: str
    ) -> dict:
        """Test chatbot from draft (no DB persistence)."""
        draft_data = await self.get_draft(draft_id)
        if not draft_data:
            raise ValueError("Draft not found")

        # Build temporary chatbot from draft config
        # Call inference with draft's AI config
        # Use draft's KB config for retrieval
        # Return response (not stored in DB)

        return {
            "response": "...",
            "sources": [],
            "session_id": session_id
        }

    async def deploy(
        self,
        draft_id: str,
        db: Session
    ) -> Chatbot:
        """Deploy draft to production (save to PostgreSQL)."""
        draft_data = await self.get_draft(draft_id)
        if not draft_data:
            raise ValueError("Draft not found")

        # Validate required fields
        self._validate_for_deployment(draft_data)

        # Create PostgreSQL record
        chatbot = Chatbot(
            id=uuid.UUID(draft_data["id"]),
            name=draft_data["name"],
            slug=slugify(draft_data["name"]),
            workspace_id=uuid.UUID(draft_data["workspace_id"]),
            status=ChatbotStatus.ACTIVE,
            ai_config=draft_data["ai_config"],
            prompt_config=draft_data["prompt_config"],
            kb_config=draft_data["kb_config"],
            branding_config=draft_data["branding_config"],
            deployment_config=draft_data["deployment_config"],
            # ... all other configs
            created_by=uuid.UUID(draft_data["created_by"]),
            deployed_at=datetime.utcnow()
        )

        db.add(chatbot)
        db.commit()

        # Generate API key for chatbot
        api_key = await self._generate_chatbot_api_key(chatbot, db)

        # Register webhooks for enabled channels
        await self._register_deployment_channels(chatbot, db)

        # Delete draft from Redis
        await self.redis.delete(f"chatbot_draft:{draft_id}")

        return chatbot
```

---

## 4. Knowledge Base Integration

### 4.1 Access Control: kb_context

Knowledge bases have a `kb_context` field that controls access:

| kb_context | Description | Accessible By |
|------------|-------------|---------------|
| `chatbot` | KB dedicated to specific chatbot | Only linked chatbots |
| `chatflow` | KB dedicated to chatflows | Only linked chatflows |
| `both` | Available to both types | Chatbots and chatflows |
| `workspace` | Available to all resources | Any resource in workspace |

```python
# KB model field
kb_context = Column(
    Enum(KBContext),
    nullable=False,
    default=KBContext.WORKSPACE
)

# Query pattern for chatbot KB access
def get_accessible_kbs(workspace_id: UUID, for_type: str = "chatbot"):
    """Get KBs accessible by chatbots in workspace."""
    return db.query(KnowledgeBase).filter(
        KnowledgeBase.workspace_id == workspace_id,
        KnowledgeBase.status == KBStatus.ACTIVE,
        KnowledgeBase.kb_context.in_(["chatbot", "both", "workspace"])
    ).all()
```

### 4.2 Chatbot KB Configuration

```json
{
    "kb_config": {
        "enabled": true,
        "knowledge_bases": [
            {
                "kb_id": "uuid-1",
                "name": "Product FAQ",
                "enabled": true,
                "priority": 1,
                "retrieval_override": {
                    "top_k": 5,
                    "score_threshold": 0.7,
                    "strategy": "hybrid_search"
                }
            },
            {
                "kb_id": "uuid-2",
                "name": "Technical Docs",
                "enabled": true,
                "priority": 2,
                "retrieval_override": null
            }
        ],
        "merge_strategy": "priority",
        "citation_style": "inline",
        "max_context_tokens": 4000,
        "fallback_behavior": "answer_without_context"
    }
}
```

### 4.3 Multi-KB Retrieval

```python
async def retrieve_from_multiple_kbs(
    chatbot: Chatbot,
    query: str,
    max_results: int = 10
) -> list[dict]:
    """Retrieve from all enabled KBs with per-KB overrides."""

    kb_config = chatbot.kb_config
    if not kb_config.get("enabled"):
        return []

    all_results = []

    # Sort by priority
    kbs = sorted(
        kb_config["knowledge_bases"],
        key=lambda x: x.get("priority", 99)
    )

    for kb_entry in kbs:
        if not kb_entry.get("enabled"):
            continue

        kb_id = kb_entry["kb_id"]
        override = kb_entry.get("retrieval_override") or {}

        # Get KB's default retrieval config
        kb = await get_knowledge_base(kb_id)
        retrieval_config = {
            **kb.retrieval_config,  # KB defaults
            **override              # Chatbot overrides
        }

        # Perform search with merged config
        results = await qdrant_service.search(
            collection_name=f"kb_{kb_id}",
            query=query,
            top_k=retrieval_config.get("top_k", 5),
            score_threshold=retrieval_config.get("score_threshold", 0.7),
            strategy=retrieval_config.get("strategy", "hybrid_search")
        )

        # Tag results with source KB
        for r in results:
            r["source_kb_id"] = kb_id
            r["source_kb_name"] = kb_entry["name"]

        all_results.extend(results)

    # Merge strategy
    if kb_config.get("merge_strategy") == "priority":
        # Already sorted by priority, take top N
        return all_results[:max_results]
    elif kb_config.get("merge_strategy") == "score":
        # Sort by score across all KBs
        return sorted(all_results, key=lambda x: x["score"], reverse=True)[:max_results]

    return all_results
```

---

## 5. Complete RAG Flow

### 5.1 End-to-End Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE RAG FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  User   │───▶│   Channel   │───▶│  Public API │───▶│  Auth/Validate  │  │
│  │ Message │    │  (Widget/   │    │  Endpoint   │    │  API Key        │  │
│  └─────────┘    │  Telegram)  │    └─────────────┘    └────────┬────────┘  │
│                 └─────────────┘                                 │           │
│                                                                 ▼           │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        CHATBOT SERVICE                                 │ │
│  │                                                                        │ │
│  │  1. Load Session ──────────────────────────────────────────────────▶  │ │
│  │     ┌──────────────────────────────────────────────────────────────┐  │ │
│  │     │ session = get_or_create_session(bot_id, session_id)         │  │ │
│  │     │ history = session.messages[-20:]  # Last 20 messages        │  │ │
│  │     │ variables = session.metadata.get("variables", {})           │  │ │
│  │     └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  2. Extract Variables ─────────────────────────────────────────────▶  │ │
│  │     ┌──────────────────────────────────────────────────────────────┐  │ │
│  │     │ if chatbot.variables_config.get("custom_variables"):        │  │ │
│  │     │     extracted = extract_variables(message, config)          │  │ │
│  │     │     variables.update(extracted)                             │  │ │
│  │     └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  3. KB Retrieval (RAG) ────────────────────────────────────────────▶  │ │
│  │     ┌──────────────────────────────────────────────────────────────┐  │ │
│  │     │ if chatbot.kb_config.get("enabled"):                        │  │ │
│  │     │     # Generate search query from conversation               │  │ │
│  │     │     search_query = generate_search_query(message, history)  │  │ │
│  │     │                                                             │  │ │
│  │     │     # Retrieve from enabled KBs                             │  │ │
│  │     │     chunks = await retrieve_from_multiple_kbs(              │  │ │
│  │     │         chatbot, search_query                               │  │ │
│  │     │     )                                                       │  │ │
│  │     │                                                             │  │ │
│  │     │     # Build context string                                  │  │ │
│  │     │     context = format_context(chunks, max_tokens=4000)       │  │ │
│  │     └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  4. Build Prompt ──────────────────────────────────────────────────▶  │ │
│  │     ┌──────────────────────────────────────────────────────────────┐  │ │
│  │     │ system_prompt = build_system_prompt(                        │  │ │
│  │     │     chatbot.prompt_config,                                  │  │ │
│  │     │     context,                                                │  │ │
│  │     │     variables                                               │  │ │
│  │     │ )                                                           │  │ │
│  │     │                                                             │  │ │
│  │     │ messages = [                                                │  │ │
│  │     │     {"role": "system", "content": system_prompt},           │  │ │
│  │     │     *history,  # Previous messages                          │  │ │
│  │     │     {"role": "user", "content": message}                    │  │ │
│  │     │ ]                                                           │  │ │
│  │     └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  5. AI Inference (Secret AI) ──────────────────────────────────────▶  │ │
│  │     ┌──────────────────────────────────────────────────────────────┐  │ │
│  │     │ response = await inference_service.generate(                │  │ │
│  │     │     messages=messages,                                      │  │ │
│  │     │     model=chatbot.ai_config["model"],                       │  │ │
│  │     │     temperature=chatbot.ai_config["temperature"],           │  │ │
│  │     │     max_tokens=chatbot.ai_config["max_tokens"]              │  │ │
│  │     │ )                                                           │  │ │
│  │     └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  6. Post-Processing ───────────────────────────────────────────────▶  │ │
│  │     ┌──────────────────────────────────────────────────────────────┐  │ │
│  │     │ # Add citations if configured                               │  │ │
│  │     │ if chatbot.kb_config.get("citation_style") == "inline":     │  │ │
│  │     │     response_text = add_inline_citations(                   │  │ │
│  │     │         response.text, chunks                               │  │ │
│  │     │     )                                                       │  │ │
│  │     │                                                             │  │ │
│  │     │ # Check for handoff triggers                                │  │ │
│  │     │ if should_handoff(response, chatbot.handoff_config):        │  │ │
│  │     │     await initiate_handoff(session)                         │  │ │
│  │     │                                                             │  │ │
│  │     │ # Execute integrations                                      │  │ │
│  │     │ await execute_integrations(message, response, chatbot)      │  │ │
│  │     └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  7. Store Messages ────────────────────────────────────────────────▶  │ │
│  │     ┌──────────────────────────────────────────────────────────────┐  │ │
│  │     │ # User message                                              │  │ │
│  │     │ user_msg = ChatMessage(                                     │  │ │
│  │     │     session_id=session.id,                                  │  │ │
│  │     │     role="user",                                            │  │ │
│  │     │     content=message                                         │  │ │
│  │     │ )                                                           │  │ │
│  │     │                                                             │  │ │
│  │     │ # Assistant message with metadata                           │  │ │
│  │     │ assistant_msg = ChatMessage(                                │  │ │
│  │     │     session_id=session.id,                                  │  │ │
│  │     │     role="assistant",                                       │  │ │
│  │     │     content=response_text,                                  │  │ │
│  │     │     response_metadata={                                     │  │ │
│  │     │         "model": response.model,                            │  │ │
│  │     │         "sources": [                                        │  │ │
│  │     │             {                                               │  │ │
│  │     │                 "kb_id": c["source_kb_id"],                 │  │ │
│  │     │                 "document_id": c["document_id"],            │  │ │
│  │     │                 "chunk_id": c["chunk_id"],                  │  │ │
│  │     │                 "score": c["score"]                         │  │ │
│  │     │             } for c in chunks                               │  │ │
│  │     │         ],                                                  │  │ │
│  │     │         "latency_ms": response.latency_ms                   │  │ │
│  │     │     },                                                      │  │ │
│  │     │     prompt_tokens=response.prompt_tokens,                   │  │ │
│  │     │     completion_tokens=response.completion_tokens            │  │ │
│  │     │ )                                                           │  │ │
│  │     │                                                             │  │ │
│  │     │ db.add_all([user_msg, assistant_msg])                       │  │ │
│  │     │ db.commit()                                                 │  │ │
│  │     └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────┐                                                            │
│  │   Return    │◀───────────────────────────────────────────────────────── │
│  │  Response   │    {response, sources, session_id, message_id}            │
│  └─────────────┘                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Chatbot Service Implementation

```python
class ChatbotService:
    """Core service for processing chatbot messages."""

    def __init__(
        self,
        inference_service: InferenceService,
        retrieval_service: RetrievalService,
        session_service: SessionService
    ):
        self.inference = inference_service
        self.retrieval = retrieval_service
        self.sessions = session_service

    async def process_message(
        self,
        db: Session,
        chatbot: Chatbot,
        user_message: str,
        session_id: str,
        channel_context: dict
    ) -> dict:
        """Process user message and generate response."""

        start_time = time.time()

        # 1. Get or create session
        session = await self.sessions.get_or_create(
            db=db,
            bot_type="chatbot",
            bot_id=chatbot.id,
            workspace_id=chatbot.workspace_id,
            session_id=session_id,
            channel_context=channel_context
        )

        # 2. Load conversation history
        history = await self.sessions.get_history(
            session_id=session.id,
            max_messages=chatbot.behavior_config.get("memory", {}).get("max_messages", 20)
        )

        # 3. Extract variables
        variables = session.session_metadata.get("variables", {})
        if chatbot.variables_config.get("custom_variables"):
            extracted = await self._extract_variables(
                user_message,
                chatbot.variables_config["custom_variables"]
            )
            variables.update(extracted)

        # 4. Retrieve from knowledge bases
        context_chunks = []
        if chatbot.kb_config.get("enabled"):
            context_chunks = await self._retrieve_context(
                chatbot,
                user_message,
                history
            )

        # 5. Build system prompt
        system_prompt = self._build_system_prompt(
            chatbot.prompt_config,
            context_chunks,
            variables
        )

        # 6. Prepare messages for inference
        messages = self._build_messages(
            system_prompt,
            history,
            user_message
        )

        # 7. Call inference service
        try:
            response = await self.inference.generate(
                messages=messages,
                **chatbot.ai_config
            )
        except Exception as e:
            return await self._handle_error(session, user_message, e)

        # 8. Post-process response
        response_text = response.text

        # Add citations if configured
        if chatbot.kb_config.get("citation_style") == "inline" and context_chunks:
            response_text = self._add_inline_citations(response_text, context_chunks)

        # 9. Check for handoff triggers
        if await self._should_handoff(user_message, response, chatbot):
            await self._initiate_handoff(session, chatbot)

        # 10. Execute integrations
        await self._execute_integrations(
            user_message,
            response_text,
            variables,
            chatbot
        )

        # 11. Store messages
        user_msg = await self.sessions.add_message(
            db=db,
            session_id=session.id,
            role="user",
            content=user_message
        )

        assistant_msg = await self.sessions.add_message(
            db=db,
            session_id=session.id,
            role="assistant",
            content=response_text,
            response_metadata={
                "model": chatbot.ai_config.get("model"),
                "sources": [
                    {
                        "kb_id": str(c.get("source_kb_id")),
                        "document_id": str(c.get("document_id")),
                        "chunk_id": str(c.get("chunk_id")),
                        "content_preview": c.get("content", "")[:200],
                        "score": c.get("score")
                    } for c in context_chunks
                ],
                "latency_ms": int((time.time() - start_time) * 1000),
                "variables_used": list(variables.keys())
            },
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens
        )

        # 12. Update session metadata
        await self.sessions.update_metadata(
            session_id=session.id,
            updates={"variables": variables}
        )

        return {
            "response": response_text,
            "sources": [
                {
                    "title": c.get("document_name", "Unknown"),
                    "content_preview": c.get("content", "")[:200],
                    "score": c.get("score")
                } for c in context_chunks
            ],
            "session_id": session_id,
            "message_id": str(assistant_msg.id)
        }
```

---

## 6. AI Model Configuration

### 6.1 Supported Providers

| Provider | Models | Use Case |
|----------|--------|----------|
| **Secret AI** (Default) | deepseek-r1, llama-3.3-70b | Privacy-first, production |
| OpenAI | gpt-4o, gpt-4-turbo | High capability |
| Anthropic | claude-3-opus, claude-3-sonnet | Analysis, safety |
| Custom | Any OpenAI-compatible | Self-hosted, specialized |

### 6.2 Configuration Structure

```json
{
    "ai_config": {
        "provider": "secret_ai",
        "model": "deepseek-r1",

        "parameters": {
            "temperature": 0.7,
            "max_tokens": 2000,
            "top_p": 0.9,
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0
        },

        "custom_provider": {
            "enabled": false,
            "endpoint": "https://custom.api.com/v1/chat/completions",
            "credential_id": "uuid",
            "headers": {
                "X-Custom-Header": "value"
            }
        },

        "fallback": {
            "enabled": true,
            "provider": "openai",
            "model": "gpt-4o-mini",
            "trigger": "error"
        }
    }
}
```

### 6.3 Inference Service (Existing)

The existing `inference_service.py` handles Secret AI integration:

```python
# Existing pattern - no changes needed
async def generate(
    self,
    messages: list[dict],
    model: str = "deepseek-r1",
    temperature: float = 0.7,
    max_tokens: int = 2000,
    **kwargs
) -> InferenceResponse:
    """Generate AI response using configured provider."""

    # Secret AI uses OpenAI-compatible API
    response = await self.client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        **kwargs
    )

    return InferenceResponse(
        text=response.choices[0].message.content,
        model=model,
        prompt_tokens=response.usage.prompt_tokens,
        completion_tokens=response.usage.completion_tokens,
        latency_ms=response.response_ms
    )
```

---

## 7. Prompt Building System

### 7.1 UI Configuration Schema

```json
{
    "prompt_config": {
        "persona": {
            "name": "Alex",
            "role": "Customer Support Specialist",
            "tone": "friendly",
            "expertise": ["Product questions", "Billing", "Technical support"]
        },

        "system_prompt": "You are {{persona.name}}, a {{persona.role}}...",

        "instructions": [
            {
                "id": "inst_1",
                "priority": 1,
                "text": "Always greet users warmly",
                "enabled": true
            },
            {
                "id": "inst_2",
                "priority": 2,
                "text": "Ask clarifying questions when unsure",
                "enabled": true
            }
        ],

        "restrictions": [
            {
                "id": "rest_1",
                "text": "Never discuss competitor products",
                "enabled": true
            },
            {
                "id": "rest_2",
                "text": "Do not make up information not in the knowledge base",
                "enabled": true
            }
        ],

        "context_instructions": {
            "with_context": "Use the following information to answer: {context}",
            "without_context": "Answer based on your general knowledge."
        },

        "messages": {
            "greeting": "Hi! I'm {{persona.name}}. How can I help you today?",
            "fallback": "I'm not sure about that. Would you like me to connect you with a human?",
            "closing": "Is there anything else I can help with?",
            "error": "I apologize, but I'm having trouble processing your request. Please try again."
        },

        "language": {
            "primary": "en",
            "auto_detect": true,
            "respond_in_user_language": true
        }
    }
}
```

### 7.2 System Prompt Builder

```python
def build_system_prompt(
    prompt_config: dict,
    context_chunks: list[dict],
    variables: dict
) -> str:
    """Build complete system prompt from configuration."""

    # Start with base prompt
    base_prompt = prompt_config.get("system_prompt", "")

    # Replace persona variables
    persona = prompt_config.get("persona", {})
    for key, value in persona.items():
        if isinstance(value, list):
            value = ", ".join(value)
        base_prompt = base_prompt.replace(f"{{{{persona.{key}}}}}", str(value))

    # Replace custom variables
    for key, value in variables.items():
        base_prompt = base_prompt.replace(f"{{{{variables.{key}}}}}", str(value))

    # Add instructions
    instructions = prompt_config.get("instructions", [])
    enabled_instructions = [
        i["text"] for i in sorted(instructions, key=lambda x: x.get("priority", 99))
        if i.get("enabled", True)
    ]
    if enabled_instructions:
        base_prompt += "\n\nInstructions:\n"
        base_prompt += "\n".join(f"- {inst}" for inst in enabled_instructions)

    # Add restrictions
    restrictions = prompt_config.get("restrictions", [])
    enabled_restrictions = [r["text"] for r in restrictions if r.get("enabled", True)]
    if enabled_restrictions:
        base_prompt += "\n\nRestrictions:\n"
        base_prompt += "\n".join(f"- {rest}" for rest in enabled_restrictions)

    # Add context
    context_instructions = prompt_config.get("context_instructions", {})
    if context_chunks:
        context_text = "\n\n".join([
            f"[Source: {c.get('document_name', 'Unknown')}]\n{c.get('content', '')}"
            for c in context_chunks
        ])
        context_prompt = context_instructions.get(
            "with_context",
            "Use the following information to answer:\n{context}"
        )
        base_prompt += "\n\n" + context_prompt.replace("{context}", context_text)
    else:
        base_prompt += "\n\n" + context_instructions.get(
            "without_context",
            "Answer based on your general knowledge."
        )

    return base_prompt
```

---

## 8. Variable Storage System

### 8.1 Variable Types

| Type | Description | Example |
|------|-------------|---------|
| **System** | Auto-captured by platform | `user_name`, `session_id`, `channel` |
| **Extracted** | AI extracts from conversation | `order_id`, `product_name` |
| **Form** | User provides via lead capture | `email`, `phone`, `company` |
| **API** | Received from external API | `customer_tier`, `account_status` |

### 8.2 Configuration Schema

```json
{
    "variables_config": {
        "system_variables": {
            "enabled": ["user_name", "user_email", "session_id", "channel", "timestamp"],
            "display_names": {
                "user_name": "Customer Name",
                "user_email": "Customer Email"
            }
        },

        "custom_variables": [
            {
                "name": "order_id",
                "type": "string",
                "description": "Customer's order ID",
                "capture_method": "extraction",
                "extraction_config": {
                    "prompt": "Extract order ID (format: ORD-XXXXX) from user message",
                    "pattern": "ORD-[A-Z0-9]{5}",
                    "required": false
                }
            },
            {
                "name": "issue_category",
                "type": "enum",
                "description": "Type of support issue",
                "capture_method": "extraction",
                "extraction_config": {
                    "prompt": "Categorize the user's issue",
                    "options": ["billing", "technical", "product", "other"]
                }
            },
            {
                "name": "customer_tier",
                "type": "string",
                "capture_method": "api",
                "api_config": {
                    "endpoint": "{{integrations.crm}}/customers/{{variables.user_email}}/tier",
                    "cache_duration": 3600
                }
            }
        ],

        "persistence": {
            "session_variables": ["order_id", "issue_category"],
            "user_variables": ["user_name", "customer_tier"]
        }
    }
}
```

### 8.3 Variable Extraction Service

```python
async def extract_variables(
    message: str,
    history: list[dict],
    variable_configs: list[dict]
) -> dict:
    """Extract configured variables from conversation."""

    extracted = {}

    for var_config in variable_configs:
        if var_config["capture_method"] != "extraction":
            continue

        extraction_config = var_config.get("extraction_config", {})

        # Pattern-based extraction (fast)
        if pattern := extraction_config.get("pattern"):
            import re
            match = re.search(pattern, message)
            if match:
                extracted[var_config["name"]] = match.group(0)
                continue

        # AI-based extraction (more accurate)
        if prompt := extraction_config.get("prompt"):
            extraction_result = await inference_service.generate(
                messages=[
                    {"role": "system", "content": f"Extract the following: {prompt}"},
                    {"role": "user", "content": f"Conversation:\n{format_history(history)}\n\nLatest message: {message}"}
                ],
                model="gpt-4o-mini",  # Use faster model for extraction
                temperature=0,
                max_tokens=100
            )

            if extraction_result.text.strip().lower() not in ["none", "n/a", ""]:
                extracted[var_config["name"]] = extraction_result.text.strip()

    return extracted
```

---

## 9. Session & Conversation Management

### 9.1 Existing Models (Implemented)

The `ChatSession` and `ChatMessage` models are already implemented in SQLAlchemy:

**ChatSession** (`models/chat_session.py`):
- Polymorphic bot reference (`bot_type` + `bot_id`)
- Session metadata (JSONB): user info, location, channel, preferences
- Status lifecycle: active → idle → closed → expired
- Message count tracking

**ChatMessage** (`models/chat_message.py`):
- Role enum: user, assistant, system
- Response metadata (JSONB): model, sources, latency
- Feedback tracking: rating, comment, submitted_at
- Token tracking for cost management

### 9.2 Session Service

```python
class SessionService:
    """Manage chat sessions and conversation history."""

    async def get_or_create(
        self,
        db: Session,
        bot_type: str,
        bot_id: UUID,
        workspace_id: UUID,
        session_id: str,
        channel_context: dict
    ) -> ChatSession:
        """Get existing session or create new one."""

        # Try to find existing session
        session = db.query(ChatSession).filter(
            ChatSession.bot_type == bot_type,
            ChatSession.bot_id == bot_id,
            ChatSession.id == session_id,
            ChatSession.status.in_(["active", "idle"])
        ).first()

        if session:
            # Reactivate if idle
            if session.status == "idle":
                session.status = SessionStatus.ACTIVE
            session.last_message_at = datetime.utcnow()
            db.commit()
            return session

        # Create new session
        session = ChatSession(
            id=uuid.UUID(session_id) if is_valid_uuid(session_id) else uuid.uuid4(),
            bot_type=BotType(bot_type),
            bot_id=bot_id,
            workspace_id=workspace_id,
            session_metadata={
                "user": channel_context.get("user", {}),
                "channel": channel_context.get("channel", {"type": "web"}),
                "location": channel_context.get("location", {}),
                "utm": channel_context.get("utm", {})
            },
            status=SessionStatus.ACTIVE,
            message_count=0
        )

        db.add(session)
        db.commit()
        return session

    async def get_history(
        self,
        session_id: UUID,
        max_messages: int = 20
    ) -> list[dict]:
        """Get recent conversation history."""

        messages = db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id
        ).order_by(
            ChatMessage.created_at.desc()
        ).limit(max_messages).all()

        # Return in chronological order
        return [
            {"role": msg.role.value, "content": msg.content}
            for msg in reversed(messages)
        ]

    async def add_message(
        self,
        db: Session,
        session_id: UUID,
        role: str,
        content: str,
        **kwargs
    ) -> ChatMessage:
        """Add message to session."""

        session = db.query(ChatSession).get(session_id)

        message = ChatMessage(
            session_id=session_id,
            workspace_id=session.workspace_id,
            role=MessageRole(role),
            content=content,
            response_metadata=kwargs.get("response_metadata"),
            prompt_tokens=kwargs.get("prompt_tokens"),
            completion_tokens=kwargs.get("completion_tokens"),
            total_tokens=(kwargs.get("prompt_tokens", 0) or 0) + (kwargs.get("completion_tokens", 0) or 0)
        )

        db.add(message)

        # Update session stats
        session.message_count += 1
        session.last_message_at = datetime.utcnow()

        db.commit()
        return message
```

---

## 10. API Key System

### 10.1 Key Format

```
{prefix}_{env}_{random}

prefix: "sk" (secret key) or "pk" (public key)
env: "live" or "test"
random: 32 bytes base64-encoded

### 10.2 Chatbot API Key Generation

```python
async def generate_chatbot_api_key(
    chatbot: Chatbot,
    db: Session,
    key_type: str = "public"  # "public" | "secret"
) -> tuple[str, APIKey]:
    """Generate API key for chatbot."""

    # Generate secure random key
    import secrets
    random_part = secrets.token_urlsafe(32)

    # Determine prefix and env
    prefix = "pk" if key_type == "public" else "sk"
    env = "live"  # Could check chatbot.workspace for environment

    plain_key = f"{prefix}_{env}_{random_part}"

    # Hash for storage
    import hashlib
    key_hash = hashlib.sha256(plain_key.encode()).hexdigest()
    key_prefix = plain_key[:15] + "..."

    # Create API key record
    api_key = APIKey(
        name=f"{chatbot.name} API Key",
        key_hash=key_hash,
        key_prefix=key_prefix,
        workspace_id=chatbot.workspace_id,
        entity_type="chatbot",
        entity_id=chatbot.id,
        permissions=["read", "execute"] if key_type == "public" else ["read", "write", "execute"],
        rate_limit_config={
            "requests_per_minute": 60,
            "requests_per_hour": 1000,
            "requests_per_day": 10000
        },
        is_active=True,
        created_by=chatbot.created_by
    )

    db.add(api_key)
    db.commit()

    # Return plain key (only shown once)
    return plain_key, api_key
```

### 10.3 Public API Endpoint (Existing)

The existing `public.py` provides the unified chat endpoint:

```python
@router.post("/bots/{bot_id}/chat")
async def chat(
    bot_id: UUID,
    request: ChatRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> ChatResponse:
    """Unified chat endpoint for both chatbots and chatflows."""

    # Extract and validate API key
    api_key = extract_bearer_token(authorization)
    bot_type, bot, workspace_id = await validate_api_key(db, bot_id, api_key)

    # Route to appropriate service
    if bot_type == "chatbot":
        response = await chatbot_service.process_message(
            db=db,
            chatbot=bot,
            user_message=request.message,
            session_id=request.session_id or generate_session_id(),
            channel_context={"platform": "api", "metadata": request.metadata}
        )
    else:
        response = await chatflow_service.execute(...)

    return ChatResponse(
        response=response["response"],
        sources=response.get("sources"),
        session_id=response["session_id"],
        message_id=response["message_id"]
    )
```

---

## 11. Deployment Channels

### 11.1 Channel Overview

| Channel | Type | Setup Complexity | User Experience |
|---------|------|------------------|-----------------|
| **Web Widget** | Embedded JS | Low | Best (full features) |
| **Direct Link** | Hosted page | Lowest | Good (standalone) |
| **Telegram** | Bot webhook | Medium | Native Telegram |
| **Discord** | Bot webhook | Medium | Native Discord |
| **WhatsApp** | Business API | High | Native WhatsApp |
| **API** | REST calls | Low | Flexible |

### 11.2 Web Widget Deployment

```javascript
// Embed code generated for each chatbot
<script>
  (function(w, d, s, o, f, js, fjs) {
    w['PrivexBot'] = o;
    w[o] = w[o] || function() {
      (w[o].q = w[o].q || []).push(arguments)
    };
    js = d.createElement(s);
    fjs = d.getElementsByTagName(s)[0];
    js.id = o;
    js.src = f;
    js.async = 1;
    fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'pb', 'https://widget.privexbot.com/v1/loader.js'));

  pb('init', {
    chatbotId: 'CHATBOT_UUID',
    apiKey: '_...',
    theme: 'auto'
  });
</script>
```

### 11.3 Direct Link (Hosted Chat)

```
Format: https://api.privexbot.com/{workspace_slug}/{chatbot_slug}

Example: https://api.privexbot.com/acme-corp/support-bot

Features:
- Full-page chat experience
- Shareable link
- SEO-friendly (optional)
- Custom branding applied
```

### 11.4 Telegram Integration

```python
class TelegramIntegration:
    """Telegram bot integration for chatbot deployment."""

    async def register_webhook(
        self,
        chatbot: Chatbot,
        bot_token: str
    ) -> bool:
        """Register webhook with Telegram."""

        webhook_url = f"https://api.privexbot.com/webhooks/telegram/{chatbot.id}"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{bot_token}/setWebhook",
                json={
                    "url": webhook_url,
                    "allowed_updates": ["message", "callback_query"]
                }
            )

        return response.json().get("ok", False)

    async def handle_message(
        self,
        chatbot_id: UUID,
        update: dict,
        db: Session
    ):
        """Handle incoming Telegram message."""

        message = update.get("message", {})
        chat_id = message.get("chat", {}).get("id")
        text = message.get("text", "")
        user = message.get("from", {})

        # Get chatbot
        chatbot = db.query(Chatbot).get(chatbot_id)

        # Process through chatbot service
        response = await chatbot_service.process_message(
            db=db,
            chatbot=chatbot,
            user_message=text,
            session_id=f"tg_{chat_id}",
            channel_context={
                "channel": {"type": "telegram", "chat_id": chat_id},
                "user": {
                    "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                    "username": user.get("username"),
                    "platform_id": str(user.get("id"))
                }
            }
        )

        # Send response back to Telegram
        await self._send_message(
            bot_token=chatbot.deployment_config["telegram"]["bot_token"],
            chat_id=chat_id,
            text=response["response"]
        )
```

### 11.5 Discord Integration

Similar pattern to Telegram with Discord-specific handling:

```python
class DiscordIntegration:
    """Discord bot integration."""

    async def handle_message(
        self,
        chatbot_id: UUID,
        message_data: dict,
        db: Session
    ):
        """Handle Discord message via webhook."""

        chatbot = db.query(Chatbot).get(chatbot_id)

        response = await chatbot_service.process_message(
            db=db,
            chatbot=chatbot,
            user_message=message_data["content"],
            session_id=f"dc_{message_data['channel_id']}_{message_data['author']['id']}",
            channel_context={
                "channel": {
                    "type": "discord",
                    "guild_id": message_data.get("guild_id"),
                    "channel_id": message_data["channel_id"]
                },
                "user": {
                    "name": message_data["author"]["username"],
                    "platform_id": message_data["author"]["id"]
                }
            }
        )

        # Send response via Discord webhook
        await self._send_discord_message(
            webhook_url=chatbot.deployment_config["discord"]["webhook_url"],
            content=response["response"]
        )
```

---

## 12. External Integrations

### 12.1 Distinction from Deployment Channels

| Aspect | Deployment Channels | External Integrations |
|--------|---------------------|----------------------|
| **Purpose** | Where users chat | Actions chatbot can perform |
| **Direction** | Inbound (users to bot) | Outbound (bot to services) |
| **Examples** | Telegram, Discord, Widget | Zendesk, Zapier, CRM |
| **Trigger** | Always active | Intent/keyword triggered |

### 12.2 Integration Types

```json
{
    "integrations_config": {
        "webhooks": [
            {
                "id": "int_001",
                "name": "Create Support Ticket",
                "type": "webhook",
                "enabled": true,
                "trigger": {
                    "type": "intent",
                    "intent_name": "create_ticket",
                    "confidence_threshold": 0.8
                },
                "webhook": {
                    "url": "https://api.zendesk.com/api/v2/tickets",
                    "method": "POST",
                    "headers": {
                        "Authorization": "Basic {{credential:zendesk_api}}",
                        "Content-Type": "application/json"
                    },
                    "body_template": {
                        "ticket": {
                            "subject": "{{variables.ticket_subject}}",
                            "description": "{{variables.conversation_summary}}",
                            "requester": {
                                "email": "{{variables.user_email}}"
                            }
                        }
                    }
                },
                "response_handling": {
                    "success_message": "I've created ticket #{{response.ticket.id}} for you.",
                    "error_message": "Sorry, I couldn't create the ticket. Please try again."
                }
            }
        ],

        "zapier": {
            "enabled": true,
            "webhook_url": "https://hooks.zapier.com/hooks/catch/xxx/yyy/",
            "events": ["lead_captured", "conversation_ended", "handoff_initiated"]
        }
    }
}
```

### 12.3 Integration Executor

```python
async def execute_integrations(
    user_message: str,
    bot_response: str,
    variables: dict,
    chatbot: Chatbot,
    session: ChatSession
):
    """Execute configured integrations based on triggers."""

    integrations = chatbot.integrations_config.get("webhooks", [])

    for integration in integrations:
        if not integration.get("enabled"):
            continue

        # Check trigger
        trigger = integration.get("trigger", {})
        should_execute = False

        if trigger["type"] == "intent":
            detected_intent = await detect_intent(user_message)
            if detected_intent == trigger["intent_name"]:
                should_execute = detected_intent["confidence"] >= trigger.get("confidence_threshold", 0.8)

        elif trigger["type"] == "keyword":
            keywords = trigger.get("keywords", [])
            should_execute = any(kw.lower() in user_message.lower() for kw in keywords)

        elif trigger["type"] == "always":
            should_execute = True

        if not should_execute:
            continue

        # Execute webhook
        try:
            result = await execute_webhook(
                webhook_config=integration["webhook"],
                variables=variables,
                session=session
            )

            # Send success message if configured
            success_msg = integration.get("response_handling", {}).get("success_message")
            if success_msg:
                # Template the message with response data
                templated_msg = template_string(success_msg, {
                    "response": result,
                    "variables": variables
                })
                # This would be appended to the conversation

        except Exception as e:
            error_msg = integration.get("response_handling", {}).get("error_message")
            logger.error(f"Integration {integration['id']} failed: {e}")
```

---

## 13. Live Support Handoff

### 13.1 Handoff Configuration

```json
{
    "handoff_config": {
        "enabled": true,

        "triggers": {
            "user_request": {
                "enabled": true,
                "keywords": [
                    "speak to human",
                    "talk to agent",
                    "real person",
                    "customer service",
                    "representative"
                ]
            },
            "low_confidence": {
                "enabled": true,
                "threshold": 0.3,
                "consecutive_count": 2
            },
            "sentiment": {
                "enabled": true,
                "negative_threshold": -0.5
            },
            "escalation_intent": {
                "enabled": true,
                "intents": ["complaint", "urgent", "cancel_account"]
            }
        },

        "messages": {
            "handoff_initiated": "I understand you'd like to speak with a human. Let me connect you...",
            "agent_connected": "You're now connected with {{agent_name}}. They'll assist you from here.",
            "no_agents_available": "I'm sorry, all our agents are currently busy. Your wait time is approximately {{wait_time}}.",
            "handoff_failed": "I apologize, but I couldn't connect you with an agent. Would you like to leave a message?"
        },

        "provider": "internal",

        "internal_config": {
            "queue_strategy": "round_robin",
            "timeout_seconds": 300,
            "max_queue_size": 50
        },

        "external_providers": {
            "intercom": {
                "enabled": false,
                "api_key_credential_id": null,
                "workspace_id": null
            },
            "zendesk": {
                "enabled": false,
                "subdomain": null,
                "api_key_credential_id": null
            }
        }
    }
}
```

### 13.2 Handoff Service

```python
class HandoffService:
    """Manage live support handoff."""

    async def should_handoff(
        self,
        message: str,
        response: str,
        chatbot: Chatbot,
        session: ChatSession
    ) -> bool:
        """Determine if handoff should be initiated."""

        config = chatbot.handoff_config
        if not config.get("enabled"):
            return False

        triggers = config.get("triggers", {})

        # Check user request keywords
        if triggers.get("user_request", {}).get("enabled"):
            keywords = triggers["user_request"].get("keywords", [])
            if any(kw.lower() in message.lower() for kw in keywords):
                return True

        # Check low confidence
        if triggers.get("low_confidence", {}).get("enabled"):
            threshold = triggers["low_confidence"]["threshold"]
            consecutive = triggers["low_confidence"].get("consecutive_count", 2)

            # Get recent messages with low confidence
            low_confidence_count = await self._get_low_confidence_count(
                session.id,
                threshold,
                limit=consecutive
            )
            if low_confidence_count >= consecutive:
                return True

        # Check sentiment
        if triggers.get("sentiment", {}).get("enabled"):
            sentiment = await self._analyze_sentiment(message)
            if sentiment < triggers["sentiment"]["negative_threshold"]:
                return True

        return False

    async def initiate_handoff(
        self,
        session: ChatSession,
        chatbot: Chatbot,
        db: Session
    ) -> dict:
        """Initiate handoff to live support."""

        config = chatbot.handoff_config
        provider = config.get("provider", "internal")

        if provider == "internal":
            return await self._internal_handoff(session, chatbot, db)
        elif provider == "intercom":
            return await self._intercom_handoff(session, config["external_providers"]["intercom"])
        elif provider == "zendesk":
            return await self._zendesk_handoff(session, config["external_providers"]["zendesk"])

        raise ValueError(f"Unknown handoff provider: {provider}")

    async def _internal_handoff(
        self,
        session: ChatSession,
        chatbot: Chatbot,
        db: Session
    ) -> dict:
        """Internal handoff to workspace agents."""

        # Create handoff record
        handoff = Handoff(
            session_id=session.id,
            chatbot_id=chatbot.id,
            workspace_id=chatbot.workspace_id,
            status="pending",
            conversation_summary=await self._summarize_conversation(session),
            created_at=datetime.utcnow()
        )
        db.add(handoff)
        db.commit()

        # Notify available agents (via WebSocket or push notification)
        await self._notify_agents(chatbot.workspace_id, handoff)

        return {
            "status": "pending",
            "handoff_id": str(handoff.id),
            "message": chatbot.handoff_config["messages"]["handoff_initiated"]
        }
```

---

## 14. Lead Capture System

### 14.1 Configuration

```json
{
    "lead_capture_config": {
        "enabled": true,
        "timing": "before_chat",

        "form": {
            "title": "Let's get to know you",
            "description": "Please share your details so we can assist you better.",

            "fields": [
                {
                    "name": "email",
                    "label": "Email Address",
                    "type": "email",
                    "required": true,
                    "placeholder": "you@example.com",
                    "validation": {
                        "pattern": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
                        "message": "Please enter a valid email"
                    }
                },
                {
                    "name": "name",
                    "label": "Your Name",
                    "type": "text",
                    "required": false,
                    "placeholder": "John Doe"
                },
                {
                    "name": "company",
                    "label": "Company",
                    "type": "text",
                    "required": false,
                    "placeholder": "Acme Inc"
                }
            ],

            "submit_button": "Start Chat",
            "skip_option": false,
            "privacy_notice": {
                "text": "By submitting, you agree to our Privacy Policy.",
                "link": "https://example.com/privacy"
            }
        },

        "auto_capture": {
            "ip_address": true,
            "geolocation": true,
            "user_agent": true,
            "referrer": true,
            "utm_params": true
        },

        "notifications": {
            "email": {
                "enabled": true,
                "recipients": ["sales@example.com"]
            },
            "webhook": {
                "enabled": false,
                "url": null
            }
        }
    }
}
```

### 14.2 Lead Model (Implementation)

Based on the existing pseudocode, implement as SQLAlchemy model:

```python
class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    CONVERTED = "converted"
    UNQUALIFIED = "unqualified"

class Lead(Base):
    """Lead captured from chatbot/chatflow interactions."""

    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Tenant isolation
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Polymorphic bot reference
    bot_type = Column(String(20), nullable=False)  # "chatbot" | "chatflow"
    bot_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Session link
    session_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # User-provided data
    email = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    custom_fields = Column(JSONB, nullable=False, default={})

    # Auto-captured data
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    country = Column(String(100), nullable=True, index=True)
    country_code = Column(String(2), nullable=True, index=True)
    region = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    timezone = Column(String(50), nullable=True)

    # Engagement data
    channel = Column(String(20), nullable=False, default="website", index=True)
    referrer = Column(Text, nullable=True)
    user_agent = Column(Text, nullable=True)
    language = Column(String(10), nullable=True)
    utm_params = Column(JSONB, nullable=True)

    # Lead management
    status = Column(Enum(LeadStatus), nullable=False, default=LeadStatus.NEW, index=True)
    notes = Column(Text, nullable=True)

    # Timestamps
    captured_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workspace = relationship("Workspace", back_populates="leads")

    __table_args__ = (
        Index("ix_leads_bot", "bot_type", "bot_id"),
        Index("ix_leads_workspace_captured", "workspace_id", "captured_at"),
    )
```

---

## 15. Dashboard & Analytics

### 15.1 Metrics Categories

Based on `chatbot-dashboard.md`, the system must support 12 metric categories:

| Category | Key Metrics | Data Source |
|----------|-------------|-------------|
| **1. Usage & Adoption** | Conversations, Active Users, DAU/WAU/MAU | ChatSession |
| **2. Engagement** | Messages/Conversation, Duration, Drop-off | ChatSession, ChatMessage |
| **3. Performance** | Response Time, Latency p50/p95, Uptime | ChatMessage.response_metadata |
| **4. Resolution** | Resolution Rate, Escalation Rate, FCR | ChatSession.status, Handoff |
| **5. Satisfaction** | CSAT, Feedback Ratio, Sentiment | ChatMessage.feedback |
| **6. Intent** | Top Intents, Fallback Rate, Confidence | ChatMessage.response_metadata |
| **7. KB Effectiveness** | Article Usage, Answer Success | ChatMessage.response_metadata.sources |
| **8. AI Quality** | Accuracy, Hallucination Rate, Drift | Manual review + automated |
| **9. Agent Handoff** | Time to Handoff, Agent Resolution | Handoff model |
| **10. Business ROI** | Cost/Conversation, Deflection, Savings | Calculated from tokens |
| **11. Compliance** | PII Detection, Policy Violations | Moderation logs |
| **12. Trends** | Period Comparisons, Cohorts | Aggregated queries |

### 15.2 Real-Time Metrics Schema

```python
# Cached in chatbot.cached_metrics (updated every 5 minutes)
{
    # Usage
    "conversations_total": 12450,
    "conversations_24h": 156,
    "conversations_7d": 1089,
    "conversations_30d": 4521,

    "active_users_24h": 142,
    "active_users_7d": 876,
    "active_users_30d": 3245,

    "new_vs_returning": {
        "new": 0.35,
        "returning": 0.65
    },

    # Engagement
    "avg_messages_per_conversation": 6.2,
    "avg_conversation_duration_seconds": 245,
    "completion_rate": 0.78,
    "bounce_rate": 0.12,

    # Performance
    "avg_response_time_ms": 850,
    "p50_response_time_ms": 720,
    "p95_response_time_ms": 1450,
    "p99_response_time_ms": 2100,
    "error_rate": 0.02,

    # Resolution
    "resolution_rate": 0.73,
    "automated_resolution_rate": 0.73,
    "escalation_rate": 0.14,
    "unresolved_rate": 0.13,
    "first_contact_resolution": 0.68,

    # Satisfaction
    "csat_score": 4.2,
    "feedback_response_rate": 0.45,
    "positive_feedback_ratio": 0.82,
    "negative_feedback_ratio": 0.18,

    # Intent (Top 10)
    "top_intents": [
        {"intent": "password_reset", "count": 1234, "percentage": 0.25},
        {"intent": "billing_inquiry", "count": 987, "percentage": 0.20},
        {"intent": "product_info", "count": 765, "percentage": 0.15}
    ],
    "fallback_rate": 0.08,
    "avg_confidence_score": 0.82,

    # KB Effectiveness
    "kb_usage_rate": 0.85,
    "avg_sources_per_response": 2.3,
    "kb_answer_success_rate": 0.79,

    # Cost
    "total_tokens_used_30d": 4500000,
    "avg_tokens_per_conversation": 450,
    "estimated_cost_30d": 9.00,

    "last_updated": "2024-01-15T10:30:00Z"
}
```

### 15.3 Analytics API Endpoints

```python
@router.get("/chatbots/{chatbot_id}/analytics")
async def get_chatbot_analytics(
    chatbot_id: UUID,
    period: str = "7d",  # "24h", "7d", "30d", "90d", "custom"
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    metrics: Optional[list[str]] = None,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """Get comprehensive chatbot analytics."""

    chatbot = get_chatbot_with_tenant_check(chatbot_id, workspace.id, db)

    # Return cached metrics for fast response
    if metrics is None and period in ["24h", "7d", "30d"]:
        return chatbot.cached_metrics

    # Calculate custom metrics
    return await analytics_service.calculate_metrics(
        chatbot_id=chatbot_id,
        period=period,
        start_date=start_date,
        end_date=end_date,
        metrics=metrics
    )

@router.get("/chatbots/{chatbot_id}/analytics/conversations")
async def get_conversation_analytics(
    chatbot_id: UUID,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    channel: Optional[str] = None,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """Get paginated conversation list with analytics."""
    pass

@router.get("/chatbots/{chatbot_id}/analytics/intents")
async def get_intent_analytics(
    chatbot_id: UUID,
    period: str = "30d",
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """Get intent distribution and trends."""
    pass

@router.get("/chatbots/{chatbot_id}/analytics/export")
async def export_analytics(
    chatbot_id: UUID,
    format: str = "csv",  # "csv", "json", "xlsx"
    period: str = "30d",
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """Export analytics data."""
    pass
```

---

## 16. Security & Compliance

### 16.1 Data Protection

| Aspect | Implementation |
|--------|----------------|
| **Tenant Isolation** | All queries verify workspace → organization chain |
| **API Key Security** | SHA256 hashed, prefix-only visible, rate limited |
| **PII Handling** | Optional encryption, GDPR deletion support |
| **Audit Logging** | Created/updated timestamps, user attribution |

### 16.2 Rate Limiting

```python
# API key rate limits
{
    "requests_per_minute": 60,
    "requests_per_hour": 1000,
    "requests_per_day": 10000,
    "tokens_per_month": 1000000,
    "burst_limit": 100
}

# Per-session limits
{
    "messages_per_minute": 10,
    "messages_per_session": 100
}
```

### 16.3 Content Moderation

```python
{
    "moderation": {
        "enabled": true,
        "block_profanity": true,
        "pii_detection": true,
        "pii_types": ["email", "phone", "ssn", "credit_card"],
        "pii_action": "mask",  # "mask" | "block" | "warn"
        "custom_blocked_words": [],
        "custom_allowed_words": []
    }
}
```

---

## 17. Implementation Priority

### 17.1 Phase 1: Core (MVP)

**Goal**: Basic chatbot with KB integration

| Component | Priority | Complexity | Dependencies |
|-----------|----------|------------|--------------|
| Chatbot Model | P0 | Medium | None |
| Draft Service | P0 | Medium | Redis |
| Chatbot Service (RAG) | P0 | High | KB system |
| API Key Model | P0 | Medium | None |
| Public API Update | P0 | Low | Chatbot Service |
| Basic Branding | P0 | Low | None |

**Deliverable**: Users can create chatbots via draft, connect KB, test, deploy, and access via API.

### 17.2 Phase 2: Deployment Channels

**Goal**: Multi-channel deployment

| Component | Priority | Complexity | Dependencies |
|-----------|----------|------------|--------------|
| Web Widget | P1 | Medium | Phase 1 |
| Direct Link | P1 | Low | Phase 1 |
| Telegram Integration | P1 | Medium | Phase 1 |
| Discord Integration | P2 | Medium | Phase 1 |

**Deliverable**: Users can deploy to website widget, Telegram, and Discord.

### 17.3 Phase 3: Advanced Features

**Goal**: Full feature set

| Component | Priority | Complexity | Dependencies |
|-----------|----------|------------|--------------|
| Lead Capture | P2 | Medium | Phase 1 |
| Variable System | P2 | Medium | Phase 1 |
| External Integrations | P2 | High | Phase 1 |
| Live Handoff | P3 | High | Phase 1 |
| WhatsApp Integration | P3 | High | Phase 2 |

### 17.4 Phase 4: Analytics & Optimization

**Goal**: Comprehensive dashboard

| Component | Priority | Complexity | Dependencies |
|-----------|----------|------------|--------------|
| Basic Metrics | P2 | Medium | Phase 1 |
| Full Dashboard | P3 | High | All phases |
| Export & Reporting | P3 | Medium | Dashboard |
| A/B Testing | P4 | High | Dashboard |

---

## Appendix A: API Endpoint Summary

### Chatbot Management (Internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/chatbot-drafts` | Create draft |
| GET | `/api/v1/chatbot-drafts/{id}` | Get draft |
| PATCH | `/api/v1/chatbot-drafts/{id}` | Update draft |
| POST | `/api/v1/chatbot-drafts/{id}/preview` | Test draft |
| POST | `/api/v1/chatbot-drafts/{id}/deploy` | Deploy to production |
| GET | `/api/v1/chatbots` | List chatbots |
| GET | `/api/v1/chatbots/{id}` | Get chatbot |
| PATCH | `/api/v1/chatbots/{id}` | Update chatbot |
| DELETE | `/api/v1/chatbots/{id}` | Delete chatbot |
| POST | `/api/v1/chatbots/{id}/pause` | Pause chatbot |
| POST | `/api/v1/chatbots/{id}/resume` | Resume chatbot |

### Public Chat API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/public/bots/{id}/chat` | Send message |
| POST | `/api/v1/public/bots/{id}/feedback` | Submit feedback |
| POST | `/api/v1/public/bots/{id}/leads` | Capture lead |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/chatbots/{id}/analytics` | Get metrics |
| GET | `/api/v1/chatbots/{id}/analytics/conversations` | List conversations |
| GET | `/api/v1/chatbots/{id}/analytics/intents` | Intent analysis |
| GET | `/api/v1/chatbots/{id}/analytics/export` | Export data |

---

## Appendix B: Database Migration Checklist

```sql
-- Phase 1: Core tables
CREATE TABLE chatbots (...);
CREATE TABLE api_keys (...);

-- Phase 2: Sessions (if not exists)
-- ChatSession and ChatMessage already implemented

-- Phase 3: Advanced
CREATE TABLE leads (...);
CREATE TABLE handoffs (...);
CREATE TABLE integration_logs (...);

-- Indexes
CREATE INDEX ix_chatbots_workspace_status ON chatbots(workspace_id, status);
CREATE INDEX ix_chatbots_slug ON chatbots(workspace_id, slug);
-- etc.
```

---

## Appendix C: Environment Variables

```bash
# Chatbot-specific
CHATBOT_DRAFT_TTL=86400
CHATBOT_MAX_CONTEXT_TOKENS=4000
CHATBOT_DEFAULT_MODEL=deepseek-r1

# Rate limiting
CHATBOT_RATE_LIMIT_RPM=60
CHATBOT_RATE_LIMIT_RPH=1000

# Integrations
TELEGRAM_BOT_API_URL=https://api.telegram.org
DISCORD_BOT_API_URL=https://discord.com/api/v10
WHATSAPP_API_URL=https://graph.facebook.com/v17.0

# Analytics
ANALYTICS_CACHE_TTL=300
ANALYTICS_RETENTION_DAYS=90
```

---

**Document End**

*This design document provides a complete architectural blueprint for implementing the chatbot feature in PrivexBot. It maintains consistency with existing patterns (KB draft service, multi-tenancy, public API) while introducing the necessary components for a full-featured AI chatbot platform.*
