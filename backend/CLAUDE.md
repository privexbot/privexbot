# PrivexBot Backend

## Overview
FastAPI backend with PostgreSQL, Redis, Qdrant (vectors), Celery (async tasks). Privacy-first AI chatbot platform using Secret AI (TEE-based inference).

## Key Architecture Patterns

### Draft-First Deployment
All entities (chatbots, chatflows, KBs) follow: Redis Draft -> PostgreSQL Deploy.
- Drafts: 24hr TTL in Redis, auto-saved by frontend
- Deploy: `draft_service.deploy_draft()` creates DB records + API keys
- Edit: Creates new draft from deployed entity, re-deploys on finalize

### Chatflow Execution Pipeline
```
Message arrives -> public.py identifies bot_type ->
  chatflow_service.execute() -> _execute_graph() ->
  Find trigger node -> Loop: execute node -> store output -> get next ->
  Response node reached -> Save message -> Return
```

**Critical**: React Flow stores config at `node["data"]["config"]`, NOT `node["config"]`.
The executor reads via: `node.get("data", {}).get("config", node.get("config", {}))`.

### Node Execution
- `chatflow_executor.py`: Registry pattern maps type strings to executor classes
- Each executor creates a node instance and calls `execute(db, context, inputs)`
- `inputs` always includes `{"input": user_message}` (the raw user message)
- Node outputs stored in `context["variables"][node_id]` AND `context["variables"]["_last_output"]`
- `{{variable}}` templates resolved via `variable_resolver.py` (supports dot notation)

### Context Flow Between Nodes
- `context["user_message"]` -- Original user input (never changes)
- `context["variables"]` -- Dict of all node outputs keyed by node ID
- `context["variables"]["_last_output"]` -- Most recent node output
- `context["history"]` -- Chat history messages
- `context["session_id"]`, `context["workspace_id"]` -- Session identifiers

### Shared Bot Architecture (Discord, Slack)
ONE bot app serves many customer workspaces, routed by guild_id/team_id.
- `DiscordGuildDeployment` maps guild_id to chatbot_id
- `SlackWorkspaceDeployment` maps team_id to chatbot_id
- Both support chatflow routing via `get_entity_for_team()`

## Node Types (17 total)

| Type | Config Keys | Service Called |
|------|------------|---------------|
| trigger | (none) | -- |
| response | message, format, include_sources | -- |
| condition | operator, variable, value | -- |
| llm | prompt, model, temperature, max_tokens, system_prompt | inference_service |
| kb | kb_id, query, top_k, search_method, threshold | retrieval_service |
| memory | max_messages, format, include_system | session_service |
| http | method, url, headers, body, credential_id, timeout | requests |
| variable | operation, variable_name, value, transform, field | -- |
| code | code, timeout | (sandboxed exec) |
| database | credential_id, query, parameters, operation | SQLAlchemy |
| loop | array, max_iterations, item_variable, index_variable | -- |
| webhook | url, method, headers, payload, credential_id, retry_count, timeout, fire_and_forget | requests |
| email | credential_id, to, cc, bcc, subject, body, body_type, reply_to | smtplib/Gmail API |
| notification | channel, webhook_url, credential_id, message, title, urgency, mention | requests |
| handoff | method, credential_id, webhook_url, context_depth, handoff_message, priority, department | requests/smtplib |
| lead_capture | fields, store_internally, crm_webhook_url, crm_credential_id, duplicate_handling | lead_service |
| calendly | credential_id, action, event_type_name, message_template | Calendly API |

## File Structure
```
src/app/
  api/v1/routes/          # API endpoints
    public.py             # Widget/chat endpoints (chatbot + chatflow)
    chatflows.py          # Chatflow CRUD + draft management
    chatbot.py            # Chatbot CRUD
    webhooks/             # Telegram, Discord, Slack, WhatsApp, Zapier, Calendly
  chatflow/
    nodes/                # 17 node implementations (BaseNode subclasses)
    utils/                # variable_resolver.py, graph_builder.py
  models/                 # SQLAlchemy models
  services/               # Business logic
    chatflow_service.py   # Chatflow orchestration
    chatflow_executor.py  # Node registry + execution
    chatbot_service.py    # Chatbot message processing
    inference_service.py  # LLM calls (Secret AI)
    retrieval_service.py  # RAG search (Qdrant + PostgreSQL)
    session_service.py    # Chat session management
  integrations/           # External platform clients
  core/                   # Config, security, middleware
```

## Multi-Tenancy
Every model has `workspace_id` FK. All queries filter by workspace. Sessions use UUID5 seeded with `{session_id}_{bot_id}_{workspace_id}_{platform}` for isolation.

## Running
```bash
docker compose -f docker-compose.dev.yml up -d          # Start all services
docker exec privexbot-backend-dev python -m alembic upgrade head  # Apply migrations
docker exec privexbot-backend-dev python scripts/set_initial_staff.py  # Set staff users
```

## Environment
See `.env.example` for all required variables. Key ones:
- `SECRET_AI_API_KEY` / `SECRET_AI_BASE_URL` -- Primary inference
- `SLACK_CLIENT_ID/SECRET/SIGNING_SECRET` -- Slack integration
- `CALENDLY_CLIENT_ID/SECRET` -- Calendly OAuth
- `ENCRYPTION_KEY` -- Fernet key for credential storage
