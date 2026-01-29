# Complete Guide to Creating Chatbots in PrivexBot

## Introduction

This comprehensive guide walks you through creating AI chatbots in PrivexBot—from your first login to a fully deployed, production-ready chatbot. Whether you're building a customer support bot, an FAQ assistant, or a lead capture tool, this guide covers everything you need to know.

PrivexBot chatbots are powered by **Secret AI**, a privacy-preserving AI that runs in a Trusted Execution Environment (TEE), ensuring your conversations and data remain confidential.

---

## Table of Contents

1. [Understanding PrivexBot Chatbots](#part-1-understanding-privexbot-chatbots)
2. [Before You Begin](#part-2-before-you-begin)
3. [Creating Your First Chatbot](#part-3-creating-your-first-chatbot)
4. [Step 1: Basic Information](#part-4-step-1-basic-information)
5. [Step 2: AI Configuration](#part-5-step-2-ai-configuration)
6. [Step 3: Knowledge Bases](#part-6-step-3-knowledge-bases)
7. [Step 4: Appearance & Behavior](#part-7-step-4-appearance--behavior)
8. [Step 5: Deployment](#part-8-step-5-deployment)
9. [Channel-Specific Setup](#part-9-channel-specific-setup)
10. [Best Practices](#part-10-best-practices)
11. [Common Use Cases](#part-11-common-use-cases)
12. [Troubleshooting](#part-12-troubleshooting)
13. [Advanced Configuration](#part-13-advanced-configuration)

---

## Part 1: Understanding PrivexBot Chatbots

### What Is a PrivexBot Chatbot?

A PrivexBot chatbot is an AI-powered conversational agent that can:
- Answer questions based on your knowledge bases (RAG-powered)
- Follow specific instructions and restrictions you define
- Capture leads and collect user information
- Deploy across multiple channels (website, Telegram, Discord, WhatsApp)
- Maintain conversation memory for context-aware responses

### Key Features

```
PRIVEXBOT CHATBOT CAPABILITIES:

┌─────────────────────────────────────────────────┐
│                   CHATBOT                        │
│                                                  │
│  AI Engine: Secret AI (Privacy-Preserving TEE)  │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ KNOWLEDGE BASES (RAG)                    │    │
│  │ • Multiple KBs with priority             │    │
│  │ • Semantic/hybrid/keyword search         │    │
│  │ • Citations and source attribution       │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ CONVERSATION FEATURES                    │    │
│  │ • Memory (remembers past messages)       │    │
│  │ • Follow-up question suggestions         │    │
│  │ • Conversation openers                   │    │
│  │ • Variable collection (personalization)  │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ DEPLOYMENT CHANNELS                      │    │
│  │ • Website widget                         │    │
│  │ • Telegram bot                           │    │
│  │ • Discord bot                            │    │
│  │ • WhatsApp Business                      │    │
│  │ • Direct API access                      │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Chatbot vs Chatflow

PrivexBot offers two ways to create conversational AI:

| Aspect | Chatbot | Chatflow |
|--------|---------|----------|
| **Creation Method** | 5-step form wizard | Visual drag-and-drop builder |
| **Complexity** | Simple, linear conversations | Complex branching with conditional logic |
| **Best For** | FAQ bots, support assistants | Multi-step workflows, complex routing |
| **Learning Curve** | Beginner-friendly | More advanced |

Both share the same public API endpoint and deployment channels.

### The Draft-First Architecture

PrivexBot uses a **draft-first approach** to chatbot creation:

```
CREATION LIFECYCLE:

Phase 1: DRAFT (Redis - 24 hour TTL)
├── Create draft → Draft stored in Redis
├── Configure settings → Auto-save to Redis
├── Test chatbot → Live AI testing
└── No database pollution

Phase 2: DEPLOYMENT (PostgreSQL)
├── Validate configuration
├── Save to database
├── Generate API key
├── Register webhooks
└── Chatbot goes live

Phase 3: ACTIVE (Production)
├── Receive messages
├── Process with AI
├── Track analytics
└── Collect leads
```

**Why This Matters:**
- You can experiment freely without cluttering your database
- Test your chatbot before committing
- Drafts auto-expire after 24 hours if abandoned
- No "broken" chatbots in production

---

## Part 2: Before You Begin

### Prerequisites

Before creating a chatbot, ensure you have:

1. **PrivexBot Account**
   - Sign up at privexbot.com
   - Verify your email

2. **Organization & Workspace**
   - Created automatically on signup
   - Can create additional organizations/workspaces

3. **Knowledge Base (Recommended)**
   - While optional, KBs make your chatbot much more useful
   - Can add KB content from: files, websites, Google Docs, Notion

### Planning Your Chatbot

Before diving in, answer these questions:

```
CHATBOT PLANNING CHECKLIST:

PURPOSE:
□ What problem does this chatbot solve?
□ Who will use it (customers, employees, visitors)?
□ What questions should it answer?

CONTENT:
□ Do you have documentation to upload as a KB?
□ What website content should it know about?
□ Are there specific topics it should NOT discuss?

BEHAVIOR:
□ What tone should it have (formal, friendly, professional)?
□ Should it capture leads?
□ Should it suggest follow-up questions?

DEPLOYMENT:
□ Where will it be deployed (website, Telegram, Discord)?
□ Is it public or requires API key?
□ What domains should it work on (for widget)?
```

---

## Part 3: Creating Your First Chatbot

### Step-by-Step Overview

```
CHATBOT CREATION WIZARD:

┌─────────────────────────────────────────────────┐
│  Step 1        Step 2        Step 3             │
│  ┌────┐        ┌────┐        ┌────┐             │
│  │ 🤖 │───────▶│ ✨ │───────▶│ 📚 │             │
│  │Bot │        │ AI │        │ KB │             │
│  └────┘        └────┘        └────┘             │
│  Basic         Prompt &      Knowledge          │
│  Info          AI Config     Bases              │
│                                                  │
│  Step 4        Step 5                           │
│  ┌────┐        ┌────┐                           │
│  │ 🎨 │───────▶│ 🚀 │                           │
│  │Look│        │Ship│                           │
│  └────┘        └────┘                           │
│  Appearance    Deploy                           │
│  & Behavior                                     │
└─────────────────────────────────────────────────┘
```

### Accessing the Create Page

1. Log in to PrivexBot
2. Navigate to **Chatbots** in the sidebar
3. Click **+ Create Chatbot** button

```
┌─────────────────────────────────────────────────┐
│  PrivexBot                                 👤   │
├────┬────────────────────────────────────────────┤
│    │                                            │
│ WS │  CHATBOTS                                  │
│    │                                            │
│────│  [ + Create Chatbot ]                      │
│    │         ↑                                  │
│ 🤖 │    Click here                              │
│    │                                            │
│────│  Your chatbots will appear here...         │
│    │                                            │
└────┴────────────────────────────────────────────┘
```

### Draft Creation

When you click "Create Chatbot":

```
What Happens:

1. API call: POST /api/v1/chatbots/drafts
2. Draft created in Redis (24-hour TTL)
3. Draft ID generated: draft_chatbot_{8-char-hex}
4. Redirect to: /chatbots/create/{draft_id}
5. 5-step wizard loads
```

Your progress is automatically saved as you configure each step.

---

## Part 4: Step 1 - Basic Information

### Overview

The first step collects fundamental information about your chatbot.

```
┌─────────────────────────────────────────────────┐
│  CREATE CHATBOT                                  │
│                                                  │
│  Step 1 of 5: Basic Information                 │
│  ───────────────────────────────                │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Chatbot Name *                             │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ Customer Support Bot                  │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  │ 3-100 characters                          │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Description (Optional)                     │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ Internal description for your team    │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Greeting Message (Optional)                │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ Hello! How can I help you today?      │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  │ First message users see when they open    │  │
│  │ the chat widget                           │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│                          [ Next: Prompt & AI ]  │
└─────────────────────────────────────────────────┘
```

### Field Details

| Field | Required | Validation | Purpose |
|-------|----------|------------|---------|
| **Chatbot Name** | Yes | 3-100 characters | Display name in dashboard and widget |
| **Description** | No | No limit | Internal notes for your team |
| **Greeting Message** | No | No limit | First message when users open chat |

### Best Practices for Step 1

**DO:**
- Use a clear, descriptive name that reflects the chatbot's purpose
- Add a greeting that sets expectations ("Hi! I can help with product questions.")
- Include a description for team reference

**DON'T:**
- Use generic names like "Bot 1" or "Test"
- Leave greeting empty (it sets the conversation tone)
- Make the greeting too long (keep it 1-2 sentences)

### Good Examples

```
Name: "Acme Product Support"
Greeting: "Hi there! I'm here to help with any questions about
Acme products. What would you like to know?"
Description: "Main support bot for product inquiries. Connected
to Product FAQ KB."

Name: "HR Assistant"
Greeting: "Hello! I can help you find information about company
policies, benefits, and procedures. How can I assist?"
Description: "Internal HR bot - connected to employee handbook."
```

---

## Part 5: Step 2 - AI Configuration

### Overview

This is the most important step—it defines how your chatbot thinks and behaves.

```
┌─────────────────────────────────────────────────┐
│  Step 2 of 5: Prompt & AI Configuration         │
│  ───────────────────────────────────────        │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ System Prompt *                            │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ You are a helpful customer support    │ │  │
│  │ │ assistant for Acme Inc. You help      │ │  │
│  │ │ customers with product questions,     │ │  │
│  │ │ troubleshooting, and general          │ │  │
│  │ │ inquiries. Be friendly, professional, │ │  │
│  │ │ and concise.                          │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  │ Minimum 10 characters                      │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  AI Model: Secret AI (Privacy-Preserving)       │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Temperature                                │  │
│  │ ├────────────┼────────────┤               │  │
│  │ 0          0.7          2.0               │  │
│  │ Focused    Balanced    Creative           │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Max Tokens: 2000                           │  │
│  │ Range: 100 - 8000                          │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### System Prompt

The system prompt is the foundation of your chatbot's behavior. It tells the AI who it is and how to act.

**Structure of a Good System Prompt:**

```
SYSTEM PROMPT TEMPLATE:

[IDENTITY]
You are [role] for [company/purpose].

[CAPABILITIES]
You help users with [list of things you can help with].

[KNOWLEDGE SOURCES]
You have access to [describe knowledge bases].

[BEHAVIOR]
- Be [tone: friendly, professional, casual]
- Always [key behaviors]
- Never [restrictions]

[RESPONSE FORMAT]
- Keep responses [length guideline]
- Use [formatting: bullet points, paragraphs]
- Include [citations, links, etc.]

[ESCALATION]
If you cannot help, [what to do: suggest contact support, etc.]
```

**Example System Prompts:**

```markdown
# Customer Support Bot

You are a friendly customer support assistant for TechCorp.

You help customers with:
- Product information and features
- Troubleshooting common issues
- Order status inquiries
- Return and refund policies

You have access to our product documentation and FAQ.

Guidelines:
- Be warm and helpful, but professional
- Keep responses concise (2-3 paragraphs max)
- If you don't know something, say so honestly
- For complex issues, suggest contacting support@techcorp.com

Always cite sources when using information from the knowledge base.
```

```markdown
# HR Policy Assistant

You are an internal HR assistant for Acme Corporation.

You help employees find information about:
- Company policies and procedures
- Benefits and compensation
- Time off and leave policies
- Onboarding and training

Important:
- Only answer based on official company documentation
- For sensitive topics (salary, performance), direct to HR
- Never share information about other employees
- Be helpful but maintain confidentiality
```

### Variable Insertion

You can use variables in your system prompt for personalization:

```
Variable Syntax: {{variable_name}}

Example:
"Hello {{user_name}}, welcome to our support chat!"

When the user provides their name, it gets substituted:
"Hello John, welcome to our support chat!"
```

**Available Variable Types:**
- TEXT (default)
- EMAIL
- PHONE
- NUMBER

### Temperature Setting

Temperature controls how creative/random the AI's responses are:

| Temperature | Behavior | Best For |
|-------------|----------|----------|
| **0.0 - 0.3** | Very focused, deterministic | Factual Q&A, technical support |
| **0.4 - 0.7** | Balanced (default: 0.7) | General support, most use cases |
| **0.8 - 1.2** | More varied responses | Creative writing, brainstorming |
| **1.3 - 2.0** | Highly creative/random | Experimental (rarely used) |

**Recommendation:** Start with 0.7 and adjust based on results.

### Max Tokens

Tokens control the maximum response length:

| Token Count | Approximate Length | Use Case |
|-------------|-------------------|----------|
| 500 | Short paragraph | Quick answers, FAQs |
| 1000 | 2-3 paragraphs | Standard responses |
| 2000 | 4-5 paragraphs (default) | Detailed explanations |
| 4000 | Long article | Comprehensive guides |
| 8000 | Very long | Documentation, reports |

**Recommendation:** 2000 tokens works for most use cases.

### Behavior Features

```
┌───────────────────────────────────────────────┐
│ BEHAVIOR OPTIONS                              │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ 🔗 Citations & Attributions      [ON]   │  │
│ │    Show knowledge base sources          │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ ❓ Follow-up Questions           [OFF]  │  │
│ │    Suggest related questions            │  │
│ └─────────────────────────────────────────┘  │
│                                               │
└───────────────────────────────────────────────┘
```

**Citations:** When enabled, the chatbot shows which KB documents it used:
```
"According to our return policy [1], you have 30 days to return..."

[1] Return Policy.pdf
```

**Follow-up Questions:** Suggests questions users might want to ask next.

### Conversation Openers

Pre-defined questions users can click to start a conversation:

```
┌───────────────────────────────────────────────┐
│ CONVERSATION OPENERS (max 4)                  │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ "What are your business hours?"         │  │
│ └─────────────────────────────────────────┘  │
│ ┌─────────────────────────────────────────┐  │
│ │ "How do I track my order?"              │  │
│ └─────────────────────────────────────────┘  │
│ ┌─────────────────────────────────────────┐  │
│ │ "What's your return policy?"            │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ [ + Add Opener ]                             │
└───────────────────────────────────────────────┘
```

**Best Practices:**
- Use your most common questions
- Keep them short and clear
- Maximum 4 openers

### Instructions

Specific behaviors the AI should follow:

```
┌───────────────────────────────────────────────┐
│ INSTRUCTIONS                                  │
│                                               │
│ ┌───────────────────────────────────────┐    │
│ │ [✓] Always greet users by name if     │    │
│ │     provided                          │    │
│ └───────────────────────────────────────┘    │
│ ┌───────────────────────────────────────┐    │
│ │ [✓] Use bullet points for lists       │    │
│ └───────────────────────────────────────┘    │
│ ┌───────────────────────────────────────┐    │
│ │ [✓] Always include relevant product   │    │
│ │     links when discussing features    │    │
│ └───────────────────────────────────────┘    │
│                                               │
│ [ + Add Instruction ]                        │
└───────────────────────────────────────────────┘
```

Instructions can be toggled on/off individually.

### Restrictions

Things the AI should NOT do:

```
┌───────────────────────────────────────────────┐
│ RESTRICTIONS                                  │
│                                               │
│ ┌───────────────────────────────────────┐    │
│ │ [✓] Never discuss competitor products │    │
│ └───────────────────────────────────────┘    │
│ ┌───────────────────────────────────────┐    │
│ │ [✓] Do not provide legal or medical   │    │
│ │     advice                            │    │
│ └───────────────────────────────────────┘    │
│ ┌───────────────────────────────────────┐    │
│ │ [✓] Never share internal pricing or   │    │
│ │     discount codes                    │    │
│ └───────────────────────────────────────┘    │
│                                               │
│ [ + Add Restriction ]                        │
└───────────────────────────────────────────────┘
```

### Variables Configuration

Collect information from users to personalize responses:

```
┌───────────────────────────────────────────────┐
│ VARIABLES                                     │
│                                               │
│ Collect information from users for            │
│ personalized responses                        │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ user_name                               │  │
│ │ Type: TEXT                              │  │
│ │ Label: "What's your name?"              │  │
│ │                                  [🗑️]   │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ company                                 │  │
│ │ Type: TEXT                              │  │
│ │ Label: "Company name"                   │  │
│ │                                  [🗑️]   │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ [ + Add Variable ]                           │
└───────────────────────────────────────────────┘
```

Use variables in your prompt: `"Hello {{user_name}} from {{company}}!"`

---

## Part 6: Step 3 - Knowledge Bases

### Overview

Knowledge bases power your chatbot with RAG (Retrieval-Augmented Generation), allowing it to answer questions based on your actual content.

```
┌─────────────────────────────────────────────────┐
│  Step 3 of 5: Knowledge Bases                   │
│  ────────────────────────────────               │
│                                                  │
│  ATTACHED KNOWLEDGE BASES (2)                   │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 📚 Product Documentation           [ON]   │  │
│  │    Priority: 1                            │  │
│  │    45 documents • 1,234 chunks            │  │
│  │    Model: all-MiniLM-L6-v2               │  │
│  │                              [Detach]     │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 📚 FAQ Collection                  [ON]   │  │
│  │    Priority: 2                            │  │
│  │    12 documents • 89 chunks               │  │
│  │    Model: all-MiniLM-L6-v2               │  │
│  │                              [Detach]     │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  AVAILABLE KNOWLEDGE BASES                      │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 📚 Company Policies                       │  │
│  │    8 documents • 156 chunks               │  │
│  │                              [Attach]     │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  No KBs? [ Create Knowledge Base ]              │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Why Use Knowledge Bases?

Without KB:
```
User: "What's your return policy?"
Bot: "I don't have specific information about return policies.
     Please contact customer support."
```

With KB:
```
User: "What's your return policy?"
Bot: "You can return any item within 30 days of purchase for a
     full refund. Items must be in original packaging. [1]

     [1] Return Policy.pdf"
```

### Attaching Knowledge Bases

1. **From Available KBs:** Click "Attach" on any ready KB
2. **Priority:** Higher priority KBs are searched first
3. **Enable/Disable:** Toggle KBs on/off without detaching
4. **Detach:** Remove KB from chatbot completely

### How RAG Works

```
RAG (Retrieval-Augmented Generation) Flow:

User Message: "How do I reset my password?"
         ↓
┌─────────────────────────────────────────────────┐
│ 1. RETRIEVE                                      │
│    Search knowledge bases for relevant content   │
│    • Semantic search (meaning-based)            │
│    • Hybrid search (semantic + keyword)         │
│    • Returns top_k most relevant chunks         │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ 2. AUGMENT                                       │
│    Add retrieved content to AI prompt           │
│    "Based on this context: [retrieved content]" │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ 3. GENERATE                                      │
│    AI generates response using context          │
│    Includes citations if enabled                │
└─────────────────────────────────────────────────┘
         ↓
Response: "To reset your password, go to Settings >
Security > Reset Password. [1]"
```

### Grounding Modes

How strictly the chatbot sticks to KB content:

| Mode | Behavior | Best For |
|------|----------|----------|
| **Strict** | Only answers from KB content | Compliance, legal, accuracy-critical |
| **Guided** | Prefers KB, can enhance with AI | Most use cases (default) |
| **Flexible** | Uses KB to enhance AI knowledge | Creative, exploratory chats |

**Recommendation:** Use "Guided" for most chatbots.

### Best Practices for KBs

**DO:**
- Keep KB content up-to-date
- Use clear, well-structured documents
- Prioritize most relevant KBs higher
- Enable citations for transparency

**DON'T:**
- Attach too many KBs (slows down responses)
- Mix unrelated content in one KB
- Forget to update KBs when policies change

---

## Part 7: Step 4 - Appearance & Behavior

### Overview

Customize how your chatbot looks and behaves in the widget.

```
┌─────────────────────────────────────────────────┐
│  Step 4 of 5: Appearance & Behavior             │
│  ───────────────────────────────────            │
│                                                  │
│  APPEARANCE                                     │
│  ┌───────────────────────────────────────────┐  │
│  │ Primary Color     Secondary Color         │  │
│  │ ┌─────────┐       ┌─────────┐            │  │
│  │ │ #3b82f6 │       │ #8b5cf6 │            │  │
│  │ └─────────┘       └─────────┘            │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Font Family                                │  │
│  │ ┌───────────────────────────────────┐     │  │
│  │ │ Inter (Recommended)            ▼  │     │  │
│  │ └───────────────────────────────────┘     │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Bubble Style                               │  │
│  │ ○ Rounded (default)  ○ Square             │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Widget Position                            │  │
│  │ ○ Bottom Right (default)  ○ Bottom Left   │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Color Configuration

| Setting | Default | Purpose |
|---------|---------|---------|
| **Primary Color** | #3b82f6 (Blue) | Main brand color, buttons, links |
| **Secondary Color** | #8b5cf6 (Purple) | Accents, highlights |

**Tip:** Match your brand colors for a consistent experience.

### Memory Settings

```
┌───────────────────────────────────────────────┐
│ MEMORY                                        │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ Conversation Memory              [ON]   │  │
│ │ Remember previous messages              │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ Max Messages to Remember: 20            │  │
│ │ ├──────────────┼──────────────┤        │  │
│ │ 5            20              50         │  │
│ └─────────────────────────────────────────┘  │
│                                               │
└───────────────────────────────────────────────┘
```

| Setting | Range | Default | Purpose |
|---------|-------|---------|---------|
| **Memory Enabled** | On/Off | On | Remember conversation context |
| **Max Messages** | 5-50 | 20 | How many messages to remember |

**Trade-offs:**
- More messages = better context, slower responses, more tokens
- Fewer messages = faster, but may lose context

### Lead Capture Settings

```
┌───────────────────────────────────────────────┐
│ LEAD CAPTURE                                  │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ Enable Lead Capture              [ON]   │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ TIMING                                       │
│ ○ Before Chat (show form first)              │
│ ● After 3 messages (default)                 │
│                                               │
│ STANDARD FIELDS                              │
│ ┌─────────────────────────────────────────┐  │
│ │ Email:  ● Required ○ Optional ○ Hidden  │  │
│ │ Name:   ○ Required ● Optional ○ Hidden  │  │
│ │ Phone:  ○ Required ○ Optional ● Hidden  │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ CUSTOM FIELDS                                │
│ [ + Add Custom Field ]                       │
│                                               │
│ CONSENT                                      │
│ ┌─────────────────────────────────────────┐  │
│ │ Require consent               [ON]      │  │
│ │ "I agree to the privacy policy..."      │  │
│ └─────────────────────────────────────────┘  │
│                                               │
└───────────────────────────────────────────────┘
```

**Lead Capture Options:**

| Setting | Options | Description |
|---------|---------|-------------|
| **Timing** | Before Chat, After N Messages | When to show form |
| **Email** | Required/Optional/Hidden | Email field visibility |
| **Name** | Required/Optional/Hidden | Name field visibility |
| **Phone** | Required/Optional/Hidden | Phone field visibility |
| **Custom Fields** | Text/Email/Phone/Select | Additional fields |
| **Consent** | On/Off | GDPR compliance checkbox |

---

## Part 8: Step 5 - Deployment

### Overview

The final step—choose where to deploy your chatbot.

```
┌─────────────────────────────────────────────────┐
│  Step 5 of 5: Deploy                            │
│  ────────────────                               │
│                                                  │
│  DEPLOYMENT CHANNELS                            │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 🌐 Website Widget               [ON]      │  │
│  │    Embed on your website                  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ ✈️ Telegram                      [OFF]     │  │
│  │    Connect Telegram bot                   │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 🎮 Discord                       [OFF]     │  │
│  │    Add to Discord server                  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 📱 WhatsApp                      [OFF]     │  │
│  │    Connect WhatsApp Business              │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 🔌 API                           [ON]      │  │
│  │    Direct API access                      │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│                                                  │
│  [ Test Preview ]      [ Deploy Chatbot ]       │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Testing Before Deployment

Always test your chatbot before deploying!

```
TEST PREVIEW:

┌───────────────────────────────────────────────┐
│  Test your chatbot                            │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 🤖 Hello! How can I help you today?     │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 👤 What's your return policy?           │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 🤖 Our return policy allows you to      │ │
│  │    return items within 30 days...       │ │
│  │    [1] Return Policy.pdf                │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌───────────────────────────────────────┐   │
│  │ Type a test message...             📤  │   │
│  └───────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

### Deploying

Click "Deploy Chatbot" when ready:

```
What Happens:

1. Validate all configuration
2. Save to PostgreSQL database
3. Generate API key (shown only once!)
4. Register webhooks for enabled channels
5. Delete Redis draft
6. Redirect to chatbot detail page

IMPORTANT: Copy your API key immediately!
It's only shown once for security.
```

### Post-Deployment Response

```json
{
  "status": "deployed",
  "chatbot_id": "cb-uuid-here",
  "api_key": "sk_live_xxxxxxxxxxxxxxxxxx",  // COPY THIS NOW!
  "api_key_prefix": "sk_live_xxx...",
  "channels": {
    "website": {
      "enabled": true,
      "embed_code": "<script>...</script>"
    },
    "telegram": {
      "enabled": true,
      "bot_username": "@your_bot",
      "webhook_url": "https://..."
    }
  }
}
```

---

## Part 9: Channel-Specific Setup

### Website Widget

After deployment, embed the widget on your website:

```html
<!-- Add to your website before </body> -->
<script src="https://cdn.privexbot.com/widget.js"></script>
<script>
  pb('init', {
    id: 'your-chatbot-id',
    apiKey: 'sk_live_your_api_key',
    options: {
      position: 'bottom-right',
      greeting: 'Hi! How can I help?'
    }
  });
</script>
```

**Widget Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `position` | string | "bottom-right" | Widget position |
| `greeting` | string | - | Welcome message |
| `color` | string | "#3b82f6" | Primary color |
| `botName` | string | - | Display name |
| `showBranding` | boolean | true | Show "Powered by PrivexBot" |

### Telegram Bot

1. **Create Bot with BotFather:**
   - Open Telegram, search for @BotFather
   - Send `/newbot`
   - Follow prompts to name your bot
   - Copy the bot token

2. **Store Credential in PrivexBot:**
   - Go to Credentials
   - Add new Telegram Bot Token credential
   - Paste your token

3. **Connect in Chatbot Settings:**
   - Enable Telegram channel
   - Select your credential
   - Webhook is registered automatically

### Discord Bot

1. **Create Discord Application:**
   - Go to https://discord.com/developers/applications
   - Create new application
   - Go to "Bot" section, add bot
   - Copy bot token

2. **Configure Permissions:**
   - Enable Message Content Intent
   - Copy Application ID and Public Key

3. **Store Credentials:**
   - Add bot token as credential
   - Configure in chatbot settings

4. **Invite Bot to Server:**
   - Use the invite URL provided after deployment
   - Server admin must authorize

### WhatsApp Business

1. **Get WhatsApp Business API Access:**
   - Apply through Meta Business Suite
   - Complete verification

2. **Configure in PrivexBot:**
   - Add access token
   - Add phone number ID
   - Add business account ID

3. **Set Webhook:**
   - In Meta settings, set webhook URL to PrivexBot's WhatsApp webhook
   - Use verification token from PrivexBot

---

## Part 10: Best Practices

### System Prompt Best Practices

**DO:**
```
✅ Be specific about the chatbot's role
✅ Define what it should and shouldn't discuss
✅ Set clear tone and personality guidelines
✅ Include escalation paths for complex issues
✅ Specify response format preferences
```

**DON'T:**
```
❌ Use vague instructions ("be helpful")
❌ Leave out important restrictions
❌ Make the prompt too long (causes confusion)
❌ Forget to handle edge cases
❌ Assume the AI knows your business context
```

### Knowledge Base Best Practices

**DO:**
```
✅ Keep content up-to-date
✅ Use clear document titles
✅ Structure content with headers
✅ Remove outdated information
✅ Test retrieval with common questions
```

**DON'T:**
```
❌ Upload massive files (split them up)
❌ Mix unrelated content in one KB
❌ Forget to update when policies change
❌ Attach too many KBs (slows responses)
❌ Use scanned images without OCR
```

### Configuration Best Practices

| Setting | Recommendation | Why |
|---------|----------------|-----|
| **Temperature** | 0.7 | Balanced responses |
| **Max Tokens** | 2000 | Sufficient for most answers |
| **Memory** | 20 messages | Good context without slowdown |
| **Grounding** | Guided | Accurate but not too rigid |
| **Citations** | On | Builds trust with users |

### Deployment Best Practices

**DO:**
```
✅ Test thoroughly before deploying
✅ Save your API key securely
✅ Monitor analytics after launch
✅ Collect feedback from users
✅ Iterate based on common questions
```

**DON'T:**
```
❌ Deploy without testing
❌ Share API keys in public repos
❌ Ignore low satisfaction scores
❌ Launch without a knowledge base
❌ Forget to monitor for issues
```

---

## Part 11: Common Use Cases

### Customer Support Bot

```
PURPOSE: Answer product questions, troubleshoot issues

CONFIGURATION:
- System Prompt: Support-focused, friendly tone
- Knowledge Bases: Product docs, FAQ, troubleshooting guides
- Temperature: 0.5 (more focused)
- Lead Capture: After 3 messages
- Memory: 20 messages

EXAMPLE PROMPT:
"You are a customer support agent for [Company]. Help customers
with product questions, troubleshooting, and order inquiries.
Be friendly and helpful. If you cannot solve an issue, suggest
contacting support@company.com."
```

### FAQ Assistant

```
PURPOSE: Answer frequently asked questions

CONFIGURATION:
- System Prompt: Concise, direct answers
- Knowledge Bases: FAQ document
- Temperature: 0.3 (very focused)
- Lead Capture: Off
- Conversation Openers: Top 4 questions

EXAMPLE PROMPT:
"You are an FAQ assistant. Provide clear, concise answers to
questions based on the FAQ document. Keep responses brief
(1-2 paragraphs). If the question isn't in the FAQ, say so."
```

### Sales Assistant

```
PURPOSE: Qualify leads, answer product questions

CONFIGURATION:
- System Prompt: Persuasive but not pushy
- Knowledge Bases: Product features, pricing (if public)
- Temperature: 0.7
- Lead Capture: Before chat (email required)
- Follow-up Questions: On

EXAMPLE PROMPT:
"You are a sales assistant for [Product]. Help visitors
understand our features and benefits. Answer questions about
pricing and capabilities. Your goal is to qualify leads and
schedule demos. Be helpful, not pushy."
```

### Internal HR Bot

```
PURPOSE: Help employees with HR questions

CONFIGURATION:
- System Prompt: Professional, confidential
- Knowledge Bases: Employee handbook, policies
- Temperature: 0.3 (accuracy critical)
- Lead Capture: Off
- Grounding Mode: Strict

EXAMPLE PROMPT:
"You are an internal HR assistant. Help employees find
information about company policies, benefits, and procedures.
Only answer based on official documentation. For sensitive
topics, direct to HR. Never share information about other
employees."
```

### Documentation Helper

```
PURPOSE: Navigate technical documentation

CONFIGURATION:
- System Prompt: Technical, precise
- Knowledge Bases: Technical docs, API reference
- Temperature: 0.3
- Citations: On
- Lead Capture: Off

EXAMPLE PROMPT:
"You are a documentation assistant. Help developers find
information in our technical documentation. Provide code
examples when relevant. Always cite the source document.
If you're not sure, say so rather than guessing."
```

---

## Part 12: Troubleshooting

### Chatbot Not Responding

```
SYMPTOMS:
- Widget shows but no responses
- API returns errors
- Long delays

SOLUTIONS:

1. Check chatbot status (is it ACTIVE?)
   └── Settings > Status should be "Active"

2. Verify API key is correct
   └── Keys are shown only once; regenerate if lost

3. Check knowledge base status
   └── All attached KBs should be "Ready"

4. Test in draft mode
   └── Use Test Preview to isolate issues

5. Check rate limits
   └── Too many requests may trigger limits
```

### Poor Quality Responses

```
SYMPTOMS:
- Generic, unhelpful answers
- Doesn't use KB content
- Wrong information

SOLUTIONS:

1. Review system prompt
   └── Is it specific enough?
   └── Does it mention KB usage?

2. Check KB attachment
   └── Is the right KB attached?
   └── Is it enabled?

3. Test KB retrieval
   └── Ask questions you know are in the KB

4. Adjust grounding mode
   └── Try "Strict" if ignoring KB
   └── Try "Guided" if too rigid

5. Lower temperature
   └── Reduce to 0.3-0.5 for accuracy
```

### Widget Not Loading

```
SYMPTOMS:
- Widget doesn't appear
- JavaScript errors in console
- Blocked by browser

SOLUTIONS:

1. Check embed code
   └── Is the script tag correct?
   └── Is the chatbot ID right?

2. Verify domain
   └── Is your domain allowed?
   └── Check CORS settings

3. Check browser console
   └── Look for JavaScript errors
   └── Check network tab for blocked requests

4. Test in incognito
   └── Rules out browser extensions
```

### Telegram/Discord Not Working

```
SYMPTOMS:
- Bot doesn't respond
- Webhook errors
- Connection failed

SOLUTIONS:

1. Verify bot token
   └── Is the credential correct?
   └── Has it been revoked?

2. Check webhook registration
   └── View webhook status in settings

3. Verify bot permissions
   └── Telegram: Make sure bot can receive messages
   └── Discord: Message Content Intent enabled?

4. Re-register webhook
   └── Sometimes webhooks need refresh
```

### Lead Capture Issues

```
SYMPTOMS:
- Form not showing
- Leads not saved
- Validation errors

SOLUTIONS:

1. Check lead capture settings
   └── Is it enabled?
   └── Is timing set correctly?

2. Verify required fields
   └── Are field validations too strict?

3. Test the flow
   └── Walk through as a user would

4. Check consent settings
   └── Is consent required but not configured?
```

---

## Part 13: Advanced Configuration

### API Direct Access

For custom integrations, use the public API directly:

```bash
# Send a message
curl -X POST "https://api.privexbot.com/api/v1/public/bots/{bot_id}/chat" \
  -H "Authorization: Bearer sk_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is your return policy?",
    "session_id": "user-session-123",
    "metadata": {
      "user_name": "John",
      "email": "john@example.com"
    }
  }'
```

**Response:**
```json
{
  "response": "Our return policy allows you to return items within 30 days...",
  "sources": [
    {
      "chunk_id": "uuid",
      "document_id": "uuid",
      "document_title": "Return Policy.pdf",
      "content": "...",
      "score": 0.95
    }
  ],
  "session_id": "user-session-123",
  "message_id": "uuid"
}
```

### Custom Retrieval Settings

Override default retrieval per KB:

```json
{
  "knowledge_bases": [
    {
      "kb_id": "uuid",
      "enabled": true,
      "priority": 1,
      "retrieval_override": {
        "top_k": 5,
        "score_threshold": 0.7,
        "strategy": "hybrid_search"
      }
    }
  ]
}
```

**Retrieval Strategies:**
| Strategy | Description | Best For |
|----------|-------------|----------|
| `semantic_search` | Vector similarity | General use |
| `hybrid_search` | Vector + keyword | Most accurate (default) |
| `keyword_search` | Text matching | Exact matches |
| `mmr` | Maximum Marginal Relevance | Diverse results |

### Webhook Events

Listen for chatbot events via webhooks:

```json
// Message received
{
  "event": "message.received",
  "chatbot_id": "uuid",
  "session_id": "uuid",
  "message": "User question",
  "timestamp": "2026-01-28T12:00:00Z"
}

// Lead captured
{
  "event": "lead.captured",
  "chatbot_id": "uuid",
  "session_id": "uuid",
  "lead": {
    "email": "john@example.com",
    "name": "John Doe"
  },
  "timestamp": "2026-01-28T12:00:00Z"
}
```

### Analytics API

Retrieve chatbot analytics programmatically:

```bash
# Get analytics
curl "https://api.privexbot.com/api/v1/chatbots/{chatbot_id}/analytics" \
  -H "Authorization: Bearer sk_live_your_api_key"
```

**Response:**
```json
{
  "total_conversations": 1234,
  "total_messages": 5678,
  "avg_conversation_length": 4.6,
  "avg_response_time_ms": 850,
  "user_satisfaction": 4.2,
  "conversations_by_day": [...]
}
```

---

## Summary

### Quick Start Checklist

```
□ 1. Create Knowledge Base (recommended)
     Upload your FAQ, docs, or website content

□ 2. Create Chatbot
     Navigate to Chatbots > Create Chatbot

□ 3. Configure Basic Info
     Name, description, greeting message

□ 4. Set Up AI Configuration
     System prompt, temperature, instructions

□ 5. Attach Knowledge Bases
     Connect your KB for accurate answers

□ 6. Customize Appearance
     Colors, position, lead capture

□ 7. Test Preview
     Send test messages to verify behavior

□ 8. Deploy
     Select channels and deploy

□ 9. Embed Widget
     Add to your website

□ 10. Monitor & Improve
     Track analytics, collect feedback
```

### Key Settings Reference

| Setting | Default | Recommended |
|---------|---------|-------------|
| Temperature | 0.7 | 0.3-0.7 depending on use |
| Max Tokens | 2000 | 2000 for most cases |
| Memory | 20 messages | 10-20 for balance |
| Grounding | Guided | Guided or Strict |
| Citations | Off | On for transparency |

### Need Help?

- **Documentation:** docs.privexbot.com
- **Support:** support@privexbot.com
- **Community:** Discord server
- **API Reference:** api.privexbot.com/docs

---

*This guide covers PrivexBot chatbot creation as of January 2026. Features and UI may vary in future versions.*
