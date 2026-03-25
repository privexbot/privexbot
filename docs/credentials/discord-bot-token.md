# Discord Bot Token Setup Guide

This guide explains how to create a Discord bot application and obtain the bot token for use with your chatbots.

---

## Overview

| Field | Value |
|-------|-------|
| **Service** | Discord Bot API |
| **Authentication Type** | Bot Token |
| **Token Format** | Long base64-encoded string (e.g., `MTIzNDU2Nzg5...`) |
| **Cost** | Free |
| **Rate Limits** | 50 requests/second globally, varies by endpoint |

---

## Prerequisites

- A Discord account
- A Discord server where you have **Manage Server** permission (to add the bot)

---

## Step-by-Step Instructions

### Step 1: Access Discord Developer Portal

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Log in with your Discord account
3. You'll see the "Applications" page

### Step 2: Create a New Application

1. Click the **"New Application"** button (top right)
2. Enter a name for your application:
   - This is the name of your app (not the bot's display name yet)
   - Example: `PrivexBot Support`
3. Accept the Discord Developer Terms of Service
4. Click **"Create"**

### Step 3: Configure Your Application (Optional)

On the **General Information** page:

1. **App Icon**: Upload an image for your application
2. **Description**: Add a description of what your bot does
3. **Tags**: Add relevant tags for discovery
4. Click **"Save Changes"**

### Step 4: Create the Bot User

1. Click **"Bot"** in the left sidebar
2. Click **"Add Bot"** button
3. Confirm by clicking **"Yes, do it!"**
4. Your bot is now created!

### Step 5: Configure Bot Settings

On the Bot page, configure the following:

#### Bot Username and Avatar
- **Username**: Click the edit icon to change the bot's display name
- **Icon**: Upload a profile picture for your bot

#### Authorization Flow
- **Public Bot**:
  - ✅ ON: Anyone can add your bot to their servers
  - ❌ OFF: Only you can add the bot (recommended for private use)
- **Requires OAuth2 Code Grant**: Leave OFF (unless you need OAuth2 flow)

#### Privileged Gateway Intents

> **IMPORTANT**: These are required for certain bot features!

| Intent | Required For | Enable? |
|--------|-------------|---------|
| **Presence Intent** | Tracking user online/offline status | Optional |
| **Server Members Intent** | Accessing member list, member join/leave events | Recommended |
| **Message Content Intent** | Reading message content in servers | **Required** |

For PrivexBot chatbots, enable:
- ✅ **Message Content Intent** (required to read and respond to messages)
- ✅ **Server Members Intent** (recommended for user context)

### Step 6: Get Your Bot Token

1. On the Bot page, find the **"Token"** section
2. Click **"Reset Token"** (if you haven't copied it before) or **"Copy"**
3. Confirm the token reset if prompted
4. **Copy the token immediately**

> **CRITICAL SECURITY WARNING**:
> - This token gives full access to your bot
> - Never share it publicly
> - Never commit it to version control
> - If compromised, reset it immediately

### Step 7: Generate Bot Invite URL

1. Click **"OAuth2"** in the left sidebar
2. Click **"URL Generator"**
3. Under **Scopes**, select:
   - ✅ `bot`
   - ✅ `applications.commands` (for slash commands)

4. Under **Bot Permissions**, select the permissions your bot needs:

   **Recommended minimum permissions:**
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Send Messages in Threads
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Add Reactions
   - ✅ Use Slash Commands

   **Optional permissions:**
   - Manage Messages (for moderation features)
   - Mention Everyone (for announcements)

5. Copy the **Generated URL** at the bottom

### Step 8: Add Bot to Your Server

1. Open the generated URL in your browser
2. Select the server you want to add the bot to
3. Review the permissions
4. Click **"Authorize"**
5. Complete the CAPTCHA
6. Your bot is now in your server!

---

## Adding to PrivexBot

1. Go to **Settings > API Credentials** in PrivexBot
2. Click **"Add Credential"**
3. Select **"Discord Bot"** as the service type
4. Enter a descriptive name (e.g., "Production Discord Bot")
5. Paste your bot token in the **"API Key / Bot Token"** field
6. Click **"Add Credential"**

---

## Bot Token Security

### Best Practices

- **Never share** your bot token with anyone
- **Never commit** tokens to Git or public repositories
- Store tokens in **environment variables** or secure vaults
- **Rotate** tokens periodically or if team members leave
- Use **separate bots** for development and production

### Resetting a Compromised Token

If your token is leaked:

1. Go to [Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to **Bot** section
4. Click **"Reset Token"**
5. Copy the new token
6. Update all applications using the old token

> **Warning**: The old token stops working immediately!

---

## Understanding Permissions

### Permission Integer

Discord uses a permission integer to define bot capabilities. Here are common values:

| Permission | Value | Description |
|------------|-------|-------------|
| Read Messages | 1024 | View channels and read messages |
| Send Messages | 2048 | Send messages in text channels |
| Embed Links | 16384 | Embed links in messages |
| Attach Files | 32768 | Upload images and files |
| Read History | 65536 | Access older messages |
| Add Reactions | 64 | React to messages |
| Manage Messages | 8192 | Delete/pin messages |
| Administrator | 8 | Full server control (use carefully!) |

### Recommended Permission Integer

For a typical chatbot: `274877991936`

This includes:
- Read/Send Messages
- Embed Links
- Attach Files
- Read History
- Add Reactions
- Use Slash Commands

---

## Gateway Intents Explained

Discord requires you to specify which events your bot needs:

### Standard Intents (No approval needed)
- `GUILDS` - Server info
- `GUILD_MESSAGES` - Message events (not content)
- `DIRECT_MESSAGES` - DM events

### Privileged Intents (Must enable in portal)
- `MESSAGE_CONTENT` - Read message text (**Required for chatbots**)
- `GUILD_MEMBERS` - Member events
- `GUILD_PRESENCES` - Online status

> **Note**: Bots in 100+ servers need Discord approval for privileged intents.

---

## Webhook Configuration

PrivexBot uses webhooks to receive Discord events. When deployed:

### Webhook URL Format
```
https://your-domain.com/api/v1/webhooks/discord/{bot_id}
```

### Interaction Endpoint URL

For slash commands, set the Interaction Endpoint URL:
1. Go to your application in Developer Portal
2. Navigate to **General Information**
3. Enter your **Interactions Endpoint URL**
4. Discord will verify the endpoint

---

## Rate Limits

Discord enforces strict rate limits:

| Endpoint Type | Limit |
|--------------|-------|
| Global | 50 requests/second |
| Per Route | Varies (check headers) |
| Message Send | 5 messages/5 seconds per channel |
| Bulk Delete | 1 request/second |
| Gateway | 120 events/minute |

### Rate Limit Headers
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp
- `Retry-After` - Wait time (when rate limited)

---

## Troubleshooting

### "401: Unauthorized" Error

- Token is invalid, expired, or revoked
- Reset the token in Developer Portal

### "403: Missing Permissions" Error

- Bot lacks required permissions
- Re-invite the bot with correct permissions
- Check server-level permission overrides

### "Missing Access" Error

- Bot cannot see the channel
- Check channel permission overrides
- Ensure bot role has channel access

### "Unknown Message" Error

- Message was deleted
- Message ID is incorrect
- Bot cannot access the message's channel

### Bot Not Responding

1. Check if bot is online in your server
2. Verify **Message Content Intent** is enabled
3. Check channel permissions
4. Verify webhook is correctly configured

### "Disallowed Intents" Error

- You need to enable privileged intents in Developer Portal
- For 100+ servers, apply for verification

---

## Testing Your Bot

### Check Bot Status

```bash
curl -H "Authorization: Bot YOUR_BOT_TOKEN" \
  https://discord.com/api/v10/users/@me
```

Expected response:
```json
{
  "id": "123456789",
  "username": "MyBot",
  "discriminator": "0",
  "bot": true,
  "verified": true
}
```

### Get Server List

```bash
curl -H "Authorization: Bot YOUR_BOT_TOKEN" \
  https://discord.com/api/v10/users/@me/guilds
```

### Send a Test Message

```bash
curl -X POST \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, World!"}' \
  https://discord.com/api/v10/channels/CHANNEL_ID/messages
```

---

## Slash Commands Setup

For slash commands (recommended over prefix commands):

1. Register commands via API or library
2. Set Interaction Endpoint URL in Developer Portal
3. Handle interaction webhooks in your application

### Global vs Guild Commands

| Type | Propagation | Use Case |
|------|-------------|----------|
| Global | Up to 1 hour | Production |
| Guild | Instant | Development/Testing |

---

## Useful Links

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord API Documentation](https://discord.com/developers/docs)
- [Bot Permissions Calculator](https://discordapi.com/permissions.html)
- [Discord.js Guide](https://discordjs.guide/) (JavaScript library)
- [Discord.py Documentation](https://discordpy.readthedocs.io/) (Python library)
- [Discord API Status](https://discordstatus.com/)
- [Developer Server](https://discord.gg/discord-developers)

---

## Support

If you encounter issues:

1. Check [Discord API Documentation](https://discord.com/developers/docs)
2. Visit [Discord Developers Server](https://discord.gg/discord-developers)
3. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/discord)
4. Check [Discord API GitHub Issues](https://github.com/discord/discord-api-docs/issues)
