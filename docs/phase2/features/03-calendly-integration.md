# Calendly Integration — Implementation Design
> Feature: Share Calendly booking links from chatflows + receive scheduling events
> MOU Reference: Appendix A ("Calendly integrations"), Milestone 5
> Status: ❌ NOT IMPLEMENTED — zero code exists, complete new feature

---

## 1. What This Feature Provides

The Calendly integration allows a chatbot/chatflow to:

1. **Share a booking link** — when a user asks to schedule a meeting, the chatflow replies with a Calendly link (e.g., "Book a 30-minute call: https://calendly.com/username/30min")
2. **Trigger follow-up actions** — when someone books or cancels via Calendly, PrivexBot receives a webhook and can run actions (send confirmation, update a lead, notify team)

This is the standard "Schedule a meeting" feature in customer-facing chatbots (e.g., Intercom, Drift, HubSpot chat).

---

## 2. Existing Patterns to Follow

| Reference File | What to Reuse |
|---|---|
| `src/app/chatflow/nodes/email_node.py:1–185` | BaseNode subclass pattern for CalendlyNode |
| `src/app/chatflow/nodes/base_node.py:1–129` | Abstract `execute()`, `validate_config()`, `resolve_variable()`, `handle_error()` |
| `src/app/chatflow/nodes/webhook_node.py` | Outbound HTTP call pattern with credential support |
| `src/app/api/v1/routes/webhooks/zapier.py` | Inbound webhook handler pattern for Calendly events |
| `src/app/services/chatflow_executor.py:422–444` | LeadCaptureNodeExecutor — template for CalendlyNodeExecutor |
| `src/app/integrations/discord_integration.py:405–421` | `_get_bot()` method pattern for webhook handler |
| `src/app/services/credential_service.py` | Reuse for encrypted Calendly API token storage |

---

## 3. Calendly API Overview

### Authentication
Calendly uses **Personal Access Tokens (PAT)** or **OAuth2**. For a chatbot integration, Personal Access Token is simpler and sufficient.

```
Authorization: Bearer <CALENDLY_TOKEN>
```

API Base URL: `https://api.calendly.com`

### Key Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /users/me` | Get authenticated user's Calendly URI and profile |
| `GET /event_types?user={uri}` | List user's event types (e.g., 30-min call, 60-min demo) |
| `POST /webhook_subscriptions` | Subscribe to receive booking events |
| `DELETE /webhook_subscriptions/{uuid}` | Remove webhook subscription |
| `GET /scheduled_events` | List upcoming scheduled events |

### Event Types Response Example
```json
{
  "collection": [
    {
      "uri": "https://api.calendly.com/event_types/AAAAAAAAAAAAAAAA",
      "name": "30 Minute Meeting",
      "slug": "30min",
      "scheduling_url": "https://calendly.com/john-doe/30min",
      "duration": 30,
      "active": true,
      "description_plain": "A quick 30-minute intro call"
    }
  ]
}
```

### Webhook Event Payload (invitee.created)
```json
{
  "event": "invitee.created",
  "payload": {
    "event": "https://api.calendly.com/scheduled_events/EVENT_UUID",
    "invitee": {
      "uri": "https://api.calendly.com/scheduled_events/EVENT_UUID/invitees/INVITEE_UUID",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "status": "active",
      "created_at": "2026-03-25T14:00:00Z"
    },
    "event_type": {
      "name": "30 Minute Meeting",
      "scheduling_url": "https://calendly.com/john-doe/30min"
    },
    "scheduled_event": {
      "start_time": "2026-03-26T09:00:00Z",
      "end_time": "2026-03-26T09:30:00Z",
      "location": {
        "type": "zoom",
        "join_url": "https://zoom.us/j/..."
      }
    },
    "tracking": {
      "utm_source": "privexbot-chatflow"
    }
  }
}
```

---

## 4. Architecture

### CalendlyNode in Chatflow
```
User: "I'd like to book a demo"
  → Chatflow reaches CalendlyNode
  → CalendlyNode.execute()
      → credential_service.get_decrypted_data(calendly_credential)
      → Extract: api_token, event_type_uri (or slug)
      → GET https://api.calendly.com/event_types/{uuid}
      → Get scheduling_url from response
      → Return formatted message: "Book a demo here: https://calendly.com/..."
  → Response reaches user in chat
```

