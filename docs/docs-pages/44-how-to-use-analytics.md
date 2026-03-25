# Analytics and Reporting Guide

PrivexBot provides comprehensive analytics to help you understand how your chatbots perform. This guide covers all available metrics, charts, and how to interpret your data.

---

## Table of Contents

1. [Analytics Overview](#analytics-overview)
2. [Dashboard Metrics](#dashboard-metrics)
3. [Cost and Usage Tracking](#cost-and-usage-tracking)
4. [Daily Trend Charts](#daily-trend-charts)
5. [Chatbot Performance Table](#chatbot-performance-table)
6. [Feedback Summary](#feedback-summary)
7. [Time Period Filtering](#time-period-filtering)
8. [Workspace vs Organization Scope](#workspace-vs-organization-scope)
9. [Knowledge Base Analytics](#knowledge-base-analytics)
10. [Interpreting Your Data](#interpreting-your-data)
11. [Best Practices](#best-practices)

---

## Analytics Overview

Analytics help you answer key questions:

- How many people are using my chatbots?
- Are users finding the answers they need?
- Which chatbots perform best?
- How much is AI usage costing?
- What are the trends over time?

### Accessing Analytics

1. Log in to PrivexBot
2. Select your **Workspace** (or **Organization**)
3. Click **Analytics** in the sidebar

### Analytics Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Analytics Dashboard                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Conversa-│ │Messages │ │Response │ │Satisfac-│          │
│  │  tions  │ │         │ │  Time   │ │  tion   │          │
│  │  1,234  │ │  5,678  │ │  1.2s   │ │   89%   │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Daily Trends Chart                      │   │
│  │    ╭──╮                                              │   │
│  │  ╭─╯  ╰╮    ╭────╮                                  │   │
│  │ ─╯      ╰──╯    ╰─────                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Chatbot Performance                     │   │
│  │  Bot Name     │ Convos │ Msgs │ Avg Time │ Rating   │   │
│  │  Support Bot  │   456  │ 2.3k │   1.1s   │  92%    │   │
│  │  Sales Bot    │   234  │ 1.2k │   1.4s   │  85%    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Dashboard Metrics

### Primary Metrics

#### Conversations

Total unique chat sessions in the selected period.

| Metric | Description |
|--------|-------------|
| **Count** | Number of unique sessions |
| **Change** | Percentage change from previous period |
| **Trend** | Arrow indicating direction |

```
Conversations
─────────────
1,234
↑ 12% from last period
```

**What counts as a conversation:**
- Widget opened and message sent
- API session with at least one exchange
- Messaging platform thread

#### Messages

Total messages exchanged (user + bot).

| Metric | Description |
|--------|-------------|
| **Count** | Total messages sent |
| **Breakdown** | User vs bot messages |
| **Per Conversation** | Average messages per session |

```
Messages
────────
5,678 total
├── User: 2,345
└── Bot: 3,333

4.6 messages per conversation
```

#### Response Time

Average time for bot to respond.

| Metric | Description |
|--------|-------------|
| **Average** | Mean response time |
| **Median** | 50th percentile |
| **P95** | 95th percentile |

```
Response Time
─────────────
Average: 1.2s
Median:  0.9s
P95:     2.8s
```

**Factors affecting response time:**
- AI model processing
- Knowledge base retrieval
- External API calls (in chatflows)

#### Satisfaction Rate

Percentage of positive feedback.

| Metric | Description |
|--------|-------------|
| **Rate** | (Positive / Total Feedback) × 100 |
| **Total** | Number of feedback submissions |
| **Breakdown** | Positive / Negative / Neutral |

```
Satisfaction
────────────
89% positive
Based on 234 feedback submissions
├── Positive: 208
├── Negative: 15
└── Neutral: 11
```

---

## Cost and Usage Tracking

### Token Usage

AI processing is measured in tokens.

```
Token Usage (Last 30 Days)
──────────────────────────
Total Tokens: 2,456,789
├── Input: 1,234,567
└── Output: 1,222,222

Daily Average: 81,893 tokens
```

### Estimated Cost

Approximate API costs based on usage.

| Model | Rate (per 1K tokens) |
|-------|---------------------|
| Standard | ~$0.002 |
| Advanced | ~$0.008 |

```
Estimated Cost
──────────────
This Period: $4.91
├── Input: $2.47
└── Output: $2.44

Projected Monthly: $14.73
```

**Note**: Estimates based on standard pricing. Actual costs may vary.

### API Calls

Track API endpoint usage.

```
API Calls
─────────
Chat Endpoint: 5,234
Feedback Endpoint: 234
Lead Endpoint: 89
```

---

## Daily Trend Charts

### Conversations Over Time

```
Conversations (Last 30 Days)
│
│              ╭─────╮
│        ╭────╯     ╰──╮
│   ╭───╯              ╰───╮
│ ──╯                      ╰────
│
└──────────────────────────────────
  Jan 1        Jan 15         Jan 30
```

### Messages Over Time

```
Messages (Last 30 Days)
│
│    ╭──╮         ╭────╮
│  ╭─╯  ╰─╮   ╭──╯    ╰─╮
│ ─╯      ╰──╯          ╰───
│
└──────────────────────────────────
  Jan 1        Jan 15         Jan 30
```

### Chart Interactions

- **Hover**: See exact values for each day
- **Click & Drag**: Zoom into date range
- **Toggle**: Show/hide specific metrics

---

## Chatbot Performance Table

Compare performance across chatbots.

```
Chatbot Performance
───────────────────────────────────────────────────────────────────
│ Bot Name        │ Conversations │ Messages │ Avg Time │ Rating  │
├─────────────────┼───────────────┼──────────┼──────────┼─────────┤
│ Customer Support│     456       │   2,345  │   1.1s   │  92%    │
│ Sales Assistant │     234       │   1,122  │   1.4s   │  85%    │
│ FAQ Bot         │     189       │     567  │   0.8s   │  94%    │
│ Product Guide   │     156       │     789  │   1.6s   │  88%    │
└─────────────────┴───────────────┴──────────┴──────────┴─────────┘
```

### Sorting Options

Click column headers to sort:
- Conversations (high to low)
- Messages (high to low)
- Response Time (fast to slow)
- Rating (high to low)

### Drill-Down

Click a chatbot name to see:
- Individual bot analytics
- Detailed metrics
- Channel breakdown

---

## Feedback Summary

### Overview

```
Feedback Summary
────────────────
Total Submissions: 234

Distribution:
████████████████████████████░░  Positive: 89% (208)
███░░░░░░░░░░░░░░░░░░░░░░░░░░  Negative: 6% (15)
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Neutral: 5% (11)
```

### Recent Feedback

```
Recent Feedback
───────────────
┌────────────────────────────────────────────────────────┐
│ 👍 Positive - 2 hours ago                              │
│ Chatbot: Support Bot                                   │
│ "Very helpful! Solved my issue quickly."               │
├────────────────────────────────────────────────────────┤
│ 👎 Negative - 5 hours ago                              │
│ Chatbot: Sales Bot                                     │
│ "Couldn't understand my question about pricing."       │
├────────────────────────────────────────────────────────┤
│ 👍 Positive - 1 day ago                                │
│ Chatbot: FAQ Bot                                       │
│ No comment provided                                    │
└────────────────────────────────────────────────────────┘
```

### Feedback by Chatbot

```
Feedback by Chatbot
───────────────────
Support Bot:  ████████████████████░░  91% positive (89 total)
Sales Bot:    ████████████████░░░░░░  82% positive (67 total)
FAQ Bot:      █████████████████████░  96% positive (45 total)
Product Guide:██████████████████░░░░  88% positive (33 total)
```

---

## Time Period Filtering

### Available Periods

| Period | Description |
|--------|-------------|
| **Last 7 Days** | Previous week |
| **Last 30 Days** | Previous month (default) |
| **Last 90 Days** | Previous quarter |
| **Custom** | Select specific dates |

### Applying Filters

```
Time Period: [Last 30 Days ▼]

Options:
• Last 7 Days
• Last 30 Days
• Last 90 Days
• Custom Range...
```

### Custom Date Range

```
Custom Date Range
─────────────────
Start Date: [Jan 1, 2024  📅]
End Date:   [Jan 31, 2024 📅]

[  Cancel  ] [  Apply  ]
```

### Comparison Mode

Compare current period to previous:

```
Conversations
─────────────
This Period:  1,234
Last Period:  1,102
Change:       ↑ 12%
```

---

## Workspace vs Organization Scope

### Workspace Analytics

Default view—metrics for current workspace:
- All chatbots in workspace
- Workspace-specific leads
- Team-level performance

### Organization Analytics

Aggregated view across all workspaces:
- Combined metrics
- Cross-workspace comparison
- Organization-wide trends

### Switching Scope

```
Analytics Scope
───────────────
[●] Current Workspace (Marketing)
[ ] All Workspaces (Organization)
```

### Organization View Example

```
Organization Analytics
──────────────────────────────────────────────────────────
│ Workspace     │ Conversations │ Messages │ Satisfaction│
├───────────────┼───────────────┼──────────┼─────────────┤
│ Marketing     │     456       │   2,345  │    89%      │
│ Sales         │     234       │   1,122  │    85%      │
│ Support       │     567       │   3,456  │    92%      │
├───────────────┼───────────────┼──────────┼─────────────┤
│ TOTAL         │   1,257       │   6,923  │    89%      │
└───────────────┴───────────────┴──────────┴─────────────┘
```

---

## Knowledge Base Analytics

### Accessing KB Analytics

1. Go to **Knowledge Bases**
2. Select a KB
3. Click **Analytics** tab

### Available Metrics

| Metric | Description |
|--------|-------------|
| **Queries** | Total search queries |
| **Avg Score** | Average relevance score |
| **Zero Results** | Queries with no matches |
| **Top Queries** | Most common searches |

### KB Performance Dashboard

```
Knowledge Base Analytics: Product Docs
──────────────────────────────────────

Queries This Period: 2,345
Average Relevance Score: 0.84
Zero-Result Rate: 3%

Storage:
├── Documents: 45
├── Chunks: 1,234
└── Vectors: 1,234

Health: ✓ Healthy
```

### Query Analysis

```
Top Queries
───────────
1. "reset password" - 234 queries, avg score: 0.91
2. "pricing plans" - 189 queries, avg score: 0.87
3. "api documentation" - 156 queries, avg score: 0.82
4. "refund policy" - 123 queries, avg score: 0.89
5. "contact support" - 98 queries, avg score: 0.76

Zero-Result Queries:
• "warranty on electronic items" - 12 queries
• "bulk discount" - 8 queries
• "international shipping" - 5 queries
```

**Action**: Add content for zero-result queries to improve coverage.

---

## Interpreting Your Data

### What Good Looks Like

| Metric | Target | Concern |
|--------|--------|---------|
| Satisfaction | >85% | <70% |
| Response Time | <2s | >5s |
| Zero-Result Rate | <5% | >15% |
| Messages/Convo | 3-7 | >15 (maybe not resolving) |

### Warning Signs

| Pattern | Possible Issue | Action |
|---------|----------------|--------|
| High messages per conversation | Bot not answering well | Review prompts, improve KB |
| Low satisfaction | Poor response quality | Analyze negative feedback |
| High zero-result rate | KB gaps | Add missing content |
| Slow response times | Complex chatflows | Optimize flow, reduce API calls |
| Declining usage | Users abandoning | Improve UX, response quality |

### Healthy Patterns

| Pattern | Indicates |
|---------|-----------|
| Steady conversation growth | Good adoption |
| High satisfaction | Quality responses |
| Low messages/conversation | Quick resolution |
| Consistent response times | Stable performance |

---

## Best Practices

### Regular Review Schedule

| Frequency | What to Review |
|-----------|----------------|
| **Daily** | Quick health check, error spikes |
| **Weekly** | Trends, feedback themes |
| **Monthly** | Overall performance, costs |
| **Quarterly** | Strategic insights, planning |

### Acting on Data

1. **Identify Issues**
   - Low satisfaction → Review negative feedback
   - High zero-results → Add KB content
   - Slow responses → Optimize chatflows

2. **Make Changes**
   - Update prompts
   - Expand knowledge base
   - Simplify chatflow logic

3. **Measure Impact**
   - Compare before/after metrics
   - Monitor for improvements
   - Iterate as needed

### Setting Goals

```
Example Goals
─────────────
• Increase satisfaction from 85% to 90%
• Reduce response time from 2.1s to 1.5s
• Decrease zero-result rate from 8% to 3%
• Grow conversations by 20% month-over-month
```

### Reporting to Stakeholders

Export data for reports:

1. Click **Export** on any chart
2. Choose format (CSV, PNG)
3. Include in presentations

```
Weekly Chatbot Report
─────────────────────
Conversations: 1,234 (+12% WoW)
Satisfaction: 89% (stable)
Response Time: 1.2s (-0.3s improvement)
Top Issue: Password resets (23% of queries)
```

---

## Exporting Data

### Available Export Formats

| Format | Best For |
|--------|----------|
| **CSV** | Spreadsheet analysis, BI tools |
| **JSON** | Developer integrations |
| **PNG** | Charts for presentations |

### How to Export

1. Navigate to the metric/chart
2. Click the **Export** button
3. Select format
4. Download file

### API Access

For programmatic access:

```bash
curl -X GET "https://api.privexbot.com/v1/analytics/conversations" \
  -H "Authorization: Bearer $TOKEN" \
  -d "start_date=2024-01-01" \
  -d "end_date=2024-01-31"
```

---

## Next Steps

- **[Manage Chatbots](36-how-to-manage-deployed-chatbots.md)**: Optimize based on data
- **[Knowledge Base Management](37-how-to-manage-knowledge-bases.md)**: Fill content gaps
- **[Lead Management](38-how-to-manage-leads.md)**: Track lead conversion

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
