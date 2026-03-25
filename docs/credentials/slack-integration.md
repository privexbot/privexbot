# Slack Integration Setup Guide

This guide explains how to create a Slack app and obtain the bot token for deploying your chatbot to Slack workspaces.

---

## Overview

| Field | Value |
|-------|-------|
| **Service** | Slack Bot API |
| **Authentication Type** | OAuth 2.0 / Bot Token |
| **Token Format** | `xoxb-...` (Bot Token) |
| **Cost** | Free (Standard Slack API) |
| **Rate Limits** | Tier-based (varies by method) |

---

## Prerequisites

- A Slack account
- Access to a Slack workspace (preferably as admin)
- A Slack workspace to install the app

---

## Step-by-Step Instructions

### Step 1: Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Fill in:
   - **App Name**: e.g., "PrivexBot Assistant"
   - **Workspace**: Select your development workspace
5. Click **"Create App"**

### Step 2: Configure Bot User

1. In the left sidebar, click **"App Home"**
2. Scroll to **"App Display Name"** section
3. Click **"Edit"**
4. Set:
   - **Display Name**: The name users see (e.g., "Support Bot")
   - **Default Username**: The @mention name (e.g., "supportbot")
5. Click **"Save"**
6. Under **"Show Tabs"**, enable:
   - ✅ **Messages Tab**: Allow DMs with the bot
   - ✅ **Allow users to send Slash commands**: Enable if using commands

### Step 3: Configure OAuth & Permissions

1. Click **"OAuth & Permissions"** in the left sidebar
2. Scroll to **"Scopes"** section
3. Under **"Bot Token Scopes"**, add required scopes:

#### Required Scopes

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Receive @mentions |
| `channels:history` | Read public channel messages |
| `channels:read` | View public channel info |
| `chat:write` | Send messages |
| `im:history` | Read DM messages |
| `im:read` | View DM info |
| `im:write` | Start DMs |
| `users:read` | View user info |

#### Optional Scopes

| Scope | Purpose |
|-------|---------|
| `channels:join` | Auto-join public channels |
| `files:read` | Access shared files |
| `files:write` | Upload files |
| `groups:history` | Read private channel messages |
| `groups:read` | View private channel info |
| `reactions:read` | View reactions |
| `reactions:write` | Add reactions |

### Step 4: Install App to Workspace

1. Scroll up to **"OAuth Tokens for Your Workspace"**
2. Click **"Install to Workspace"**
3. Review the permissions
4. Click **"Allow"**
5. Copy the **"Bot User OAuth Token"** (starts with `xoxb-`)

> **IMPORTANT**: Save this token securely! You won't see it again unless you reinstall.

### Step 5: Enable Event Subscriptions

1. Click **"Event Subscriptions"** in the left sidebar
2. Toggle **"Enable Events"** to ON
3. Enter your **Request URL**:
   ```
   https://your-domain.com/api/v1/webhooks/slack/{bot_id}
   ```
4. Slack will verify your endpoint (must respond with challenge)
5. Under **"Subscribe to bot events"**, add:

| Event | Description |
|-------|-------------|
| `app_mention` | When bot is @mentioned |
| `message.im` | Direct messages to bot |
| `message.channels` | Messages in public channels |
| `message.groups` | Messages in private channels (optional) |

6. Click **"Save Changes"**

### Step 6: Configure Interactivity (Optional)

For interactive buttons, menus, and modals:

1. Click **"Interactivity & Shortcuts"** in sidebar
2. Toggle **"Interactivity"** to ON
3. Enter **Request URL**:
   ```
   https://your-domain.com/api/v1/webhooks/slack/{bot_id}/interactive
   ```
4. Click **"Save Changes"**

### Step 7: Add Slash Commands (Optional)

1. Click **"Slash Commands"** in sidebar
2. Click **"Create New Command"**
3. Fill in:
   - **Command**: e.g., `/ask`
   - **Request URL**: Your webhook endpoint
   - **Short Description**: "Ask the AI assistant"
   - **Usage Hint**: "[your question]"
4. Click **"Save"**

---

## Adding to PrivexBot

1. Go to **Settings > API Credentials** in PrivexBot
2. Click **"Add Credential"**
3. Select **"Slack"** as the service type
4. Enter a descriptive name (e.g., "Production Slack Bot")
5. Paste your Bot Token (`xoxb-...`)
6. Click **"Add Credential"**

---

## Token Types Explained

| Token Type | Prefix | Use Case |
|------------|--------|----------|
| Bot Token | `xoxb-` | Bot actions (recommended) |
| User Token | `xoxp-` | Act as user (not for bots) |
| App Token | `xapp-` | Socket Mode connections |
| Webhook URL | `https://hooks.slack.com/...` | Incoming webhooks only |

> **PrivexBot uses**: Bot Token (`xoxb-`)

---

## Workspace Distribution

### Single Workspace (Default)

Your app works in the workspace where it was created.

### Multiple Workspaces

To allow installation in other workspaces:

1. Go to **"Manage Distribution"** in sidebar
2. Under **"Share Your App with Other Workspaces"**:
   - ✅ Complete all checklist items
   - ✅ Activate Public Distribution (if needed)
3. Use the **"Sharable URL"** for installations

### Slack App Directory

For public distribution:

1. Complete app review requirements
2. Submit for Slack review
3. Once approved, available in App Directory

---

## Event Subscription Details

### Message Events

