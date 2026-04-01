# PrivexBot — MOU Gap Analysis
> Deep audit against SCRT Labs MOU (Appendix A + B). Conducted 2026-03-25.
> All findings are based on reading actual source files — no assumptions.

---

## 1. Project Overview (from MOU Appendix A)

PrivexBot is a no-code AI chatbot builder with three user flows:

1. **Import Data** — websites, PDFs, Google Docs, Notion pages, spreadsheets
2. **Customize Bot** — name, avatar, tone, simple chatbot or advanced chatflow, memory, logic
3. **Deploy** — websites (embed / custom domain), Telegram, Discord, **Slack**, internal links; automation via **Zapier**, **Gmail**, **Calendly**

---

## 2. Milestone Map (from MOU Appendix B)

| # | Milestone | Duration | Key Deliverable |
|---|---|---|---|
| 1 | Product Design (Figma) | Wk 1–4 | Full UI/UX for builder, dashboard, deployment |
| 2 | RAG Pipeline | Wk 5–8 | Ingestion, chunking, embeddings, indexing in SecretVM |
| 3 | AI Core + Backend APIs | Wk 9–13 | Chatbot logic, memory, bot actions; SecretVM + SecretAI |
| 4 | Frontend & Builder UI | Wk 14–16 | No-code builder + bot widget; SecretVM deployable |
| 5 | **Integrations & Bot Actions** | Wk 17–22 | **Zapier, Slack, Discord, Gmail, Calendly** + 50 beta users |
| 6 | KPI Tracking & Growth | Wk 23–26 | 500 users, 5K messages, 3+ live integrations |

**Current stage:** Milestones 1–4 are complete. Milestone 5 is partially complete. Milestone 6 depends on 5.

---

## 3. What IS Implemented (Confirmed from Source)

### Architecture (all verified real, not stubs)

| System | Files | Status |
|---|---|---|
| FastAPI app + 24 routers | `src/app/main.py:153–326` | ✅ Complete |
| Multi-tenancy (Org → Workspace → Resources) | `src/app/models/organization.py`, `workspace.py`, `workspace_member.py` | ✅ Complete |
| Auth (Email, MetaMask, Phantom, Keplr) | `src/app/auth/strategies/` | ✅ Complete |
| Draft-first pattern (Redis → PostgreSQL) | `src/app/services/draft_service.py` | ✅ Complete |

### RAG Pipeline (Milestone 2)

| Component | Files | Status |
|---|---|---|
| Document processing (PDF, URL, text) | `src/app/tasks/document_processing_tasks.py` | ✅ Complete |
| Chunking (heading, size, sentence) | `src/app/services/chunking_service.py`, `enhanced_chunking_service.py` | ✅ Complete |
| Embeddings (multi-model) | `src/app/services/embedding_service_local.py` | ✅ Complete |
| Vector storage | `src/app/services/qdrant_service.py`, `indexing_service.py` | ✅ Complete |
| OCR for PDFs/images | `src/app/services/ocr_service.py` | ✅ Complete |
| Web crawling | `src/app/integrations/crawl4ai_adapter.py`, `jina_adapter.py` | ✅ Complete |
| Notion import | `src/app/integrations/notion_adapter.py` | ✅ Complete — full block-to-markdown |
| Google Docs/Sheets/Drive | `src/app/integrations/google_adapter.py` | ✅ Complete — OAuth2 + API calls |

### AI Core (Milestone 3)

| Component | Files | Status |
|---|---|---|
| SecretAI SDK (native) | `src/app/services/secret_ai_sdk_provider.py:1–245` | ✅ Complete — real SDK integration |
| SecretAI OpenAI-compat | `src/app/services/inference_service.py` | ✅ Complete — DeepSeek-R1-Distill-Llama-70B |
| 16 chatflow node types | `src/app/chatflow/nodes/` | ✅ All complete (see below) |
| Chatflow executor registry | `src/app/services/chatflow_executor.py:462–485` | ✅ 16 executors registered |
| Chatbot service (RAG + session) | `src/app/services/chatbot_service.py` | ✅ Complete |

**All 16 node types confirmed real (not stubs):**

