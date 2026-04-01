# Remaining Tasks — Detailed Implementation Breakdown
> Every action needed to reach 100% MOU completion.
> All task descriptions reference actual existing files as implementation guides.
> No assumptions — all patterns verified from source code.

---

## Phase 4 Completion — Widget Serving

**Priority: HIGH — Needed for Milestone 4 payment claim**

### Task W1: Verify widget config endpoint
**Owner:** Backend
**File to check:** `src/app/api/v1/routes/public.py`
**Time estimate:** 1–2 hours

Action: Verify `GET /api/v1/public/bots/{bot_id}/config` exists and returns:
```json
{
  "bot_id": "uuid",
  "bot_name": "Support",
  "avatar_url": null,
  "color": "#3b82f6",
  "greeting": "Hello! How can I help?",
  "show_branding": true,
  "lead_config": {}
}
```
If missing: Add the endpoint following the spec in `docs/phase2/features/04-widget-embed.md` (Section 3, Gap A).

**Expected result:** Widget startup no longer fails on `GET /config` call.

**Acceptance criteria:**
- [ ] `curl http://localhost:8000/api/v1/public/bots/{active_bot_id}/config` returns 200
- [ ] Response has `bot_name`, `color`, `greeting` fields

---

### Task W2: Verify events endpoint
**Owner:** Backend
**File to check:** `src/app/api/v1/routes/public.py`
**Time estimate:** 1 hour

Action: Verify `POST /api/v1/public/bots/{bot_id}/events` exists.

If missing: Add a stub endpoint that accepts `EventTrackingRequest` and returns 200. The widget sends analytics events (open, close, message_sent) to this endpoint.

**Acceptance criteria:**
- [ ] Widget initialization completes without errors in browser console

---

### Task W3: Deploy widget via Nginx
**Owner:** Infrastructure/DevOps
**Files:** `widget/nginx.conf`, `widget/docker-compose.yml`
**Time estimate:** 2–4 hours

Action: Deploy `widget/build/widget.js` to a public URL.

Config already exists:
- `widget/nginx.conf` — serves `widget/build/` directory
- `widget/docker-compose.yml` — defines the Nginx container
- `widget/wrangler.jsonc` — Cloudflare Workers config (alternative)

Recommendation: Use the existing `widget/docker-compose.yml` Nginx approach. Update the `server_name` in `widget/nginx.conf` to the actual domain.

**Expected result:** `https://widget.privexbot.com/widget.js` (or any public URL) returns the widget bundle.

**Acceptance criteria:**
- [ ] `curl https://widget.privexbot.com/widget.js` returns JavaScript (Content-Type: application/javascript)
- [ ] Widget loads on a test HTML page with the IIFE embed code

---

### Task W4: Add embed code generator to dashboard
**Owner:** Frontend
**Reference:** `docs/phase2/features/04-widget-embed.md` (Section 3, Gap C)
**Time estimate:** 2–3 hours

Action: Add a "Deploy → Website" tab to the chatbot detail page (`frontend/src/pages/chatbots/detail.tsx`) that shows the embed code with the actual bot ID and API key filled in.

Code template (from feature doc):
```typescript
const embedCode = `<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id='privexbot-widget';js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','pb','${widgetCdnUrl}/widget.js'));
  pb('init', {
    id: '${botId}',
    apiKey: '${apiKey}',
    options: { baseURL: '${API_BASE_URL}' }
  });
</script>`;
```

**Acceptance criteria:**
- [ ] Dashboard shows copy-paste embed code on bot deploy page
- [ ] Bot ID and API key are automatically filled into the snippet
- [ ] Clicking "Copy" copies the snippet to clipboard

---

## Phase 5A — Slack Integration

**Priority: HIGH — Required for Milestone 5**
**Full implementation design:** `docs/phase2/features/01-slack-integration.md`

### Task S1: Create `slack_integration.py`
**Owner:** Backend
**Template to follow:** `src/app/integrations/discord_integration.py` (448 lines)
**Output file:** `src/app/integrations/slack_integration.py`
**Time estimate:** 1–2 days

