# PrivexBot Backend

## Overview
FastAPI + PostgreSQL + Redis + Qdrant (vectors) + Celery. Privacy-first AI chatbot/chatflow platform using Secret AI (TEE-based inference).

## Key Architecture Patterns

### Draft-First Deployment
All entities (chatbots, chatflows, KBs) follow: Redis Draft → PostgreSQL Deploy.
- Drafts: 24hr TTL in Redis (`services/draft_service.py`), auto-saved by frontend.
- Deploy: `draft_service.deploy_draft()` creates DB rows + API keys.
- Edit: creates a fresh draft from the deployed entity, then re-deploys on finalize.
- `chatflow.config["deployment"]` is reassigned (not mutated in place) — JSONB columns are not `MutableDict` here, so in-place mutation does NOT persist.

### Chatflow Execution Pipeline
```
Message arrives → public.py identifies bot_type →
  chatflow_service.execute() → _execute_graph() →
  Find trigger node → Loop: execute node → store output → get next →
  Response node reached → Save message → Return
```
**Critical:** React Flow stores config at `node["data"]["config"]`, NOT `node["config"]`. The executor reads via `node.get("data", {}).get("config", node.get("config", {}))`.

### Node Execution
- `services/chatflow_executor.py` registers a class per node `type` string.
- Each executor calls `BaseNode.execute(db, context, inputs)`.
- `inputs` always includes `{"input": user_message}` (the raw message).
- Outputs stored at `context["variables"][node_id]` AND `context["variables"]["_last_output"]`.
- `{{variable}}` templates resolved via `chatflow/utils/variable_resolver.py` (dot notation supported).

### Context Flow Between Nodes
- `context["user_message"]` — the raw user input (never mutated).
- `context["variables"]` — every node's output keyed by id.
- `context["history"]` — chat history.
- `context["session_id"]`, `context["workspace_id"]`.

### Shared Bot Architecture (Discord, Slack)
ONE bot app per platform serves all customer workspaces, routed by guild_id/team_id.
- `DiscordGuildDeployment` maps guild_id → chatbot_id.
- `SlackWorkspaceDeployment` maps team_id → chatbot_id (created by `/webhooks/slack/install` flow).
- Both support chatflow routing via `get_entity_for_team()`.

### LLM Output Normalization
`services/inference_service.py` strips `<think>...</think>` chain-of-thought blocks before returning text. The same strip is duplicated in `services/secret_ai_sdk_provider.py:_strip_thinking` for the native-SDK path (avoids a circular import).

