# How to Create and Manage Organizations in PrivexBot

## Introduction

Organizations are the foundation of everything you do in PrivexBot. Before you can create chatbots, build knowledge bases, or deploy AI assistants, you need an organization to house them all.

This comprehensive guide walks you through everything about organizations—creating them, managing settings, inviting members, changing roles, and more.

---

## Part 1: Understanding Organizations

### What Is an Organization?

An organization in PrivexBot represents a company, team, or project. Think of it as a container that holds all your AI resources together.

```
Organization Structure:

┌─────────────────────────────────────────────────┐
│                 ORGANIZATION                     │
│            (Your Company/Project)                │
│                                                  │
│  ┌─────────────────┐  ┌─────────────────┐       │
│  │   WORKSPACE 1   │  │   WORKSPACE 2   │       │
│  │  (Marketing)    │  │   (Support)     │       │
│  │                 │  │                 │       │
│  │  • Chatbots     │  │  • Chatbots     │       │
│  │  • Knowledge    │  │  • Knowledge    │       │
│  │    Bases        │  │    Bases        │       │
│  │  • Chatflows    │  │  • Chatflows    │       │
│  │  • Credentials  │  │  • Credentials  │       │
│  └─────────────────┘  └─────────────────┘       │
│                                                  │
│  Organization Settings:                          │
│  • Billing & Subscription                        │
│  • Team Members                                  │
│  • API Keys                                      │
└─────────────────────────────────────────────────┘
```

### The Hierarchy Explained

```
ORGANIZATION (Top Level)
    │
    ├── Contains multiple WORKSPACES
    │       │
    │       ├── Workspace contains CHATBOTS
    │       ├── Workspace contains KNOWLEDGE BASES
    │       ├── Workspace contains CHATFLOWS
    │       └── Workspace contains CREDENTIALS
    │
    ├── Has MEMBERS with roles
    │       ├── Owner (full control)
    │       ├── Admin (manage resources)
    │       └── Member (use resources)
    │
    └── Has SUBSCRIPTION & BILLING
            ├── Free tier (30-day trial)
            ├── Pro tier
            └── Enterprise tier
```

### Why Organizations Matter

| Purpose | Benefit |
|---------|---------|
| **Team Separation** | Different departments get their own workspaces |
| **Billing Management** | Centralized subscription and invoicing |
| **Access Control** | Control who can access what |
| **Resource Organization** | Keep projects cleanly separated |
| **Multi-Client** | Agencies can manage multiple client projects |

### What Gets Created Automatically

When you sign up for PrivexBot, the system automatically creates:

```
Automatic Setup on Signup:

1. ORGANIZATION: "Personal"
   └── Your default organization
   └── You are the OWNER

2. WORKSPACE: "Default"
   └── Inside your Personal organization
   └── You are the ADMIN
   └── Ready for chatbots and KBs

3. SUBSCRIPTION: Free Tier
   └── 30-day trial period
   └── Full feature access during trial
```

You don't need to do anything—you're ready to start building immediately after signup.

---

## Part 2: The Signup Flow (Automatic Organization)

### Step 1: Access the Signup Page

Navigate to PrivexBot and click "Sign Up" or "Get Started."

```
┌─────────────────────────────────────────────────┐
│                  PRIVEXBOT                       │
│         Privacy-First AI Chatbots               │
│                                                  │
│     [  Login  ]    [  Sign Up  ]                │
│                        ↑                         │
│                   Click here                     │
└─────────────────────────────────────────────────┘
```

### Step 2: Fill Out the Signup Form

The signup form collects your basic information:

```
┌─────────────────────────────────────────────────┐
│              CREATE YOUR ACCOUNT                 │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Username                                   │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ johndoe                               │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Email                                      │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ john@example.com                      │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Password                                   │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ ••••••••••••                          │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Confirm Password                           │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ ••••••••••••                          │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  [✓] I agree to the Terms of Service            │
│                                                  │
│  [        Create Account        ]               │
│                                                  │
│  Already have an account? Log in                │
└─────────────────────────────────────────────────┘
```

**Form Fields:**

| Field | Requirements |
|-------|-------------|
| Username | Unique identifier for your account |
| Email | Valid email address (used for verification) |
| Password | Secure password |
| Confirm Password | Must match password |
| Terms | Must accept to continue |