Methods to implement:
```python
class SlackIntegration:
    def verify_signature(body, timestamp, signature, signing_secret) → bool
        # HMAC-SHA256 with stdlib hmac module (NOT Ed25519 like Discord)
        # basestring = f"v0:{timestamp}:{body}"
        # expected = "v0=" + hmac.new(signing_secret, basestring, sha256).hexdigest()

    async def send_message(bot_token, channel_id, text, blocks=None) → dict
        # POST https://slack.com/api/chat.postMessage
        # Split messages > 3000 chars (Slack limit)

    async def handle_event(db, team_id, event_payload) → None
        # Extract event.type (message, app_mention)
        # Ignore event.bot_id (prevent loops)
        # team_id → SlackWorkspaceDeployment → chatbot_id
        # Call chatbot_service or chatflow_service
        # Call send_message() with response

    async def get_workspace_info(bot_token) → dict
        # GET https://slack.com/api/team.info

    async def exchange_oauth_code(code, redirect_uri) → dict
        # POST https://slack.com/api/oauth.v2.access

    def _auto_capture_lead(db, bot, bot_type, session_id, slack_user_id, ...)
        # Follow discord_integration.py:319–403 pattern

    def _get_bot(db, entity_id) → (bot_type, bot)
        # Follow discord_integration.py:405–421 pattern

slack_integration = SlackIntegration()  # Global instance
```

**Expected result:** Can send a Slack message and route incoming events to chatbot service.

**Acceptance criteria:**
- [ ] `verify_signature()` returns True for valid Slack signatures
- [ ] `send_message()` posts a message to a Slack channel
- [ ] `handle_event()` routes to chatbot and sends the response back

---

### Task S2: Create `src/app/api/v1/routes/webhooks/slack.py`
**Owner:** Backend
**Template:** `src/app/api/v1/routes/webhooks/discord.py`
**Time estimate:** 4–6 hours

Endpoints:
```
POST /webhooks/slack/events
  - Handle URL verification challenge (type=="url_verification")
  - Verify HMAC-SHA256 signature
  - Return 200 immediately
  - Process event in BackgroundTask (Slack requires response within 3 seconds)
  - Reference: FastAPI BackgroundTasks, same pattern as Telegram webhook

GET /webhooks/slack/install
  - Redirect to Slack OAuth authorization URL

GET /webhooks/slack/oauth-callback
  - Exchange code → tokens via slack_integration.exchange_oauth_code()
  - Store bot_token as SlackWorkspaceDeployment record
  - Redirect to frontend dashboard
```

**Critical:** Must use `BackgroundTasks` to respond 200 immediately, then process async. Slack will retry if no 200 within 3 seconds.

**Expected result:** Slack URL verification succeeds; DMs route to chatbot.

**Acceptance criteria:**
- [ ] `POST /webhooks/slack/events` with `type=url_verification` returns `{"challenge": "..."}`
- [ ] Slack app URL is verified in Slack app settings
- [ ] DM to the bot → bot responds in the DM

---

### Task S3: Create `src/app/api/v1/routes/slack_apps.py`
**Owner:** Backend
**Template:** `src/app/api/v1/routes/discord_guilds.py`
**Time estimate:** 4–6 hours

Endpoints:
```
POST   /slack/workspaces/deploy     Connect workspace to chatbot
GET    /slack/workspaces/           List deployments
GET    /slack/workspaces/install-url  OAuth URL
GET    /slack/workspaces/{team_id}  Get deployment
PATCH  /slack/workspaces/{team_id}  Update restrictions
DELETE /slack/workspaces/{team_id}  Remove deployment
POST   /slack/workspaces/{team_id}/activate
POST   /slack/workspaces/{team_id}/deactivate
```

**Expected result:** Dashboard can connect and manage Slack workspace deployments.

**Acceptance criteria:**
- [ ] `POST /slack/workspaces/deploy` creates a `SlackWorkspaceDeployment` record
- [ ] `GET /slack/workspaces/` returns workspace deployments

---

### Task S4: Create `src/app/models/slack_workspace_deployment.py`
**Owner:** Backend
**Template:** `src/app/models/discord_guild_deployment.py`
**Time estimate:** 1 hour

Fields:
```python
id: UUID, workspace_id: UUID (FK workspaces), team_id: str,
team_name: str, team_domain: str, team_icon: str,
chatbot_id: UUID (FK chatbots), bot_token_credential_id: UUID (FK credentials),
allowed_channel_ids: ARRAY(String), is_active: bool,
guild_metadata: JSONB, created_at: datetime, deployed_at: datetime
```

Then add to `src/app/db/base.py` and run: `alembic revision --autogenerate -m "add_slack_workspace_deployments"`