### Calendly Webhook (invitee.created / invitee.canceled)
```
Invitee books on Calendly
  → Calendly → POST /api/v1/webhooks/calendly/{bot_id}
  → Verify Calendly webhook signature (optional — see section 7)
  → Parse event type (invitee.created or invitee.canceled)
  → Extract invitee name, email, scheduled time
  → Store as lead (via lead_capture_service)
  → Optionally trigger chatflow action (notify team, send confirmation)
```

---

## 5. Calendly Credential Structure

Stored in the existing `credentials` table via `credential_service`.

**Credential type string:** `"calendly_api"`

**Credential data shape (JSON, stored encrypted):**
```json
{
    "type": "calendly_api",
    "api_token": "eyJraWQiOiIxY...",
    "user_uri": "https://api.calendly.com/users/AAAAAAAAAAAAAAAA",
    "event_type_uri": "https://api.calendly.com/event_types/AAAAAAAAAAAAAAAA",
    "scheduling_url": "https://calendly.com/john-doe/30min",
    "organization_uri": "https://api.calendly.com/organizations/AAAAAAAAAAAAAAAA"
}
```

The `user_uri`, `event_type_uri`, and `scheduling_url` are fetched during credential creation (when user pastes their API token + selects event type in the dashboard).

---

## 6. Files to Create

### File 1: `src/app/integrations/calendly_integration.py`

**Purpose:** Calendly API client — fetch event types, manage webhook subscriptions, handle inbound events.

