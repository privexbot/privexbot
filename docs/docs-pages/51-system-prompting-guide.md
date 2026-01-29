# System Prompting Guide

Learn how to configure your chatbot's AI behavior through system prompts, instructions, restrictions, variables, and grounding modes. This guide covers everything you need to create effective, well-behaved chatbots.

---

## Table of Contents

1. [Introduction](#introduction)
2. [System Prompt Basics](#system-prompt-basics)
3. [Built-in Templates](#built-in-templates)
4. [Persona Configuration](#persona-configuration)
5. [Instructions](#instructions)
6. [Restrictions](#restrictions)
7. [Opening Greeting](#opening-greeting)
8. [Variable Collection](#variable-collection)
9. [AI Model Settings](#ai-model-settings)
10. [Behavior Features](#behavior-features)
11. [Knowledge Base Usage Modes](#knowledge-base-usage-modes)
12. [How It All Works Together](#how-it-all-works-together)
13. [Use Case Examples](#use-case-examples)
14. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is a System Prompt?

A system prompt is the foundational instruction set that defines how your AI chatbot behaves. It tells the AI:

- **Who it is** - Its name, role, and personality
- **How to respond** - Tone, style, and format
- **What to do** - Specific behaviors and actions
- **What to avoid** - Topics and behaviors to restrict

Think of it as the "DNA" of your chatbot that shapes every interaction.

### Why System Prompting Matters

| Good System Prompting | Poor System Prompting |
|----------------------|----------------------|
| Consistent responses | Unpredictable behavior |
| On-brand personality | Generic, robotic tone |
| Focused on your use case | Wanders off-topic |
| Respects boundaries | May discuss inappropriate topics |
| Utilizes knowledge base effectively | Ignores or misuses your content |

### Configuration Overview

PrivexBot provides multiple ways to configure AI behavior:

```
+------------------+     +----------------+     +------------------+
|  System Prompt   | --> |  Instructions  | --> |   Restrictions   |
| (Core identity)  |     | (Do these)     |     | (Avoid these)    |
+------------------+     +----------------+     +------------------+
         |                       |                       |
         v                       v                       v
+------------------+     +----------------+     +------------------+
|    Variables     | --> | Behavior Opts  | --> | Grounding Mode   |
| (Personalize)    |     | (Citations,etc)|     | (KB strictness)  |
+------------------+     +----------------+     +------------------+
```

---

## System Prompt Basics

The system prompt is the main text box where you define your chatbot's core identity and behavior.

### Location in the UI

1. Go to **Chatbots** in your dashboard
2. Click **Create Chatbot** or edit an existing one
3. Navigate to **Step 2: Prompt & AI**
4. Find the **System Prompt** textarea

### Writing Effective System Prompts

**Structure your prompt with clear sections:**

```
You are [Name], a [role] for [company/purpose].

Your role:
- [Primary responsibility]
- [Secondary responsibility]
- [Additional duties]

Guidelines:
- [How to communicate]
- [Tone and style]
- [Format preferences]

When uncertain:
- [Fallback behavior]
- [Escalation process]
```

### Best Practices

| Do | Don't |
|-----|-------|
| Be specific about the role | Use vague descriptions |
| Define tone clearly | Assume defaults are sufficient |
| Explain handling of unknowns | Leave edge cases unaddressed |
| Use bullet points for clarity | Write dense paragraphs |
| Test with real scenarios | Deploy without testing |

### Example: Basic Customer Support Prompt

```
You are Maya, a friendly customer support assistant for TechStore.

Your role:
- Answer questions about our products and services using the knowledge base.
- Help answer common questions
- Guide users through the guide

Communication style:
- Friendly but professional tone
- Use simple, clear language
- Keep responses concise (2-3 paragraphs max)
- Use bullet points for step-by-step instructions

When you don't know something:
- Admit it honestly: "I don't have that specific information"
- Offer to connect them with a human agent
- Suggest checking our help center at help.techstore.com
```

---

## Built-in Templates

PrivexBot provides 5 pre-built templates to help you get started quickly.

### How to Use Templates

1. In the System Prompt section, click the **Choose a template...** dropdown
2. Select a template
3. The template text will populate the system prompt field
4. Customize placeholders like `{company_name}` with your actual values
5. Modify as needed for your specific use case

### Available Templates

#### 1. Customer Support

**Best for:** Help desks, support centers, FAQ bots

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

#### 2. Sales Assistant

**Best for:** E-commerce, product recommendations, lead engagement

```
You are a friendly sales assistant for {company_name}.

Your role:
- Understand customer needs
- Recommend relevant products/services
- Highlight key features and benefits
- Address objections professionally

Guidelines:
- Ask clarifying questions
- Be consultative, not pushy
- Focus on value, not just features
- Offer personalized recommendations
```

#### 3. Technical Support

**Best for:** IT help desks, software support, troubleshooting bots

```
You are a technical support specialist for {product_name}.

Your role:
- Diagnose technical issues
- Provide step-by-step solutions
- Explain technical concepts clearly
- Escalate when necessary

Guidelines:
- Ask diagnostic questions first
- Provide clear, numbered steps
- Use simple language, avoid jargon
- Verify solution worked before closing
```

#### 4. Lead Qualifier

**Best for:** Sales teams, marketing, appointment booking

```
You are a lead qualification bot for {company_name}.

Your role:
- Engage prospects warmly
- Ask qualifying questions
- Assess fit and interest level
- Capture contact information

Questions to ask:
- What challenges are you facing?
- What's your timeline?
- What's your budget range?
- Who else is involved in decisions?

Always be respectful of their time.
```

#### 5. FAQ Assistant

**Best for:** Documentation sites, knowledge bases, self-service portals

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

### Customizing Templates

After selecting a template:

1. **Replace placeholders**: Change `{company_name}`, `{product_name}` to your actual values
2. **Add specific details**: Include your product names, policies, URLs
3. **Adjust tone**: Modify language to match your brand voice
4. **Add instructions**: Include specific behaviors unique to your use case
5. **Test thoroughly**: Preview the chatbot with various questions

---

## Persona Configuration

The persona adds a consistent identity layer on top of your system prompt.

### Persona Elements

| Element | Description | Example |
|---------|-------------|---------|
| **Name** | The chatbot's name | "Maya", "TechBot", "Alex" |
| **Role** | Job title or function | "Customer Success Manager" |
| **Tone** | Communication style | "professional", "friendly", "casual", "formal" |

### Available Tones

- **Professional** - Business-appropriate, respectful, clear
- **Friendly** - Warm, approachable, conversational
- **Casual** - Relaxed, informal, personable
- **Formal** - Proper, structured, traditional

### How Persona Affects Responses

When you configure a persona, the AI receives additional context:

```
Your name is Maya.
Use a friendly tone.
Your communication style is helpful and empathetic.
```

This shapes every response to maintain consistent personality.

### When to Use Persona vs. System Prompt

| Use Persona For | Use System Prompt For |
|-----------------|----------------------|
| Name and identity | Detailed behavior rules |
| General tone | Specific response formats |
| Quick personality setup | Complex decision trees |
| Simple customization | Comprehensive instructions |

**Tip:** Use both together. Persona sets the "who", system prompt sets the "how".

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
1. Always greet users by name when available
2. Ask clarifying questions before providing solutions
3. Summarize key points at the end of long responses
```

### Enabling/Disabling Instructions

Each instruction has a toggle switch:
- **Enabled** (switch on) - Instruction is active
- **Disabled** (switch off) - Instruction is temporarily ignored (shown with strikethrough)

This lets you test different behaviors without deleting instructions.

### Effective Instruction Examples

#### Customer Service

- "Always apologize for any inconvenience before troubleshooting"
- "Confirm the user's issue back to them before providing solutions"
- "Offer to escalate to a human agent for complex issues"

#### Sales

- "Ask about their current solution before recommending products"
- "Highlight ROI and cost savings when relevant"
- "Suggest scheduling a demo for interested prospects"

#### Technical Support

- "Request error messages or screenshots when relevant"
- "Provide solutions from simplest to most complex"
- "Always verify the solution worked before ending the conversation"

#### Lead Qualification

- "Ask about budget within the first 3 exchanges"
- "Capture company name and role early in the conversation"
- "Offer to schedule a call with sales for qualified leads"

### Instruction Best Practices

| Do | Don't |
|-----|-------|
| Be specific and actionable | Write vague guidelines |
| Use clear action verbs | Use passive language |
| Limit to 5-10 key instructions | Add too many (overwhelms AI) |
| Prioritize most important first | Bury critical rules at the end |

---

## Restrictions

Restrictions define what the AI should NOT do. They create guardrails for safe, appropriate responses.

### Location in the UI

1. Navigate to **Step 2: Prompt & AI** in the chatbot creation wizard
2. Scroll to the **Restrictions** section (red warning icon)
3. Add restrictions in the input field
4. Press Enter or click the **+** button to add

### How Restrictions Work

Restrictions you add appear in the system prompt as:

```
RESTRICTIONS - Do NOT do the following:
- Never discuss competitor products or pricing
- Do not provide legal, medical, or financial advice
- Never share internal company information
```

### Enabling/Disabling Restrictions

Like instructions, each restriction has a toggle:
- **Enabled** (switch on) - Restriction is enforced
- **Disabled** (switch off) - Restriction is temporarily ignored

### Common Restriction Examples

#### General Safety

- "Never provide medical, legal, or financial advice"
- "Do not discuss politics, religion, or controversial topics"
- "Never share personal information about employees"

#### Business Protection

- "Never discuss competitor products by name"
- "Do not reveal pricing without verification"
- "Never share internal processes or strategies"

#### Brand Consistency

- "Never use profanity or inappropriate language"
- "Do not make promises about delivery or guarantees"
- "Never admit fault or liability without authorization"

#### Technical Limitations

- "Do not attempt to execute code or access systems"
- "Never provide passwords or security credentials"
- "Do not discuss system architecture or infrastructure"

### Restriction Best Practices

| Do | Don't |
|-----|-------|
| Be explicit about boundaries | Assume AI knows what's off-limits |
| Cover legal/compliance needs | Skip important restrictions |
| Include brand guidelines | Only focus on technical restrictions |
| Update as needs change | Set once and forget |

---

## Opening Greeting

The greeting is the first message users see when they open the chat widget.

### Location in the UI

1. Navigate to **Step 1: Basic Info** in the chatbot creation wizard
2. Find the **Greeting Message** field
3. Enter your welcome message

### Default Greeting

```
Hello! How can I help you today?
```

### Customizing Your Greeting

**Good greetings should:**

- Welcome the user warmly
- Set expectations for what the bot can do
- Optionally suggest what to ask

**Examples by use case:**

#### Customer Support
```
Hi! I'm here to help with any questions about your order, our products,
or account issues. What can I assist you with today?
```

#### Sales
```
Welcome! I can help you find the perfect solution for your needs.
Would you like product recommendations, pricing info, or to schedule a demo?
```

#### Technical Support
```
Hello! I'm your tech support assistant. Describe your issue and I'll help
you troubleshoot. For urgent issues, type "urgent" to connect with a human.
```

#### Knowledge Base
```
Hi there! I have access to our complete documentation.
Ask me anything about [Product Name] and I'll find the answer for you.
```

### Greeting Best Practices

| Do | Don't |
|-----|-------|
| Keep it brief (1-3 sentences) | Write long introductions |
| Set clear expectations | Overpromise capabilities |
| Match your brand voice | Use generic corporate speak |
| Suggest conversation starters | Leave users wondering what to ask |

---

## Variable Collection

Variables let you collect information from users and use it to personalize responses.

### What Are Variables?

Variables are placeholders in your system prompt that get replaced with user-provided values:

```
System prompt: "You are helping {{user_name}} who works at {{company}}."

After collection: "You are helping Sarah who works at TechCorp."
```

### Enabling Variable Collection

1. Navigate to **Step 2: Prompt & AI**
2. Scroll to the **Variable Collection** section (gear icon)
3. Toggle the switch to enable
4. Add your variables

### Creating Variables

For each variable, you'll configure:

| Field | Description | Example |
|-------|-------------|---------|
| **Variable Name** | The placeholder name (no spaces, alphanumeric + underscore) | `user_name`, `company_size` |
| **Display Label** | What users see in the form | "Your Name", "Company Size" |
| **Type** | Input validation type | text, email, phone, number |

### Variable Types

| Type | Description | Validation |
|------|-------------|------------|
| **Text** | Any text input | None |
| **Email** | Email address | Must be valid email format |
| **Phone** | Phone number | Numeric with formatting |
| **Number** | Numeric value | Numbers only |

### Using Variables in Your Prompt

**Syntax:** `{{variable_name}}`

**Example system prompt:**
```
You are a personalized assistant for {{company}}.
You are speaking with {{user_name}}, who is a {{role}}.

Guidelines:
- Address {{user_name}} by name in responses
- Tailor recommendations to {{industry}} industry needs
- Consider their company size ({{company_size}} employees) when suggesting solutions
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

### Variable Examples

#### Lead Qualification Bot
```
Variables:
- user_name (Text) - "Your Name"
- company (Text) - "Company Name"
- company_size (Number) - "Number of Employees"
- email (Email) - "Work Email"

System prompt:
"You are qualifying {{user_name}} from {{company}} ({{company_size}} employees).
Assess their fit for our enterprise solution. Their email is {{email}}."
```

#### Personalized Support Bot
```
Variables:
- customer_name (Text) - "Your Name"
- account_number (Text) - "Account Number"

System prompt:
"You are helping {{customer_name}} (Account: {{account_number}}).
Look up their account history and provide personalized support."
```

---

## AI Model Settings

Configure how the AI generates responses with these settings.

### AI Model

PrivexBot uses **Secret AI**, a privacy-preserving AI model that runs in a Trusted Execution Environment (TEE). This ensures your conversations remain private.

**Current model:** DeepSeek-R1-Distill-Llama-70B

This setting is displayed but not changeable, ensuring all chatbots benefit from privacy-preserving inference.

### Temperature

Temperature controls the randomness/creativity of responses.

**Scale:** 0.0 to 2.0

| Range | Behavior | Best For |
|-------|----------|----------|
| **0.0 - 0.4** | More focused, deterministic | Technical support, factual answers |
| **0.5 - 0.9** | Balanced | General support, most use cases |
| **1.0 - 1.5** | More creative, varied | Creative writing, brainstorming |
| **1.6 - 2.0** | Highly creative, unpredictable | Creative exploration (use carefully) |

**Default:** 0.7 (Balanced)

**Tip:** Start at 0.7 and adjust based on testing. Lower for accuracy-critical uses, higher for conversational engagement.

### Max Tokens

Max tokens limits the length of AI responses.

**Range:** 100 to 8000 tokens

| Setting | Approximate Output | Best For |
|---------|-------------------|----------|
| **500** | 1-2 paragraphs | Quick answers, FAQs |
| **1000** | 2-4 paragraphs | Standard support responses |
| **2000** (default) | 4-8 paragraphs | Detailed explanations |
| **4000+** | Long-form content | Documentation, guides |

**Token guidance:**
- 1 token ~= 4 characters in English
- 100 tokens ~= 75 words
- 2000 tokens ~= 1500 words

**Tip:** Set based on your expected response length. Lower values = faster responses and lower costs.

---

## Behavior Features

These toggles control specific AI behaviors.

### Citations & Attributions

**What it does:** When enabled, the AI mentions where information came from in its responses.

**Example with citations enabled:**
```
"According to your product documentation, the refund policy allows
returns within 30 days of purchase."
```

**Example without citations:**
```
"The refund policy allows returns within 30 days of purchase."
```

**When to enable:**
- Knowledge base has multiple distinct sources
- Users need to verify information
- Building trust through transparency

**When to disable:**
- Cleaner, more conversational responses
- Single knowledge source
- Brand voice that shouldn't reference "sources"

### Follow-up Questions

**What it does:** The AI suggests 1-2 related questions at the end of responses.

**Example with follow-ups:**
```
"Here's how to reset your password... [response]

Related questions I can help with:
- How do I enable two-factor authentication?
- What should I do if I'm locked out of my account?"
```

**Important:** Follow-up suggestions are only drawn from your knowledge base content, never from the AI's general training data.

**When to enable:**
- Guide users to explore related topics
- Increase engagement and satisfaction
- Help users discover features they didn't know about

**When to disable:**
- Users prefer concise responses
- Support context where users have specific issues
- Conversations should feel more natural

### Conversation Starters

**What it does:** Shows suggested prompts in the chat widget that users can click to start a conversation.

**How to add:**
1. In the **Conversation Starters** section
2. Type a suggested question
3. Press Enter or click **+**
4. Add up to 4 starters

**Example starters:**
- "What products do you offer?"
- "How can I track my order?"
- "What are your business hours?"
- "I need help with a refund"

**Best practices:**
- Cover your most common questions
- Use natural, conversational language
- Phrase as questions users would actually ask
- Update based on conversation analytics

---

## Knowledge Base Usage Modes

Grounding modes control how strictly the AI uses your knowledge base when answering questions.

### Location in the UI

1. Navigate to **Step 2: Prompt & AI**
2. Find **Knowledge Base Usage** in the Behavior Features section
3. Select your preferred mode

### The Three Modes

#### STRICT Mode (Recommended)

**How it works:**
- AI ONLY answers from your knowledge base
- If information isn't found, it says so
- Never supplements with general knowledge

**AI behavior:**
```
User: "What's the weather in Tokyo?"
Bot: "I don't have information about that topic. I can help you with
     questions about [your knowledge base topics]."
```

**Best for:**
- Legal/compliance-sensitive contexts
- Technical documentation
- When accuracy is critical
- Regulated industries

**Advantages:**
- Maximum accuracy
- No hallucinations
- Predictable responses
- Audit-friendly

**Trade-offs:**
- May refuse more questions
- Less conversational flexibility

---

#### GUIDED Mode

**How it works:**
- Prefers knowledge base information
- CAN supplement with general knowledge
- MUST disclose when using general knowledge

**AI behavior:**
```
User: "What's the weather in Tokyo?"
Bot: "I don't have specific information about this in my knowledge base,
     but based on general knowledge, Tokyo typically has a humid
     subtropical climate with..."
```

**Best for:**
- Customer support with broad questions
- Education/training contexts
- When some flexibility is needed
- Internal company assistants

**Advantages:**
- Balances accuracy with helpfulness
- Transparent about sources
- More conversational

**Trade-offs:**
- Requires trust in AI's general knowledge
- Need to monitor for accuracy

---

#### FLEXIBLE Mode

**How it works:**
- Uses knowledge base to enhance responses
- Freely uses general knowledge without disclosure
- Prioritizes being helpful

**AI behavior:**
```
User: "What's the weather in Tokyo?"
Bot: "Tokyo currently has a humid subtropical climate. In summer,
     expect temperatures around 30°C with high humidity..."
```

**Best for:**
- General-purpose assistants
- Creative or exploratory use cases
- Internal tools where flexibility matters
- Non-critical information contexts

**Advantages:**
- Most helpful and conversational
- Handles any topic
- Best user experience

**Trade-offs:**
- May include inaccurate information
- Harder to audit responses
- Less predictable

### Mode Comparison Table

| Aspect | STRICT | GUIDED | FLEXIBLE |
|--------|--------|--------|----------|
| KB accuracy | Highest | High | Medium |
| Helpfulness | Limited | Balanced | Highest |
| General knowledge | Never | With disclosure | Freely |
| Hallucination risk | Lowest | Low | Higher |
| Best for | Compliance, docs | Support, training | General assistant |
| Transparency | Highest | High | Lower |

### Choosing the Right Mode

```
                    Is accuracy critical?
                           |
              YES ─────────┴───────── NO
               |                       |
           STRICT              Can AI be transparent
                               about sources?
                                      |
                         YES ─────────┴───────── NO
                          |                       |
                       GUIDED                 FLEXIBLE
```

---

## How It All Works Together

Understanding the order in which configurations are applied helps you write better prompts.

### Prompt Building Order

When the AI processes a message, your configurations are assembled in this order:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. BASE SYSTEM PROMPT                                       │
│    "You are a helpful assistant..."                         │
├─────────────────────────────────────────────────────────────┤
│ 2. PERSONA (if configured)                                  │
│    "Your name is Maya."                                     │
│    "Use a friendly tone."                                   │
├─────────────────────────────────────────────────────────────┤
│ 3. INSTRUCTIONS (if any)                                    │
│    "INSTRUCTIONS:"                                          │
│    "1. Always greet warmly"                                 │
│    "2. Ask clarifying questions"                            │
├─────────────────────────────────────────────────────────────┤
│ 4. RESTRICTIONS (if any)                                    │
│    "RESTRICTIONS - Do NOT do the following:"                │
│    "- Never discuss competitors"                            │
├─────────────────────────────────────────────────────────────┤
│ 5. BEHAVIOR SETTINGS                                        │
│    "RESPONSE FORMAT:"                                       │
│    "- Cite your sources when using knowledge base"          │
│    "- Suggest 1-2 follow-up questions"                      │
├─────────────────────────────────────────────────────────────┤
│ 6. KNOWLEDGE BASE CONTEXT (grounded by mode)                │
│    "[STRICT KNOWLEDGE BASE MODE]"                           │
│    "CONTEXT FROM KNOWLEDGE BASE:"                           │
│    "[Retrieved content here]"                               │
├─────────────────────────────────────────────────────────────┤
│ 7. CONVERSATION HISTORY                                     │
│    Previous user/assistant messages                         │
├─────────────────────────────────────────────────────────────┤
│ 8. CURRENT USER MESSAGE                                     │
│    "How do I reset my password?"                            │
└─────────────────────────────────────────────────────────────┘
```

### Variable Substitution Timing

Variables are substituted at multiple points:

1. **Before chat** - Variables collected from user form
2. **During prompt building** - `{{var}}` replaced with actual values
3. **In responses** - AI may reference the substituted values
4. **In history** - Old responses are sanitized to remove leftover `{{var}}` patterns

### Configuration Interactions

| Configuration A | Configuration B | Result |
|-----------------|-----------------|--------|
| System prompt says "be brief" | Max tokens = 4000 | AI stays brief despite limit |
| Instruction: "always apologize" | Restriction: "never admit fault" | May conflict - clarify your intent |
| Citations enabled | STRICT mode | Citations only from KB |
| Follow-ups enabled | Empty knowledge base | No follow-ups suggested |

### Priority Rules

When configurations might conflict:

1. **Restrictions** override **Instructions** (safety first)
2. **Grounding mode** restricts what AI can say
3. **System prompt** provides context but can be overridden by specific instructions
4. **Temperature** affects how strictly rules are followed (lower = more strict)

---

## Use Case Examples

### Customer Support Bot

**Goal:** Handle product questions, troubleshooting, and order issues

**System Prompt:**
```
You are SupportBot, a customer service representative for TechGear Electronics.

Your responsibilities:
- Answer product questions accurately
- Help troubleshoot common issues
- Assist with order tracking and returns
- Escalate complex issues to human agents

Communication:
- Use a friendly, empathetic tone
- Keep responses concise and actionable
- Use bullet points for multi-step processes
- Always verify you've addressed the user's concern
```

**Instructions:**
- "Apologize for any inconvenience before troubleshooting"
- "Ask clarifying questions when the issue is unclear"
- "Offer to escalate after 3 troubleshooting attempts"

**Restrictions:**
- "Never provide refunds directly - direct to the refunds team"
- "Do not discuss competitor products"
- "Never share customer data or order details without verification"

**Settings:**
- Temperature: 0.5 (consistent, professional)
- Grounding Mode: STRICT (accurate product info)
- Citations: Disabled (cleaner responses)
- Follow-ups: Enabled (guide users to related help)

---

### Sales Assistant Bot

**Goal:** Qualify leads, recommend products, book demos

**System Prompt:**
```
You are Alex, a sales assistant for CloudSync Solutions.

Your goals:
- Understand prospect needs and pain points
- Recommend appropriate solutions from our product line
- Qualify leads by budget, timeline, and decision process
- Book demo calls with our sales team

Approach:
- Be consultative, not pushy
- Ask questions to understand before recommending
- Focus on value and ROI, not features
- Be transparent about pricing ranges
```

**Variables:**
- `prospect_name` (Text) - "Your Name"
- `company` (Text) - "Company Name"
- `email` (Email) - "Work Email"

**Instructions:**
- "Greet {{prospect_name}} by name throughout the conversation"
- "Within the first 3 messages, ask about their current solution"
- "If budget exceeds $10k/month, offer to schedule a call with sales"

**Restrictions:**
- "Never provide exact custom pricing - offer ranges only"
- "Do not disparage competitors"
- "Never share proprietary technical details"

**Settings:**
- Temperature: 0.7 (balanced)
- Grounding Mode: GUIDED (can discuss general industry topics)
- Citations: Disabled
- Follow-ups: Disabled (keep focus on qualification)

---

### Technical Documentation Bot

**Goal:** Help developers find answers in documentation

**System Prompt:**
```
You are DocBot, a technical documentation assistant for the CloudSync API.

Your role:
- Help developers find relevant documentation
- Explain technical concepts clearly
- Provide code examples when helpful
- Guide through implementation steps

Technical standards:
- Use proper terminology
- Format code blocks correctly
- Reference specific API endpoints and parameters
- Link to relevant documentation sections when possible
```

**Instructions:**
- "Include code examples for implementation questions"
- "Clarify the SDK version being discussed"
- "Suggest related API endpoints that might be useful"

**Restrictions:**
- "Do not provide code for unsupported languages"
- "Never suggest workarounds that bypass security"
- "Do not discuss unreleased features"

**Settings:**
- Temperature: 0.3 (precise, technical)
- Grounding Mode: STRICT (documentation accuracy is critical)
- Citations: Enabled (reference docs sections)
- Follow-ups: Enabled (guide to related topics)

---

### Lead Qualification Bot

**Goal:** Qualify inbound leads and collect information

**System Prompt:**
```
You are Qualifier, a lead qualification assistant for Enterprise Solutions Inc.

Your mission:
- Engage prospects warmly and professionally
- Ask qualifying questions to assess fit
- Collect key information for the sales team
- Book meetings with qualified prospects

Qualification criteria (BANT):
- Budget: Over $50k/year
- Authority: Decision maker or strong influencer
- Need: Clear business problem we solve
- Timeline: Looking to buy within 6 months
```

**Variables:**
- `name` (Text) - "Your Name"
- `company` (Text) - "Company"
- `title` (Text) - "Job Title"
- `email` (Email) - "Work Email"
- `phone` (Phone) - "Phone Number"

**Instructions:**
- "Thank {{name}} for their interest within the first message"
- "Ask about budget by the third exchange"
- "If all BANT criteria met, offer to schedule a demo"
- "Always capture email before ending conversation"

**Restrictions:**
- "Never pressure for information they're uncomfortable sharing"
- "Do not discuss specific contract terms"
- "Never guarantee outcomes or timelines"

**Settings:**
- Temperature: 0.6
- Grounding Mode: FLEXIBLE (conversational)
- Citations: Disabled
- Follow-ups: Disabled

**Conversation Starters:**
- "I'd like to learn about your solutions"
- "Can you help me with a specific challenge?"
- "What makes you different from competitors?"
- "I want to schedule a demo"

---

## Troubleshooting

### Common Issues and Solutions

#### Bot Ignores Instructions

**Symptoms:**
- Instructions are defined but not followed
- Inconsistent behavior

**Solutions:**
1. **Reduce instruction count** - Too many instructions (10+) can confuse the AI
2. **Be more specific** - "Apologize for inconvenience" is better than "Be empathetic"
3. **Lower temperature** - Try 0.3-0.5 for more consistent rule-following
4. **Check for conflicts** - Instructions and restrictions shouldn't contradict
5. **Verify enabled** - Make sure the toggle switch is ON for each instruction

---

#### Variables Not Substituting

**Symptoms:**
- `{{variable}}` appears in responses
- Personalization not working

**Solutions:**
1. **Check variable name** - Must match exactly (case-sensitive)
2. **Enable variable collection** - Toggle must be ON
3. **User must provide value** - Empty values become `[variable_name]`
4. **Check syntax** - Use `{{name}}` not `{name}` or `{{ name }}`
5. **Variable name rules** - Letters, numbers, underscore only; start with letter/underscore

---

#### Bot Says "I Don't Know" Too Often

**Symptoms:**
- In STRICT mode, refuses many questions
- Not using knowledge base effectively

**Solutions:**
1. **Check knowledge base status** - Must be "Ready" status
2. **Verify KB is attached** - Check Step 3: Knowledge Bases
3. **KB toggle enabled** - Make sure attached KB has toggle ON
4. **Content coverage** - Ensure KB actually contains relevant information
5. **Try GUIDED mode** - If flexibility is acceptable

---

#### Responses Too Long/Short

**Symptoms:**
- Responses don't match expected length
- Truncated or overly verbose

**Solutions:**
1. **Adjust max tokens** - Increase for longer, decrease for shorter
2. **Add length instruction** - "Keep responses under 100 words"
3. **Use formatting instructions** - "Use bullet points" encourages conciseness
4. **Check system prompt** - Remove instructions that encourage elaboration

---

#### Bot Uses General Knowledge When Shouldn't

**Symptoms:**
- In STRICT mode, still uses general knowledge
- Provides information not in KB

**Solutions:**
1. **Verify mode is STRICT** - Check Behavior Features section
2. **Knowledge base not connected** - Bot has no KB to draw from
3. **KB retrieval failing** - Check KB status and reindex if needed
4. **Add explicit restriction** - "Only use information from the knowledge base"

---

#### Personality Inconsistent

**Symptoms:**
- Tone varies between responses
- Sometimes ignores persona

**Solutions:**
1. **Reinforce in system prompt** - State personality multiple times
2. **Lower temperature** - 0.3-0.5 for more consistency
3. **Add tone instructions** - "Always maintain a professional tone"
4. **Review for conflicts** - Ensure all configs align with desired personality

---

### Getting Help

If you're still experiencing issues:

1. **Test in preview** - Use the preview panel before deploying
2. **Check conversation history** - Look for patterns in failures
3. **Review analytics** - Check for common user queries that fail
4. **Simplify configuration** - Start with basics, add complexity gradually
5. **Contact support** - Reach out with specific examples

---

## Summary

Effective system prompting is the foundation of a great chatbot. Remember these key principles:

1. **Be specific** - Clear instructions produce consistent behavior
2. **Balance flexibility and control** - Use appropriate grounding mode
3. **Test thoroughly** - Preview with various scenarios before deploying
4. **Iterate based on feedback** - Use analytics to identify improvements
5. **Keep it manageable** - Fewer, clearer instructions beat many vague ones

Your chatbot's effectiveness depends on how well you communicate your expectations to the AI. Take time to craft your configuration thoughtfully, and you'll be rewarded with a chatbot that truly represents your brand and serves your users well.
