# How PrivexBot Works: Privacy-First AI for Everyone

## What is PrivexBot?

PrivexBot is a platform for building AI chatbots that can actually answer questions about *your* content—your documents, your website, your knowledge. But unlike other chatbot platforms, PrivexBot was built from the ground up with one principle in mind: **your data stays yours**.

Think of it as having a smart assistant who has read all your documentation and can answer customer questions 24/7—except this assistant keeps everything completely private and can never leak your information to anyone.

---

## The Problem with Traditional AI Chatbots

When you use most AI chatbot services, here's what typically happens:

```
Traditional AI Chatbot Flow:

Your Documents ──────────► Third-Party Cloud
                          │
                          │ Your data is stored
                          │ on servers you don't control
                          │
User Question ───────────► External AI Provider
                          │
                          │ Your customer conversations
                          │ are processed externally
                          │
                          ▼
                    Response returned

Problem: Your data is everywhere except under your control
```

**Real risks with traditional approaches:**

1. **Data exposure**: Your documents live on someone else's servers
2. **Training data concerns**: Your content might train future AI models
3. **Compliance nightmares**: GDPR, HIPAA, SOC2—hard to prove compliance
4. **Vendor lock-in**: Your knowledge base trapped in proprietary systems
5. **No true delete**: "Deleted" data may persist in backups, logs, or training sets

---

## The PrivexBot Difference

PrivexBot flips the model completely. Everything runs in a **Trusted Execution Environment (TEE)** called Secret VM, where even the infrastructure operators can't access your data.

```
PrivexBot Privacy-First Flow:

┌────────────────────────────────────────────────────────────────────┐
│                        SECRET VM (TEE)                              │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                    Your Private Space                         │ │
│   │                                                               │ │
│   │   Your Documents ──► Your Database ──► Your Vector Store     │ │
│   │                                                               │ │
│   │   User Question ───► Your Backend ───► Secret AI (TEE)       │ │
│   │                                                               │ │
│   │                           │                                   │ │
│   │                           ▼                                   │ │
│   │                    Response returned                          │ │
│   │                                                               │ │
│   │   Memory encrypted ✓  Isolated workload ✓  No external access │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│   Even Secret VM operators cannot see your data                     │
└────────────────────────────────────────────────────────────────────┘
```

**What this means for you:**

- Your documents never leave the secure environment
- User conversations stay completely private
- AI inference happens in encrypted memory
- You maintain full control over your data
- True deletion is actually true—when you delete, it's gone

---

## How It All Works

Let's follow the complete journey from "I want a chatbot" to "My chatbot is helping customers."

### Phase 1: Setting Up Your Workspace

Everything in PrivexBot is organized for teams:

```
Your Organization (Company)
    │
    └── Workspace (Team/Project)
            │
            ├── Knowledge Bases
            │   └── Your documents, FAQs, guides
            │
            ├── Chatbots
            │   └── AI assistants using your knowledge
            │
            └── Team Members
                └── People who can manage everything
```

**Why this structure?**

- **Organizations** = Your company. One bill, one admin.
- **Workspaces** = Different teams or projects. Marketing has their bot, Support has theirs.
- **Isolation** = Each workspace's data is completely separate. Marketing can't see Support's documents.

### Phase 2: Building Your Knowledge Base

This is where you teach the AI what it needs to know.

#### Step 1: Add Your Content

PrivexBot accepts content from multiple sources:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADD KNOWLEDGE SOURCES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📄 File Upload                                                  │
│     PDF, Word, Excel, PowerPoint, Text, Markdown                 │
│     "Upload your product manual, employee handbook, etc."        │
│                                                                  │
│  🌐 Website Scraping                                             │
│     Crawl documentation sites, help centers, blogs               │
│     "Just paste your docs URL, we'll grab everything"            │
│                                                                  │
│  ☁️ Cloud Integration                                            │
│     Google Docs, Google Sheets, Notion                           │
│     "Connect your existing knowledge wherever it lives"          │
│                                                                  │
│  📝 Direct Text                                                  │
│     Paste content directly                                       │
│     "Quick way to add FAQ entries or announcements"              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 2: The Draft-First Approach

