# System Prompting Guide

Learn how to configure your chatbot so it answers end-user questions accurately using the Knowledge Base you've attached. This guide walks through every configuration option using one concrete example: **a help center chatbot for a SaaS product**.

---

## Table of Contents

1. [Introduction](#introduction)
2. [The Example We'll Use](#the-example-well-use)
3. [System Prompt Basics](#system-prompt-basics)
4. [Built-in Templates](#built-in-templates)
5. [Persona Configuration](#persona-configuration)
6. [Instructions](#instructions)
7. [Restrictions](#restrictions)
8. [Opening Greeting](#opening-greeting)
9. [Variable Collection](#variable-collection)
10. [AI Model Settings](#ai-model-settings)
11. [Behavior Features](#behavior-features)
12. [Knowledge Base Usage Modes](#knowledge-base-usage-modes)
13. [How It All Works Together](#how-it-all-works-together)
14. [Putting It All Together: Complete Configuration](#putting-it-all-together-complete-configuration)
15. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is a System Prompt?

A system prompt is the foundational instruction set that defines how your chatbot behaves when answering user questions. It tells the AI:

- **Who it is** - Its name, role, and personality
- **How to answer** - Using your Knowledge Base content, not general knowledge
- **How to respond** - Tone, style, and format
- **What to avoid** - Topics and behaviors to restrict

### The Core Pattern

Every PrivexBot chatbot follows the same fundamental pattern:

```
End User asks a question
        │
        v
AI searches your Knowledge Base for relevant content
        │
        v
AI generates an answer grounded in that content
        │
        v
System prompt controls HOW that answer is delivered
```

The system prompt doesn't decide *what* content the AI uses — your Knowledge Base does that. The system prompt controls *how* the AI presents that content: tone, format, boundaries, and behavior when it can't find an answer.

### Why System Prompting Matters

| Good System Prompting | Poor System Prompting |
|----------------------|----------------------|
| Answers from your KB content | Hallucinated or generic answers |
| Consistent voice and tone | Unpredictable personality |
| Admits when it doesn't know | Makes up answers to fill gaps |
| Stays on topic | Wanders into unrelated areas |
| Formats responses helpfully | Wall-of-text or choppy replies |

---

## The Example We'll Use

Throughout this guide, we'll configure a single chatbot step by step:

**Scenario:** You run **Acme Workspace**, a project management SaaS tool. You've built a Knowledge Base from your documentation site (`docs.acmeworkspace.com`) covering:

- Getting started guides
- Feature explanations (boards, tasks, automations, integrations)
- Billing and account management
- API reference
- Troubleshooting articles

You want to embed a chatbot on your website that answers customer questions using this documentation.

**By the end of this guide**, you'll have a fully configured chatbot that:
- Answers questions using your docs content
- Speaks in your brand voice
- Knows what it can and can't answer
- Handles edge cases gracefully
- Suggests related topics from your KB

---

## System Prompt Basics

The system prompt is the main text box where you define your chatbot's core identity and behavior.

### Location in the UI

1. Go to **Chatbots** in your dashboard
2. Click **Create Chatbot** or edit an existing one
3. Navigate to **Step 2: Prompt & AI**
4. Find the **System Prompt** textarea

### Writing a KB-Grounded System Prompt

The key difference from a general chatbot: **your prompt must direct the AI to answer from your Knowledge Base, not from its general training data.**

**Structure your prompt with these sections:**

```
You are [Name], a [role] for [Product/Company].

Your job:
- Answer user questions using the documentation provided to you
- [Specific responsibilities]

How to answer:
- [Tone and formatting rules]
- [When to use bullet points, code blocks, etc.]

When you can't find an answer:
- [What to say]
- [Where to direct them]
```

### Our Example: First Draft

```
You are Ava, a help center assistant for Acme Workspace.

Your job:
- Answer user questions about Acme Workspace using the documentation
  provided to you
- Help users understand features, billing, integrations, and
  troubleshooting steps
- Guide users through setup and configuration

How to answer:
- Use a friendly, helpful tone
- Keep answers concise — 2-3 paragraphs max unless the topic is complex
- Use bullet points for multi-step instructions
- Include specific feature names and menu paths when relevant
  (e.g., "Go to Settings > Integrations > Slack")

When you can't find an answer in the documentation:
- Say: "I don't have specific documentation on that topic."
- Suggest they check the help center at help.acmeworkspace.com
- Offer to help with a related topic you do have docs for
```

### Best Practices

| Do | Don't |
|-----|-------|
| Reference the Knowledge Base explicitly | Assume the AI knows to use it |
| Define what to do when no KB match | Leave "I don't know" behavior undefined |
| Specify answer format (bullets, paragraphs) | Let the AI choose its own format |
| Name specific topics the bot covers | Say "answer any question" |
| Include menu paths and UI references | Give vague directions |

---

## Built-in Templates

PrivexBot provides 5 pre-built templates to help you get started. For a KB-grounded chatbot, the most relevant are **Customer Support** and **FAQ Assistant**.

### How to Use Templates

1. In the System Prompt section, click the **Choose a template...** dropdown
2. Select a template
3. The template text will populate the system prompt field
4. Customize placeholders like `{company_name}` with your actual values
5. **Add KB-specific instructions** (templates are generic starting points)

### Recommended Templates for KB Chatbots

#### Customer Support (Good Starting Point)

```
You are a helpful customer support assistant for {company_name}.

Your role:
- Answer questions about our products and services
- Help troubleshoot common issues
- Be polite, professional, and empathetic
- If you don't know something, admit it and offer to escalate

Guidelines:
- Keep responses concise and actionable
- Use bullet points for step-by-step instructions
- Always confirm understanding before proceeding
```

**What to add for KB grounding:**
```
Important:
- Only answer from the documentation provided to you
- Do not guess or make up features that aren't documented
- When referencing a feature, use the exact name from the docs
```

#### FAQ Assistant (Best Fit for KB Chatbots)

```
You are an FAQ assistant for {company_name}.

Your role:
- Answer common questions accurately
- Refer to knowledge base when needed
- Keep answers brief and clear
- Provide links for more details

If question is outside your knowledge:
- Acknowledge the question
- Offer to connect them with a human
- Ask if there's anything else you can help with
```

**What to add for KB grounding:**
```
Important:
- Your answers should come from the documentation provided to you
- If the answer isn't in the docs, say so honestly
- Suggest related topics you do have documentation for
```

### Other Templates (Less Common for KB Chatbots)

| Template | When It Applies |
|----------|-----------------|
| Sales Assistant | If your KB contains product/pricing content and the bot qualifies leads |
| Technical Support | If your KB is API docs or developer documentation |
| Lead Qualifier | If the bot's primary goal is collecting info, not answering questions |

### Customizing for Our Example

Starting from the FAQ Assistant template and customizing:

```
You are Ava, an FAQ and help center assistant for Acme Workspace.

Your role:
- Answer questions about Acme Workspace features, billing, integrations,
  and troubleshooting using the documentation provided to you
- Keep answers brief, clear, and actionable
- Reference specific UI elements and menu paths when giving instructions

If a question isn't covered in the documentation:
- Say: "I don't have documentation on that specific topic."
- Suggest they visit help.acmeworkspace.com or contact support@acmeworkspace.com
- Offer to help with a related topic

Do not:
- Make up features or capabilities not in the documentation
- Provide information about pricing unless it's in the docs
- Guess at answers when unsure
```

---

## Persona Configuration

The persona adds a consistent identity layer on top of your system prompt.

### Persona Elements

| Element | Description | Our Example |
|---------|-------------|-------------|
| **Name** | The chatbot's display name | "Ava" |
| **Role** | What users see as the bot's title | "Help Center Assistant" |
| **Tone** | Communication style | "friendly" |

### Available Tones

| Tone | Effect on KB Answers | Best For |
|------|---------------------|----------|
| **Professional** | Formal phrasing, structured answers | Enterprise products, B2B |
| **Friendly** | Warm, approachable explanations | Consumer products, SaaS |
| **Casual** | Relaxed, conversational | Community tools, creative products |
| **Formal** | Proper, precise language | Legal, financial, healthcare |

### How Persona Affects KB Answers

The same KB content about password resets, delivered in different tones:

**Friendly:**
```
Sure! To reset your password, head over to Settings > Account > Security
and click "Change Password." You'll get an email to confirm.
```

**Professional:**
```
To reset your password, navigate to Settings > Account > Security and
select "Change Password." A confirmation email will be sent to your
registered address.
```

**Casual:**
```
No problem — just go to Settings > Account > Security, hit
"Change Password," and check your email for the reset link.
```

The content is identical (from your KB). The persona controls how it's delivered.

### Our Example Configuration

- **Name:** Ava
- **Role:** Help Center Assistant
- **Tone:** Friendly

---

## Instructions

Instructions are specific behaviors the AI should follow. They appear in the system prompt as numbered rules.

### Location in the UI

1. Navigate to **Step 2: Prompt & AI** in the chatbot creation wizard
2. Scroll to the **Instructions** section (green checkmark icon)
3. Add instructions in the input field
4. Press Enter or click the **+** button to add

### How Instructions Work

Instructions you add are included in the AI's system prompt as:

```
INSTRUCTIONS:
1. Always use the exact feature names from the documentation
2. Include menu paths when explaining how to do something
3. If a question has multiple possible answers, ask which scenario applies
```

### Enabling/Disabling Instructions

Each instruction has a toggle switch:
- **Enabled** (switch on) - Instruction is active
- **Disabled** (switch off) - Instruction is temporarily ignored (shown with strikethrough)

This lets you test different behaviors without deleting instructions.

### Instructions for KB-Grounded Chatbots

These instructions help the AI use your Knowledge Base content effectively:

#### Answering from the KB

- "Always use the exact feature names and terminology from the documentation"
- "Include specific menu paths when explaining steps (e.g., Settings > Integrations)"
- "When the documentation includes numbered steps, present them as a numbered list"
- "If the docs cover a topic in multiple articles, summarize the key points and mention that more detail is available"

#### Handling Ambiguity

- "If a question could relate to multiple features, ask the user to clarify before answering"
- "When a feature has changed between plan tiers, ask which plan the user is on"
- "If a question is unclear, rephrase what you think they're asking and confirm"

#### Response Quality

- "Keep answers under 150 words unless the topic requires detailed steps"
- "Use code blocks when showing API examples or configuration snippets"
- "End troubleshooting answers with: 'Did that resolve your issue?'"

### Our Example Instructions

```
Instructions added:
1. ✅ "Use exact feature names from the documentation (e.g., 'Board View',
       not 'the board thing')"
2. ✅ "Include menu paths: Settings > [Section] > [Option]"
3. ✅ "If a question could apply to multiple plans (Free, Pro, Enterprise),
       ask which plan they're on"
4. ✅ "For troubleshooting, present steps as numbered lists"
5. ✅ "End troubleshooting answers with 'Did that resolve your issue?'"
```

### Instruction Best Practices

| Do | Don't |
|-----|-------|
| Reference KB content structure | Write generic behavior rules |
| Be specific ("use exact feature names") | Be vague ("be helpful") |
| Limit to 5-8 key instructions | Add 15+ instructions (overwhelms AI) |
| Focus on how to present KB content | Try to control what content to use |

---

## Restrictions

Restrictions define what the AI should NOT do. For KB chatbots, these prevent the AI from going outside its documentation boundaries.

### Location in the UI

1. Navigate to **Step 2: Prompt & AI** in the chatbot creation wizard
2. Scroll to the **Restrictions** section (red warning icon)
3. Add restrictions in the input field
4. Press Enter or click the **+** button to add

### How Restrictions Work

Restrictions you add appear in the system prompt as:

```
RESTRICTIONS - Do NOT do the following:
- Never invent features or capabilities not in the documentation
- Do not provide legal or financial advice
- Never share internal roadmap or unreleased features
```

### Enabling/Disabling Restrictions

Like instructions, each restriction has a toggle:
- **Enabled** (switch on) - Restriction is enforced
- **Disabled** (switch off) - Restriction is temporarily ignored

### Restrictions for KB-Grounded Chatbots

#### Preventing Hallucination

- "Never invent features, settings, or menu options that aren't in the documentation"
- "Do not describe how a feature works if it's not documented — say you don't have that info"
- "Never guess at pricing, limits, or quotas unless they're explicitly in the docs"

#### Staying On Topic

- "Do not answer questions unrelated to Acme Workspace (e.g., weather, news, general knowledge)"
- "Do not compare Acme Workspace to competitor products"
- "Do not discuss internal company operations, team members, or roadmap"

#### Safety and Compliance

- "Never provide legal, financial, or medical advice"
- "Do not ask for or store sensitive information like passwords or payment details"
- "Never promise specific outcomes, SLAs, or guarantees not stated in the documentation"

### Our Example Restrictions

```
Restrictions added:
1. ✅ "Never invent features or settings not in the documentation"
2. ✅ "Do not answer questions unrelated to Acme Workspace"
3. ✅ "Do not compare our product to competitors"
4. ✅ "Never share pricing unless it's in the docs — direct to acmeworkspace.com/pricing"
5. ✅ "Do not promise features on our roadmap or discuss unreleased capabilities"
```

### Restriction Best Practices

| Do | Don't |
|-----|-------|
| Explicitly prevent hallucination | Assume the AI won't make things up |
| Define topic boundaries | Say "only answer relevant questions" |
| Cover legal/compliance needs | Skip regulatory restrictions |
| Block competitor comparisons | Allow open-ended discussions |

---

## Opening Greeting

The greeting is the first message users see when they open the chat widget. For a KB chatbot, it should set expectations about what the bot knows.

### Location in the UI

1. Navigate to **Step 1: Basic Info** in the chatbot creation wizard
2. Find the **Greeting Message** field
3. Enter your welcome message

### Default Greeting

```
Hello! How can I help you today?
```

This is too generic for a KB chatbot. Users won't know what the bot can answer.

### Writing a KB-Aware Greeting

A good greeting for a KB chatbot should:

1. Identify the bot and its purpose
2. Tell users what topics it covers
3. Set expectations about its knowledge source
4. Optionally suggest what to ask

### Our Example Greeting

```
Hi! I'm Ava, your Acme Workspace help assistant. I can answer questions about:

- Features and how to use them
- Account and billing
- Integrations and API
- Troubleshooting common issues

Ask me anything about Acme Workspace!
```

### More Greeting Examples

#### Minimal (Documentation-Heavy Products)
```
Hi! I can help you find answers from our documentation.
What would you like to know about [Product Name]?
```

#### Detailed (Products with Many Features)
```
Welcome! I'm here to help with [Product Name]. I have access to our
complete documentation including setup guides, feature explanations,
API reference, and troubleshooting.

What can I help you with?
```

#### Focused (Support-Oriented)
```
Hello! Need help with [Product Name]? I can walk you through
features, fix common issues, or explain your account options.
If I can't help, I'll connect you with our support team.
```

### Greeting Best Practices

| Do | Don't |
|-----|-------|
| List specific topics the bot covers | Say "I can help with anything" |
| Mention the knowledge source exists | Imply the bot has unlimited knowledge |
| Set realistic expectations | Overpromise capabilities |
| Suggest topics to get users started | Leave users guessing what to ask |

---

## Variable Collection

Variables let you collect information from users before the chat begins, then use it to personalize how KB answers are delivered.

### What Are Variables?

Variables are placeholders in your system prompt that get replaced with user-provided values:

```
System prompt: "The user is on the {{plan_name}} plan."

After collection: "The user is on the Pro plan."
```

For KB chatbots, variables help the AI give more relevant answers from the same documentation.

### Enabling Variable Collection

1. Navigate to **Step 2: Prompt & AI**
2. Scroll to the **Variable Collection** section (gear icon)
3. Toggle the switch to enable
4. Add your variables

### Creating Variables

For each variable, you'll configure:

| Field | Description | Example |
|-------|-------------|---------|
| **Variable Name** | The placeholder name (no spaces, alphanumeric + underscore) | `plan_name`, `user_role` |
| **Display Label** | What users see in the form | "Your Plan", "Your Role" |
| **Type** | Input validation type | text, email, phone, number |

### Variable Types

| Type | Description | Validation |
|------|-------------|------------|
| **Text** | Any text input | None |
| **Email** | Email address | Must be valid email format |
| **Phone** | Phone number | Numeric with formatting |
| **Number** | Numeric value | Numbers only |

### Variables Useful for KB Chatbots

Unlike sales bots that collect lead info, KB chatbots use variables to **filter and tailor KB responses**:

| Variable | Purpose | How It Helps |
|----------|---------|--------------|
| `plan_name` | User's subscription plan | Avoids showing features they can't use |
| `user_role` | Admin, member, viewer | Tailors instructions to their permissions |
| `setup_stage` | New user, existing, migrating | Prioritizes relevant docs |
| `user_name` | Personalization | Friendlier responses |

### Using Variables in Your Prompt

**Syntax:** `{{variable_name}}`

### Our Example Variables

```
Variables:
- plan_name (Text) - "Which plan are you on? (Free, Pro, or Enterprise)"
- user_name (Text) - "Your Name"

System prompt addition:
"The user's name is {{user_name}} and they are on the {{plan_name}} plan.
When answering, only reference features available on their plan.
If a feature requires a higher plan, mention which plan it requires."
```

### Variable Insertion Shortcut

When typing in the system prompt textarea:

1. Type `/` to open the variable menu
2. Select a variable from the dropdown
3. The `{{variable_name}}` placeholder is inserted at your cursor

### When Variables Are Collected

Variables are collected **before the chat begins**. Users see a form requesting the information, then proceed to the conversation with personalized context.

### Variable Substitution Rules

| Scenario | Result |
|----------|--------|
| Variable defined and collected | Replaced with user's value |
| Variable defined but not filled | Becomes `[variable_name]` placeholder |
| Variable in old responses | Sanitized (removed from history) |

---

## AI Model Settings

Configure how the AI generates responses from your KB content.

### AI Model

PrivexBot uses **Secret AI**, a privacy-preserving AI model that runs in a Trusted Execution Environment (TEE). This ensures your conversations and Knowledge Base content remain private.

**Current model:** DeepSeek-R1-Distill-Llama-70B

This setting is displayed but not changeable, ensuring all chatbots benefit from privacy-preserving inference.

### Temperature

Temperature controls how creative vs. deterministic the AI is when forming answers from your KB content.

**Scale:** 0.0 to 2.0

| Range | Behavior | KB Chatbot Use |
|-------|----------|----------------|
| **0.0 - 0.4** | Sticks closely to KB wording | Best for technical docs, compliance |
| **0.5 - 0.7** | Balanced — rephrases naturally | Best for most KB chatbots |
| **0.8 - 1.2** | More creative phrasing | Conversational products |
| **1.3+** | Unpredictable | Not recommended for KB chatbots |

**Default:** 0.7 (Balanced)

**For our example:** 0.5 — we want Ava to rephrase naturally but stay close to the documentation wording.

**Important:** Lower temperature does NOT make the AI more accurate at finding KB content. It makes the AI more consistent in how it phrases answers it has found.

### Max Tokens

Max tokens limits the length of AI responses.

**Range:** 100 to 8000 tokens

| Setting | Approximate Output | KB Chatbot Use |
|---------|-------------------|----------------|
| **500** | 1-2 paragraphs | Quick FAQs, yes/no answers |
| **1000** | 2-4 paragraphs | Standard feature explanations |
| **2000** (default) | 4-8 paragraphs | Detailed how-to guides |
| **4000+** | Long-form content | API reference, complex walkthroughs |

**Token guidance:**
- 1 token ~= 4 characters in English
- 100 tokens ~= 75 words
- 2000 tokens ~= 1500 words

**For our example:** 2000 — enough for step-by-step instructions without being too verbose.

---

## Behavior Features

These toggles control specific AI behaviors. All three matter significantly for KB chatbots.

### Citations & Attributions

**What it does:** When enabled, the AI mentions which part of your KB the answer came from.

**With citations enabled (recommended for KB chatbots):**
```
User: "How do I add a team member?"

Ava: "According to the Team Management documentation, you can add a
      team member by going to Settings > Team > Invite Member. Enter their
      email address and select a role (Admin, Member, or Viewer)."
```

**Without citations:**
```
User: "How do I add a team member?"

Ava: "To add a team member, go to Settings > Team > Invite Member.
      Enter their email address and select a role (Admin, Member,
      or Viewer)."
```

**For KB chatbots:**
- **Enable** when your KB has content from multiple sources (docs, FAQs, guides) so users know where the answer came from
- **Disable** when you want cleaner, more conversational responses and your KB is a single cohesive source

**Our example:** Disabled — Acme Workspace has one unified docs site, so attribution adds noise.

### Follow-up Questions

**What it does:** The AI suggests 1-2 related questions at the end of responses. These come from your Knowledge Base content.

**Example:**
```
User: "How do I create a new board?"

Ava: "To create a new board, click the '+' button in the sidebar and
      select 'New Board.' Choose a template or start blank, then give
      it a name.

      You might also want to know:
      - How do I customize board columns?
      - How do I invite team members to a board?"
```

**For KB chatbots:** Enable this. It helps users discover related documentation they might not have searched for.

**Important:** Follow-up suggestions are only drawn from your Knowledge Base content, never from the AI's general training data.

**Our example:** Enabled — helps users explore related features.

### Conversation Starters

**What it does:** Shows suggested prompts in the chat widget that users can click to start a conversation.

**How to add:**
1. In the **Conversation Starters** section
2. Type a suggested question
3. Press Enter or click **+**
4. Add up to 4 starters

**Our example starters (matching our KB topics):**
- "How do I create my first project?"
- "What integrations are available?"
- "How do I upgrade my plan?"
- "I'm having trouble with automations"

**Best practices for KB chatbots:**
- Match starters to your most-read documentation topics
- Phrase them as real user questions, not doc titles
- Cover different KB areas (features, billing, troubleshooting)
- Update based on what users actually ask

---

## Knowledge Base Usage Modes

This is the most important setting for KB chatbots. It controls how strictly the AI uses your Knowledge Base when answering questions.

### Location in the UI

1. Navigate to **Step 2: Prompt & AI**
2. Find **Knowledge Base Usage** in the Behavior Features section
3. Select your preferred mode

### The Three Modes

#### STRICT Mode (Recommended for KB Chatbots)

**How it works:**
- AI ONLY answers from your Knowledge Base
- If information isn't found, it says so
- Never supplements with general knowledge

**Example with our Acme Workspace bot:**
```
User: "How do I set up Slack integration?"
Ava:  "To set up the Slack integration, go to Settings > Integrations >
       Slack and click 'Connect.' You'll be asked to authorize Acme
       Workspace in your Slack workspace..."
       [Answer from KB]

User: "What's the weather today?"
Ava:  "I can only help with questions about Acme Workspace. I don't have
       information about that topic. Is there anything about Acme Workspace
       I can help you with?"
       [Declined — not in KB]

User: "How does Notion's API work?"
Ava:  "I don't have documentation on Notion's API. I can help with the
       Acme Workspace API though — would you like to know about that?"
       [Declined + redirect to relevant KB topic]
```

**Why this is recommended:**
- Users trust the answers because they come from your official docs
- No risk of hallucinated features or incorrect instructions
- Predictable behavior you can test and verify
- Your support team knows exactly what the bot can/can't answer

**Trade-off:** The bot will say "I don't know" more often if your KB has gaps.

---

#### GUIDED Mode

**How it works:**
- Prefers Knowledge Base information
- CAN supplement with general knowledge
- MUST disclose when using general knowledge

**Example:**
```
User: "What file formats can I import?"
Ava:  "According to our documentation, Acme Workspace supports importing
       CSV, JSON, and XML files through Settings > Import."
       [Answer from KB]

User: "What's the best way to organize a large project?"
Ava:  "Our documentation covers creating boards and using templates for
       project organization. I should note that some of this advice is
       based on general project management practices, not specific to our
       docs: breaking large projects into milestones and using labels
       to categorize tasks are common approaches."
       [KB content + general knowledge, disclosed]
```

**When to use:**
- Your KB covers the product but users ask broader "how should I" questions
- You want the bot to be helpful even outside strict documentation
- Your product involves domain knowledge (e.g., a marketing tool that can discuss marketing concepts)

---

#### FLEXIBLE Mode

**How it works:**
- Uses Knowledge Base to enhance responses
- Freely uses general knowledge without disclosure
- Prioritizes being helpful

**Example:**
```
User: "What's the best way to organize a large project?"
Ava:  "For large projects in Acme Workspace, I'd recommend breaking them
       into boards by phase or team. Use labels for priority levels and
       automations to move tasks between phases. Generally, the Agile
       methodology works well for software teams..."
       [Mixes KB content with general knowledge, no disclosure]
```

**When to use FLEXIBLE for KB chatbots:**
- Internal team chatbots where accuracy is less critical
- Products where general domain knowledge adds value
- Early prototyping before your KB is comprehensive

**Risk:** Users can't tell which answers come from your docs and which are generated.

### Mode Comparison for KB Chatbots

| Aspect | STRICT | GUIDED | FLEXIBLE |
|--------|--------|--------|----------|
| Answers from KB | Always | Preferred | When available |
| General knowledge | Never | Disclosed | Freely mixed |
| Hallucination risk | Lowest | Low | Higher |
| "I don't know" rate | Higher | Medium | Lower |
| User trust | Highest | High | Medium |
| Best for | Most KB chatbots | Broad support | Internal tools |

### Choosing the Right Mode

```
Is it important that EVERY answer comes from your docs?
                        |
           YES ─────────┴──────── NO
            |                      |
        STRICT             Should the bot tell users
                           when it uses general knowledge?
                                      |
                         YES ─────────┴──────── NO
                          |                      |
                       GUIDED                FLEXIBLE
```

**Our example:** STRICT — we want every answer to come from our documentation.

---

## How It All Works Together

Understanding the order in which configurations are applied helps you write better prompts.

### Prompt Building Order

When a user sends a message, the AI receives all your configurations assembled in this order:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. BASE SYSTEM PROMPT                                       │
│    "You are Ava, a help center assistant for Acme           │
│     Workspace..."                                           │
├─────────────────────────────────────────────────────────────┤
│ 2. PERSONA                                                  │
│    "Your name is Ava."                                      │
│    "Use a friendly tone."                                   │
├─────────────────────────────────────────────────────────────┤
│ 3. INSTRUCTIONS                                             │
│    "1. Use exact feature names from the documentation"      │
│    "2. Include menu paths: Settings > [Section]"            │
│    "3. Ask which plan they're on for plan-specific features"│
├─────────────────────────────────────────────────────────────┤
│ 4. RESTRICTIONS                                             │
│    "- Never invent features not in the documentation"       │
│    "- Do not answer questions unrelated to Acme Workspace"  │
├─────────────────────────────────────────────────────────────┤
│ 5. BEHAVIOR SETTINGS                                        │
│    "- Suggest 1-2 follow-up questions from documentation"   │
├─────────────────────────────────────────────────────────────┤
│ 6. KNOWLEDGE BASE CONTEXT (the actual content)              │
│    "[STRICT KNOWLEDGE BASE MODE]"                           │
│    "CONTEXT FROM KNOWLEDGE BASE:"                           │
│    "## Setting Up Slack Integration"                        │
│    "To connect Slack, go to Settings > Integrations..."     │
├─────────────────────────────────────────────────────────────┤
│ 7. VARIABLE VALUES                                          │
│    "User is on the Pro plan. User's name is Sarah."         │
├─────────────────────────────────────────────────────────────┤
│ 8. CONVERSATION HISTORY                                     │
│    Previous user/assistant messages                         │
├─────────────────────────────────────────────────────────────┤
│ 9. CURRENT USER MESSAGE                                     │
│    "How do I connect Slack?"                                │
└─────────────────────────────────────────────────────────────┘
```

### What You Control vs. What the System Handles

| You Configure | System Handles Automatically |
|---------------|------------------------------|
| System prompt text | Retrieving relevant KB content |
| Instructions & restrictions | Injecting KB content into prompt |
| Persona & tone | Managing conversation history |
| Grounding mode | Variable substitution |
| Temperature & max tokens | Token limit enforcement |

### Configuration Interactions

| Configuration A | Configuration B | Result |
|-----------------|-----------------|--------|
| System prompt says "be brief" | Max tokens = 4000 | AI stays brief despite token limit |
| Instruction: "use exact feature names" | KB has inconsistent naming | AI uses whatever the KB says |
| STRICT mode | Question not in KB | AI declines to answer |
| Follow-ups enabled | Empty knowledge base | No follow-ups suggested |
| Variable: plan_name = "Free" | KB docs cover all plans | AI filters to Free plan features |

### Priority Rules

When configurations might conflict:

1. **Restrictions** override **Instructions** (safety first)
2. **Grounding mode** restricts what the AI can draw from
3. **System prompt** provides context but can be overridden by specific instructions
4. **Temperature** affects phrasing variety, not accuracy

---

## Putting It All Together: Complete Configuration

Here's our complete Acme Workspace chatbot configuration:

### System Prompt

```
You are Ava, a help center assistant for Acme Workspace, a project
management tool.

Your job:
- Answer user questions about Acme Workspace using the documentation
  provided to you
- Cover features (boards, tasks, automations, integrations), billing,
  account management, API, and troubleshooting
- Guide users through setup and configuration with clear steps

How to answer:
- Use a friendly, helpful tone
- Keep answers concise — 2-3 paragraphs max unless detailed steps are needed
- Use bullet points for multi-step instructions
- Reference specific menu paths (e.g., "Go to Settings > Integrations > Slack")
- Use the exact feature names from the documentation

The user's name is {{user_name}} and they are on the {{plan_name}} plan.
When answering, only reference features available on their plan.
If a feature requires a higher plan, mention which plan includes it.

When you can't find an answer in the documentation:
- Say: "I don't have documentation on that specific topic."
- Suggest visiting help.acmeworkspace.com or emailing support@acmeworkspace.com
- Offer to help with a related topic you do have docs for
```

### Persona

- **Name:** Ava
- **Role:** Help Center Assistant
- **Tone:** Friendly

### Instructions

1. "Use exact feature names from the documentation (e.g., 'Board View', 'Automation Rules')"
2. "Include menu paths: Settings > [Section] > [Option]"
3. "If a question could apply to multiple plans (Free, Pro, Enterprise), ask which plan they're on"
4. "For troubleshooting, present steps as numbered lists"
5. "End troubleshooting answers with 'Did that resolve your issue?'"

### Restrictions

1. "Never invent features or settings not in the documentation"
2. "Do not answer questions unrelated to Acme Workspace"
3. "Do not compare our product to competitors"
4. "Never share pricing unless it's in the docs — direct to acmeworkspace.com/pricing"
5. "Do not promise features on our roadmap or discuss unreleased capabilities"

### Greeting

```
Hi! I'm Ava, your Acme Workspace help assistant. I can answer questions about:

- Features and how to use them
- Account and billing
- Integrations and API
- Troubleshooting common issues

Ask me anything about Acme Workspace!
```

### Variables

- `user_name` (Text) - "Your Name"
- `plan_name` (Text) - "Which plan are you on? (Free, Pro, or Enterprise)"

### Conversation Starters

- "How do I create my first project?"
- "What integrations are available?"
- "How do I upgrade my plan?"
- "I'm having trouble with automations"

### Settings

| Setting | Value | Why |
|---------|-------|-----|
| Temperature | 0.5 | Close to docs wording, some natural rephrasing |
| Max Tokens | 2000 | Enough for step-by-step guides |
| Grounding Mode | STRICT | Answers only from our documentation |
| Citations | Disabled | Single docs source, cleaner responses |
| Follow-ups | Enabled | Help users discover related docs |

### What This Looks Like in Practice

```
User: "How do I set up the Slack integration?"

Ava: "To set up the Slack integration:

      1. Go to Settings > Integrations > Slack
      2. Click 'Connect to Slack'
      3. Authorize Acme Workspace in your Slack workspace
      4. Choose which Slack channel to receive notifications in
      5. Select which events trigger notifications
         (task created, task completed, comments)

      The Slack integration is available on the Pro and Enterprise plans.

      You might also want to know:
      - How do I customize which notifications go to Slack?
      - What other integrations are available?"
```

```
User: "Can I use Acme Workspace with Jira?"

Ava: "I don't have documentation on a Jira integration for Acme Workspace.
      You might want to check our integrations page for the latest list,
      or contact support@acmeworkspace.com to ask about Jira specifically.

      I can help with the integrations we do have documented — would you
      like to know about our Slack, GitHub, or Google Calendar integrations?"
```

---

## Troubleshooting

### Common Issues and Solutions

#### Bot Gives Answers Not in the Knowledge Base

**Symptoms:**
- Bot discusses features you haven't documented
- Provides instructions that don't match your product
- Shares information that seems made up

**Solutions:**
1. **Set grounding mode to STRICT** — this is the most impactful fix
2. **Add restriction:** "Never invent features or settings not in the documentation"
3. **Lower temperature** to 0.3-0.5 for less creative rephrasing
4. **Check your KB status** — if it's not "Ready," the bot has no content to draw from
5. **Verify KB is attached** — check Step 3 in the chatbot wizard

---

#### Bot Says "I Don't Know" Too Often

**Symptoms:**
- Refuses questions you know are in the KB
- Says it can't help with documented topics

**Solutions:**
1. **Check Knowledge Base status** — must show "Ready"
2. **Verify KB is attached** — Step 3: Knowledge Bases in chatbot wizard
3. **KB toggle is enabled** — the attached KB must have its toggle ON
4. **Content gap** — your KB might not cover the topic the way users phrase it
5. **Try GUIDED mode** — if some general knowledge supplementation is acceptable
6. **Rephrase system prompt** — remove overly restrictive language that might cause false declines

---

#### Bot Ignores Instructions

**Symptoms:**
- Instructions are defined but not followed
- Inconsistent behavior across conversations

**Solutions:**
1. **Reduce instruction count** — more than 8-10 can confuse the AI
2. **Be more specific** — "Include menu paths like Settings > Team" instead of "Be detailed"
3. **Lower temperature** — 0.3-0.5 for more consistent rule-following
4. **Check for conflicts** — instructions and restrictions shouldn't contradict each other
5. **Verify enabled** — make sure the toggle switch is ON for each instruction

---

#### Variables Not Substituting

**Symptoms:**
- `{{variable}}` appears in responses
- Personalization not working

**Solutions:**
1. **Check variable name** — must match exactly (case-sensitive)
2. **Enable variable collection** — toggle must be ON
3. **User must provide value** — empty values become `[variable_name]`
4. **Check syntax** — use `{{name}}` not `{name}` or `{{ name }}`
5. **Variable name rules** — letters, numbers, underscore only; start with letter/underscore

---

#### Responses Too Long/Short

**Symptoms:**
- Wall-of-text responses that repeat KB content
- Responses that are too brief to be useful

**Solutions:**
1. **Adjust max tokens** — increase for detailed answers, decrease for concise ones
2. **Add length instruction** — "Keep answers under 150 words unless detailed steps are needed"
3. **Format instructions** — "Use bullet points for steps" naturally constrains length
4. **System prompt** — "Keep answers concise — 2-3 paragraphs max" in the prompt itself

---

#### Personality Inconsistent

**Symptoms:**
- Tone varies between responses
- Sometimes formal, sometimes casual

**Solutions:**
1. **Set persona tone** — use the persona configuration, not just system prompt text
2. **Lower temperature** — 0.3-0.5 for more consistent tone
3. **Reinforce in system prompt** — "Always use a friendly, helpful tone"
4. **Add instruction** — "Maintain a friendly tone even when declining questions"

---

### Getting Help

If you're still experiencing issues:

1. **Test in preview** — use the preview panel before deploying
2. **Check KB status** — the most common issue is an unready or unattached KB
3. **Simplify configuration** — start with just a system prompt and STRICT mode, then add complexity
4. **Review conversation logs** — look for patterns in where the bot fails
5. **Contact support** — share specific conversation examples for fastest resolution

---

## Summary

Configuring a KB-grounded chatbot comes down to five decisions:

1. **System prompt** — Tell the AI its role and how to present KB content
2. **Grounding mode** — STRICT for most KB chatbots (answers only from your docs)
3. **Instructions** — How to format answers (menu paths, feature names, steps)
4. **Restrictions** — What not to do (no hallucination, no off-topic, no competitor comparisons)
5. **Behavior features** — Follow-ups help users explore; conversation starters guide first questions

The most common mistake is spending time perfecting the system prompt while leaving grounding mode on FLEXIBLE. **Set STRICT mode first**, then tune everything else. Your chatbot's accuracy depends on the Knowledge Base content; your system prompt controls the delivery.
