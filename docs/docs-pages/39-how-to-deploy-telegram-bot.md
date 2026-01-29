# Telegram Bot Deployment Guide

Deploy your PrivexBot chatbot to Telegram and reach users on one of the world's most popular messaging platforms. This guide walks you through the complete setup process.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [BotFather Setup](#botfather-setup)
3. [Adding Credential in PrivexBot](#adding-credential-in-privexbot)
4. [Deploying Chatbot to Telegram](#deploying-chatbot-to-telegram)
5. [How Messages Work](#how-messages-work)
6. [Configuration Options](#configuration-options)
7. [Session Management](#session-management)
8. [Lead Auto-Capture](#lead-auto-capture)
9. [Rate Limits](#rate-limits)
10. [Testing Your Telegram Bot](#testing-your-telegram-bot)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

- [ ] A PrivexBot account with an active workspace
- [ ] A deployed chatbot or chatflow (not draft)
- [ ] A Telegram account
- [ ] Access to Telegram on mobile or desktop

**Important**: Your PrivexBot server must be accessible via a **public HTTPS URL** for Telegram webhooks to work. Local development requires a tunneling service like ngrok.

---

## BotFather Setup

BotFather is Telegram's official bot for creating and managing bots. Follow these steps carefully.

### Step 1: Start BotFather

1. Open Telegram
2. Search for **@BotFather**
3. Start a chat with BotFather
4. Verify you're chatting with the official bot (blue checkmark)

```
┌─────────────────────────────────────┐
│ 🤖 BotFather                    ✓  │
├─────────────────────────────────────┤
│                                     │
│  I am the BotFather. I can help    │
│  you create and manage your bots.  │
│                                     │
│  /newbot - create a new bot        │
│  /mybots - manage your bots        │
│                                     │
└─────────────────────────────────────┘
```

### Step 2: Create a New Bot

1. Send `/newbot` to BotFather
2. BotFather asks for a **name** (display name)
   - Example: "Acme Support Bot"
   - This is what users see in chats
3. BotFather asks for a **username**
   - Must end in "bot" or "_bot"
   - Example: "acme_support_bot"
   - Must be unique across all of Telegram

```
You: /newbot

BotFather: Alright, a new bot. How are we going to call it?
           Please choose a name for your bot.

You: Acme Support Bot

BotFather: Good. Now let's choose a username for your bot.
           It must end in `bot`. Like this, for example:
           TetrisBot or tetris_bot.

You: acme_support_bot

BotFather: Done! Congratulations on your new bot. You will
           find it at t.me/acme_support_bot.

           Use this token to access the HTTP API:
           123456789:ABCdefGHIjklMNOpqrsTUVwxyz

           Keep your token secure and store it safely.
```

### Step 3: Save Your Bot Token

**IMPORTANT**: Copy and save the bot token immediately. It looks like:
```
123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

This token:
- Grants full control of your bot
- Should never be shared publicly
- Should never be committed to git
- Can be regenerated if compromised

### Step 4: Configure Bot Settings (Optional)

Customize your bot with these BotFather commands:

| Command | Purpose |
|---------|---------|
| `/setname` | Change display name |
| `/setdescription` | Bot description (shown on profile) |
| `/setabouttext` | Short about text |
| `/setuserpic` | Set profile picture |
| `/setcommands` | Define slash commands |

**Recommended Settings:**

1. **Set Description:**
   ```
   /setdescription
   @acme_support_bot
   Get instant help from our AI assistant! Ask questions
   about our products, services, or get support 24/7.
   ```

2. **Set Profile Picture:**
   - Use your company logo or brand image
   - Square image, at least 512x512 pixels

3. **Set Commands (optional):**
   ```
   /setcommands
   @acme_support_bot
   start - Start a conversation
   help - Get help using this bot
   reset - Start a new conversation
   ```

---

## Adding Credential in PrivexBot

Store your Telegram bot token securely in PrivexBot.

### Step 1: Navigate to Credentials

1. Log in to PrivexBot
2. Go to your **Workspace**
3. Click **Credentials** in the sidebar

### Step 2: Create Telegram Credential

1. Click **+ Add Credential**
2. Select **Telegram Bot** as the type
3. Fill in the form:

```
Add Telegram Credential
───────────────────────
Name: Acme Telegram Bot
      (internal reference name)

Bot Token: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
           (from BotFather)

Bot Username: @acme_support_bot
              (optional, for reference)

[  Cancel  ] [  Save Credential  ]
```

4. Click **Save Credential**

### Step 3: Verify Credential

After saving:
- Credential appears in your list
- Token is encrypted at rest
- Ready to use in deployments

---

## Deploying Chatbot to Telegram

### Option A: During Initial Chatbot Deployment

1. Create or open your chatbot
2. Complete configuration
3. Click **Deploy**
4. In the deployment wizard:
   - Enable **Telegram** channel
   - Select your Telegram credential
   - Configure channel options
5. Complete deployment

### Option B: Add to Existing Chatbot

1. Go to **Chatbots** → Select your deployed chatbot
2. Navigate to **Channels** tab
3. Click **+ Add Channel**
4. Select **Telegram**
5. Choose your Telegram credential
6. Configure options
7. Click **Deploy to Telegram**

### What Happens During Deployment

1. PrivexBot calls Telegram's `setWebhook` API
2. Telegram registers your server URL as the webhook endpoint
3. A secret token is generated for verification
4. Deployment status is confirmed

```
Deployment Progress
───────────────────
[✓] Validating credential...
[✓] Registering webhook with Telegram...
[✓] Verifying webhook registration...
[✓] Telegram channel deployed!

Your bot is now live at: t.me/acme_support_bot
```

---

## How Messages Work

Understanding the message flow helps with debugging and optimization.

### Message Flow Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Telegram   │     │   PrivexBot  │     │   Secret AI  │
│    User      │     │    Server    │     │   (LLM)      │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. User sends      │                    │
       │    message         │                    │
       │───────────────────▶│                    │
       │                    │                    │
       │                    │ 2. Webhook POST    │
       │                    │    with update     │
       │                    │                    │
       │                    │ 3. Verify secret   │
       │                    │    token           │
       │                    │                    │
       │                    │ 4. Process message │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │ 5. AI response     │
       │                    │◀───────────────────│
       │                    │                    │
       │ 6. Send response   │                    │
       │◀───────────────────│                    │
       │                    │                    │
```

### Technical Details

| Aspect | Detail |
|--------|--------|
| **Webhook URL** | `https://your-domain.com/api/v1/telegram/webhook/{bot_id}` |
| **Verification** | Secret token in `X-Telegram-Bot-Api-Secret-Token` header |
| **Update Format** | JSON with message, chat, and user data |
| **Response Method** | `sendMessage` API call |

### Webhook Security

PrivexBot verifies every incoming request:

1. Checks `X-Telegram-Bot-Api-Secret-Token` header
2. Validates against stored secret
3. Rejects requests with invalid/missing tokens

This prevents unauthorized requests from reaching your bot.

---

## Configuration Options

### Channel Settings

Navigate to **Channels** → **Telegram** to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| **Welcome Message** | Sent when user first starts | "Hello! How can I help you?" |
| **Typing Indicator** | Show "typing..." while processing | Enabled |
| **Parse Mode** | Message formatting | Markdown |

### Welcome Message

Customize the greeting when users first interact:

```
Welcome Message Settings
────────────────────────
Message:
┌─────────────────────────────────────────────────────┐
│ 👋 Welcome to Acme Support!                        │
│                                                     │
│ I'm your AI assistant. I can help you with:        │
│ • Product questions                                 │
│ • Order status                                      │
│ • Technical support                                 │
│                                                     │
│ Just type your question to get started!            │
└─────────────────────────────────────────────────────┘

Send welcome message: [✓] When user sends /start
                      [ ] On first message
```

### Typing Indicator

When enabled:
- Bot shows "typing..." status while generating response
- Provides feedback that message was received
- Automatically disappears when response is sent

### Access Control

Control who can use your bot:

```
Access Control
──────────────
Mode: [Anyone can use ▼]

Options:
• Anyone can use
• Allowlist only (specify users/groups)
• Blocklist (block specific users/groups)

Allowlist:
┌─────────────────────────────────────────────────────┐
│ @username1                                          │
│ @username2                                          │
│ 123456789 (user ID)                                │
└─────────────────────────────────────────────────────┘
```

---

## Session Management

### How Sessions Work

Each Telegram user gets a unique session:

| Identifier | Description |
|------------|-------------|
| **Chat ID** | Unique ID for the conversation |
| **User ID** | Telegram user identifier |
| **Session ID** | PrivexBot internal session |

Sessions maintain:
- Conversation history
- Context for follow-up questions
- User preferences

### Session Persistence

- Sessions persist across bot restarts
- History maintained for configured duration
- Sessions can be reset by user with `/reset` command

### Implementing /reset Command

1. Add command via BotFather:
   ```
   /setcommands
   reset - Start a fresh conversation
   ```

2. PrivexBot automatically handles `/reset`:
   - Clears conversation history
   - Starts new session
   - Sends confirmation message

---

## Lead Auto-Capture

Telegram provides user data automatically—no form needed.

### Captured Data

| Data | Source | Availability |
|------|--------|--------------|
| **Telegram ID** | Platform | Always |
| **First Name** | Profile | Always |
| **Last Name** | Profile | If set |
| **Username** | Profile | If public |
| **Language** | Settings | Usually |

### When Leads are Created

Leads are captured when:
1. User sends their first message
2. Lead capture is enabled for the chatbot
3. User data is available from Telegram

### Privacy Considerations

- Only public profile data is captured
- Users control their Telegram privacy settings
- Respect user privacy preferences
- Cannot capture phone/email without explicit sharing

---

## Rate Limits

### Telegram's Rate Limits

| Limit | Value |
|-------|-------|
| **Messages per second** | 30 per bot |
| **Messages per chat** | 1 per second |
| **Bulk notifications** | 30 per second |
| **Message length** | 4096 characters |

### PrivexBot Handling

PrivexBot automatically:
- Queues messages to stay within limits
- Splits long responses (>4096 chars) into multiple messages
- Retries on temporary failures
- Respects Telegram's rate limits

### If You Hit Rate Limits

Symptoms:
- Delayed responses
- "Too many requests" errors in logs

Solutions:
1. Check for bot spam/abuse
2. Implement user-level rate limiting
3. Contact support for high-volume needs

---

## Testing Your Telegram Bot

### Basic Test Checklist

| Test | Expected Result |
|------|-----------------|
| Send `/start` | Welcome message appears |
| Send question | AI responds appropriately |
| Send follow-up | Context is maintained |
| Send `/reset` | New session started |
| Send long message | Processed correctly |

### Testing Steps

1. **Find Your Bot:**
   - Search for your bot username in Telegram
   - Or use link: `t.me/your_bot_username`

2. **Start Conversation:**
   ```
   You: /start

   Bot: 👋 Welcome to Acme Support!
        I'm your AI assistant...
   ```

3. **Test Basic Q&A:**
   ```
   You: What are your business hours?

   Bot: Our business hours are Monday to Friday,
        9 AM to 5 PM EST. Is there anything
        else I can help you with?
   ```

4. **Test Knowledge Base (if connected):**
   ```
   You: How do I reset my password?

   Bot: To reset your password, follow these steps:
        1. Go to the login page
        2. Click "Forgot Password"
        ...

        Source: user-guide.pdf, page 23
   ```

5. **Test Edge Cases:**
   - Very long messages
   - Multiple rapid messages
   - Special characters and emoji
   - Messages with images (should inform text-only)

### Debug Mode

Enable debug logging in PrivexBot:
1. Go to **Settings** → **Developer**
2. Enable **Debug Telegram Webhooks**
3. View webhook payloads in logs

---

## Troubleshooting

### Bot Not Responding

**Symptoms**: Messages sent but no response

| Check | How | Solution |
|-------|-----|----------|
| Webhook registered | PrivexBot dashboard | Redeploy channel |
| Server accessible | Check URL publicly | Fix DNS/firewall |
| Credential valid | Test token | Update credential |
| Bot not blocked | Check Telegram | User must unblock |
| Channel active | Dashboard | Activate channel |

**Debug Steps:**

1. Check channel status in PrivexBot dashboard
2. Verify webhook URL is accessible:
   ```bash
   curl https://your-domain.com/api/v1/telegram/webhook/test
   ```
3. Check server logs for errors
4. Try redeploying the channel

### Webhook Errors

**Error: "Webhook was not set"**

Cause: Webhook registration failed

Solution:
1. Verify server is publicly accessible
2. Ensure HTTPS with valid certificate
3. Redeploy Telegram channel

**Error: "Unauthorized"**

Cause: Invalid bot token

Solution:
1. Verify token in BotFather
2. Update credential in PrivexBot
3. Redeploy channel

**Error: "Bad webhook: HTTPS required"**

Cause: Using HTTP instead of HTTPS

Solution:
- Ensure your server uses HTTPS
- Use valid SSL certificate (not self-signed)

### Messages Not Delivered

| Symptom | Cause | Solution |
|---------|-------|----------|
| Delayed responses | Rate limiting | Check rate limits |
| Partial response | Message too long | Responses auto-split |
| Formatting issues | Parse mode | Check Markdown syntax |

### Public URL Requirement

Telegram requires a **public HTTPS URL** for webhooks.

**For Local Development:**

Use ngrok or similar tunneling:
```bash
ngrok http 8000
```

Then update your server configuration to use the ngrok URL.

**For Production:**
- Deploy to a cloud provider
- Use a proper domain with SSL
- Ensure firewall allows incoming HTTPS

### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Bot was blocked" | User blocked your bot | Cannot message, they must unblock |
| "Chat not found" | Invalid chat ID | Verify chat exists |
| "Message too long" | >4096 characters | PrivexBot auto-splits |
| "Too many requests" | Rate limited | Reduce message frequency |

---

## Advanced Configuration

### Custom Commands

Define commands for your bot:

1. In BotFather: `/setcommands`
2. Add your commands:
   ```
   start - Start the conversation
   help - Get help
   reset - Clear conversation history
   contact - Get contact information
   ```

### Group Chat Support

To use your bot in groups:

1. In BotFather: `/setjoingroups`
2. Enable: "Groups can add this bot"
3. Set privacy mode with `/setprivacy`
   - **Disabled**: Bot sees all messages
   - **Enabled**: Bot only sees commands and replies

### Inline Mode (Advanced)

Enable inline queries for use in any chat:
```
/setinline
@your_bot Write a query...
```

---

## Next Steps

- **[Deploy to Discord](40-how-to-deploy-discord-bot.md)**: Add another channel
- **[Manage Leads](38-how-to-manage-leads.md)**: Track Telegram users
- **[View Analytics](44-how-to-use-analytics.md)**: Monitor Telegram performance
- **[Troubleshooting](50-troubleshooting-guide.md)**: More solutions

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
