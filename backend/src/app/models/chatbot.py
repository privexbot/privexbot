"""
Chatbot model - AI chatbot resource within a workspace.

WHY:
- Core product: The actual chatbot users create
- Must be isolated by workspace (and therefore by organization)
- Stores configuration and settings for each bot

HOW:
- Lives within a workspace (required workspace_id)
- Accessed through proper tenant hierarchy
- Config stored as flexible JSONB for different bot configurations
- Draft-first architecture: Create in Redis → Deploy to PostgreSQL

Multi-tenancy: Organization → Workspace → Chatbot
3-Phase Flow: Draft (Redis) → Deploy (Create DB record) → Active (Operational)
"""

from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey, Index, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
import enum
from datetime import datetime


class ChatbotStatus(str, enum.Enum):
    """Chatbot lifecycle status."""
    DRAFT = "draft"           # In Redis, being configured
    ACTIVE = "active"         # Deployed and operational
    PAUSED = "paused"         # Temporarily disabled
    ARCHIVED = "archived"     # Soft deleted


class Chatbot(Base):
    """
    Chatbot model - AI conversational agent within a workspace.

    Supports:
    - Multiple knowledge bases with per-KB retrieval overrides
    - Multi-channel deployment (web widget, Telegram, Discord, WhatsApp, API)
    - Custom branding and appearance
    - Lead capture and analytics

    Examples: "Customer Support Bot", "FAQ Assistant", "Sales Assistant"
    """
    __tablename__ = "chatbots"

    # ═══════════════════════════════════════════════════════════════
    # IDENTITY
    # ═══════════════════════════════════════════════════════════════
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name = Column(String(100), nullable=False)
    # Display name shown in dashboard and widget header
    # Example: "Customer Support Bot", "Sales Assistant"

    slug = Column(String(100), nullable=True)
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
    ai_config = Column(JSONB, nullable=False, default=dict)
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
    prompt_config = Column(JSONB, nullable=False, default=dict)
    # Structure:
    # {
    #     "system_prompt": "You are a helpful assistant...",
    #     "persona": {
    #         "name": "Alex",
    #         "role": "Customer Support Specialist",
    #         "tone": "friendly"  # friendly | professional | casual
    #     },
    #     "instructions": [
    #         {"id": "inst_1", "priority": 1, "text": "Always greet users warmly", "enabled": true}
    #     ],
    #     "restrictions": [
    #         {"id": "rest_1", "text": "Never discuss competitors", "enabled": true}
    #     ],
    #     "messages": {
    #         "greeting": "Hi! How can I help you today?",
    #         "fallback": "I'm not sure about that. Would you like to speak with a human?",
    #         "closing": "Is there anything else I can help with?"
    #     }
    # }

    # ═══════════════════════════════════════════════════════════════
    # KNOWLEDGE BASE INTEGRATION
    # ═══════════════════════════════════════════════════════════════
    kb_config = Column(JSONB, nullable=False, default=dict)
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
    #     "merge_strategy": "priority",  # "priority" | "score"
    #     "citation_style": "inline",  # "inline" | "footnote" | "none"
    #     "max_context_tokens": 4000
    # }

    # ═══════════════════════════════════════════════════════════════
    # BRANDING & APPEARANCE
    # ═══════════════════════════════════════════════════════════════
    branding_config = Column(JSONB, nullable=False, default=dict)
    # Structure:
    # {
    #     "avatar_url": "https://...",
    #     "avatar_fallback": "AS",  # Initials if no avatar
    #     "primary_color": "#3b82f6",
    #     "secondary_color": "#8b5cf6",
    #     "widget_position": "bottom-right",  # "bottom-right" | "bottom-left"
    #     "widget_size": "standard",  # "compact" | "standard" | "large"
    #     "show_powered_by": true
    # }

    # ═══════════════════════════════════════════════════════════════
    # DEPLOYMENT CHANNELS
    # ═══════════════════════════════════════════════════════════════
    deployment_config = Column(JSONB, nullable=False, default=dict)
    # Structure:
    # {
    #     "web_widget": {
    #         "enabled": true,
    #         "domains": ["example.com", "*.example.com"],
    #         "embed_code_generated": true
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
    #         "phone_number_id": null
    #     },
    #     "api": {
    #         "enabled": true,
    #         "api_key_id": "uuid"
    #     }
    # }

    # ═══════════════════════════════════════════════════════════════
    # BEHAVIOR SETTINGS
    # ═══════════════════════════════════════════════════════════════
    behavior_config = Column(JSONB, nullable=False, default=dict)
    # Structure:
    # {
    #     "memory": {
    #         "enabled": true,
    #         "max_messages": 20
    #     },
    #     "response": {
    #         "typing_indicator": true,
    #         "typing_delay_ms": 500
    #     },
    #     "rate_limiting": {
    #         "messages_per_minute": 10,
    #         "messages_per_session": 100
    #     }
    # }

    # ═══════════════════════════════════════════════════════════════
    # LEAD CAPTURE
    # ═══════════════════════════════════════════════════════════════
    lead_capture_config = Column(JSONB, nullable=False, default=dict)
    # Structure:
    # {
    #     "enabled": false,
    #     "timing": "before_chat",  # "before_chat" | "during_chat" | "after_chat"
    #     "required_fields": ["email"],
    #     "optional_fields": ["name", "phone"]
    # }

    # ═══════════════════════════════════════════════════════════════
    # VARIABLE COLLECTION
    # ═══════════════════════════════════════════════════════════════
    variables_config = Column(JSONB, nullable=False, default=dict, server_default='{}')
    # Structure:
    # {
    #     "enabled": false,
    #     "variables": [
    #         {
    #             "id": "var_1",
    #             "name": "user_name",           # Variable name for {{user_name}}
    #             "type": "text",                # "text" | "email" | "phone" | "number" | "select"
    #             "label": "What's your name?",  # Display label
    #             "placeholder": "Enter name",   # Input placeholder
    #             "required": true,
    #             "default_value": "",           # Default if not collected
    #             "options": []                  # For select type
    #         }
    #     ],
    #     "collection_timing": "before_chat"    # "before_chat" | "on_demand"
    # }
    #
    # Variables are substituted in system_prompt using {{variable_name}} syntax
    # Example: "You are helping {{user_name}} who works at {{company}}."

    # ═══════════════════════════════════════════════════════════════
    # ANALYTICS & METRICS
    # ═══════════════════════════════════════════════════════════════
    analytics_config = Column(JSONB, nullable=False, default=dict)
    # Structure:
    # {
    #     "track_conversations": true,
    #     "track_satisfaction": true,
    #     "track_intents": true
    # }

    # Cached metrics for fast dashboard display
    cached_metrics = Column(JSONB, nullable=False, default=dict)
    # Updated by background job
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

    # Archive tracking (soft delete audit)
    archived_at = Column(DateTime, nullable=True)
    # When the chatbot was archived (soft deleted)

    archived_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    # Who archived the chatbot

    # ═══════════════════════════════════════════════════════════════
    # RELATIONSHIPS
    # ═══════════════════════════════════════════════════════════════
    workspace = relationship("Workspace", back_populates="chatbots")
    creator = relationship("User", foreign_keys=[created_by])
    archiver = relationship("User", foreign_keys=[archived_by])

    # Discord guild deployments (shared bot architecture)
    # Multiple guilds can deploy to same chatbot (many-to-one)
    discord_guild_deployments = relationship(
        "DiscordGuildDeployment",
        back_populates="chatbot",
        cascade="all, delete-orphan"
    )

    # Slack workspace deployments (shared bot architecture)
    # Multiple workspaces can deploy to same chatbot (many-to-one)
    slack_workspace_deployments = relationship(
        "SlackWorkspaceDeployment",
        back_populates="chatbot",
        cascade="all, delete-orphan"
    )

    # ═══════════════════════════════════════════════════════════════
    # INDEXES
    # ═══════════════════════════════════════════════════════════════
    __table_args__ = (
        Index("ix_chatbots_workspace_status", "workspace_id", "status"),
        Index("ix_chatbots_slug", "workspace_id", "slug", unique=True),
        Index("ix_chatbots_created_at", "created_at"),
    )

    def __repr__(self):
        return f"<Chatbot(id={self.id}, name={self.name}, status={self.status})>"

    @property
    def config(self) -> dict:
        """
        Legacy config property for backward compatibility with existing services.
        Returns merged configuration from all config columns.

        IMPORTANT: This property is used by chatbot_service._build_messages() to construct
        the AI prompt. All fields must be included for proper functionality:
        - persona, instructions, restrictions: For prompt construction
        - behavior: For show_citations, show_followups, grounding_mode
        - grounding_mode: For KB context injection mode (strict/guided/flexible)
        """
        # Build behavior dict with proper field mapping
        # Maps stored field names to what chatbot_service expects
        behavior = {
            "show_citations": self.kb_config.get("citation_style", "none") != "none",
            "show_followups": self.behavior_config.get("follow_up_questions", False),
            "grounding_mode": self.kb_config.get("grounding_mode", "strict"),
        }

        return {
            # From prompt_config (for persona, instructions, restrictions)
            "system_prompt": self.prompt_config.get("system_prompt", ""),
            "persona": self.prompt_config.get("persona", {}),
            "instructions": self.prompt_config.get("instructions", []),
            "restrictions": self.prompt_config.get("restrictions", []),

            # From ai_config
            "model": self.ai_config.get("model", "secret-ai-v1"),
            "temperature": self.ai_config.get("temperature", 0.7),
            "max_tokens": self.ai_config.get("max_tokens", 2000),

            # From kb_config (for knowledge base retrieval)
            "knowledge_bases": self.kb_config.get("knowledge_bases", []),
            "grounding_mode": self.kb_config.get("grounding_mode", "strict"),

            # From behavior_config
            "memory": self.behavior_config.get("memory", {}),
            "behavior": behavior,

            # Other configs
            "branding": self.branding_config,
            "lead_capture": self.lead_capture_config,
            "variables": self.variables_config,
        }

    @property
    def is_active(self) -> bool:
        """Check if chatbot is active and can receive messages."""
        return self.status == ChatbotStatus.ACTIVE

    @property
    def is_archived(self) -> bool:
        """Check if chatbot is archived (soft deleted)."""
        return self.status == ChatbotStatus.ARCHIVED
