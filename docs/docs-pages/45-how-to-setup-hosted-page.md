# Hosted Page Setup Guide

Each PrivexBot chatbot can have its own customizable hosted page—a dedicated URL where users can interact with your bot without embedding a widget. This guide covers setup, customization, and sharing options.

---

## Table of Contents

1. [What is a Hosted Page?](#what-is-a-hosted-page)
2. [Enabling Hosted Pages](#enabling-hosted-pages)
3. [URL Structure](#url-structure)
4. [Customization Options](#customization-options)
5. [SEO Settings](#seo-settings)
6. [Public vs Private Access](#public-vs-private-access)
7. [Sharing Your Hosted Page](#sharing-your-hosted-page)
8. [Custom Domains](#custom-domains)
9. [Analytics Tracking](#analytics-tracking)
10. [Troubleshooting](#troubleshooting)

---

## What is a Hosted Page?

A hosted page is a standalone web page dedicated to your chatbot. Instead of embedding a widget on your site, users visit a dedicated URL.

### Use Cases

| Use Case | Description |
|----------|-------------|
| **Shareable Link** | Share via email, social media, QR codes |
| **No Website** | Offer chat without your own website |
| **Branded Experience** | Full-page customizable chat interface |
| **Demo/Testing** | Showcase your bot to stakeholders |
| **Customer Portal** | Dedicated support entry point |

### Widget vs Hosted Page

| Aspect | Widget | Hosted Page |
|--------|--------|-------------|
| Location | Embedded on your site | Standalone URL |
| Branding | Inherits site context | Fully customizable |
| Setup | Script tag required | No code needed |
| Sharing | Share your site URL | Share direct link |
| Analytics | Tracks on your domain | Tracks on PrivexBot |

### Example Hosted Page

```
┌─────────────────────────────────────────────────────────────┐
│  chat.privexbot.com/acme/support                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌─────────────┐                         │
│                    │  [LOGO]     │                         │
│                    │   ACME      │                         │
│                    └─────────────┘                         │
│                                                             │
│              Welcome to Acme Support                        │
│         Get instant answers to your questions               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │                   Chat Widget                       │   │
│  │                   (Full Size)                       │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ Type your message...              [Send]   │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│         © 2024 Acme Inc. | Privacy Policy                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Enabling Hosted Pages

### Step 1: Access Chatbot Settings

1. Go to **Chatbots** → Select your chatbot
2. Navigate to **Settings** → **Hosted Page**

### Step 2: Enable the Feature

```
Hosted Page Settings
────────────────────

[●] Enable Hosted Page

When enabled, your chatbot will be accessible at:
https://chat.privexbot.com/your-workspace/your-chatbot
```

### Step 3: Configure and Save

1. Toggle **Enable Hosted Page** to On
2. Configure customization options (see below)
3. Click **Save Changes**

### Step 4: Access Your Page

After enabling, your hosted page is immediately live at the generated URL.

---

## URL Structure

Hosted pages follow a two-level hierarchy.

### URL Format

```
https://chat.privexbot.com/{workspace-slug}/{chatbot-slug}
```

### Components

| Component | Description | Example |
|-----------|-------------|---------|
| **Domain** | PrivexBot hosted domain | chat.privexbot.com |
| **Workspace Slug** | Your workspace identifier | acme |
| **Chatbot Slug** | Your chatbot identifier | support |

### Full Example

```
Workspace: Acme Corp (slug: acme)
Chatbot: Customer Support (slug: support)

URL: https://chat.privexbot.com/acme/support
```

### Customizing Slugs

**Workspace Slug:**
1. Go to **Workspace Settings** → **General**
2. Edit the **URL Slug** field
3. Save changes

**Chatbot Slug:**
1. Go to **Chatbots** → Select chatbot → **Settings** → **General**
2. Edit the **URL Slug** field
3. Save changes

### Slug Rules

- Lowercase letters, numbers, hyphens only
- Must be unique within context (workspace for chatbot slugs)
- 3-50 characters
- Cannot start/end with hyphen

### Redirects

When you change a slug:
- Old URL automatically redirects to new URL
- Allow a few minutes for propagation
- Update any hardcoded links in your materials

---

## Customization Options

### Branding

```
Branding Settings
─────────────────

Company Logo:
┌─────────────────────────────────────────────────────┐
│ https://yoursite.com/logo.png                       │
│ [Upload] or paste URL                               │
└─────────────────────────────────────────────────────┘
Recommended: Square image, at least 200x200px

Company Name:
┌─────────────────────────────────────────────────────┐
│ Acme Corporation                                    │
└─────────────────────────────────────────────────────┘
Displayed below the logo
```

### Colors and Theme

```
Appearance
──────────

Primary Color:
[  #3b82f6  ] [🎨]

Background:
( ) Solid Color  [  #f3f4f6  ]
(●) Gradient     [  #f3f4f6  ] to [  #dbeafe  ]
( ) Image        [Upload background]

Dark Mode:
[✓] Auto-detect user preference
[ ] Force light mode
[ ] Force dark mode
```

### Text Content

```
Page Content
────────────

Header Text:
┌─────────────────────────────────────────────────────┐
│ Welcome to Acme Support                             │
└─────────────────────────────────────────────────────┘

Subheader Text:
┌─────────────────────────────────────────────────────┐
│ Get instant answers to your questions               │
└─────────────────────────────────────────────────────┘

Footer Text:
┌─────────────────────────────────────────────────────┐
│ © 2024 Acme Inc. | Privacy Policy | Terms          │
└─────────────────────────────────────────────────────┘
Supports Markdown links: [Privacy](https://...)
```

### Chat Widget Settings

```
Chat Widget Appearance
──────────────────────

Chat Height: [600] px  (400-800)
Chat Width:  [400] px  (300-600)
Position:    [● Center] [ Left ] [ Right ]

Welcome Message:
┌─────────────────────────────────────────────────────┐
│ Hi! I'm here to help with any questions about      │
│ Acme products and services.                        │
└─────────────────────────────────────────────────────┘
```

---

## SEO Settings

Optimize your hosted page for search engines.

### Meta Tags

```
SEO Settings
────────────

Page Title:
┌─────────────────────────────────────────────────────┐
│ Acme Support Chat | Get Instant Help                │
└─────────────────────────────────────────────────────┘
Shows in browser tab and search results

Meta Description:
┌─────────────────────────────────────────────────────┐
│ Chat with our AI assistant for instant answers     │
│ about Acme products, orders, and support.          │
└─────────────────────────────────────────────────────┘
150-160 characters recommended
```

### Favicon

```
Favicon:
┌─────────────────────────────────────────────────────┐
│ https://yoursite.com/favicon.ico                    │
│ [Upload] or paste URL                               │
└─────────────────────────────────────────────────────┘
ICO, PNG, or SVG format
```

### Social Sharing (Open Graph)

```
Social Sharing Preview
──────────────────────

OG Image:
┌─────────────────────────────────────────────────────┐
│ https://yoursite.com/social-preview.png             │
└─────────────────────────────────────────────────────┘
Recommended: 1200x630px

When shared on social media:
┌─────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────┐    │
│ │            [Social Preview Image]            │    │
│ └─────────────────────────────────────────────┘    │
│ Acme Support Chat | Get Instant Help               │
│ Chat with our AI assistant for instant answers...  │
│ chat.privexbot.com                                  │
└─────────────────────────────────────────────────────┘
```

---

## Public vs Private Access

### Public Hosted Pages

Anyone with the URL can access:

```
Access Settings
───────────────

Visibility: [● Public] [ Private ]

Public pages are accessible to anyone with the link.
No authentication required.
```

### Private Hosted Pages

Require an API key to chat:

```
Access Settings
───────────────

Visibility: [ Public ] [● Private]

Private pages require an API key.
Users will see a prompt to enter their key.
```

### Private Access Flow

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [LOGO] ACME                            │
│                                                     │
│         This chat requires authentication           │
│                                                     │
│  API Key:                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ pk_live_xxxxxxxx                            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [  Access Chat  ]                                  │
│                                                     │
│  Don't have an API key? Contact the administrator. │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Access Control Use Cases

| Scenario | Recommended |
|----------|-------------|
| Public FAQ bot | Public |
| Internal support | Private |
| Customer portal | Private (with shared keys) |
| Demo/showcase | Public |
| Partner-only access | Private |

---

## Sharing Your Hosted Page

### Direct Link

Copy and share the URL:

```
https://chat.privexbot.com/acme/support
```

### QR Code

Generate a QR code for offline sharing:

1. Go to **Hosted Page** settings
2. Click **Generate QR Code**
3. Download the image
4. Use in print materials, signage, etc.

```
┌─────────────────────┐
│ QR Code Generated   │
├─────────────────────┤
│                     │
│    ██ ██ ██ ██     │
│    ██    ██        │
│    ██ ██ ██ ██     │
│       ██ ██        │
│    ██ ██ ██ ██     │
│                     │
├─────────────────────┤
│ [Download PNG]      │
│ [Download SVG]      │
│ [Copy to Clipboard] │
└─────────────────────┘
```

### Email Signature

Add to your email signature:

```html
<a href="https://chat.privexbot.com/acme/support">
  Chat with our support bot for instant help
</a>
```

### Social Media

Share on social platforms with the OG image preview:

```
🤖 Need help? Chat with our AI support assistant!
Get instant answers 24/7.

https://chat.privexbot.com/acme/support
```

### Embedding as iFrame

Embed the hosted page in other sites:

```html
<iframe
  src="https://chat.privexbot.com/acme/support"
  width="100%"
  height="600"
  frameborder="0"
  title="Acme Support Chat"
></iframe>
```

---

## Custom Domains

*Feature availability may vary by plan.*

### What Custom Domains Provide

Instead of `chat.privexbot.com/acme/support`, use:
- `chat.acme.com/support`
- `support.acme.com`
- Any domain you own

### Setup Process

1. **Choose Your Domain**
   ```
   chat.yourdomain.com
   ```

2. **Add DNS Record**
   ```
   Type: CNAME
   Name: chat
   Value: custom.privexbot.com
   TTL: 3600
   ```

3. **Verify in PrivexBot**
   - Go to **Workspace Settings** → **Custom Domain**
   - Enter your domain
   - Click **Verify**

4. **SSL Certificate**
   - Automatically provisioned
   - May take up to 24 hours

### Custom Domain Status

```
Custom Domain
─────────────
Domain: chat.acme.com
Status: ✓ Active
SSL: ✓ Valid until Dec 31, 2025

Your hosted pages are now accessible at:
https://chat.acme.com/support
https://chat.acme.com/sales
```

---

## Analytics Tracking

### Built-in Analytics

Hosted pages automatically track:
- Page views
- Chat sessions
- Message counts
- Conversion events

View in **Analytics** → filter by hosted page source.

### Custom Analytics Integration

Add your own tracking:

```
Analytics Integration
─────────────────────

Google Analytics ID:
┌─────────────────────────────────────────────────────┐
│ G-XXXXXXXXXX                                        │
└─────────────────────────────────────────────────────┘

Google Tag Manager ID:
┌─────────────────────────────────────────────────────┐
│ GTM-XXXXXXX                                         │
└─────────────────────────────────────────────────────┘

Custom Script (head):
┌─────────────────────────────────────────────────────┐
│ <script>                                            │
│   // Your custom tracking code                      │
│ </script>                                           │
└─────────────────────────────────────────────────────┘
```

### Events Tracked

| Event | Description |
|-------|-------------|
| `page_view` | User loaded the page |
| `chat_start` | User sent first message |
| `chat_message` | Each message sent |
| `lead_submit` | Lead form completed |
| `feedback` | User submitted feedback |

---

## Troubleshooting

### Page Not Loading

| Symptom | Cause | Solution |
|---------|-------|----------|
| 404 error | Wrong URL | Check workspace/chatbot slugs |
| "Not enabled" | Feature off | Enable in settings |
| Blank page | JavaScript error | Check browser console |

### Styling Issues

| Issue | Solution |
|-------|----------|
| Logo not showing | Check URL is publicly accessible |
| Colors wrong | Clear browser cache |
| Broken on mobile | Check responsive settings |

### Custom Domain Issues

| Issue | Solution |
|-------|----------|
| "Domain not verified" | Check DNS propagation (24-48h) |
| SSL error | Wait for certificate provisioning |
| Redirect loop | Remove conflicting DNS records |

### Private Page Access

| Issue | Solution |
|-------|----------|
| API key rejected | Verify key is valid and active |
| Key field not showing | Page set to public, not private |
| Can't generate key | Check chatbot permissions |

---

## Best Practices

### Branding Consistency

- Use same logo as your main site
- Match color scheme to brand guidelines
- Keep messaging consistent with brand voice

### Mobile Optimization

- Test on various screen sizes
- Ensure logo is readable when small
- Verify chat widget is usable on mobile

### Performance

- Optimize logo/background image sizes
- Use modern image formats (WebP)
- Test load time from different regions

### Accessibility

- Ensure sufficient color contrast
- Provide alt text for images
- Test with screen readers

---

## Next Steps

- **[Integrate Widget](35-how-to-integrate-widget.md)**: Add chat to your own site
- **[View Analytics](44-how-to-use-analytics.md)**: Track hosted page performance
- **[Manage Leads](38-how-to-manage-leads.md)**: Handle captured contacts

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
