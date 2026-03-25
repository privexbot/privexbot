# Comprehensive Guide: Chatbot Creation and Multi-Channel Deployment

> **Audience**: Beginners to advanced users creating AI chatbots on the PrivexBot platform.
> **Scope**: Complete 5-step creation wizard, all configuration options with defaults and ranges, deployment channels, post-deployment management, optimization recipes, and troubleshooting.
> **Source files**: Every default, label, range, and UI element verified against the actual frontend pages (`/pages/chatbots/create.tsx`, `/pages/chatbots/detail.tsx`, `/pages/chatbots/edit.tsx`) and backend implementation.

---

## Table of Contents

1. [Before You Start](#part-1-before-you-start)
2. [Step 1 — Basic Info](#part-2-step-1--basic-info)
3. [Step 2 — Prompt & AI Configuration](#part-3-step-2--prompt--ai-configuration)
4. [Step 3 — Knowledge Bases](#part-4-step-3--knowledge-bases)
5. [Step 4 — Appearance & Behavior](#part-5-step-4--appearance--behavior)
6. [Step 5 — Deploy](#part-6-step-5--deploy)
7. [Deployment Channels Deep Dive](#part-7-deployment-channels-deep-dive)
8. [Post-Deployment Management](#part-8-post-deployment-management)
9. [Configuration Recipes for Optimal Results](#part-9-configuration-recipes-for-optimal-results)
10. [Troubleshooting](#part-10-troubleshooting)
11. [Quick Reference Tables](#part-11-quick-reference-tables)

---

## Part 1: Before You Start

### Prerequisites

| Requirement | Details |
|-------------|---------|
| Account | Active PrivexBot account with email or wallet authentication |
| Organization | At least one organization created |
| Workspace | At least one workspace within your organization |
| Knowledge Base (optional) | One or more KBs in "ready" status if you want RAG-powered responses |

### What Is a Chatbot?

A **chatbot** is a conversational AI agent that answers user questions using a combination of:

- **System prompt** — The personality, role, and instructions you define
- **Knowledge bases** — Your custom data (documents, websites, text) that the AI retrieves from at query time (RAG)
- **AI model** — Secret AI (DeepSeek-R1-Distill-Llama-70B) running in a Trusted Execution Environment for privacy

Chatbots can be deployed to **multiple channels**: your website (embeddable widget), a hosted public chat page (SecretVM), direct REST API, and — after initial deployment — Telegram and Discord. WhatsApp integration is coming soon.

### Key Terminology

| Term | Meaning |
|------|---------|
| **Draft** | A chatbot configuration stored in Redis (not yet in the database). Expires after 24 hours if not deployed. |
| **Deploy** | Saves the draft to PostgreSQL, generates an API key, and enables channels. |
| **RAG** | Retrieval-Augmented Generation — the AI searches your knowledge bases for relevant content before answering. |
| **Grounding Mode** | Controls how strictly the AI adheres to KB content (Strict, Guided, Flexible). |
| **Session** | A conversation thread. Each user gets a unique session per channel per chatbot. |
| **Variable** | A `{{placeholder}}` in the system prompt that gets replaced with collected user data. |
| **TEE** | Trusted Execution Environment — Secret AI processes data in encrypted memory that even the server operator cannot access. |
| **SecretVM** | The hosted public chat page for your chatbot, accessible via a unique URL. |

### How the Creation Flow Works

```
┌──────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌─────────┐
│  Step 1   │ → │   Step 2    │ → │   Step 3    │ → │   Step 4    │ → │ Step 5  │
│ Name &    │   │ AI          │   │ Connect     │   │ Widget      │   │ Launch  │
│ Greeting  │   │ Config      │   │ KBs         │   │ Styling     │   │ Chatbot │
└──────────┘   └────────────┘   └────────────┘   └────────────┘   └─────────┘
     ↓              ↓                ↓                ↓                 ↓
  Redis Draft   Auto-saved       Optional KB      Optional           Validates
  Created       to Redis         attachment       customization      → Saves to DB
                                                                     → Generates API key
```

**Draft-First Architecture**: Your chatbot starts as a Redis draft. Nothing touches the database until you click "Deploy" in Step 5. This means you can freely experiment, test with real AI responses, and abandon without any database cleanup.

---

## Part 2: Step 1 — Basic Info

This step creates your chatbot draft in Redis and captures the essential identity fields.

### Fields

| Field | Required | Constraints | Default | Description |
|-------|----------|-------------|---------|-------------|
| **Chatbot Name** | Yes | 3–100 characters | — | Display name shown in the dashboard and widget header. Example: "Customer Support Bot" |
| **Description** | No | Free text | — | Internal description for your team. Not shown to end users. |
| **Greeting Message** | No | Free text | "Hello! How can I help you today?" | First message shown when a conversation starts. Displayed in the widget when it opens. |

### Validation Rules

- **Name**: Must be between 3 and 100 characters. This is validated before you can proceed to Step 2.

### What Happens Behind the Scenes

1. Frontend calls `POST /api/v1/chatbots/drafts` with `name`, `description`, and `workspace_id`
2. Backend creates a Redis entry with key `draft:chatbot:{draft_id}`
3. Redis TTL is set to 24 hours (auto-extended on each save)
4. Initial draft data includes defaults for all configuration:

```json
{
  "name": "Your Chatbot Name",
  "description": null,
  "model": "secret-ai-v1",
  "temperature": 0.7,
  "max_tokens": 2000,
  "system_prompt": "You are a helpful assistant...",
  "knowledge_bases": [],
  "appearance": {},
  "memory": { "enabled": true, "max_messages": 20 },
  "deployment": { "channels": [] }
}
```

### Quick Path

If you just want a basic chatbot:
1. Enter a name (e.g., "My FAQ Bot")
2. Click "Next" — you can accept all defaults and deploy immediately from Step 5

---

## Part 3: Step 2 — Prompt & AI Configuration

This is the most important step for chatbot quality. It covers the system prompt, AI model settings, behavior features, custom instructions, restrictions, and variable collection.

### 3.1 System Prompt

The system prompt is the foundational instruction set sent to the AI model before every user message. It defines who the chatbot is, how it should behave, and what it should never do.

**Field Details**:

| Property | Value |
|----------|-------|
| Label | "System Prompt" |
| Required | Yes |
| Editor | Textarea (6 rows) with variable insertion via "/" menu |
| Variable insertion | Type "/" to open autocomplete for inserting `{{variable_name}}` placeholders |

**Default System Prompt** (from `chatbot-store.ts`):

```
You are a helpful assistant. Answer questions based on the provided knowledge base context.

Rules:
- If the knowledge base contains relevant information, use it to answer
- If you don't have specific information, say so honestly
- Be concise and helpful
- Do not make up information
```

#### Variable Insertion

While typing in the system prompt textarea, type "/" to open a variable insertion menu. This filters defined variables and lets you insert `{{variable_name}}` placeholders. Variables are defined in the Variable Collection section below (section 3.6).

**How variable substitution works in the backend** (`chatbot_service.py`):
- Pattern: `\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}`
- If a variable has a collected value → replaced with that value
- If undefined → replaced with `[variable_name]` (bracket notation, not empty string)
- Variables are substituted in: system prompt, instructions, restrictions, AND AI responses

#### System Prompt Best Practices

1. **Be specific about the role**: "You are a customer support specialist for Acme Corp" is better than "You are helpful"
2. **Define tone explicitly**: "Use a friendly, professional tone" or "Be casual and conversational"
3. **Set boundaries**: "If you don't know something, say so" and "Never discuss competitor products"
4. **Include formatting guidance**: "Use bullet points for step-by-step instructions"
5. **Reference the KB**: "Answer questions based on the knowledge base. If the information isn't in your knowledge base, say so honestly."

### 3.2 AI Model Configuration

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| **Model** | Fixed | `secret-ai-v1` | Secret AI (DeepSeek-R1-Distill-Llama-70B). Displayed as "Secret AI — Privacy-preserving via TEE". This is the only available model and is not selectable — all chatbots use Secret AI. |
| **Temperature** | 0.0 – 2.0 (step: 0.1) | 0.7 | Controls response randomness. The slider shows a real-time label: "More focused" (low), "Balanced" (mid), "More creative" (high). |
| **Max Tokens** | 100 – 8,000 | 2,000 | Maximum length of each AI response in tokens (~750 words at default). |

#### Temperature Guide

| Value | Behavior | Best For |
|-------|----------|----------|
| 0.0 – 0.3 | Very focused, deterministic | FAQ bots, factual Q&A, compliance |
| 0.4 – 0.6 | Balanced precision | Customer support, technical help |
| **0.7** (default) | Good balance | General-purpose chatbots |
| 0.8 – 1.0 | More creative, varied | Sales, engagement, conversational |
| 1.1 – 2.0 | Very creative, unpredictable | Creative writing, brainstorming (use with caution) |

#### Max Tokens Guide

| Value | Approximate Words | Best For |
|-------|--------------------|----------|
| 100–500 | 40–200 words | Quick FAQ answers, yes/no responses |
| 500–1,000 | 200–400 words | Standard support responses |
| **2,000** (default) | ~750 words | Detailed explanations |
| 4,000–8,000 | 1,500–3,000 words | Long-form content, technical documentation |

### 3.3 Behavior Features

These settings control how the chatbot interacts with users and uses knowledge base content. They appear in Step 2 of the wizard.

#### Citations & Attributions

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| **Enable Citations** | Toggle | `false` | When enabled, the AI cites its knowledge base sources in responses. Shows source attribution. |

#### Follow-up Questions

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| **Enable Follow-up Questions** | Toggle | `false` | AI suggests 1-2 related follow-up questions after each response. |

#### Grounding Mode — Critical Configuration

Grounding mode is **the most important behavior setting** when using knowledge bases. It determines what the AI does when it can't find an answer in your KB.

The wizard presents three radio button options:

| Mode | Label | Behavior | When KB Has Answer | When KB Has No Answer |
|------|-------|----------|--------------------|-----------------------|
| **Strict** | "Recommended" | AI ONLY answers from KB content | Uses KB content to answer. Speaks naturally as if knowledge is its own. | Says "I don't have specific information about that topic." Never uses training data. |
| **Guided** | — | KB-first, supplements with disclosure | Uses KB content as primary answer | Discloses: "I don't have specific KB info on that topic, but based on general knowledge..." |
| **Flexible** | — | KB-enhanced, freely uses general knowledge | Uses KB content as primary source | Uses general knowledge without disclosure. Won't contradict KB content. |

**Backend implementation** (`guardrails.py`):

Each grounding mode has a detailed prompt template injected into the system message:

- **Strict mode** includes rules for handling topic questions vs. conversation, meta-questions about sources, vague requests, and follow-up suggestions. It explicitly instructs the AI to never say "based on the provided context" and to speak naturally.
- **Guided mode** instructs the AI to always check KB first, supplement with disclosure, and always trust KB over general knowledge when they conflict.
- **Flexible mode** instructs the AI to check KB first, supplement freely without disclosure, and never contradict KB content.

**Smart conversation handling** (`chatbot_service.py`):
- **Affirmative fallback**: If the user says "yes please" and KB returns 0 results, the AI uses the previous response as context for continuation (only in Guided/Flexible modes)
- **Meta-question fallback**: If the user asks "how did you know that?", the AI references its previous response instead of saying "I don't have information"
- **Recently-provided-info check**: If the AI just gave a substantial answer (>100 chars) and the next query returns 0 KB results, it avoids contradicting itself

#### Conversation Starters

You can add up to **4 conversation starters** — suggested prompts shown as clickable chips in the widget when a user opens the chat.

- Type a starter in the input field and click the "+" button to add
- Existing starters are shown in a list with a delete button
- Example starters: "What services do you offer?", "How can I contact support?", "Tell me about pricing"

### 3.4 Instructions

Instructions are ordered behaviors the AI should follow. They are added and managed in Step 2.

**UI Controls**:
- **Add new**: Type an instruction in the input field, click "+" to add
- **Toggle**: Enable or disable individual instructions with a switch (without deleting)
- **Delete**: Remove an instruction with the trash icon

Example instructions:
1. "Always greet users warmly and ask how you can help"
2. "When answering technical questions, provide step-by-step instructions"
3. "At the end of each response, ask if the user needs anything else"

**How Instructions Work in the Backend** (`_build_messages()`):

The backend builds the system prompt by concatenating:
1. Base system prompt (with variable substitution)
2. Conversation summary (last 6 messages, placed BEFORE instructions to prevent repetition)
3. `INSTRUCTIONS:` section with numbered items (only enabled instructions)
4. `RESTRICTIONS - Do NOT do the following:` section with dashed items
5. `RESPONSE FORMAT:` section (citations, follow-ups)
6. Knowledge base context with grounding mode prompt

### 3.5 Restrictions

Restrictions are things the AI must never do. They are added and managed in Step 2 with the same UI pattern as instructions.

**UI Controls**:
- **Add new**: Type a restriction in the input field, click "+" to add
- **Toggle**: Enable or disable individual restrictions
- **Delete**: Remove a restriction with the trash icon

Example restrictions:
- "Never discuss competitor products or services"
- "Never share internal pricing or discount information"
- "Never make promises about delivery dates"

### 3.6 Variable Collection

Variables let you collect structured data from users and substitute it into the system prompt using `{{variable_name}}` syntax.

**Master Toggle**: Enable or disable the entire variable collection feature.

When enabled, you can define custom variables:

**Add Variable Form**:

| Field | Description |
|-------|-------------|
| **Variable Name** | Alphanumeric + underscores. Must start with a letter or underscore. Spaces are auto-replaced with underscores. Must be unique. |
| **Display Label** | Optional human-readable label (e.g., "What is your name?") |
| **Type** | Select: `text`, `email`, `phone`, `number` |

**Defined Variables Display**:
- Each variable shows: `{{variable_name}}` placeholder code, label, type
- **Insert** button: Adds the variable placeholder to the system prompt
- **Delete** button: Removes the variable definition

**Example**: If you define a variable named `user_name` and your system prompt contains `You are helping {{user_name}}`, the backend will replace it with the collected value or `[user_name]` if not yet collected.

### Step 2 Validation

- **System prompt**: Required (must not be empty)
- **Temperature**: Must be between 0.0 and 2.0
- **Max tokens**: Must be between 100 and 8,000

---

## Part 4: Step 3 — Knowledge Bases

This step connects your chatbot to one or more knowledge bases for RAG (Retrieval-Augmented Generation). This is **optional** — a chatbot without a KB will answer from its system prompt and general AI knowledge based on the grounding mode.

### 4.1 Knowledge Base Selector

The wizard shows two sections:

**Attached Knowledge Bases** — KBs already connected to this chatbot:
- Each shows: KB name, priority
- Toggle switch to enable/disable the KB
- Delete button to detach

**Available Knowledge Bases** — All other KBs in the workspace:
- Each shows: KB name, document count, chunk count
- "Add" button to attach
- If no KBs exist: "Create Knowledge Base" button links to `/knowledge-bases/create`

**RAG info banner**: A blue info box explains how RAG enhances your chatbot's responses.

### 4.2 How KB Attachment Works

When you click "Add" on a KB:

1. Frontend calls `POST /api/v1/chatbots/drafts/{draft_id}/kb` with:
   ```json
   {
     "kb_id": "uuid",
     "enabled": true,
     "priority": 1,
     "retrieval_override": null
   }
   ```
2. Backend verifies the KB exists in the same workspace
3. KB config is added to the draft's `knowledge_bases` array with the KB name cached for display

When you delete a KB:
1. Frontend calls `DELETE /api/v1/chatbots/drafts/{draft_id}/kb/{kb_id}`
2. Backend removes that KB from the draft's array

### 4.3 How RAG Works at Query Time

When a user sends a message to a deployed chatbot with KBs attached, the `chatbot_service.py` executes:

1. **For each enabled KB** (in priority order):
   - Calls `retrieval_service.search()` with the user's query
   - Uses the chatbot's override settings if set, otherwise the KB's own retrieval config
   - Collects results (chunks with content, scores, metadata)

2. **Combines results**:
   - All source chunks are concatenated into a `context` string
   - If multiple KBs contributed results, prepends: "The following information comes from your knowledge base:"
   - Sources are tracked for citation display

3. **Applies grounding mode** to the context (see Part 3.3)

4. **Validates sources** after AI response:
   - Checks for meaningful word overlap between each source and the response (minimum 3 non-stop-word matches)
   - Removes irrelevant sources that the AI didn't actually use
   - Clears all sources if the AI indicates it couldn't find information

> **Note**: Per-KB priority and retrieval overrides (top_k, score_threshold, strategy) are supported by the backend but are configured via the API or edit page after deployment, not in the creation wizard.

### Step 3 Validation

- **No validation required** — KB attachment is completely optional
- If KBs are attached, they must be in the same workspace as the chatbot

---

## Part 5: Step 4 — Appearance & Behavior

This step configures how the chatbot looks in the widget, how it handles conversation memory, and lead capture settings.

### 5.1 Widget Display Name

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| **Widget Display Name** | Text input | (chatbot name) | Title shown in the chat widget header. Can differ from the internal chatbot name. |

### 5.2 Avatar

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| **Avatar URL** | Text input (URL) | (none) | URL of the bot avatar image shown next to messages. A preview thumbnail is shown. Falls back to a Bot icon if the image fails to load. |

### 5.3 Colors

**Primary Color** — Controls the widget header, send button, and user message bubbles:

| Option | Description |
|--------|-------------|
| **6 Color Presets** | Blue (`#3b82f6`), Purple (`#8b5cf6`), Green (`#22c55e`), Orange (`#f97316`), Red (`#ef4444`), Gray (`#6b7280`) — clickable circles |
| **Custom Hex** | Text input for any hex color value |

The currently selected color shows a ring indicator. The default is Blue (`#3b82f6`).

**Secondary Color** — Accent elements, links, hover states:

| Setting | Type | Default |
|---------|------|---------|
| **Secondary Color** | Hex input | `#8b5cf6` (Purple) |

### 5.4 Font and Style

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| **Font Family** | Select dropdown | Inter (Recommended), System Default, Monospace | Inter |
| **Bubble Style** | Button group | Rounded, Square | Rounded |

### 5.5 Widget Position

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| **Position** | Button group | Bottom Right, Bottom Left | Bottom Right |

> **Note**: The widget embed code (`widget.js`) also supports `top-right` and `top-left` positions, but the creation wizard only offers the two bottom positions.

### 5.6 Memory Configuration

Controls whether the chatbot remembers previous messages in a conversation.

| Setting | Type | Range | Default | Description |
|---------|------|-------|---------|-------------|
| **Conversation Memory** | Toggle | on/off | Enabled | Whether to include conversation history in AI prompts |
| **Max Messages to Remember** | Slider | 5–50 (step: 5) | 20 | Maximum number of previous messages to include for context. Only shown when memory is enabled. |

**How memory works at query time**:
- If enabled, the backend loads the last `max_messages` messages from the session
- Messages are appended to the AI prompt as `user` and `assistant` role entries
- The most recent 6 messages are also summarized and placed BEFORE instructions to prevent the AI from repeating completed actions

**When to disable memory**:
- Stateless FAQ bots where each question is independent
- Privacy-sensitive applications where you don't want conversation persistence
- High-volume bots where you want to minimize token usage

### 5.7 Lead Capture Configuration

Lead capture collects user information during conversations.

**Master Toggle**: Enable or disable lead capture entirely (default: disabled).

When enabled, the following settings appear:

#### Timing

Two card-style buttons to choose when the lead form appears:

| Option | Description |
|--------|-------------|
| **Before Chat** | A lead form overlay appears first; the user must submit (or skip) before chatting begins. |
| **After Conversation Starts** | The form appears after the user has sent N messages. A slider (1–10) lets you set the number of messages before the prompt. |

#### Fields to Collect

Three dropdowns for the standard fields:

| Field | Visibility Options | Default |
|-------|-------------------|---------|
| **Email** | Required / Optional / Hidden | Required |
| **Name** | Required / Optional / Hidden | Optional |
| **Phone** | Required / Optional / Hidden | Hidden |

**Validation**: At least one field must be visible (not hidden).

#### Options

| Setting | Type | Description |
|---------|------|-------------|
| **Allow visitors to skip the form** | Checkbox | If checked, users can dismiss the lead form without filling it |
| **Require consent checkbox (GDPR compliance)** | Checkbox | If checked, a consent checkbox is shown before the form can be submitted |

#### Auto-Captured Information

The following data is captured automatically (no form needed): IP address, location, browser, referrer.

> **Note**: Custom fields (additional fields beyond email/name/phone) are available after deployment via the edit page.

#### Multi-Platform Lead Capture (Backend)

Lead capture works differently depending on the deployment channel:

| Platform | `before_chat` | `after_n_messages` |
|----------|---------------|---------------------|
| **Web Widget** | Form overlay before chat starts | Form shown after N messages |
| **Telegram** | N/A (no form UI) | Bot asks for email in conversation after N messages |
| **Discord** | N/A (no form UI) | Bot asks for email in DMs after N messages |

**Consent handling** (`chatbot_service.py`):
- If `privacy.require_consent` is enabled, the bot first asks for consent
- Consent responses are parsed from natural language ("yes", "yeah", "sure" → True; "no", "nope" → False)
- Consent state is stored atomically in session metadata using PostgreSQL JSONB merge

### Step 4 Validation

- No strict validation — all settings are optional
- Appearance and behavior use sensible defaults

---

## Part 6: Step 5 — Deploy

This is the final step. You select visibility and channels, test your chatbot, and launch it.

### 6.1 Visibility

Two button options:

| Option | Description |
|--------|-------------|
| **Public** | Anyone can access the chatbot (no API key required for public endpoints) |
| **Private** | Requires an API key for access |

Default: **Public**

### 6.2 Channel Selection

The deploy step presents **3 deployment channels** as toggleable cards:

| Channel | Icon | Description |
|---------|------|-------------|
| **Website** | Globe | Website widget — embed chatbot on your website via `<script>` tag |
| **API** | Settings | REST API access — programmatic access via HTTP |
| **SecretVM** | Link | Public chat URL — a hosted page accessible via a unique URL |

Each card has a toggle switch. At least one channel must be enabled to deploy.

> **Note**: Discord, Telegram, and WhatsApp channels are added **after deployment** from the chatbot detail page. The wizard notes: "Add Discord, Telegram, or WhatsApp channels after deployment."

### 6.3 Test Preview

Step 5 includes a **live test chat panel** (400px height) on the right side:

- **Header**: Shows the avatar, widget display name, and "Online" status, color-matched to your primary color
- **Messages area**: Scrollable conversation with rendered markdown
- **Greeting**: Displays your greeting message if set
- **Sources**: Shows KB citations if citations are enabled
- **Input**: Text field with Send button (color-matched)
- **Clear button**: Resets the test conversation

The test uses `POST /api/v1/chatbots/drafts/{draft_id}/test` with a preview session ID (`preview_{random}`) so test messages don't mix with production data.

### 6.4 Deployment Process

When you click "Deploy":

1. **Draft is saved** first (ensures all changes are persisted to Redis)
2. **Frontend** sends `POST /api/v1/chatbots/drafts/{draft_id}/deploy` with:
   ```json
   {
     "channels": [
       { "type": "website", "enabled": true, "config": {} },
       { "type": "api", "enabled": true, "config": {} }
     ],
     "is_public": true,
     "behavior": { ... },
     "conversation_openers": ["How can I help?", "Tell me about..."]
   }
   ```

3. **Backend validates** the draft configuration:
   - Name is present and valid
   - System prompt is not empty
   - All referenced KBs exist in the workspace

4. **Backend deploys**:
   - Creates `Chatbot` record in PostgreSQL
   - Generates a unique API key (shown only once)
   - Generates a URL-friendly slug from the name
   - Enables requested channels
   - Deletes the Redis draft
   - Clears draft from localStorage

### 6.5 Post-Deploy Screen

After successful deployment, the wizard shows:

1. **Success checkmark** with confirmation message
2. **API Key Card** (amber warning styling):
   - Shows the full API key
   - Copy button
   - Warning: "This key is only shown once. Store it securely."
3. **Embed Code Card**:
   - Shows the `<script>` embed code
   - Copy button
   - Used to add the widget to your website

**CRITICAL**: The API key is shown **only once**. Save it immediately. If you lose it, you can regenerate it from the chatbot's Embed tab, but the old key will be permanently revoked.

### Step 5 Validation

- At least one deployment channel must be enabled
- Backend validates draft completeness before deployment

---

## Part 7: Deployment Channels Deep Dive

### 7.1 Website Widget

**Available**: At creation (Step 5) | **Setup complexity**: None

The website widget is a lightweight JavaScript snippet (~50KB) that adds a floating chat bubble to your website.

#### Embed Code

The embed code is shown after deployment on the post-deploy screen and in the Embed tab of the detail page:

```html
<!-- PrivexBot Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'pb', '{WIDGET_CDN_URL}/widget.js'));
  pb('init', '{CHATBOT_ID}', {
    baseURL: '{API_BASE_URL}',
    position: 'bottom-right',
    color: '#3b82f6',
    greeting: 'Hi! How can I help you today?'
  });
</script>
```

Place this code just before the closing `</body>` tag on your website.

#### Installation Tips
- Widget loads **asynchronously** — it won't slow down your website
- Works with **all modern browsers**
- **Mobile responsive** by default (full-screen on mobile <768px)
- The widget script is served from a CDN for fast loading

### 7.2 SecretVM (Hosted Public Chat Page)

**Available**: At creation (Step 5) | **Setup complexity**: None

Each chatbot gets a hosted page accessible at a unique URL:

```
{your-domain}/chat/{workspace_slug}/{chatbot_slug}
```

#### Features
- No embed code needed — just share the URL
- QR code download available from the detail page
- Slug management: Both workspace and chatbot slugs are editable
- Old URLs automatically redirect when slugs change

#### Configuration (via Detail Page → Hosted Page Tab)

| Setting | Description |
|---------|-------------|
| **Workspace Slug** | Editable. Changes affect all chatbots in the workspace. Old URLs redirect. |
| **Chatbot Slug** | Editable. Lowercase letters, numbers, and hyphens. Old URLs redirect. |
| **QR Code** | Downloadable PNG image of the chat URL |
| **Edit Appearance** | Links to the edit page to customize branding |

#### Backend Hosted Page Config

The backend supports additional hosted page settings via `PATCH /api/v1/chatbots/{id}/hosted-page`:

| Setting | Description |
|---------|-------------|
| **Logo URL** | Custom logo for the hosted page |
| **Header Text** | Custom header text |
| **Footer Text** | Custom footer text |
| **Background Color** | Page background color |
| **Meta Title** | SEO title tag |
| **Meta Description** | SEO description tag |

### 7.3 REST API

**Available**: At creation (Step 5) | **Setup complexity**: None

Every deployed chatbot is accessible via REST API.

**Endpoint**: `POST /api/v1/public/bots/{bot_id}/chat`

**Request**:
```json
{
  "message": "Hello, how can I get a refund?",
  "session_id": "user-123-session",
  "metadata": { "user_agent": "custom-app" },
  "variables": { "user_name": "John" }
}
```

**Response**:
```json
{
  "response": "I'd be happy to help you with a refund...",
  "sources": [
    { "content": "...", "score": 0.92, "metadata": {} }
  ],
  "session_id": "user-123-session",
  "message_id": "uuid"
}
```

**Authentication**: If `is_public` is `false`, include your API key in the `Authorization` header:
```
Authorization: Bearer pk_live_abc123...
```

**Slug-based access**: You can also use `POST /api/v1/public/chat/{workspace_slug}/{bot_slug}` for slug-based access instead of UUID-based.

### 7.4 Telegram

**Available**: After deployment (via Detail Page → Deployment Tab) | **Setup complexity**: Medium

#### Prerequisites

1. A Telegram account
2. A bot created via [@BotFather](https://t.me/BotFather) on Telegram

#### Step-by-Step Setup

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts:
   - Choose a display name for your bot
   - Choose a username (must end in `bot`, e.g., `mycompany_support_bot`)
3. Copy the bot token (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
4. In PrivexBot, go to your chatbot's **Detail Page → Deployment Tab**
5. Click **"Connect Bot"** under Telegram
6. Paste the bot token
7. The system registers a webhook and shows "Connected" with the bot username

#### Backend Webhook Registration

When Telegram is connected, the backend:
1. Calls Telegram API to register a webhook URL: `{API_BASE_URL}/webhooks/telegram/{chatbot_id}`
2. Stores the webhook secret for verification
3. Updates `deployment_config.telegram` with status, webhook URL, bot username, and credential ID

**Important**: Telegram requires a **public HTTPS URL** for webhooks. Localhost URLs will not work. If deploying locally, use a tunneling service like ngrok.

#### Backend Features (Fully Implemented)

The Telegram webhook handler (`webhooks/telegram.py`, 379 lines) supports:
- Full message parsing (user ID, chat ID, message text)
- Allowlist/blocklist filtering for chats
- Webhook secret token verification
- Routes to both chatbot and chatflow services
- Credential-based bot token management (encrypted storage)
- Helper endpoints: get webhook info, set webhook, delete webhook

### 7.5 Discord

**Available**: After deployment (via Detail Page → Deployment Tab) | **Setup complexity**: Medium

#### Prerequisites

1. A Discord account
2. A Discord application created in the [Discord Developer Portal](https://discord.com/developers/applications)

#### Step-by-Step Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it
3. Go to the "Bot" tab and click "Add Bot"
4. Copy the bot token
5. In PrivexBot, go to your chatbot's **Detail Page → Deployment Tab**
6. Click **"Connect to Discord servers"**
7. Configure guild/channel settings

#### Multi-Guild Support

The detail page shows connected Discord guilds with:
- Guild name and channel count
- Per-guild "Configure Channels" button
- Per-guild "Remove Server" button
- Status badge (Active/Paused) per guild

#### Shared Bot Architecture

PrivexBot uses a **shared Discord bot** architecture: One bot token can serve multiple customers. The routing works via `guild_id → chatbot_id` mapping. Each Discord server (guild) is associated with a specific chatbot through the `DiscordGuildDeployment` model.

#### Bot Invite URL

The generated invite URL includes the required permissions:
```
https://discord.com/api/oauth2/authorize?client_id={CLIENT_ID}&permissions=2147483648&scope=bot%20applications.commands
```

**Required permissions**:
- Read Messages
- Send Messages
- Embed Links
- Read Message History

#### Backend Features (Fully Implemented)

The Discord webhook handler (`webhooks/discord.py`, 689 lines) supports:
- Shared bot endpoint: `POST /webhooks/discord/shared`
- Per-bot endpoint: `POST /webhooks/discord/{bot_id}`
- ED25519 signature verification
- Slash commands: `/ask`, `/chat`
- Button and message component support
- Guild/channel allowlist/blocklist filtering
- Command registration endpoints

### 7.6 WhatsApp Business — Coming Soon

WhatsApp Business integration is **not yet available**. The Deployment tab shows a disabled "Coming Soon" button for WhatsApp.

Backend webhook handler code exists but the routes are not yet registered in the application. This feature is planned for a future release.

---

## Part 8: Post-Deployment Management

### 8.1 Chatbot Detail Page

After deployment, navigate to your chatbot to access the detail page with **7 tabs**:

| Tab | Description |
|-----|-------------|
| **Overview** | AI configuration summary, attached knowledge bases, system prompt |
| **Test** | Interactive chat interface for testing the deployed chatbot |
| **Embed** | API key management and embed code for websites |
| **Deployment** | Channel management — add/remove Discord guilds, Telegram, view WhatsApp status |
| **Hosted Page** | SecretVM URL configuration, slug management, QR code download |
| **Settings** | Read-only display of all configuration with "Edit Configuration" link |
| **Analytics** | Usage metrics, response quality, feedback, event breakdown |

### 8.2 Chatbot Lifecycle

| Status | Description | Transitions |
|--------|-------------|-------------|
| **draft** | In Redis, being configured | → active (deploy) |
| **active** | Deployed and operational, receiving messages | → paused (pause) |
| **paused** | Temporarily disabled, not responding | → active (resume) |
| **archived** | Soft deleted, hidden from views | → paused (restore) |

**From the chatbots list page**, you can:
- View, Test, and see Stats for each chatbot
- Edit Settings, get Embed Code, Archive/Restore, Delete Permanently via dropdown menu
- Search and filter by status
- Toggle between grid and list views

### 8.3 Editing a Deployed Chatbot

The **Edit Page** (`/chatbots/{id}/edit`) has 6 tabs:

| Tab | Fields |
|-----|--------|
| **Basic** | Name, description, system prompt |
| **AI** | Model selection, temperature, max tokens, memory settings |
| **Knowledge Bases** | Attach/detach KBs with priority management |
| **Messages** | Greeting message |
| **Appearance** | Primary/secondary colors, position, chat title, avatar URL, font, bubble style |
| **Leads** | Full lead capture config with per-platform settings (web, Telegram, Discord) and custom fields |

Changes take effect immediately — the next user message will use the updated configuration.

### 8.4 Analytics (Detail Page → Analytics Tab)

The analytics tab provides:

**Period Selector**: 7, 14, 30, or 90 days with manual refresh button

**Metrics Grid** (4 cards):
- Widget Loads
- Widget Opens
- Conversations (total count)
- Engagement Rate (percentage)

**Response Quality Card**:
- Total, Successful, and Failed responses
- Success Rate and Error Rate

**User Feedback Card**:
- Thumbs Up / Thumbs Down counts
- Satisfaction Rate
- Recent comments (up to 3)

**Event Breakdown Card**:
- Dynamic list of tracked events with counts

**Empty state**: "Analytics will appear once your chatbot starts receiving traffic"

**Backend API**:

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/chatbots/{id}/analytics?days=7` | General analytics with cached metrics |
| `GET /api/v1/chatbots/{id}/analytics/by-channel?days=7` | Per-channel breakdown (sessions, messages, avg per session) |
| `POST /api/v1/chatbots/{id}/refresh-metrics` | Recalculate all metrics from conversation data |

### 8.5 API Key Management (Detail Page → Embed Tab)

| Action | UI | Description |
|--------|----|-------------|
| **View keys** | Key list with prefix, creation date, last used | Full key is never shown after creation |
| **Regenerate** | "Regenerate Key" button | Revokes all old keys, creates a new one. **Full key shown only once** in a success alert. |
| **Delete** | Trash icon per key | Permanently deletes a specific key. Immediate effect. |

### 8.6 Slug Management (Detail Page → Hosted Page Tab)

Each chatbot gets URL-friendly slugs for public access:

| Slug | Scope | Format |
|------|-------|--------|
| **Workspace Slug** | All chatbots in workspace | Lowercase letters, numbers, hyphens |
| **Chatbot Slug** | Individual chatbot | Lowercase letters, numbers, hyphens |

Both slugs are editable inline with validation. Old URLs automatically redirect to new ones.

### 8.7 Adding Channels After Deployment

From the **Deployment Tab**:

| Channel | How to Add |
|---------|-----------|
| **Telegram** | Click "Connect Bot" → enter bot token → system registers webhook |
| **Discord** | Click "Connect to Discord servers" → configure guilds/channels |
| **WhatsApp** | Coming Soon (disabled button) |

### 8.8 Jailbreak Protection

The guardrails service includes built-in jailbreak detection that scans all incoming messages for patterns like:
- "ignore all previous instructions"
- "pretend you are"
- "developer mode"
- "bypass your restrictions"

When detected, the AI responds: "I'm designed to be helpful, harmless, and honest. I can't pretend to be something I'm not or bypass my guidelines. How can I actually help you today?"

User input is also sanitized: whitespace is normalized, and messages are truncated to 4,000 characters maximum.

---

## Part 9: Configuration Recipes for Optimal Results

### 9.1 Use Case Recipes

#### Customer Support Bot

| Setting | Value | Why |
|---------|-------|-----|
| **System Prompt** | Write a detailed support-focused prompt (see best practices in Part 3.1) | Establishes empathetic, professional tone |
| **Temperature** | 0.5 | Accurate, not creative — support needs precision |
| **Max Tokens** | 1,500 | Enough for detailed explanations without rambling |
| **Grounding Mode** | `strict` | Ensures answers come from your KB, not hallucinated |
| **Memory** | Enabled, 20 messages | Maintains context across multi-turn support conversations |
| **Enable Citations** | `true` | Users can verify information sources |
| **Lead Capture** | `before_chat`, email required | Capture contact info for follow-up |
| **Channels** | Website Widget + Telegram (post-deploy) | Cover web and mobile users |

**Instructions to add**:
1. "Always greet the user and ask how you can help"
2. "If the answer requires multiple steps, use numbered lists"
3. "If you cannot resolve the issue, offer to connect them with a human agent"

**Restrictions to add**:
- "Never share internal pricing or discount codes"
- "Never admit to being an AI — stay in your support role"

#### FAQ Knowledge Bot

| Setting | Value | Why |
|---------|-------|-----|
| **System Prompt** | "You are a knowledgeable FAQ assistant. Answer questions briefly and accurately." | Brief, direct answers |
| **Temperature** | 0.3 | Very focused — FAQ answers should be consistent |
| **Max Tokens** | 800 | Shorter, direct answers |
| **Grounding Mode** | `strict` | Only answer what's in the KB |
| **Memory** | Enabled, 10 messages | Some context for follow-ups |
| **Enable Follow-ups** | `true` | Guide users to related questions |
| **Channels** | Website Widget | Embedded on FAQ page |

#### Sales & Lead Qualification Bot

| Setting | Value | Why |
|---------|-------|-----|
| **System Prompt** | Write a consultative sales prompt that asks qualifying questions | Structured qualification flow |
| **Temperature** | 0.7 | Engaging, natural conversation |
| **Max Tokens** | 1,200 | Enough to explain value props |
| **Grounding Mode** | `guided` | Can supplement product info with general knowledge |
| **Memory** | Enabled, 20 messages | Full conversation context for qualification |
| **Lead Capture** | `after_n_messages: 3`, email required | Capture after building rapport |
| **Conversation Starters** | "What challenges are you facing?", "Tell me about your needs", "Want a demo?" | Guide the conversation |
| **Channels** | Website Widget + API | Catch leads on website and via integrations |

**Variables to collect**:
- `{{company_name}}` — "What company are you from?"
- `{{team_size}}` — "How big is your team?"

**Instructions to add**:
1. "Ask qualifying questions: challenges, timeline, budget, decision-makers"
2. "Highlight relevant features and benefits based on their needs"
3. "If they're a good fit, suggest scheduling a demo"

#### Internal Knowledge Assistant

| Setting | Value | Why |
|---------|-------|-----|
| **System Prompt** | "You are an internal knowledge assistant for our company. Help employees find information from our documentation." | Scoped to internal use |
| **Temperature** | 0.5 | Accurate information retrieval |
| **Grounding Mode** | `strict` | Only answer from internal docs |
| **Memory** | Enabled, 15 messages | Context for document navigation |
| **Enable Citations** | `true` | Employees can verify source documents |
| **Is Public** | `false` | Requires API key — internal only |
| **Channels** | API + Discord (post-deploy) | Available in team Discord and via internal tools |

#### Multi-Language Support Bot

| Setting | Value | Why |
|---------|-------|-----|
| **System Prompt** | "You are a multilingual support assistant. Always respond in the same language the user uses." | Language matching |
| **Temperature** | 0.6 | Balanced for multiple languages |
| **Grounding Mode** | `guided` | Can supplement with language-appropriate general knowledge |
| **Memory** | Enabled, 20 messages | Context preservation across languages |
| **KB** | Attach KBs with multilingual content; use a multilingual embedding model | Ensures content retrieval works across languages |

### 9.2 Grounding Mode Selection Guide

| Your Scenario | Recommended Mode | Why |
|---------------|------------------|-----|
| Customer support with specific product KB | **Strict** | Prevents incorrect answers about your product |
| General FAQ with comprehensive KB | **Strict** | Keeps answers focused on your content |
| Sales bot with product + industry KB | **Guided** | Can supplement product info with industry context |
| Internal research assistant | **Guided** | Employees benefit from supplementary context |
| Conversational engagement bot | **Flexible** | Natural conversation with KB as bonus |
| Chatbot WITHOUT any KB | **Flexible** | No KB to ground on — let the AI use general knowledge |

### 9.3 Temperature Tuning Guide

| Your Priority | Recommended Range | Example |
|---------------|-------------------|---------|
| **Factual accuracy** (support, FAQ, compliance) | 0.1 – 0.4 | Legal FAQ bot: 0.2 |
| **Balanced** (general support, documentation) | 0.4 – 0.7 | Customer support: 0.5 |
| **Natural conversation** (sales, onboarding) | 0.6 – 0.8 | Sales assistant: 0.7 |
| **Creative engagement** (brainstorming, marketing) | 0.8 – 1.2 | Creative helper: 1.0 |

### 9.4 Channel-Specific Optimization

| Channel | Optimization Tips |
|---------|-------------------|
| **Website Widget** | Use conversation starters to guide initial interactions. Enable lead capture before chat for B2B. Set position to bottom-right (most natural). |
| **SecretVM** | Share the hosted URL for quick access without website integration. Use QR codes for physical media (business cards, flyers). |
| **Telegram** | Keep responses concise — Telegram users expect quick replies. Set a clear `/start` welcome message. Add after deployment via Detail Page. |
| **Discord** | Invite the shared bot to your server. Configure which channels the bot responds in. Supports slash commands (`/ask`, `/chat`). Add after deployment via Detail Page. |
| **API** | Set `is_public: false` for API-only access requiring authentication. Use session IDs for multi-turn conversations. |

---

## Part 10: Troubleshooting

### 10.1 Creation & Configuration Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| "Draft not found or expired" | Draft expired (24hr TTL) or was deleted | Create a new draft. Drafts auto-extend TTL on each save, but abandoned ones expire. |
| Can't proceed past Step 1 | Name validation failed | Ensure name is 3–100 characters. |
| System prompt changes not taking effect | Auto-save debounce delay | Wait 500ms after typing. The wizard uses a 500ms debounce for auto-save. |
| Test message returns error | Draft data incomplete or AI service unreachable | Check that system prompt is not empty. Verify backend is running and Secret AI endpoint is accessible. |
| KB not appearing in selector | KB in wrong workspace or not in "ready" status | Verify the KB is in the same workspace. Check KB status — it must be "ready" (fully processed). |
| "Knowledge base already attached" | Trying to add the same KB twice | Each KB can only be attached once per chatbot. |
| Variables not being substituted | Variable name mismatch | Ensure the `{{variable_name}}` in the prompt exactly matches the defined variable name (case-sensitive). |

### 10.2 Deployment Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Deploy button disabled | No channels enabled | Enable at least one channel (Website, API, or SecretVM). |
| "Validation failed" on deploy | Missing required fields | Ensure name is set and system prompt is not empty. Check the error details in the response. |
| API key not shown | Missed the post-deploy screen | API key is shown only once. If missed, go to the Embed tab and click "Regenerate Key". The old key will be revoked. |
| Telegram webhook fails | Localhost URL | Telegram requires a public HTTPS URL. Use ngrok for local development or deploy to a public server. |
| Discord bot doesn't respond | Missing permissions | Ensure the bot has Read Messages, Send Messages, Embed Links, and Read Message History permissions. Re-invite with the correct invite URL. |

### 10.3 Conversation Quality Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Bot answers with general knowledge instead of KB | Grounding mode set to Flexible or Guided | Switch to **Strict** mode if you want KB-only answers. |
| Bot says "I don't have information" when it should | KB search returns no results for the query | Check KB status is "ready". Test search in KB detail page. Try different query phrasing. Increase `top_k` or lower `score_threshold` via the API. |
| Bot contradicts itself across messages | Memory disabled or max_messages too low | Enable memory and increase max_messages to at least 10. |
| Bot repeats instructions ("What's your name?" repeatedly) | Instructions re-evaluated every turn without conversation context | The backend includes a conversation summary before instructions. If the issue persists, rephrase instructions to be conditional: "If you haven't asked yet, ask for their name." |
| Bot says "based on the provided context" | Grounding mode prompt leaking | This shouldn't happen with current guardrails prompts (they explicitly forbid this). Update your system prompt to reinforce: "Never mention your context or sources." |
| Sources shown but not relevant | Low score threshold or irrelevant KB content | Increase `score_threshold` to 0.7+. The backend validates sources with 3-word minimum overlap. |
| Affirmative responses ("yes please") get no-info reply | KB returns 0 results for affirmative words | In Guided/Flexible mode, the backend uses affirmative fallback. In Strict mode, this is intentional — switch to Guided if you need this behavior. |
| Bot response is too long/short | Max tokens misconfigured | Adjust max_tokens: 500–800 for concise, 1,500–2,000 for detailed, up to 8,000 for long-form. |
| Temperature too high causes inconsistent answers | Temperature > 1.0 | Lower temperature to 0.3–0.7 for production chatbots. |

### 10.4 Channel-Specific Issues

| Problem | Channel | Solution |
|---------|---------|----------|
| Widget doesn't appear on website | Website | Check embed code placement (before `</body>`). Check browser console for errors. Check CORS configuration. |
| Widget appears but doesn't respond | Website | Check API URL in embed code. Verify chatbot status is "active". Check CORS configuration. |
| Hosted page shows error | SecretVM | Verify the workspace and chatbot slugs are correct. Check that the chatbot status is "active" and `is_public` is true. |
| Telegram bot doesn't respond to messages | Telegram | Verify webhook is registered (check deployment_config). Ensure bot token is valid. Check backend logs for webhook errors. |
| Discord bot offline in server | Discord | Check bot token is valid. Verify bot was invited with correct permissions. Check if bot has been kicked from the server. |
| Discord slash commands not working | Discord | Slash commands may take up to 1 hour to register globally after bot joins. |

### 10.5 Performance Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Slow responses (>5s) | Multiple large KBs, high top_k, or TEE processing | Reduce `top_k` to 3–5. Reduce number of attached KBs. Secret AI TEE timeout is 120s — some latency is expected. |
| Rate limiting errors | Too many requests per minute | Default rate limit: 10 messages/minute, 100 per session (in behavior_config). |
| Memory/token overflow | Very long conversations with high max_messages | Reduce `max_messages` to 10–15. Lower `max_tokens` for shorter responses. |

---

## Part 11: Quick Reference Tables

### 11.1 All Default Values

| Setting | Default Value | Where Set |
|---------|--------------|-----------|
| AI Model | `secret-ai-v1` (Secret AI) | Fixed — not selectable |
| Temperature | 0.7 | Step 2 slider |
| Max Tokens | 2,000 | Step 2 input |
| System Prompt | "You are a helpful assistant..." (see Part 3.1) | Step 2 textarea |
| Memory Enabled | `true` | Step 4 toggle |
| Memory Max Messages | 20 | Step 4 slider (5–50) |
| Grounding Mode | `strict` | Step 2 radio buttons |
| Enable Citations | `false` | Step 2 toggle |
| Enable Follow-ups | `false` | Step 2 toggle |
| Primary Color | `#3b82f6` (Blue) | Step 4 color picker |
| Secondary Color | `#8b5cf6` (Purple) | Step 4 hex input |
| Font Family | Inter | Step 4 dropdown |
| Widget Position | `bottom-right` | Step 4 button group |
| Bubble Style | `rounded` | Step 4 button group |
| Lead Capture Enabled | `false` | Step 4 toggle |
| Lead Capture Timing | `before_chat` | Step 4 card buttons |
| Variables Enabled | `false` | Step 2 toggle |
| Is Public | `true` | Step 5 button group |
| Rate Limit (msgs/min) | 10 | Backend `behavior_config` |
| Rate Limit (msgs/session) | 100 | Backend `behavior_config` |
| Typing Delay | 500ms | Backend `behavior_config` |

### 11.2 Backend JSONB Configuration Columns

| Column | Purpose | Key Fields |
|--------|---------|------------|
| `ai_config` | AI model and inference | `provider`, `model`, `temperature`, `max_tokens`, `top_p`, `frequency_penalty`, `presence_penalty` |
| `prompt_config` | Prompt and persona | `system_prompt`, `persona { name, role, tone }`, `instructions[]`, `restrictions[]`, `messages { greeting, fallback, closing }` |
| `kb_config` | Knowledge base integration | `enabled`, `knowledge_bases[] { kb_id, name, enabled, priority, retrieval_override }`, `merge_strategy`, `citation_style`, `max_context_tokens`, `grounding_mode` |
| `branding_config` | Widget appearance | `avatar_url`, `avatar_fallback`, `primary_color`, `secondary_color`, `widget_position`, `widget_size`, `show_powered_by`, `hosted_page {}` |
| `deployment_config` | Channel configurations | `web_widget { enabled, domains }`, `telegram { enabled, bot_token_credential_id, webhook_registered }`, `discord { enabled, guild_ids }`, `whatsapp { enabled, phone_number_id }`, `api { enabled, api_key_id }` |
| `behavior_config` | Conversation behavior | `memory { enabled, max_messages }`, `response { typing_indicator, typing_delay_ms }`, `rate_limiting { messages_per_minute, messages_per_session }` |
| `lead_capture_config` | Lead capture settings | `enabled`, `timing`, `required_fields[]`, `optional_fields[]`, `privacy { require_consent, consent_message }`, `platforms {}`, `messages_before_prompt` |
| `variables_config` | Variable collection | `enabled`, `variables[] { id, name, type, label, placeholder, required, default_value, options }`, `collection_timing` |
| `analytics_config` | Analytics settings | `track_conversations`, `track_satisfaction`, `track_intents` |
| `cached_metrics` | Dashboard metrics | `total_conversations`, `total_messages`, `avg_satisfaction`, `resolution_rate`, `avg_response_time_ms` |

> **Note**: The backend supports fields like `persona` (name, role, tone), `fallback` and `closing` messages, and `merge_strategy` that are not exposed in the creation wizard but can be set via the API or edit page after deployment.

### 11.3 API Endpoints Summary

#### Draft Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/chatbots/drafts` | Create chatbot draft |
| GET | `/api/v1/chatbots/drafts` | List drafts for workspace |
| GET | `/api/v1/chatbots/drafts/{id}` | Get draft by ID |
| PATCH | `/api/v1/chatbots/drafts/{id}` | Update draft |
| DELETE | `/api/v1/chatbots/drafts/{id}` | Delete draft |
| POST | `/api/v1/chatbots/drafts/{id}/kb` | Attach KB to draft |
| DELETE | `/api/v1/chatbots/drafts/{id}/kb/{kb_id}` | Detach KB from draft |
| POST | `/api/v1/chatbots/drafts/{id}/deploy` | Deploy chatbot |
| POST | `/api/v1/chatbots/drafts/{id}/test` | Test draft chatbot |

#### Deployed Chatbot Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/chatbots/` | List chatbots |
| GET | `/api/v1/chatbots/{id}` | Get chatbot |
| PATCH | `/api/v1/chatbots/{id}` | Update chatbot |
| DELETE | `/api/v1/chatbots/{id}` | Archive (soft delete) |
| POST | `/api/v1/chatbots/{id}/restore` | Restore archived |
| POST | `/api/v1/chatbots/{id}/status` | Pause/resume |
| DELETE | `/api/v1/chatbots/{id}/permanent?confirm=true` | Hard delete |
| PATCH | `/api/v1/chatbots/{id}/slug` | Update slug |
| POST | `/api/v1/chatbots/{id}/test` | Test deployed chatbot |
| POST | `/api/v1/chatbots/{id}/channels/telegram` | Add Telegram channel |

#### Analytics & API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/chatbots/{id}/analytics` | General analytics |
| GET | `/api/v1/chatbots/{id}/analytics/by-channel` | Per-channel analytics |
| POST | `/api/v1/chatbots/{id}/refresh-metrics` | Refresh cached metrics |
| GET | `/api/v1/chatbots/{id}/api-keys` | List API keys |
| POST | `/api/v1/chatbots/{id}/api-keys/regenerate` | Regenerate API key |
| DELETE | `/api/v1/chatbots/{id}/api-keys/{key_id}` | Delete API key |

#### Hosted Page

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/chatbots/{id}/hosted-page` | Get hosted page config |
| PATCH | `/api/v1/chatbots/{id}/hosted-page` | Update hosted page config |

#### Public API (End Users)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/public/bots/{bot_id}/chat` | Send message (UUID-based) |
| POST | `/api/v1/public/chat/{workspace_slug}/{bot_slug}` | Send message (slug-based) |
| POST | `/api/v1/public/chat/{workspace_slug}/{bot_slug}/leads` | Submit lead form |
| POST | `/api/v1/public/chat/{workspace_slug}/{bot_slug}/events` | Track widget events |
| GET | `/api/v1/public/chat/{workspace_slug}/{bot_slug}/config` | Get widget config |

#### Webhook Endpoints (Registered)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/webhooks/telegram/{bot_id}` | Receive Telegram messages |
| POST | `/api/v1/webhooks/discord/shared` | Receive Discord messages (shared bot) |
| POST | `/api/v1/webhooks/discord/{bot_id}` | Receive Discord messages (per-bot) |

### 11.4 Chatbot Creation Wizard Validation Summary

| Step | Required Fields | Optional Fields |
|------|-----------------|-----------------|
| **Step 1** (Basic Info) | Name (3–100 chars) | Description, Greeting Message |
| **Step 2** (Prompt & AI) | System prompt (non-empty), Temperature (0–2), Max tokens (100–8000) | Behavior (citations, follow-ups, grounding mode, starters), Instructions, Restrictions, Variables |
| **Step 3** (Knowledge Bases) | None | Any number of KBs from the same workspace |
| **Step 4** (Appearance) | None | Widget name, avatar, colors, font, bubble style, position, memory, lead capture |
| **Step 5** (Deploy) | At least 1 channel enabled | Visibility (public/private) |

### 11.5 Deployment Channel Comparison

| Feature | Website Widget | SecretVM (Hosted Page) | REST API | Telegram | Discord |
|---------|---------------|----------------------|----------|----------|---------|
| **Available** | At creation | At creation | At creation | After deployment | After deployment |
| **Setup difficulty** | None (embed code) | None (URL sharing) | None | Medium (BotFather) | Medium (Developer Portal) |
| **Requires credential** | No | No | API key (if private) | Bot token | Bot token |
| **Rich UI** | Full widget | Full hosted page | N/A | Text + commands | Text + slash commands |
| **Lead capture** | Form overlay | Form overlay | Via variables | Conversation prompt | DM prompt |
| **Session management** | Automatic | Automatic | Via session_id | Automatic | Per-guild |
| **Mobile support** | Responsive | Responsive | N/A | Native app | Native app |

### 11.6 Secret AI Model Details

| Property | Value |
|----------|-------|
| **Frontend ID** | `secret-ai-v1` |
| **Backend Model** | `DeepSeek-R1-Distill-Llama-70B` |
| **Provider** | Secret AI (only provider — no fallbacks) |
| **API Format** | OpenAI-compatible |
| **Execution** | Trusted Execution Environment (TEE) — encrypted memory, inaccessible to server operator |
| **Timeout** | 120 seconds |
| **Streaming** | Supported via SSE |
| **Base URL** | Configured via `SECRET_AI_BASE_URL` environment variable |

---

*This guide was generated from source code analysis of the PrivexBot codebase. Every feature described has been verified as implemented and functional in the actual frontend pages (`/pages/chatbots/create.tsx`, `/pages/chatbots/detail.tsx`, `/pages/chatbots/edit.tsx`) and backend routes/services.*