| Node | File | Key Capability |
|---|---|---|
| `trigger` | `base_node.py` reference | Entry point |
| `llm` | `llm_node.py` | AI generation with prompt + history |
| `kb` | `kb_node.py` | Semantic search + config priority |
| `condition` | `condition_node.py` | Boolean branching (contains/equals/gt/lt/regex) |
| `memory` | `memory_node.py` | Session history store/retrieve |
| `response` | `response_node.py` | Final output formatting |
| `http_request` | `http_node.py` | External API calls + credentials |
| `database` | `database_node.py` | Parameterized SQL queries |
| `code` | `code_node.py` | Custom Python execution |
| `loop` | `loop_node.py` | Array iteration |
| `variable` | `variable_node.py` | Variable assignment/transform |
| `webhook` | `webhook_node.py` | Outbound HTTP webhooks, retry logic |
| `email` | `email_node.py` | SMTP email send (SSL + STARTTLS) |
| `notification` | `notification_node.py` | Slack/Discord/Teams outbound alerts |
| `handoff` | `handoff_node.py` | Human escalation (webhook/email/Slack) |
| `lead_capture` | `lead_capture_node.py` | Field validation + DB storage + CRM push |

### Integrations (Milestone 5 — Partial)

| Integration | Files | Status |
|---|---|---|
| Discord bot deployment | `src/app/integrations/discord_integration.py:1–447` | ✅ Complete — invite URL, signature verify, lead capture |
| Discord guild management | `src/app/api/v1/routes/discord_guilds.py` | ✅ Complete — shared bot architecture |
| Discord webhook handler | `src/app/api/v1/routes/webhooks/discord.py` | ✅ Complete |
| Telegram bot deployment | `src/app/integrations/telegram_integration.py:1–447` | ✅ Complete — rate limiting, lead capture |
| Telegram webhook handler | `src/app/api/v1/routes/webhooks/telegram.py` | ✅ Complete |
| WhatsApp Cloud API | `src/app/integrations/whatsapp_integration.py:1–424` | ✅ Complete — templates, phone capture |
| WhatsApp webhook handler | `src/app/api/v1/routes/webhooks/whatsapp.py` | ✅ Complete |
| Zapier inbound/outbound | `src/app/integrations/zapier_integration.py:1–234` | ✅ Complete |
| Zapier webhook handler | `src/app/api/v1/routes/webhooks/zapier.py:1–179` | ✅ Complete |

### Analytics & KPI Infrastructure (Milestone 6 prep)

| Component | Files | Status |
|---|---|---|
| Dashboard aggregation | `src/app/api/v1/routes/dashboard.py`, `src/app/services/dashboard_service.py` | ✅ Complete |
| Analytics (7–90 day, token cost) | `src/app/api/v1/routes/analytics.py` | ✅ Complete |
| Beta user system | `src/app/api/v1/routes/beta.py` | ✅ Complete — real invite codes |

---

## 4. What is MISSING (Gap Analysis for Milestone 5)

### GAP 1 — Slack Bot Deployment ❌ CRITICAL

**MOU Reference:**
- Appendix A: *"Deploy instantly on: Telegram, Discord, or **slack**"*
- Milestone 5: *"Zapier, **Slack**, Discord, Gmail, Calendly integrations"*

**Evidence of absence:**
- `grep -r "slack" src/app/integrations/` → returns only `notification_node.py` (outbound-only)
- No `slack_integration.py` file exists
- No `src/app/api/v1/routes/webhooks/slack.py` exists
- No `src/app/api/v1/routes/slack_apps.py` or similar exists
- `src/app/main.py:13` — imports list: no Slack webhook imported

**What exists (partial):**
- `src/app/chatflow/nodes/notification_node.py:159–177` — outbound Slack webhook for team alerts only
- This is for posting internal notifications **to** Slack, NOT for deploying a chatbot **on** Slack

**What is missing:**
1. `src/app/integrations/slack_integration.py` — Slack Events API handler, `chat.postMessage`, bot token management
2. `src/app/api/v1/routes/webhooks/slack.py` — inbound event receiver (`/webhooks/slack/{bot_id}`)
3. `src/app/api/v1/routes/slack_apps.py` — workspace connection management (equivalent of `discord_guilds.py`)
4. Slack OAuth 2.0 App installation flow (Bot Token Scopes)
5. `src/app/main.py` — mount new slack routers

