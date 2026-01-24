"""
Draft Service - Unified draft management for chatbots, chatflows, and knowledge bases.

WHY:
- ALL entity creation happens in draft mode BEFORE database save
- Users can preview, test, configure without polluting database
- Easy to abandon (just delete from Redis)
- Fast auto-save (Redis is in-memory)
- Consistent pattern across all entity types

HOW:
- Store drafts in Redis with TTL (24 hours)
- Auto-extend TTL on each save
- Validate before deployment
- Deploy to database + initialize channels
- Delete draft after successful deployment

KEY DESIGN PRINCIPLES:
- Single service handles all entity types (DRY)
- Type-specific logic in separate methods
- Deployment triggers webhook registration
- Error handling per channel

PSEUDOCODE follows the existing codebase patterns.
"""

from enum import Enum
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import redis
import json
import re

from sqlalchemy.orm import Session

from app.core.config import settings


def slugify(text: str) -> str:
    """
    Convert text to URL-safe slug.

    Examples:
        "My Support Bot" → "my-support-bot"
        "Hello World! (Test)" → "hello-world-test"
    """
    # Convert to lowercase
    text = text.lower()
    # Replace spaces and underscores with hyphens
    text = re.sub(r'[\s_]+', '-', text)
    # Remove any characters that aren't alphanumeric or hyphens
    text = re.sub(r'[^a-z0-9-]', '', text)
    # Remove consecutive hyphens
    text = re.sub(r'-+', '-', text)
    # Remove leading/trailing hyphens
    text = text.strip('-')
    return text or 'chatbot'


