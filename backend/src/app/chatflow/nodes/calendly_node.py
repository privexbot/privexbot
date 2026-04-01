"""
Calendly Node - Share booking links and list events within chatflows.

WHY:
- MOU requires Calendly integration for scheduling
- Chatbots can share booking links during conversations
- "Book a meeting" is a common chatbot action

HOW:
- Uses Calendly OAuth credentials from credential system
- Fetches event types and scheduling links via Calendly API
- Variable interpolation in message templates
- Auto-refresh tokens when expired
"""

from typing import Any, Dict, Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode


class CalendlyNode(BaseNode):
    """
    Calendly scheduling node.

    WHY: Share booking links and manage scheduling in chatflows
    HOW: Calendly API via OAuth credentials
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute Calendly action.

        CONFIG:
            {
                "credential_id": "uuid",           # Calendly OAuth credential (required)
                "action": "get_link",              # "get_link" or "list_events"
                "event_type_name": "",             # Optional: specific event type name
                "message_template": "Book a meeting: {{calendly_link}}"
            }

        RETURNS:
            {
                "output": "Book a meeting: https://calendly.com/...",
                "success": True,
                "metadata": {
                    "action": "get_link",
                    "calendly_link": "https://calendly.com/..."
                }
            }
        """
        try:
            credential_id = self.config.get("credential_id")
            if not credential_id:
                return self.handle_error(ValueError("Calendly credential is required"))

            # Get Calendly credentials
            from app.services.credential_service import credential_service
            from app.models.credential import Credential

            credential = db.query(Credential).get(UUID(credential_id))
            if not credential:
                return self.handle_error(ValueError("Calendly credential not found"))

            cred_data = credential_service.get_decrypted_data(db, credential)
            access_token = cred_data.get("access_token")
            refresh_token = cred_data.get("refresh_token")
            expires_at = cred_data.get("expires_at", "")

            # Auto-refresh token if expired
            token_expired = False
            if expires_at:
                try:
                    expiry = datetime.fromisoformat(expires_at)
                    token_expired = (expiry - datetime.utcnow()).total_seconds() < 60
                except (ValueError, TypeError):
                    token_expired = True

            if token_expired and refresh_token:
                from app.integrations.calendly_integration import calendly_integration
                client_id = cred_data.get("client_id", "")
                client_secret = cred_data.get("client_secret", "")

                refresh_result = await calendly_integration.refresh_token(
                    refresh_token, client_id, client_secret
                )

                if "access_token" in refresh_result:
                    access_token = refresh_result["access_token"]
                    new_expires_in = refresh_result.get("expires_in", 7200)
                    new_expires_at = (datetime.utcnow() + timedelta(seconds=new_expires_in)).isoformat()
                    cred_data["access_token"] = access_token
                    cred_data["expires_at"] = new_expires_at
                    encrypted_data, key_id = credential_service.encrypt_with_key_id(cred_data)
                    credential.encrypted_data = encrypted_data
                    credential.encryption_key_id = key_id
                    db.commit()
                else:
                    return {
                        "output": None,
                        "success": False,
                        "error": f"Calendly token refresh failed: {refresh_result.get('error', 'unknown')}",
                        "metadata": {"node_id": self.node_id, "node_type": self.node_type}
                    }

            from app.integrations.calendly_integration import calendly_integration

            action = self.config.get("action", "get_link")
            event_type_name = self.config.get("event_type_name", "")
            message_template = self.config.get("message_template", "{{calendly_link}}")

            if action == "get_link":
                # Get scheduling link
                link = await calendly_integration.get_scheduling_link(
                    access_token=access_token,
                    event_type_name=event_type_name or None
                )

                if not link:
                    return {
                        "output": None,
                        "success": False,
                        "error": "No Calendly scheduling link found. Check your event types.",
                        "metadata": {"node_id": self.node_id, "node_type": self.node_type}
                    }

                # Resolve template with calendly_link variable
                vars_ctx = {
                    **context.get("variables", {}),
                    **inputs,
                    "calendly_link": link
                }
                output = self.resolve_variable(message_template, vars_ctx)

                return {
                    "output": output,
                    "success": True,
                    "error": None,
                    "metadata": {
                        "action": "get_link",
                        "calendly_link": link,
                        "event_type_name": event_type_name or "default"
                    }
                }

            elif action == "list_events":
                # List event types
                event_types = await calendly_integration.list_event_types(access_token)

                if not event_types:
                    return {
                        "output": "No active event types found.",
                        "success": True,
                        "error": None,
                        "metadata": {"action": "list_events", "count": 0}
                    }

                # Format event types as readable list
                lines = []
                for et in event_types:
                    name = et.get("name", "Unknown")
                    duration = et.get("duration_minutes", "?")
                    url = et.get("scheduling_url", "")
                    lines.append(f"- {name} ({duration} min): {url}")

                output = "\n".join(lines)

                return {
                    "output": output,
                    "success": True,
                    "error": None,
                    "metadata": {
                        "action": "list_events",
                        "count": len(event_types),
                        "event_types": [et.get("name") for et in event_types]
                    }
                }

            else:
                return self.handle_error(ValueError(f"Unknown Calendly action: {action}"))

        except Exception as e:
            return self.handle_error(e)

    def validate_config(self) -> tuple[bool, Optional[str]]:
        """Validate Calendly node configuration."""
        if not self.config.get("credential_id"):
            return False, "Calendly credential is required"
        action = self.config.get("action", "get_link")
        if action not in ("get_link", "list_events"):
            return False, f"Invalid action: {action}. Use 'get_link' or 'list_events'"
        return True, None
