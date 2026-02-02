# Measuring Knowledge Base Effectiveness

Understand how well your Knowledge Base performs, where to find metrics in the dashboard, and how to use them to improve chatbot answer quality.

---

## Table of Contents

1. [Why Measure KB Effectiveness](#why-measure-kb-effectiveness)
2. [Where to Find Metrics](#where-to-find-metrics)
3. [Pipeline Metrics: Did Processing Succeed?](#pipeline-metrics-did-processing-succeed)
4. [KB Detail Page: Content Health at a Glance](#kb-detail-page-content-health-at-a-glance)
5. [Test Search: Validate Before You Deploy](#test-search-validate-before-you-deploy)
6. [KB Analytics Page](#kb-analytics-page)
7. [Chatbot Analytics: Downstream Impact](#chatbot-analytics-downstream-impact)
8. [Workspace Analytics: The Big Picture](#workspace-analytics-the-big-picture)
9. [Rechunking: Tuning After Deployment](#rechunking-tuning-after-deployment)
10. [Interpreting Your Metrics](#interpreting-your-metrics)
11. [Improvement Workflow](#improvement-workflow)
12. [Metrics Reference](#metrics-reference)

---

## Why Measure KB Effectiveness

A Knowledge Base is only as good as the answers it produces. The raw content might be accurate, but if it's chunked poorly, embedded with the wrong settings, or returning low-relevance results, your chatbot will give weak or incorrect responses.

Measuring effectiveness answers three questions:

1. **Did processing work?** — Were pages scraped, chunks created, and vectors indexed without errors?
2. **Is the content searchable?** — When you query the KB, do relevant chunks come back with high scores?
3. **Are users getting good answers?** — Are chatbot conversations succeeding, and are users satisfied?

PrivexBot gives you tools to answer each of these from the dashboard.

---

## Where to Find Metrics

Metrics are spread across several pages, each focused on a different stage of the KB lifecycle:

| Page | What It Tells You | How to Get There |
|------|-------------------|------------------|
| **Pipeline Monitor** | Processing success/failure, stage-by-stage progress | Automatically shown after KB creation; also via **Knowledge Bases → [KB] → Pipeline** |
| **KB Detail** | Document and chunk counts, content health, settings | **Knowledge Bases → [KB Name]** |
| **KB Analytics** | Performance, content distribution, index health | **Knowledge Bases → [KB Name] → Analytics** (appears when KB is Ready) |
| **Test Search** | Query relevance scores, retrieval quality | **Knowledge Bases → [KB Name] → Test Search** tab |
| **Chatbot Detail → Analytics** | Widget activity, response quality, user feedback | **Chatbots → [Chatbot Name] → Analytics** tab |
| **Workspace Analytics** | Aggregated performance across all chatbots | **Dashboard → Analytics** |

---

## Pipeline Metrics: Did Processing Succeed?

When you create a Knowledge Base, a processing pipeline runs in the background. The Pipeline Monitor page shows real-time progress through five stages:

```
Scraping → Parsing → Chunking → Embedding → Indexing
```

### What You See

The pipeline monitor displays six core statistics:

| Metric | What It Means |
|--------|---------------|
| **Pages Found** | Number of pages discovered during crawling (web sources) or documents added (file uploads) |
| **Pages Scraped** | Number of pages successfully extracted |
| **Failed** | Pages that could not be processed |
| **Chunks** | Text chunks created from your content |
| **Embeddings** | Vector embeddings generated from chunks |
| **Indexed** | Vectors stored in the Qdrant database |

The labels adapt based on your source type:

| Source Type | "Pages Found" Label | "Pages Scraped" Label |
|-------------|--------------------|-----------------------|
| Web scraping | Pages Found | Pages Scraped |
| File upload | Docs Added | Docs Parsed |
| Mixed sources | Sources | Processed |

### How to Read Pipeline Results

**Healthy pipeline:**
- Failed count is 0
- Chunks ≈ expected count based on your content size and chunk settings
- Embeddings = Chunks (every chunk gets one embedding)
- Indexed = Embeddings (every embedding is stored)

**Warning signs:**
- Failed > 0 — Some pages couldn't be scraped (blocked by the site, invalid URLs, or timeouts)
- Chunks = 0 — Content extraction failed entirely
- Indexed < Embeddings — Vector storage had issues

### Pipeline Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| **Running** | Pipeline is actively processing | Wait for completion |
| **Completed** | All stages finished successfully | KB is ready to use |
| **Failed** | A stage encountered an error | Check error message, retry if available |
| **Cancelled** | Stopped by user request | Retry or recreate the KB |
| **Queued** | Waiting to start | Usually resolves on its own; retry if stuck |

If a pipeline gets stuck in "Queued" for an extended period, the monitor will display a "Pipeline Stuck in Queue" warning and offer a retry option.

### Retry and Cancel

- **Retry Pipeline** — Available when the pipeline has failed. Creates a new pipeline run and cleans up failed data (chunks, vectors) before reprocessing.
- **Cancel Pipeline** — Available while the pipeline is running or queued. Stops all processing. The KB must be retried or recreated after cancellation.

---

## KB Detail Page: Content Health at a Glance

Navigate to **Knowledge Bases → [KB Name]** to see the detail page. The header shows four statistics:

| Stat | What It Shows |
|------|---------------|
| **Documents** | Total documents in the KB |
| **Chunks** | Total chunks across all documents |
| **Total Words** | Sum of word counts from all documents |
| **Avg Chunk Size** | Average characters per chunk |

### Tabs

#### Overview Tab

Shows KB metadata:
- Knowledge Base ID
- Context setting (Chatbot, Chatflow, or Both)
- Chunking strategy used
- Last updated timestamp

#### Documents Tab

Lists every document with:
- Document name and source type badge (e.g., `web_scraping`, `file_upload`)
- Status badge: **Ready** (green), **Processing** (blue, spinning), **Failed** (red), **Draft** (orange)
- Source URL (clickable, if available)
- Word count, chunk count, and creation date
- Processing metadata: chunking strategy, chunk size, chunk overlap, embeddings generated

**What to look for:**
- All documents should show **Ready** status
- Documents with 0 chunks or 0 word count indicate extraction problems
- Failed documents need investigation — click the document to see error details

#### Chunks Tab

Shows the first 20 chunks with:
- Chunk index number
- Source document name
- Character count
- Content preview (expandable)

For file-upload KBs where chunks are stored in Qdrant only (not PostgreSQL), this tab shows a summary card with total chunks, document count, and average chunk size instead of individual chunk previews.

**What to look for:**
- Chunks should contain coherent text, not broken fragments
- Character counts should be roughly consistent (matching your configured chunk size)
- If chunks look too short or too long, consider rechunking

#### Settings Tab (Read-Only)

Displays all configuration used to create the KB:

- **Chunking**: Strategy, chunk size, chunk overlap, preserve headings
- **Embedding**: Model, vector store, distance metric, HNSW M parameter
- **Retrieval**: Search strategy, Top K, score threshold

Use this tab to verify your settings match your intentions before investigating performance issues.

---

## Test Search: Validate Before You Deploy

The **Test Search** tab is the most direct way to measure KB effectiveness. It lets you run queries against your KB and see exactly what chunks are returned, with relevance scores.

### How to Use Test Search

1. Go to **Knowledge Bases → [KB Name] → Test Search** tab
2. Type a question your users might ask
3. Select a search strategy:

| Strategy | How It Works | When to Use |
|----------|-------------|-------------|
| **Hybrid** | Combines keyword and semantic search | Best for most cases (default) |
| **Semantic** | Matches meaning, not exact words | Questions with varied phrasing |
| **Keyword** | Matches exact terms | Technical queries with specific terminology |
| **MMR** (Maximal Marginal Relevance) | Prioritizes diversity in results | Broad topics where you want varied answers |
| **Threshold** | Only returns results above the score threshold | When precision matters more than recall |

4. Adjust **Top K** (1–20) to control how many results are returned
5. Press Enter or click Search

### Reading Test Search Results

Each result shows:
- **Rank** — Position in the result list (#1, #2, etc.)
- **Relevance Score** — A percentage (0–100%) indicating how well the chunk matches the query
- **Confidence Badge** — High (≥80%), Medium (≥60%), or Low (<60%)
- **Content Preview** — The chunk text (expandable to see full content)
- **Page Title** — The source page or document name
- **Source URL** — Link to the original source (if available)
- **AI Reasoning** — Explanation of why this chunk was selected (expand to view)
- **Processing Time** — How long the search took (displayed in the header)

### Score Interpretation

| Score Range | Color | Meaning |
|-------------|-------|---------|
| **80–100%** | Green | Strong match — chunk is highly relevant to the query |
| **60–79%** | Yellow | Moderate match — chunk is related but may not directly answer the question |
| **Below 60%** | Red | Weak match — chunk is tangentially related or possibly irrelevant |

### What Good Results Look Like

For a well-configured KB:
- The top 2–3 results should score above 80% for clear, direct questions
- Results should contain text that actually answers the question
- The source pages should match what you'd expect
- Processing time should be under 1000ms

### What Bad Results Look Like

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Top result scores below 60% | Content doesn't cover the topic, or chunking split relevant text across chunks | Add more content on the topic, or increase chunk size |
| Results are relevant but answer is split across multiple chunks | Chunk size is too small | Increase chunk size (try 1500–2000 for long-form content) |
| Results contain irrelevant text mixed with relevant text | Chunk size is too large | Decrease chunk size (try 500–800 for mixed content) |
| No results returned | Content doesn't exist in the KB, or score threshold is too high | Add content, or lower the score threshold in retrieval settings |
| Keyword query works but semantic query doesn't | Embedding model struggles with the content domain | Try hybrid search strategy instead of pure semantic |
| Same content appears in multiple results | High chunk overlap | Reduce chunk overlap, or use MMR strategy to increase diversity |

### Testing Workflow

Run these tests before deploying your chatbot:

1. **Core questions** — Test 5–10 questions you know the KB should answer. All should return high-confidence results.
2. **Edge cases** — Test questions on the boundary of your KB content. Results should either return relevant content or return nothing (not misleading content).
3. **Out-of-scope questions** — Test questions the KB should NOT answer. Ideally, no high-confidence results should appear.
4. **Phrasing variations** — Ask the same question in 3–4 different ways. Results should be consistent.
5. **Strategy comparison** — Try the same query with Hybrid, Semantic, and Keyword strategies. Note which performs best for your content type.

---

## KB Analytics Page

Navigate to **Knowledge Bases → [KB Name] → Analytics** (only available when the KB has **Ready** status).

The analytics page has four tabs: **Performance**, **Usage**, **Content**, and **Health**.

### Overview Cards

Four summary cards at the top:

| Card | What It Shows | Current Status |
|------|---------------|----------------|
| **Documents** | Total document count | Active — pulled from KB stats |
| **Chunks** | Total chunk count | Active — pulled from KB stats |
| **Total Queries** | Number of queries executed against this KB | Infrastructure ready — displays 0 until query tracking is connected |
| **Hit Rate** | Percentage of queries that returned usable results | Infrastructure ready — displays 0% until query tracking is connected |

### Performance Tab

| Metric | Description | Current Status |
|--------|-------------|----------------|
| **Average Response Time** | Time to retrieve results from the KB (ms) | Infrastructure ready |
| **Average Retrieval Time** | Time for vector search specifically (ms) | Infrastructure ready |
| **Embedding Quality** | How well embeddings represent your content (%) | Infrastructure ready |
| **Chunk Hit Rate** | Percentage of chunks that get retrieved in queries (%) | Infrastructure ready |

### Usage Tab

| Section | Description | Current Status |
|---------|-------------|----------------|
| **Top Queries** | Most frequently asked questions with relevance scores | Infrastructure ready |
| **Query Types** | Distribution of query categories | Infrastructure ready |

### Content Tab

| Section | Description | Current Status |
|---------|-------------|----------------|
| **Content Types** | Document types with file sizes | Active — shows document count and total storage size |
| **Chunk Distribution** | Chunk size ranges and counts | Active — calculated from actual chunk data |

The Content tab helps you understand your content composition. If most chunks fall into a narrow size range, your chunking is consistent. A wide spread may indicate mixed content types that could benefit from different chunking strategies.

### Health Tab

| Metric | Description | Current Status |
|--------|-------------|----------------|
| **Index Health** | Whether the vector index is healthy (%) | Active — defaults to 100% when KB is Ready |
| **Query Success Rate** | Ratio of successful to failed queries | Infrastructure ready |
| **Storage Efficiency** | Ratio of chunks to KB capacity | Active — calculated from chunk data |

**Processing Stats** section:
- Documents processed — number of documents in the KB
- Avg processing time — average time to process each document
- Processing errors — number of errors during processing

**Storage Info** section:
- Total size — total content size in bytes (formatted as KB/MB)
- Avg chunk size — average characters per chunk
- Last updated — when the KB was last modified

### About "Infrastructure Ready" Metrics

Several analytics metrics show 0 or placeholder values. This is because the backend has a complete analytics tracking system (`KBAnalyticsEvent` model with query logging, chunk usage tracking, and feedback scoring) that is built but not yet connected to the retrieval pipeline. When connected, these metrics will automatically populate:

- Query counts and trends over time
- Performance timing (response time, retrieval time)
- Chunk hit rates and utilization
- Common queries and query categories
- Feedback scores (1–5 star ratings)
- Session-level analytics

The **Content** and **Health** tabs provide useful data today based on document and chunk statistics.

---

## Chatbot Analytics: Downstream Impact

KB effectiveness ultimately shows in chatbot performance. Go to **Chatbots → [Chatbot Name] → Analytics** tab.

### Widget Activity

| Metric | What It Tells You About KB Effectiveness |
|--------|------------------------------------------|
| **Widget Loads** | How many times users loaded the chat widget |
| **Widget Opens** | How many users opened the widget to chat |
| **Total Conversations** | Number of chat sessions started |
| **Engagement Rate** | `conversations / impressions` — higher means users find the widget useful |

A low engagement rate doesn't necessarily indicate KB problems — it may reflect widget placement or audience. But a drop in engagement over time could mean users stopped finding the chatbot helpful.

### Response Quality

| Metric | What It Tells You |
|--------|-------------------|
| **Total Responses** | Total assistant messages generated |
| **Successful Responses** | Responses generated without errors |
| **Failed Responses** | Responses that encountered AI inference errors |
| **Success Rate** | `successful / total` — should be above 95% |
| **Error Rate** | `failed / total` — should be below 5% |

High error rates are typically AI model issues, not KB issues. But consistently low-quality responses (users not engaging further) may indicate the KB isn't returning good context.

### User Feedback

| Metric | Significance |
|--------|-------------|
| **Total Feedback** | Number of users who rated responses |
| **Positive** | Thumbs-up or positive ratings |
| **Negative** | Thumbs-down or negative ratings |
| **Satisfaction Rate** | `positive / total feedback` |

**This is the most direct measure of KB effectiveness.** If the KB returns relevant, accurate chunks, the AI model generates good answers, and users rate them positively.

- **Satisfaction above 80%** — KB is performing well
- **Satisfaction 60–80%** — Room for improvement; investigate common negative-feedback queries
- **Satisfaction below 60%** — Significant issues; review content coverage and chunking

### Event Breakdown

Shows counts for each event type (widget loaded, widget opened, widget closed, message sent, etc.). This helps you understand user behavior patterns but is less directly tied to KB quality.

### Time Range

Use the days selector to filter analytics by time period (7, 30, or 90 days). This helps you see if changes to your KB (adding content, rechunking) improved metrics over time.

---

## Workspace Analytics: The Big Picture

Navigate to **Dashboard → Analytics** for aggregated metrics across all chatbots in a workspace (or organization).

### Performance Metrics

| Metric | Description |
|--------|-------------|
| **Total Conversations** | All chat sessions across all bots |
| **Total Messages** | All messages exchanged |
| **Unique Visitors** | Distinct chat sessions |
| **Avg Messages per Session** | How engaged users are in each conversation |
| **Avg Response Time (ms)** | AI response latency |
| **Satisfaction Rate** | Overall positive feedback ratio |
| **Error Rate** | AI error ratio across all bots |

### Cost & Usage

| Metric | Description |
|--------|-------------|
| **Prompt Tokens** | Tokens sent to the AI model (includes KB context) |
| **Completion Tokens** | Tokens generated by the AI model |
| **Total Tokens** | Combined token usage |
| **Estimated Cost (USD)** | Token cost estimate |
| **API Calls** | Number of AI model invocations |
| **Avg Tokens per Message** | Average tokens per response |

**KB relevance to cost:** When the KB returns highly relevant chunks, the AI model needs less context to produce a good answer, which can reduce token usage. Poorly chunked content sends more (or less relevant) text to the model, increasing both cost and the chance of irrelevant answers.

### Daily Trends

A time-series view showing conversations, messages, tokens, and cost per day. Use this to spot trends:
- Spikes in conversations after deploying new KB content
- Drops in token usage after rechunking (more efficient context)
- Cost patterns over time

### Chatbot Breakdown

Shows per-chatbot metrics (top 10 by conversation count):
- Conversations, messages, tokens, satisfaction rate per bot
- Helps identify which chatbots (and their attached KBs) are performing well or poorly

---

## Rechunking: Tuning After Deployment

If metrics suggest chunking issues, you can rechunk your KB without recreating it.

Navigate to **Knowledge Bases → [KB Name] → Rechunk** (or find it in the KB settings/actions).

### What Rechunking Does

1. Takes your existing content
2. Applies new chunking configuration (strategy, chunk size, overlap)
3. Generates new embeddings
4. Re-indexes in the vector database
5. Replaces the old chunks

### When to Rechunk

| Observation | Suggested Change |
|-------------|-----------------|
| Test Search returns split answers (relevant text across multiple chunks) | Increase chunk size |
| Chunks contain too much irrelevant text around the answer | Decrease chunk size |
| Results are repetitive (same content in multiple chunks) | Decrease chunk overlap, or switch to MMR retrieval |
| Well-structured docs with headings return poor results | Switch to "By Heading" strategy |
| FAQ-style content with short answers | Decrease chunk size to 500–800 |
| Long-form articles or guides | Increase chunk size to 1500–2000 |

### Rechunking Workflow

1. Navigate to the Rechunk page
2. Adjust chunking configuration (strategy, chunk size, overlap)
3. Click **Generate Preview** to see how the new settings affect your content
4. Review the preview metrics:
   - Total chunks (new count vs old)
   - Average chunk size
   - Retrieval speed prediction (fast/moderate/slow)
   - Context quality prediction (low/medium/high)
5. If satisfied, click **Apply** to reindex
6. Wait for the reindexing pipeline to complete
7. Run Test Search again to compare results

---

## Interpreting Your Metrics

### The Effectiveness Chain

KB effectiveness flows through a chain. A problem at any stage affects everything downstream:

```
Content Quality → Chunking Quality → Embedding Quality → Retrieval Quality → Answer Quality → User Satisfaction
```

### Diagnostic Guide

| Symptom | Where to Check | What to Look For |
|---------|---------------|------------------|
| Pipeline failed | Pipeline Monitor | Error message, failed stage, failed page count |
| KB shows 0 chunks | KB Detail → Documents | Document status, word count, source URL validity |
| Test Search returns no results | Test Search | Try different strategies; check if content exists for the query |
| Test Search scores are low | Test Search + KB Detail → Settings | Chunk size, retrieval strategy, score threshold |
| Chatbot gives wrong answers | Test Search + Chatbot → Prompt & AI | KB may return right chunks but system prompt may not guide the AI correctly |
| Users rate answers negatively | Chatbot Analytics → Feedback | Look at recent negative feedback for patterns |
| High token costs | Workspace Analytics → Cost | Large chunk sizes or too many Top K results inflate context |

### Baseline Expectations

For a well-configured KB with adequate content:

| Metric | Good | Needs Attention | Problem |
|--------|------|-----------------|---------|
| Pipeline completion | No failures | 1–2 failed pages | >10% pages failed |
| Test Search top result score | ≥80% | 60–80% | <60% |
| Test Search processing time | <500ms | 500–1000ms | >1000ms |
| Chatbot success rate | ≥95% | 90–95% | <90% |
| User satisfaction rate | ≥80% | 60–80% | <60% |
| Documents with Ready status | 100% | >90% | <90% |

---

## Improvement Workflow

When metrics indicate problems, follow this sequence:

### Step 1: Verify Content

Go to **KB Detail → Documents**.

- Are all documents in **Ready** status?
- Do documents have reasonable word counts?
- Is the content you expected actually in the KB?

If documents failed or have 0 content, the issue is at the source level. Re-add the source or check the URL/file.

### Step 2: Check Chunking

Go to **KB Detail → Chunks** and **KB Detail → Settings**.

- Are chunks a reasonable size for your content?
- Do chunks contain coherent, complete thoughts?
- Does the chunking strategy match your content structure?

If chunks look wrong, use the Rechunk page to adjust.

### Step 3: Test Retrieval

Go to **KB Detail → Test Search**.

- Run your core questions. Are the right chunks returned?
- Are scores above 80% for direct questions?
- Try different strategies to find the best one for your content.

If retrieval is poor despite good content and chunking, try adjusting the retrieval strategy or score threshold in KB settings.

### Step 4: Check the Chatbot

Go to **Chatbots → [Chatbot] → Analytics**.

- Is the success rate high?
- Is the satisfaction rate acceptable?
- Are there negative feedback patterns?

If the KB returns good chunks but the chatbot still gives poor answers, the issue may be in the system prompt, grounding mode, or temperature settings — not the KB itself.

### Step 5: Monitor Over Time

After making changes, compare metrics before and after:

- Run the same Test Search queries — did scores improve?
- Check chatbot satisfaction rate over the next few days
- Watch workspace analytics for trends in token usage and engagement

---

## Metrics Reference

### Pipeline Monitor Metrics

| Metric | Source | Updates |
|--------|--------|---------|
| Pages Discovered | Redis pipeline status | Real-time during processing |
| Pages Scraped | Redis pipeline status | Real-time during processing |
| Pages Failed | Redis pipeline status | Real-time during processing |
| Chunks Created | Redis pipeline status | Real-time during processing |
| Embeddings Generated | Redis pipeline status | Real-time during processing |
| Vectors Indexed | Redis pipeline status | Real-time during processing |

### KB Detail Metrics

| Metric | Source | Calculation |
|--------|--------|-------------|
| Documents | PostgreSQL `documents` table | Count of documents in KB |
| Chunks | PostgreSQL `chunks` table or Qdrant | Effective chunk count (prioritizes API total > KB total > sum of doc chunks) |
| Total Words | PostgreSQL `documents` table | Sum of `word_count` from all documents |
| Avg Chunk Size | PostgreSQL `chunks` table or document metadata | Total content size / total chunks |

### KB Analytics Metrics

| Metric | Source | Status |
|--------|--------|--------|
| Document Count | `/api/v1/kbs/{kb_id}/stats` | Active |
| Chunk Count | `/api/v1/kbs/{kb_id}/stats` | Active |
| Total Content Size | `/api/v1/kbs/{kb_id}/stats` | Active |
| Avg Chunk Size | `/api/v1/kbs/{kb_id}/stats` | Active |
| Qdrant Health | `/api/v1/kbs/{kb_id}/stats` (Qdrant API) | Active |
| Vector Count Match | `/api/v1/kbs/{kb_id}/stats` (Qdrant API) | Active |
| Index Health | Calculated from KB Ready status | Active |
| Content Types | Calculated from document data | Active |
| Chunk Distribution | Calculated from chunk data | Active |
| Total Queries | `kb_analytics_events` table | Infrastructure ready |
| Hit Rate | `kb_analytics_events` table | Infrastructure ready |
| Avg Response Time | `kb_analytics_events` table | Infrastructure ready |
| Top Queries | `kb_analytics_events` table | Infrastructure ready |
| Feedback Scores | `kb_analytics_events` table | Infrastructure ready |

### Chatbot Analytics Metrics

| Metric | Source | Status |
|--------|--------|--------|
| Widget Loads | `widget_events` table | Active |
| Widget Opens | `widget_events` table | Active |
| Total Conversations | `chat_sessions` table | Active |
| Engagement Rate | Calculated: conversations / impressions | Active |
| Total Responses | `chat_messages` table (assistant role) | Active |
| Success Rate | Calculated: successful / total responses | Active |
| Error Rate | Calculated: failed / total responses | Active |
| Positive Feedback | `chat_messages` feedback metadata | Active |
| Negative Feedback | `chat_messages` feedback metadata | Active |
| Satisfaction Rate | Calculated: positive / total feedback | Active |

### Workspace Analytics Metrics

| Metric | Source | Status |
|--------|--------|--------|
| Total Conversations | `chat_sessions` table | Active |
| Total Messages | `chat_messages` table | Active |
| Unique Visitors | Distinct `chat_sessions` IDs | Active |
| Avg Messages per Session | Calculated: messages / sessions | Active |
| Avg Response Time | `chat_messages` response metadata `latency_ms` | Active |
| Token Usage | `chat_messages` `prompt_tokens` + `completion_tokens` | Active |
| Estimated Cost | Calculated: total_tokens / 1000 × $0.002 | Active |
| Daily Trends | Aggregated by date from sessions + messages | Active |
| Chatbot Breakdown | Grouped by `bot_id` from sessions | Active |

### Test Search Metrics

| Metric | Source | Status |
|--------|--------|--------|
| Relevance Score | Qdrant similarity search | Active |
| Confidence Level | Derived from relevance score | Active |
| Processing Time | Measured during search execution | Active |
| Result Count | Search response | Active |
| AI Reasoning | Search response with `include_reasoning: true` | Active |