```python
"""
Calendly Integration - Scheduling links and event notifications.

WHY:
- Share Calendly booking links in chatflows
- Receive booking/cancellation events

HOW:
- Calendly v2 API with Bearer token
- Webhook subscription for real-time events
- Lead capture on invitee.created events
"""

import requests
import hmac
import hashlib
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session


class CalendlyIntegration:
    """
    Calendly API integration.

    WHY: Enable chatbots to schedule meetings via Calendly
    HOW: Personal access token + webhook subscriptions
    """

    BASE_URL = "https://api.calendly.com"

    def get_current_user(self, api_token: str) -> dict:
        """
        Get the authenticated user's profile.

        WHY: Get user_uri needed for other API calls
        HOW: GET /users/me

        RETURNS:
            {
                "uri": "https://api.calendly.com/users/AAAA",
                "name": "John Doe",
                "email": "john@example.com",
                "organization": "https://api.calendly.com/organizations/BBBB",
                "scheduling_url": "https://calendly.com/john-doe"
            }
        """
        response = requests.get(
            f"{self.BASE_URL}/users/me",
            headers={"Authorization": f"Bearer {api_token}"},
            timeout=15
        )
        response.raise_for_status()
        return response.json().get("resource", {})

    def list_event_types(self, api_token: str, user_uri: str) -> List[dict]:
        """
        List user's event types (booking page types).

        WHY: Let user pick which event type to share in chatflow
        HOW: GET /event_types?user={user_uri}&active=true

        RETURNS:
            [
                {
                    "uri": "https://api.calendly.com/event_types/XXXX",
                    "name": "30 Minute Meeting",
                    "slug": "30min",
                    "scheduling_url": "https://calendly.com/user/30min",
                    "duration": 30,
                    "active": True,
                    "description_plain": "..."
                }
            ]
        """
        response = requests.get(
            f"{self.BASE_URL}/event_types",
            headers={"Authorization": f"Bearer {api_token}"},
            params={"user": user_uri, "active": "true"},
            timeout=15
        )
        response.raise_for_status()
        return response.json().get("collection", [])

    def subscribe_webhook(
        self,
        api_token: str,
        organization_uri: str,
        user_uri: str,
        callback_url: str,
        events: Optional[List[str]] = None
    ) -> dict:
        """
        Subscribe to Calendly events via webhook.

        WHY: Receive real-time booking/cancellation notifications
        HOW: POST /webhook_subscriptions

        ARGS:
            api_token: Calendly API token
            organization_uri: Organization URI from get_current_user()
            user_uri: User URI from get_current_user()
            callback_url: URL Calendly will POST events to
            events: List of events to subscribe to. Defaults to all relevant events.
                Available: "invitee.created", "invitee.canceled"

        RETURNS:
            {
                "uri": "https://api.calendly.com/webhook_subscriptions/XXXX",
                "callback_url": "https://...",
                "state": "active"
            }
        """
        events = events or ["invitee.created", "invitee.canceled"]
        response = requests.post(
            f"{self.BASE_URL}/webhook_subscriptions",
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json"
            },
            json={
                "url": callback_url,
                "events": events,
                "organization": organization_uri,
                "user": user_uri,
                "scope": "user"  # "user" scope = only this user's events
            },
            timeout=15
        )
        response.raise_for_status()
        return response.json().get("resource", {})

    def unsubscribe_webhook(self, api_token: str, webhook_uri: str) -> bool:
        """
        Remove a webhook subscription.

        WHY: Clean up when bot is deleted or redeployed
        HOW: DELETE /webhook_subscriptions/{uuid}

        RETURNS: True if removed, False if not found
        """
        webhook_uuid = webhook_uri.split("/")[-1]
        response = requests.delete(
            f"{self.BASE_URL}/webhook_subscriptions/{webhook_uuid}",
            headers={"Authorization": f"Bearer {api_token}"},
            timeout=15
        )
        return response.status_code in (200, 204, 404)

    async def handle_webhook_event(
        self,
        db: Session,
        bot_id: UUID,
        event_payload: dict
    ) -> dict:
        """
        Handle incoming Calendly webhook event.

        WHY: Process booking/cancellation notifications
        HOW: Extract event data, store lead, return result

        ARGS:
            db: Database session
            bot_id: Chatbot or chatflow ID this webhook is registered for
            event_payload: Calendly webhook payload

        RETURNS:
            {"status": "processed", "event": "invitee.created"}
        """
        event_type = event_payload.get("event")  # "invitee.created" or "invitee.canceled"
        payload = event_payload.get("payload", {})

        invitee = payload.get("invitee", {})
        invitee_name = invitee.get("name")
        invitee_email = invitee.get("email")

        scheduled_event = payload.get("scheduled_event", {})
        start_time = scheduled_event.get("start_time")
        end_time = scheduled_event.get("end_time")

        event_type_info = payload.get("event_type", {})
        event_type_name = event_type_info.get("name")

        # Resolve bot
        bot_type, bot = self._get_bot(db, bot_id)

        if not bot:
            return {"status": "bot_not_found"}

        # On booking: capture lead
        if event_type == "invitee.created" and invitee_email:
            from app.services.lead_capture_service import lead_capture_service
            session_id = f"calendly_{invitee_email.replace('@', '_').replace('.', '_')}"
            await lead_capture_service.capture_from_calendly(
                db=db,
                workspace_id=bot.workspace_id,
                bot_id=bot.id,
                bot_type=bot_type,
                session_id=session_id,
                name=invitee_name,
                email=invitee_email,
                event_type=event_type_name,
                scheduled_start=start_time
            )

        return {"status": "processed", "event": event_type}

    def _get_bot(self, db: Session, entity_id: UUID):
        """Get bot by ID (chatbot or chatflow). Follows discord_integration.py:405–421."""
        from app.models.chatbot import Chatbot
        from app.models.chatflow import Chatflow

        chatbot = db.query(Chatbot).get(entity_id)
        if chatbot:
            return "chatbot", chatbot

        chatflow = db.query(Chatflow).get(entity_id)
        if chatflow:
            return "chatflow", chatflow

        return None, None


# Global instance
calendly_integration = CalendlyIntegration()
```

---

### File 2: `src/app/chatflow/nodes/calendly_node.py`

**Purpose:** Chatflow node that fetches a Calendly booking link and returns it to the user.

**Follows:** `src/app/chatflow/nodes/email_node.py` structure exactly (BaseNode subclass).

