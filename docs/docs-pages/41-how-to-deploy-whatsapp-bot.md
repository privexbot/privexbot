# WhatsApp Business Deployment Guide

Deploy your PrivexBot chatbot to WhatsApp Business and reach customers on the world's most popular messaging platform. This guide covers the complete setup process using the WhatsApp Business API.

---

## Table of Contents

1. [Requirements Overview](#requirements-overview)
2. [Meta Business Setup](#meta-business-setup)
3. [Phone Number Setup](#phone-number-setup)
4. [Getting Credentials](#getting-credentials)
5. [Adding Credential in PrivexBot](#adding-credential-in-privexbot)
6. [Deploying to WhatsApp](#deploying-to-whatsapp)
7. [Webhook Configuration](#webhook-configuration)
8. [Message Flow](#message-flow)
9. [24-Hour Messaging Window](#24-hour-messaging-window)
10. [Message Templates](#message-templates)
11. [Verified Phone Lead Capture](#verified-phone-lead-capture)
12. [Pricing and Limits](#pricing-and-limits)
13. [Troubleshooting](#troubleshooting)

---

## Requirements Overview

WhatsApp Business API requires more setup than other channels. Here's what you need:

### Prerequisites

- [ ] Meta Business Account (or ability to create one)
- [ ] Facebook Developer Account
- [ ] Phone number for WhatsApp (not linked to existing WhatsApp)
- [ ] Business verification (for production)
- [ ] PrivexBot with deployed chatbot

### Technical Requirements

| Requirement | Purpose |
|-------------|---------|
| **Public HTTPS URL** | Webhook endpoint |
| **Valid SSL Certificate** | Required by Meta |
| **Stable Server** | Handle webhook requests |

### Account Types

| Type | Use Case | Limits |
|------|----------|--------|
| **Test Account** | Development | 5 test numbers |
| **Business Account** | Production | Based on tier |

---

## Meta Business Setup

### Step 1: Create Meta Business Account

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Click **Create Account** (or use existing)
3. Enter business details:
   - Business name
   - Your name
   - Business email
4. Complete verification steps

### Step 2: Create Developer App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select app type: **Business**
4. Fill in details:

```
Create a New App
────────────────
App Name: PrivexBot WhatsApp
Contact Email: your@email.com
Business Account: [Select your business ▼]

[  Cancel  ] [  Create App  ]
```

5. Complete security check
6. Click **Create App**

### Step 3: Add WhatsApp Product

1. In your app dashboard, find **Add Products**
2. Find **WhatsApp** and click **Set Up**
3. WhatsApp panel appears in left sidebar

```
Your App Dashboard
──────────────────
┌─────────────────────────────────────────┐
│  WhatsApp                               │
│  ├── Getting Started                    │
│  ├── API Setup                          │
│  ├── Configuration                      │
│  └── Webhooks                           │
└─────────────────────────────────────────┘
```

---

## Phone Number Setup

### Option A: Use Test Number (Development)

Meta provides a test phone number for development:

1. Go to **WhatsApp** → **API Setup**
2. You'll see a test phone number provided
3. Add up to 5 test recipient numbers
4. Verify each test number via SMS code

**Test Number Limitations:**
- Can only message verified test numbers
- Cannot receive incoming messages
- For development only

### Option B: Add Business Phone Number (Production)

For production, register your own number:

1. Go to **WhatsApp** → **API Setup**
2. Click **Add Phone Number**
3. Enter your phone number details:

```
Add Phone Number
────────────────
Phone Number: +1 555 123 4567
Display Name: Acme Support
Category: [Support ▼]
Business Description: Customer support for Acme Corp

[  Cancel  ] [  Next  ]
```

4. Verify the number:
   - Via SMS or voice call
   - Enter verification code
5. Wait for Meta approval (24-48 hours)

**Important**: The phone number:
- Cannot be linked to any existing WhatsApp account
- Will be linked to WhatsApp Business API only
- Cannot use regular WhatsApp app after linking

---

## Getting Credentials

You need three pieces of information from Meta.

### Credential 1: Access Token

**Temporary Token (Development):**
1. Go to **WhatsApp** → **API Setup**
2. Click **Generate** under Temporary Access Token
3. Token valid for 24 hours
4. Copy the token

**Permanent Token (Production):**
1. Go to **App Settings** → **Basic**
2. Note your **App ID** and **App Secret**
3. Create System User:
   - Go to Business Settings → System Users
   - Add → Create System User
   - Role: Admin
   - Generate Token with `whatsapp_business_messaging` permission
4. This token doesn't expire

```
Permanent Access Token
──────────────────────
EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...

Save this token securely. It won't be shown again.
```

### Credential 2: Phone Number ID

1. Go to **WhatsApp** → **API Setup**
2. Find **Phone Number ID** under your number
3. Format: numeric string like `123456789012345`

```
Phone Numbers
─────────────
+1 555 123 4567
Phone Number ID: 123456789012345
Display Name: Acme Support
Status: Connected
```

### Credential 3: Verify Token

Create your own verify token (any random string):

```bash
# Generate a random token
openssl rand -hex 32
# Example output: a1b2c3d4e5f6...
```

This token verifies webhook requests from Meta.

---

## Adding Credential in PrivexBot

### Step 1: Navigate to Credentials

1. Log in to PrivexBot
2. Go to your **Workspace**
3. Click **Credentials** in sidebar

### Step 2: Create WhatsApp Credential

1. Click **+ Add Credential**
2. Select **WhatsApp Business** as type
3. Fill in the form:

```
Add WhatsApp Credential
───────────────────────
Name: Acme WhatsApp Business
      (internal reference)

Access Token: EAAxxxxxxx...
              (from Meta)

Phone Number ID: 123456789012345
                 (from Meta)

Verify Token: your-custom-verify-token
              (you created this)

Business Account ID: 123456789 (optional)

[  Cancel  ] [  Save Credential  ]
```

4. Click **Save Credential**

### Step 3: Verify Connection

After saving, PrivexBot validates the credential:
- Green checkmark: Credential valid
- Red warning: Check token/number ID

---

## Deploying to WhatsApp

### Option A: During Initial Deployment

1. Create or configure your chatbot
2. Click **Deploy**
3. Enable **WhatsApp** channel
4. Select your WhatsApp credential
5. Complete deployment

### Option B: Add to Existing Chatbot

1. Go to **Chatbots** → Select chatbot
2. Navigate to **Channels** tab
3. Click **+ Add Channel**
4. Select **WhatsApp**
5. Choose your credential
6. Click **Deploy to WhatsApp**

### Deployment Process

```
Deployment Progress
───────────────────
[✓] Validating credential...
[✓] Testing API connection...
[  ] Registering webhook...
[ ] Verifying webhook...
[ ] WhatsApp channel deployed!
```

---

## Webhook Configuration

Meta needs to know where to send incoming messages.

### Step 1: Get Webhook URL from PrivexBot

After starting deployment, you'll receive:

```
Webhook Configuration
─────────────────────
Webhook URL: https://your-domain.com/api/v1/whatsapp/webhook
Verify Token: your-custom-verify-token

Configure these in Meta Developer Portal.
```

### Step 2: Configure in Meta Portal

1. Go to **WhatsApp** → **Configuration**
2. Click **Edit** under Webhook
3. Enter details:

```
Webhook Configuration
─────────────────────
Callback URL: https://your-domain.com/api/v1/whatsapp/webhook
Verify Token: your-custom-verify-token

[  Cancel  ] [  Verify and Save  ]
```

4. Click **Verify and Save**
5. Meta sends verification request to your URL
6. PrivexBot responds with challenge token
7. Webhook verified!

### Step 3: Subscribe to Webhook Fields

After verification, subscribe to events:

1. Still in Configuration
2. Under **Webhook Fields**, click **Manage**
3. Enable:
   - [x] `messages`
   - [x] `messaging_postbacks`
   - [ ] Other fields as needed

```
Webhook Fields
──────────────
[✓] messages - Subscribe to incoming messages
[✓] messaging_postbacks - Subscribe to button clicks
[ ] message_deliveries - Delivery confirmations
[ ] message_reads - Read receipts
```

---

## Message Flow

Understanding how messages flow helps with debugging.

### Incoming Message Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   WhatsApp   │     │    Meta      │     │  PrivexBot   │
│    User      │     │   Servers    │     │   Server     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. User sends      │                    │
       │    message         │                    │
       │───────────────────▶│                    │
       │                    │                    │
       │                    │ 2. Webhook POST    │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │                    │ 3. Process
       │                    │                    │    message
       │                    │                    │
       │                    │ 4. Send response   │
       │                    │◀───────────────────│
       │                    │    (API call)      │
       │                    │                    │
       │ 5. Deliver         │                    │
       │◀───────────────────│                    │
       │                    │                    │
```

### Webhook Payload Example

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "messages": [{
          "from": "15551234567",
          "id": "wamid.xxx",
          "timestamp": "1234567890",
          "text": {
            "body": "Hello, I need help"
          },
          "type": "text"
        }]
      }
    }]
  }]
}
```

---

## 24-Hour Messaging Window

WhatsApp enforces a 24-hour messaging window for business accounts.

### How It Works

```
User sends message
        │
        ▼
┌───────────────────────────────────────┐
│       24-Hour Window Opens            │
│                                       │
│  You can send:                        │
│  • Free-form messages                 │
│  • Rich media                         │
│  • Interactive buttons                │
│  • Any content                        │
└───────────────────────────────────────┘
        │
        │ After 24 hours without user message
        ▼
┌───────────────────────────────────────┐
│       Window Closed                   │
│                                       │
│  You can only send:                   │
│  • Pre-approved templates             │
│  • No free-form messages              │
└───────────────────────────────────────┘
```

### Implications

| Within Window | Outside Window |
|---------------|----------------|
| Any message | Templates only |
| Free | Paid (per template) |
| Interactive | Limited interactive |
| Rich media | Depends on template |

### Best Practices

1. **Respond quickly**: Don't let the window expire
2. **Use templates** for follow-ups: If window expired
3. **Encourage engagement**: Ask questions to keep window open
4. **Track window status**: Know when you can message freely

---

## Message Templates

Templates are pre-approved message formats for outbound messaging.

### When You Need Templates

- Messaging users outside 24-hour window
- Proactive notifications
- Marketing campaigns
- Automated follow-ups

### Creating Templates

1. Go to Meta Business Suite
2. Navigate to **WhatsApp Manager** → **Message Templates**
3. Click **Create Template**

```
Create Message Template
───────────────────────
Category: [Utility ▼]
Name: order_update
Language: English

Header: (Optional)
┌─────────────────────────────────────────────┐
│ Order Update                                │
└─────────────────────────────────────────────┘

Body:
┌─────────────────────────────────────────────┐
│ Hi {{1}}, your order #{{2}} has been        │
│ shipped! Track it here: {{3}}               │
└─────────────────────────────────────────────┘

Footer: (Optional)
┌─────────────────────────────────────────────┐
│ Reply STOP to unsubscribe                   │
└─────────────────────────────────────────────┘
```

### Template Categories

| Category | Use Case | Approval Time |
|----------|----------|---------------|
| **Utility** | Order updates, receipts | Fast (~minutes) |
| **Authentication** | OTP, verification | Fast |
| **Marketing** | Promotions, offers | Slower (review) |

### Template Variables

Use `{{1}}`, `{{2}}`, etc. for dynamic content:

```
Template: "Hi {{1}}, your appointment is on {{2}} at {{3}}."
Sent as:  "Hi John, your appointment is on Monday at 3pm."
```

---

## Verified Phone Lead Capture

WhatsApp provides **verified phone numbers**—one of its most valuable features.

### Why WhatsApp Phone Numbers are Valuable

| Aspect | Other Channels | WhatsApp |
|--------|---------------|----------|
| Phone verification | User-provided | Meta-verified |
| Spoofing risk | Possible | Not possible |
| Data quality | Variable | High |
| Contact reliability | Unknown | Direct line |

### How Verification Works

1. User created WhatsApp account
2. Meta verified their phone number
3. User messages your bot
4. You receive their verified phone
5. Guaranteed real, active number

### Captured Lead Data

| Field | Source | Quality |
|-------|--------|---------|
| **Phone Number** | WhatsApp account | Verified ✓ |
| **Display Name** | Profile | User-set |
| **Profile Picture** | Profile | If public |

### Using Verified Phones

In your leads:
```
Lead Details
────────────
Phone: +1 555 123 4567 (WhatsApp Verified)
Source: WhatsApp
Captured: Just now
```

You can:
- Call this number directly
- Send SMS
- Use for verification
- Trust it's accurate

---

## Pricing and Limits

### Conversation-Based Pricing

WhatsApp charges per conversation, not per message.

```
Conversation Types
──────────────────

User-Initiated:
  User messages you first
  24-hour conversation window
  Charged per conversation

Business-Initiated:
  You message first (template)
  Opens 24-hour window
  Charged per template type
```

### Pricing Tiers (Approximate)

| Conversation Type | Price (USD) |
|-------------------|-------------|
| Marketing | $0.05-0.15 |
| Utility | $0.02-0.05 |
| Authentication | $0.02-0.03 |
| Service (user-initiated) | $0.02-0.05 |

*Prices vary by country. Check Meta's current pricing.*

### Free Conversations

First 1,000 conversations per month are free (service conversations).

### Message Limits by Tier

| Tier | Limit | Requirement |
|------|-------|-------------|
| **Unverified** | 250 unique users/day | New accounts |
| **Tier 1** | 1,000 unique users/day | Phone verified |
| **Tier 2** | 10,000 unique users/day | Quality maintained |
| **Tier 3** | 100,000 unique users/day | High volume |
| **Tier 4** | Unlimited | Enterprise |

### Increasing Limits

To move up tiers:
1. Maintain quality rating
2. Send consistent volume
3. Avoid spam reports
4. Complete business verification

---

## Troubleshooting

### Webhook Not Verified

**Error**: "The URL couldn't be validated"

| Check | Solution |
|-------|----------|
| URL accessible | Test in browser |
| HTTPS valid | Check SSL certificate |
| Verify token matches | Same in both places |
| Server responding | Check server logs |

**Debug Steps:**
```bash
# Test your webhook manually
curl -X GET "https://your-domain.com/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
# Should return: test123
```

### Messages Not Received

| Symptom | Cause | Solution |
|---------|-------|----------|
| No webhook calls | Webhook not subscribed | Subscribe to messages field |
| 401 errors | Invalid token | Regenerate access token |
| 403 errors | Permission denied | Check token permissions |
| Timeout | Server too slow | Optimize response time |

### Messages Not Sending

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid phone number" | Format wrong | Use international format (+1...) |
| "Outside allowed window" | 24h expired | Use template message |
| "Rate limit exceeded" | Too many messages | Slow down, check tier |
| "Unsupported message type" | Wrong format | Check API documentation |

### Template Rejected

| Reason | Solution |
|--------|----------|
| Policy violation | Review WhatsApp Commerce Policy |
| Missing variable | Add placeholder where needed |
| Too promotional | Use Marketing category |
| Unclear purpose | Add context in footer |

### Quality Rating Issues

**Warning**: Low quality rating can reduce message limits.

**Improve Quality:**
1. Reduce spam reports
2. Improve message relevance
3. Honor unsubscribe requests
4. Don't message opted-out users

### Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 100 | Invalid parameter | Check request format |
| 131000 | Something went wrong | Retry or contact support |
| 131030 | User's number not on WhatsApp | Verify recipient |
| 131047 | Re-engagement required | Need user to message first |
| 132000 | Template not found | Check template name |

---

## Best Practices

### User Experience

1. **Respond quickly**: Users expect fast replies
2. **Be conversational**: Match WhatsApp's informal tone
3. **Use rich media**: Images, documents when helpful
4. **Provide options**: Interactive buttons for common actions

### Compliance

1. **Obtain consent**: Before marketing messages
2. **Honor opt-outs**: Stop messaging when requested
3. **Follow policies**: Meta's Commerce and Business Policies
4. **Protect data**: Secure user information

### Technical

1. **Handle retries**: Webhook may send duplicates
2. **Acknowledge quickly**: Return 200 within 20 seconds
3. **Process async**: Don't block webhook response
4. **Monitor errors**: Track and fix failures

---

## Next Steps

- **[Direct API Integration](42-how-to-integrate-via-api.md)**: Build custom integrations
- **[Manage Leads](38-how-to-manage-leads.md)**: Work with verified phone leads
- **[View Analytics](44-how-to-use-analytics.md)**: Track WhatsApp performance

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
