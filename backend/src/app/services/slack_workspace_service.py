"""
Slack Workspace Deployment Service - Manage Slack workspace deployments for shared bot architecture.

WHY:
- Shared bot architecture: ONE Slack app serves ALL customers
- Map Slack workspaces (teams) to chatbots
- Route messages to correct chatbot based on team_id
- Multi-tenant isolation via workspace

HOW:
- Create/manage SlackWorkspaceDeployment records
- Lookup chatbot for team_id (message routing)
- List deployments for workspace/chatbot
- Handle deployment lifecycle (activate/deactivate/remove)

Architecture:
- Shared Slack App receives event with team_id
- Service looks up SlackWorkspaceDeployment by team_id
- Returns chatbot to process the message
- Supports channel restrictions per deployment
"""

from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any
from uuid import UUID
import httpx
import json
import logging
import redis
from urllib.parse import urlencode

from sqlalchemy.orm import Session

from app.models.slack_workspace_deployment import SlackWorkspaceDeployment
from app.models.chatbot import Chatbot, ChatbotStatus
from app.core.config import settings

# Redis cache configuration for Slack API responses
TEAMS_CACHE_KEY = "slack:bot:teams"
TEAMS_CACHE_TTL = 60  # 60 seconds

logger = logging.getLogger(__name__)


