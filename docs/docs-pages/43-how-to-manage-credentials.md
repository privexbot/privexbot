# Credentials Management Guide

Credentials securely store authentication information for external services. This guide covers how to create, use, and manage credentials for your integrations.

---

## Table of Contents

1. [What are Credentials?](#what-are-credentials)
2. [Credential Types](#credential-types)
3. [Adding Credentials](#adding-credentials)
4. [Using Credentials](#using-credentials)
5. [Testing Credentials](#testing-credentials)
6. [Editing Credentials](#editing-credentials)
7. [Deleting Credentials](#deleting-credentials)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## What are Credentials?

Credentials are secure containers for sensitive authentication data like API keys, tokens, and passwords. They allow you to:

- Connect chatflows to external APIs
- Deploy bots to messaging platforms (Telegram, Discord, WhatsApp)
- Access databases and cloud services
- Integrate with third-party tools

### How Credentials Work

```
┌─────────────────────────────────────────────────────────────┐
│                      PrivexBot                               │
│  ┌─────────────┐                    ┌──────────────────┐   │
│  │  Chatflow   │───uses────────────▶│   Credential     │   │
│  │  HTTP Node  │                    │  (API Key)       │   │
│  └─────────────┘                    └────────┬─────────┘   │
│                                              │              │
│                                    Encrypted │ Storage     │
│                                              │              │
└──────────────────────────────────────────────│──────────────┘
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │  External API    │
                                    │  (Authenticated) │
                                    └──────────────────┘
```

### Security Features

| Feature | Description |
|---------|-------------|
| **Encryption at Rest** | Fernet encryption for all secrets |
| **Workspace Isolation** | Credentials only visible within workspace |
| **Lazy Decryption** | Secrets decrypted only when needed |
| **Usage Tracking** | Monitor which resources use credentials |
| **No Plain Storage** | Secrets never stored in plain text |

---

## Credential Types

PrivexBot supports multiple credential types for different use cases.

### API Key

For services that authenticate with a simple API key.

```
API Key Credential
──────────────────
Name: OpenWeather API
Key Header: X-API-Key
Key Value: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Common Uses:**
- OpenWeather, NewsAPI, other REST APIs
- Internal service authentication
- Third-party integrations

### OAuth2

For services requiring OAuth2 authentication flows.

```
OAuth2 Credential
─────────────────
Name: Google Sheets
Client ID: xxxxx.apps.googleusercontent.com
Client Secret: xxxxxxxxxxxxxxxx
Redirect URI: https://your-domain.com/callback
Scopes: https://www.googleapis.com/auth/spreadsheets.readonly
Access Token: (generated after authorization)
Refresh Token: (generated after authorization)
```

**Common Uses:**
- Google Workspace (Docs, Sheets, Drive)
- Notion API
- Other OAuth2 services

### Basic Auth

For services using username/password authentication.

```
Basic Auth Credential
─────────────────────
Name: Legacy System
Username: api_user
Password: ••••••••••••
```

**Common Uses:**
- Legacy APIs
- Some enterprise systems
- HTTP basic authentication

### Database

For direct database connections.

```
Database Credential
───────────────────
Name: Analytics DB
Type: PostgreSQL
Host: db.example.com
Port: 5432
Database: analytics
Username: readonly_user
Password: ••••••••••••
SSL Mode: require
```

**Supported Databases:**
- PostgreSQL
- MySQL
- SQLite
- MariaDB

### SMTP

For sending emails from chatflows.

```
SMTP Credential
───────────────
Name: Email Notifications
Host: smtp.gmail.com
Port: 587
Security: TLS
Username: your@gmail.com
Password: ••••••••••••
From Email: notifications@yourdomain.com
```

### AWS

For Amazon Web Services integrations.

```
AWS Credential
──────────────
Name: S3 Storage
Access Key ID: AKIAXXXXXXXXXXXXXXXX
Secret Access Key: ••••••••••••••••••••••••
Region: us-east-1
```

**Common Uses:**
- S3 file storage
- DynamoDB access
- Lambda invocation

### Platform-Specific

For messaging platform deployments.

#### Telegram Bot

```
Telegram Credential
───────────────────
Name: Support Bot
Bot Token: 123456789:ABCdefGHIjklMNO...
Bot Username: @acme_support_bot (optional)
```

#### Discord Bot

```
Discord Credential
──────────────────
Name: Community Bot
Application ID: 123456789012345678
Bot Token: MTIzNDU2Nzg5MDEyMzQ1Njc4.xxx...
Public Key: abc123def456...
```

#### WhatsApp Business

```
WhatsApp Credential
───────────────────
Name: Business Account
Access Token: EAAxxxxxxx...
Phone Number ID: 123456789012345
Verify Token: your-custom-token
Business Account ID: 123456789 (optional)
```

### Custom

For services not matching other types.

```
Custom Credential
─────────────────
Name: Internal Service
Fields:
  api_key: xxxxxxxx
  tenant_id: 12345
  environment: production
```

---

## Adding Credentials

### Step 1: Navigate to Credentials

1. Log in to PrivexBot
2. Select your **Workspace**
3. Click **Credentials** in the sidebar

### Step 2: Create New Credential

1. Click **+ Add Credential**
2. Select the credential type
3. Fill in the form

### Step 3: Enter Credential Details

Each type has specific fields. Here's an example for API Key:

```
Add API Key Credential
──────────────────────

Name *
┌─────────────────────────────────────────┐
│ Weather API                             │
└─────────────────────────────────────────┘
Internal name for reference

Header Name
┌─────────────────────────────────────────┐
│ X-API-Key                               │
└─────────────────────────────────────────┘
Header to include in requests (default: X-API-Key)

API Key *
┌─────────────────────────────────────────┐
│ ••••••••••••••••••••••••               │
└─────────────────────────────────────────┘
Your API key (will be encrypted)

Description (optional)
┌─────────────────────────────────────────┐
│ OpenWeather API for chatflow weather   │
│ queries                                │
└─────────────────────────────────────────┘

[  Cancel  ] [  Save Credential  ]
```

### Step 4: Verify and Save

1. Review entered information
2. Click **Save Credential**
3. Credential appears in your list

---

## Using Credentials

### In Chatflow HTTP Nodes

1. Add an **HTTP Request** node to your chatflow
2. Configure the request URL and method
3. Under **Authentication**, select **Credential**
4. Choose your credential from the dropdown

```
HTTP Request Node Configuration
───────────────────────────────
URL: https://api.weather.com/v1/current
Method: GET

Authentication:
[●] Credential  [ ] None  [ ] Manual

Credential: [Weather API ▼]

The selected credential will automatically
add the appropriate authentication headers.
```

### In Chatflow Database Nodes

1. Add a **Database** node to your chatflow
2. Select your database credential
3. Write your SQL query

```
Database Node Configuration
───────────────────────────
Credential: [Analytics DB ▼]

Query:
┌─────────────────────────────────────────┐
│ SELECT * FROM orders                    │
│ WHERE customer_id = $1                  │
│ ORDER BY created_at DESC                │
│ LIMIT 10                                │
└─────────────────────────────────────────┘

Parameters: ["{{customer_id}}"]
```

### For Channel Deployment

When deploying to messaging platforms:

1. Go to chatbot **Channels** tab
2. Click **Add Channel** (e.g., Telegram)
3. Select your platform credential
4. Complete deployment

```
Deploy to Telegram
──────────────────
Telegram Credential: [Support Bot ▼]

Available credentials with valid Telegram tokens
will appear in this list.

[  Cancel  ] [  Deploy  ]
```

### Variable Substitution

In chatflows, reference credential values:

```
HTTP Request URL: https://api.example.com/v1/data

Headers:
  Authorization: Bearer {{credentials.api_token}}
  X-Tenant-ID: {{credentials.tenant_id}}
```

---

## Testing Credentials

### Built-in Validation

When you save a credential, PrivexBot validates it:

| Type | Validation |
|------|------------|
| API Key | Format check |
| OAuth2 | Token validity |
| Database | Connection test |
| SMTP | Server connection |
| Platform | API ping |

### Manual Testing

For API credentials, test in a chatflow:

1. Create a simple test chatflow
2. Add HTTP Request node with the credential
3. Make a test API call
4. Check the response

### Test Connection Button

Some credential types have a **Test Connection** button:

```
Database Credential: Analytics DB
Status: [Test Connection]

Testing...
✓ Connection successful!
  Server: PostgreSQL 14.5
  Database: analytics
  Tables: 47
```

---

## Editing Credentials

### What You Can Edit

| Field | Editable | Notes |
|-------|----------|-------|
| Name | Yes | For your reference |
| Description | Yes | Documentation |
| Secret values | Yes | Enter new value to update |
| Type | No | Create new credential instead |

### How to Edit

1. Go to **Credentials**
2. Click on the credential name
3. Update fields as needed
4. Click **Save Changes**

### Security Note

When editing:
- Current secret values are **not displayed**
- Leave secret fields blank to keep existing values
- Enter a new value to replace

```
Edit Credential: Weather API
────────────────────────────

Name: Weather API

API Key:
┌─────────────────────────────────────────┐
│                                         │
└─────────────────────────────────────────┘
Leave blank to keep existing key, or enter new key to replace

[  Cancel  ] [  Save Changes  ]
```

---

## Deleting Credentials

### Before Deleting

Check if the credential is in use:

1. Click on the credential
2. View **Usage** section
3. See which resources depend on it

```
Credential: Weather API

Usage:
───────
This credential is used by:
• Chatflow: Weather Assistant (HTTP Node)
• Chatflow: Daily Report (HTTP Node)

⚠️ Deleting this credential will break these resources.
```

### How to Delete

1. Go to **Credentials**
2. Click on the credential
3. Scroll to **Danger Zone**
4. Click **Delete Credential**
5. Confirm the action

```
Delete Credential
─────────────────
Are you sure you want to delete "Weather API"?

This action cannot be undone. Resources using this
credential will fail.

Type the credential name to confirm:
┌─────────────────────────────────────────┐
│ Weather API                             │
└─────────────────────────────────────────┘

[  Cancel  ] [  Delete  ]
```

### After Deleting

- Chatflows using this credential will fail
- Update affected resources with new credential
- No way to recover deleted credentials

---

## Security Best Practices

### Principle of Least Privilege

Create credentials with minimal required permissions:

```
Bad:  AWS credential with full admin access
Good: AWS credential with only S3 read access to specific bucket
```

### Credential Naming

Use clear, descriptive names:

| Bad | Good |
|-----|------|
| "API Key" | "OpenWeather Production API" |
| "DB" | "Analytics DB (Read-Only)" |
| "Token" | "Slack Bot - Support Channel" |

### Rotation Schedule

Regularly rotate credentials:

| Credential Type | Recommended Rotation |
|-----------------|---------------------|
| API Keys | Every 90 days |
| Database passwords | Every 90 days |
| OAuth tokens | Auto-refresh (if supported) |
| Platform tokens | When compromised or annually |

### Separation by Environment

Create separate credentials for:
- Development
- Staging
- Production

```
Credentials:
• Weather API (Development)
• Weather API (Staging)
• Weather API (Production)
```

### Access Control

- Only workspace members can see credentials
- Credential values never shown after creation
- Audit usage through the Usage section

### What NOT to Do

| Don't | Why |
|-------|-----|
| Share credentials across workspaces | Breaks isolation |
| Use production credentials in dev | Risk of data corruption |
| Store credentials in chatflow configs | Not encrypted properly |
| Share credential screenshots | Exposes secrets |
| Use same credentials everywhere | Hard to rotate, limits damage |

---

## Troubleshooting

### Credential Not Working

| Symptom | Possible Cause | Solution |
|---------|----------------|----------|
| 401 Unauthorized | Invalid/expired key | Update credential |
| 403 Forbidden | Insufficient permissions | Check service permissions |
| Connection refused | Wrong host/port | Verify connection details |
| Timeout | Network/firewall issue | Check server accessibility |

### Can't Find Credential

| Issue | Solution |
|-------|----------|
| Not in list | Check you're in correct workspace |
| Type mismatch | Credential types filter by use case |
| Deleted | Create new credential |

### OAuth Token Expired

For OAuth2 credentials:

1. Check if refresh token is valid
2. If not, re-authorize the connection
3. Go to credential → **Reauthorize**

### Database Connection Failed

Debug steps:

1. Verify host is accessible from PrivexBot server
2. Check port is correct and open
3. Verify username/password
4. Check SSL requirements
5. Ensure database exists

```
Connection test failed:
"Connection refused to db.example.com:5432"

Checklist:
[ ] Host is publicly accessible
[ ] Port 5432 is open in firewall
[ ] Database accepts connections from PrivexBot IP
[ ] SSL mode matches server configuration
```

### Platform Credential Issues

**Telegram:**
- Token invalid → Get new token from BotFather
- Token revoked → Regenerate in BotFather

**Discord:**
- Token invalid → Regenerate in Developer Portal
- Missing intents → Enable in Developer Portal

**WhatsApp:**
- Token expired → Generate permanent token
- Wrong phone ID → Verify in Meta Business Suite

### Credential Validation Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| "Invalid format" | Wrong value format | Check documentation |
| "Connection failed" | Can't reach service | Verify network |
| "Authentication failed" | Wrong credentials | Double-check values |
| "Missing required field" | Form incomplete | Fill all required fields |

---

## Credential Reference

### Quick Reference Table

| Type | Required Fields | Optional |
|------|-----------------|----------|
| **API Key** | Name, Key | Header name |
| **OAuth2** | Name, Client ID, Client Secret, Scopes | Redirect URI |
| **Basic Auth** | Name, Username, Password | - |
| **Database** | Name, Type, Host, Database, Username, Password | Port, SSL |
| **SMTP** | Name, Host, Port, Username, Password | Security, From |
| **AWS** | Name, Access Key, Secret Key | Region |
| **Telegram** | Name, Bot Token | Username |
| **Discord** | Name, App ID, Bot Token, Public Key | - |
| **WhatsApp** | Name, Access Token, Phone Number ID, Verify Token | Business ID |
| **Custom** | Name, Fields (dynamic) | - |

---

## Next Steps

- **[Create Chatflows](34-how-to-create-chatflows.md)**: Use credentials in HTTP nodes
- **[Deploy to Telegram](39-how-to-deploy-telegram-bot.md)**: Use Telegram credentials
- **[Troubleshooting Guide](50-troubleshooting-guide.md)**: More solutions

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
