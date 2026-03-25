# PrivexBot Quick Start Guide

> Create a Knowledge Base, build a chatbot, and deploy it — all in one session.

This guide walks you through creating a **Knowledge Base from web URLs**, building a **chatbot** powered by that KB, and deploying it on **Website**, **SecretVM (hosted page)**, and **Telegram**.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part A: Create a Knowledge Base](#part-a-create-a-knowledge-base)
   - [Step 1 — Basic Info](#step-1--basic-info)
   - [Step 2 — Content Review](#step-2--content-review)
   - [Step 3 — Content Approval](#step-3--content-approval)
   - [Step 4 — Chunking](#step-4--chunking)
   - [Step 5 — Model & Store](#step-5--model--store)
   - [Step 6 — Retrieval](#step-6--retrieval)
   - [Step 7 — Finalize](#step-7--finalize)
3. [Part B: Create a Chatbot](#part-b-create-a-chatbot)
   - [Step 1 — Basic Info](#chatbot-step-1--basic-info)
   - [Step 2 — Prompt & AI](#chatbot-step-2--prompt--ai)
   - [Step 3 — Knowledge Bases](#chatbot-step-3--knowledge-bases)
   - [Step 4 — Appearance](#chatbot-step-4--appearance)
   - [Step 5 — Deploy](#chatbot-step-5--deploy)
4. [Part C: Deploy to Channels](#part-c-deploy-to-channels)
   - [Website Widget](#website-widget)
   - [SecretVM (Hosted Page)](#secretvm-hosted-page)
   - [Telegram](#telegram)
5. [Configuration Quick Reference](#configuration-quick-reference)

---

## Prerequisites

- A PrivexBot account with an active workspace
- A website URL (or URLs) containing the content you want your chatbot to use
- For Telegram: A bot token from [@BotFather](https://t.me/BotFather)

---

## Part A: Create a Knowledge Base

Navigate to **Knowledge Bases** in the sidebar, then click **Create Knowledge Base**. You'll see a 7-step wizard.

### Step 1 — Basic Info

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| **KB Name** | Yes | — | 1–255 characters. Descriptive name like "Product Docs KB" |
| **Description** | No | — | Internal reference for your team |
| **Usage Context** | Yes | Both | Choose **Chatbot**, **Chatflow**, or **Both** |

**Tip**: Choose "Both" unless you're certain this KB will only be used in one context.

Click **Next** to proceed.

---

### Step 2 — Content Review

This is where you add content to your KB. You'll see 6 source types in 3 categories:

| Category | Source Type | Description |
|----------|-----------|-------------|
| **Direct** | Upload Files | PDF, DOCX, TXT, CSV, and 10+ more formats |
| **Direct** | Paste Text | Type or paste content directly |
| **Web** | Add URL | Scrape a single webpage |
| **Web** | Crawl Website | Crawl multiple linked pages from a domain |
| **Cloud** | Notion | Import from Notion workspace |
| **Cloud** | Google Drive | Import Docs, Sheets, or folders |

#### Adding Web URLs (Single Mode)

1. Click **Add URL** or **Crawl Website**
2. Enter your URL (e.g., `https://docs.example.com`)
3. Select the crawl method:
   - **Single Page** — Scrapes only the URL you entered
   - **Crawl Website** — Follows links within the domain (default)
4. Click **Preview & Add** to scrape the content

**Advanced Settings** (click to expand):

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Max Pages | 50 | 1–1,000 | Maximum pages to crawl |
| Max Depth | 3 | 1–10 | How many link-levels deep to follow |
| Include Patterns | — | — | Only crawl URLs matching these patterns (e.g., `/docs/**`) |
| Exclude Patterns | — | — | Skip URLs matching these patterns (e.g., `/admin/**`) |

#### Adding Web URLs (Bulk Mode)

1. Toggle **Bulk URL Mode** at the top of the form
2. Paste URLs in the textarea — one per line (up to 50)
3. Click **Validate URLs** to check all URLs at once
4. Each URL shows a green checkmark (valid) or red X (invalid)
5. Optionally configure per-URL settings (crawl method, depth, etc.)
6. Click **Preview & Add**

#### Preview & Approve

After scraping completes, a preview modal appears showing all extracted pages:

- **Select/deselect** individual pages using checkboxes
- **Edit** any page's content inline (changes persist through the wizard)
- **Copy** or **Export** pages in Markdown, TXT, or HTML format
- Click **Approve** to add selected pages to your KB, or **Reject** to discard

Each approved source appears in the **Source List** with a status badge (Pending, Completed, or Failed). You can:
- **Preview** any source to review its content
- **Remove** a source you no longer want
- **Edit** page content from the preview dialog

---

### Step 3 — Content Approval

This step aggregates pages from all sources. You can:

- See total stats: Total Pages, Selected, Edited, Total Words
- **Select All / Deselect All** pages
- Review per-page status: Approved (green), Needs Re-approval (amber), Edited (blue)
- Click **Approve Selected** to confirm pages for processing

Pages approved during the preview in Step 2 carry over automatically.

---

### Step 4 — Chunking

Chunking splits your content into smaller pieces for efficient search and retrieval.

#### Presets

Three presets are available for quick configuration:

| Preset | Strategy | Chunk Size | Overlap | Best For |
|--------|----------|-----------|---------|----------|
| **Precise** | By Sentence | 256 | 50 | FAQ, short answers |
| **Balanced** | By Heading | 512 | 100 | General documentation |
| **Contextual** | Semantic | 1024 | 200 | Long-form, narrative content |

#### All Chunking Strategies

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| `recursive` | Recursively splits on separators | General purpose fallback |
| `adaptive` | Auto-selects based on content structure | Mixed content, uncertain format |
| `by_heading` | Splits on Markdown headings (`#`, `##`, `###`) | Structured docs with headings **(default)** |
| `paragraph_based` | Splits on paragraph breaks | Blog posts, articles |
| `sentence_based` | Splits on sentence boundaries | FAQs, precise retrieval |
| `semantic` | Splits on meaning/topic boundaries | Narrative, context-heavy content |
| `hybrid` | Combines multiple strategies | Complex, varied documents |
| `no_chunking` | Keeps each document whole | Very small documents only |
| `custom` | User-defined separators | Special formatting needs |

#### Configuration Sliders

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| Chunk Size | 1,000 chars | 100–4,000 | Target size of each chunk |
| Chunk Overlap | 200 chars | 0–500 | Overlap between consecutive chunks |
| Preserve Code Blocks | On | Toggle | Keep code blocks intact during chunking |
| Enhanced Metadata | Off | Toggle | Add `context_before/after` and `parent_heading` to chunks |
| Semantic Threshold | 0.7 | 0–1 | Similarity threshold for semantic strategy |

#### Live Chunking Preview

As you adjust settings, the **Chunking Preview** panel on the right shows:
- Sample chunks from your approved content
- Per-chunk: content preview, size, word count, source metadata
- Statistics: total chunks, average chunk size, size distribution (small/medium/large)
- Source breakdown: chunks per source

---

### Step 5 — Model & Store

Configure the embedding model and vector store.

#### Embedding Models

| Model | Dimensions | Speed | Quality | Best For |
|-------|-----------|-------|---------|----------|
| `all-MiniLM-L6-v2` | 384 | Fast | Good | General use, smaller KBs **(default)** |
| `all-MiniLM-L12-v2` | 384 | Medium | Better | Technical documentation |
| `all-mpnet-base-v2` | 768 | Slower | Best | Legal, medical, precision-critical |
| `paraphrase-multilingual-MiniLM-L12-v2` | 384 | Medium | Good | Multi-language content |

All models run locally on CPU via sentence-transformers (no API keys needed, privacy-preserving).

#### Vector Store

| Setting | Default | Options |
|---------|---------|---------|
| Provider | Qdrant | Qdrant (self-hosted, recommended) |
| Distance Metric | Cosine | Cosine, Euclid, Dot Product |
| Index Type | HNSW | HNSW (default, fast approximate search) |
| HNSW M | 16 | Connections per node |
| HNSW ef_construct | 100 | Construction accuracy |
| Batch Size | 100 | Vectors per upsert batch |

**Tip**: The defaults work well for most use cases. Only adjust if you have specific performance requirements.

---

### Step 6 — Retrieval

Configure how your chatbot searches the knowledge base.

#### Retrieval Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `hybrid_search` | Combines semantic + keyword search | General use **(default)** |
| `semantic_search` | Pure vector similarity | Conceptual/meaning-based queries |
| `keyword_search` | Traditional text matching | Exact terms, product names, codes |
| `mmr` | Maximal Marginal Relevance | Diverse results, avoiding repetition |
| `similarity_score_threshold` | Only returns results above a threshold | High-precision, low-noise |

#### Configuration

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| Top K | 10 | 1–50 | Number of results to retrieve |
| Score Threshold | 0.7 | 0–1 | Minimum similarity score |
| Rerank Enabled | Off | Toggle | Re-rank results for better ordering |

---

### Step 7 — Finalize

Review your complete configuration:
- KB name, description, and context
- Number of approved sources and pages
- Chunking strategy and settings
- Embedding model and vector store config
- Retrieval strategy

Click **Create Knowledge Base**. This:
1. Creates the KB record in PostgreSQL (status: `processing`)
2. Queues a background Celery task for the ETL pipeline
3. Returns a `kb_id` and `pipeline_id` for tracking

You'll be redirected to the **Pipeline Monitor** where you can watch the 5 processing stages:
1. **Scraping** — Fetching content from sources
2. **Parsing** — Extracting text from documents
3. **Chunking** — Splitting into chunks
4. **Embedding** — Generating vector embeddings
5. **Indexing** — Storing vectors in Qdrant

Once the pipeline completes (status: `ready`), your KB is ready to use.

---

## Part B: Create a Chatbot

Navigate to **Chatbots** in the sidebar, then click **Create Chatbot**. You'll see a 5-step wizard.

### Chatbot Step 1 — Basic Info

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| **Chatbot Name** | Yes | — | e.g., "Customer Support Bot" |
| **Description** | No | — | Internal reference |
| **Greeting Message** | No | — | First message users see when they open the widget |

---

### Chatbot Step 2 — Prompt & AI

This is where you define your chatbot's personality and behavior.

#### System Prompt

Write instructions that define how your chatbot behaves. This is a plain textarea — write naturally.

Example:
```
You are a helpful customer support agent for Acme Corp.
Answer questions about our products using the knowledge base.
Always be polite and professional.
```

**Variable Insertion**: Type `/` in the system prompt to open a variable menu. Insert variables with `{{variable_name}}` syntax (see Variable Collection below).

#### AI Model

The model is **Secret AI** — a privacy-preserving model (DeepSeek-R1-Distill-Llama-70B) running in a Trusted Execution Environment. This is a fixed display, not selectable.

#### Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Temperature | 0.7 | 0–2 | Lower = more focused; Higher = more creative |
| Max Tokens | 2,000 | 100–8,000 | Maximum response length |

#### Behavior Features

| Feature | Default | Description |
|---------|---------|-------------|
| Citations & Attributions | Off | Show KB source references in responses |
| Follow-up Questions | Off | Suggest related questions after responses |

#### Knowledge Base Usage (Grounding Mode)

| Mode | Description |
|------|-------------|
| **Strict** (Recommended) | Only answers from KB. Refuses if information not found. |
| **Guided** | Prefers KB but can use general knowledge (with disclosure). |
| **Flexible** | Uses KB to enhance responses, freely uses general knowledge. |

#### Conversation Starters

Add up to **4** suggested prompts shown to users when they first open the chat. Example:
- "What can you help me with?"
- "Tell me about pricing"

#### Instructions & Restrictions

- **Instructions**: Specific behaviors to follow (e.g., "Always greet users warmly"). Each has an enable/disable toggle.
- **Restrictions**: Things to avoid (e.g., "Never discuss competitor products"). Each has an enable/disable toggle.

#### Variable Collection

Collect information from users before or during chat:

1. Toggle **Variable Collection** on
2. Add variables with: **Name** (e.g., `user_name`), **Label** (e.g., "Your Name"), **Type** (Text, Email, Phone, Number)
3. Insert variables in your system prompt with `{{variable_name}}`

---

### Chatbot Step 3 — Knowledge Bases

Attach one or more KBs to your chatbot:

- **Attached Knowledge Bases** — Shows KBs currently connected, with enable/disable toggles and priority display
- **Available Knowledge Bases** — Shows all workspace KBs with status `ready`; click the **+** button to attach

Only KBs that have completed processing appear here. If you don't see any, go back and create one first.

**Info**: Attaching KBs enables RAG (Retrieval Augmented Generation). Your chatbot will search these KBs to provide accurate, context-aware responses.

---

### Chatbot Step 4 — Appearance

Customize how the chat widget looks.

| Setting | Default | Options |
|---------|---------|---------|
| Widget Display Name | — | Text shown in widget header (different from internal name) |
| Avatar URL | — | Image URL for bot avatar (recommended: 64x64px) |
| Primary Color | `#3b82f6` (Blue) | 6 presets: Blue, Purple, Green, Orange, Red, Gray + custom hex |
| Secondary Color | `#8b5cf6` (Purple) | Custom hex input |
| Font Family | Inter | Inter (Recommended), System Default, Monospace |
| Bubble Style | Rounded | Rounded or Square |
| Widget Position | Bottom Right | Bottom Right or Bottom Left |

#### Conversation Memory

| Setting | Default | Range |
|---------|---------|-------|
| Enabled | On | Toggle |
| Max Messages | 20 | 5–50 (slider, step 5) |

#### Lead Capture

Optionally collect visitor contact information:

| Setting | Default | Notes |
|---------|---------|-------|
| Enabled | Off | Toggle on to configure |
| Timing | Before Chat | **Before Chat** or **After N Messages** (1–10 slider) |
| Email | Required | Required, Optional, or Hidden |
| Name | Optional | Required, Optional, or Hidden |
| Phone | Hidden | Required, Optional, or Hidden |
| Allow Skip | On | Let visitors bypass the form |
| Require Consent | Off | GDPR compliance checkbox |

**Auto-captured** (no form needed): IP address, location, browser info, referrer URL.

---

### Chatbot Step 5 — Deploy

#### Visibility

| Option | Description |
|--------|-------------|
| **Public** | Anyone can access (no API key needed for hosted page/widget) |
| **Private** | Requires API key for all access |

#### Deployment Channels

Three channels are available at creation:

| Channel | Icon | Description |
|---------|------|-------------|
| **Website** | Globe | Embed chat widget on your website |
| **API** | Settings | REST API access for programmatic use |
| **SecretVM** | Link | Public hosted chat page URL |

Toggle on the channels you want. At least one must be enabled.

> Discord, Telegram, and WhatsApp can be added **after deployment** from the chatbot detail page.

#### Live Test Preview

The right side shows a **live test chat** that reflects your appearance settings (colors, avatar, name). Send test messages to verify your chatbot works correctly before deploying.

#### Deploy

Click **Deploy Chatbot**. On success:
- **API Key** is displayed (shown only once — save it immediately!)
- **Embed Code** snippet is shown for website integration

---

## Part C: Deploy to Channels

### Website Widget

After deployment, copy the embed code from the success screen (or from the **Embed** tab in the chatbot detail page):

```html
<script>
  window.privexbotConfig = {
    botId: 'your-chatbot-id',
    apiKey: 'your-api-key',
    baseURL: 'https://api.privexbot.com'
  };
</script>
<script src="https://cdn.privexbot.com/widget.js" async></script>
```

Paste this before the closing `</body>` tag on your website. The widget loads asynchronously.

---

### SecretVM (Hosted Page)

Your chatbot gets a public URL automatically:

```
https://privexbot.app/chat/{workspace-slug}/{chatbot-slug}
```

Access this from the **Hosted Page** tab in your chatbot detail page, where you can:
- **Copy** the full URL
- **Open** it in a new tab
- **Download a QR Code** for the chat URL
- **Edit slugs** (old URLs auto-redirect via 301)

For private chatbots, visitors see an API key input modal before they can chat.

---

### Telegram

Telegram is configured **after deployment** from the chatbot detail page:

1. Go to your chatbot's **Detail Page** → **Deployment** tab
2. Click **Connect Telegram**
3. Get a bot token from [@BotFather](https://t.me/BotFather):
   - Open Telegram, search for `@BotFather`
   - Send `/newbot`, follow the prompts
   - Copy the bot token (format: `123456:ABC-DEF...`)
4. Paste the token and click **Test** to verify
5. Save the configuration

Your Telegram bot is now live. Users can find it by searching for the bot username.

**Available Commands**: `/start`, `/help`, `/reset`, `/feedback`

**Requirement**: PrivexBot must be accessible via a public HTTPS URL for Telegram webhooks to work (not localhost).

---

## Configuration Quick Reference

### KB Defaults at a Glance

| Parameter | Default Value |
|-----------|--------------|
| Usage Context | Both (chatbot + chatflow) |
| Chunking Strategy | By Heading (`by_heading`) |
| Chunk Size | 1,000 characters |
| Chunk Overlap | 200 characters |
| Preserve Code Blocks | On |
| Embedding Model | `all-MiniLM-L6-v2` (384 dimensions) |
| Embedding Device | CPU (local, privacy-preserving) |
| Vector Store | Qdrant |
| Distance Metric | Cosine |
| Index Type | HNSW |
| Retrieval Strategy | `hybrid_search` |
| Top K | 10 |
| Score Threshold | 0.7 |
| Rerank | Off |

### Chatbot Defaults at a Glance

| Parameter | Default Value |
|-----------|--------------|
| AI Model | Secret AI (DeepSeek-R1 70B in TEE) |
| Temperature | 0.7 |
| Max Tokens | 2,000 |
| Grounding Mode | Strict |
| Citations | Off |
| Follow-up Questions | Off |
| Primary Color | `#3b82f6` (Blue) |
| Font Family | Inter |
| Bubble Style | Rounded |
| Widget Position | Bottom Right |
| Memory | Enabled, 20 messages |
| Lead Capture | Off |
| Visibility | Public |

### Recommended Configurations by Use Case

| Use Case | Chunk Strategy | Chunk Size | Embedding Model | Retrieval |
|----------|---------------|-----------|----------------|-----------|
| **Product docs** | By Heading | 512 | MiniLM-L6 | hybrid_search |
| **FAQ pages** | By Sentence | 256 | MiniLM-L6 | keyword_search |
| **Legal / compliance** | Semantic | 256 | mpnet-base | similarity_threshold |
| **Blog / articles** | By Paragraph | 512 | MiniLM-L6 | semantic_search |
| **Technical API docs** | By Heading | 1,024 | MiniLM-L12 | hybrid_search |
| **Multi-language** | By Heading | 512 | Multilingual MiniLM | hybrid_search |
| **Mixed content** | Adaptive | 1,024 | MiniLM-L6 | hybrid_search |

---

## What's Next?

After your chatbot is live:

- **Test it** via the hosted page URL or the test panel in the detail page
- **Monitor conversations** from the Analytics tab
- **Iterate on your KB** — edit content, add more sources, re-process
- **Add more channels** — Discord and WhatsApp from the Deployment tab
- **Configure lead capture** — collect visitor info from the Edit page
- **Update the system prompt** — refine instructions based on real conversations