**Acceptance criteria:**
- [ ] Migration creates `slack_workspace_deployments` table in PostgreSQL

---

### Task S5: Create `src/app/services/slack_workspace_service.py`
**Owner:** Backend
**Template:** `src/app/services/discord_guild_service.py`
**Time estimate:** 3–4 hours

Methods:
```python
deploy_to_workspace(db, workspace_id, chatbot_id, team_id, bot_token_credential_id, ...) → SlackWorkspaceDeployment
get_chatbot_for_team(db, team_id) → Optional[(Chatbot, SlackWorkspaceDeployment)]
list_workspace_deployments(db, workspace_id, ...) → List
get_deployment(db, workspace_id, team_id) → Optional[SlackWorkspaceDeployment]
remove_workspace(db, workspace_id, team_id) → bool
activate_workspace(db, workspace_id, team_id) → SlackWorkspaceDeployment
deactivate_workspace(db, workspace_id, team_id) → SlackWorkspaceDeployment
update_channel_restrictions(db, workspace_id, team_id, allowed_channel_ids) → SlackWorkspaceDeployment
generate_install_url() → str
```

**Acceptance criteria:**
- [ ] `get_chatbot_for_team()` returns the correct chatbot for a Slack `team_id`

---

### Task S6: Mount Slack routers in `main.py`
**Owner:** Backend
**File:** `src/app/main.py`
**Time estimate:** 30 minutes

Add to import line at line 13:
```python
from app.api.v1.routes.webhooks import slack as slack_webhook
from app.api.v1.routes import slack_apps
```

Add router mounts (after existing webhook mounts):
```python
app.include_router(slack_apps.router, prefix=settings.API_V1_PREFIX, tags=["slack"])
app.include_router(slack_webhook.router, prefix=settings.API_V1_PREFIX, tags=["webhooks"])
```

**Acceptance criteria:**
- [ ] Slack endpoints appear in http://localhost:8000/api/docs

---

### Task S7: Add Slack env vars to config
**Owner:** Backend
**Files:** `src/app/core/config.py`, `.env.dev`, `.env.example`
**Time estimate:** 30 minutes

Add to `config.py`:
```python
SLACK_CLIENT_ID: str = Field(default="", description="Slack app client ID")
SLACK_CLIENT_SECRET: str = Field(default="", description="Slack app client secret")
SLACK_SIGNING_SECRET: str = Field(default="", description="Slack request signing secret")
```

**Acceptance criteria:**
- [ ] `settings.SLACK_SIGNING_SECRET` available at runtime

---

### Task S8: Add Slack UI to frontend
**Owner:** Frontend
**Template:** Discord deployment UI in `frontend/src/`
**Time estimate:** 1 day

Tasks:
1. Add Slack to the deployment channels selector on chatbot detail page
2. Add "Install Slack" button that calls `GET /slack/workspaces/install-url`
3. Show connected Slack workspaces list on chatbot detail page
4. Handle OAuth callback redirect (Slack redirects to frontend after install)

**Acceptance criteria:**
- [ ] Dashboard shows "Add to Slack" button for deployed chatbots
- [ ] Successful OAuth install shows workspace in deployment list

---

**Phase 5A Complete Acceptance Criteria:**
- [ ] Slack app URL verification passes in Slack developer dashboard
- [ ] DM to Slack bot → chatbot responds in DM
- [ ] Channel restriction works (only responds in `allowed_channel_ids`)
- [ ] `SlackWorkspaceDeployment` record created in PostgreSQL
- [ ] Dashboard shows Slack as connected deployment channel

---

## Phase 5B — Gmail Integration

**Priority: HIGH — Required for Milestone 5**
**Full implementation design:** `docs/phase2/features/02-gmail-integration.md`

### Task G1: Add `send_gmail()` to `google_adapter.py`
**Owner:** Backend
**File to modify:** `src/app/integrations/google_adapter.py`
**Where to add:** Before line 399 (before `google_adapter = GoogleAdapter()`)
**Time estimate:** 3–4 hours

Method spec (full code in `docs/phase2/features/02-gmail-integration.md` Section 6):
```python
async def send_gmail(self, access_token, to, subject, body, body_type="html",
                     cc=None, bcc=None, reply_to=None, from_name=None) → dict:
    # Build RFC 2822 MIMEMultipart message
    # base64url encode (Gmail API requirement)
    # POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
    # Returns: {"success": True, "message_id": "...", "thread_id": "..."}
```

