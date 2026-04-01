# Deep Research Round 2 — Bugs, Inconsistencies, and Remaining Work
> Conducted 2026-03-31. All findings verified from actual source code.

---

## Bugs Found and Fixed

### BUG 1: Missing `capture_lead()` method (CRITICAL - Runtime Crash)
**Files affected:** `slack_integration.py`, `calendly_integration.py`
**Problem:** Both call `lead_capture_service.capture_lead()` which didn't exist. Only platform-specific methods existed (`capture_from_widget`, `capture_from_discord`, etc.)
**Impact:** Slack and Calendly integrations would crash at runtime with `AttributeError`
**Fix:** Added generic `capture_lead(channel, ...)` method to `lead_capture_service.py`

### BUG 2: CalendlyNodeConfig wrong prop names (Frontend won't bind)
**File:** `frontend/src/components/chatflow/configs/CalendlyNodeConfig.tsx`
**Problem:** Used `value` and `onChange` props but `CredentialSelector` expects `selectedId` and `onSelect`
**Impact:** Calendly credential selector wouldn't bind — no credential could be selected
**Fix:** Changed to `selectedId` and `onSelect`

### BUG 3: Missing CredentialProvider types (TypeScript error)
**File:** `frontend/src/components/shared/CredentialSelector.tsx`
**Problem:** `CredentialProvider` type didn't include `google_gmail` or `calendly`
**Impact:** TypeScript compilation error when using these providers
**Fix:** Added `google_gmail` and `calendly` to the union type

### BUG 4: OAuth providers list incomplete
**File:** `frontend/src/components/shared/CredentialSelector.tsx`
**Problem:** `isOAuthProvider()` only included `google` and `notion` — missing gmail, calendly, slack
**Impact:** Gmail/Calendly/Slack credentials showed manual entry form instead of OAuth button
**Fix:** Added `google_gmail`, `calendly`, `slack` to the OAuth providers check

### BUG 5: EmailNodeConfig hardcoded to SMTP only
**File:** `frontend/src/components/chatflow/configs/EmailNodeConfig.tsx`
**Problem:** Hardcoded `provider="smtp"` with no way to select Gmail credentials
**Impact:** Backend supports Gmail sending but frontend has no way to configure it
**Fix:** Added SMTP/Gmail toggle that switches the CredentialSelector provider

