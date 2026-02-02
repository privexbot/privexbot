# Quick Start: Create and Deploy a Chatbot

Build a fully working AI chatbot powered by your own content and deploy it to your website in two phases. This guide assumes you have a PrivexBot account and access to a workspace.

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Create a Knowledge Base](#phase-1-create-a-knowledge-base)
3. [Phase 2: Create and Deploy the Chatbot](#phase-2-create-and-deploy-the-chatbot)
4. [After Deployment](#after-deployment)
5. [Add More Channels](#add-more-channels)
6. [Configuration Reference](#configuration-reference)

---

## Overview

A PrivexBot chatbot needs two things:

1. **A Knowledge Base** — the content your bot answers from (docs, FAQs, product info)
2. **A Chatbot** — the AI configuration that controls how answers are delivered

You create the Knowledge Base first, then create the chatbot and attach it.

```
Knowledge Base (your content)
        +
Chatbot (AI behavior + appearance)
        =
Deployed bot on your website, Telegram, Discord, or API
```

---

## Phase 1: Create a Knowledge Base

### Step 1: Start KB Creation

1. In your dashboard sidebar, click **Knowledge Bases**
2. Click **Create Knowledge Base**

### Step 2: Basic Info

| Field | What to Enter | Required |
|-------|---------------|----------|
| **Name** | A descriptive name (e.g., "Product Documentation") | Yes |
| **Description** | What this KB contains (optional) | No |
| **Context** | Where the KB will be used: Chatbot, Chatflow, or Both | No (defaults to Both) |

Click **Continue**.

### Step 3: Add a Source

Select your source type. **Website URL** is the fastest way to add content.

#### Option A: Website URL (Recommended for Getting Started)

1. Click **Website URL**
2. Enter your URL (e.g., `https://docs.yoursite.com`)
3. Click **Validate** — wait for the green border
4. Under **Crawl Method**, choose:
   - **Single Page** — extracts only that one URL
   - **Crawl Website** — follows links and extracts multiple pages (default)

**Default crawl settings** (work well for most sites):

| Setting | Default | What It Controls |
|---------|---------|------------------|
| Max Pages | 50 | How many pages to extract |
| Max Depth | 3 | How many link levels deep to follow |

5. Click **Preview Content**
6. Wait for crawling to finish (a few seconds to a few minutes depending on site size)

#### Option B: File Upload

1. Click **File Upload**
2. Drag and drop or browse for files (PDF, DOCX, TXT, MD, CSV, JSON — 15+ formats supported)
3. Files are parsed and content extracted automatically

### Step 4: Review and Approve Content

After preview completes, a modal shows all extracted pages:

1. **Review the pages** — each shows title, URL, and word count
2. **Deselect any pages** you don't want (click the checkbox)
3. **Edit content** if needed (click the pencil icon on any page)
4. Click **Approve & Add Source**

The content is now added to your draft.

### Step 5: Chunking Configuration

Chunking splits your content into pieces the AI can search through. The defaults work well for most content.

| Setting | Default | When to Change |
|---------|---------|----------------|
| **Strategy** | Recursive | Change to "By Heading" for well-structured docs with markdown headings |
| **Chunk Size** | 1000 chars | Increase to 2000 for long-form articles; decrease to 500 for FAQs |
| **Chunk Overlap** | 200 chars | Leave as-is for most cases |

Click **Continue**.

### Step 6: Model Configuration

The embedding model converts your text into searchable vectors. Leave the defaults:

| Setting | Default | Note |
|---------|---------|------|
| **Embedding Model** | all-MiniLM-L6-v2 | Local model, no API key needed |
| **Vector Store** | Qdrant | Built-in, no configuration needed |
| **Distance Metric** | Cosine | Best for general text similarity |

Click **Continue**.

### Step 7: Retrieval Configuration

Controls how the AI searches your KB when a user asks a question.

| Setting | Default | Recommendation |
|---------|---------|----------------|
| **Strategy** | hybrid_search | Best accuracy — combines keyword and semantic search |
| **Top K** | 5 | Number of chunks to retrieve per question |
| **Score Threshold** | 0.7 | Minimum relevance score (0-1); lower = more results, higher = stricter |

Click **Continue**.

### Step 8: Finalize

1. Review the summary of your configuration
2. Click **Create Knowledge Base**
3. You'll be redirected to a pipeline monitor page

### Step 9: Wait for Processing

The pipeline runs in the background:

```
Scraping → Parsing → Chunking → Embedding → Indexing
```

The status will change from **Processing** to **Ready** when done. This typically takes a few minutes depending on content size.

**Your KB must show "Ready" status before you can attach it to a chatbot.**

---

## Phase 2: Create and Deploy the Chatbot

### Step 1: Start Chatbot Creation

1. In your dashboard sidebar, click **Chatbots**
2. Click **Create Chatbot**

This opens a 5-step wizard.

---

### Wizard Step 1: Basic Info

| Field | What to Enter | Required | Default |
|-------|---------------|----------|---------|
| **Chatbot Name** | A name for your bot (e.g., "Support Assistant") | Yes | — |
| **Description** | Internal description for your team | No | — |
| **Greeting Message** | First message users see when they open the chat | No | — |

**Greeting message tip:** Tell users what the bot can help with:

```
Hi! I can answer questions about our product, features, billing,
and troubleshooting. What can I help you with?
```

Click **Next**.

---

### Wizard Step 2: Prompt & AI

This is where you define how your chatbot behaves.

#### System Prompt

The system prompt comes pre-filled with a working default:

```
You are a helpful assistant with access to a knowledge base.

IMPORTANT RULES:
1. Only answer questions using information from your knowledge base
2. If asked about a topic not in your knowledge base, say
   "I don't have information about that topic" and suggest
   what you CAN help with
3. When suggesting follow-up questions, only suggest topics
   from your knowledge base
...
```

**This default works well.** Customize it if you want to:
- Give the bot a name and personality
- Specify your product/company name
- Add specific answering rules

**Example customization:**

```
You are Ava, a help center assistant for Acme Workspace.

Your job:
- Answer questions about Acme Workspace using the documentation
  provided to you
- Help users with features, billing, integrations, and troubleshooting

How to answer:
- Friendly, helpful tone
- Keep answers concise (2-3 paragraphs max)
- Use bullet points for step-by-step instructions
- Include menu paths when relevant (e.g., "Go to Settings > Integrations")

When you can't find an answer:
- Say: "I don't have documentation on that topic."
- Suggest visiting help.acmeworkspace.com
```

#### AI Model Settings

| Setting | Default | What It Does | Recommendation |
|---------|---------|--------------|----------------|
| **AI Model** | Secret AI (DeepSeek-R1) | The model used for responses | Cannot be changed (privacy-preserving) |
| **Temperature** | 0.7 | Controls response creativity (0 = deterministic, 2 = creative) | 0.5 for accuracy, 0.7 for balance |
| **Max Tokens** | 2000 | Maximum response length | 2000 works for most cases |

#### Knowledge Base Usage (Grounding Mode)

**This is the most important setting for answer accuracy.**

| Mode | Behavior | When to Use |
|------|----------|-------------|
| **Strict** (Recommended) | Only answers from your KB; declines if not found | Most chatbots — prevents hallucination |
| **Guided** | Prefers KB, can supplement with general knowledge (tells user) | Broad support bots |
| **Flexible** | Mixes KB and general knowledge freely | Internal tools, prototyping |

**Select Strict** unless you have a specific reason not to.

#### Behavior Features

| Feature | Default | Recommendation |
|---------|---------|----------------|
| **Citations & Attributions** | Off | Turn On if your KB has multiple distinct sources |
| **Follow-up Questions** | Off | Turn On — helps users discover related KB content |
| **Conversation Starters** | Empty | Add 3-4 common questions your users ask |

**Conversation starter examples:**
- "How do I get started?"
- "What features are available?"
- "How do I upgrade my plan?"
- "I'm having an issue with..."

#### Instructions (Optional)

Add specific behaviors. Examples:

- "Use exact feature names from the documentation"
- "Include menu paths when explaining how to do something"
- "For troubleshooting, present steps as numbered lists"

#### Restrictions (Optional)

Add guardrails. Examples:

- "Never invent features not in the documentation"
- "Do not answer questions unrelated to our product"
- "Never share pricing unless it's in the docs"

#### Variables (Optional)

Collect information from users before chat begins. Useful for personalization:

- `user_name` (Text) — "Your Name"
- `plan_name` (Text) — "Which plan are you on?"

Variables are inserted into the system prompt as `{{variable_name}}`.

Click **Next**.

---

### Wizard Step 3: Knowledge Bases

1. Your "Ready" KB will appear under **Available Knowledge Bases**
2. Click the **+** (Attach) button next to it
3. It moves to the **Attached Knowledge Bases** section
4. Make sure its toggle is **enabled**

You can attach multiple KBs. They're searched in priority order.

**If no KBs appear:** Your KB is still processing. Go back to Knowledge Bases and check its status.

Click **Next**.

---

### Wizard Step 4: Appearance & Behavior

Customize how the chat widget looks on your website.

| Setting | Default | What It Controls |
|---------|---------|------------------|
| **Widget Display Name** | — | Name shown in the chat widget header |
| **Avatar URL** | — | Image URL for bot avatar (recommended: 64x64px) |
| **Primary Color** | #3b82f6 (Blue) | Widget header and user message bubbles |
| **Secondary Color** | #8b5cf6 (Purple) | Accents, links, buttons |
| **Font Family** | Inter | Widget font (Inter, System Default, or Monospace) |
| **Bubble Style** | Rounded | Message bubble shape (Rounded or Square) |
| **Widget Position** | Bottom Right | Where the widget button appears (Bottom Right or Bottom Left) |

#### Conversation Memory

| Setting | Default | What It Controls |
|---------|---------|------------------|
| **Enabled** | On | Whether the bot remembers previous messages |
| **Max Messages** | 20 | How many messages to remember (5-50) |

#### Lead Capture (Optional)

Collect visitor contact information. When enabled:

| Setting | Default |
|---------|---------|
| **When to show form** | Before Chat |
| **Email** | Required |
| **Name** | Optional |
| **Phone** | Hidden |
| **Allow skip** | On |
| **GDPR consent** | Off |

Click **Next**.

---

### Wizard Step 5: Deploy

#### Visibility

| Option | What It Means |
|--------|---------------|
| **Public** (default) | Anyone can access the chatbot |
| **Private** | Requires an API key to access |

#### Deployment Channels

Enable the channels you want:

| Channel | What It Does |
|---------|--------------|
| **Website** | Embeddable JavaScript widget for your site |
| **REST API** | Direct API access for custom integrations |
| **Public Chat URL** | Hosted chat page with its own URL |

Check at least one channel (Website is recommended).

**Note:** Discord, Telegram, and WhatsApp channels are configured after deployment in the chatbot settings.

#### Deploy

Click **Deploy Chatbot**.

---

### After Clicking Deploy

A success screen shows two critical items:

#### 1. API Key (Save This Immediately)

```
sk_live_abc123def456ghi789jkl012mno345...
```

**This key is shown ONLY ONCE.** Copy it and store it securely. You need it for:
- Private bot access
- REST API calls
- Widget authentication

#### 2. Embed Code

Copy this code and paste it before the `</body>` tag on your website:

```html
<script>
  window.privexbotConfig = {
    botId: 'your-chatbot-id',
    apiKey: 'your-api-key'
  };
</script>
<script src="https://your-widget-cdn-url/widget.js" async></script>
```

Click **Go to Dashboard** to view your deployed chatbot.

---

## After Deployment

### Test Your Chatbot

1. Go to **Chatbots** in the sidebar
2. Click on your chatbot
3. Open the **Test Chat** tab
4. Try asking questions that your KB content covers
5. Verify the answers are accurate and grounded in your content

### Check the Embed Code

1. On the chatbot detail page, open the **Embed Code** tab
2. Copy the full script
3. Paste it into your website's HTML before `</body>`
4. Open your website — the chat widget should appear in the configured position

### View the Hosted Chat Page

1. On the chatbot detail page, open the **SecretVM** tab (Hosted Page)
2. Your chatbot has a public URL:
   ```
   /chat/{workspace-slug}/{chatbot-slug}
   ```
3. You can copy and share this URL directly
4. Click **Download QR Code** to generate a QR code for this URL

---

## Add More Channels

After deployment, add messaging channels from the chatbot detail page under the **Deployment** tab.

### Telegram

1. Open Telegram and message **@BotFather**
2. Send `/newbot` and follow the prompts to create a bot
3. Copy the **bot token** (format: `123456789:ABC-xyz...`)
4. In PrivexBot, click **Connect Bot** on the Telegram card
5. Paste the token and click **Connect**
6. The webhook is registered automatically — your bot is live on Telegram

### Discord

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a **New Application**
3. Go to **Bot** section and create a bot
4. Copy the **bot token**
5. In PrivexBot, click **Connect Server** on the Discord card
6. Enter the bot token or select from auto-detected servers
7. Enter the **Server ID** (Guild ID):
   - Enable Developer Mode in Discord Settings
   - Right-click your server > **Copy Server ID**
8. Click **Connect Server**
9. Use the generated invite URL to add the bot to your Discord server
10. Optionally configure which channels the bot responds in

### WhatsApp (Coming Soon)

WhatsApp Business API integration requires Meta Business Manager approval and a dedicated phone number. This feature is in development.

### REST API

Send messages directly via the API:

```
POST /api/v1/public/bots/{bot_id}/chat
```

**Headers:**
```
Authorization: Bearer sk_live_your_api_key
Content-Type: application/json
```

**Request:**
```json
{
  "message": "How do I reset my password?",
  "session_id": "user-session-123"
}
```

**Response:**
```json
{
  "response": "To reset your password, go to Settings > Account > Security...",
  "sources": [{"title": "Account Security", "content": "..."}],
  "session_id": "user-session-123",
  "message_id": "msg-uuid"
}
```

The `session_id` maintains conversation history across messages. Omit it for stateless single-turn queries.

---

## Configuration Reference

### Recommended Settings for Common Use Cases

#### Documentation Help Bot

| Setting | Value |
|---------|-------|
| Temperature | 0.5 |
| Max Tokens | 2000 |
| Grounding Mode | Strict |
| Citations | On |
| Follow-ups | On |
| Chunking Strategy | By Heading |
| Retrieval Strategy | hybrid_search |

#### Product FAQ Bot

| Setting | Value |
|---------|-------|
| Temperature | 0.7 |
| Max Tokens | 1000 |
| Grounding Mode | Strict |
| Citations | Off |
| Follow-ups | On |
| Chunking Strategy | Recursive |
| Retrieval Strategy | hybrid_search |

#### Customer Support Bot

| Setting | Value |
|---------|-------|
| Temperature | 0.7 |
| Max Tokens | 2000 |
| Grounding Mode | Guided |
| Citations | Off |
| Follow-ups | On |
| Lead Capture | On (before chat) |
| Chunking Strategy | Recursive |
| Retrieval Strategy | hybrid_search |

### Defaults Quick Reference

| Setting | Default |
|---------|---------|
| Temperature | 0.7 |
| Max Tokens | 2000 |
| Grounding Mode | Strict |
| Citations | Off |
| Follow-ups | Off |
| Conversation Memory | On (20 messages) |
| Widget Position | Bottom Right |
| Primary Color | #3b82f6 (Blue) |
| Font | Inter |
| Bubble Style | Rounded |
| Visibility | Public |
| Crawl Method | Crawl Website |
| Max Pages (crawl) | 50 |
| Max Depth (crawl) | 3 |
| Chunking Strategy | Recursive |
| Chunk Size | 1000 chars |
| Chunk Overlap | 200 chars |
| Embedding Model | all-MiniLM-L6-v2 |
| Retrieval Strategy | hybrid_search |
| Top K | 5 |
| Score Threshold | 0.7 |

### Status Meanings

| KB Status | Meaning | Can Attach to Chatbot? |
|-----------|---------|------------------------|
| Draft | Being created | No |
| Processing | Pipeline running | No |
| Ready | Complete and searchable | Yes |
| Failed | Processing error (retry available) | No |
| Reindexing | Being reprocessed | No |

| Chatbot Status | Meaning |
|----------------|---------|
| Active | Live and responding to messages |
| Paused | Deployed but not responding |
| Archived | Disabled, can be restored |