### Step 3: Click "Create Account"

When you click the button, several things happen automatically:

```
What Happens When You Click "Create Account":

Frontend (What You See):
├── Loading spinner appears
├── Form is validated
└── You're redirected to dashboard

Backend (Behind the Scenes):
├── 1. User account created
│      └── Email, password hash, username stored
│
├── 2. Organization created automatically
│      ├── Name: "Personal"
│      ├── Billing Email: Your signup email
│      ├── Subscription: Free tier
│      └── Trial: 30 days started
│
├── 3. You're added as Organization Owner
│      └── Full control over organization
│
├── 4. Default Workspace created
│      ├── Name: "Default"
│      ├── Inside your Personal organization
│      └── Ready to use
│
├── 5. You're added as Workspace Admin
│      └── Full control over workspace resources
│
└── 6. JWT token generated
       ├── Contains your user ID
       ├── Contains organization ID
       ├── Contains workspace ID
       └── Logged into session
```

### Step 4: Arrive at Dashboard

After signup, you land on your dashboard with everything ready:

```
┌─────────────────────────────────────────────────┐
│  PrivexBot    Personal ▼    Default ▼     👤    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────┐                                    │
│  │Dashboard│  Welcome to PrivexBot!             │
│  ├─────────┤                                    │
│  │Chatbots │  Your organization is ready.       │
│  ├─────────┤                                    │
│  │Knowledge│  Get started by:                   │
│  │Bases    │  • Creating a knowledge base       │
│  ├─────────┤  • Building your first chatbot     │
│  │Chatflows│  • Exploring the workflow builder  │
│  ├─────────┤                                    │
│  │Settings │                                    │
│  └─────────┘                                    │
│                                                  │
│  Quick Stats:                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Chatbots │ │   KBs   │ │Chatflows│           │
│  │    0    │ │    0    │ │    0    │           │
│  └─────────┘ └─────────┘ └─────────┘           │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Notice the header:**
- **Personal** - Your organization name
- **Default** - Your workspace name

You're now ready to create chatbots and knowledge bases.

---

## Part 3: Creating Additional Organizations

If you need more than one organization (for different companies, clients, or projects), here's how to create them.

### Step 1: Navigate to Organizations Page

From anywhere in the dashboard, click on your organization name in the header, then select "Organizations" from the dropdown. Or navigate directly via the sidebar.

```
Method 1: Header Dropdown

┌─────────────────────────────────────────────────┐
│  PrivexBot    Personal ▼    Default ▼     👤    │
│                   │                              │
│                   ▼                              │
│            ┌──────────────┐                     │
│            │ ✓ Personal   │                     │
│            ├──────────────┤                     │
│            │ Organizations│ ← Click here        │
│            └──────────────┘                     │
└─────────────────────────────────────────────────┘

Method 2: Sidebar Navigation

┌─────────────────────────────────────────────────┐
│  ┌─────────────┐                                │
│  │ Dashboard   │                                │
│  ├─────────────┤                                │
│  │ Chatbots    │                                │
│  ├─────────────┤                                │
│  │ Knowledge   │                                │
│  │ Bases       │                                │
│  ├─────────────┤                                │
│  │ Chatflows   │                                │
│  ├─────────────┤                                │
│  │Organizations│ ← Click here                   │
│  ├─────────────┤                                │
│  │ Settings    │                                │
│  └─────────────┘                                │
└─────────────────────────────────────────────────┘
```

### Step 2: View Organizations Page

The Organizations page shows all organizations you belong to:

```
┌─────────────────────────────────────────────────┐
│                ORGANIZATIONS                     │
│                                                  │
│                    [ + New Organization ]        │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  🏢 Personal                    Active    │  │
│  │                                 Owner     │  │
│  │                                           │  │
│  │  👥 1 Member    📁 1 Workspace            │  │
│  │                                           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐     │  │
│  │  │Switch To│ │ Manage  │ │  Edit   │     │  │
│  │  └─────────┘ └─────────┘ └─────────┘     │  │
│  │                           ┌─────────┐     │  │
│  │                           │ Delete  │     │  │
│  │                           └─────────┘     │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  No other organizations yet.                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Organization Card Shows:**
- Organization name with icon
- Your role badge (Owner/Admin/Member)
- "Active" badge if currently selected
- Member count
- Workspace count
- Action buttons: Switch To, Manage, Edit, Delete

