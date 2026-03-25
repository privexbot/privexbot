# WhatsApp Business API Setup Guide

This guide explains how to set up the WhatsApp Business API (Cloud API) through Meta and obtain the access token for use with your chatbots.

---

## Overview

| Field | Value |
|-------|-------|
| **Service** | WhatsApp Business API (Cloud API) |
| **Authentication Type** | Access Token |
| **Token Types** | Temporary (24h) or Permanent System User Token |
| **Cost** | Conversation-based pricing (varies by country) |
| **Rate Limits** | Varies by tier (1K-100K+ messages/day) |

---

## Prerequisites

- A Facebook account
- A Meta Business Account (created during setup)
- A phone number that:
  - Can receive SMS or voice calls
  - Is NOT currently registered on WhatsApp
  - Is NOT a virtual number (VoIP numbers often don't work)
- A valid business with verifiable information

---

## Step-by-Step Instructions

### Step 1: Create Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **"Get Started"** or **"My Apps"**
3. Log in with your Facebook account
4. Accept the Terms of Service
5. Verify your account (phone number or credit card)

### Step 2: Create a Meta App

1. Click **"Create App"** in the Developer Dashboard
2. Select **"Business"** as the app type
3. Click **"Next"**
4. Fill in the app details:
   - **App Name**: Your app name (e.g., "PrivexBot WhatsApp")
   - **App Contact Email**: Your business email
   - **Business Account**: Select or create a Meta Business Account
5. Click **"Create App"**

### Step 3: Add WhatsApp to Your App

1. On your app dashboard, find the **"Add Products"** section
2. Locate **"WhatsApp"** and click **"Set Up"**
3. You'll be redirected to the WhatsApp setup page

### Step 4: Configure WhatsApp Business Account

1. On the WhatsApp Getting Started page:
   - Select an existing **Meta Business Account** or create new
   - Select or create a **WhatsApp Business Account**
   - Select or create a **WhatsApp Business Profile**
2. Click **"Continue"**

### Step 5: Add a Phone Number

1. Go to **WhatsApp > Getting Started** in your app
2. Click **"Add phone number"**
3. Enter your business phone number:
   - Include country code (e.g., +1 for USA)
   - This number must NOT be on WhatsApp
4. Choose verification method:
   - **SMS**: Receive code via text
   - **Voice Call**: Receive code via phone call
5. Enter the verification code
6. Your number is now registered!

### Step 6: Get Your Access Token

#### Option A: Temporary Access Token (For Testing)

1. Go to **WhatsApp > API Setup** in your app
2. Find the **"Temporary access token"** section
3. Click **"Generate"** or copy the shown token
4. This token expires in **24 hours**

> **Note**: Temporary tokens are for testing only. Use System User tokens for production.

#### Option B: Permanent System User Token (For Production)

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to **Settings > Business Settings**
3. Click **"Users" > "System Users"**
4. Click **"Add"** to create a new system user:
   - **Name**: e.g., "PrivexBot API User"
   - **Role**: Admin or Employee
5. Click **"Create System User"**
6. Click on the created user
7. Click **"Generate New Token"**
8. Select your app from the dropdown
9. Select permissions:
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`
10. Set token expiration: **Never** (for permanent token)
11. Click **"Generate Token"**
12. **Copy and save this token immediately!**

### Step 7: Get Your Phone Number ID and Business Account ID

You'll need these IDs for API calls:

1. Go to **WhatsApp > API Setup** in your app
2. Note down:
   - **Phone Number ID**: e.g., `123456789012345`
   - **WhatsApp Business Account ID**: e.g., `987654321098765`

---

## Adding to PrivexBot

1. Go to **Settings > API Credentials** in PrivexBot
2. Click **"Add Credential"**
3. Select **"WhatsApp Business"** as the service type
4. Enter a descriptive name (e.g., "Production WhatsApp")
5. Paste your access token in the **"API Key / Bot Token"** field
6. Click **"Add Credential"**

> **Note**: You may also need to configure Phone Number ID separately in your chatbot settings.

---

## Webhook Configuration

WhatsApp requires webhooks for receiving messages:

### Set Up Webhook in Meta App

1. Go to **WhatsApp > Configuration** in your app
2. Click **"Edit"** next to Webhook
3. Enter:
   - **Callback URL**: `https://your-domain.com/api/v1/webhooks/whatsapp/{bot_id}`
   - **Verify Token**: A secret string you create (save this!)
4. Click **"Verify and Save"**
5. Subscribe to webhook fields:
   - ✅ `messages`
   - ✅ `messaging_postbacks` (optional)
   - ✅ `message_template_status_update` (optional)

### Webhook Verification

Meta sends a GET request to verify your webhook:

```
GET /webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=CHALLENGE
```

Your server must respond with the `hub.challenge` value.

---

## Message Templates

WhatsApp requires pre-approved templates for initiating conversations:

### Creating a Template

1. Go to **WhatsApp > Message Templates** in Business Manager
2. Click **"Create Template"**
3. Fill in:
   - **Name**: Template identifier (lowercase, underscores)
   - **Category**: Utility, Marketing, or Authentication
   - **Language**: Select language(s)
   - **Content**: Your message with variables `{{1}}`, `{{2}}`, etc.
4. Submit for review (usually approved within minutes to hours)

### Template Categories

| Category | Use Case | Example |
|----------|----------|---------|
| **Utility** | Updates, confirmations | "Your order {{1}} has shipped!" |
| **Marketing** | Promotions, offers | "Get 20% off with code {{1}}" |
| **Authentication** | OTP, verification | "Your code is {{1}}. Valid for 10 min." |

---

## Pricing

WhatsApp uses conversation-based pricing:

### Conversation Types

| Type | Definition | Example |
|------|------------|---------|
| **User-initiated** | Customer messages first | Customer asks a question |
| **Business-initiated** | You message first | Sending order update |

### Pricing (varies by country)

| Region | User-initiated | Business-initiated |
|--------|---------------|-------------------|
| North America | ~$0.015 | ~$0.025 |
| Western Europe | ~$0.020 | ~$0.035 |
| India | ~$0.005 | ~$0.010 |

> **Free Tier**: 1,000 free user-initiated conversations per month

---

## Rate Limits and Messaging Tiers

### Messaging Tiers

| Tier | Daily Limit | Requirements |
|------|-------------|--------------|
| Unverified | 250 recipients | New businesses |
| Tier 1 | 1,000 recipients | Business verified |
| Tier 2 | 10,000 recipients | Quality rating maintained |
| Tier 3 | 100,000 recipients | High quality, high volume |
| Tier 4 | Unlimited | Enterprise accounts |

### Quality Rating

WhatsApp monitors your message quality:
- **Green**: High quality, can increase tier
- **Yellow**: Medium quality, tier maintained
- **Red**: Low quality, tier may decrease

Factors affecting quality:
- Block rate
- Report rate
- Template rejection rate

---

## Troubleshooting

### "Invalid Access Token" Error

- Token has expired (temporary tokens last 24h)
- Generate a new System User token
- Verify token has required permissions

### "Phone Number Not Registered" Error

- Complete phone verification
- Ensure number is not on regular WhatsApp
- Check number format (include country code)

### "Template Not Found" Error

- Template name is case-sensitive
- Template must be approved
- Check language matches exactly

### "Message Failed to Send" Error

- Check 24-hour messaging window
- Verify recipient number format
- Ensure you're using approved template (if outside window)

### "Webhook Verification Failed"

- Verify token doesn't match
- Callback URL is not accessible
- SSL certificate issues

### "Rate Limit Exceeded" Error

- Exceeded messaging tier limit
- Wait and retry
- Request tier upgrade if needed

---

## 24-Hour Messaging Window

### Rule

After a user messages you, you have **24 hours** to respond with free-form messages. After 24 hours, you must use approved templates.

### Best Practices

1. Respond to users quickly
2. Use templates for proactive messages
3. Keep conversations active with relevant content
4. Don't spam users (affects quality rating)

---

## Testing Your Integration

### Send a Test Message

```bash
curl -X POST \
  "https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "RECIPIENT_PHONE_NUMBER",
    "type": "text",
    "text": {
      "body": "Hello from PrivexBot!"
    }
  }'
```

### Check Phone Number Status

```bash
curl "https://graph.facebook.com/v18.0/PHONE_NUMBER_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Message Templates

```bash
curl "https://graph.facebook.com/v18.0/WHATSAPP_BUSINESS_ACCOUNT_ID/message_templates" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Business Verification

For higher messaging limits:

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to **Settings > Business Settings > Security Center**
3. Click **"Start Verification"**
4. Provide:
   - Legal business name
   - Business address
   - Business phone number
   - Business website
   - Business documents (registration certificate, utility bill, etc.)
5. Wait for verification (usually 1-5 business days)

---

## Security Best Practices

- **Never share** access tokens
- Use **System User tokens** (not personal tokens)
- **Rotate tokens** periodically
- Implement **IP allowlisting** if available
- Monitor for **unusual activity**
- Store tokens in **secure vaults**

---

## Useful Links

- [WhatsApp Business Platform](https://business.whatsapp.com/)
- [Meta for Developers - WhatsApp](https://developers.facebook.com/docs/whatsapp)
- [Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- [Meta Business Suite](https://business.facebook.com/)
- [API Status](https://metastatus.com/)

---

## Support

If you encounter issues:

1. Check [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
2. Visit [Meta for Developers Community](https://developers.facebook.com/community)
3. Contact [Meta Business Support](https://www.facebook.com/business/help)
4. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/whatsapp-cloud-api)