```python
"""
Calendly Node - Share Calendly booking links in chatflows.

WHY:
- Allow chatbots to facilitate scheduling meetings
- No-code way to add "Book a meeting" to any chatflow
- Triggered when user expresses intent to schedule

HOW:
- Uses Calendly credential (API token + event type URI)
- Fetches scheduling_url from credential or Calendly API
- Returns formatted message with booking link
"""

from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode


class CalendlyNode(BaseNode):
    """
    Calendly scheduling node.

    WHY: Enable "Book a meeting" functionality in chatflows
    HOW: Retrieve booking link from Calendly credential and format response

    CONFIG:
        {
            "credential_id": "uuid",         # Calendly credential (required)
            "message_template": "...",        # Optional custom message with {{booking_url}}
            "event_type_uri": "...",          # Optional override (uses credential default if omitted)
            "button_label": "Schedule Now"    # Optional label for link button
        }

    RETURNS:
        {
            "output": "Book a call here: https://calendly.com/...",
            "success": True,
            "metadata": {
                "scheduling_url": "https://calendly.com/...",
                "event_type_name": "30 Minute Meeting",
                "duration_minutes": 30
            }
        }
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Fetch Calendly booking link and return formatted message.

        FLOW:
        1. Get Calendly credential from database
        2. Check if scheduling_url is cached in credential data
        3. If not, fetch from Calendly API (GET /event_types/{uuid})
        4. Resolve message_template with {{booking_url}} variable
        5. Return formatted message
        """
        try:
            credential_id = self.config.get("credential_id")
            if not credential_id:
                return self.handle_error(ValueError("Calendly credential is required"))

            from app.services.credential_service import credential_service
            from app.models.credential import Credential

            credential = db.query(Credential).get(UUID(credential_id))
            if not credential:
                return self.handle_error(ValueError("Calendly credential not found"))

            cred_data = credential_service.get_decrypted_data(db, credential)

            api_token = cred_data.get("api_token")
            if not api_token:
                return self.handle_error(ValueError("Calendly API token not found in credential"))

            # Use cached scheduling_url from credential, or fetch from API
            scheduling_url = cred_data.get("scheduling_url")
            event_type_name = cred_data.get("event_type_name", "meeting")
            event_duration = cred_data.get("event_duration")

            # Allow node config to override which event type to use
            event_type_uri = self.config.get("event_type_uri") or cred_data.get("event_type_uri")

            if not scheduling_url and event_type_uri:
                # Fetch from Calendly API
                from app.integrations.calendly_integration import calendly_integration
                import requests
                event_uuid = event_type_uri.split("/")[-1]
                response = requests.get(
                    f"https://api.calendly.com/event_types/{event_uuid}",
                    headers={"Authorization": f"Bearer {api_token}"},
                    timeout=15
                )
                response.raise_for_status()
                event_data = response.json().get("resource", {})
                scheduling_url = event_data.get("scheduling_url")
                event_type_name = event_data.get("name", "meeting")
                event_duration = event_data.get("duration")

            if not scheduling_url:
                return self.handle_error(ValueError("Could not retrieve Calendly scheduling URL"))

            # Resolve message template
            vars_ctx = {
                **context.get("variables", {}),
                **inputs,
                "booking_url": scheduling_url,
                "event_type_name": event_type_name,
                "event_duration": str(event_duration) if event_duration else ""
            }

            message_template = self.config.get(
                "message_template",
                "You can schedule a {{event_type_name}} here: {{booking_url}}"
            )
            output_message = self.resolve_variable(message_template, vars_ctx)

            return {
                "output": output_message,
                "success": True,
                "error": None,
                "metadata": {
                    "scheduling_url": scheduling_url,
                    "event_type_name": event_type_name,
                    "duration_minutes": event_duration,
                    "provider": "calendly"
                }
            }

        except Exception as e:
            return self.handle_error(e)

    def validate_config(self) -> tuple[bool, Optional[str]]:
        """Validate Calendly node configuration."""
        if not self.config.get("credential_id"):
            return False, "Calendly credential is required"
        return True, None
```

---

### File 3: `src/app/api/v1/routes/webhooks/calendly.py`

**Purpose:** Receive inbound Calendly webhook events (invitee.created, invitee.canceled).

**Follows:** `src/app/api/v1/routes/webhooks/zapier.py` structure.

**Router prefix:** `/webhooks/calendly`