### Step 3: Click "New Organization"

Click the "+ New Organization" button in the top right corner.

### Step 4: Fill Organization Details

A modal appears with the organization creation form:

```
┌─────────────────────────────────────────────────┐
│              CREATE ORGANIZATION          [X]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Organization Name *                        │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ e.g., Acme Corp                       │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  │ This is the name that will appear in      │  │
│  │ your organization switcher                │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Billing Email *                            │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ billing@example.com                   │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  │ Email address for billing and             │  │
│  │ subscription notifications                │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│                                                  │
│    [ Cancel ]        [ Create Organization ]    │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Required Fields:**

| Field | Requirements | Purpose |
|-------|-------------|---------|
| Organization Name | 2-255 characters | Identifies your organization |
| Billing Email | Valid email format | Receives invoices and billing info |

**What Gets Auto-Configured:**
- Subscription: Free tier with 30-day trial
- Your Role: Owner (automatic)
- Default Workspace: Created automatically
- Your Workspace Role: Admin (automatic)

### Step 5: Submit and Confirmation

Click "Create Organization" to submit:

```
What Happens When You Submit:

1. VALIDATION
   ├── Name: 2-255 characters, required
   └── Email: Valid format, required

2. API CALL
   └── POST /api/v1/orgs/
       Body: { name, billing_email }

3. BACKEND CREATES:
   ├── Organization record
   ├── You as Owner
   ├── Default workspace
   ├── You as workspace Admin
   └── 30-day trial starts

4. FRONTEND UPDATES:
   ├── Success toast notification
   ├── Modal closes
   ├── Organization list refreshes
   ├── Auto-switch to new organization
   └── Navigate to dashboard
```

---

## Part 4: Managing Your Organization

### Opening Organization Management

From the Organizations page, click "Manage" on any organization card:

```
┌───────────────────────────────────────────┐
│  🏢 Acme Corporation             Active   │
│                                  Owner    │
│                                           │
│  👥 3 Members    📁 2 Workspaces          │
│                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │Switch To│ │ Manage  │ │  Edit   │     │
│  └─────────┘ └────┬────┘ └─────────┘     │
│                   ↓                       │
│              Click here                   │
└───────────────────────────────────────────┘
```

### The Manage Organization Modal

The management modal has two main tabs: **Workspaces** and **Members**.

```
┌─────────────────────────────────────────────────┐
│        MANAGE: ACME CORPORATION           [X]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────┬────────────────┐            │
│  │   Workspaces   │    Members     │            │
│  └───────┬────────┴────────────────┘            │
│          ↓                                       │
│      Active tab                                 │
│                                                  │
│  Tab content appears here...                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Workspaces Tab

View and manage all workspaces in the organization:

```
┌─────────────────────────────────────────────────┐
│        MANAGE: ACME CORPORATION           [X]   │
├─────────────────────────────────────────────────┤
│  ┌────────────────┬────────────────┐            │
│  │   Workspaces   │    Members     │            │
│  └────────────────┴────────────────┘            │
│                                                  │
│           [ + Create Workspace ]                │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 📁 Default                                │  │
│  │    Active  •  Default Workspace           │  │
│  │    👥 2 members                           │  │
│  │                                           │  │
│  │    [Switch To]  [Edit]  [Delete]          │  │
│  │    (disabled)                             │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 📁 Marketing                              │  │
│  │    👥 1 member                            │  │
│  │                                           │  │
│  │    [Switch To]  [Edit]  [Delete]          │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Workspace Actions:**

| Action | Description | Availability |
|--------|-------------|--------------|
| Switch To | Switch to this workspace | Hidden if already active |
| Edit | Edit workspace name/description | Org Admin/Owner or Workspace Admin |
| Delete | Delete workspace | Org Admin/Owner (not default workspace) |

### Members Tab

View and manage organization members:

```
┌─────────────────────────────────────────────────┐
│        MANAGE: ACME CORPORATION           [X]   │
├─────────────────────────────────────────────────┤
│  ┌────────────────┬────────────────┐            │
│  │   Workspaces   │    Members     │            │
│  └────────────────┴───────┬────────┘            │
│                           ↓                      │
│                                                  │
│           [ + Send Invitation ]                 │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 🕐 Pending Invitations (2)                │  │
│  │                                           │  │
│  │ ✉️ sarah@example.com    Admin   Jan 17    │  │
│  │                    [Resend] [Cancel]      │  │
│  │                                           │  │
│  │ ✉️ mike@example.com     Member  Jan 15    │  │
│  │                    [Resend] [Cancel]      │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Members (3)                                │  │
│  │                                           │  │
│  │ 👑 John Smith (You)                       │  │
│  │    john@example.com           Owner       │  │
│  │                                           │  │
│  │ 🛡️ Jane Doe                               │  │
│  │    jane@example.com   [Admin ▼]      🗑️  │  │
│  │                                           │  │
│  │ 👤 Bob Wilson                             │  │
│  │    bob@example.com    [Member ▼]     🗑️  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Part 5: Managing Organization Members