Here's something unique about PrivexBot: nothing touches the database until you're ready.

```
The Draft-First Architecture:

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   PHASE 1:       │     │   PHASE 2:       │     │   PHASE 3:       │
│   DRAFT          │────►│   PREVIEW        │────►│   FINALIZE       │
│   (Redis)        │     │   (Test it!)     │     │   (PostgreSQL)   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
  • Add sources           • See how content          • Save to database
  • Configure settings      will be chunked          • Process embeddings
  • No commitment yet     • Test with real           • Index in vector DB
  • 24-hour auto-expire     questions                • Go live!
```

**Why this matters:**

- **No database pollution**: Abandoned drafts don't clutter your system
- **Safe experimentation**: Try different configurations without risk
- **Preview before commit**: See exactly how your KB will work
- **Easy to abandon**: Changed your mind? Just close the tab.

#### Step 3: Content Processing Pipeline

When you finalize your knowledge base, the magic happens:

```
Your Content's Journey:

"Welcome to PrivexBot! This guide will help you..."
                    │
                    ▼
        ┌───────────────────────┐
        │   SMART PARSING       │
        │   Understand structure│
        │   Extract clean text  │
        │   Preserve formatting │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   INTELLIGENT         │
        │   CHUNKING            │
        │   Split into pieces   │
        │   Optimize for search │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   EMBEDDING           │
        │   GENERATION          │
        │   Convert to vectors  │
        │   Capture meaning     │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   VECTOR INDEXING     │
        │   Store in Qdrant     │
        │   Enable fast search  │
        └───────────────────────┘
                    │
                    ▼
            Ready for questions!
```

All of this runs on your self-hosted infrastructure within Secret VM.

### Phase 3: Creating Your Chatbot

With your knowledge base ready, it's time to create the AI assistant.

#### Configure the Personality

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHATBOT PERSONALITY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Name:        "Alex"                                             │
│  Role:        "Customer Support Assistant"                       │
│  Tone:        "Friendly and professional"                        │
│  Style:       "Clear and concise"                                │
│                                                                  │
│  System Prompt:                                                  │
│  "You are Alex, a helpful customer support assistant for        │
│   PrivexBot. You help users understand our product features,     │
│   troubleshoot issues, and guide them through setup."            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Attach Knowledge Bases

```
┌─────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE SOURCES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ Product Documentation KB                                     │
│     4,521 chunks │ Last updated: 2 hours ago                    │
│                                                                  │
│  ✅ FAQ Knowledge Base                                           │
│     892 chunks │ Last updated: 1 day ago                        │
│                                                                  │
│  ☐ Internal Policies KB (disabled)                              │
│     Not needed for customer support                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Set Grounding Behavior

This is crucial for accuracy:

```
┌─────────────────────────────────────────────────────────────────┐
│                    GROUNDING MODE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ◉ STRICT                                                        │
│    Only answer from knowledge base                               │
│    If info isn't there, say so honestly                          │
│    Best for: Support, Legal, Compliance                          │
│                                                                  │
│  ○ GUIDED                                                        │
│    Prefer knowledge base, but can use general knowledge          │
│    Always disclose when using general info                       │
│    Best for: General assistance, Education                       │
│                                                                  │
│  ○ FLEXIBLE                                                      │
│    Knowledge base enhances, no restrictions                      │
│    Best for: Creative, Brainstorming                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 4: Deploy Everywhere

Your chatbot can reach users through multiple channels:

```
                         ┌─────────────┐
                         │  Your       │
                         │  Chatbot    │
                         └──────┬──────┘
                                │
        ┌───────────┬───────────┼───────────┬───────────┐
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Website │ │Telegram │ │ Discord │ │WhatsApp │ │  API    │
   │ Widget  │ │   Bot   │ │   Bot   │ │   Bot   │ │ Direct  │
   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

**Website Widget**

Just add a small script to your site:

```html
<script src="https://your-privexbot-instance.com/widget.js"></script>
<script>
  PrivexBot.init({
    botId: "your-bot-id",
    apiKey: "your-api-key"
  });