```python
"""
Calendly Webhook Handler - Receive Calendly scheduling events.

WHY:
- React to booking/cancellation events from Calendly
- Capture invitee as lead
- Trigger follow-up actions

HOW:
- POST endpoint receives Calendly events
- Verifies webhook signature (optional)
- Routes to calendly_integration.handle_webhook_event()

ENDPOINTS:
    POST /webhooks/calendly/{bot_id}
        Receive Calendly event for a specific bot
        Body: Calendly webhook payload
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional
import hmac
import hashlib
import json
import logging

from app.db.session import get_db
from app.integrations.calendly_integration import calendly_integration

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/calendly", tags=["webhooks"])


@router.post("/{bot_id}")
async def calendly_webhook(
    bot_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receive Calendly scheduling event.

    WHY: React to booking/cancellation events
    HOW: Parse payload, route to calendly_integration.handle_webhook_event()

    ARGS:
        bot_id: Chatbot or chatflow ID to route event to

    BODY (Calendly webhook payload):
        {
            "event": "invitee.created",
            "payload": {
                "invitee": {"name": "...", "email": "..."},
                "scheduled_event": {"start_time": "...", "end_time": "..."},
                "event_type": {"name": "30 Minute Meeting"}
            }
        }

    RETURNS:
        {"status": "processed"}
    """
    try:
        body = await request.body()
        payload = json.loads(body)

        event_type = payload.get("event")
        logger.info(f"Calendly webhook received: event={event_type}, bot_id={bot_id}")

        # Only handle booking and cancellation events
        if event_type not in ("invitee.created", "invitee.canceled"):
            logger.info(f"Calendly event ignored: {event_type}")
            return {"status": "ignored", "event": event_type}

        result = await calendly_integration.handle_webhook_event(
            db=db,
            bot_id=bot_id,
            event_payload=payload
        )

        return {"status": "processed", **result}

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    except Exception as e:
        logger.error(f"Calendly webhook error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
```

---

## 7. Files to Modify

### `src/app/services/chatflow_executor.py`

**Where:** After `LeadCaptureNodeExecutor` class (line ~422), before `ChatflowExecutor` class (line ~447).

**Add new executor class:**
```python
class CalendlyNodeExecutor(BaseNodeExecutor):
    """
    Calendly scheduling node executor.

    WHY: Share Calendly booking links in chatflows
    HOW: Delegate to CalendlyNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.calendly_node import CalendlyNode
            node = CalendlyNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }
```

**In `ChatflowExecutor.__init__()` at line ~462, add to `self.executors` dict:**
```python
"calendly": CalendlyNodeExecutor(),
```

### `src/app/main.py`

**Line 13** — Add to import:
```python
from app.api.v1.routes.webhooks import calendly as calendly_webhook
```

**After line 326** — Add router mount:
```python
app.include_router(
    calendly_webhook.router,
    prefix=settings.API_V1_PREFIX,
    tags=["webhooks"]
)
```

---

## 8. Credential Setup Flow (User Journey)

1. User goes to **Credentials** in PrivexBot dashboard
2. Clicks "Add Credential" → selects "Calendly"
3. UI prompts for:
   - Calendly Personal Access Token (from https://calendly.com/integrations/api_webhooks)
   - Optional: which event type to use (list fetched from API)
4. Frontend calls `POST /api/v1/credentials` with:
   ```json
   {
       "name": "My Calendly",
       "credential_type": "calendly_api",
       "data": {
           "api_token": "eyJraWQ..."
       }
   }
   ```
5. Backend verifies token by calling `GET /users/me`, stores user_uri, organization_uri, and optionally fetches event types for user to select
6. Credential stored encrypted

---

## 9. Webhook Signature Verification (Optional but Recommended)

Calendly signs webhook payloads using HMAC-SHA256. The signing key is shown in the Calendly webhook subscription dashboard.

**Header:** `Calendly-Webhook-Signature: t=<timestamp>,v1=<signature>`

**Verification:**
```python
def verify_calendly_signature(body: bytes, header: str, signing_key: str) -> bool:
    """Verify Calendly webhook HMAC-SHA256 signature."""
    try:
        parts = dict(item.split("=", 1) for item in header.split(","))
        timestamp = parts.get("t", "")
        signature = parts.get("v1", "")
        message = f"{timestamp}.{body.decode()}"
        expected = hmac.new(
            signing_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        return False
```

This is optional for MVP — implement after core functionality works.

---

## 10. Verification Steps

1. Get a Calendly Personal Access Token from https://calendly.com/integrations/api_webhooks
2. Create a `calendly_api` credential via `POST /api/v1/credentials`
3. Add a CalendlyNode to a chatflow
4. Run the chatflow → verify the booking link is returned in the response
5. For webhook: register a webhook subscription for the bot via `calendly_integration.subscribe_webhook()`
6. Book a test meeting on your Calendly page
7. Verify POST is received at `/api/v1/webhooks/calendly/{bot_id}`
8. Check that a lead is created in the database for the invitee

---

## 11. Scope Boundary

**In scope (MOU requirement):**
- Share Calendly booking links in chatflow (primary use case)
- Capture invitee as lead when someone books

**Out of scope (not in MOU):**
- Google Calendar / Outlook Calendar direct integration
- Custom availability management
- Rescheduling flows
- Multi-host event types
- Payment processing through Calendly