**Reference pattern:** See `discord_integration.py` + `webhooks/discord.py` + `discord_guilds.py` — Slack follows identical architecture

---

### GAP 2 — Gmail Integration ❌ CRITICAL

**MOU Reference:**
- Appendix A: *"AI actions can also be linked with Zapier, **Gmail**, Calendly"*
- Milestone 5: *"Zapier, Slack, Discord, **Gmail**, Calendly integrations"*

**Evidence of absence:**
- `grep -r "gmail\|gmail_api\|google.*oauth.*gmail" src/` → returns zero results
- No Gmail OAuth flow anywhere in routes
- No `gmail_api` credential type in credential system

**What exists (partial):**
- `src/app/services/email_service.py:1–634` — SMTP-based transactional emails (invites, password reset)
- `src/app/services/email_service_enhanced.py:1–573` — SMTP with retry + port fallback (587→465→25→2525)
- `src/app/chatflow/nodes/email_node.py:1–185` — SMTP-only email node in chatflows
- `src/app/integrations/google_adapter.py:1–401` — Google Drive/Docs OAuth2, but NO Gmail API

**What is missing:**
1. `send_gmail()` method in `src/app/integrations/google_adapter.py` — using Gmail API v1 (`users.messages.send`)
2. Gmail OAuth2 credential type — `google_oauth_gmail` with `access_token`, `refresh_token`, `client_id`, `client_secret`, `from_email`
3. Gmail API path in `src/app/chatflow/nodes/email_node.py` — detect `credential_type == "google_oauth_gmail"` and route to Gmail API instead of SMTP
4. Token auto-refresh for Gmail credentials (reuse pattern from `google_adapter.py`)

**Scope clarification:**
The MOU "Gmail integration" means chatflows can send emails via a user's connected Gmail account using OAuth (not just SMTP username/password). This is the standard "Connect your Gmail" integration seen in tools like Zapier, Typeform, etc.

---

### GAP 3 — Calendly Integration ❌ CRITICAL

**MOU Reference:**
- Appendix A: *"AI actions can also be linked with Zapier, Gmail, **Calendly**"*
- Milestone 5: *"Zapier, Slack, Discord, Gmail, **Calendly** integrations"*

**Evidence of absence:**
- `grep -r "calendly" src/` → returns ZERO results
- No `calendly_integration.py` exists anywhere
- No Calendly node in `src/app/chatflow/nodes/`
- No Calendly webhook handler
- No Calendly credential type
- Not even a TODO comment

**What is missing (complete new implementation):**
1. `src/app/integrations/calendly_integration.py` — OAuth2 client, event type listing, booking link generation, webhook subscription
2. `src/app/chatflow/nodes/calendly_node.py` — chatflow node that fetches event type link and returns it to the user
3. `src/app/api/v1/routes/webhooks/calendly.py` — receives `invitee.created` / `invitee.canceled` events from Calendly
4. Register `CalendlyNodeExecutor` in `src/app/services/chatflow_executor.py:462`
5. Mount Calendly webhook router in `src/app/main.py`

**Scope clarification:**
The MOU "Calendly integration" means:
- Chatbot can share a Calendly booking link (e.g., "Book a demo: [link]") during a conversation
- Chatbot can trigger follow-up actions when someone books/cancels via Calendly webhooks

---

### GAP 4 — Widget Embed Script ⚠️ MINOR

**MOU Reference:**
- Appendix A: *"Deploy instantly on: Websites (embed code or custom domain)"*
- Milestone 4: *"bot widget"*

**Evidence (partial):**
- `src/app/api/v1/routes/public.py` — `WidgetConfigResponse` model (line ~103) and CORS is fully configured (`main.py:16–78`)
- `PublicAPICORSMiddleware` in `main.py:16–78` — allows `*` origins for `/api/v1/public/*` (widget embeds work)
- `src/app/api/v1/routes/public.py` — `HostedPageConfigResponse` (line ~120) with `custom_domain` field

