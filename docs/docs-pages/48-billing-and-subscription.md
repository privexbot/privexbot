# Billing and Subscription Guide

Manage your PrivexBot subscription, understand pricing tiers, and handle billing operations. This guide covers everything related to payments and plans.

---

## Table of Contents

1. [Subscription Tiers](#subscription-tiers)
2. [Trial Period](#trial-period)
3. [Managing Subscription](#managing-subscription)
4. [Billing Information](#billing-information)
5. [Usage Limits by Tier](#usage-limits-by-tier)
6. [Upgrading and Downgrading](#upgrading-and-downgrading)
7. [Cancellation](#cancellation)
8. [FAQs](#faqs)

---

## Subscription Tiers

PrivexBot offers tiered pricing to match different needs.

### Plan Comparison

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PrivexBot Plans                                  │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│              │    Free      │   Starter    │     Pro      │ Enterprise  │
├──────────────┼──────────────┼──────────────┼──────────────┼─────────────┤
│ Price        │ $0/mo        │ $29/mo       │ $99/mo       │ Custom      │
├──────────────┼──────────────┼──────────────┼──────────────┼─────────────┤
│ Chatbots     │ 1            │ 5            │ 20           │ Unlimited   │
│ Knowledge    │ 1 (100 docs) │ 5 (500 docs) │ 20 (2k docs) │ Unlimited   │
│ Bases        │              │              │              │             │
│ Messages/mo  │ 500          │ 5,000        │ 25,000       │ Unlimited   │
│ Team Members │ 1            │ 3            │ 10           │ Unlimited   │
│ Channels     │ Widget only  │ All          │ All          │ All         │
│ Support      │ Community    │ Email        │ Priority     │ Dedicated   │
├──────────────┼──────────────┼──────────────┼──────────────┼─────────────┤
│              │ [Get Free]   │ [Start Free] │ [Start Free] │ [Contact]   │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────┘
```

### Free Tier

Perfect for trying out PrivexBot:

| Feature | Limit |
|---------|-------|
| Chatbots | 1 |
| Knowledge Bases | 1 |
| Documents per KB | 100 |
| Messages per month | 500 |
| Team members | 1 (you) |
| Channels | Widget only |
| Support | Community forums |

### Starter Plan ($29/month)

For small teams and projects:

| Feature | Limit |
|---------|-------|
| Chatbots | 5 |
| Knowledge Bases | 5 |
| Documents per KB | 500 |
| Messages per month | 5,000 |
| Team members | 3 |
| Channels | All (widget, Telegram, Discord, WhatsApp) |
| Support | Email (48h response) |

### Pro Plan ($99/month)

For growing businesses:

| Feature | Limit |
|---------|-------|
| Chatbots | 20 |
| Knowledge Bases | 20 |
| Documents per KB | 2,000 |
| Messages per month | 25,000 |
| Team members | 10 |
| Channels | All |
| Support | Priority (24h response) |
| Analytics | Advanced |
| API access | Full |

### Enterprise Plan (Custom)

For large organizations:

| Feature | Included |
|---------|----------|
| Chatbots | Unlimited |
| Knowledge Bases | Unlimited |
| Documents | Unlimited |
| Messages | Unlimited |
| Team members | Unlimited |
| Channels | All + custom |
| Support | Dedicated account manager |
| SLA | 99.9% uptime guarantee |
| Security | SOC 2, HIPAA compliance |
| Deployment | On-premise option |

Contact sales for custom pricing.

---

## Trial Period

### 30-Day Free Trial

All paid plans include a free trial:

```
Start Your Free Trial
─────────────────────

✓ 30 days free, no credit card required
✓ Full access to Pro features
✓ Cancel anytime during trial
✓ Downgrade to Free if you don't upgrade

[  Start Pro Trial  ]
```

### What's Included

During trial, you get full Pro plan access:
- 20 chatbots
- 20 knowledge bases
- 25,000 messages
- 10 team members
- All channels
- Priority support

### Trial Timeline

```
Day 1                    Day 25                   Day 30
  │                        │                        │
  ▼                        ▼                        ▼
Trial                   Reminder                 Trial
Starts                  Email                    Ends
                                                   │
                                                   ▼
                                          ┌──────────────┐
                                          │ Add payment  │
                                          │ OR           │
                                          │ Downgrade    │
                                          └──────────────┘
```

### After Trial

If you don't add payment:
- Account stays active
- Automatically moves to Free tier
- No data deleted
- Excess resources become read-only

---

## Managing Subscription

### Accessing Billing

1. Click your profile icon
2. Select **Billing**
3. Or go to **Organization Settings** → **Billing**

### Billing Dashboard

```
Billing Overview
────────────────────────────────────────────────────────

Current Plan: Pro
Status: Active
Billing Cycle: Monthly
Next Billing Date: February 15, 2024
Amount: $99.00

Usage This Period:
├── Messages: 12,456 / 25,000 (50%)
├── Chatbots: 8 / 20
└── Team Members: 5 / 10

[  Change Plan  ] [  Update Payment  ] [  View Invoices  ]
```

### Viewing Invoices

```
Invoice History
───────────────

┌─────────────────────────────────────────────────────────────┐
│ Date        │ Description      │ Amount   │ Status │ PDF    │
├─────────────┼──────────────────┼──────────┼────────┼────────┤
│ Jan 15, 2024│ Pro Plan Monthly │ $99.00   │ Paid   │ [↓]    │
│ Dec 15, 2023│ Pro Plan Monthly │ $99.00   │ Paid   │ [↓]    │
│ Nov 15, 2023│ Starter Monthly  │ $29.00   │ Paid   │ [↓]    │
└─────────────┴──────────────────┴──────────┴────────┴────────┘
```

---

## Billing Information

### Payment Methods

Accepted payment methods:

| Method | Supported |
|--------|-----------|
| Credit/Debit Card | Visa, Mastercard, Amex |
| Bank Transfer | Enterprise only |
| Wire Transfer | Enterprise only |

### Updating Payment Method

1. Go to **Billing** → **Payment Methods**
2. Click **Add Payment Method**
3. Enter card details
4. Click **Save**

```
Add Payment Method
──────────────────

Card Number:
┌─────────────────────────────────────────────────────┐
│ 4242 4242 4242 4242                                 │
└─────────────────────────────────────────────────────┘

Expiry:          CVV:
┌─────────────┐  ┌─────────────┐
│ 12/25       │  │ 123         │
└─────────────┘  └─────────────┘

Billing Address:
┌─────────────────────────────────────────────────────┐
│ 123 Main Street                                     │
│ San Francisco, CA 94102                             │
└─────────────────────────────────────────────────────┘

[  Cancel  ] [  Save Card  ]
```

### Billing Address

Update for invoice purposes:

```
Billing Address
───────────────

Company Name (optional):
┌─────────────────────────────────────────────────────┐
│ Acme Corporation                                    │
└─────────────────────────────────────────────────────┘

Address:
┌─────────────────────────────────────────────────────┐
│ 123 Main Street, Suite 400                          │
└─────────────────────────────────────────────────────┘

City:              State:          ZIP:
┌──────────────┐  ┌─────────────┐  ┌─────────────┐
│ San Francisco│  │ CA          │  │ 94102       │
└──────────────┘  └─────────────┘  └─────────────┘

Country:
┌─────────────────────────────────────────────────────┐
│ United States                                       │
└─────────────────────────────────────────────────────┘
```

---

## Usage Limits by Tier

### How Limits Work

| Limit Type | Behavior When Exceeded |
|------------|------------------------|
| **Messages** | Soft limit - notification sent, service continues |
| **Chatbots** | Hard limit - cannot create more |
| **Knowledge Bases** | Hard limit - cannot create more |
| **Team Members** | Hard limit - cannot invite more |
| **Documents** | Hard limit - cannot upload more |

### Monitoring Usage

```
Usage Dashboard
───────────────

Messages This Month
████████████████░░░░░░░░░░░░░░  15,234 / 25,000 (61%)

Chatbots
████████░░░░░░░░░░░░░░░░░░░░░░  8 / 20 (40%)

Knowledge Bases
██████░░░░░░░░░░░░░░░░░░░░░░░░  6 / 20 (30%)

Team Members
██████████░░░░░░░░░░░░░░░░░░░░  5 / 10 (50%)

Storage Used
████████████████████░░░░░░░░░░  2.1 GB / 5 GB (42%)
```

### Overage Alerts

You'll receive alerts at:
- 80% of limit (warning)
- 100% of limit (reached)
- 120% of limit (exceeded, for soft limits)

---

## Upgrading and Downgrading

### Upgrading

**To upgrade your plan:**

1. Go to **Billing**
2. Click **Change Plan**
3. Select higher tier
4. Confirm and pay

**What happens:**
- New limits effective immediately
- Prorated charge for current period
- No data changes needed

```
Upgrade to Pro
──────────────

Current Plan: Starter ($29/mo)
New Plan: Pro ($99/mo)

Prorated charge today: $46.67
(for remaining 20 days of billing period)

Next billing: $99.00 on Feb 15, 2024

[  Cancel  ] [  Upgrade Now  ]
```

### Downgrading

**To downgrade your plan:**

1. Go to **Billing**
2. Click **Change Plan**
3. Select lower tier
4. Review what will change

**What happens:**
- Change effective at end of billing period
- Excess resources become read-only
- No data deleted, but cannot edit excess

```
Downgrade to Starter
────────────────────

Current Plan: Pro ($99/mo)
New Plan: Starter ($29/mo)

⚠️ Warning: You currently exceed Starter limits:

Resources over limit:
├── Chatbots: 8 (limit: 5) - 3 will be read-only
├── Knowledge Bases: 6 (limit: 5) - 1 will be read-only
└── Team Members: 5 (limit: 3) - 2 will lose access

Change takes effect: February 15, 2024
(end of current billing period)

[  Cancel  ] [  Schedule Downgrade  ]
```

### Annual vs Monthly Billing

Save with annual billing:

| Plan | Monthly | Annual | Savings |
|------|---------|--------|---------|
| Starter | $29/mo | $290/yr ($24/mo) | 17% |
| Pro | $99/mo | $990/yr ($82/mo) | 17% |

Switch billing cycle in **Billing** → **Change Billing Cycle**.

---

## Cancellation

### How to Cancel

1. Go to **Billing**
2. Click **Cancel Subscription**
3. Select reason (optional feedback)
4. Confirm cancellation

```
Cancel Subscription
───────────────────

We're sorry to see you go!

Your subscription will remain active until:
February 15, 2024 (end of billing period)

After cancellation:
• Your account moves to Free tier
• Excess chatbots become read-only
• Excess team members lose access
• No data is deleted

Reason for cancellation (optional):
[ ] Too expensive
[ ] Missing features
[ ] Switching to competitor
[ ] Project completed
[ ] Other: ______________

[  Keep Subscription  ] [  Cancel Subscription  ]
```

### After Cancellation

What happens:
- Immediate: Nothing changes
- End of period: Move to Free tier
- Read-only: Excess resources locked
- Data: Nothing deleted

### Reactivating

To reactivate after cancellation:
1. Go to **Billing**
2. Select a plan
3. Add payment method
4. All resources unlocked

---

## FAQs

### Payments

**Q: What happens if my payment fails?**
A: We retry 3 times over 7 days. You'll receive email notifications. Service continues during retry period.

**Q: Can I get a refund?**
A: We offer refunds within 14 days of initial purchase. Contact support for pro-rated refunds on annual plans.

**Q: Do you offer discounts?**
A: Yes! Nonprofit and education discounts available. Contact sales.

### Usage

**Q: What counts as a "message"?**
A: One user message + one bot response = 2 messages. System messages don't count.

**Q: What if I exceed my message limit?**
A: Soft limit - we'll notify you but service continues. Consider upgrading or messages may be throttled.

**Q: Are archived chatbots counted?**
A: No, only active chatbots count toward your limit.

### Plans

**Q: Can I switch plans anytime?**
A: Yes! Upgrades are immediate. Downgrades take effect at end of billing period.

**Q: What's the Enterprise SLA?**
A: 99.9% uptime guarantee with financial credits for downtime. Details in Enterprise agreement.

**Q: Do you offer custom plans?**
A: Yes, for Enterprise customers. Contact sales to discuss your needs.

### Data

**Q: What happens to my data if I cancel?**
A: Data is retained for 90 days. Reactivate anytime to restore full access.

**Q: Can I export my data?**
A: Yes! Go to Settings → Data Export to download all your data.

---

## Enterprise Contact

For Enterprise inquiries:

- **Sales**: sales@privexbot.com
- **Volume discounts**: Available for 50+ users
- **Custom deployments**: On-premise and dedicated cloud
- **Compliance**: SOC 2, HIPAA, GDPR compliant options

```
Request Enterprise Demo
───────────────────────

Name: ________________
Company: ________________
Email: ________________
Phone: ________________
Team Size: [  Select ▼  ]
Use Case: ________________

[  Request Demo  ]
```

---

## Next Steps

- **[Account Settings](46-how-to-manage-account.md)**: Manage your profile
- **[Multi-Tenant Setup](49-multi-tenant-setup.md)**: Set up your organization
- **[Troubleshooting](50-troubleshooting-guide.md)**: Get help

---

*Need billing help? Contact billing@privexbot.com or visit our [Troubleshooting Guide](50-troubleshooting-guide.md).*