### Notifications
`models/notification.py` has nullable `workspace_id` — when set, the dashboard filters by active workspace plus rows with `workspace_id IS NULL` (invitations, legacy). Frontend chatflow detail link uses `/studio/{id}` (NOT `/chatflows/{id}` — that route doesn't exist).

## Node Types (17 total, 16 with config)

| Type | Config Keys | Service Called |
|------|------------|---------------|
| trigger | (none — no config component on the frontend either) | — |
| response | message, format, include_sources | — |
| condition | operator, variable, value | — |
| llm | prompt, model, temperature, max_tokens, system_prompt | inference_service |
| kb | kb_id, query, top_k, search_method, threshold | retrieval_service |
| memory | max_messages, format, include_system | session_service |
| http | method, url, headers, body, credential_id, timeout | requests |
| variable | operation, variable_name, value, transform, field | — |
| code | code, timeout | sandboxed exec |
| database | credential_id, query, parameters, operation | SQLAlchemy |
| loop | array, max_iterations, item_variable, index_variable | — |
| webhook | url, method, headers, payload, credential_id, retry_count, timeout, fire_and_forget | requests |
| email | credential_id, to, cc, bcc, subject, body, body_type, reply_to | smtplib / Gmail API |
| notification | channel, webhook_url, credential_id, message, title, urgency, mention | requests |
| handoff | method, credential_id, webhook_url, context_depth, handoff_message, priority, department | requests / smtplib |
| lead_capture | fields, store_internally, crm_webhook_url, crm_credential_id, duplicate_handling | lead_capture_service |
| calendly | credential_id, action, event_type_name, message_template | Calendly API |

Trigger has no `*Node.py` file — it's an in-registry executor in `chatflow_executor.py`.

## File Structure
```
src/app/
  api/v1/routes/
    auth.py, org.py, workspace.py, context.py, invitation.py
    kb.py, kb_draft.py, kb_pipeline.py
    chatbot.py, chatflows.py, public.py
    credentials.py, integrations.py, files.py
    leads.py, analytics.py, dashboard.py
    notifications.py, beta.py, admin.py
    discord_guilds.py, slack_workspaces.py
    content_enhancement.py, enhanced_search.py
    billing.py        # plan tiers + usage view + manual upgrade
    templates.py      # marketplace (chatflow templates)
    referrals.py      # per-user codes + invite tracking
    webhooks/         # telegram, discord, slack, whatsapp, zapier, calendly
  chatflow/
    nodes/            # 16 BaseNode subclasses (trigger lives in executor only)
    utils/            # variable_resolver, graph_builder
  models/             # SQLAlchemy + relationships
  services/
    chatflow_service.py     # orchestration
    chatflow_executor.py    # node registry + execution loop
    chatbot_service.py      # one-shot pipeline (no nodes)
    inference_service.py    # LLM calls (Secret AI / OpenAI-compatible)
    secret_ai_sdk_provider  # native Secret AI SDK path (toggle USE_SECRET_AI_SDK)
    retrieval_service.py    # RAG search (Qdrant + Postgres)
    session_service.py      # chat sessions
    qdrant_service.py       # vector store wrapper (auto-reconnect on closed-client)
    draft_service.py        # Redis drafts → DB deploy
    notification_service.py # in-app notifications
    lead_capture_service.py # lead persistence
    slug_service.py         # url slugs
    slack_workspace_service # Slack OAuth install URL builder
    billing_service.py      # plan limits + usage aggregation + upgrade
  integrations/
    calendly, crawl4ai_adapter, discord, google_adapter,
    jina_adapter, notion_adapter, slack, telegram,
    unstructured_adapter, whatsapp, zapier
  core/
    config.py, security.py, plans.py (PLAN_LIMITS dict)
```

## Multi-Tenancy

Most operational tables carry `workspace_id` and every read filters on it. Sessions are seeded with `UUID5({session_id}_{bot_id}_{workspace_id}_{platform})` for hard isolation.

Models WITHOUT `workspace_id` — and that's intentional, do not "fix" them:
- `User`, `AuthIdentity` — global identity (one user can be in many orgs).
- `Organization`, `OrganizationMember` — org-level (parent of workspaces).
- `Workspace` — has `organization_id`; itself is the workspace.
- `Document`, `Chunk` — workspace inherited via `kb_id → KnowledgeBase.workspace_id`.
- `KBNotification`, `KBAuditLog`, `KBAnalyticsEvent` — KB-scoped via `kb_id`.
- `Notification` — user-scoped, optional `workspace_id` for filtering.
- `ChatflowTemplate` — global by design (marketplace).
- `Referral` — relationship between two users (referrer + referred).

## OAuth Provider Map

| Provider | Backend handler | Frontend trigger |
|---|---|---|
| `notion` | `routes/credentials.py:480` (POST) | `Credentials.tsx` / `CredentialSelector.tsx` |
| `google` | `routes/credentials.py:497` (POST, Drive+Docs+Sheets readonly) | same |
| `google_gmail` | `routes/credentials.py:519` (POST, gmail.send + userinfo.email) | same |
| `calendly` | `routes/credentials.py:541` (POST) | same |
| `slack` | `routes/webhooks/slack.py:128` (GET install URL) | `Credentials.tsx` redirects directly to install URL — does NOT create a `Credential` row, creates `SlackWorkspaceDeployment` |

`SUPPORTED_OAUTH_PROVIDERS = {"notion", "google", "google_gmail", "calendly"}`. Slack is intentionally NOT in this set. The `google` provider is the only OAuth path for Drive — there is no `google_drive` provider.

### OAuth redirect-URI registration (operator prerequisite)
The redirect URI sent to every provider is `{API_BASE_URL}/credentials/oauth/callback` (e.g. `http://localhost:8000/api/v1/credentials/oauth/callback` in dev). It MUST be registered byte-for-byte in each provider's developer console — providers reject unregistered URIs with `redirect_uri_mismatch` / "Missing or invalid redirect_uri". If `redirect_uri_mismatch` shows up, this is the first thing to check.

- **Google** — Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID → "Authorized redirect URIs". One entry covers `google` and `google_gmail`.
- **Notion** — Notion integration settings → Authorization tab → Redirect URIs.
- **Calendly** — Calendly developer console → your OAuth app → redirect URLs.
- **Slack** — different flow: register `{API_BASE_URL}/webhooks/slack/oauth/callback` in your Slack app's "Redirect URLs" list.

For production, add the prod-host equivalent in addition to the dev URI in every console.

## Running
```bash
docker compose -f docker-compose.dev.yml up -d
docker exec privexbot-backend-dev bash -c "cd /app/src && python -m alembic upgrade head"
docker exec privexbot-backend-dev python scripts/set_initial_staff.py
docker exec privexbot-backend-dev python scripts/seed_chatflow_templates.py
```

### Migrations: always autogenerate

Never hand-write migrations. Edit the SQLAlchemy model first, then:
```bash
docker exec privexbot-backend-dev bash -c \
  "cd /app/src && python -m alembic revision --autogenerate -m 'msg'"
docker exec privexbot-backend-dev bash -c \
  "cd /app/src && python -m alembic upgrade head"
```

## Environment

See `.env.example`. Key vars:
- `SECRET_AI_API_KEY`, `SECRET_AI_BASE_URL`, `USE_SECRET_AI_SDK` — primary inference.
- `WIDGET_CDN_URL`, `API_BASE_URL`, `FRONTEND_URL` — used in embed code, OAuth redirect URIs, referral share links.
- `NOTION_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `CALENDLY_CLIENT_ID/SECRET`, `SLACK_CLIENT_ID/SECRET/SIGNING_SECRET` — OAuth providers.
- `ENCRYPTION_KEY` — Fernet key for credential storage.

## Plan Limits (Billing)
`core/plans.py` is the source of truth. Tiers: `free`, `starter`, `pro`, `enterprise`. Resources counted: `chatbots`, `chatflows`, `kb_documents`, `messages_per_month`, `api_calls_per_month`, `team_members` (`-1` = unlimited). The active tier lives on `Organization.subscription_tier`. `services/billing_service.py` aggregates live usage; `routes/billing.py` exposes the dashboard + admin upgrade. No Stripe in-tree yet — manual upgrade is staff-only.
