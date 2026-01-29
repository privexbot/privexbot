# Multi-Tenant Setup Guide

PrivexBot's multi-tenant architecture helps you organize teams, projects, and resources. This guide explains the hierarchy and how to set up your organization effectively.

---

## Table of Contents

1. [Understanding the Hierarchy](#understanding-the-hierarchy)
2. [Organization Roles](#organization-roles)
3. [Workspace Roles](#workspace-roles)
4. [Creating Organizations](#creating-organizations)
5. [Managing Multiple Organizations](#managing-multiple-organizations)
6. [Creating Workspaces](#creating-workspaces)
7. [Team Setup Best Practices](#team-setup-best-practices)
8. [Permission Best Practices](#permission-best-practices)
9. [Data Isolation Guarantees](#data-isolation-guarantees)
10. [Troubleshooting](#troubleshooting)

---

## Understanding the Hierarchy

PrivexBot uses a three-level hierarchy:

```
Organization (Company/Account)
    │
    ├── Workspace A (Team/Department/Project)
    │   ├── Chatbots
    │   ├── Chatflows
    │   ├── Knowledge Bases
    │   ├── Credentials
    │   └── Leads
    │
    ├── Workspace B
    │   ├── Chatbots
    │   ├── ...
    │   └── Leads
    │
    └── Workspace C
        └── ...
```

### Level 1: Organization

The top-level container representing your company or account.

| Attribute | Description |
|-----------|-------------|
| **Name** | Your company name |
| **Slug** | URL identifier |
| **Billing** | Subscription and payments |
| **Members** | All users across workspaces |

### Level 2: Workspace

A subdivision for teams, departments, or projects.

| Attribute | Description |
|-----------|-------------|
| **Name** | Team or project name |
| **Slug** | URL identifier |
| **Resources** | Chatbots, KBs, credentials |
| **Members** | Users with workspace access |

### Level 3: Resources

The actual chatbots and data within workspaces.

| Resource | Belongs To |
|----------|-----------|
| Chatbots | Workspace |
| Chatflows | Workspace |
| Knowledge Bases | Workspace |
| Credentials | Workspace |
| Leads | Workspace |

### Example Structure

```
Acme Corporation (Organization)
├── Customer Support (Workspace)
│   ├── Support Bot (Chatbot)
│   ├── FAQ Knowledge Base
│   └── Support Leads
│
├── Sales (Workspace)
│   ├── Sales Assistant (Chatbot)
│   ├── Product Catalog KB
│   └── Sales Leads
│
└── Engineering (Workspace)
    ├── Docs Helper (Chatbot)
    └── Technical Docs KB
```

---

## Organization Roles

Organization-level roles control overall access.

### Available Roles

| Role | Description | Count |
|------|-------------|-------|
| **Owner** | Full control, billing, can delete org | 1 per org |
| **Admin** | Manage members, create workspaces | Unlimited |
| **Member** | Access assigned workspaces | Unlimited |

### Role Permissions

```
Organization Permissions Matrix
───────────────────────────────────────────────────────────────────
│ Permission              │ Owner │ Admin │ Member │
├─────────────────────────┼───────┼───────┼────────┤
│ View organization       │   ✓   │   ✓   │   ✓    │
│ Edit org settings       │   ✓   │   ✓   │   ✗    │
│ Manage billing          │   ✓   │   ✗   │   ✗    │
│ Delete organization     │   ✓   │   ✗   │   ✗    │
│ Create workspaces       │   ✓   │   ✓   │   ✗    │
│ Invite org members      │   ✓   │   ✓   │   ✗    │
│ Remove org members      │   ✓   │   ✓   │   ✗    │
│ Change member roles     │   ✓   │   ✓*  │   ✗    │
│ Access all workspaces   │   ✓   │   ✓   │   ✗    │
└─────────────────────────┴───────┴───────┴────────┘
*Admins cannot change Owner role
```

### Inviting Organization Members

1. Go to **Organization Settings** → **Members**
2. Click **Invite Member**
3. Enter email and select role
4. Send invitation

```
Invite to Organization
──────────────────────

Email:
┌─────────────────────────────────────────────────────┐
│ newmember@example.com                               │
└─────────────────────────────────────────────────────┘

Role:
(•) Member - Can access assigned workspaces
( ) Admin - Can manage organization and all workspaces
( ) Owner - Transfer ownership (you will become Admin)

[  Cancel  ] [  Send Invitation  ]
```

---

## Workspace Roles

Workspace-level roles provide granular access control.

### Available Roles

| Role | Description |
|------|-------------|
| **Admin** | Full workspace control |
| **Editor** | Create and edit resources |
| **Viewer** | Read-only access |

### Role Permissions

```
Workspace Permissions Matrix
───────────────────────────────────────────────────────────────────
│ Permission              │ Admin │ Editor │ Viewer │
├─────────────────────────┼───────┼────────┼────────┤
│ View workspace          │   ✓   │   ✓    │   ✓    │
│ View chatbots           │   ✓   │   ✓    │   ✓    │
│ View knowledge bases    │   ✓   │   ✓    │   ✓    │
│ View leads              │   ✓   │   ✓    │   ✓    │
│ View credentials*       │   ✓   │   ✓    │   ✗    │
│ Create chatbots         │   ✓   │   ✓    │   ✗    │
│ Edit chatbots           │   ✓   │   ✓    │   ✗    │
│ Delete chatbots         │   ✓   │   ✓    │   ✗    │
│ Create knowledge bases  │   ✓   │   ✓    │   ✗    │
│ Manage credentials      │   ✓   │   ✗    │   ✗    │
│ Edit workspace settings │   ✓   │   ✗    │   ✗    │
│ Manage workspace members│   ✓   │   ✗    │   ✗    │
│ Delete workspace        │   ✓   │   ✗    │   ✗    │
└─────────────────────────┴───────┴────────┴────────┘
*Credential values are never shown, only names
```

### Role Inheritance

Organization roles affect workspace access:

| Org Role | Workspace Access |
|----------|------------------|
| Owner | Admin in ALL workspaces |
| Admin | Admin in ALL workspaces |
| Member | Only assigned workspaces |

---

## Creating Organizations

### When to Create a New Organization

| Scenario | Recommendation |
|----------|----------------|
| Multiple companies | Separate organizations |
| Different clients | Separate organizations |
| Personal vs business | Separate organizations |
| Different departments | Same org, different workspaces |

### Creating an Organization

1. Click the **organization selector** (top-left)
2. Click **Create New Organization**
3. Fill in details

```
Create Organization
───────────────────

Organization Name:
┌─────────────────────────────────────────────────────┐
│ Acme Corporation                                    │
└─────────────────────────────────────────────────────┘

URL Slug:
┌─────────────────────────────────────────────────────┐
│ acme                                                │
└─────────────────────────────────────────────────────┘
Your URLs will be: privexbot.com/acme/...

Industry (optional):
┌─────────────────────────────────────────────────────┐
│ Technology                                          │
└─────────────────────────────────────────────────────┘

[  Cancel  ] [  Create Organization  ]
```

### Default Workspace

When you create an organization:
- A "Default Workspace" is automatically created
- You become the Owner
- You can rename or delete the default workspace

---

## Managing Multiple Organizations

### Switching Organizations

```
Organization Selector (Top-Left)
────────────────────────────────

Current: Acme Corporation ▼
         ├─────────────────────┤
         │ Acme Corporation ✓  │
         │ Personal Projects   │
         │ Client: BigCo       │
         │ ─────────────────── │
         │ + Create New        │
         └─────────────────────┘
```

### Organization Context

When you select an organization:
- All workspaces shown belong to that org
- Billing reflects that org's subscription
- Members list shows org members only

### Personal vs Business

Recommended setup:
```
Personal Projects (Org)
├── Experiments (Workspace)
└── Side Projects (Workspace)

Acme Corporation (Org) - Work
├── Customer Support (Workspace)
├── Sales (Workspace)
└── Engineering (Workspace)
```

---

## Creating Workspaces

### When to Create Workspaces

| Scenario | Example |
|----------|---------|
| Different teams | Support, Sales, Engineering |
| Different projects | Project A, Project B |
| Different environments | Development, Production |
| Different clients | Client X, Client Y |

### Creating a Workspace

1. Go to **Organization Settings** → **Workspaces**
2. Click **Create Workspace**
3. Fill in details

```
Create Workspace
────────────────

Workspace Name:
┌─────────────────────────────────────────────────────┐
│ Customer Support                                    │
└─────────────────────────────────────────────────────┘

URL Slug:
┌─────────────────────────────────────────────────────┐
│ support                                             │
└─────────────────────────────────────────────────────┘
URLs: privexbot.com/acme/support/...

Description (optional):
┌─────────────────────────────────────────────────────┐
│ Customer support team chatbots and resources        │
└─────────────────────────────────────────────────────┘

[  Cancel  ] [  Create Workspace  ]
```

### Workspace Settings

After creation, configure:
- Name and description
- Default chatbot settings
- Member access
- Notification preferences

---

## Team Setup Best Practices

### Small Teams (1-5 people)

```
Organization: Your Company
└── Default Workspace (everyone has access)
    ├── Chatbots
    ├── Knowledge Bases
    └── Credentials

Roles:
├── 1 Owner (you)
└── 2-4 Editors (team members)
```

**Recommendation**: Single workspace, simple access.

### Medium Teams (5-20 people)

```
Organization: Your Company
├── Sales (Workspace)
│   ├── Sales team (Editors)
│   └── Sales manager (Admin)
│
├── Support (Workspace)
│   ├── Support team (Editors)
│   └── Support manager (Admin)
│
└── Marketing (Workspace)
    ├── Marketing team (Editors)
    └── Marketing manager (Admin)

Organization Level:
├── CEO (Owner)
├── CTO (Admin)
└── Department heads (Admins)
```

**Recommendation**: Workspace per department, role-based access.

### Large Teams (20+ people)

```
Organization: Enterprise Corp
├── North America
│   ├── NA Sales
│   ├── NA Support
│   └── NA Marketing
│
├── Europe
│   ├── EU Sales
│   ├── EU Support
│   └── EU Marketing
│
└── Asia Pacific
    ├── APAC Sales
    ├── APAC Support
    └── APAC Marketing

Roles:
├── Global admins (Org Admins)
├── Regional managers (Workspace Admins)
├── Team leads (Workspace Editors)
└── Staff (Workspace Viewers or Editors)
```

**Recommendation**: Consider multiple organizations for fully separate regions, or nested workspaces for unified billing.

---

## Permission Best Practices

### Principle of Least Privilege

Give users the minimum access needed:

| Task | Recommended Role |
|------|------------------|
| View analytics only | Viewer |
| Create and edit chatbots | Editor |
| Manage team and credentials | Admin |
| Handle billing | Owner/Admin (org level) |

### Role Assignment Guidelines

```
Do's:
✓ Start with Viewer, upgrade as needed
✓ Use workspace roles for granular control
✓ Review permissions quarterly
✓ Remove access when people leave

Don'ts:
✗ Give everyone Admin
✗ Share Owner credentials
✗ Keep stale members
✗ Forget about contractors after project
```

### Sensitive Resources

Credentials require extra care:

| Credential Type | Who Should Access |
|-----------------|-------------------|
| API keys | Workspace Admins only |
| Database credentials | Workspace Admins only |
| Platform tokens | Workspace Admins only |

### Audit Checklist

Quarterly review:
- [ ] Remove inactive members
- [ ] Verify role assignments are appropriate
- [ ] Check for over-privileged users
- [ ] Review workspace membership
- [ ] Verify credential access

---

## Data Isolation Guarantees

### Complete Separation

PrivexBot guarantees data isolation:

```
Organization A                Organization B
┌─────────────────┐          ┌─────────────────┐
│ Workspace A1    │          │ Workspace B1    │
│ ├── Chatbots    │          │ ├── Chatbots    │
│ ├── KBs         │   🔒🔒   │ ├── KBs         │
│ └── Leads       │ ISOLATED │ └── Leads       │
├─────────────────┤          ├─────────────────┤
│ Workspace A2    │          │ Workspace B2    │
│ └── ...         │          │ └── ...         │
└─────────────────┘          └─────────────────┘
```

### What's Isolated

| Data Type | Isolation Level |
|-----------|-----------------|
| Chatbots | Per workspace |
| Knowledge bases | Per workspace |
| Leads | Per workspace |
| Credentials | Per workspace |
| Analytics | Per workspace/org |
| Members | Per workspace |
| Billing | Per organization |

### Cross-Workspace Access

Within the same organization:
- Org Admins can access all workspaces
- Members see only assigned workspaces
- Resources cannot be shared between workspaces

### Database Guarantees

Every database query includes:
- Organization ID filter
- Workspace ID filter (for workspace-scoped data)
- User permission verification

---

## Troubleshooting

### "Access Denied" Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Can't see workspace | Not a member | Request access from Admin |
| Can't edit chatbot | Viewer role | Request Editor role |
| Can't see credentials | Not Admin | Contact workspace Admin |
| Can't create workspace | Not Org Admin | Contact Org Admin |

### Wrong Organization

| Symptom | Solution |
|---------|----------|
| Missing workspaces | Check org selector |
| Wrong members shown | Switch organizations |
| Billing mismatch | Verify correct org |

### Missing Features

| Feature | Requires |
|---------|----------|
| Billing management | Owner role |
| Create workspaces | Org Admin role |
| Manage credentials | Workspace Admin role |
| Invite members | Org Admin role |

### Permission Conflicts

If a user has conflicting permissions:
- Org-level role takes precedence for org operations
- Most permissive workspace role applies for resource access

### Removing Access

To completely remove someone:

1. **From workspace**: Settings → Members → Remove
2. **From organization**: Org Settings → Members → Remove

Removing from org removes from all workspaces.

---

## Quick Reference

### Hierarchy Summary

```
Organization
├── Owns: Billing, org members, workspaces
├── Roles: Owner, Admin, Member
│
└── Workspace
    ├── Owns: Chatbots, KBs, credentials, leads
    ├── Roles: Admin, Editor, Viewer
    └── Inherited access from Org Admins
```

### Role Quick Reference

| Want To... | Need Role |
|------------|-----------|
| View chatbots | Viewer+ |
| Edit chatbots | Editor+ |
| Manage credentials | Workspace Admin |
| Create workspaces | Org Admin |
| Handle billing | Org Owner |

---

## Next Steps

- **[Account Settings](46-how-to-manage-account.md)**: Your personal settings
- **[Billing](48-billing-and-subscription.md)**: Manage subscription
- **[Troubleshooting](50-troubleshooting-guide.md)**: Get help

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
