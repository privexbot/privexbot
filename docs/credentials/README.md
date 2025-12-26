# API Credentials Setup Guides

This directory contains comprehensive guides for setting up API credentials for all supported services in PrivexBot.

---

## Quick Reference

| Service | Auth Type | Difficulty | Time | Guide |
|---------|-----------|------------|------|-------|
| [OpenAI](#openai) | API Key | Easy | 5 min | [View Guide](./openai-api-key.md) |
| [Telegram](#telegram) | Bot Token | Easy | 5 min | [View Guide](./telegram-bot-token.md) |
| [Discord](#discord) | Bot Token | Medium | 10 min | [View Guide](./discord-bot-token.md) |
| [WhatsApp](#whatsapp) | Access Token | Hard | 30+ min | [View Guide](./whatsapp-business-api.md) |
| [Notion](#notion) | OAuth / Token | Easy | 5 min | [View Guide](./notion-integration.md) |
| [Google Drive](#google-drive) | OAuth | Easy | 5 min | [View Guide](./google-drive-oauth.md) |
| [Slack](#slack) | OAuth / Token | Medium | 15 min | [View Guide](./slack-integration.md) |

---

## Services Overview

### AI Model Providers

#### OpenAI
**Use Case**: Power your chatbot's AI responses

| | |
|---|---|
| **Token Format** | `sk-...` |
| **Cost** | Pay-per-use (free credits for new accounts) |
| **Setup Time** | ~5 minutes |
| **Guide** | [OpenAI API Key Setup](./openai-api-key.md) |

**Quick Steps**:
1. Create account at [platform.openai.com](https://platform.openai.com)
2. Go to API Keys section
3. Create new secret key
4. Copy and save securely

---

### Messaging Channels

#### Telegram
**Use Case**: Deploy chatbot to Telegram messenger

| | |
|---|---|
| **Token Format** | `123456789:ABCdefGHI...` |
| **Cost** | Free |
| **Setup Time** | ~5 minutes |
| **Guide** | [Telegram Bot Setup](./telegram-bot-token.md) |

**Quick Steps**:
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` command
3. Choose name and username
4. Copy the bot token

---

#### Discord
**Use Case**: Deploy chatbot to Discord servers

| | |
|---|---|
| **Token Format** | Base64 encoded string |
| **Cost** | Free |
| **Setup Time** | ~10 minutes |
| **Guide** | [Discord Bot Setup](./discord-bot-token.md) |

**Quick Steps**:
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application
3. Add Bot user
4. Enable Message Content Intent
5. Copy bot token
6. Generate invite URL and add to server

---

#### WhatsApp
**Use Case**: Deploy chatbot to WhatsApp Business

| | |
|---|---|
| **Token Format** | Long access token string |
| **Cost** | Conversation-based pricing |
| **Setup Time** | ~30+ minutes |
| **Guide** | [WhatsApp Business API Setup](./whatsapp-business-api.md) |

**Quick Steps**:
1. Create Meta Developer account
2. Create Meta App with WhatsApp product
3. Configure WhatsApp Business Account
4. Add and verify phone number
5. Generate permanent System User token

**Note**: WhatsApp requires business verification for higher messaging limits.

---

#### Slack
**Use Case**: Deploy chatbot to Slack workspaces

| | |
|---|---|
| **Token Format** | `xoxb-...` |
| **Cost** | Free |
| **Setup Time** | ~15 minutes |
| **Guide** | [Slack Integration Setup](./slack-integration.md) |

**Quick Steps**:
1. Create app at [api.slack.com/apps](https://api.slack.com/apps)
2. Configure Bot User
3. Add OAuth scopes (permissions)
4. Install to workspace
5. Copy Bot User OAuth Token
6. Configure event subscriptions

---

### Knowledge Base Sources

#### Notion
**Use Case**: Import content from Notion pages and databases

| | |
|---|---|
| **Token Format** | `secret_...` or `ntn_...` |
| **Cost** | Free |
| **Setup Time** | ~5 minutes |
| **Guide** | [Notion Integration Setup](./notion-integration.md) |

**Quick Steps**:
1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create new integration
3. Copy internal integration token
4. Share pages with your integration

**Or use OAuth**:
1. Click "Connect with Notion" in PrivexBot
2. Select pages to share
3. Authorize access

---

#### Google Drive
**Use Case**: Import documents from Google Drive

| | |
|---|---|
| **Auth Type** | OAuth 2.0 |
| **Cost** | Free |
| **Setup Time** | ~5 minutes |
| **Guide** | [Google Drive OAuth Setup](./google-drive-oauth.md) |

**Quick Steps**:
1. Click "Connect with Google Drive" in PrivexBot
2. Sign in with Google account
3. Grant read-only permissions
4. Select files/folders to import

---

## Comparison Table

### Messaging Channels

| Feature | Telegram | Discord | WhatsApp | Slack |
|---------|----------|---------|----------|-------|
| **Setup Difficulty** | Easy | Medium | Hard | Medium |
| **Cost** | Free | Free | Paid | Free |
| **Business Verification** | No | No | Yes | No |
| **Group Support** | Yes | Yes | Yes | Yes |
| **Rich Messages** | Yes | Yes | Limited | Yes |
| **File Sharing** | Yes | Yes | Yes | Yes |
| **Reactions** | Limited | Yes | Yes | Yes |
| **Threads** | No | Yes | No | Yes |

### Knowledge Base Sources

| Feature | Notion | Google Drive |
|---------|--------|--------------|
| **Auth Method** | Token/OAuth | OAuth |
| **Real-time Sync** | Manual | Manual |
| **Supported Types** | Pages, DBs | Docs, Sheets, PDFs |
| **Folder Import** | Yes | Yes |
| **Rate Limits** | 3 req/s | 100 req/100s |

---

## Security Best Practices

### General Rules

1. **Never share** tokens or API keys publicly
2. **Never commit** credentials to version control
3. Store credentials in **environment variables** or secure vaults
4. Use **separate credentials** for development and production
5. **Rotate tokens** periodically and after team changes
6. **Revoke access** immediately if credentials are compromised

### Service-Specific

| Service | Rotation Method |
|---------|-----------------|
| OpenAI | Generate new key in dashboard |
| Telegram | `/revoke` command to BotFather |
| Discord | Reset Token in Developer Portal |
| WhatsApp | Generate new System User token |
| Notion | Regenerate in integration settings |
| Google Drive | Re-authenticate OAuth |
| Slack | Reinstall app to workspace |

---

## Troubleshooting Quick Reference

### Common Errors

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| "Invalid token" | Token expired/revoked | Regenerate token |
| "Unauthorized" | Wrong token format | Check token prefix |
| "Rate limited" | Too many requests | Implement backoff |
| "Permission denied" | Missing scopes | Add required permissions |
| "Not found" | Resource deleted/moved | Verify resource exists |

### Token Format Reference

| Service | Prefix | Example |
|---------|--------|---------|
| OpenAI | `sk-` | `sk-abc123...` |
| Telegram | Numbers + colon | `123456789:ABC...` |
| Discord | Base64 | `MTIzNDU2...` |
| WhatsApp | Various | Long alphanumeric |
| Notion | `secret_` or `ntn_` | `secret_abc...` |
| Slack | `xoxb-` | `xoxb-123-456...` |

---

## Adding Credentials in PrivexBot

### Steps

1. Navigate to **Settings > API Credentials**
2. Click **"Add Credential"**
3. Select the **service type**
4. Enter a **descriptive name**
5. For OAuth services: Click "Connect" button
6. For token services: Paste your token
7. Click **"Add Credential"**

### Naming Conventions

Use descriptive names to identify credentials:

| Good | Bad |
|------|-----|
| `Production OpenAI Key` | `key1` |
| `Support Bot Telegram` | `telegram` |
| `Marketing Slack Bot` | `slack token` |
| `Main WhatsApp Business` | `wa` |

---

## Need Help?

### Documentation

- Check the individual service guides in this directory
- Review the [PrivexBot Documentation](/docs)

### Support

- [PrivexBot Help Center](/help)
- [Community Forum](https://community.privexbot.com)
- Email: support@privexbot.com

### External Resources

| Service | Official Docs |
|---------|---------------|
| OpenAI | [platform.openai.com/docs](https://platform.openai.com/docs) |
| Telegram | [core.telegram.org/bots/api](https://core.telegram.org/bots/api) |
| Discord | [discord.com/developers/docs](https://discord.com/developers/docs) |
| WhatsApp | [developers.facebook.com/docs/whatsapp](https://developers.facebook.com/docs/whatsapp) |
| Notion | [developers.notion.com](https://developers.notion.com) |
| Google | [developers.google.com/drive](https://developers.google.com/drive) |
| Slack | [api.slack.com](https://api.slack.com) |