</script>
```

**Messaging Platforms**

Click "Enable" for any platform, and PrivexBot automatically:
- Registers the webhook
- Handles authentication
- Manages conversations

**Direct API**

For custom integrations:

```bash
curl -X POST https://your-instance.com/api/v1/public/bots/{bot_id}/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I reset my password?"}'
```

---

## The Technology Behind the Privacy

### Secret VM: Your Fortress

Secret VM is a **Trusted Execution Environment (TEE)**—a special type of computing environment with hardware-level security.

```
What Secret VM Provides:

┌────────────────────────────────────────────────────────────────┐
│                    HARDWARE-LEVEL PROTECTION                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔒 Memory Encryption                                           │
│     Data is encrypted even while being processed               │
│     Not even memory dumps can reveal your data                  │
│                                                                 │
│  🏰 Workload Isolation                                          │
│     Your application runs in complete isolation                │
│     Other workloads can't access your space                     │
│                                                                 │
│  ✅ Attestation                                                  │
│     Cryptographic proof of what code is running                 │
│     Verify the environment hasn't been tampered with            │
│                                                                 │
│  🚫 Operator Blindness                                          │
│     Infrastructure operators cannot access your data            │
│     Even with physical server access                            │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Self-Hosted Stack

Everything runs inside your Secret VM:

| Component | Purpose | Why Self-Hosted |
|-----------|---------|-----------------|
| **PostgreSQL** | Store users, chatbots, documents | Your data, your database |
| **Redis** | Cache, sessions, drafts | Temporary data stays local |
| **Qdrant** | Vector search | Embeddings never leave |
| **Celery** | Background processing | Processing happens locally |
| **sentence-transformers** | Generate embeddings | No external API calls |
| **Secret AI** | LLM inference | Private AI in TEE |

### Secret AI: Private Inference

When the AI generates responses, it happens in another TEE:

```
User Question: "What's your refund policy?"
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│                  SECRET AI (TEE)                                │
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │                                                          │ │
│   │   Your prompt enters encrypted memory                    │ │
│   │                    │                                     │ │
│   │                    ▼                                     │ │
│   │   AI model processes (encrypted)                         │ │
│   │                    │                                     │ │
│   │                    ▼                                     │ │
│   │   Response generated and returned                        │ │
│   │                                                          │ │
│   │   ✓ No logging of prompts                               │ │
│   │   ✓ No training on your data                            │ │
│   │   ✓ Memory cleared after processing                      │ │
│   │                                                          │ │
│   └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
                    │
                    ▼
Response: "Our refund policy allows returns within 30 days..."
```

---

## What Gets Encrypted (And What Doesn't)

Not everything needs encryption—here's the honest breakdown:

### Encrypted at Rest

| Data Type | How It's Protected |
|-----------|-------------------|
| API Keys | SHA-256 hashed (never stored plaintext) |
| Passwords | bcrypt with salt |
| OAuth Tokens | AES-256 encrypted |
| Credentials | Encrypted storage |

### Encrypted in Transit

| Path | Protection |
|------|------------|
| All API calls | HTTPS (TLS 1.3) |
| Internal services | Encrypted communication |
| AI inference | End-to-end encrypted |

### Protected by Isolation (Not Encrypted)

| Data Type | Why Not Encrypted | How Protected |
|-----------|-------------------|---------------|
| Chatbot configs | Need fast queries | TEE isolation |
| KB content | Must be searchable | TEE isolation |
| Chunk text | Required for retrieval | TEE isolation |
| Conversations | Analytics access | TEE isolation |

**Important**: While this data isn't encrypted at rest, it's protected by Secret VM's hardware isolation. No one—not even infrastructure operators—can access it.

---

## Your Rights Over Your Data

### Right to Access

See everything through the dashboard:
- All your chatbot configurations
- Complete conversation history
- Knowledge base contents
- Usage analytics