**Expected result:** Can send an email via Gmail API with a valid OAuth access token.

**Acceptance criteria:**
- [ ] Calling `send_gmail()` with a valid access_token sends an email (verify in Gmail Sent folder)
- [ ] Returns `{"success": False, "error": "..."}` on API error instead of raising

---

### Task G2: Add `refresh_gmail_token()` to `google_adapter.py`
**Owner:** Backend
**File to modify:** `src/app/integrations/google_adapter.py`
**Time estimate:** 1 hour

Method spec (full code in `docs/phase2/features/02-gmail-integration.md` Section 6):
```python
async def refresh_gmail_token(self, refresh_token, client_id, client_secret) → dict:
    # POST https://oauth2.googleapis.com/token
    # grant_type=refresh_token
    # Returns: {"access_token": "ya29...", "expires_in": 3599}
```

**Acceptance criteria:**
- [ ] Calling `refresh_gmail_token()` with a valid refresh_token returns a new access_token

---

### Task G3: Extend `email_node.py` with Gmail path
**Owner:** Backend
**File to modify:** `src/app/chatflow/nodes/email_node.py`
**Where to add:** After credential lookup (~line 80), before SMTP path (~line 132)
**Time estimate:** 2–3 hours

Logic (full code in `docs/phase2/features/02-gmail-integration.md` Section 6):
```python
credential_type = cred_data.get("type", "smtp")

if credential_type == "google_oauth_gmail":
    # Auto-refresh if token expired (within 60 seconds)
    # Call google_adapter.send_gmail()
    # Return success/error result

# ELSE: existing SMTP path continues unchanged
```

**Expected result:** Email node uses Gmail API when `type=google_oauth_gmail` credential is selected; uses SMTP for all other credential types.

**Acceptance criteria:**
- [ ] Email node sends via Gmail API when Gmail credential selected
- [ ] Existing SMTP email node still works unchanged (regression test)
- [ ] Token auto-refresh works: manually set `token_expiry` to past time → verify auto-refresh on next send

---

### Task G4: Add Gmail OAuth callback routes
**Owner:** Backend
**File to create or modify:** `src/app/api/v1/routes/auth.py` or new `google_oauth.py`
**Time estimate:** 3–4 hours

Endpoints:
```
GET /auth/google/gmail/authorize
  → Returns Google OAuth authorization URL
  → Includes scope: gmail.send + userinfo.email
  → access_type=offline, prompt=consent (to get refresh_token)

GET /auth/google/gmail/callback?code=xxx&state=workspace_id
  → Exchange code → access_token + refresh_token
  → POST https://oauth2.googleapis.com/token
  → Create Credential record with type="google_oauth_gmail"
  → Return credential_id to frontend
```

**Expected result:** User can connect Gmail via OAuth; token stored as encrypted credential.

**Acceptance criteria:**
- [ ] Visiting `/auth/google/gmail/authorize` redirects to Google consent screen
- [ ] After user authorizes, `Credential` record with `credential_type=google_oauth_gmail` is created in DB
- [ ] `access_token` and `refresh_token` are stored encrypted

---

### Task G5: Add Gmail OAuth env vars
**Owner:** Backend
**Files:** `src/app/core/config.py`, `.env.dev`, `.env.example`
**Time estimate:** 30 minutes

```python
GOOGLE_CLIENT_ID: str = Field(default="", description="Google OAuth client ID")
GOOGLE_CLIENT_SECRET: str = Field(default="", description="Google OAuth client secret")
GOOGLE_REDIRECT_URI: str = Field(default="http://localhost:8000/api/v1/auth/google/gmail/callback")
```

