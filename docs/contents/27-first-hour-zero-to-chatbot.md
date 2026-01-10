# Your First Hour with PrivexBot: Zero to Chatbot

## Introduction

You've got an hour. You want a working chatbot. Let's make it happen.

This guide cuts straight to the point. No theory, no background—just the steps to get your first PrivexBot chatbot live and answering questions.

By the end of this hour, you'll have:
- A knowledge base with your content
- A chatbot trained on that content
- A working chat widget you can embed anywhere

Let's go.

---

## Before You Start (2 Minutes)

### What You'll Need

```
Required:
├── PrivexBot account (create at signup if needed)
├── Some content for your bot to learn
│   ├── Option A: A few documents (PDF, Word, text files)
│   ├── Option B: A website URL to scrape
│   └── Option C: Text you can paste directly
└── A web browser

That's it. No coding required.
```

### Quick Content Ideas

Don't have content ready? Start with any of these:
- Your company's FAQ page
- A product manual or guide
- Your return/shipping policy
- Help documentation
- Any webpage with useful information

---

## Step 1: Create Your Workspace (3 Minutes)

### Sign In and Set Up

1. **Log in to PrivexBot**
2. **Create a workspace** (if you don't have one)
   - Name it something descriptive: "Customer Support" or "Product Help"
   - Workspaces keep your bots organized

```
Organization (Your Company)
    └── Workspace: "Customer Support"  ← You are here
            ├── Knowledge Bases
            └── Chatbots
```

### Why Workspaces Matter

Think of workspaces as containers:
- Each workspace has its own knowledge bases and chatbots
- Team members can be assigned to specific workspaces
- Keep different projects separated

---

## Step 2: Create Your Knowledge Base (15 Minutes)

### What's a Knowledge Base?

It's where your chatbot's knowledge lives—the content it can reference to answer questions.

```
Knowledge Base = Your Content + Smart Search

Your documents ──► Processed ──► Searchable chunks ──► AI can find answers
```

### Creating the KB

1. **Navigate to Knowledge Bases** in your workspace
2. **Click "Create Knowledge Base"**
3. **Name it descriptively**: "Product FAQ" or "Support Docs"

### Adding Content (Choose Your Method)

#### Option A: Upload Files (Easiest)

```
Supported formats:
├── PDF documents
├── Word files (.docx)
├── Text files (.txt)
├── Markdown (.md)
├── CSV/Excel (for structured data)
└── And more...
```

**Steps:**
1. Click "Add Source" → "File Upload"
2. Drag and drop your files (or click to browse)
3. Wait for upload to complete

**Tip:** Start with 2-3 files. You can always add more later.

#### Option B: Scrape a Website (Quick)

**Steps:**
1. Click "Add Source" → "Website"
2. Enter the URL to scrape
3. Choose crawl depth:
   - Single page: Just that URL
   - Shallow crawl: That page + links on it
   - Deep crawl: Multiple levels (takes longer)
4. Click "Start Scraping"

**Good URLs to start with:**
- Your FAQ page
- Help documentation
- About/product pages

#### Option C: Paste Text Directly (Fastest)

**Steps:**
1. Click "Add Source" → "Text"
2. Paste your content
3. Give it a name
4. Save

**Perfect for:**
- Quick tests
- Content you've copied from somewhere
- Information that doesn't exist as a file

### Processing Your Content

After adding sources, PrivexBot processes them:

```
Processing Pipeline:

1. Parsing ──────► Extract text from your files
2. Chunking ─────► Split into searchable pieces
3. Embedding ────► Create AI-readable vectors
4. Indexing ─────► Store in vector database

Progress: ████████████████████ 100%
```

**Wait for processing to complete.** This usually takes 1-5 minutes depending on content size.

You'll see the status change:
- "Processing..." → Working on it
- "Ready" → Good to go!

---

## Step 3: Create Your Chatbot (10 Minutes)

### Starting the Chatbot

1. **Navigate to Chatbots** in your workspace
2. **Click "Create Chatbot"**
3. **Enter basic info:**
   - Name: "Support Bot" or "FAQ Assistant"
   - Description: What this bot does

### Connecting Your Knowledge Base

This is the key step—linking your chatbot to your knowledge:

1. **Select Knowledge Base**: Choose the KB you just created
2. **Confirm connection**

```
Chatbot: "Support Bot"
    │
    └── Connected to: "Product FAQ" KB
            └── 3 sources, 150 chunks ready
```

### Configuring Behavior

#### System Prompt (What It Says)

The system prompt defines your bot's personality and rules:

```
Default (works fine to start):
"You are a helpful customer support assistant. Answer questions
based on the knowledge base. If you don't know something, say so
politely and offer to help find the answer."
```

**Customize later** with specifics:
- Company name and tone
- Specific topics to focus on
- What NOT to discuss

#### Grounding Mode (How Strict)

Choose how closely the bot sticks to your knowledge base:

| Mode | Behavior | Best For |
|------|----------|----------|
| **Strict** | Only answers from KB, says "I don't know" otherwise | Compliance-sensitive, legal |
| **Guided** | Prefers KB, adds helpful context | General support |
| **Flexible** | Uses KB as base, more conversational | Sales, engagement |

**Recommendation for first bot:** Start with **Guided**. It's the best balance.

#### Response Style

Configure how answers are formatted:
- **Concise**: Short, direct answers
- **Detailed**: Thorough explanations
- **Conversational**: Friendly, natural tone

**For support bots:** Concise or Detailed works best.

---

## Step 4: Test Your Chatbot (10 Minutes)

### Using the Preview

Before going live, test everything:

1. **Click "Preview"** in your chatbot settings
2. **A chat window opens**
3. **Start asking questions!**

### Testing Checklist

Try these types of questions:

```
Test 1: Direct Questions
"What is your return policy?"
"How do I contact support?"
→ Should answer from your KB

Test 2: Variations
"Can I return something?"
"Returns?"
→ Should still find the right answer

Test 3: Unknown Topics
"What's the weather like?"
"Tell me about quantum physics"
→ Should politely decline (if using Strict/Guided)

Test 4: Follow-ups
"What about exchanges?" (after return question)
→ Should understand context

Test 5: Edge Cases
Ask something your KB doesn't cover
→ Should say "I don't know" gracefully
```

### What to Watch For

**Good signs:**
- Accurate answers from your content
- Source citations showing where info came from
- Graceful "I don't know" for unknown topics

**Fix these:**
- Wrong answers → Check your KB content
- Too verbose → Adjust response style
- Too robotic → Update system prompt

---

## Step 5: Deploy Your Chatbot (15 Minutes)

### Deployment Options

PrivexBot supports multiple channels:

```
Deployment Channels:
├── Website Widget (embed on your site)
├── Discord Bot
├── Telegram Bot
├── WhatsApp Business
├── Direct API
└── Zapier Webhook
```

### Website Widget (Most Common)

#### Getting Your Embed Code

1. **Go to Chatbot Settings** → **Deploy**
2. **Select "Website Widget"**
3. **Copy the embed code**

```html
<!-- PrivexBot Widget -->
<script
  src="https://widget.privexbot.io/widget.js"
  data-bot-id="your-bot-id"
  data-position="bottom-right"
  data-theme="light">
</script>
```

#### Adding to Your Website

**Option A: Any HTML page**
```html
<!DOCTYPE html>
<html>
<head>
    <title>My Website</title>
</head>
<body>
    <!-- Your page content -->

    <!-- Add this before </body> -->
    <script
      src="https://widget.privexbot.io/widget.js"
      data-bot-id="your-bot-id">
    </script>
</body>
</html>
```

**Option B: WordPress**
- Use a plugin like "Insert Headers and Footers"
- Paste the code in the footer section

**Option C: Shopify**
- Go to Online Store → Themes → Edit Code
- Add to `theme.liquid` before `</body>`

**Option D: Other Platforms**
- Look for "custom code" or "embed" settings
- Add to footer/before closing body tag

#### Customizing the Widget

```html
<script
  src="https://widget.privexbot.io/widget.js"
  data-bot-id="your-bot-id"
  data-position="bottom-right"    <!-- or "bottom-left" -->
  data-theme="light"              <!-- or "dark" -->
  data-primary-color="#3b82f6"    <!-- your brand color -->
  data-welcome-message="Hi! How can I help?">
</script>
```

### Other Channels (Quick Setup)

#### Discord
1. Create a Discord application at discord.dev
2. Get your bot token
3. Enter token in PrivexBot → Deploy → Discord
4. Bot auto-registers webhooks

#### Telegram
1. Create bot via @BotFather on Telegram
2. Get your bot token
3. Enter token in PrivexBot → Deploy → Telegram
4. Webhook auto-configured

---

## Step 6: Verify It's Working (5 Minutes)

### Final Checklist

```
□ Knowledge Base
  □ Sources uploaded and processed
  □ Status shows "Ready"
  □ Content is searchable

□ Chatbot
  □ Connected to KB
  □ System prompt configured
  □ Preview testing passed

□ Deployment
  □ Embed code added to site
  □ Widget appears on page
  □ Live testing works

□ All Done!
```

### Quick Verification

1. **Visit your website** (or test environment)
2. **Look for the chat widget** (usually bottom-right)
3. **Click to open**
4. **Ask a question from your KB**
5. **Verify accurate response**

**If it works:** Congratulations! You have a live chatbot.

**If it doesn't:** Check the troubleshooting section below.

---

## Troubleshooting Quick Fixes

### Widget Doesn't Appear

```
Check these:
1. Is the script added correctly? (before </body>)
2. Is the bot-id correct?
3. Any JavaScript errors? (check browser console)
4. Is the chatbot deployed (not still in draft)?
```

### Bot Gives Wrong Answers

```
Check these:
1. Is your KB content accurate?
2. Does the KB cover this topic?
3. Is the right KB connected to the chatbot?
4. Try reprocessing the KB
```

### Bot Says "I Don't Know" Too Often

```
Check these:
1. Is your content detailed enough?
2. Are you using Strict mode? (try Guided)
3. Is the question actually in your KB?
4. Check chunking—content might be split poorly
```

### Widget Looks Wrong

```
Check these:
1. Are custom styles conflicting?
2. Try different theme setting (light/dark)
3. Adjust position if overlapping with page elements
```

---

## What's Next?

### In the Next Hour

- [ ] Add more content to your KB
- [ ] Refine your system prompt
- [ ] Test with real users
- [ ] Gather feedback

### In the Next Day

- [ ] Review conversation logs (if enabled)
- [ ] Identify gaps in your KB
- [ ] Add missing content
- [ ] Adjust response styles

### In the Next Week

- [ ] Set up additional channels (Discord, Telegram)
- [ ] Train team members on KB management
- [ ] Establish content update schedule
- [ ] Monitor performance metrics

---

## Quick Reference Card

### Keyboard Shortcuts (Dashboard)

| Action | Shortcut |
|--------|----------|
| New Knowledge Base | `N` then `K` |
| New Chatbot | `N` then `C` |
| Preview Chatbot | `P` |
| Save Changes | `Ctrl/Cmd + S` |

### URLs to Remember

```
Dashboard:     https://app.privexbot.io
API Docs:      https://app.privexbot.io/api/docs
Widget CDN:    https://widget.privexbot.io/widget.js
Status Page:   https://status.privexbot.io
```

### Support Resources

```
Documentation:  /docs
Community:      Discord server
Email:          support@privexbot.io
```

---

## Summary

```
Your First Hour Timeline:

Minutes 0-2:   Gather content, log in
Minutes 2-5:   Create workspace
Minutes 5-20:  Create KB, add content, process
Minutes 20-30: Create chatbot, configure
Minutes 30-40: Test in preview
Minutes 40-55: Deploy to website
Minutes 55-60: Verify and celebrate!

Result: A working AI chatbot answering customer questions
        with your content, protecting user privacy.
```

You did it. From zero to a live chatbot in under an hour.

Now the real work begins—iterating based on user feedback, expanding your knowledge base, and making your bot increasingly helpful. But that's a journey, not a sprint.

For now, take a moment to appreciate what you've built: an AI-powered assistant that never sleeps, never forgets, and keeps your customers' data private.

Welcome to PrivexBot.
