# Telegram Bot Token Setup Guide

This guide explains how to create a Telegram bot and obtain the bot token for use with your chatbots.

---

## Overview

| Field | Value |
|-------|-------|
| **Service** | Telegram Bot API |
| **Authentication Type** | Bot Token |
| **Token Format** | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` |
| **Cost** | Free |
| **Rate Limits** | 30 messages/second (to same chat), 20 messages/minute (to same group) |

---

## Prerequisites

- A Telegram account
- Telegram app installed on your device (mobile or desktop)

---

## Step-by-Step Instructions

### Step 1: Open BotFather

BotFather is Telegram's official bot for creating and managing bots.

1. Open Telegram on your device
2. Search for **@BotFather** in the search bar
3. Click on the verified **BotFather** account (look for the blue checkmark)
4. Click **"Start"** to begin the conversation

> **Warning**: Make sure you're chatting with the official @BotFather (with verification badge). There are fake accounts!

### Step 2: Create a New Bot

1. Send the command: `/newbot`
2. BotFather will ask for a **name** for your bot:
   - This is the display name users will see
   - Example: `My Support Bot`
   - Can contain spaces and special characters
3. BotFather will ask for a **username** for your bot:
   - Must end with `bot` (e.g., `my_support_bot` or `MySupportBot`)
   - Must be unique across all of Telegram
   - Can only contain letters, numbers, and underscores
   - Example: `privexbot_support_bot`

### Step 3: Receive Your Bot Token

After creating the bot, BotFather will send you a message containing:

```
Done! Congratulations on your new bot. You will find it at t.me/your_bot_username.

Use this token to access the HTTP API:
123456789:ABCdefGHIjklMNOpqrsTUVwxyz

For a description of the Bot API, see this page: https://core.telegram.org/bots/api
```

> **IMPORTANT**: Copy this token immediately and store it securely. Anyone with this token can control your bot!

### Step 4: Configure Your Bot (Optional but Recommended)

#### Set Bot Description

The description appears when users open a chat with your bot for the first time.

```
/setdescription
```

1. Select your bot from the list
2. Enter a description (up to 512 characters)
3. Example: "I'm an AI-powered support assistant. Ask me anything about our products and services!"

#### Set Bot About Text

The "About" text appears in the bot's profile.

```
/setabouttext
```

1. Select your bot
2. Enter the about text (up to 120 characters)
3. Example: "24/7 AI Customer Support Bot"

#### Set Bot Profile Picture

```
/setuserpic
```

1. Select your bot
2. Send an image (recommended: 512x512 pixels, square)

#### Set Bot Commands

Commands appear in the menu when users type `/` in the chat.

```
/setcommands
```

1. Select your bot
2. Send commands in the format:
```
start - Start the bot
help - Get help information
about - Learn about this bot
```

#### Enable Inline Mode (Optional)

Allows users to use your bot in any chat by typing `@yourbotusername`.

```
/setinline
```

#### Enable Group Privacy Mode

By default, bots in groups only receive messages that:
- Start with `/`
- Mention the bot
- Are replies to the bot's messages

To receive all messages in groups:

```
/setprivacy
```

Select your bot, then choose **Disable**.

> **Note**: This is required if your bot needs to respond to all messages in a group.

---

## Adding to PrivexBot

1. Go to **Settings > API Credentials** in PrivexBot
2. Click **"Add Credential"**
3. Select **"Telegram Bot"** as the service type
4. Enter a descriptive name (e.g., "Production Telegram Bot")
5. Paste your bot token in the **"API Key / Bot Token"** field
6. Click **"Add Credential"**

---

## Bot Token Security

### Best Practices

- **Never share** your bot token publicly
- **Never commit** tokens to version control (Git)
- **Regenerate** the token if compromised
- Store tokens in **environment variables** or a secure vault

### Regenerating a Compromised Token

If your token is compromised:

1. Open @BotFather
2. Send `/revoke`
3. Select your bot
4. BotFather will generate a new token
5. Update your applications with the new token immediately

> **Warning**: The old token will stop working immediately after regeneration.

---

## Useful BotFather Commands

| Command | Description |
|---------|-------------|
| `/newbot` | Create a new bot |
| `/mybots` | List all your bots |
| `/setname` | Change bot's display name |
| `/setdescription` | Set bot description |
| `/setabouttext` | Set bot about text |
| `/setuserpic` | Set bot profile picture |
| `/setcommands` | Set bot commands |
| `/deletebot` | Delete a bot |
| `/token` | Get current token |
| `/revoke` | Revoke and regenerate token |
| `/setinline` | Enable/disable inline mode |
| `/setinlinegeo` | Enable inline location requests |
| `/setjoingroups` | Allow bot to be added to groups |
| `/setprivacy` | Set group privacy mode |

---

## Webhook Configuration

When deploying your bot with PrivexBot, webhooks are automatically configured. However, for reference:

### Webhook URL Format

```
https://your-domain.com/api/v1/webhooks/telegram/{bot_id}
```

### Manual Webhook Setup (if needed)

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/webhook"}'
```

### Check Webhook Status

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### Remove Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

---

## Rate Limits

Telegram enforces the following rate limits:

| Context | Limit |
|---------|-------|
| Messages to same chat | 30 per second |
| Messages to same group | 20 per minute |
| Bulk notifications | 30 messages per second overall |
| Inline query results | 50 results max |

> **Tip**: Implement message queuing to avoid hitting rate limits.

---

## Troubleshooting

### "Unauthorized" Error (401)

- The bot token is invalid or revoked
- Regenerate the token using `/revoke` in BotFather

### "Bot was blocked by the user" Error

- The user has blocked your bot
- Cannot send messages until they unblock

### "Chat not found" Error

- The chat ID is invalid
- The bot was removed from the group/channel
- The bot hasn't received a message from that chat yet

### "Too many requests" Error (429)

- Rate limit exceeded
- Implement exponential backoff
- Space out your messages

### Bot Not Responding in Groups

- Enable group privacy mode: `/setprivacy` → Disable
- Ensure the bot has admin rights (if required)
- Check if the bot was added correctly

### Messages Not Received

- Verify webhook is correctly set up
- Check if webhook URL is accessible
- Ensure SSL certificate is valid

---

## Testing Your Bot

### Get Bot Information

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "id": 123456789,
    "is_bot": true,
    "first_name": "My Support Bot",
    "username": "my_support_bot",
    "can_join_groups": true,
    "can_read_all_group_messages": false,
    "supports_inline_queries": false
  }
}
```

### Send a Test Message

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "YOUR_CHAT_ID", "text": "Hello, World!"}'
```

> **Tip**: Get your chat ID by messaging your bot and calling `/getUpdates`.

---

## Useful Links

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather](https://t.me/BotFather)
- [Telegram Bot FAQ](https://core.telegram.org/bots/faq)
- [Bot Code Examples](https://core.telegram.org/bots/samples)
- [Telegram API Status](https://telegram.org/blog)

---

## Support

If you encounter issues:

1. Check the [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
2. Visit [Telegram Bot Talk Group](https://t.me/BotTalk)
3. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/telegram-bot)