**What may be missing:**
- A `/public/widget.js?bot_id=xxx` static endpoint that businesses paste into their site `<script>` tag
- **Note:** The widget JS may live entirely in the frontend (not backend). Needs frontend verification before building anything backend-side.

---

## 5. Summary Table

| Feature | MOU Location | Backend Status | Priority |
|---|---|---|---|
| Data ingestion (PDF, URL, Notion, Google Docs) | Appendix A | ✅ Complete | — |
| Simple chatbot builder | Appendix A | ✅ Complete | — |
| Advanced chatflow (drag-and-drop) | Appendix A | ✅ Complete | — |
| Memory, conditions, workflows | Appendix A | ✅ Complete | — |
| Website embed (public API + CORS) | Appendix A | ✅ Complete | — |
| Telegram deployment | Appendix A | ✅ Complete | — |
| Discord deployment | Appendix A, M5 | ✅ Complete | — |
| Zapier integration | Appendix A, M5 | ✅ Complete | — |
| SecretAI as AI engine | M3 | ✅ Complete | — |
| SecretVM deployable | M2, M3, M4 | ✅ Infrastructure ready | — |
| **Slack deployment** | Appendix A, M5 | ❌ Missing | 🔴 HIGH |
| **Gmail integration** | Appendix A, M5 | ❌ Missing (SMTP only) | 🔴 HIGH |
| **Calendly integration** | Appendix A, M5 | ❌ Missing entirely | 🔴 HIGH |
| Widget embed script | Appendix A, M4 | ⚠️ Partial (may be frontend) | 🟡 MEDIUM |
| 50 beta users | M5 | ⚠️ System built, need users | 🟡 GROWTH |
| 500 users, 5K messages | M6 | ⚠️ Tracking built, need traffic | 🟡 GROWTH |
| 3+ live integrations | M6 | ⚠️ Discord+Telegram done, need Slack/Gmail/Calendly | 🔴 BLOCKED |

---

## 6. Implementation Files Required

### Slack (3 new files, 2 modified)

| File | Action | Notes |
|---|---|---|
| `src/app/integrations/slack_integration.py` | CREATE | Follow `discord_integration.py` pattern |
| `src/app/api/v1/routes/webhooks/slack.py` | CREATE | Follow `webhooks/discord.py` pattern |
| `src/app/api/v1/routes/slack_apps.py` | CREATE | Follow `discord_guilds.py` pattern |
| `src/app/main.py:12–13` | MODIFY | Import and mount new routers |
| `src/app/services/credential_service.py` | MODIFY | Add `slack_bot` credential type |

### Gmail (0 new files, 3 modified)

| File | Action | Notes |
|---|---|---|
| `src/app/integrations/google_adapter.py:399` | MODIFY | Add `send_gmail()` method |
| `src/app/chatflow/nodes/email_node.py:67` | MODIFY | Add Gmail API path after credential lookup |
| `src/app/api/v1/routes/credentials.py` | MODIFY | Document `google_oauth_gmail` credential type |

### Calendly (3 new files, 3 modified)

| File | Action | Notes |
|---|---|---|
| `src/app/integrations/calendly_integration.py` | CREATE | OAuth2 + event types API + webhook sub |
| `src/app/chatflow/nodes/calendly_node.py` | CREATE | Follow `email_node.py` pattern (BaseNode subclass) |
| `src/app/api/v1/routes/webhooks/calendly.py` | CREATE | Follow `webhooks/zapier.py` pattern |
| `src/app/services/chatflow_executor.py:462–485` | MODIFY | Register `CalendlyNodeExecutor` |
| `src/app/chatflow/graph_builder.py` | MODIFY | Register "calendly" node type |
| `src/app/main.py:12–13` | MODIFY | Import and mount Calendly webhook router |

---

## 7. Detailed Docs Index

See the following files in this directory for complete implementation guides:

- [`01-slack-integration.md`](./01-slack-integration.md) — Full Slack bot deployment design
- [`02-gmail-integration.md`](./02-gmail-integration.md) — Gmail OAuth + API email sending design
- [`03-calendly-integration.md`](./03-calendly-integration.md) — Calendly booking link + webhook design
- [`04-widget-embed.md`](./04-widget-embed.md) — Widget embed endpoint design