### Right to Delete (Hard Delete)

When you delete something, it's really gone:

```
DELETE Chatbot
    │
    ├── DELETE all chat sessions
    │   └── DELETE all messages
    │
    ├── DELETE all API keys
    │
    └── DELETE all deployments

DELETE Knowledge Base
    │
    ├── DELETE all documents
    │   └── DELETE all chunks
    │
    └── DELETE Qdrant collection (vectors)
```

**This is immediate and permanent**:
- No 30-day retention
- No backup recovery
- No "soft delete" hiding data
- Vectors removed from search index

### Data Retention

| Data Type | Retention |
|-----------|-----------|
| Active data | Until you delete it |
| Draft data | 24 hours (auto-expire) |
| Session data | 24 hours (configurable) |
| Deleted data | Immediately purged |

---

## A Day in the Life of a Question

Let's trace exactly what happens when a user asks your chatbot a question:

```
12:34:05.001 - User types: "How do I cancel my subscription?"
               │
               ▼
12:34:05.050 - Widget sends request to PrivexBot backend
               Route: POST /api/v1/public/bots/{bot_id}/chat
               │
               ▼
12:34:05.055 - Backend validates API key
               API key is hashed, compared to stored hash
               │
               ▼
12:34:05.060 - Session retrieved or created
               Conversation history loaded (last 10 messages)
               │
               ▼
12:34:05.070 - RAG Retrieval begins
               │
               ├── Generate query embedding
               │   "cancel subscription" → [0.12, -0.45, 0.78, ...]
               │
               ├── Search Qdrant vector database
               │   Find top 5 similar chunks
               │
               └── Results returned:
                   1. "Cancellation Policy" (score: 0.91)
                   2. "Subscription Management" (score: 0.87)
                   3. "Refund Process" (score: 0.82)
               │
               ▼
12:34:05.150 - Build AI prompt
               System prompt + KB context + chat history + user question
               │
               ▼
12:34:05.160 - Send to Secret AI (TEE)
               Encrypted processing in isolated environment
               │
               ▼
12:34:08.500 - AI response received
               "To cancel your subscription, go to Account Settings..."
               │
               ▼
12:34:08.510 - Save to conversation history
               Message stored with metadata and source citations
               │
               ▼
12:34:08.520 - Return response to user
               │
               ▼
12:34:08.550 - Widget displays response
               User sees answer with optional source citations

Total time: ~3.5 seconds
Privacy maintained throughout: ✓
```

---

## Multi-Tenant Architecture

PrivexBot is built for organizations with multiple teams:

### Complete Isolation

```
Organization: Acme Corp
│
├── Workspace: Customer Support
│   ├── KB: Product Documentation
│   ├── KB: FAQ
│   └── Chatbot: Support Bot
│   │
│   └── Data completely isolated ◄────────────────────┐
│                                                      │
├── Workspace: Sales Team                              │ Cannot
│   ├── KB: Pricing Information                        │ access
│   ├── KB: Case Studies                               │ each
│   └── Chatbot: Sales Assistant                       │ other's
│   │                                                  │ data
│   └── Data completely isolated ◄────────────────────┤
│                                                      │
└── Workspace: Internal HR                             │
    ├── KB: Employee Handbook                          │
    ├── KB: Policies                                   │
    └── Chatbot: HR Assistant                          │
    │                                                  │
    └── Data completely isolated ◄────────────────────┘
```

### How Isolation Works

Every database query includes workspace filtering:

```python
# Every query looks like this
chatbots = db.query(Chatbot).filter(
    Chatbot.workspace_id == current_user.workspace_id
)

# You literally cannot query another workspace's data
# The filter is enforced at the API layer
```

---

## Comparing Approaches

### Traditional Cloud AI

```
Pros:
+ Easy setup (no infrastructure)
+ Managed scaling
+ Quick to start

Cons:
- Your data on their servers
- May train on your content
- Compliance challenges
- Vendor lock-in
- No true deletion guarantee
```

### Self-Hosted (Non-TEE)