### Role Icons

Organization members are displayed with role-specific icons:

```
Role Icons:

👑 Owner  - Crown icon (purple)
           Full control over organization

🛡️ Admin  - Shield icon (blue)
           Can manage resources and members

👤 Member - User icon (gray)
           Can use resources in assigned workspaces
```

### Sending Invitations

To invite someone to your organization:

**Step 1: Click "+ Send Invitation"**

The invitation form expands:

```
┌───────────────────────────────────────────────┐
│  Send Invitation                              │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Email Address *                          │ │
│  │ ┌─────────────────────────────────────┐ │ │
│  │ │ user@example.com                    │ │ │
│  │ └─────────────────────────────────────┘ │ │
│  │ An invitation email will be sent to     │ │
│  │ this address                            │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Role *                                   │ │
│  │ ┌─────────────────────────────────────┐ │ │
│  │ │ Member                           ▼  │ │ │
│  │ └─────────────────────────────────────┘ │ │
│  │                                         │ │
│  │ Role options:                           │ │
│  │ • Admin  - Can manage org & all access  │ │
│  │ • Member - Basic access (default)       │ │
│  │                                         │ │
│  │ Note: Organizations can only have       │ │
│  │ one owner                               │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│    [ Cancel ]        [ Send Invitation ]     │
└───────────────────────────────────────────────┘
```

**Step 2: Enter Email and Select Role**

| Field | Required | Details |
|-------|----------|---------|
| Email | Yes | Must be valid email format |
| Role | Yes | Admin or Member (cannot invite as Owner) |

**Why No Owner Option?**
Organizations can only have ONE owner. To transfer ownership, the current owner must do it manually through settings.

**Step 3: Click "Send Invitation"**

What happens:
```
Invitation Process:

1. Frontend validates form
2. API call: POST /api/v1/orgs/{orgId}/invitations
3. Backend generates secure token (32 bytes)
4. Invitation stored with 7-day expiration
5. Email sent to invitee with invitation link
6. Toast: "Invitation sent to [email]"
7. Invitation appears in "Pending Invitations" section
```

### Managing Pending Invitations

Pending invitations appear at the top of the members section:

```
Pending Invitations:

┌───────────────────────────────────────────────┐
│ 🕐 Pending Invitations (2)                    │
│                                               │
│ ┌───────────────────────────────────────────┐│
│ │ ✉️ sarah@example.com                       ││
│ │    Role: Admin (yellow badge)              ││
│ │    Expires: January 17, 2026               ││
│ │                                            ││
│ │    [🔄 Resend]  [✗ Cancel]                 ││
│ └───────────────────────────────────────────┘│
└───────────────────────────────────────────────┘
```

**Actions:**

| Action | What It Does |
|--------|--------------|
| **Resend** | Generates new token, extends expiration by 7 days, sends new email |
| **Cancel** | Marks invitation as cancelled, link no longer works |

### Viewing Current Members

The members list shows all confirmed organization members:

```
Members List:

┌───────────────────────────────────────────────┐
│ Members (3)                                   │
│                                               │
│ ┌───────────────────────────────────────────┐│
│ │ 👑 John Smith (You)                        ││
│ │    john@example.com                        ││
│ │                              Owner         ││
│ │                              (badge)       ││
│ └───────────────────────────────────────────┘│
│                                               │
│ ┌───────────────────────────────────────────┐│
│ │ 🛡️ Jane Doe                                ││
│ │    jane@example.com                        ││
│ │                              [Admin ▼] 🗑️ ││
│ │                              (dropdown)    ││
│ └───────────────────────────────────────────┘│
│                                               │
│ ┌───────────────────────────────────────────┐│
│ │ 👤 Bob Wilson                              ││
│ │    bob@example.com                         ││
│ │                             [Member ▼] 🗑️ ││
│ │                             (dropdown)     ││
│ └───────────────────────────────────────────┘│
└───────────────────────────────────────────────┘
```

