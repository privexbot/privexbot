# Slack Bot Deployment — Implementation Design
> Feature: Deploy PrivexBot chatbots to Slack workspaces
> MOU Reference: Appendix A ("Deploy on Telegram, Discord, or Slack"), Milestone 5
> Status: ❌ NOT IMPLEMENTED — design ready for implementation

---

## 1. What This Feature Provides

Slack deployment allows a PrivexBot chatbot or chatflow to respond to messages inside a Slack workspace. A user connects their Slack workspace to PrivexBot, assigns a chatbot to it, and the bot responds to DMs or channel messages automatically.

This mirrors the existing Discord deployment architecture exactly.

---

## 2. Existing Patterns to Follow

The following files are the authoritative reference for this implementation. Read them before writing any code.

### Primary References

| Reference File | Purpose |
|---|---|
| `src/app/integrations/discord_integration.py` | Template for `slack_integration.py` — bot token extraction, webhook handling, lead capture, message sending |
| `src/app/api/v1/routes/webhooks/discord.py` | Template for `webhooks/slack.py` — inbound event routing, signature verification |
| `src/app/api/v1/routes/discord_guilds.py` | Template for `slack_apps.py` — workspace management routes (deploy, list, remove, update) |
| `src/app/services/discord_guild_service.py` | Template for `slack_workspace_service.py` — business logic for workspace mappings |
| `src/app/models/discord_guild_deployment.py` | Template for `slack_workspace_deployment.py` model |
| `src/app/integrations/telegram_integration.py` | Secondary reference — async HTTP pattern + lead capture |

### Executor Registration Reference

| Reference File | Line | Purpose |
|---|---|---|
| `src/app/services/chatflow_executor.py` | 462–485 | Where to add `"slack"` executor registration |
| `src/app/main.py` | 302–326 | Where to add `slack_webhook` and `slack_apps` router mounts |
| `src/app/main.py` | 12–13 | Import line to add new modules |

---

## 3. Architecture Overview

### How Discord Works (Reference)
```
Discord Interaction → POST /api/v1/webhooks/discord/shared
  → signature verification (Ed25519)
  → guild_id → DiscordGuildDeployment → chatbot_id
  → chatbot_service.process_message() or chatflow_service.execute()
  → Discord API: POST https://discord.com/api/v10/... (response)
```

### How Slack Will Work (Same Pattern)
```
Slack Event → POST /api/v1/webhooks/slack/events
  → signature verification (HMAC-SHA256 with X-Slack-Signature)
  → team_id → SlackWorkspaceDeployment → chatbot_id
  → chatbot_service.process_message() or chatflow_service.execute()
  → Slack Web API: POST https://slack.com/api/chat.postMessage
```

### Key Difference vs Discord
- Discord uses **Ed25519 signature** verification (PyNaCl library)
- Slack uses **HMAC-SHA256 signature** verification (standard `hmac` module — already in stdlib)
- Discord uses "Interactions" (request/response in one HTTP call)
- Slack uses **Events API** — must respond `200 OK` immediately, then call Slack API asynchronously
- Discord requires one bot per customer (or shared bot architecture)
- Slack: **one PrivexBot Slack App**, customers install it via OAuth 2.0 into their workspace → same shared architecture as Discord

---

## 4. Slack App Setup (Platform Configuration)

These are one-time setup steps on https://api.slack.com/apps — done by PrivexBot team, not per-customer:

### Required Bot Token OAuth Scopes
```
chat:write          — Send messages as the bot
chat:write.public   — Send to channels without being a member
im:read             — Read direct messages
im:write            — Send direct messages
im:history          — View messages in DMs
channels:history    — View messages in public channels
groups:history      — View messages in private channels
app_mentions:read   — Receive @mention events
```

### Event Subscriptions to Enable
```
message.im          — DMs to the bot
app_mention         — @mentions in channels
```

### Request URL (to set in Slack App settings)
```
https://your-domain.com/api/v1/webhooks/slack/events
```

