"""
Calendly Integration - Calendly API client for scheduling.

WHY:
- MOU requires Calendly integration for chatflow scheduling
- Chatbots can share booking links during conversations
- Webhooks capture leads when users book meetings

HOW:
- OAuth2 authentication (stored as credential)
- List event types, get scheduling links
- Webhook subscriptions for invitee events
- Lead capture from booking data
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

CALENDLY_API_BASE = "https://api.calendly.com"


class CalendlyIntegration:
    """
    Calendly API client.

    WHY: Schedule meetings via chatflow automation
    HOW: Calendly API v2 with OAuth2 tokens
    """

    async def get_current_user(self, access_token: str) -> Optional[dict]:
        """
        Get current Calendly user info.

        RETURNS:
            {"uri": "https://api.calendly.com/users/...", "name": "...", "email": "...",
             "scheduling_url": "https://calendly.com/username", "organization": "..."}
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{CALENDLY_API_BASE}/users/me",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    resource = response.json().get("resource", {})
                    return {
                        "uri": resource.get("uri"),
                        "name": resource.get("name"),
                        "email": resource.get("email"),
                        "scheduling_url": resource.get("scheduling_url"),
                        "organization": resource.get("current_organization"),
                        "timezone": resource.get("timezone"),
                    }
                else:
                    logger.error(f"Calendly users/me error: {response.status_code} - {response.text}")
                    return None
            except Exception as e:
                logger.error(f"Calendly API exception: {e}")
                return None

    async def list_event_types(
        self,
        access_token: str,
        user_uri: str = None
    ) -> List[dict]:
        """
        List available event types for the user.

        RETURNS:
            [{
                "uri": "https://api.calendly.com/event_types/...",
                "name": "30-Minute Meeting",
                "slug": "30min",
                "scheduling_url": "https://calendly.com/username/30min",
                "duration_minutes": 30,
                "active": true
            }]
        """
        if not user_uri:
            user_info = await self.get_current_user(access_token)
            if not user_info:
                return []
            user_uri = user_info.get("uri")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{CALENDLY_API_BASE}/event_types",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"user": user_uri, "active": "true"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    collection = response.json().get("collection", [])
                    return [
                        {
                            "uri": et.get("uri"),
                            "name": et.get("name"),
                            "slug": et.get("slug"),
                            "scheduling_url": et.get("scheduling_url"),
                            "duration_minutes": et.get("duration"),
                            "active": et.get("active"),
                            "description": et.get("description_plain"),
                        }
                        for et in collection
                    ]
                else:
                    logger.error(f"Calendly event_types error: {response.status_code}")
                    return []
            except Exception as e:
                logger.error(f"Calendly list_event_types exception: {e}")
                return []

    async def get_scheduling_link(
        self,
        access_token: str,
        event_type_name: str = None
    ) -> Optional[str]:
        """
        Get a scheduling link for the user.

        If event_type_name is provided, returns the link for that specific event type.
        Otherwise returns the user's default scheduling page URL.

        RETURNS:
            "https://calendly.com/username/30min" or None
        """
        if event_type_name:
            event_types = await self.list_event_types(access_token)
            for et in event_types:
                if et.get("name", "").lower() == event_type_name.lower():
                    return et.get("scheduling_url")
            # If not found by exact match, try partial match
            for et in event_types:
                if event_type_name.lower() in et.get("name", "").lower():
                    return et.get("scheduling_url")

        # Fallback: return first active event type or user's scheduling page
        user_info = await self.get_current_user(access_token)
        if user_info:
            # Try first event type
            event_types = await self.list_event_types(access_token, user_info.get("uri"))
            if event_types:
                return event_types[0].get("scheduling_url")
            # Fallback to user's scheduling page
            return user_info.get("scheduling_url")

        return None

    async def create_webhook_subscription(
        self,
        access_token: str,
        callback_url: str,
        events: List[str],
        organization_uri: str,
        scope: str = "organization",
        signing_key: str = None
    ) -> Optional[dict]:
        """
        Subscribe to Calendly webhook events.

        ARGS:
            callback_url: URL to receive webhook events
            events: List of event names (e.g., ["invitee.created", "invitee.canceled"])
            organization_uri: Calendly organization URI
            scope: "organization" or "user"
            signing_key: Optional HMAC signing key for verification

        RETURNS:
            {"uri": "...", "callback_url": "...", "events": [...]} or None
        """
        payload = {
            "url": callback_url,
            "events": events,
            "organization": organization_uri,
            "scope": scope,
        }

        if signing_key:
            payload["signing_key"] = signing_key

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{CALENDLY_API_BASE}/webhook_subscriptions",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=10.0
                )
                if response.status_code in (200, 201):
                    resource = response.json().get("resource", {})
                    return {
                        "uri": resource.get("uri"),
                        "callback_url": resource.get("callback_url"),
                        "events": resource.get("events"),
                        "scope": resource.get("scope"),
                    }
                else:
                    logger.error(f"Calendly webhook subscription error: {response.status_code} - {response.text}")
                    return None
            except Exception as e:
                logger.error(f"Calendly webhook subscription exception: {e}")
                return None

    async def handle_webhook_event(
        self,
        db: Session,
        bot_id: UUID,
        event_payload: dict
    ) -> dict:
        """
        Handle incoming Calendly webhook event.

        Processes invitee.created and invitee.canceled events.
        Captures leads from booking data.

        RETURNS:
            {"event": "invitee.created", "invitee": {...}, "lead_captured": True}
        """
        event_type = event_payload.get("event")
        payload = event_payload.get("payload", {})

        invitee = payload.get("invitee", {})
        event = payload.get("event", {})

        result = {
            "event": event_type,
            "invitee": {
                "name": invitee.get("name"),
                "email": invitee.get("email"),
                "timezone": invitee.get("timezone"),
            },
            "event_details": {
                "name": event.get("name"),
                "start_time": event.get("start_time"),
                "end_time": event.get("end_time"),
                "location": event.get("location", {}).get("location"),
            },
            "lead_captured": False
        }

        # Capture lead for invitee.created events
        if event_type == "invitee.created" and invitee.get("email"):
            try:
                from app.services.lead_capture_service import lead_capture_service

                bot_type, bot = self._get_bot(db, bot_id)

                await lead_capture_service.capture_lead(
                    db=db,
                    workspace_id=bot.workspace_id,
                    bot_id=bot.id,
                    bot_type=bot_type,
                    session_id=f"calendly_{invitee.get('email', '')}",
                    channel="calendly",
                    email=invitee.get("email"),
                    name=invitee.get("name"),
                    custom_fields={
                        "calendly_event": event.get("name"),
                        "scheduled_time": event.get("start_time"),
                        "timezone": invitee.get("timezone"),
                    },
                    consent_given=True
                )
                result["lead_captured"] = True
            except Exception as e:
                logger.error(f"Calendly lead capture failed: {e}")

        return result

    async def refresh_token(
        self,
        refresh_token: str,
        client_id: str = None,
        client_secret: str = None
    ) -> dict:
        """Refresh Calendly OAuth access token."""
        from app.core.config import settings

        if not client_id:
            client_id = settings.CALENDLY_CLIENT_ID
        if not client_secret:
            client_secret = settings.CALENDLY_CLIENT_SECRET

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://auth.calendly.com/oauth/token",
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": refresh_token,
                        "client_id": client_id,
                        "client_secret": client_secret,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    return {"error": f"Token refresh failed ({response.status_code}): {response.text}"}
            except Exception as e:
                return {"error": f"Token refresh exception: {str(e)}"}

    def _get_bot(self, db: Session, entity_id: UUID) -> Tuple[str, Any]:
        """Get bot by ID (chatbot or chatflow)."""
        from app.models.chatbot import Chatbot
        from app.models.chatflow import Chatflow

        chatbot = db.query(Chatbot).get(entity_id)
        if chatbot:
            return "chatbot", chatbot

        chatflow = db.query(Chatflow).get(entity_id)
        if chatflow:
            return "chatflow", chatflow

        raise ValueError("Bot not found")


# Global instance
calendly_integration = CalendlyIntegration()