**Display Elements:**
- Role icon (Crown/Shield/User)
- Username with "(You)" indicator if current user
- Email address
- Role dropdown (if editable) or badge (if not)
- Delete button (trash icon)

### Changing Member Roles

To change an existing member's role:

```
Changing Roles:

┌───────────────────────────────────────────────┐
│ 🛡️ Jane Doe                                   │
│    jane@example.com                           │
│                                               │
│    ┌─────────────┐                           │
│    │ Admin     ▼ │  ← Click dropdown         │
│    ├─────────────┤                           │
│    │ Admin    ✓  │  ← Current role           │
│    │ Member      │                           │
│    └─────────────┘                           │
└───────────────────────────────────────────────┘

Select new role → Instant update via API
```

**Rules:**
- Only Owners and Admins can change roles
- You cannot change your own role
- **Owner role cannot be changed** - displayed as badge only
- Changes are immediate (no save button needed)
- Toast confirms the change

### Removing Members

To remove a member from the organization:

```
Removing a Member:

┌───────────────────────────────────────────────┐
│ 👤 Bob Wilson                                 │
│    bob@example.com       [Member ▼]    🗑️    │
│                                        ↑      │
│                                  Click trash  │
└───────────────────────────────────────────────┘

After clicking trash:

┌───────────────────────────────────────────────┐
│ ⚠️ Remove member?                             │
│                                               │
│ Are you sure you want to remove Bob Wilson    │
│ from this organization?                       │
│                                               │
│ [No, Keep]              [Yes, Remove]         │
│                                               │
│ This toast will close in 10 seconds           │
└───────────────────────────────────────────────┘
```

**Rules:**
- Only Owners and Admins can remove members
- You cannot remove yourself
- **Owners cannot be removed** - no trash icon shown
- Confirmation required (toast-based, 10 second timeout)
- Removal is immediate after confirmation

---

## Part 6: Invitation Acceptance Flow

When someone receives an organization invitation, here's what they experience:

### Step 1: Receive Email

```
Email Content:

Subject: You've been invited to join Acme Corporation on PrivexBot

Hi,

John Smith has invited you to join "Acme Corporation"
on PrivexBot as an Admin.

Click the button below to accept:

[Accept Invitation]

This invitation expires on January 17, 2026.

If you don't have a PrivexBot account, you'll be
prompted to create one.
```

### Step 2: Click Invitation Link

The link takes them to: `/invitations/accept?token={secure_token}`

### Step 3: View Invitation Details

```
┌─────────────────────────────────────────────────┐
│                                                  │
│           🏢 Organization Invitation             │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  │     You're invited to join:               │  │
│  │                                           │  │
│  │     🏢 Acme Corporation                   │  │
│  │                                           │  │
│  │     Role: Admin (blue badge)              │  │
│  │                                           │  │
│  │     Invited by: John Smith                │  │
│  │     Expires: January 17, 2026             │  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ ℹ️ You need to be logged in to accept     │  │
│  │    this invitation.                       │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│    [ Decline ]        [ Accept Invitation ]     │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Step 4: Accept or Decline

**If Not Logged In:**
- Clicking "Accept Invitation" redirects to login
- Token stored in session during redirect
- After login, returns to accept the invitation

**Accepting:**
```
Accept Flow:

1. Click "Accept Invitation"
2. API: POST /invitations/accept?token={token}
3. Backend creates OrganizationMember record
4. Invitation marked as "accepted"
5. Success screen shown:

┌─────────────────────────────────────────────────┐
│                                                  │
│              ✅ Welcome to the team!             │
│                                                  │
│  You've joined Acme Corporation as an Admin.    │
│                                                  │
│  Redirecting to dashboard in 2 seconds...       │
│                                                  │
└─────────────────────────────────────────────────┘

6. Auto-redirect to dashboard
7. New organization appears in your list
```

**Declining:**
```
Decline Flow:

1. Click "Decline"
2. API: POST /invitations/reject?token={token}
3. Invitation marked as "rejected"
4. Redirect to home page
```

### Invitation States

| State | What Invitee Sees |
|-------|-------------------|
| **Valid** | Invitation details with Accept/Decline buttons |
| **Expired** | Yellow warning: "Invitation has expired" |
| **Already Used** | Error: "Invitation already used" |
| **Cancelled** | Error: "Invitation is no longer valid" |
| **Invalid Token** | Error: "Invalid invitation" |

---

## Part 7: Editing Organization Details

### Accessing Edit

Click "Edit" on an organization card:

```
┌───────────────────────────────────────────┐
│  🏢 Acme Corporation             Active   │
│                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │Switch To│ │ Manage  │ │  Edit   │     │
│  └─────────┘ └─────────┘ └────┬────┘     │
│                               ↓           │
│                          Click here       │
└───────────────────────────────────────────┘
```

### Edit Organization Modal

```
┌─────────────────────────────────────────────────┐
│              EDIT ORGANIZATION            [X]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Organization Name                          │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ Acme Corporation                      │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  │ This is the name that will appear in      │  │
│  │ your organization switcher                │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Billing Email                              │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ billing@acme.com                      │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  │ Email address for billing and             │  │
│  │ subscription notifications                │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│                                                  │
│    [ Cancel ]            [ Save Changes ]       │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Form Fields:**

| Field | Required | Details |
|-------|----------|---------|
| Organization Name | No* | 2-255 characters if provided |
| Billing Email | No* | Valid email format if provided |

*At least one field must be changed to save

**Who Can Edit:**
- Organization Owners
- Organization Admins

---

## Part 8: Deleting an Organization

### Who Can Delete

Only organization **Owners** can delete an organization. The delete button only appears for owners.

### Accessing Delete

Click "Delete" on an organization card (owner only):

```
┌───────────────────────────────────────────┐
│  🏢 Acme Corporation             Active   │
│                                  Owner    │
│                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │Switch To│ │ Manage  │ │  Edit   │     │
│  └─────────┘ └─────────┘ └─────────┘     │
│                           ┌─────────┐     │
│                           │ Delete  │     │
│                           └────┬────┘     │
│                                ↓          │
│                           Click here      │
│                           (red button)    │
└───────────────────────────────────────────┘
```

### Delete Confirmation Dialog

```
┌─────────────────────────────────────────────────┐
│  ⚠️ DELETE ORGANIZATION                   [X]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 🔴 WARNING: This action cannot be undone! │  │
│  │                                           │  │
│  │ Deleting "Acme Corporation" will          │  │
│  │ permanently remove:                       │  │
│  │                                           │  │
│  │ • All 2 workspaces                        │  │
│  │ • All chatbots and chatflows              │  │
│  │ • All knowledge bases                     │  │
│  │ • All members and permissions             │  │
│  │ • All analytics and conversation history  │  │
│  │                                           │  │
│  │ This data CANNOT be recovered.            │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Type "Acme Corporation" to confirm:       │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │                                       │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│    [ Cancel ]        [ Delete Organization ]    │
│                         (disabled until         │
│                          name matches)          │
└─────────────────────────────────────────────────┘
```

### Last Organization Warning

If you're deleting your ONLY organization, a special warning appears:

```
┌───────────────────────────────────────────────┐
│ ℹ️ This is your last organization             │
│                                               │
│ After deletion, a new default organization    │
│ named "Personal" will be automatically        │
│ created for you.                              │
└───────────────────────────────────────────────┘
```

### Delete Process

```
Deletion Steps:

1. VALIDATION
   └── Type organization name exactly (case-sensitive)
   └── Button enabled only when name matches

2. API CALL
   └── DELETE /api/v1/orgs/{organizationId}

3. CASCADE DELETE (Backend)
   └── Delete all OrganizationMembers
   └── Delete all Workspaces
       └── Delete all WorkspaceMembers
       └── Delete all Chatbots
       └── Delete all Chatflows
       └── Delete all KnowledgeBases
       └── Delete all Credentials
   └── Delete Organization record

4. FRONTEND UPDATE
   └── Remove organization from list
   └── If was active: switch to another org
   └── If was last: auto-create "Personal" org
   └── Show success toast

5. CONFIRMATION
   └── "Organization permanently deleted"
```

---