### Environment Variables Required
```
SLACK_CLIENT_ID=xxx.xxx
SLACK_CLIENT_SECRET=xxx
SLACK_SIGNING_SECRET=xxx    # For HMAC signature verification
SLACK_SHARED_BOT_TOKEN=xoxb-...   # Installed bot token
```

---

## 5. Files to Create

### File 1: `src/app/integrations/slack_integration.py`

**Purpose:** Core Slack API wrapper — sending messages, OAuth handling, lead capture, bot resolution.

**Follows:** `src/app/integrations/discord_integration.py` structure exactly.

**Key methods to implement:**

```
SlackIntegration class:
  - verify_signature(body, timestamp, signature, signing_secret) → bool
      Uses hmac.new(signing_secret, f"v0:{timestamp}:{body}", sha256)
      Compares to X-Slack-Signature header value
      Reference: Slack docs "Verifying requests from Slack"

  - send_message(bot_token, channel_id, text, blocks=None) → dict
      POST https://slack.com/api/chat.postMessage
      Headers: Authorization: Bearer {bot_token}
      Body: {channel: channel_id, text: text, blocks: blocks}
      Splits messages > 3000 chars (Slack text limit)

  - handle_event(db, team_id, event_payload) → None
      Extracts event type (message, app_mention)
      Ignores bot_id events (prevent loops)
      Resolves team_id → SlackWorkspaceDeployment → chatbot_id
      Calls chatbot_service.process_message() or chatflow_service.execute()
      Calls send_message() with response

  - get_workspace_info(bot_token) → dict
      GET https://slack.com/api/team.info
      Returns {team_id, team_name, team_domain, team_icon}

  - get_bot_info(bot_token) → dict
      GET https://slack.com/api/auth.test
      Returns {user_id, user, team_id, team, url}

  - exchange_oauth_code(code, redirect_uri) → dict
      POST https://slack.com/api/oauth.v2.access
      Exchanges authorization code → access_token + bot_token
      Used during OAuth installation flow

  - _auto_capture_lead(db, bot, bot_type, session_id, slack_user_id, ...)
      Follows discord_integration.py:319–403 pattern exactly
      Calls lead_capture_service.capture_from_slack()

  - _get_bot(db, entity_id) → (bot_type, bot)
      Follows discord_integration.py:405–421 pattern exactly

# Global instance
slack_integration = SlackIntegration()
```

**Dependencies:**
- `requests` (already used in discord_integration.py:18)
- `hmac`, `hashlib` (stdlib, already used in webhooks/discord.py:23–24)
- `app.services.chatbot_service`
- `app.services.chatflow_service`
- `app.services.lead_capture_service`
- `app.models.credential.Credential`
- `app.services.credential_service`

---

### File 2: `src/app/api/v1/routes/webhooks/slack.py`

**Purpose:** FastAPI router that receives Slack Events API POST requests.

**Follows:** `src/app/api/v1/routes/webhooks/discord.py` structure exactly.

**Router prefix:** `/webhooks/slack`

**Endpoints to implement:**

```
POST /webhooks/slack/events
  - Receives all Slack events for the shared app
  - Must respond 200 OK within 3 seconds (Slack requirement)
  - Handles URL verification challenge (type="url_verification")
  - Verifies HMAC-SHA256 signature via X-Slack-Signature header
  - Extracts team_id from payload.team_id
  - Routes to _handle_slack_event(db, payload)
  - Critical: returns {"challenge": payload["challenge"]} for URL verification

GET /webhooks/slack/install
  - Starts OAuth installation flow
  - Redirects to Slack OAuth authorization URL
  - URL: https://slack.com/oauth/v2/authorize?client_id=...&scope=...&redirect_uri=...

GET /webhooks/slack/oauth-callback
  - Handles OAuth redirect after user installs the app
  - Exchanges code → tokens via slack_integration.exchange_oauth_code()
  - Stores bot_token as SlackWorkspaceDeployment record
  - Redirects to frontend dashboard success page
```