```
Pros:
+ Data stays on your servers
+ More control

Cons:
- Admins can access everything
- Vulnerable to insider threats
- Complex to secure properly
- Memory attacks possible
```

### PrivexBot (TEE-Based)

```
Pros:
+ Data protected by hardware
+ Even operators can't access
+ True privacy guarantees
+ Compliance-friendly
+ Cryptographic attestation
+ Full control + full privacy

Cons:
- Requires TEE infrastructure
- More complex initial setup
```

---

## Getting Started

### Step 1: Access Your Instance

PrivexBot runs on Secret VM. Your admin will provide:
- Instance URL (e.g., `https://your-company.privexbot.com`)
- Initial admin credentials

### Step 2: Create Your Organization

```
1. Log in with admin credentials
2. Set up organization name and details
3. Invite team members
4. Create your first workspace
```

### Step 3: Build Your First Knowledge Base

```
1. Workspace → Knowledge Bases → Create New
2. Name it descriptively ("Product Documentation")
3. Add sources:
   - Upload files
   - Add web URLs
   - Connect cloud services
4. Configure chunking (or use defaults)
5. Click "Create & Process"
6. Wait for processing (watch the progress!)
```

### Step 4: Create Your First Chatbot

```
1. Workspace → Chatbots → Create New
2. Name your bot ("Support Assistant")
3. Write a system prompt describing its role
4. Attach your knowledge base(s)
5. Set grounding mode (start with "Strict")
6. Test in preview mode
7. Deploy when ready!
```

### Step 5: Deploy and Monitor

```
1. Enable your desired channels
2. Copy embed code for website
3. Connect messaging platforms
4. Monitor conversations in dashboard
5. Iterate based on feedback
```

---

## Frequently Asked Questions

### "Is my data really private?"

Yes. Your data lives in a Trusted Execution Environment where:
- Memory is encrypted during processing
- Infrastructure operators cannot access it
- Hardware-level isolation protects against attacks
- Only your authorized users can access your workspace

### "What happens to my data if I stop using PrivexBot?"

You can export everything before leaving, then delete your account. Deletion is immediate and permanent—no shadow copies, no retention, no backups.

### "Can PrivexBot see my conversations?"

No. PrivexBot is self-hosted software. The platform operators don't have access to your instance. Your IT team controls everything.

### "Is this GDPR compliant?"

PrivexBot provides the tools for GDPR compliance:
- Right to access (dashboard access)
- Right to deletion (hard delete)
- Data portability (export features)
- Consent management (built-in flows)

Your compliance depends on how you configure and use the platform.

### "What if Secret AI is down?"

PrivexBot has automatic fallback to Akash ML, a decentralized AI inference network. If one provider fails, the system automatically switches.

### "Can I use my own AI model?"

The current version uses Secret AI and Akash ML. Custom model support is on the roadmap.

---

## Summary

PrivexBot brings enterprise-grade AI chatbots to everyone while maintaining uncompromising privacy:

| Feature | What It Means For You |
|---------|----------------------|
| **Self-Hosted** | Your infrastructure, your control |
| **TEE Protection** | Hardware-level security |
| **Secret AI** | Private inference in encrypted memory |
| **Multi-Tenant** | Team isolation built-in |
| **Multi-Channel** | Deploy everywhere from one place |
| **RAG-Powered** | Answers grounded in your documents |
| **Hard Delete** | True data deletion |
| **Draft-First** | Safe experimentation |

Whether you're building a customer support bot, internal knowledge assistant, or product documentation helper, PrivexBot ensures your data and your customers' conversations remain private.

**Privacy isn't a feature—it's the foundation.**

---

## Next Steps

1. **Explore the dashboard**: Familiarize yourself with the interface
2. **Create a test KB**: Start with a small set of documents
3. **Build a simple chatbot**: Test the end-to-end flow
4. **Read the other guides**: Deep dive into chunking, RAG, and optimization
5. **Join the community**: Share feedback and learn from others

Welcome to privacy-first AI. Welcome to PrivexBot.