Note: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` may already exist if Google Docs integration is configured. Gmail uses the same project but adds the `gmail.send` scope.

**Acceptance criteria:**
- [ ] `settings.GOOGLE_CLIENT_ID` available at runtime

---

### Task G6: Add Gmail UI to frontend
**Owner:** Frontend
**Time estimate:** 4–6 hours

Tasks:
1. Add "Connect Gmail" button in `src/pages/Credentials.tsx` (opens OAuth flow via `GET /auth/google/gmail/authorize`)
2. Show Gmail credentials as selectable option in `src/components/chatflow/configs/EmailNodeConfig.tsx`
3. Add `CredentialSelector` type filter for `google_oauth_gmail`

**Acceptance criteria:**
- [ ] "Connect Gmail" button appears in Credentials page
- [ ] Clicking it opens Google OAuth consent screen
- [ ] After authorization, Gmail credential appears in Email node config dropdown

---

**Phase 5B Complete Acceptance Criteria:**
- [ ] Full OAuth flow: Connect Gmail → authorize → credential stored → Email node uses it
- [ ] Email sent via Gmail API appears in Gmail Sent folder
- [ ] SMTP email path still works (no regression)
- [ ] Token auto-refresh works on expiry

---

## Phase 5C — Calendly Integration

**Priority: MEDIUM — Milestone 5 requires at least 3 integrations (already have 4 working)**
**Full implementation design:** `docs/phase2/features/03-calendly-integration.md`

### Task C1: Create `src/app/integrations/calendly_integration.py`
**Owner:** Backend
**Template:** `src/app/integrations/zapier_integration.py`
**Time estimate:** 1 day

Methods:
```python
class CalendlyIntegration:
    def __init__(self):
        self.base_url = "https://api.calendly.com"

    async def get_current_user(access_token) → dict
        # GET /users/me

    async def list_event_types(access_token, user_uri) → list
        # GET /event_types?user={user_uri}

    async def subscribe_webhook(access_token, url, events, user_uri, org_uri) → dict
        # POST /webhook_subscriptions

    async def unsubscribe_webhook(access_token, webhook_uuid) → bool
        # DELETE /webhook_subscriptions/{uuid}

    async def handle_webhook_event(db, bot_id, event_payload) → dict
        # Parse invitee.created / invitee.canceled
        # Capture lead from invitee data
        # Return event summary

    def _get_bot(db, entity_id) → (bot_type, bot)
        # Same pattern as discord_integration.py:405–421

calendly_integration = CalendlyIntegration()  # Global instance
```

**Acceptance criteria:**
- [ ] `list_event_types()` returns event types for a test Calendly account
- [ ] `handle_webhook_event()` creates a Lead record for `invitee.created` events

---

### Task C2: Create `src/app/chatflow/nodes/calendly_node.py`
**Owner:** Backend
**Template:** `src/app/chatflow/nodes/email_node.py`
**Time estimate:** 4–6 hours

```python
class CalendlyNode(BaseNode):
    def validate_config(self) → bool:
        return bool(self.config.get("credential_id"))

    async def execute(self, db, context, inputs) → dict:
        # Get Calendly credential (Personal Access Token)
        # Call calendly_integration.list_event_types()
        # Select event_type based on config or first result
        # Resolve message_template: "{{booking_url}}" → scheduling_url
        # Return formatted booking link message
```

Node config shape:
```json
{
  "credential_id": "uuid",
  "event_type_name": "30-Minute Meeting",
  "message_template": "Book a call here: {{booking_url}}"
}
```

**Acceptance criteria:**
- [ ] CalendlyNode returns a message containing the Calendly booking URL

---

### Task C3: Add `CalendlyNodeExecutor` to `chatflow_executor.py`
**Owner:** Backend
**File to modify:** `src/app/services/chatflow_executor.py`
**Time estimate:** 1 hour

```python
# Add class before ChatflowExecutor.__init__ (after existing executor classes):
class CalendlyNodeExecutor:
    async def execute(self, node_config, db, context, inputs) → dict:
        from app.chatflow.nodes.calendly_node import CalendlyNode
        node = CalendlyNode(node_config)
        return await node.execute(db, context, inputs)

# Add to self.executors dict in __init__:
# "calendly": CalendlyNodeExecutor(),
```

**Acceptance criteria:**
- [ ] A chatflow with a "calendly" node type executes without "unknown node type" error

---

### Task C4: Create `src/app/api/v1/routes/webhooks/calendly.py`
**Owner:** Backend
**Template:** `src/app/api/v1/routes/webhooks/zapier.py`
**Time estimate:** 2–3 hours

```
POST /webhooks/calendly/{bot_id}
  - Receive invitee.created and invitee.canceled events
  - Parse invitee name, email, event time
  - Capture lead if invitee.created
  - Return 200 OK