**Signature verification pattern (different from Discord):**
```python
# X-Slack-Signature: v0=abc123...
# X-Slack-Request-Timestamp: 1234567890
# Verify: "v0:" + timestamp + ":" + body

import hmac, hashlib, time

def verify_slack_signature(body: bytes, timestamp: str, signature: str, signing_secret: str) -> bool:
    # Reject requests older than 5 minutes
    if abs(time.time() - int(timestamp)) > 300:
        return False
    basestring = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.new(
        signing_secret.encode(), basestring.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

**Event routing pattern:**
```python
async def _handle_slack_event(db, payload):
    event = payload.get("event", {})
    event_type = event.get("type")
    team_id = payload.get("team_id")

    # Ignore bot messages to prevent loops
    if event.get("bot_id"):
        return

    if event_type in ("message", "app_mention"):
        text = event.get("text", "")
        user_id = event.get("user")
        channel_id = event.get("channel")

        # Lookup workspace deployment
        deployment = slack_workspace_service.get_chatbot_for_team(db, team_id)
        if not deployment:
            return

        # Session ID (unique per user per channel)
        session_id = f"slack_{team_id}_{channel_id}_{user_id}"

        # Process and respond
        ...
        await slack_integration.send_message(bot_token, channel_id, response["response"])
```

---

### File 3: `src/app/api/v1/routes/slack_apps.py`

**Purpose:** Authenticated API routes for managing Slack workspace connections.

**Follows:** `src/app/api/v1/routes/discord_guilds.py` structure exactly.

**Router prefix:** `/slack/workspaces`

**Endpoints to implement:**

```
POST   /slack/workspaces/deploy
  - Connects a Slack workspace to a chatbot
  - Body: {chatbot_id: UUID, team_id: str, team_name: str, bot_token_credential_id: str}
  - Creates SlackWorkspaceDeployment record

GET    /slack/workspaces/
  - Lists all Slack workspace deployments for the current workspace
  - Optional query: chatbot_id, active_only

GET    /slack/workspaces/install-url
  - Returns Slack OAuth installation URL
  - Equivalent of discord_guilds.py GET /discord/guilds/invite-url

GET    /slack/workspaces/{team_id}
  - Get details of a specific workspace deployment

PATCH  /slack/workspaces/{team_id}
  - Update channel restrictions or active status

DELETE /slack/workspaces/{team_id}
  - Remove workspace deployment (disconnect chatbot)

POST   /slack/workspaces/{team_id}/activate
POST   /slack/workspaces/{team_id}/deactivate
```

**Request/Response models:**
```python
class DeployToWorkspaceRequest(BaseModel):
    chatbot_id: UUID
    team_id: str            # Slack team/workspace ID (e.g., T012AB3C4)
    team_name: Optional[str]
    allowed_channel_ids: Optional[List[str]]  # [] = all channels

class WorkspaceDeploymentResponse(BaseModel):
    id: UUID
    workspace_id: UUID      # PrivexBot workspace
    team_id: str            # Slack team ID
    team_name: Optional[str]
    chatbot_id: UUID
    chatbot_name: Optional[str]
    allowed_channel_ids: List[str]
    is_active: bool
    created_at: datetime
    deployed_at: Optional[datetime]
```

---

## 6. Files to Modify

### `src/app/main.py`

**Line 12–13** — Add to import line:
```python
# Add to existing imports:
from app.api.v1.routes.webhooks import slack as slack_webhook
from app.api.v1.routes import slack_apps
```

**After line 326** — Add router mounts:
```python
app.include_router(
    slack_apps.router,
    prefix=settings.API_V1_PREFIX,
    tags=["slack"]
)