class SlackWorkspaceService:
    """
    Manage Slack workspace deployments for shared bot architecture.

    WHY: Route Slack messages to correct chatbot based on workspace
    HOW: SlackWorkspaceDeployment model maps team_id -> chatbot_id
    """

    def deploy_to_workspace(
        self,
        db: Session,
        workspace_id: UUID,
        chatbot_id: UUID,
        team_id: str,
        user_id: UUID = None,
        team_name: str = None,
        team_domain: str = None,
        team_icon: str = None,
        bot_token_encrypted: str = None,
        bot_user_id: str = None,
        allowed_channel_ids: List[str] = None
    ) -> SlackWorkspaceDeployment:
        """
        Deploy chatbot to a Slack workspace.

        ARGS:
            db: Database session
            workspace_id: Workspace ID (for tenant isolation)
            chatbot_id: Chatbot ID to deploy
            team_id: Slack workspace ID (e.g., "T0123456789")
            user_id: User creating the deployment
            team_name: Slack workspace name (cached for display)
            team_domain: Slack workspace domain
            team_icon: Slack workspace icon URL
            bot_token_encrypted: Encrypted bot OAuth token for this workspace
            bot_user_id: Bot's Slack user ID in this workspace
            allowed_channel_ids: Optional list of channel IDs to respond in (empty = all)

        RETURNS:
            Created SlackWorkspaceDeployment instance

        RAISES:
            ValueError: If chatbot not found, wrong workspace, or team already deployed
        """
        # Verify chatbot belongs to workspace
        chatbot = db.query(Chatbot).filter(
            Chatbot.id == chatbot_id,
            Chatbot.workspace_id == workspace_id
        ).first()

        if not chatbot:
            raise ValueError("Chatbot not found in this workspace")

        if chatbot.status != ChatbotStatus.ACTIVE:
            raise ValueError(f"Chatbot must be active to deploy (current status: {chatbot.status})")

        # Check team not already deployed
        existing = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id
        ).first()

        if existing:
            if existing.workspace_id == workspace_id:
                raise ValueError(f"Slack workspace {team_id} is already deployed to chatbot {existing.chatbot_id}")
            else:
                raise ValueError(f"Slack workspace {team_id} is already deployed to another workspace")

        # Create deployment record
        deployment = SlackWorkspaceDeployment(
            workspace_id=workspace_id,
            team_id=team_id,
            team_name=team_name,
            team_domain=team_domain,
            team_icon=team_icon,
            bot_token_encrypted=bot_token_encrypted,
            bot_user_id=bot_user_id,
            chatbot_id=chatbot_id,
            allowed_channel_ids=allowed_channel_ids or [],
            is_active=True,
            created_by=user_id,
            deployed_at=datetime.utcnow()
        )

        db.add(deployment)
        db.commit()
        db.refresh(deployment)

        return deployment

    def get_chatbot_for_team(
        self,
        db: Session,
        team_id: str
    ) -> Optional[Tuple[Chatbot, SlackWorkspaceDeployment]]:
        """
        Lookup which chatbot handles a workspace's messages.

        WHY: Route incoming Slack messages to correct chatbot
        HOW: Find active deployment for team_id

        RETURNS:
            Tuple of (Chatbot, SlackWorkspaceDeployment) or None if not found
        """
        deployment = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id,
            SlackWorkspaceDeployment.is_active == True
        ).first()

        if not deployment:
            return None

        chatbot = db.query(Chatbot).filter(
            Chatbot.id == deployment.chatbot_id,
            Chatbot.status == ChatbotStatus.ACTIVE
        ).first()

        if not chatbot:
            return None

        return (chatbot, deployment)

    def get_entity_for_team(
        self,
        db: Session,
        team_id: str
    ) -> Optional[Tuple[str, Any, SlackWorkspaceDeployment]]:
        """
        Lookup chatbot OR chatflow for a workspace's messages.

        WHY: Support both chatbots and chatflows in Slack deployments
        HOW: Check chatbot table first, then chatflow table by chatbot_id

        RETURNS:
            Tuple of (bot_type, entity, deployment) or None
        """
        deployment = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id,
            SlackWorkspaceDeployment.is_active == True
        ).first()

        if not deployment:
            return None

        # Try chatbot first (primary use case)
        chatbot = db.query(Chatbot).filter(
            Chatbot.id == deployment.chatbot_id,
            Chatbot.status == ChatbotStatus.ACTIVE
        ).first()

        if chatbot:
            return ("chatbot", chatbot, deployment)

        # Try chatflow (chatbot_id may reference a chatflow)
        from app.models.chatflow import Chatflow
        chatflow = db.query(Chatflow).filter(
            Chatflow.id == deployment.chatbot_id,
            Chatflow.is_active == True
        ).first()

        if chatflow:
            return ("chatflow", chatflow, deployment)

        return None

    def remove_workspace(
        self,
        db: Session,
        workspace_id: UUID,
        team_id: str
    ) -> bool:
        """
        Remove workspace deployment.

        RETURNS:
            True if removed, False if not found
        """
        deployment = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id,
            SlackWorkspaceDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return False

        db.delete(deployment)
        db.commit()
        return True

    def deactivate_workspace(
        self,
        db: Session,
        workspace_id: UUID,
        team_id: str
    ) -> Optional[SlackWorkspaceDeployment]:
        """Temporarily deactivate workspace deployment."""
        deployment = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id,
            SlackWorkspaceDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return None

        deployment.is_active = False
        db.commit()
        db.refresh(deployment)
        return deployment

    def activate_workspace(
        self,
        db: Session,
        workspace_id: UUID,
        team_id: str
    ) -> Optional[SlackWorkspaceDeployment]:
        """Reactivate workspace deployment."""
        deployment = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id,
            SlackWorkspaceDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return None

        deployment.is_active = True
        deployment.deployed_at = datetime.utcnow()
        db.commit()
        db.refresh(deployment)
        return deployment

    def update_channel_restrictions(
        self,
        db: Session,
        workspace_id: UUID,
        team_id: str,
        allowed_channel_ids: List[str]
    ) -> Optional[SlackWorkspaceDeployment]:
        """Update which channels the bot responds in."""
        deployment = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id,
            SlackWorkspaceDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return None

        deployment.allowed_channel_ids = allowed_channel_ids
        db.commit()
        db.refresh(deployment)
        return deployment

    def list_workspace_deployments(
        self,
        db: Session,
        workspace_id: UUID,
        chatbot_id: UUID = None,
        active_only: bool = False
    ) -> List[SlackWorkspaceDeployment]:
        """List all workspace deployments for workspace/chatbot."""
        query = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.workspace_id == workspace_id
        )

        if chatbot_id:
            query = query.filter(SlackWorkspaceDeployment.chatbot_id == chatbot_id)

        if active_only:
            query = query.filter(SlackWorkspaceDeployment.is_active == True)

        return query.order_by(SlackWorkspaceDeployment.created_at.desc()).all()

    def get_deployment(
        self,
        db: Session,
        workspace_id: UUID,
        team_id: str
    ) -> Optional[SlackWorkspaceDeployment]:
        """Get a specific workspace deployment."""
        return db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id,
            SlackWorkspaceDeployment.workspace_id == workspace_id
        ).first()

    def update_team_metadata(
        self,
        db: Session,
        team_id: str,
        metadata_updates: Dict[str, Any]
    ) -> Optional[SlackWorkspaceDeployment]:
        """Update workspace metadata (e.g., after receiving a message)."""
        deployment = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id
        ).first()

        if not deployment:
            return None

        existing_metadata = deployment.team_metadata or {}
        existing_metadata.update(metadata_updates)
        deployment.team_metadata = existing_metadata

        db.commit()
        db.refresh(deployment)
        return deployment

    def generate_install_url(self, redirect_uri: str = None) -> str:
        """
        Generate Slack app install URL (OAuth 2.0 V2).

        WHY: Users need to install the shared Slack app to their workspace
        HOW: Construct Slack OAuth authorize URL with bot scopes
        """
        client_id = settings.SLACK_CLIENT_ID

        if not client_id:
            raise ValueError("SLACK_CLIENT_ID not configured")

        # Bot token scopes needed for chatbot functionality
        bot_scopes = [
            "chat:write",         # Send messages
            "app_mentions:read",  # Read @mentions
            "im:history",         # Read DM history
            "im:read",            # Access DM channels
            "im:write",           # Open DMs
            "channels:history",   # Read public channel messages
            "channels:read",      # List channels
            "groups:history",     # Read private channel messages
            "groups:read",        # List private channels
            "users:read",         # Get user info for lead capture
            "team:read",          # Get workspace info
        ]

        if not redirect_uri:
            redirect_uri = f"{settings.API_BASE_URL}/webhooks/slack/oauth/callback"

        params = {
            "client_id": client_id,
            "scope": ",".join(bot_scopes),
            "redirect_uri": redirect_uri,
        }

        return f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"

    async def fetch_team_channels(
        self,
        bot_token: str
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch list of channels from a Slack workspace.

        WHY: Allow users to select specific channels for the bot to respond in
        HOW: Call Slack API conversations.list
        """
        if not bot_token:
            return None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://slack.com/api/conversations.list",
                    headers={"Authorization": f"Bearer {bot_token}"},
                    params={
                        "types": "public_channel,private_channel",
                        "exclude_archived": "true",
                        "limit": 200
                    },
                    timeout=10.0
                )

                data = response.json()
                if not data.get("ok"):
                    logger.error(f"Slack conversations.list error: {data.get('error')}")
                    return []

                channels = data.get("channels", [])
                return [
                    {
                        "id": ch.get("id"),
                        "name": ch.get("name"),
                        "is_private": ch.get("is_private", False),
                        "num_members": ch.get("num_members", 0),
                        "topic": ch.get("topic", {}).get("value", ""),
                    }
                    for ch in channels
                ]
            except Exception as e:
                logger.error(f"Slack API exception: {e}")
                return None

    def reassign_chatbot(
        self,
        db: Session,
        workspace_id: UUID,
        team_id: str,
        new_chatbot_id: UUID
    ) -> Optional[SlackWorkspaceDeployment]:
        """Reassign a workspace to a different chatbot."""
        chatbot = db.query(Chatbot).filter(
            Chatbot.id == new_chatbot_id,
            Chatbot.workspace_id == workspace_id
        ).first()

        if not chatbot:
            raise ValueError("New chatbot not found in this workspace")

        if chatbot.status != ChatbotStatus.ACTIVE:
            raise ValueError(f"New chatbot must be active (current status: {chatbot.status})")

        deployment = db.query(SlackWorkspaceDeployment).filter(
            SlackWorkspaceDeployment.team_id == team_id,
            SlackWorkspaceDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return None

        deployment.chatbot_id = new_chatbot_id
        db.commit()
        db.refresh(deployment)
        return deployment


# Global instance
slack_workspace_service = SlackWorkspaceService()
