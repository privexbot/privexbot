# Notion Integration Setup Guide

This guide explains how to create a Notion integration and obtain the API token for importing content from Notion into your knowledge bases.

---

## Overview

| Field | Value |
|-------|-------|
| **Service** | Notion API |
| **Authentication Type** | Internal Integration Token or OAuth 2.0 |
| **Token Format** | `secret_...` or `ntn_...` |
| **Cost** | Free (Notion API access included with Notion plans) |
| **Rate Limits** | 3 requests/second per integration |

---

## Prerequisites

- A Notion account (Free, Plus, Business, or Enterprise)
- Workspace admin access (to create integrations)
- Pages/databases you want to access

---

## Authentication Methods

### Method 1: Internal Integration (Simpler)

Best for:
- Single workspace access
- Server-side applications
- When you control the Notion workspace

### Method 2: OAuth 2.0 (PrivexBot uses this)

Best for:
- Multi-user applications
- When users grant access to their workspaces
- When you don't control the workspace

---

## Internal Integration Setup

### Step 1: Create Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Fill in the integration details:
   - **Name**: e.g., "PrivexBot Knowledge Base"
   - **Logo**: Upload an icon (optional)
   - **Associated workspace**: Select your workspace
4. Click **"Submit"**

### Step 2: Configure Capabilities

On the integration page, set capabilities:

#### Content Capabilities
| Capability | Description | Recommended |
|------------|-------------|-------------|
| Read content | Read pages and databases | ✅ Required |
| Update content | Modify pages and databases | ❌ Optional |
| Insert content | Create new pages | ❌ Optional |

#### Comment Capabilities
| Capability | Description | Recommended |
|------------|-------------|-------------|
| Read comments | View page comments | ❌ Optional |
| Insert comments | Add comments | ❌ Optional |

#### User Capabilities
| Capability | Description | Recommended |
|------------|-------------|-------------|
| Read user information | Access user details | ❌ Optional |

> **For Knowledge Bases**: Only "Read content" is typically needed.

### Step 3: Get Your Integration Token

1. On the integration page, find **"Internal Integration Secret"**
2. Click **"Show"** then **"Copy"**
3. The token starts with `secret_` or `ntn_`

> **IMPORTANT**: Store this token securely. It provides access to shared pages!

### Step 4: Share Pages with Integration

**Critical Step**: Your integration can only access pages explicitly shared with it.

For each page or database you want to access:

1. Open the page in Notion
2. Click **"Share"** (top right)
3. Click **"Invite"**
4. Search for your integration name
5. Select the integration
6. Click **"Invite"**

> **Note**: Sharing a parent page grants access to all child pages.

---

## OAuth 2.0 Setup (For PrivexBot)

PrivexBot uses OAuth for user-authorized access. When you click "Connect with Notion" in PrivexBot:

### OAuth Flow

1. You're redirected to Notion's authorization page
2. Select pages/databases to share
3. Click **"Allow access"**
4. Redirected back to PrivexBot with authorization

### What Gets Shared

- Only pages/databases you explicitly select
- Child pages of selected pages
- No access to private/unshared content

---

## Adding to PrivexBot

### For OAuth (Recommended)

1. Go to **Settings > API Credentials** in PrivexBot
2. Click **"Add Credential"**
3. Select **"Notion"** as the service type
4. Click **"Connect with Notion"**
5. In Notion's authorization page:
   - Select pages to share
   - Click **"Allow access"**
6. You'll be redirected back with the credential saved

### For Internal Integration (Manual)

1. Go to **Settings > API Credentials** in PrivexBot
2. Click **"Add Credential"**
3. Select **"Notion"** as the service type
4. Enter a descriptive name
5. Paste your integration token
6. Click **"Add Credential"**

---

## Working with Notion Content

### Supported Content Types

| Type | Supported | Notes |
|------|-----------|-------|
| Pages | ✅ Yes | Full content extraction |
| Databases | ✅ Yes | Properties and content |
| Headings | ✅ Yes | H1, H2, H3 |
| Paragraphs | ✅ Yes | Full text |
| Bullet Lists | ✅ Yes | Nested supported |
| Numbered Lists | ✅ Yes | Nested supported |
| To-do Lists | ✅ Yes | Checkbox state |
| Toggle Blocks | ✅ Yes | Content inside toggles |
| Callouts | ✅ Yes | Icon + text |
| Quotes | ✅ Yes | Full text |
| Code Blocks | ✅ Yes | Language + code |
| Tables | ✅ Yes | Converted to markdown |
| Images | ⚠️ Partial | URL extraction only |
| Files | ⚠️ Partial | URL extraction only |
| Embeds | ❌ No | URL only |
| Synced Blocks | ⚠️ Partial | Content at time of sync |