```

Mount in `main.py` — add `from app.api.v1.routes.webhooks import calendly as calendly_webhook` and `app.include_router(...)`.

**Acceptance criteria:**
- [ ] Calendly sends a test webhook → lead is created in the database

---

### Task C5: Add Calendly frontend components
**Owner:** Frontend
**Time estimate:** 1 day

Files to create:
1. `src/components/chatflow/nodes/CalendlyNode.tsx` — visual node component (follow EmailNode.tsx)
2. `src/components/chatflow/configs/CalendlyNodeConfig.tsx` — config form with event type selector

Files to modify:
3. `src/components/chatflow/ReactFlowCanvas.tsx` — add `"calendly": CalendlyNode` to `nodeTypes`
4. `src/components/chatflow/NodePalette.tsx` — add Calendly to NODE_TYPES array, category "Integration"
5. `src/components/chatflow/NodeConfigPanel.tsx` — add case for `"calendly"` type

**Acceptance criteria:**
- [ ] CalendlyNode appears in NodePalette under "Integration" category
- [ ] Dragging it to canvas shows the node
- [ ] Clicking the node shows the CalendlyNodeConfig panel

---

**Phase 5C Complete Acceptance Criteria:**
- [ ] CalendlyNode in chatflow returns booking URL in response
- [ ] `{{booking_url}}` variable resolves correctly in message template
- [ ] Calendly webhook receives booking event → Lead created in DB
- [ ] Node appears in frontend NodePalette

---

## Phase 6 — KPI Achievement

**Priority: MEDIUM — Growth work, not code**

The analytics and tracking infrastructure is complete. Reaching KPIs requires user acquisition.

### Task K1: Beta invite campaign
**File:** `src/app/api/v1/routes/beta.py`, `src/app/services/invite_code_service.py`

The invite code system is already built. Actions:
1. Generate 100 beta invite codes via `POST /api/v1/beta/codes/generate`
2. Distribute codes in Secret Network Discord, Telegram community, and Twitter/X
3. Track signups via `GET /api/v1/dashboard` (total users metric)

### Task K2: Product Hunt launch

Steps:
1. Prepare screenshots: chatflow builder, KB upload, deploy to Telegram
2. Write product description emphasizing "privacy-first AI chatbot on Secret Network"
3. Launch on https://www.producthunt.com

### Task K3: Monitor KPIs

Use the admin dashboard at `GET /api/v1/admin/analytics` or frontend admin panel.

Target metrics:
- 500 registered users (currently: check via admin panel)
- 5,000 messages processed (tracked in `chat_messages` table)
- 3 live integrations with real usage (Discord + Telegram + Slack once implemented)

---

## Summary: All Tasks Ordered by Priority

| # | Task | Owner | Est. Hours | Dependency |
|---|---|---|---|---|
| W1 | Verify widget config endpoint | Backend | 1–2h | — |
| W2 | Verify events endpoint | Backend | 1h | — |
| S4 | Create Slack DB model + migration | Backend | 1h | — |
| S1 | Create `slack_integration.py` | Backend | 8–16h | — |
| S2 | Create Slack webhook route | Backend | 4–6h | S1 |
| S5 | Create `slack_workspace_service.py` | Backend | 3–4h | S4 |
| S3 | Create `slack_apps.py` routes | Backend | 4–6h | S4, S5 |
| S6 | Mount Slack routers in `main.py` | Backend | 0.5h | S2, S3 |
| S7 | Add Slack env vars | Backend | 0.5h | — |
| G1 | Add `send_gmail()` to `google_adapter.py` | Backend | 3–4h | — |
| G2 | Add `refresh_gmail_token()` | Backend | 1h | — |
| G3 | Extend `email_node.py` with Gmail path | Backend | 2–3h | G1, G2 |
| G4 | Add Gmail OAuth callback routes | Backend | 3–4h | — |
| G5 | Add Gmail env vars | Backend | 0.5h | — |
| C1 | Create `calendly_integration.py` | Backend | 8h | — |
| C2 | Create `calendly_node.py` | Backend | 4–6h | C1 |
| C3 | Register `CalendlyNodeExecutor` | Backend | 1h | C2 |
| C4 | Create Calendly webhook route | Backend | 2–3h | C1 |
| W4 | Add embed code generator to dashboard | Frontend | 2–3h | W1 |
| S8 | Add Slack UI to frontend | Frontend | 8h | S3 done |
| G6 | Add Gmail OAuth UI to frontend | Frontend | 4–6h | G4 done |
| C5 | Add CalendlyNode to frontend | Frontend | 8h | — |
| W3 | Deploy widget via Nginx | Infrastructure | 2–4h | — |
| K1 | Beta invite campaign | Marketing | Ongoing | W3, S6 |
