# Implementation Roadmap — MOU Completion
> Based on deep research findings from 2026-03-31
> All file references verified from actual source code

---

## Priority Order

| # | Feature | Priority | Est. Hours | MOU Reference |
|---|---------|----------|------------|---------------|
| 1 | Slack Bot Deployment | CRITICAL | ~12h | Appendix A + Milestone 5 |
| 2 | Gmail Integration | CRITICAL | ~6h | Appendix A + Milestone 5 |
| 3 | Calendly Integration | CRITICAL | ~8h | Appendix A + Milestone 5 |
| 4 | Cleanup & Consistency | LOW | ~2h | Code quality |

---

## Phase 1: Slack Bot Deployment

### Architecture: Shared Bot (same as Discord)
- One Slack app installed to many customer workspaces
- `team_id` routing (equivalent to Discord's `guild_id`)
- Config: SLACK_SHARED_BOT_TOKEN, SLACK_SHARED_APP_ID, SLACK_SHARED_SIGNING_SECRET

### Files to Create (5 backend + 2 frontend):

| # | File | Template | Purpose |
|---|------|----------|---------|
| 1 | `backend/src/app/models/slack_workspace_deployment.py` | `discord_guild_deployment.py` | DB model |
| 2 | `backend/src/app/services/slack_workspace_service.py` | `discord_guild_service.py` | Business logic |
| 3 | `backend/src/app/integrations/slack_integration.py` | `discord_integration.py` | API client |
| 4 | `backend/src/app/api/v1/routes/webhooks/slack.py` | `webhooks/discord.py` | Webhook handler |
| 5 | `backend/src/app/api/v1/routes/slack_workspaces.py` | `discord_guilds.py` | Management API |
| 6 | `frontend/src/api/slack.ts` | `discord.ts` | Frontend API |
| 7 | `frontend/src/components/deployment/SlackConfig.tsx` | `DiscordConfig.tsx` | Deployment UI |

### Files to Modify (5):

| File | Change |
|------|--------|
| `backend/src/app/core/config.py` | Add SLACK_SHARED_* vars |
| `backend/src/app/db/base.py` | Import SlackWorkspaceDeployment |
| `backend/src/app/models/workspace.py` | Add slack_workspace_deployments relationship |
| `backend/src/app/models/chatbot.py` | Add slack_workspace_deployments relationship |
| `backend/src/app/main.py` | Mount slack routers |
| `frontend/src/components/deployment/ChannelSelector.tsx` | Add Slack channel |

### Key Slack-Discord Differences:
- Signature: HMAC-SHA256 (not Ed25519)
- Events: Slack Events API with `url_verification` challenge (not Discord PING interaction)
- Responses: `chat.postMessage` API call (not interaction response)
- 3-second response deadline: must use BackgroundTasks
- Message limit: 3000 chars (not 2000 like Discord)

---

## Phase 2: Gmail Integration

### Architecture: Extend existing Google OAuth + google_adapter.py

### Files to Modify (4 backend + 2 frontend):

| File | Change |
|------|--------|
| `backend/src/app/api/v1/routes/credentials.py` | Add `google_gmail` provider in start_oauth + oauth_callback |
| `backend/src/app/integrations/google_adapter.py` | Add `send_gmail()` + `refresh_gmail_token()` methods |
| `backend/src/app/chatflow/nodes/email_node.py` | Add Gmail API path (branch on credential.provider) |
| `frontend/src/pages/Credentials.tsx` | Add `google_gmail` credential type |
| `frontend/src/components/chatflow/configs/EmailNodeConfig.tsx` | Add SMTP/Gmail toggle |

### No New Files Needed
Gmail extends existing infrastructure:
- Google OAuth already works (for Docs/Sheets) — just add `gmail.send` scope
- google_adapter.py already handles Google API calls — add Gmail methods
- email_node.py already sends email — add Gmail branch alongside SMTP

---

## Phase 3: Calendly Integration

### Architecture: New chatflow node + webhook handler

### Files to Create (3 backend + 2 frontend):

| # | File | Template | Purpose |
|---|------|----------|---------|
| 1 | `backend/src/app/integrations/calendly_integration.py` | `zapier_integration.py` | Calendly API client |
| 2 | `backend/src/app/api/v1/routes/webhooks/calendly.py` | `webhooks/zapier.py` | Webhook handler |
| 3 | `backend/src/app/chatflow/nodes/calendly_node.py` | `email_node.py` | Chatflow node |
| 4 | `frontend/src/components/chatflow/nodes/CalendlyNode.tsx` | `EmailNode.tsx` | Visual node |
| 5 | `frontend/src/components/chatflow/configs/CalendlyNodeConfig.tsx` | `EmailNodeConfig.tsx` | Config panel |

### Files to Modify (5):

| File | Change |
|------|--------|
| `backend/src/app/api/v1/routes/credentials.py` | Add `calendly` provider in OAuth flow |
| `backend/src/app/services/chatflow_executor.py` | Register CalendlyNodeExecutor |
| `backend/src/app/main.py` | Mount calendly webhook router |
| `frontend/src/components/chatflow/NodePalette.tsx` | Add Calendly to Integration category |
| `frontend/src/components/chatflow/NodeConfigPanel.tsx` | Add calendly case |
| `frontend/src/pages/Credentials.tsx` | Add calendly credential type |

---

## Phase 4: Cleanup

| Issue | File | Fix |
|-------|------|-----|
| LoopNodeConfig missing | `frontend/src/components/chatflow/configs/` | Create LoopNodeConfig.tsx |
| Stale TODO (chatflow name) | `backend/src/app/services/aggregated_analytics_service.py:538` | Add Chatflow model lookup |
| Stale TODO (chatflow sessions) | `backend/src/app/services/dashboard_service.py:162` | Add chatflow session count |

---

## Dependency Graph

```
Phase 1 (Slack):
  config.py → model → base.py + relationships → migration
    → service → integration → webhook route → management route → main.py mount
    → frontend API → SlackConfig → ChannelSelector

Phase 2 (Gmail):
  credentials.py OAuth → google_adapter.py methods → email_node.py branch
    → frontend Credentials → EmailNodeConfig

Phase 3 (Calendly):
  credentials.py OAuth → calendly_integration.py → webhook route → main.py mount
    → calendly_node.py → chatflow_executor.py registration
    → frontend CalendlyNode → NodePalette → NodeConfigPanel → Credentials
```

Phases 1, 2, 3 are independent — can run in parallel.

---

## Total Effort Summary

| Track | New Files | Modified Files | Est. Hours |
|-------|-----------|----------------|------------|
| Slack | 7 | 6 | ~12h |
| Gmail | 0 | 6 | ~6h |
| Calendly | 5 | 6 | ~8h |
| Cleanup | 1 | 2 | ~2h |
| **Total** | **13** | **~16** | **~28h** |