class DraftType(str, Enum):
    """Supported draft types."""
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
        """
        Initialize Redis connection for draft storage.

        WHY: Separate Redis DB for drafts
        HOW: Redis db=1 for drafts, db=0 for cache
        """
        # Parse REDIS_URL and override db to 1 for drafts
        redis_url = settings.REDIS_URL
        # Replace db=0 with db=1 for drafts
        if '/0' in redis_url:
            redis_url = redis_url.replace('/0', '/1')
        elif not redis_url.endswith(('/0', '/1', '/2', '/3', '/4', '/5', '/6', '/7', '/8', '/9')):
            redis_url = redis_url.rstrip('/') + '/1'

        self.redis_client = redis.from_url(
            redis_url,
            decode_responses=True
        )

        self.default_ttl = 24 * 60 * 60  # 24 hours in seconds


    def create_draft(
        self,
        draft_type: DraftType,
        workspace_id: UUID,
        created_by: UUID,
        initial_data: dict
    ) -> str:
        """
        Create new draft (any type).

        FLOW:
        1. Generate draft_id
        2. Create draft structure
        3. Store in Redis with TTL
        4. Return draft_id

        ARGS:
            draft_type: Type of entity (chatbot, chatflow, kb)
            workspace_id: Workspace this draft belongs to
            created_by: User creating the draft
            initial_data: Initial configuration data

        RETURNS:
            draft_id: Unique draft identifier
        """

        # Generate unique ID
        draft_id = f"draft_{draft_type.value}_{uuid4().hex[:8]}"

        # Create draft structure
        draft = {
            "id": draft_id,
            "type": draft_type.value,
            "workspace_id": str(workspace_id),
            "created_by": str(created_by),
            "status": "draft",
            "auto_save_enabled": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "last_auto_save": None,
            "expires_at": (datetime.utcnow() + timedelta(seconds=self.default_ttl)).isoformat(),
            "data": initial_data,
            "preview": {}
        }

        # Store in Redis with TTL
        redis_key = f"draft:{draft_type.value}:{draft_id}"
        self.redis_client.setex(
            redis_key,
            self.default_ttl,
            json.dumps(draft)
        )

        return draft_id


    def get_draft(
        self,
        draft_type: DraftType,
        draft_id: str
    ) -> Optional[dict]:
        """
        Get draft by type and ID.

        RETURNS:
            Draft data or None if not found/expired
        """

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

        WHY: Auto-save on every change (debounced from frontend)
        HOW: Merge updates, extend TTL, save to Redis

        ARGS:
            draft_type: Type of entity
            draft_id: Draft identifier
            updates: Partial updates to apply
            extend_ttl: Whether to reset TTL to 24 hours
        """

        # Get existing draft
        draft = self.get_draft(draft_type, draft_id)
        if not draft:
            raise ValueError(f"Draft not found or expired: {draft_id}")

        # Merge updates
        if "data" in updates:
            # Deep merge data field
            draft["data"].update(updates["data"])

        if "preview" in updates:
            draft["preview"] = updates["preview"]

        if "preview_data" in updates:
            draft["preview_data"] = updates["preview_data"]

        # Update timestamps
        draft["updated_at"] = datetime.utcnow().isoformat()
        draft["last_auto_save"] = datetime.utcnow().isoformat()

        # Save back to Redis
        redis_key = f"draft:{draft_type.value}:{draft_id}"

        # Determine TTL
        if extend_ttl:
            ttl = self.default_ttl  # Reset to 24 hours
        else:
            ttl = self.redis_client.ttl(redis_key)  # Keep existing TTL

        self.redis_client.setex(
            redis_key,
            ttl,
            json.dumps(draft)
        )


    def delete_draft(
        self,
        draft_type: DraftType,
        draft_id: str
    ):
        """
        Delete draft from Redis.

        WHY: User abandons or deploys draft
        """

        redis_key = f"draft:{draft_type.value}:{draft_id}"
        self.redis_client.delete(redis_key)


    def list_drafts(
        self,
        draft_type: DraftType,
        workspace_id: UUID,
        limit: int = 50
    ) -> list[dict]:
        """
        List all drafts for a workspace.

        WHY: Show drafts in dashboard
        HOW: Scan Redis keys, filter by workspace

        NOTE: This is expensive for large Redis DBs
        BETTER: Store draft IDs in a workspace-specific list
        """

        # Pattern to match all drafts of this type
        pattern = f"draft:{draft_type.value}:*"

        # Scan Redis (cursor-based iteration)
        drafts = []
        cursor = 0

        while True:
            cursor, keys = self.redis_client.scan(
                cursor,
                match=pattern,
                count=100
            )

            # Get draft data for each key
            for key in keys:
                data = self.redis_client.get(key)
                if data:
                    draft = json.loads(data)

                    # Filter by workspace
                    if draft["workspace_id"] == str(workspace_id):
                        drafts.append(draft)

                    # Limit results
                    if len(drafts) >= limit:
                        return drafts

            # Stop when cursor returns to 0
            if cursor == 0:
                break

        return drafts


    def validate_draft(
        self,
        draft_type: DraftType,
        draft_id: str
    ) -> dict:
        """
        Validate draft before deployment.

        WHY: Ensure all required fields present
        HOW: Type-specific validation

        RETURNS:
            {
                "valid": bool,
                "errors": list[str],
                "warnings": list[str]
            }
        """

        draft = self.get_draft(draft_type, draft_id)
        if not draft:
            raise ValueError(f"Draft not found: {draft_id}")

        errors = []
        warnings = []

        # Type-specific validation
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

        # Check deployment channels (optional - API access is always available)
        deployment = data.get("deployment", {})
        channels = deployment.get("channels", [])
        enabled_channels = [c for c in channels if c.get("enabled")]

        if not enabled_channels:
            # Just a warning - API access is always available
            warnings.append("No deployment channels configured - chatbot will only be accessible via API")

        # Warnings
        if not data.get("knowledge_bases"):
            warnings.append("No knowledge bases configured - bot will not have context")

        if not data.get("appearance", {}).get("welcome_message"):
            warnings.append("Welcome message not set - using default")

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
        if disconnected and len(disconnected) > 1:  # Start node might not have incoming edges
            warnings.append(f"Disconnected nodes: {', '.join(disconnected)}")

        # At least one deployment channel
        deployment = data.get("deployment", {})
        channels = deployment.get("channels", [])
        enabled_channels = [c for c in channels if c.get("enabled")]

        if not enabled_channels:
            errors.append("At least one deployment channel must be enabled")

        return errors, warnings


    def _validate_kb(self, draft: dict) -> tuple[list, list]:
        """Validate KB draft."""

        errors = []
        warnings = []
        data = draft["data"]

        if not data.get("name"):
            errors.append("Name is required")

        if not data.get("sources"):
            errors.append("No sources added - KB will be empty")

        if not data.get("embedding_config"):
            errors.append("Embedding configuration required")

        return errors, warnings


    def deploy_draft(
        self,
        draft_type: DraftType,
        draft_id: str,
        db: Session
    ) -> dict:
        """
        Deploy draft → Save to database + initialize channels.

        FLOW:
        1. Validate draft
        2. Create database record
        3. Type-specific initialization (webhooks, API keys, etc.)
        4. Delete draft from Redis
        5. Return deployment results

        RETURNS:
            {
                "entity_id": "uuid",
                "status": "deployed",
                "channels": {
                    "website": {"status": "success", ...},
                    "telegram": {"status": "success", ...}
                }
            }
        """

        # Validate
        validation = self.validate_draft(draft_type, draft_id)
        if not validation["valid"]:
            raise ValueError(f"Validation failed: {validation['errors']}")

        draft = self.get_draft(draft_type, draft_id)

        # Deploy based on type
        if draft_type == DraftType.CHATBOT:
            result = self._deploy_chatbot(draft, db)
        elif draft_type == DraftType.CHATFLOW:
            result = self._deploy_chatflow(draft, db)
        elif draft_type == DraftType.KB:
            result = self._deploy_kb(draft, db)

        # Delete draft from Redis on success
        self.delete_draft(draft_type, draft_id)

        return result

    def _generate_unique_slug(self, name: str, workspace_id: UUID, db: Session) -> str:
        """
        Generate a unique slug for a chatbot within a workspace.

        Args:
            name: The chatbot name to slugify
            workspace_id: The workspace to check uniqueness in
            db: Database session

        Returns:
            A unique slug string (e.g., "my-support-bot", "my-support-bot-2")
        """
        from app.models.chatbot import Chatbot

        base_slug = slugify(name)
        slug = base_slug
        counter = 1

        # Keep checking until we find a unique slug
        while db.query(Chatbot).filter(
            Chatbot.workspace_id == workspace_id,
            Chatbot.slug == slug
        ).first():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug

    def _initialize_branding_config(self, branding: dict) -> dict:
        """
        Initialize branding config with hosted_page defaults.

        WHY: Ensure hosted_page has sensible defaults when chatbot is deployed
        HOW: Merge user-provided branding with default hosted_page settings

        Args:
            branding: User-provided branding configuration

        Returns:
            Branding config with hosted_page defaults initialized
        """
        if not branding:
            branding = {}

        # Initialize hosted_page with defaults if not present
        if "hosted_page" not in branding:
            branding["hosted_page"] = {
                "enabled": True,  # Enable by default since chatbot is being deployed
                "background_color": "#f9fafb",  # Tailwind gray-50
                # Other fields inherit from widget config (primary_color, avatar_url, etc.)
                "logo_url": None,
                "header_text": None,
                "footer_text": None,
                "background_image": None,
                "meta_title": None,
                "meta_description": None,
                "favicon_url": None,
                "custom_domain": None,
                "domain_verified": False
            }
        else:
            # Ensure all expected fields exist with defaults
            hosted_page = branding["hosted_page"]
            hosted_page.setdefault("enabled", True)
            hosted_page.setdefault("background_color", "#f9fafb")
            hosted_page.setdefault("domain_verified", False)

        return branding

    def _deploy_chatbot(self, draft: dict, db: Session) -> dict:
        """
        Deploy chatbot to database + initialize multi-channel deployments.

        RETURNS:
            {
                "chatbot_id": "uuid",
                "status": "deployed",
                "api_key": "secrettt-key_live_...",  # Only shown once
                "channels": {...}
            }
        """

        from app.models.chatbot import Chatbot, ChatbotStatus
        from app.models.api_key import create_api_key

        data = draft["data"]

        # Extract behavior settings for proper mapping
        behavior = data.get("behavior", {})

        # Map enable_citations boolean to citation_style string
        citation_style = "none"
        if behavior.get("enable_citations"):
            citation_style = "inline"  # Default to inline citations

        # Build messages config with conversation openers
        messages_config = data.get("messages", {})
        if data.get("conversation_openers"):
            messages_config["conversation_openers"] = data.get("conversation_openers")

        # Generate unique slug for hosted page URL
        workspace_id = UUID(draft["workspace_id"])
        slug = self._generate_unique_slug(data["name"], workspace_id, db)

        # Create chatbot record with proper column mapping
        chatbot = Chatbot(
            workspace_id=workspace_id,
            name=data["name"],
            slug=slug,  # URL-friendly identifier for /chat/{slug}
            description=data.get("description"),
            status=ChatbotStatus.ACTIVE,
            # Visibility setting
            is_public=data.get("is_public", True),
            # AI configuration
            ai_config=data.get("ai_config", {
                "provider": "secret_ai",
                "model": data.get("model", "secret-ai-v1"),
                "temperature": data.get("temperature", 0.7),
                "max_tokens": data.get("max_tokens", 2000)
            }),
            # Prompt configuration
            prompt_config={
                "system_prompt": data.get("system_prompt", "You are a helpful assistant."),
                "persona": data.get("persona", {}),
                "instructions": data.get("instructions", []),
                "restrictions": data.get("restrictions", []),
                "messages": messages_config
            },
            # Knowledge base integration
            kb_config={
                "enabled": bool(data.get("knowledge_bases")),
                "knowledge_bases": data.get("knowledge_bases", []),
                "citation_style": citation_style,
                "grounding_mode": behavior.get("grounding_mode", "strict"),
                "max_context_tokens": 4000
            },
            # Branding (with hosted_page defaults)
            branding_config=self._initialize_branding_config(
                data.get("appearance", data.get("branding", {}))
            ),
            # Deployment
            deployment_config=data.get("deployment", {}),
            # Behavior
            behavior_config={
                "memory": data.get("memory", {"enabled": True, "max_messages": 20}),
                "response": data.get("response", {"typing_indicator": True}),
                "follow_up_questions": behavior.get("enable_follow_up_questions", False)
            },
            # Lead capture
            lead_capture_config=data.get("lead_capture", {}),
            # Variable collection
            variables_config=data.get("variables_config", {}),
            # Analytics
            analytics_config=data.get("analytics", {"track_conversations": True}),
            # Audit
            created_by=UUID(draft["created_by"]),
            deployed_at=datetime.utcnow()
        )

        db.add(chatbot)
        db.flush()  # Get chatbot.id without committing

        # Generate primary API key using helper function
        api_key, plain_key = create_api_key(
            workspace_id=chatbot.workspace_id,
            name=f"API Key for {chatbot.name}",
            entity_type="chatbot",
            entity_id=chatbot.id,
            created_by=chatbot.created_by,
            permissions=["read", "execute"]
        )

        db.add(api_key)
        db.commit()  # Commit chatbot + API key

        # Initialize multi-channel deployments
        deployment_results = self._initialize_channels(
            entity_id=chatbot.id,
            entity_type="chatbot",
            deployment_config=data.get("deployment", {}),
            api_key=plain_key,  # Use plain key for embed code
            db=db
        )

        # Update chatbot's deployment_config with actual channel results
        # This stores bot_token_credential_id for webhook handlers to use
        chatbot.deployment_config = deployment_results["channels"]
        db.commit()

        # Add API key to response (only shown once)
        deployment_results["api_key"] = plain_key
        deployment_results["api_key_prefix"] = api_key.key_prefix
        # Add slug for hosted page URL
        deployment_results["slug"] = slug

        return deployment_results


    def _deploy_chatflow(self, draft: dict, db: Session) -> dict:
        """
        Deploy chatflow to database + initialize multi-channel deployments.

        Chatflows support the SAME channels as chatbots.
        """

        from app.models.chatflow import Chatflow
        from app.models.api_key import APIKey

        data = draft["data"]

        # Create chatflow record
        chatflow = Chatflow(
            workspace_id=UUID(draft["workspace_id"]),
            name=data["name"],
            config=data,  # Store entire config as JSONB (includes deployment config)
            version=1,
            is_active=True,
            created_by=UUID(draft["created_by"])
        )

        db.add(chatflow)
        db.flush()

        # Generate API key
        api_key = APIKey(
            workspace_id=chatflow.workspace_id,
            entity_type="chatflow",
            entity_id=chatflow.id,
            created_by=chatflow.created_by
        )

        db.add(api_key)
        db.commit()

        # Initialize multi-channel deployments (reuses chatbot logic)
        deployment_results = self._initialize_channels(
            entity_id=chatflow.id,
            entity_type="chatflow",
            deployment_config=data.get("deployment", {}),
            api_key=api_key.key,
            db=db
        )

        # Update chatflow's config with actual channel results
        # This stores bot_token_credential_id for webhook handlers to use
        chatflow.config["deployment"] = deployment_results["channels"]
        db.commit()

        return deployment_results


    def _deploy_kb(self, draft: dict, db: Session) -> dict:
        """
        Deploy KB to database.

        Delegates to kb_service for KB-specific logic.
        """

        from app.models.knowledge_base import KnowledgeBase

        data = draft["data"]

        # Create KB record
        kb = KnowledgeBase(
            workspace_id=UUID(draft["workspace_id"]),
            name=data["name"],
            description=data.get("description"),
            config=data,
            created_by=UUID(draft["created_by"])
        )

        db.add(kb)
        db.commit()
        db.refresh(kb)

        return {
            "kb_id": str(kb.id),
            "status": "deployed",
            "processing": "background"  # Documents processed by Celery
        }


    def _initialize_channels(
        self,
        entity_id: UUID,
        entity_type: str,
        deployment_config: dict,
        api_key: str,
        db: Session
    ) -> dict:
        """
        Initialize multi-channel deployments (shared by chatbot & chatflow).

        WHY: Both chatbots and chatflows deploy to same channels
        HOW: Iterate enabled channels, register webhooks, generate codes

        RETURNS:
            {
                "chatbot_id": "uuid" or "chatflow_id": "uuid",
                "status": "deployed",
                "channels": {
                    "website": {"status": "success", "embed_code": "..."},
                    "telegram": {"status": "success", "webhook_url": "...", "bot_username": "@bot"},
                    "discord": {"status": "error", "error": "Invalid token"}
                }
            }
        """

        deployment_results = {
            f"{entity_type}_id": str(entity_id),
            "status": "deployed",
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
                    # Register Telegram webhook via Telegram API
                    from app.integrations.telegram_integration import telegram_integration

                    # Get credential_id from channel (frontend stores at top level)
                    credential_id = channel.get("credential_id") or channel.get("config", {}).get("bot_token")
                    if not credential_id:
                        raise ValueError("Telegram bot token credential is required")

                    telegram_result = telegram_integration.register_webhook(
                        db=db,
                        entity_id=entity_id,
                        entity_type=entity_type,
                        config={"bot_token": credential_id}
                    )

                    deployment_results["channels"]["telegram"] = {
                        "status": "success",
                        "webhook_url": telegram_result["webhook_url"],
                        "bot_username": telegram_result["bot_username"],
                        "bot_token_credential_id": credential_id,  # Store credential ref for webhook handler
                        "webhook_secret": telegram_result.get("webhook_secret")  # For webhook verification
                    }

                elif channel_type == "discord":
                    # Register Discord webhook via Discord API
                    from app.integrations.discord_integration import discord_integration

                    # Get credential_id from channel (frontend stores at top level)
                    credential_id = channel.get("credential_id") or channel.get("config", {}).get("bot_token")
                    if not credential_id:
                        raise ValueError("Discord bot token credential is required")

                    discord_result = discord_integration.register_webhook(
                        db=db,
                        entity_id=entity_id,
                        entity_type=entity_type,
                        config={"bot_token": credential_id}
                    )

                    deployment_results["channels"]["discord"] = {
                        "status": "success",
                        "webhook_url": discord_result["webhook_url"],
                        "bot_username": discord_result["bot_username"],
                        "application_id": discord_result.get("application_id"),
                        "invite_url": discord_result.get("invite_url"),  # URL for users to add bot to servers
                        "bot_token_credential_id": credential_id  # Store credential ref for webhook handler
                    }

                elif channel_type == "whatsapp":
                    # Configure WhatsApp Business API (placeholder - requires integration)
                    deployment_results["channels"]["whatsapp"] = {
                        "status": "success",
                        "webhook_url": f"{settings.API_BASE_URL}/webhooks/whatsapp/{entity_id}",
                        "phone_number": channel["config"].get("phone_number")
                    }

                elif channel_type == "zapier":
                    # Generate Zapier webhook URL
                    zapier_webhook = f"{settings.API_BASE_URL}/webhooks/zapier/{entity_id}"
                    deployment_results["channels"]["zapier"] = {
                        "status": "success",
                        "webhook_url": zapier_webhook
                    }

            except Exception as e:
                # Graceful degradation - log error but continue
                deployment_results["channels"][channel_type] = {
                    "status": "error",
                    "error": str(e)
                }

        return deployment_results


    def _generate_embed_code(self, entity_id: UUID, api_key: str) -> str:
        """Generate embed code for website widget."""

        widget_cdn_url = settings.WIDGET_CDN_URL

        return f"""<script>
  window.privexbotConfig = {{
    botId: '{entity_id}',
    apiKey: '{api_key}'
  }};
</script>
<script src="{widget_cdn_url}/widget.js"></script>"""


# Global instance
draft_service = UnifiedDraftService()