### BUG 6: Zapier frontend missing entirely
**File:** `frontend/src/components/deployment/ZapierConfig.tsx` (didn't exist)
**Problem:** Backend Zapier is 100% implemented but NO frontend config UI exists. Users can't see or copy the webhook URL.
**Impact:** Zapier is listed in ChannelSelector but non-functional from dashboard
**Fix:** Created ZapierConfig.tsx that displays webhook URL, sample payload, and setup instructions

---

## Chatflow Node Wiring — Verified Correct

All 17 node executors verified against their node implementations:

| Executor | Node File | Import | Signature | Status |
|----------|-----------|--------|-----------|--------|
| TriggerNodeExecutor | (inline) | N/A | Correct | OK |
| LLMNodeExecutor | llm_node.py | Correct | Correct | OK |
| KBNodeExecutor | kb_node.py | Correct | Correct | OK |
| ConditionNodeExecutor | condition_node.py | Correct | Correct | OK |
| HTTPRequestNodeExecutor | http_node.py | Correct | Correct | OK |
| ResponseNodeExecutor | response_node.py | Correct | Correct | OK |
| VariableNodeExecutor | variable_node.py | Correct | Correct | OK |
| CodeNodeExecutor | code_node.py | Correct | Correct | OK |
| MemoryNodeExecutor | memory_node.py | Correct | Correct | OK |
| DatabaseNodeExecutor | database_node.py | Correct | Correct | OK |
| LoopNodeExecutor | loop_node.py | Correct | Correct | OK |
| WebhookNodeExecutor | webhook_node.py | Correct | Correct | OK |
| EmailNodeExecutor | email_node.py | Correct | Correct | OK |
| NotificationNodeExecutor | notification_node.py | Correct | Correct | OK |
| HandoffNodeExecutor | handoff_node.py | Correct | Correct | OK |
| LeadCaptureNodeExecutor | lead_capture_node.py | Correct | Correct | OK |
| CalendlyNodeExecutor | calendly_node.py | Correct | Correct | OK |

---

## LLM Node → Secret AI Wiring — Verified

**Execution chain:**
```
LLMNode.execute()
  → inference_service.generate_chat(messages=[...])
    → OpenAICompatibleProvider (default)
      → AsyncOpenAI(base_url=SECRET_AI_BASE_URL)
        → Secret AI endpoint (DeepSeek-R1-Distill-Llama-70B)
```

- Default provider: `InferenceProvider.SECRET_AI`
- Default model: `DeepSeek-R1-Distill-Llama-70B`
- Fallback: None (correct for SecretVM production)
- Native SDK alternative: `secret_ai_sdk_provider.py` (used if `USE_SECRET_AI_SDK=True`)
- Both chatbots and chatflows use the same `inference_service`
- Token tracking works through the full chain

---

## Zapier Assessment

### What Zapier DOES (backend — 100% real):
- Webhook endpoint: `POST /webhooks/zapier/{bot_id}`
- Accepts `{"message": "...", "session_id": "...", "metadata": {...}}`
- Routes to chatbot_service or chatflow_service
- Returns `{"response": "...", "session_id": "...", "success": true, "sources": [...]}`
- Works with both chatbots AND chatflows

### What Zapier DOESN'T need:
- No dedicated "Zapier Node" in chatflows — that would be over-engineering
- Zapier works via webhook (inbound trigger → chatbot → response)
- For outbound (chatbot → Zapier), users can use the existing **WebhookNode** in chatflows

### Minimal Zapier user flow:
1. Deploy chatbot
2. Go to Zapier deployment config → copy webhook URL
3. In Zapier: create Zap with "Webhooks by Zapier" action
4. Paste URL, set payload to `{"message": "{{trigger_data}}"}`
5. Done — Zapier triggers send messages to chatbot, get AI responses

### Do we need Zapier?
**YES** — it's in the MOU (Milestone 5) and it's already fully implemented in the backend. The only gap was the frontend config UI which is now created.

---

## Remaining TODOs in Codebase

### Low Priority (not blocking MOU):

| File | Line | TODO | Severity |
|------|------|------|----------|
| `content_strategy_service.py` | 180 | Language detection (hardcoded to "en") | LOW |
| `integration_service.py` | 556 | Celery periodic task scheduling | LOW |
| `kb.py` | 379,473,675,910,1053,1221 | Workspace membership checks (6 instances) | MEDIUM — but dependencies already validate |
| `kb_pipeline.py` | 124 | Workspace membership check | MEDIUM |
| `kb_draft.py` | 309 | Workspace membership RBAC check | MEDIUM |
| `auth.py` | 399 | Password reset email sending | HIGH — auth flow |
| `leads.py` | 298 | Chatflow name lookup in leads | LOW — fixed in analytics already |
| `knowledge-base.ts` | 87,96 | Replace `any` with proper types | LOW |
| `useAutoSave.ts` | 49 | Show toast notification | LOW |

### Already Fixed:
- `aggregated_analytics_service.py:538` — chatflow name lookup (FIXED)
- `dashboard_service.py:162` — chatflow session count (FIXED)

---

## Frontend Integration Status (Final)

| Component | Backend | Frontend Config | Frontend API | Status |
|-----------|---------|----------------|-------------|--------|
| Website embed | OK | WebsiteConfig.tsx | N/A (static) | COMPLETE |
| Telegram | OK | TelegramConfig.tsx | chatbot.ts | COMPLETE |
| Discord | OK | DiscordConfig.tsx | discord.ts | COMPLETE |
| Slack | OK | SlackConfig.tsx | slack.ts | COMPLETE |
| WhatsApp | OK | WhatsAppConfig.tsx | chatbot.ts | COMPLETE |
| Zapier | OK | ZapierConfig.tsx | N/A (URL only) | COMPLETE |
| Gmail (email node) | OK | EmailNodeConfig.tsx | credentials OAuth | COMPLETE |
| Calendly (chatflow node) | OK | CalendlyNodeConfig.tsx | credentials OAuth | COMPLETE |

---

## What's Left for MOU Completion

### Code Complete:
- [x] Slack bot deployment (backend + frontend)
- [x] Gmail integration (backend + frontend)
- [x] Calendly integration (backend + frontend)
- [x] Zapier frontend config
- [x] All bugs fixed
- [x] All nodes wired correctly

### Infrastructure / Operations:
- [ ] Run Alembic migration for `slack_workspace_deployments` table
- [ ] Set environment variables: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET
- [ ] Set environment variables: CALENDLY_CLIENT_ID, CALENDLY_CLIENT_SECRET
- [ ] Create Slack App in Slack API dashboard, configure Event Subscriptions URL
- [ ] Create Calendly OAuth App in Calendly developer dashboard
- [ ] Deploy widget.js to CDN/Nginx
- [ ] Password reset email implementation (auth.py TODO)
- [ ] Beta user campaign (50 users for Milestone 5)
- [ ] Growth to 500 users for Milestone 6
