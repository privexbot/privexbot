# OpenAI API Key Setup Guide

This guide explains how to obtain an OpenAI API key for use with your chatbots.

---

## Overview

| Field | Value |
|-------|-------|
| **Service** | OpenAI |
| **Authentication Type** | API Key |
| **Key Format** | `sk-...` (starts with `sk-`) |
| **Billing** | Pay-as-you-go |
| **Free Tier** | $5 free credits for new accounts (expires after 3 months) |

---

## Prerequisites

- An email address
- A phone number for verification
- A valid payment method (credit/debit card) for continued use after free credits

---

## Step-by-Step Instructions

### Step 1: Create an OpenAI Account

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Click **"Sign Up"** in the top right corner
3. Choose a sign-up method:
   - **Email**: Enter your email and create a password
   - **Google**: Sign in with your Google account
   - **Microsoft**: Sign in with your Microsoft account
   - **Apple**: Sign in with your Apple ID
4. Verify your email address by clicking the link sent to your inbox
5. Complete phone verification:
   - Enter your phone number
   - Enter the verification code sent via SMS

### Step 2: Navigate to API Keys

1. After signing in, go to [API Keys Page](https://platform.openai.com/api-keys)
2. Alternatively:
   - Click on your profile icon in the top right
   - Select **"View API keys"** from the dropdown menu

### Step 3: Create a New API Key

1. Click the **"+ Create new secret key"** button
2. In the dialog that appears:
   - **Name** (optional): Give your key a descriptive name (e.g., "PrivexBot Production")
   - **Permissions**: Choose the appropriate permissions:
     - **All**: Full access to all endpoints
     - **Restricted**: Limited access (recommended for security)
3. Click **"Create secret key"**

### Step 4: Copy and Save Your API Key

> **IMPORTANT**: This is the only time you will see the full API key. Copy it immediately!

1. Click the **copy icon** next to the key
2. Save the key in a secure location:
   - Password manager (recommended)
   - Encrypted notes
   - Environment variables file (never commit to git)
3. Click **"Done"** to close the dialog

### Step 5: Set Up Billing (Required for Continued Use)

1. Go to [Billing Settings](https://platform.openai.com/account/billing/overview)
2. Click **"Add payment method"**
3. Enter your credit/debit card information
4. Set a **usage limit** to prevent unexpected charges:
   - Go to **"Usage limits"**
   - Set a **hard limit** (API stops working when reached)
   - Set a **soft limit** (email notification when reached)

---

## Adding to PrivexBot

1. Go to **Settings > API Credentials** in PrivexBot
2. Click **"Add Credential"**
3. Select **"OpenAI API Key"** as the service type
4. Enter a descriptive name (e.g., "Production OpenAI Key")
5. Paste your API key in the **"API Key / Bot Token"** field
6. Click **"Add Credential"**

---

## API Key Best Practices

### Security

- **Never share** your API key publicly
- **Never commit** API keys to version control (Git)
- **Rotate keys** periodically (every 90 days recommended)
- **Use restricted permissions** when possible
- **Set usage limits** to prevent unexpected charges

### Organization

- Create **separate keys** for development and production
- Use **descriptive names** for easy identification
- **Delete unused keys** promptly

### Monitoring

- Check the [Usage Dashboard](https://platform.openai.com/usage) regularly
- Set up **usage alerts** at appropriate thresholds
- Review which endpoints are consuming the most tokens

---

## Pricing Overview

As of 2024, OpenAI uses a pay-per-token pricing model:

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-4o | $2.50 | $10.00 |
| GPT-4o-mini | $0.15 | $0.60 |
| GPT-4 Turbo | $10.00 | $30.00 |
| GPT-3.5 Turbo | $0.50 | $1.50 |

> **Tip**: For most chatbot use cases, GPT-4o-mini offers the best balance of quality and cost.

---

## Troubleshooting

### "Invalid API Key" Error

- Verify the key starts with `sk-`
- Check for extra spaces before/after the key
- Ensure the key hasn't been deleted or rotated
- Confirm the key has the necessary permissions

### "Rate Limit Exceeded" Error

- You're making too many requests per minute
- Implement exponential backoff in your application
- Consider upgrading your usage tier

### "Insufficient Quota" Error

- Your account has no remaining credits
- Add a payment method to continue
- Check your billing settings for issues

### "Organization Not Found" Error

- Ensure you're using the correct organization ID
- Check if you have access to the organization

---

## Useful Links

- [OpenAI Platform](https://platform.openai.com/)
- [API Documentation](https://platform.openai.com/docs/)
- [Pricing](https://openai.com/pricing)
- [Usage Dashboard](https://platform.openai.com/usage)
- [API Status](https://status.openai.com/)
- [Help Center](https://help.openai.com/)

---

## Support

If you encounter issues:

1. Check the [OpenAI Community Forum](https://community.openai.com/)
2. Contact [OpenAI Support](https://help.openai.com/)
3. Review the [API Reference](https://platform.openai.com/docs/api-reference)