## Part 9: Switching Between Organizations

### Method 1: Header Dropdown

```
┌─────────────────────────────────────────────────┐
│  PrivexBot    Personal ▼    Default ▼     👤    │
│                   │                              │
│                   ▼                              │
│            ┌──────────────────┐                 │
│            │ Personal      ✓  │ ← Current       │
│            ├──────────────────┤                 │
│            │ Acme Corporation │ ← Click to      │
│            ├──────────────────┤    switch       │
│            │ Client Project   │                 │
│            ├──────────────────┤                 │
│            │ Organizations    │                 │
│            └──────────────────┘                 │
└─────────────────────────────────────────────────┘
```

### Method 2: Organizations Page

Click "Switch To" on any organization card.

### What Happens When You Switch

```
Switching Organizations:

1. FIND ORGANIZATION
   └── Locate org in current state
   └── Refresh list if not found

2. LOAD WORKSPACES
   └── Fetch workspaces for new organization
   └── Select default workspace (or first)

3. PERSIST CHOICE
   └── Save to localStorage:
       ├── privexbot_current_org_id
       └── privexbot_current_workspace_id

4. CALCULATE PERMISSIONS
   └── Determine your role in new org
   └── Calculate workspace permissions

5. UPDATE JWT TOKEN
   └── API call: POST /api/v1/switch/organization
   └── Backend returns new access_token
   └── Token saved to localStorage

6. REFRESH CONTEXT
   └── All resources now scoped to new org
   └── Dashboard shows new org's data
   └── Navigate to dashboard
```

---

## Part 10: Organization Roles & Permissions

### The Three Organization Roles

```
ORGANIZATION ROLES:

┌─────────────────────────────────────────────────┐
│  👑 OWNER (Highest)                             │
│                                                  │
│  Full control over the organization:            │
│  • Delete organization                          │
│  • Manage billing and subscription              │
│  • Invite/remove any member                     │
│  • Change any member's role                     │
│  • Create/delete workspaces                     │
│  • Admin access to ALL workspaces               │
│                                                  │
│  Note: Only ONE owner per organization          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  🛡️ ADMIN (Middle)                              │
│                                                  │
│  Can manage resources and most members:         │
│  • Invite/remove members (not owner)            │
│  • Change roles (member ↔ admin)                │
│  • Create/delete workspaces                     │
│  • Admin access to ALL workspaces               │
│  • Cannot delete organization                   │
│  • Cannot manage billing                        │
│  • Cannot change owner's role                   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  👤 MEMBER (Lowest)                             │
│                                                  │
│  Basic access:                                  │
│  • Access only ASSIGNED workspaces              │
│  • Cannot invite or remove members              │
│  • Cannot create workspaces                     │
│  • Cannot manage organization settings          │
│  • Workspace permissions depend on role         │
└─────────────────────────────────────────────────┘
```

### Permission Matrix

| Permission | Owner | Admin | Member |
|------------|:-----:|:-----:|:------:|
| **Organization Level** | | | |
| Delete organization | ✓ | ✗ | ✗ |
| Edit organization details | ✓ | ✓ | ✗ |
| Manage billing | ✓ | ✗ | ✗ |
| Invite members | ✓ | ✓ | ✗ |
| Remove members | ✓ | ✓* | ✗ |
| Change member roles | ✓ | ✓** | ✗ |
| Create workspaces | ✓ | ✓ | ✗ |
| Delete workspaces | ✓ | ✓ | ✗ |
| **Workspace Access** | | | |
| Access all workspaces | ✓ | ✓ | ✗ |
| Access assigned workspaces | ✓ | ✓ | ✓ |
| Workspace role when accessing | Admin | Admin | Varies*** |

*Admins cannot remove the owner
**Admins cannot change to/from owner role
***Members get the role assigned when added to workspace

### Organization vs Workspace Roles

| Aspect | Organization Role | Workspace Role |
|--------|-------------------|----------------|
| **Scope** | Entire organization | Single workspace |
| **Roles** | Owner, Admin, Member | Admin, Editor, Viewer |
| **Inheritance** | Org Admin/Owner → Workspace Admin | None |
| **Purpose** | Organization management | Resource access |

---

## Part 11: Troubleshooting

### No Organization After Signup

**Symptom:** You signed up but don't see any organization.

