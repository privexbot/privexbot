# Discord Bot Deployment Guide

Deploy your PrivexBot chatbot to Discord and engage with users in your server. This guide covers the shared bot architecture, setup process, and configuration options.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Discord Developer Portal Setup](#discord-developer-portal-setup)
3. [Environment Configuration](#environment-configuration)
4. [Generate Invite URL](#generate-invite-url)
5. [Add Bot to Server](#add-bot-to-server)
6. [Deploy Chatbot to Guild](#deploy-chatbot-to-guild)
7. [Channel Restrictions](#channel-restrictions)
8. [Managing Guild Deployments](#managing-guild-deployments)
9. [Slash Commands](#slash-commands)
10. [Lead Capture from Discord](#lead-capture-from-discord)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

PrivexBot uses a **shared bot architecture** for Discord—one Discord bot application serves all your chatbots across different servers.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    PrivexBot Platform                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Chatbot A   │  │ Chatbot B   │  │ Chatbot C   │         │
│  │ (Support)   │  │ (Sales)     │  │ (FAQ)       │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│              ┌───────────▼───────────┐                     │
│              │   Shared Discord Bot   │                     │
│              │   (PrivexBot Bridge)   │                     │
│              └───────────┬───────────┘                     │
└──────────────────────────│──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Guild A      │  │  Guild B      │  │  Guild C      │
│  → Chatbot A  │  │  → Chatbot B  │  │  → Chatbot A  │
└───────────────┘  └───────────────┘  └───────────────┘
```

### Key Concepts

| Term | Definition |
|------|------------|
| **Guild** | A Discord server |
| **Shared Bot** | Single Discord bot serving multiple guilds |
| **Guild Deployment** | Linking a chatbot to a specific guild |
| **One-to-One** | Each guild connects to exactly one chatbot |

### Benefits of Shared Architecture

- One Discord app serves all your guilds
- Simplified management
- Consistent permissions and commands
- Automatic guild discovery

---

## Discord Developer Portal Setup

### Step 1: Access Developer Portal

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Log in with your Discord account
3. You'll see the Applications dashboard

### Step 2: Create Application

1. Click **New Application**
2. Enter a name (e.g., "PrivexBot Bridge")
3. Accept the Developer Terms of Service
4. Click **Create**

```
┌─────────────────────────────────────┐
│  Create an application              │
├─────────────────────────────────────┤
│                                     │
│  NAME                               │
│  ┌─────────────────────────────┐   │
│  │ PrivexBot Bridge            │   │
│  └─────────────────────────────┘   │
│                                     │
│  [✓] I agree to the Developer      │
│      Terms of Service               │
│                                     │
│  [  Cancel  ] [  Create  ]          │
└─────────────────────────────────────┘
```

### Step 3: Configure Application

In your new application:

1. **General Information:**
   - Add an app icon (your company logo)
   - Add a description
   - Note the **Application ID** (you'll need this)

2. **Save the Application ID:**
   ```
   Application ID: 123456789012345678
   ```

### Step 4: Create Bot User

1. Click **Bot** in the left sidebar
2. Click **Add Bot**
3. Confirm by clicking **Yes, do it!**

### Step 5: Configure Bot Settings

In the Bot section:

| Setting | Value | Why |
|---------|-------|-----|
| **Public Bot** | Off (recommended) | Prevent others from adding |
| **Requires OAuth2 Code Grant** | Off | Simplify authorization |
| **Message Content Intent** | ON | **Required** to read messages |
| **Server Members Intent** | Off | Not needed |
| **Presence Intent** | Off | Not needed |

**CRITICAL**: Enable **MESSAGE CONTENT INTENT**

```
┌─────────────────────────────────────┐
│  Privileged Gateway Intents         │
├─────────────────────────────────────┤
│                                     │
│  PRESENCE INTENT                    │
│  [○] Off                            │
│                                     │
│  SERVER MEMBERS INTENT              │
│  [○] Off                            │
│                                     │
│  MESSAGE CONTENT INTENT             │
│  [●] On                             │
│                                     │
│  Required to read message content   │
└─────────────────────────────────────┘
```

### Step 6: Get Bot Token

1. In the **Bot** section
2. Click **Reset Token**
3. Copy the token immediately
4. Store securely (never share or commit to git)

```
Token: MTIzNDU2Nzg5MDEyMzQ1Njc4.Gh1jKl.abcdefghijklmnopqrstuvwxyz1234567890
```

**Warning**: This token grants full control of your bot. Treat it like a password.

---

## Environment Configuration

Store Discord credentials in your PrivexBot server environment.

### Required Environment Variables

```bash
# Discord Bot Configuration
DISCORD_APP_ID=123456789012345678
DISCORD_BOT_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4.Gh1jKl.abcdefghijklmnopqrstuvwxyz
DISCORD_PUBLIC_KEY=abc123def456...  # From Developer Portal
```

### Finding the Public Key

1. Go to your application in Developer Portal
2. Click **General Information**
3. Copy the **Public Key**

This is used for interaction signature verification.

### Adding to PrivexBot

For Docker deployments, add to your `.env` file:
```
DISCORD_APP_ID=123456789012345678
DISCORD_BOT_TOKEN=your_token_here
DISCORD_PUBLIC_KEY=your_public_key_here
```

---

## Generate Invite URL

Create a URL to add your bot to Discord servers.

### Step 1: Access OAuth2 Settings

1. In Developer Portal, click **OAuth2** → **URL Generator**
2. Configure scopes and permissions

### Step 2: Select Scopes

Check these scopes:
- [x] `bot`
- [x] `applications.commands`

### Step 3: Select Bot Permissions

Minimum required permissions:

| Permission | Why |
|------------|-----|
| **Read Messages/View Channels** | See messages |
| **Send Messages** | Respond to users |
| **Send Messages in Threads** | Thread support |
| **Embed Links** | Rich responses |
| **Read Message History** | Context for conversations |
| **Use Slash Commands** | Support /ask command |

**Permission Integer:** `274877991936`

### Step 4: Copy Invite URL

The URL generator creates your invite link:

```
https://discord.com/api/oauth2/authorize?client_id=123456789012345678&permissions=274877991936&scope=bot%20applications.commands
```

Save this URL for adding the bot to servers.

---

## Add Bot to Server

### Prerequisites

You must have **Manage Server** permission in the Discord server where you want to add the bot.

### Adding the Bot

1. Open the invite URL in your browser
2. Select the server from dropdown
3. Review permissions
4. Click **Authorize**
5. Complete any CAPTCHA

```
┌─────────────────────────────────────┐
│  Add to Server                      │
├─────────────────────────────────────┤
│                                     │
│  PrivexBot Bridge wants to access   │
│  your Acme Corp server              │
│                                     │
│  Server: [Acme Corp ▼]              │
│                                     │
│  Permissions:                       │
│  ✓ Read Messages                    │
│  ✓ Send Messages                    │
│  ✓ Read Message History             │
│  ✓ Use Slash Commands               │
│                                     │
│  [  Cancel  ] [  Authorize  ]       │
└─────────────────────────────────────┘
```

### Verification

After authorization:
1. Bot appears in server member list
2. Bot has a role matching its name
3. Bot is offline until PrivexBot connects

---

## Deploy Chatbot to Guild

Now connect your PrivexBot chatbot to the Discord guild.

### Step 1: Open Channel Settings

1. Go to **Chatbots** → Select your chatbot
2. Navigate to **Channels** tab
3. Click **+ Add Channel**
4. Select **Discord**

### Step 2: Select Guild

PrivexBot auto-discovers guilds where your bot is installed:

```
Deploy to Discord
─────────────────
Available Guilds:
┌─────────────────────────────────────────────┐
│ ○ Acme Corp (234 members)                   │
│   Not connected to any chatbot              │
├─────────────────────────────────────────────┤
│ ● Customer Community (1,234 members)        │
│   Connected to: Support Bot                 │
├─────────────────────────────────────────────┤
│ ○ Partner Network (89 members)              │
│   Not connected to any chatbot              │
└─────────────────────────────────────────────┘

Select a guild to deploy this chatbot.
```

### Step 3: Configure Deployment

Select an available guild and configure:

| Option | Description |
|--------|-------------|
| **Guild** | The Discord server |
| **Response Mode** | How bot responds |
| **Allowed Channels** | Where bot can respond |

### Step 4: Deploy

1. Review configuration
2. Click **Deploy to Discord**
3. Wait for confirmation

```
Deployment Progress
───────────────────
[✓] Validating configuration...
[✓] Registering interaction endpoint...
[✓] Registering slash commands...
[✓] Discord channel deployed!

Bot is now active in: Acme Corp
```

---

## Channel Restrictions

Control where your bot responds within a guild.

### Response Modes

| Mode | Behavior |
|------|----------|
| **All Channels** | Responds in any text channel |
| **Specific Channels** | Only responds in listed channels |
| **Categories** | Responds in channels within categories |

### Configuring Allowed Channels

```
Channel Configuration
─────────────────────
Mode: [Specific Channels ▼]

Allowed Channels:
[✓] #support
[✓] #general
[ ] #announcements
[ ] #off-topic
[✓] #help-desk

Bot will only respond in checked channels.
```

### Best Practices

| Use Case | Recommended Setup |
|----------|-------------------|
| Support server | Specific support channels |
| Community | All channels (or category) |
| Testing | Single test channel |

---

## Managing Guild Deployments

### Viewing Deployments

Go to **Chatbots** → **Channels** → **Discord** to see:

```
Discord Deployments
───────────────────
┌──────────────────────────────────────────────────────────┐
│ Guild           │ Chatbot        │ Status  │ Actions    │
├──────────────────────────────────────────────────────────┤
│ Acme Corp       │ Support Bot    │ Active  │ [⚙] [✗]   │
│ Partner Network │ FAQ Bot        │ Paused  │ [⚙] [✗]   │
│ Test Server     │ Dev Bot        │ Active  │ [⚙] [✗]   │
└──────────────────────────────────────────────────────────┘
```

### Activating/Deactivating

To pause a deployment without removing:

1. Click the settings icon [⚙]
2. Toggle **Active** to Off
3. Bot stops responding but remains in guild

### Reassigning a Chatbot

To connect a different chatbot to a guild:

1. Deactivate current deployment
2. Go to the new chatbot
3. Deploy to the same guild

**Note**: Only one chatbot can be active per guild.

### Removing Deployment

To completely remove:

1. Click the delete icon [✗]
2. Confirm removal
3. Guild becomes available for other chatbots

---

## Slash Commands

PrivexBot supports Discord slash commands for structured interactions.

### Available Commands

| Command | Description |
|---------|-------------|
| `/ask [question]` | Ask the bot a question |
| `/chat [message]` | Start a conversation |
| `/reset` | Reset conversation history |
| `/help` | Show available commands |

### Using /ask

```
You: /ask How do I reset my password?

Bot: To reset your password, follow these steps:
     1. Go to the login page
     2. Click "Forgot Password"
     3. Enter your email address
     4. Check your inbox for reset link
```

### Using /chat

`/chat` initiates a multi-turn conversation:

```
You: /chat I need help with billing

Bot: I'd be happy to help with billing! What specific
     issue are you experiencing?

You: I was charged twice

Bot: I understand you were charged twice. To help resolve
     this, I'll need some information...
```

### Command Registration

Commands are automatically registered when you deploy. If commands don't appear:

1. Wait up to 1 hour (Discord caches)
2. Try kicking and re-adding the bot
3. Check bot has `applications.commands` scope

---

## Lead Capture from Discord

### Automatically Captured Data

| Field | Source | Available |
|-------|--------|-----------|
| **Discord ID** | Platform | Always |
| **Username** | Profile | Always |
| **Display Name** | Server nickname | If set |
| **Guild** | Server | Always |
| **Avatar URL** | Profile | If set |

### Viewing Discord Leads

1. Go to **Leads** in your workspace
2. Filter by **Channel** → **Discord**
3. See Discord-specific information

### Privacy Notes

- Only public Discord profile data is captured
- Cannot access email without explicit sharing
- Respects Discord's Terms of Service
- Users identified by Discord ID

---

## Troubleshooting

### Bot Not Responding

| Check | How | Solution |
|-------|-----|----------|
| Bot is online | Check server member list | Verify PrivexBot is running |
| Bot is in channel | Check channel permissions | Adjust permissions |
| MESSAGE CONTENT intent | Developer Portal | Enable the intent |
| Channel is allowed | Deployment settings | Add channel to allowlist |
| Deployment is active | PrivexBot dashboard | Activate deployment |

### "Interaction Failed" Error

**Symptom**: Slash commands show "This interaction failed"

**Causes and Solutions:**

| Cause | Solution |
|-------|----------|
| Timeout (>3 seconds) | Check server response time |
| Invalid endpoint | Verify interaction URL |
| Signature mismatch | Check public key configuration |

### Missing Slash Commands

**Symptom**: Commands don't appear in Discord

**Solutions:**

1. **Wait for propagation** (up to 1 hour)
2. **Check scopes**: Ensure `applications.commands` is included
3. **Redeploy**: Remove and re-add the channel
4. **Check permissions**: Bot needs "Use Slash Commands" permission

### Permission Errors

**"Missing Access" or "Missing Permissions"**

Check these permissions:
- View Channel
- Send Messages
- Read Message History
- Use Slash Commands

**How to Fix:**
1. Go to Server Settings → Roles
2. Find your bot's role
3. Enable required permissions
4. Or adjust channel-specific permissions

### Bot Goes Offline

**Symptom**: Bot appears offline in Discord

**Causes:**

| Cause | Solution |
|-------|----------|
| PrivexBot server down | Check server status |
| Token expired | Generate new token, update credential |
| Rate limited | Wait for rate limit reset |

### Messages Not Reaching PrivexBot

**Debug Steps:**

1. Check PrivexBot server logs
2. Verify webhook/gateway connection
3. Test with simple message
4. Check MESSAGE CONTENT intent is enabled

### Guild Not Appearing

**Symptom**: Guild doesn't show in available list

**Solutions:**

1. Verify bot is added to the guild
2. Check bot has basic permissions
3. Refresh the guild list
4. Re-add bot with correct permissions

---

## Limits and Considerations

### Discord Limits

| Limit | Value |
|-------|-------|
| **Message length** | 2000 characters |
| **Embeds per message** | 10 |
| **Rate limit** | 50 requests/second per guild |
| **Slash command options** | 25 per command |

### PrivexBot Handling

- Long responses automatically split
- Rate limits respected
- Embeds used for rich responses
- Graceful error handling

---

## Next Steps

- **[Deploy to Telegram](39-how-to-deploy-telegram-bot.md)**: Add another channel
- **[Deploy to WhatsApp](41-how-to-deploy-whatsapp-bot.md)**: Business messaging
- **[View Analytics](44-how-to-use-analytics.md)**: Monitor Discord performance

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