### Database Properties

| Property Type | Supported |
|---------------|-----------|
| Title | ✅ Yes |
| Rich Text | ✅ Yes |
| Number | ✅ Yes |
| Select | ✅ Yes |
| Multi-select | ✅ Yes |
| Date | ✅ Yes |
| Checkbox | ✅ Yes |
| URL | ✅ Yes |
| Email | ✅ Yes |
| Phone | ✅ Yes |
| Formula | ✅ Yes (computed value) |
| Relation | ⚠️ Partial (IDs only) |
| Rollup | ⚠️ Partial (computed value) |
| Files | ⚠️ Partial (URLs only) |

---

## Rate Limits

### Limits

| Limit Type | Value |
|------------|-------|
| Requests per second | 3 |
| Request size | 1000 blocks per request |
| Page content | 100 blocks per page request |

### Rate Limit Headers

```
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1640000000
```

### Handling Rate Limits

PrivexBot automatically handles rate limits with:
- Exponential backoff
- Request queuing
- Retry logic

---

## Page & Database IDs

### Finding a Page ID

**From URL:**
```
https://notion.so/My-Page-Title-abc123def456...
                               ^^^^^^^^^^^^^^^^
                               This is the page ID
```

**Full ID format:** `abc123de-f456-7890-abcd-ef1234567890`

### Finding a Database ID

**From URL:**
```
https://notion.so/abc123def456?v=...
                 ^^^^^^^^^^^^^^^^
                 This is the database ID
```

---

## Troubleshooting

### "Object not found" Error

- Page/database not shared with integration
- Share the content: Page > Share > Invite > Select Integration

### "Unauthorized" Error

- Token is invalid or expired
- Regenerate the integration token
- Re-authorize OAuth if using OAuth flow

### "Rate limited" Error

- Too many requests
- Wait and retry (PrivexBot handles this automatically)

### "Invalid request" Error

- Malformed request
- Check page/database ID format
- Verify content exists

### Content Not Appearing

1. Verify page is shared with integration
2. Check parent page sharing (child pages inherit)
3. Ensure content is not in private sections
4. Wait for sync to complete

### Missing Content Types

- Some block types (embeds, files) only extract URLs
- Synced blocks capture content at sync time
- Images are URLs, not downloaded

---

## Security Best Practices

### Token Security

- **Never share** integration tokens
- **Never commit** tokens to version control
- Store in **environment variables** or secure vaults
- **Rotate tokens** by regenerating in settings

### Access Control

- Share only **necessary pages**
- Use **minimal permissions** (read-only if possible)
- **Audit** shared pages regularly
- **Remove** integration access when not needed

### OAuth Security

- Tokens are scoped to selected pages
- Users control what's shared
- Revoke access anytime from Notion settings

---

## Revoking Access

### For Internal Integration

1. Go to the shared page
2. Click **"Share"**
3. Find the integration
4. Click **"Remove"**

### For OAuth

1. Go to [Notion Settings](https://www.notion.so/my-account)
2. Click **"My connections"**
3. Find PrivexBot
4. Click **"Disconnect"**

---

## API Testing

### Get User Info

```bash
curl https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Notion-Version: 2022-06-28"
```

### List Databases

```bash
curl -X POST https://api.notion.com/v1/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{"filter": {"property": "object", "value": "database"}}'
```

### Get Page Content

```bash
curl https://api.notion.com/v1/blocks/PAGE_ID/children \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Notion-Version: 2022-06-28"
```

### Query Database

```bash
curl -X POST https://api.notion.com/v1/databases/DATABASE_ID/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Useful Links

- [Notion Integrations](https://www.notion.so/my-integrations)
- [Notion API Documentation](https://developers.notion.com/)
- [API Reference](https://developers.notion.com/reference/intro)
- [Integration Capabilities](https://developers.notion.com/docs/capabilities)
- [Rate Limits](https://developers.notion.com/reference/request-limits)
- [Notion Help Center](https://www.notion.so/help)
- [API Changelog](https://developers.notion.com/changelog)

---

## Support

If you encounter issues:

1. Check [Notion API Documentation](https://developers.notion.com/)
2. Visit [Notion Community](https://www.notion.so/community)
3. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/notion-api)
4. Contact [Notion Support](https://www.notion.so/contact)