app.include_router(
    slack_webhook.router,
    prefix=settings.API_V1_PREFIX,
    tags=["webhooks"]
)
```

### `src/app/services/credential_service.py`

Add `slack_bot` as a recognized credential type. The credential data shape:
```json
{
    "bot_token": "xoxb-...",
    "signing_secret": "abc123..."
}
```

---

## 7. Database Model Required

### `src/app/models/slack_workspace_deployment.py`

**Follows:** `src/app/models/discord_guild_deployment.py` exactly.

**Table name:** `slack_workspace_deployments`

**Fields:**
```python
id: UUID (PK)
workspace_id: UUID (FK → workspaces.id)
team_id: str          # Slack workspace/team ID
team_name: str
team_domain: str      # e.g., "mycompany.slack.com"
team_icon: str        # URL to workspace icon
chatbot_id: UUID (FK → chatbots.id)
bot_token_credential_id: UUID (FK → credentials.id)
allowed_channel_ids: ARRAY(String)
is_active: bool
guild_metadata: JSONB   # Reuse field name for compat
created_at: datetime
deployed_at: datetime
```

---

## 8. Service Layer Required

### `src/app/services/slack_workspace_service.py`

**Follows:** `src/app/services/discord_guild_service.py` exactly.

**Methods:**
```
deploy_to_workspace(db, workspace_id, chatbot_id, team_id, bot_token_credential_id, ...) → SlackWorkspaceDeployment
get_chatbot_for_team(db, team_id) → Optional[(Chatbot, SlackWorkspaceDeployment)]
list_workspace_deployments(db, workspace_id, chatbot_id, active_only) → List[...]
get_deployment(db, workspace_id, team_id) → Optional[SlackWorkspaceDeployment]
remove_workspace(db, workspace_id, team_id) → bool
activate_workspace(db, workspace_id, team_id) → SlackWorkspaceDeployment
deactivate_workspace(db, workspace_id, team_id) → SlackWorkspaceDeployment
update_channel_restrictions(db, workspace_id, team_id, allowed_channel_ids) → SlackWorkspaceDeployment
generate_install_url() → str  # Slack OAuth authorization URL
```

---

## 9. Key Implementation Notes

### Slack's 3-Second Response Requirement
Slack requires webhook endpoints to return HTTP 200 within 3 seconds. For long AI inference calls, the pattern is:
- Return `200 OK` immediately to Slack
- Process the message asynchronously (background task or Celery)
- Send the response via `chat.postMessage` after inference completes

**Pattern:**
```python
from fastapi import BackgroundTasks

@router.post("/events")
async def slack_events(request: Request, background_tasks: BackgroundTasks):
    payload = await request.json()
    # URL verification (sync)
    if payload.get("type") == "url_verification":
        return {"challenge": payload["challenge"]}
    # Verify signature
    ...
    # Fire-and-forget processing
    background_tasks.add_task(_handle_slack_event, db, payload)
    return {}  # 200 OK immediately
```

**Reference:** FastAPI `BackgroundTasks` — similar pattern can be seen in how Telegram handles webhooks in `src/app/api/v1/routes/webhooks/telegram.py`

### Message Deduplication
Slack may retry events if no 200 is received. Use `event.event_ts` + team_id as deduplication key in Redis (same pattern as Telegram's `update_id` deduplication).

### Bot Loop Prevention
Always check `event.get("bot_id")` — if set, the message is from a bot (including our own bot). Return immediately to prevent infinite loops.

### Text Chunking
Slack has a 3000-character limit for text in `chat.postMessage`. For longer responses, split into multiple messages (same pattern as `telegram_integration.py:247–255` which handles Telegram's 4096 char limit).

---

## 10. Verification Steps

1. Create a Slack App at https://api.slack.com/apps
2. Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` in `.env`
3. Start the server, set Slack "Request URL" to `https://your-domain.com/api/v1/webhooks/slack/events`
4. Slack will send a `url_verification` challenge — endpoint must return `{"challenge": "..."}` immediately
5. Install the app to a test workspace via `GET /api/v1/webhooks/slack/install`
6. DM the bot in Slack — verify the message routes to chatbot_service and response is sent back
7. Check `SlackWorkspaceDeployment` record is created in the database
8. Test channel restrictions: set `allowed_channel_ids = ["C1234"]`, verify bot ignores other channels
