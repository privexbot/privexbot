# Managing Chatbots After Deployment

Once your chatbot or chatflow is deployed, you can still modify most settings, add channels, view analytics, and manage access. This guide covers everything you can do with a live chatbot.

---

## Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Chatbot Status Management](#chatbot-status-management)
3. [Editing Chatbot Settings](#editing-chatbot-settings)
4. [Managing API Keys](#managing-api-keys)
5. [Managing Deployment Channels](#managing-deployment-channels)
6. [Testing Deployed Chatbots](#testing-deployed-chatbots)
7. [Viewing Analytics](#viewing-analytics)
8. [Updating URL Slugs](#updating-url-slugs)
9. [Hosted Page Configuration](#hosted-page-configuration)
10. [Deleting Chatbots](#deleting-chatbots)
11. [What Can't Be Changed](#what-cant-be-changed)

---

## Dashboard Overview

The chatbot dashboard provides a quick view of all your deployed bots.

### Navigating to Your Chatbots

1. Log in to PrivexBot
2. Select your **Workspace** from the sidebar
3. Click **Chatbots** (or **Chatflows** for visual workflows)

### Dashboard Layout

```
┌────────────────────────────────────────────────────────────────┐
│  Chatbots                                    [+ Create New]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ Customer Support    │  │ Sales Assistant     │             │
│  │ ● Active           │  │ ○ Paused            │             │
│  │ 1,234 conversations │  │ 567 conversations   │             │
│  │ Web, Telegram       │  │ Web only            │             │
│  │ [Manage] [Test]     │  │ [Manage] [Test]     │             │
│  └─────────────────────┘  └─────────────────────┘             │
│                                                                │
│  ┌─────────────────────┐                                      │
│  │ FAQ Bot             │                                      │
│  │ ◐ Archived          │                                      │
│  │ 89 conversations    │                                      │
│  │ [Restore] [Delete]  │                                      │
│  └─────────────────────┘                                      │
└────────────────────────────────────────────────────────────────┘
```

### Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| ● | Active | Responding to messages |
| ○ | Paused | Deployed but not responding |
| ◐ | Archived | Hidden from dashboard, can be restored |

---

## Chatbot Status Management

### Understanding Status States

| Status | API Responds | Visible in Dashboard | Use Case |
|--------|--------------|---------------------|----------|
| **Active** | Yes | Yes | Normal operation |
| **Paused** | No (returns error) | Yes | Temporary maintenance |
| **Archived** | No | Hidden (filter to view) | Discontinued bots |

### How to Pause a Chatbot

Pausing temporarily stops the bot from responding without losing any configuration.

1. Go to **Chatbots** → Select your chatbot
2. Click **Settings** tab
3. Find **Status** section
4. Click **Pause Chatbot**
5. Confirm the action

**What Happens When Paused:**
- Widget shows "Bot is currently unavailable"
- API returns 503 Service Unavailable
- Telegram/Discord/WhatsApp show offline message
- All settings and history preserved

### How to Resume a Chatbot

1. Go to **Chatbots** → Select the paused chatbot
2. Click **Settings** tab
3. Click **Resume Chatbot**
4. Bot immediately starts responding again

### How to Archive a Chatbot

Archiving removes the bot from your main dashboard but preserves all data.

1. Go to **Chatbots** → Select your chatbot
2. Click **Settings** tab → **Danger Zone**
3. Click **Archive Chatbot**
4. Confirm the action

**What Happens When Archived:**
- Removed from main chatbot list
- All data preserved (conversations, leads, analytics)
- Can be restored at any time
- Channels are deactivated

### How to Restore an Archived Chatbot

1. Go to **Chatbots**
2. Click **Filter** → Enable **Show Archived**
3. Find the archived bot
4. Click **Restore**
5. Bot returns to Paused state (activate manually)

---

## Editing Chatbot Settings

Almost all chatbot settings can be modified after deployment.

### AI Configuration

Navigate to **Settings** → **AI Configuration**

| Setting | Description | Can Change? |
|---------|-------------|-------------|
| **Model** | AI model used for responses | Yes |
| **Temperature** | Response creativity (0-1) | Yes |
| **Max Tokens** | Maximum response length | Yes |
| **Top P** | Nucleus sampling parameter | Yes |
| **Frequency Penalty** | Reduce repetition | Yes |
| **Presence Penalty** | Encourage new topics | Yes |

**Example: Making Responses More Focused**
```
Before: Temperature 0.8, Max Tokens 2000
After:  Temperature 0.3, Max Tokens 500
Result: Shorter, more precise responses
```

### System Prompt and Persona

Navigate to **Settings** → **Prompt Configuration**

| Setting | Description |
|---------|-------------|
| **System Prompt** | Base instructions for the AI |
| **Persona Name** | How the bot introduces itself |
| **Persona Description** | Bot's role and expertise |
| **Response Format** | Markdown, plain text, etc. |

**Tips for Effective Prompts:**
- Be specific about the bot's role
- Include what the bot should NOT discuss
- Specify response format preferences
- Add example responses for consistency

### Knowledge Base Connections

Navigate to **Settings** → **Knowledge Bases**

You can:
- **Add** new knowledge bases
- **Remove** existing connections
- **Reorder** priority (first KB searched first)
- **Configure** retrieval settings per KB

| Action | How |
|--------|-----|
| Add KB | Click **+ Add Knowledge Base**, select from list |
| Remove KB | Click **×** next to KB name |
| Reorder | Drag and drop to change priority |

**Note**: Only deployed knowledge bases can be connected. Draft KBs must be deployed first.

### Appearance Settings

Navigate to **Settings** → **Appearance**

| Setting | Description |
|---------|-------------|
| **Bot Name** | Display name in widget/channels |
| **Bot Avatar** | Profile image URL |
| **Primary Color** | Theme color for widget |
| **Welcome Message** | Initial greeting to users |

### Lead Capture Settings

Navigate to **Settings** → **Lead Capture**

| Setting | Options |
|---------|---------|
| **Capture Timing** | Before chat, after N messages, never |
| **Required Fields** | Email, name, phone (toggle each) |
| **Custom Fields** | Add your own fields |
| **GDPR Consent** | Enable/disable, customize text |

---

## Managing API Keys

API keys authenticate requests to private chatbots.

### Viewing API Keys

1. Go to **Chatbots** → Select your chatbot
2. Navigate to **Settings** → **API Keys**
3. View list of active keys

**Note**: Full keys are never shown after creation. You'll only see the prefix (e.g., `pk_live_abc...`).

### Creating a New API Key

1. Click **+ Create API Key**
2. Enter a **Name** (e.g., "Production Website")
3. Click **Generate**
4. **Copy the key immediately** - it won't be shown again
5. Store securely

### API Key Best Practices

| Practice | Reason |
|----------|--------|
| Use descriptive names | Know which key is used where |
| Rotate keys regularly | Limit exposure from compromised keys |
| One key per integration | Revoke individually if needed |
| Never commit to git | Use environment variables |

### Regenerating an API Key

If a key is compromised:

1. Click on the key name
2. Click **Regenerate**
3. Confirm the action
4. Copy the new key
5. Update your integration immediately

**Warning**: The old key stops working instantly.

### Deleting an API Key

1. Click on the key name
2. Click **Delete**
3. Confirm the action

**Warning**: Any integration using this key will break immediately.

---

## Managing Deployment Channels

Add or remove channels after initial deployment.

### Adding a New Channel

1. Go to **Chatbots** → Select your chatbot
2. Navigate to **Channels** tab
3. Click **+ Add Channel**
4. Select the channel type:
   - Telegram
   - Discord
   - WhatsApp
   - Widget (additional instances)
   - API

5. Follow channel-specific setup (see dedicated guides)

### Channel-Specific Settings

Each channel has its own configuration:

| Channel | Configurable Settings |
|---------|----------------------|
| **Widget** | Colors, position, lead capture |
| **Telegram** | Welcome message, typing indicator |
| **Discord** | Allowed channels, slash commands |
| **WhatsApp** | Message templates, verified sender |

### Deactivating a Channel

1. Go to **Channels** tab
2. Find the channel
3. Toggle **Active** to Off

The channel remains configured but stops responding. Useful for temporary maintenance.

### Removing a Channel

1. Go to **Channels** tab
2. Find the channel
3. Click **Remove**
4. Confirm the action

This removes the webhook registration and all channel-specific configuration.

---

## Testing Deployed Chatbots

### Built-in Test Interface

1. Go to **Chatbots** → Select your chatbot
2. Click **Test** button
3. Use the chat interface to send test messages

**Test Interface Features:**
- Real API calls (same as production)
- See response times
- View knowledge base sources
- Test different scenarios

### Testing via API

```bash
curl -X POST https://api.privexbot.com/v1/bots/YOUR_BOT_ID/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"message": "Hello, test message", "session_id": "test-123"}'
```

### Testing Checklist

| Test | What to Verify |
|------|----------------|
| Basic response | Bot responds appropriately |
| Knowledge retrieval | Answers from KB are accurate |
| Edge cases | Handles off-topic gracefully |
| Error handling | Invalid input doesn't break bot |
| Channel-specific | Test each deployed channel |

---

## Viewing Analytics

### Accessing Analytics

1. Go to **Chatbots** → Select your chatbot
2. Click **Analytics** tab

### Available Metrics

| Metric | Description |
|--------|-------------|
| **Conversations** | Total unique chat sessions |
| **Messages** | Total messages sent/received |
| **Avg Response Time** | How fast the bot responds |
| **Satisfaction Rate** | Percentage of positive feedback |
| **Token Usage** | AI tokens consumed |
| **Estimated Cost** | Approximate API costs |

### Time Period Filtering

- Last 7 days
- Last 30 days
- Last 90 days
- Custom date range

### Exporting Data

1. Click **Export** in the Analytics tab
2. Choose format (CSV or JSON)
3. Select date range
4. Download file

---

## Updating URL Slugs

The URL slug determines your chatbot's public URL and hosted page address.

### Current URL Structure

```
Hosted Page: https://chat.privexbot.com/{workspace-slug}/{chatbot-slug}
API:         https://api.privexbot.com/v1/bots/{chatbot-slug}/chat
```

### Changing the Slug

1. Go to **Settings** → **General**
2. Find **URL Slug** field
3. Enter new slug (lowercase, hyphens allowed)
4. Click **Save**

**Example:**
```
Before: my-chatbot-123
After:  customer-support
URLs:   https://chat.privexbot.com/acme/customer-support
```

### Important Notes

- Old URLs redirect to new ones automatically
- Allow a few minutes for propagation
- Update any hardcoded URLs in your integrations
- API keys remain valid after slug change

---

## Hosted Page Configuration

Each chatbot can have a customizable hosted page.

### Enabling the Hosted Page

1. Go to **Settings** → **Hosted Page**
2. Toggle **Enable Hosted Page** to On
3. Configure settings below

### Customization Options

| Setting | Description |
|---------|-------------|
| **Page Title** | Browser tab title |
| **Meta Description** | SEO description |
| **Logo** | Your company logo URL |
| **Background** | Color or image |
| **Header Text** | Welcome message above chat |
| **Footer Text** | Below chat (e.g., legal text) |

### Branding Example

```
┌────────────────────────────────────┐
│      [Your Logo]                   │
│                                    │
│   Welcome to Acme Support          │
│                                    │
│  ┌────────────────────────────┐   │
│  │                            │   │
│  │      Chat Widget           │   │
│  │                            │   │
│  └────────────────────────────┘   │
│                                    │
│   © 2024 Acme Inc. | Privacy      │
└────────────────────────────────────┘
```

### Sharing Your Hosted Page

- **Direct Link**: Copy from the settings page
- **QR Code**: Generate from dashboard for print materials
- **Embed**: Use iframe code for other sites

---

## Deleting Chatbots

### Soft Delete (Archive)

Archives preserve all data and can be restored.

1. Go to **Settings** → **Danger Zone**
2. Click **Archive Chatbot**
3. Confirm

### Permanent Delete

**Warning**: This cannot be undone. All data is permanently removed.

1. Go to **Settings** → **Danger Zone**
2. Click **Delete Permanently**
3. Type the chatbot name to confirm
4. Click **Delete**

**What Gets Deleted:**
- Chatbot configuration
- All conversation history
- All leads captured
- Analytics data
- API keys
- Channel registrations

**What Remains:**
- Connected knowledge bases (separate entities)
- Organization/workspace data
- Audit logs

---

## What Can't Be Changed

Some aspects of a deployed chatbot cannot be modified:

| Aspect | Why | Workaround |
|--------|-----|------------|
| **Bot ID** | Unique identifier | Create new bot if needed |
| **Creation Date** | Historical record | N/A |
| **Organization** | Data isolation | Create in correct org initially |
| **Workspace** | Ownership boundary | Create in correct workspace initially |
| **Conversation History** | Cannot edit past messages | N/A (can delete entire history) |

### Conversation Management Limitations

Currently, you cannot:
- View individual conversation threads in the dashboard
- Reply manually to user messages
- Edit or delete specific messages
- Export individual conversations

**Note**: Conversation data is tracked for analytics. Full conversation management UI is on the roadmap.

---

## Best Practices

### Regular Maintenance

| Task | Frequency | Purpose |
|------|-----------|---------|
| Review analytics | Weekly | Identify issues early |
| Check error rates | Weekly | Catch API problems |
| Update knowledge bases | As needed | Keep information current |
| Rotate API keys | Quarterly | Security hygiene |
| Review and refine prompts | Monthly | Improve response quality |

### Change Management

1. **Test before changing**: Use preview/test mode
2. **Change one thing at a time**: Easier to identify issues
3. **Monitor after changes**: Watch analytics for 24-48 hours
4. **Document changes**: Note what changed and why

### Security Checklist

- [ ] API keys stored securely (not in code)
- [ ] Unused API keys deleted
- [ ] Private bot if handling sensitive data
- [ ] Lead capture GDPR-compliant
- [ ] Regular access review

---

## Next Steps

- **[View Analytics](44-how-to-use-analytics.md)**: Deep dive into bot performance
- **[Manage Knowledge Bases](37-how-to-manage-knowledge-bases.md)**: Update your bot's knowledge
- **[Add Telegram](39-how-to-deploy-telegram-bot.md)**: Expand to messaging platforms
- **[Troubleshoot Issues](50-troubleshooting-guide.md)**: Fix common problems

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