| Event | Trigger | Data Received |
|-------|---------|---------------|
| `message.im` | DM to bot | Message content, user, channel |
| `message.channels` | Public channel message | Message content, user, channel |
| `message.groups` | Private channel message | Message content, user, channel |
| `message.mpim` | Group DM message | Message content, users, channel |

### App Events

| Event | Trigger |
|-------|---------|
| `app_mention` | Bot @mentioned |
| `app_home_opened` | User opens app home |
| `app_uninstalled` | App removed from workspace |

### Member Events

| Event | Trigger |
|-------|---------|
| `member_joined_channel` | User joins channel |
| `member_left_channel` | User leaves channel |
| `team_join` | New user joins workspace |

---

## Rate Limits

### Tier System

| Tier | Limit | Methods |
|------|-------|---------|
| Tier 1 | 1 req/min | Rate-limited |
| Tier 2 | 20 req/min | Most write operations |
| Tier 3 | 50 req/min | Most read operations |
| Tier 4 | 100+ req/min | High-volume operations |

### Common Method Limits

| Method | Tier | Limit |
|--------|------|-------|
| `chat.postMessage` | Tier 3 | ~50/min |
| `conversations.history` | Tier 3 | ~50/min |
| `users.info` | Tier 4 | ~100/min |
| `files.upload` | Tier 2 | ~20/min |

### Rate Limit Headers

```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000060
Retry-After: 30  # (when rate limited)
```

---

## Message Formatting

### Basic Formatting

```
*bold* _italic_ ~strikethrough~ `code`
```

### Block Kit (Rich Messages)

```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "Hello! How can I help you?"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "Get Help"},
          "action_id": "help_button"
        }
      ]
    }
  ]
}
```

### Links and Mentions

```
<https://example.com|Click here>
<@U123456>  # Mention user
<#C123456>  # Link to channel
<!here>     # @here mention
<!channel>  # @channel mention
```

---

## Troubleshooting

### "invalid_auth" Error

- Token is invalid, expired, or revoked
- Reinstall the app to get a new token
- Verify token starts with `xoxb-`

### "channel_not_found" Error

- Bot is not a member of the channel
- Invite bot: `/invite @botname`
- Or enable `channels:join` scope for auto-join

### "not_allowed_token_type" Error

- Using wrong token type for the method
- Use Bot Token (`xoxb-`) for bot actions

### "missing_scope" Error

- Required scope not added
- Add the scope in OAuth & Permissions
- Reinstall the app

### Events Not Received

1. Verify Event Subscriptions are enabled
2. Check Request URL is correct and verified
3. Ensure bot is in the channel
4. Check webhook endpoint is accessible

### "request_timeout" Error

- Your server took too long to respond
- Slack expects response within 3 seconds
- Acknowledge immediately, process async

### Bot Not Responding in Channels

1. Invite bot to channel: `/invite @botname`
2. Check `channels:history` scope is added
3. Verify `message.channels` event is subscribed

---

## Socket Mode (Alternative to Webhooks)

For development or firewall-restricted environments:

### Enable Socket Mode

1. Go to **"Socket Mode"** in sidebar
2. Toggle **"Enable Socket Mode"**
3. Generate an **App-Level Token** with `connections:write` scope
4. Use this token for WebSocket connections

### When to Use

- Local development (no public URL needed)
- Behind firewalls
- Faster event delivery
- Simpler setup

### Token

App-Level tokens start with `xapp-` and are different from bot tokens.

---

## App Home Tab

Create a personalized home screen for your bot:

1. Go to **"App Home"** in sidebar
2. Enable **"Home Tab"**
3. Publish a view using `views.publish` API

```json
{
  "type": "home",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Welcome to PrivexBot!*\n\nI'm your AI assistant."
      }
    }
  ]
}
```

---

## Testing Your Bot

### Send a Test Message

```bash
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer xoxb-YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "CHANNEL_ID",
    "text": "Hello from PrivexBot!"
  }'
```

### Get Bot Info

```bash
curl https://slack.com/api/auth.test \
  -H "Authorization: Bearer xoxb-YOUR-TOKEN"
```

### List Channels

```bash
curl https://slack.com/api/conversations.list \
  -H "Authorization: Bearer xoxb-YOUR-TOKEN"
```

---

## Security Best Practices

### Token Security

- **Never share** bot tokens publicly
- **Never commit** tokens to version control
- Store in **environment variables**
- **Rotate** tokens if compromised

### Signing Secret

Verify requests are from Slack:

1. Find **Signing Secret** in Basic Information
2. Validate `X-Slack-Signature` header on requests
3. Compare with computed HMAC-SHA256

### Request Verification

```python
import hmac
import hashlib

def verify_slack_request(signing_secret, timestamp, body, signature):
    sig_basestring = f"v0:{timestamp}:{body}"
    computed = 'v0=' + hmac.new(
        signing_secret.encode(),
        sig_basestring.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, signature)
```

---

## Useful Links

- [Slack API](https://api.slack.com/)
- [Your Apps](https://api.slack.com/apps)
- [API Methods](https://api.slack.com/methods)
- [Block Kit Builder](https://app.slack.com/block-kit-builder)
- [Events API](https://api.slack.com/apis/connections/events-api)
- [Rate Limits](https://api.slack.com/docs/rate-limits)
- [Slack Status](https://status.slack.com/)
- [Slack Community](https://community.slack.com/)

---

## Support

If you encounter issues:

1. Check [Slack API Documentation](https://api.slack.com/)
2. Visit [Slack Community](https://community.slack.com/)
3. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/slack-api)
4. Contact [Slack Support](https://slack.com/help/contact)
