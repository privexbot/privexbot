# Lead Management Guide

PrivexBot captures and manages leads from all your chat channels. This guide covers how leads are captured, how to view and manage them, and best practices for converting leads to customers.

---

## Table of Contents

1. [What are Leads in PrivexBot?](#what-are-leads-in-privexbot)
2. [Lead Capture Configuration](#lead-capture-configuration)
3. [How Leads are Captured](#how-leads-are-captured)
4. [Leads Dashboard](#leads-dashboard)
5. [Viewing Lead Details](#viewing-lead-details)
6. [Updating Lead Status](#updating-lead-status)
7. [Exporting Leads](#exporting-leads)
8. [Lead Analytics](#lead-analytics)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## What are Leads in PrivexBot?

A **lead** is contact information collected from someone who interacts with your chatbots. Leads help you:

- Follow up with interested visitors
- Track where your engagement comes from
- Measure chatbot conversion effectiveness
- Build your contact database

### Lead Data Collected

| Field | Description | Capture Method |
|-------|-------------|----------------|
| **Email** | Primary contact | Form input |
| **Name** | Display name | Form input |
| **Phone** | Phone number | Form input or WhatsApp verified |
| **Source Channel** | Where they chatted | Automatic |
| **Chatbot** | Which bot they used | Automatic |
| **Location** | Geographic data | IP geolocation |
| **First Message** | Conversation opener | Automatic |
| **Consent** | GDPR agreement | Form checkbox |
| **Custom Fields** | Your defined fields | Form input |

---

## Lead Capture Configuration

Configure lead capture in your chatbot settings.

### Accessing Lead Capture Settings

1. Go to **Chatbots** → Select your chatbot
2. Navigate to **Settings** → **Lead Capture**

### Timing Options

Choose when the lead capture form appears:

| Option | When It Shows | Best For |
|--------|---------------|----------|
| **Before Chat** | Immediately when widget opens | High-value leads, sales bots |
| **After N Messages** | After specified number of exchanges | Qualifying engaged visitors |
| **Never** | No form shown | Public info bots, support |

### Configuring "Before Chat"

```
Lead Capture Settings
─────────────────────
Timing: [Before Chat ▼]

Form appears when user opens the chat widget.
They must complete the form before chatting.
```

### Configuring "After Messages"

```
Lead Capture Settings
─────────────────────
Timing: [After Messages ▼]
Show after: [3] messages

Form appears after the user has sent 3 messages.
Captures already-engaged visitors.
```

### Standard Fields

Toggle which fields to collect:

| Field | Options |
|-------|---------|
| **Email** | Required / Optional / Hidden |
| **Name** | Required / Optional / Hidden |
| **Phone** | Required / Optional / Hidden |

### Custom Fields

Add your own fields:

1. Click **+ Add Custom Field**
2. Configure:

```
Field Configuration
───────────────────
Key: company
Label: Company Name
Type: [Text ▼]
Required: [ ] Yes
Placeholder: Enter your company name
```

**Available Field Types:**

| Type | Use Case | Example |
|------|----------|---------|
| Text | Short answers | Company name |
| Email | Email addresses | Work email |
| Phone | Phone numbers | Mobile number |
| Textarea | Long answers | How can we help? |
| Select | Multiple choice | Department |
| Checkbox | Yes/no | Newsletter signup |

### GDPR Consent Configuration

For privacy compliance:

```
GDPR Settings
─────────────
[✓] Enable consent checkbox

Consent Text:
┌─────────────────────────────────────────────────┐
│ I agree to the [privacy policy] and consent    │
│ to being contacted about my inquiry.           │
└─────────────────────────────────────────────────┘

Privacy Policy URL: https://yoursite.com/privacy
[✓] Consent required to submit form
```

---

## How Leads are Captured

Lead capture varies by channel.

### Website Widget

```
┌─────────────────────────────────────┐
│         Start a conversation        │
├─────────────────────────────────────┤
│                                     │
│  Email *                            │
│  ┌─────────────────────────────┐   │
│  │ your@email.com              │   │
│  └─────────────────────────────┘   │
│                                     │
│  Name                               │
│  ┌─────────────────────────────┐   │
│  │ Your name                   │   │
│  └─────────────────────────────┘   │
│                                     │
│  [✓] I agree to the privacy policy │
│                                     │
│  [      Start Chatting      ]      │
│                                     │
└─────────────────────────────────────┘
```

**Flow:**
1. User opens widget
2. Form displays (based on timing setting)
3. User completes required fields
4. Form validates and submits
5. Lead created in database
6. Chat begins

### Telegram

Telegram leads are captured automatically:

| Data | Source | Always Available |
|------|--------|------------------|
| Telegram ID | Platform | Yes |
| Username | Profile | If public |
| First Name | Profile | Yes |
| Last Name | Profile | If provided |

**Note**: Email and phone require explicit user input via conversation.

### Discord

Discord leads capture:

| Data | Source | Always Available |
|------|--------|------------------|
| Discord ID | Platform | Yes |
| Username | Profile | Yes |
| Display Name | Server nickname | If set |
| Server | Guild | Yes |

### WhatsApp

WhatsApp provides **verified phone numbers**:

| Data | Source | Verification |
|------|--------|--------------|
| Phone Number | WhatsApp account | Verified by Meta |
| Display Name | Profile | User-provided |

**Why WhatsApp Phone Numbers are Valuable:**
- Phone numbers are verified during WhatsApp registration
- Cannot be spoofed or faked
- Direct line to the customer
- Higher quality than form-submitted numbers

---

## Leads Dashboard

### Accessing the Dashboard

1. Navigate to **Leads** in workspace sidebar
2. View all leads across chatbots

### Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Leads                                    [Export ▼] [+ Add Lead]  │
├────────────────────────────────────────────────────────────────────┤
│  Stats: 234 Total | 45 New | 89 Contacted | 23 Converted          │
├────────────────────────────────────────────────────────────────────┤
│  View: [Table] [Grid] [Map]    Filter: [All Bots ▼] [All Status ▼]│
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────┬────────────────┬─────────────┬──────────┬──────────┐   │
│  │Status│ Contact        │ Source      │ Channel  │ Date     │   │
│  ├──────┼────────────────┼─────────────┼──────────┼──────────┤   │
│  │ ● New│ john@email.com │ Support Bot │ Widget   │ 2h ago   │   │
│  │ ◐    │ sarah@corp.io  │ Sales Bot   │ Telegram │ 5h ago   │   │
│  │ ✓    │ +1234567890    │ Sales Bot   │ WhatsApp │ 1d ago   │   │
│  └──────┴────────────────┴─────────────┴──────────┴──────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### View Options

#### Table View
- Sortable columns
- Quick status updates
- Bulk selection

#### Grid View
- Card-based layout
- More visible details
- Better for browsing

#### Map View
- Geographic distribution
- Location-based insights
- Cluster visualization

### Filtering Leads

| Filter | Options |
|--------|---------|
| **Chatbot** | All or specific bot |
| **Status** | New, Contacted, Qualified, Converted, Lost |
| **Channel** | Widget, Telegram, Discord, WhatsApp, API |
| **Date Range** | Last 7/30/90 days or custom |
| **Search** | Email, name, or phone |

### Sorting Options

| Sort By | Description |
|---------|-------------|
| Newest First | Most recent leads |
| Oldest First | Earliest leads |
| Name A-Z | Alphabetical |
| Status | Group by status |

---

## Viewing Lead Details

Click on any lead to see full details.

### Lead Detail View

```
┌────────────────────────────────────────────────────────────────┐
│  Lead Details                                   [Edit] [Delete]│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Contact Information                                           │
│  ─────────────────────                                         │
│  Email: john.doe@company.com                                   │
│  Name: John Doe                                                │
│  Phone: +1 (555) 123-4567                                      │
│  Company: Acme Corp (custom field)                             │
│                                                                │
│  Source Information                                            │
│  ─────────────────────                                         │
│  Chatbot: Customer Support Bot                                 │
│  Channel: Website Widget                                       │
│  First Message: "I need help with my order"                    │
│  Captured: January 15, 2024 at 2:34 PM                        │
│                                                                │
│  Location                                                      │
│  ─────────────────────                                         │
│  City: San Francisco                                           │
│  Region: California                                            │
│  Country: United States                                        │
│  Timezone: America/Los_Angeles                                 │
│                                                                │
│  Consent                                                       │
│  ─────────────────────                                         │
│  Privacy Policy: ✓ Agreed on Jan 15, 2024                     │
│  Marketing: ✓ Opted in                                         │
│                                                                │
│  Status: [New ▼]                                               │
│                                                                │
│  Notes                                                         │
│  ─────────────────────                                         │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Add internal notes about this lead...                  │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Available Actions

| Action | Description |
|--------|-------------|
| **Edit** | Update lead information |
| **Delete** | Remove lead permanently |
| **Change Status** | Update lead status |
| **Add Note** | Internal notes for your team |
| **View Conversation** | See chat history (if available) |

---

## Updating Lead Status

Track leads through your sales/support funnel.

### Status Definitions

| Status | Meaning | Next Actions |
|--------|---------|--------------|
| **New** | Just captured, not reviewed | Review and contact |
| **Contacted** | Initial outreach made | Await response |
| **Qualified** | Confirmed as potential customer | Schedule demo/call |
| **Converted** | Became a customer | Move to CRM |
| **Lost** | Not proceeding | Archive |

### Changing Status

**Single Lead:**
1. Click on the lead
2. Use the Status dropdown
3. Select new status
4. Status updates immediately

**Bulk Update:**
1. Select multiple leads using checkboxes
2. Click **Bulk Actions**
3. Select **Change Status**
4. Choose new status
5. Confirm

### Status Flow Diagram

```
                    ┌───────────┐
                    │    New    │
                    └─────┬─────┘
                          │
                          ▼
                    ┌───────────┐
              ┌─────│ Contacted │─────┐
              │     └───────────┘     │
              │                       │
              ▼                       ▼
        ┌───────────┐           ┌───────────┐
        │ Qualified │           │   Lost    │
        └─────┬─────┘           └───────────┘
              │
              ▼
        ┌───────────┐
        │ Converted │
        └───────────┘
```

---

## Exporting Leads

Export leads for use in other systems.

### Export Formats

| Format | Best For |
|--------|----------|
| **CSV** | Spreadsheets, CRMs, email tools |
| **JSON** | Developer integrations, APIs |

### How to Export

1. Go to **Leads** dashboard
2. Apply any filters (optional)
3. Click **Export**
4. Choose format (CSV/JSON)
5. Select fields to include
6. Click **Download**

### Export Options

```
Export Leads
────────────
Format: [CSV ▼]

Include Records:
( ) All leads
(•) Filtered leads (45 matching)
( ) Selected leads (3 selected)

Fields to Include:
[✓] Email
[✓] Name
[✓] Phone
[✓] Status
[✓] Source (Chatbot)
[✓] Channel
[✓] Captured Date
[✓] Location
[ ] First Message
[✓] Custom Fields
[ ] Consent Details

[  Cancel  ] [  Export  ]
```

### CSV Export Sample

```csv
email,name,phone,status,chatbot,channel,captured_at,city,country
john@email.com,John Doe,+15551234567,new,Support Bot,widget,2024-01-15,San Francisco,US
sarah@corp.io,Sarah Smith,,contacted,Sales Bot,telegram,2024-01-14,New York,US
```

---

## Lead Analytics

### Accessing Lead Analytics

1. Navigate to **Analytics** → **Leads** tab
2. View metrics and charts

### Available Metrics

| Metric | Description |
|--------|-------------|
| **Total Leads** | All-time lead count |
| **New This Period** | Leads in selected date range |
| **Conversion Rate** | Percentage reaching Converted |
| **By Channel** | Distribution across channels |
| **By Chatbot** | Which bots capture most |

### Leads Over Time Chart

```
Leads Captured (Last 30 Days)
│
│          ╭─╮
│    ╭─╮   │ │
│    │ │ ╭─╯ │
│  ╭─╯ ╰─╯   ╰─╮    ╭──╮
│╭─╯           ╰────╯  ╰─
└─────────────────────────────
 Week 1   Week 2   Week 3   Week 4
```

### Conversion Funnel

```
New         ████████████████████████████  234 (100%)
            ↓
Contacted   ██████████████████            156 (67%)
            ↓
Qualified   █████████████                  89 (38%)
            ↓
Converted   ███████                        45 (19%)
```

### Top Performing Bots

| Chatbot | Leads | Conversion Rate |
|---------|-------|-----------------|
| Sales Bot | 89 | 24% |
| Support Bot | 78 | 12% |
| Product Bot | 67 | 18% |

---

## Best Practices

### Lead Capture Timing

| Scenario | Recommended Timing |
|----------|-------------------|
| Sales/high-value products | Before chat |
| Support/service | After 3-5 messages |
| General information | Never or after engagement |
| Events/webinars | Before chat |

### Form Design

**Do:**
- Keep forms short (3-4 fields max)
- Mark only essential fields as required
- Use clear, helpful placeholder text
- Explain why you're collecting data

**Don't:**
- Ask for unnecessary information
- Make all fields required
- Use confusing field labels
- Hide privacy policy link

### Field Requirements by Use Case

| Use Case | Required | Optional |
|----------|----------|----------|
| Sales follow-up | Email | Name, Phone, Company |
| Support ticket | Email | Name |
| Newsletter | Email | Name |
| Demo request | Email, Name | Phone, Company |

### Lead Quality vs. Quantity

```
High Friction (fewer, higher quality leads)
┌─────────────────────────────────────────┐
│ Before chat + Many required fields      │
│ + Detailed custom questions             │
└─────────────────────────────────────────┘

Medium Friction (balanced approach)
┌─────────────────────────────────────────┐
│ After 2-3 messages + Email required     │
│ + Name optional                         │
└─────────────────────────────────────────┘

Low Friction (more leads, varying quality)
┌─────────────────────────────────────────┐
│ After 5+ messages + Email only          │
│ + All optional                          │
└─────────────────────────────────────────┘
```

### GDPR Compliance Checklist

- [ ] Clear consent checkbox
- [ ] Link to privacy policy
- [ ] Explain data usage
- [ ] Provide opt-out mechanism
- [ ] Secure data storage
- [ ] Retention policy defined

---

## Troubleshooting

### Leads Not Being Captured

| Symptom | Possible Cause | Solution |
|---------|----------------|----------|
| No leads appearing | Lead capture disabled | Enable in chatbot settings |
| Form not showing | Timing misconfigured | Check timing settings |
| Form submit fails | Validation error | Check required fields |
| Platform leads missing | Webhook issue | Verify webhook registration |

### Duplicate Leads

**Cause**: Same person chatting multiple times

**How PrivexBot Handles It**:
- Deduplication by email address
- Updates existing lead with new data
- Preserves original capture date

**If Seeing Duplicates**:
1. Check if emails differ slightly
2. Review capture timestamps
3. Consider merging manually

### Missing Lead Data

| Missing Data | Reason | Solution |
|--------------|--------|----------|
| Location | IP lookup failed | Normal for some IPs |
| Phone | Field not captured | Add phone field |
| Name | Field was optional | Make required if needed |
| Custom fields | Not configured | Add to lead capture form |

### Export Issues

| Issue | Solution |
|-------|----------|
| Export button disabled | Select leads or remove filters |
| Empty export | No leads match criteria |
| Missing fields | Check field selection in export |
| Encoding issues | Use UTF-8 compatible application |

### Channel-Specific Issues

**Telegram:**
- Username shows as ID → User has no public username
- Name missing → Profile not fully set up

**Discord:**
- Only see ID → User left server
- Missing details → Bot lacks permissions

**WhatsApp:**
- No name → User hasn't set profile name
- Phone format varies → International formatting differences

---

## Integrations

### CRM Integration

Export leads and import into:
- HubSpot
- Salesforce
- Pipedrive
- Zoho CRM

### Email Marketing

Connect leads to:
- Mailchimp
- ConvertKit
- ActiveCampaign
- Drip

### Zapier Webhook

Automatically send leads to other apps:

1. Go to chatbot **Settings** → **Integrations**
2. Enable **Zapier Webhook**
3. Copy the webhook URL
4. Create Zap in Zapier
5. Use "Webhooks by Zapier" as trigger

---

## Next Steps

- **[Configure Widget](35-how-to-integrate-widget.md)**: Set up lead capture forms
- **[View Analytics](44-how-to-use-analytics.md)**: Track lead performance
- **[Deploy to Telegram](39-how-to-deploy-telegram-bot.md)**: Capture leads from messaging

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