```
Possible Causes:

1. Signup didn't complete
   └── Solution: Try signing up again

2. Browser cache issue
   └── Solution: Clear cache, refresh page

3. Session expired
   └── Solution: Log out and log back in

4. Database sync delay
   └── Solution: Wait 30 seconds, refresh

If problem persists:
└── Contact support with your email address
```

### Can't Send Invitations

**Symptom:** Invitation button missing or doesn't work.

```
Possible Causes:

1. You're a Member (not Admin/Owner)
   └── Solution: Ask Owner to upgrade your role

2. Form validation error
   └── Solution: Check email format is valid

3. API error
   └── Solution: Check internet, try again
```

### Invitation Not Received

**Symptom:** Invitee says they never got the email.

```
Solutions:

1. Check spam/junk folder

2. Verify email address is correct
   └── Cancel and re-send with correct email

3. Resend invitation
   └── Click "Resend" button

4. Corporate email filters
   └── Some companies block external emails
   └── Try inviting a personal email first
```

### Can't Change Member Role

**Symptom:** Role dropdown is disabled or shows badge.

```
Possible Causes:

1. Trying to change Owner role
   └── Owner role cannot be changed
   └── Use badge display (not dropdown)

2. Trying to change your own role
   └── Cannot change your own role
   └── Ask another Admin/Owner

3. You're a Member
   └── Only Admin/Owner can change roles
```

### Can't Delete Organization

**Symptom:** Delete button missing or disabled.

```
Possible Causes:

1. You're not the Owner
   └── Only Owner can delete
   └── Delete button only shows for Owner

2. Name not typed correctly
   └── Must match EXACTLY (case-sensitive)
   └── Copy/paste the organization name
```

### Permission Errors

**Symptom:** "You don't have permission" error message.

```
Check Your Role:

1. Go to organization management
2. Look at Members tab
3. Find your role (Owner/Admin/Member)

If you're a Member:
├── Ask Owner/Admin for promotion
└── Members have limited capabilities

If you're an Admin:
├── Some actions require Owner role:
│   ├── Deleting organization
│   └── Managing billing
└── Ask Owner for help
```

### Can't See an Organization

**Symptom:** Organization not in your list.

```
Possible Causes:

1. Invitation not accepted
   └── Check email for invitation link
   └── Click to accept and join

2. Removed from organization
   └── Contact organization Owner

3. Organization was deleted
   └── The Owner may have deleted it
   └── No way to recover

4. Different account
   └── Check you're logged into correct account
```

---

## Summary

### Quick Reference

```
CREATING ORGANIZATIONS:

First Organization:
└── Happens automatically during signup
└── "Personal" org + "Default" workspace
└── You're Owner + workspace Admin
└── 30-day free trial

Additional Organizations:
1. Navigate to Organizations page
2. Click "+ New Organization"
3. Enter name and billing email
4. Click "Create Organization"
5. Auto-switch to new org

Auto-Created:
├── Organization with your details
├── You as Owner
├── Default workspace
├── You as workspace Admin
└── 30-day trial period
```

```
MANAGING MEMBERS:

Invite Member:
└── Manage → Members → Send Invitation
└── Enter email and select role (Admin/Member)
└── 7-day expiration

Change Role:
└── Click role dropdown on member
└── Select new role (Admin ↔ Member)
└── Cannot change Owner role

Remove Member:
└── Click trash icon
└── Confirm in toast
└── Cannot remove Owner

Resend/Cancel Invitation:
└── Find in Pending Invitations
└── Click Resend or Cancel
```

### Organization Roles Summary

```
👑 OWNER:  Full control + billing + delete org
           Only ONE per organization
           Admin access to all workspaces

🛡️ ADMIN:  Manage resources + members
           Cannot delete org or manage billing
           Admin access to all workspaces

👤 MEMBER: Basic access
           Only assigned workspaces
           Cannot manage org settings
```

---

## Next Steps

Now that you understand organizations, you can:

1. **Create Additional Organizations**
   - One per client (for agencies)
   - One per project (for developers)

2. **Invite Your Team**
   - Admins for managers
   - Members for regular users

3. **Set Up Workspaces**
   - Organize by department
   - Separate by project

4. **Build Your AI**
   - Create knowledge bases
   - Build chatbots
   - Deploy to channels

Organizations are your foundation—everything else builds on top of them.
