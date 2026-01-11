# How to Manage Workspaces and Members in PrivexBot

## Introduction

Workspaces help you organize your AI chatbots, knowledge bases, and chatflows into logical groups. Whether you're separating projects, departments, or client work, workspaces give you the structure you need to stay organized.

This guide walks you through everything about workspaces and members—from creating your first workspace to inviting team members and managing permissions.

---

## Part 1: Understanding Workspaces

### What Is a Workspace?

A workspace is a container within your organization that holds related AI resources together. Think of it like a folder for a specific project or team.

```
Organization Structure:

┌─────────────────────────────────────────────────┐
│                 ORGANIZATION                     │
│              (Acme Corporation)                  │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │  WORKSPACE   │  │  WORKSPACE   │             │
│  │  (Marketing) │  │  (Support)   │             │
│  │              │  │              │             │
│  │ • Sales Bot  │  │ • Help Desk  │             │
│  │ • FAQ KB     │  │ • Docs KB    │             │
│  │ • Lead Flow  │  │ • Ticket Bot │             │
│  └──────────────┘  └──────────────┘             │
│                                                  │
│  ┌──────────────┐                               │
│  │  WORKSPACE   │                               │
│  │  (Product)   │                               │
│  │              │                               │
│  │ • Feature Bot│                               │
│  │ • API Docs   │                               │
│  └──────────────┘                               │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Why Use Multiple Workspaces?

| Use Case | Benefit |
|----------|---------|
| **Project Separation** | Keep chatbots and KBs for different projects isolated |
| **Team Access Control** | Give different teams access to only their workspace |
| **Client Separation** | Agencies can create workspaces per client |
| **Environment Staging** | Development, staging, and production workspaces |
| **Departmental Organization** | Marketing, Sales, Support each get their own space |

### What Happens at Signup

When you create an account, PrivexBot automatically sets up:

```
Automatic Setup:

1. Organization: "Personal"
   └── Your default organization

2. Workspace: "Default"
   └── Inside your Personal organization
   └── You are the workspace Admin
   └── Ready to create chatbots

You can rename, create additional workspaces,
or delete the default (after creating another).
```

### What Each Workspace Contains

```
Inside a Workspace:

WORKSPACE
├── Chatbots (simple Q&A bots)
├── Knowledge Bases (RAG-powered content)
├── Chatflows (visual workflow automations)
├── Credentials (API keys for integrations)
├── Leads (captured from chatbot interactions)
└── Members (team members with roles)

Each workspace is COMPLETELY SEPARATE.
Resources in one workspace cannot access
resources in another workspace.
```

---

## Part 2: Creating a Workspace

### Step 1: Navigate to Your Dashboard

After logging in, you'll see the dashboard with the sidebar on the left.

```
┌─────────────────────────────────────────────────┐
│  PrivexBot                                  👤   │
├────┬────────────────────────────────────────────┤
│    │                                            │
│ ┌──┤  Dashboard                                 │
│ │WS│                                            │
│ │  │  Welcome to your workspace!                │
│ │──│                                            │
│ │D │  Quick Stats:                              │
│ │  │  ┌────┐ ┌────┐ ┌────┐                     │
│ │──│  │ 0  │ │ 0  │ │ 0  │                     │
│ │  │  │Bots│ │ KB │ │Flow│                     │
│ │  │  └────┘ └────┘ └────┘                     │
│ │──│                                            │
│ │  │                                            │
│ │+ │ ← Add new workspace button                 │
│ └──┘                                            │
└─────────────────────────────────────────────────┘

Left sidebar shows:
├── Workspace avatars (initials)
├── Active workspace highlighted in blue
└── Plus button to add new workspace
```

### Step 2: Click the Add Workspace Button

Look for the plus icon (+) with a dashed border at the bottom of the workspace switcher.

```
Workspace Switcher (Left Sidebar):

┌────┐
│ D  │  ← "Default" workspace (active - blue background)
│    │
├────┤
│    │
│ + │  ← Click here to create new workspace
│    │     (dashed border, green hover)
└────┘

Note: This button only appears if you have
permission to create workspaces (org admin/owner).
```

**Can't See the Add Button?**
You need to be an organization Admin or Owner to create workspaces. If you're a regular Member, ask your organization admin to either:
- Create the workspace for you, or
- Upgrade your role to Admin

### Step 3: Fill Out Workspace Details

A modal appears with the workspace creation form:

```
┌─────────────────────────────────────────────────┐
│              CREATE WORKSPACE                    │
│                                        [X]      │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Workspace Name *                           │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ e.g., Marketing Team                  │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  │ 1-255 characters                          │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Description                                │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ What's this workspace for?            │ │  │
│  │ │                                       │ │  │
│  │ │                                       │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  │ Optional                                   │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│                                                  │
│    [ Cancel ]        [ Create Workspace ]       │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Form Fields:**

| Field | Required | Details |
|-------|----------|---------|
| Workspace Name | Yes | 1-255 characters. Choose something descriptive. |
| Description | No | Helps team members understand the workspace purpose. |

**Good Workspace Names:**
- "Marketing Chatbots"
- "Customer Support"
- "Product Documentation"
- "Client: Acme Corp"
- "Development"

### Step 4: Submit and Confirmation

Click "Create Workspace" to create your new workspace.

```
What Happens When You Submit:

Frontend:
├── Form validates (name required, 1-255 chars)
├── Loading state on button
├── API call sent to backend

Backend:
├── Creates workspace record in database
├── Adds you as workspace Admin
├── Associates with your organization

After Success:
├── Toast notification: "Workspace [name] created successfully"
├── Modal closes automatically
├── Auto-switches to new workspace
├── JWT token updated with new workspace context
├── Dashboard refreshes showing new workspace
```

### Step 5: Your New Workspace Is Ready

```
After Creation:

┌────┐
│ D  │  ← Default workspace
│    │
├────┤
│ M  │  ← Marketing (your new workspace - now active)
│    │     Blue background + white border
└────┘

The workspace switcher now shows both workspaces.
Click any workspace avatar to switch between them.
```

---

## Part 3: Managing Workspace Settings

### Accessing Workspace Settings

Click the settings/gear icon in the main sidebar menu to open workspace management.

```
┌────┬────────────────────────────────────────────┐
│    │  ┌────────────────────────────────────┐   │
│ WS │  │ Dashboard                          │   │
│    │  ├────────────────────────────────────┤   │
│    │  │ Chatbots                           │   │
│    │  ├────────────────────────────────────┤   │
│    │  │ Knowledge Bases                    │   │
│    │  ├────────────────────────────────────┤   │
│    │  │ Chatflows                          │   │
│    │  ├────────────────────────────────────┤   │
│    │  │ ⚙️ Settings                        │   │
│    │  └────────────────────────────────────┘   │
│    │         ↑                                 │
│    │    Click here to manage workspace         │
└────┴────────────────────────────────────────────┘
```

### The Manage Workspace Modal

The management modal has two tabs: **Settings** and **Members**.

```
┌─────────────────────────────────────────────────┐
│        MANAGE: MARKETING WORKSPACE              │
│                                        [X]      │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┬────────────────┐              │
│  │   Settings   │    Members     │              │
│  └──────────────┴────────────────┘              │
│        ↑              ↑                         │
│    Active tab     Click to switch               │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Workspace Name *                           │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ Marketing                             │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Description                                │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │ Marketing team chatbots and KBs       │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ ℹ️ Workspace Info                         │  │
│  │                                           │  │
│  │ Your Role: Admin                          │  │
│  │ Created: January 10, 2026                 │  │
│  │ Type: [Default Workspace]  ← if default   │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│    [ Reset ]             [ Save Changes ]       │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Editing Workspace Details

To update your workspace:

1. Change the workspace name or description
2. Click "Save Changes"
3. Wait for confirmation toast
4. Changes are saved immediately

```
Editing Rules:

WHO CAN EDIT:
├── Workspace Admins ✓
├── Workspace Editors ✓ (name/description only)
├── Workspace Viewers ✗
├── Organization Admins/Owners ✓ (all workspaces)

WHAT CAN BE EDITED:
├── Workspace Name
└── Description

CANNOT BE CHANGED:
├── Workspace ID
├── Organization association
└── Created date
```

### Reset Button

Click "Reset" to revert any unsaved changes back to the current values. Useful if you made changes but changed your mind.

---

## Part 4: Workspace Roles & Permissions

### The Three Workspace Roles

Every workspace member has one of three roles:

```
WORKSPACE ROLES:

┌─────────────────────────────────────────────────┐
│  🛡️ ADMIN (Highest)                             │
│                                                  │
│  Full control over the workspace:               │
│  • Create, edit, delete ALL resources           │
│  • Manage members (invite, remove, change roles)│
│  • Edit workspace settings                      │
│  • Delete the workspace                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  👤 EDITOR (Middle)                             │
│                                                  │
│  Can create and modify resources:               │
│  • Create chatbots, KBs, chatflows              │
│  • Edit existing resources                      │
│  • Cannot delete resources                      │
│  • Cannot manage members                        │
│  • Can edit workspace name/description          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  👁️ VIEWER (Lowest)                             │
│                                                  │
│  Read-only access:                              │
│  • View all resources                           │
│  • Cannot create or edit anything              │
│  • Good for stakeholders/observers              │
│  • Cannot manage members                        │
└─────────────────────────────────────────────────┘
```

### Permission Matrix

| Permission | Admin | Editor | Viewer |
|------------|:-----:|:------:|:------:|
| View workspace & resources | ✓ | ✓ | ✓ |
| Create chatbots | ✓ | ✓ | ✗ |
| Edit chatbots | ✓ | ✓ | ✗ |
| Delete chatbots | ✓ | ✗ | ✗ |
| Create knowledge bases | ✓ | ✓ | ✗ |
| Edit knowledge bases | ✓ | ✓ | ✗ |
| Delete knowledge bases | ✓ | ✗ | ✗ |
| Create chatflows | ✓ | ✓ | ✗ |
| Edit chatflows | ✓ | ✓ | ✗ |
| Delete chatflows | ✓ | ✗ | ✗ |
| Manage credentials | ✓ | ✗ | ✗ |
| Invite members | ✓ | ✗ | ✗ |
| Remove members | ✓ | ✗ | ✗ |
| Change member roles | ✓ | ✗ | ✗ |
| Edit workspace settings | ✓ | ✓ | ✗ |
| Delete workspace | ✓ | ✗ | ✗ |

### Role Icons in the UI

When viewing member lists, roles are shown with icons:

```
Role Display:

🛡️ Admin   - Shield icon
👤 Editor  - User icon
👁️ Viewer  - Eye icon

Example member list:
┌────────────────────────────────────────┐
│ 🛡️ John Smith (You)     Admin         │
│ 👤 Sarah Johnson        Editor         │
│ 👁️ Mike Wilson          Viewer         │
└────────────────────────────────────────┘
```

---

## Part 5: Managing Workspace Members

### Accessing the Members Tab

Open the Manage Workspace modal and click the "Members" tab.

```
┌─────────────────────────────────────────────────┐
│        MANAGE: MARKETING WORKSPACE              │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┬────────────────┐              │
│  │   Settings   │    Members     │              │
│  └──────────────┴───────┬────────┘              │
│                         ↓                        │
│                    Click here                    │
│                                                  │
└─────────────────────────────────────────────────┘

Note: Only workspace Admins can manage members.
Editors and Viewers see a read-only member list.
```

### Members Tab Layout

```
┌─────────────────────────────────────────────────┐
│        MANAGE: MARKETING WORKSPACE              │
├─────────────────────────────────────────────────┤
│  ┌──────────────┬────────────────┐              │
│  │   Settings   │    Members     │ ← Active     │
│  └──────────────┴────────────────┘              │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │         [ + Send Invitation ]             │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 🕐 Pending Invitations (2)                │  │
│  │                                           │  │
│  │ sarah@example.com    Editor   Exp: Jan 17 │  │
│  │                      [Resend] [Cancel]    │  │
│  │                                           │  │
│  │ mike@example.com     Viewer   Exp: Jan 15 │  │
│  │                      [Resend] [Cancel]    │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Members (2)                                │  │
│  │                                           │  │
│  │ 🛡️ John Smith (You)                       │  │
│  │    john@example.com           Admin       │  │
│  │                                           │  │
│  │ 👤 Jane Doe                               │  │
│  │    jane@example.com  [Editor ▼]    🗑️    │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Sending Invitations

To invite someone to your workspace:

**Step 1: Click "+ Send Invitation"**

The invitation form expands:

```
┌───────────────────────────────────────────────┐
│  Send Invitation                              │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Email Address *                          │ │
│  │ ┌─────────────────────────────────────┐ │ │
│  │ │ colleague@example.com               │ │ │
│  │ └─────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Role *                                   │ │
│  │ ┌─────────────────────────────────────┐ │ │
│  │ │ Viewer                           ▼  │ │ │
│  │ └─────────────────────────────────────┘ │ │
│  │                                         │ │
│  │ Role options:                           │ │
│  │ • Admin  - Full workspace control       │ │
│  │ • Editor - Create and edit resources    │ │
│  │ • Viewer - Read-only access (default)   │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│    [ Cancel ]        [ Send Invitation ]     │
└───────────────────────────────────────────────┘
```

**Step 2: Enter Email and Select Role**

| Field | Required | Details |
|-------|----------|---------|
| Email | Yes | Must be valid email format |
| Role | Yes | Admin, Editor, or Viewer (default: Viewer) |

**Step 3: Click "Send Invitation"**

What happens:
```
Invitation Process:

1. Frontend validates form
2. API call: POST /api/v1/orgs/{orgId}/workspaces/{wsId}/invitations
3. Backend generates secure token (32 bytes)
4. Invitation stored with 7-day expiration
5. Email sent to invitee with invitation link
6. Toast: "Invitation sent successfully"
7. Invitation appears in "Pending Invitations" section
```

### Managing Pending Invitations

Pending invitations appear at the top of the members list:

```
Pending Invitations:

┌───────────────────────────────────────────────┐
│ 🕐 Pending Invitations (2)                    │
│                                               │
│ ┌───────────────────────────────────────────┐│
│ │ sarah@example.com                          ││
│ │ Role: Editor (yellow badge)                ││
│ │ Expires: January 17, 2026                  ││
│ │                                            ││
│ │ [🔄 Resend]  [✗ Cancel]                    ││
│ └───────────────────────────────────────────┘│
└───────────────────────────────────────────────┘
```

**Actions:**

| Action | What It Does |
|--------|--------------|
| **Resend** | Generates new token, extends expiration by 7 days, sends new email |
| **Cancel** | Marks invitation as cancelled, link no longer works |

### Changing Member Roles

To change an existing member's role:

```
Changing Roles:

┌───────────────────────────────────────────────┐
│ 👤 Jane Doe                                   │
│    jane@example.com                           │
│                                               │
│    ┌─────────────┐                           │
│    │ Editor    ▼ │  ← Click dropdown         │
│    ├─────────────┤                           │
│    │ Admin       │                           │
│    │ Editor   ✓  │  ← Current role           │
│    │ Viewer      │                           │
│    └─────────────┘                           │
└───────────────────────────────────────────────┘

Select new role → Instant update via API
```

**Rules:**
- Only Admins can change roles
- You cannot change your own role
- Changes are immediate (no save button needed)
- Toast confirms the change

### Removing Members

To remove a member from the workspace:

```
Removing a Member:

┌───────────────────────────────────────────────┐
│ 👤 Jane Doe                                   │
│    jane@example.com  [Editor ▼]    🗑️        │
│                                    ↑          │
│                              Click trash      │
└───────────────────────────────────────────────┘

After clicking trash:

┌───────────────────────────────────────────────┐
│ ⚠️ Remove member?                             │
│                                               │
│ Are you sure you want to remove Jane Doe      │
│ from this workspace?                          │
│                                               │
│ [No, Keep]              [Yes, Remove]         │
│                                               │
│ This toast will close in 10 seconds           │
└───────────────────────────────────────────────┘
```

**Rules:**
- Only Admins can remove members
- You cannot remove yourself
- Confirmation required (toast-based, 10 second timeout)
- Removal is immediate after confirmation

---

## Part 6: Invitation Acceptance Flow

When someone receives a workspace invitation, here's what they experience:

### Step 1: Receive Email

```
Email Content:

Subject: You've been invited to join Marketing on PrivexBot

Hi,

John Smith has invited you to join the "Marketing"
workspace on PrivexBot as an Editor.

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
│              🏢 Workspace Invitation             │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  │     You're invited to join:               │  │
│  │                                           │  │
│  │     📁 Marketing                          │  │
│  │                                           │  │
│  │     Role: Editor (blue badge)             │  │
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
- After login, returns to accept the invitation
- Token stored in session during redirect

**Accepting:**
```
Accept Flow:

1. Click "Accept Invitation"
2. API: POST /invitations/accept?token={token}
3. Backend creates WorkspaceMember record
4. Invitation marked as "accepted"
5. Success screen shown:

┌─────────────────────────────────────────────────┐
│                                                  │
│              ✅ Welcome to the team!             │
│                                                  │
│  You've joined Marketing as an Editor.          │
│                                                  │
│  Redirecting to dashboard in 2 seconds...       │
│                                                  │
└─────────────────────────────────────────────────┘

6. Auto-redirect to dashboard
```

**Declining:**
```
Decline Flow:

1. Click "Decline"
2. API: POST /invitations/reject?token={token}
3. Invitation marked as "rejected"
4. Message shown:

┌─────────────────────────────────────────────────┐
│                                                  │
│              ❌ Invitation Declined              │
│                                                  │
│  You've declined the invitation.                │
│                                                  │
│  Redirecting to home in 2 seconds...            │
│                                                  │
└─────────────────────────────────────────────────┘
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

## Part 7: Switching Between Workspaces

### Method 1: Workspace Switcher (Left Sidebar)

The workspace switcher is a Discord-style vertical list on the left side of your dashboard.

```
Workspace Switcher:

┌────┐
│    │
│ D  │  ← "Default" workspace
│    │     Gray background
├────┤
│    │
│ M  │  ← "Marketing" workspace (ACTIVE)
│    │     Blue background
│    │     White border
│    │     Blue bar on right edge
├────┤
│    │
│ S  │  ← "Support" workspace
│    │     Gray background
├────┤
│    │
│ + │  ← Add new workspace
│    │
└────┘

Click any workspace avatar to switch.
```

**Visual Indicators:**
- **Active Workspace**: Blue background, white border, blue right edge bar
- **Inactive Workspace**: Gray background, hover shows blue tint
- **Initials**: First letter of each word in workspace name

### Method 2: Header Dropdown

Click the workspace name in the header area to see a dropdown list:

```
┌─────────────────────────────────────────────────┐
│  PrivexBot    Marketing ▼                  👤   │
│                   │                              │
│                   ▼                              │
│            ┌────────────────┐                   │
│            │ Default        │                   │
│            ├────────────────┤                   │
│            │ Marketing   ✓  │ ← Current         │
│            ├────────────────┤                   │
│            │ Support        │                   │
│            └────────────────┘                   │
└─────────────────────────────────────────────────┘
```

### What Happens When You Switch

```
Workspace Switch Process:

1. FIND WORKSPACE
   └── Look up workspace in current state
   └── Refresh list if not found

2. PERSIST CHOICE
   └── Save to localStorage: privexbot_current_workspace_id
   └── Survives browser refresh

3. CALCULATE PERMISSIONS
   └── Determine your role in new workspace
   └── Update permission state

4. UPDATE JWT TOKEN
   └── API call: POST /api/v1/switch/workspace
   └── Backend returns new access_token
   └── Token saved to localStorage

5. REFRESH CONTEXT
   └── All resources now scoped to new workspace
   └── Dashboard shows new workspace's data
   └── Chatbots, KBs, etc. all filtered

After switching, everything you see belongs
to the selected workspace only.
```

### Why JWT Updates Matter

The JWT token contains your current organization and workspace context. When you switch workspaces:

```
JWT Token Contents:

BEFORE SWITCH:
{
  "user_id": "abc-123",
  "org_id": "org-456",
  "workspace_id": "ws-789",   ← Old workspace
  "permissions": ["read", "write"]
}

AFTER SWITCH:
{
  "user_id": "abc-123",
  "org_id": "org-456",
  "workspace_id": "ws-999",   ← New workspace
  "permissions": ["read"]      ← May differ
}

The backend uses this to filter all API responses
to only return data from your current workspace.
```

---

## Part 8: Deleting a Workspace

### When to Delete

- Project completed and no longer needed
- Cleaning up test workspaces
- Consolidating resources into fewer workspaces

### Accessing the Delete Dialog

From workspace settings, look for the delete option:

```
Delete Workspace Access:

Option 1: From ManageWorkspaceModal Settings tab
Option 2: From dedicated workspace settings page
Option 3: From workspace context menu (if available)
```

### The Delete Confirmation Dialog

```
┌─────────────────────────────────────────────────┐
│  ⚠️ DELETE WORKSPACE                            │
│                                        [X]      │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 🔴 WARNING: This action cannot be undone! │  │
│  │                                           │  │
│  │ Deleting "Marketing" will permanently     │  │
│  │ remove:                                   │  │
│  │                                           │  │
│  │ • All chatbots and chatflows              │  │
│  │ • All knowledge bases and documents       │  │
│  │ • All members and their permissions       │  │
│  │ • All analytics and conversation history  │  │
│  │                                           │  │
│  │ This data CANNOT be recovered.            │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Type "Marketing" to confirm:              │  │
│  │ ┌───────────────────────────────────────┐ │  │
│  │ │                                       │ │  │
│  │ └───────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│    [ Cancel ]        [ Delete Workspace ]       │
│                         (disabled until         │
│                          name matches)          │
└─────────────────────────────────────────────────┘
```

### Default Workspace Protection

You cannot delete the default workspace:

```
┌───────────────────────────────────────────────┐
│ ⚠️ Cannot Delete Default Workspace            │
│                                               │
│ This is the default workspace for your        │
│ organization. You must create another         │
│ workspace and make it the default before      │
│ you can delete this one.                      │
│                                               │
│ The delete button is disabled.                │
└───────────────────────────────────────────────┘
```

### Delete Process

```
Deletion Steps:

1. VALIDATION
   └── Check workspace name matches exactly
   └── Verify not default workspace
   └── Confirm user has Admin role

2. API CALL
   └── DELETE /api/v1/orgs/{orgId}/workspaces/{workspaceId}

3. CASCADE DELETE (Backend)
   └── Delete all WorkspaceMembers
   └── Delete all Chatbots
   └── Delete all ChatFlows
   └── Delete all KnowledgeBases
   └── Delete all Credentials
   └── Delete all Leads
   └── Delete Workspace record

4. FRONTEND UPDATE
   └── Remove workspace from state
   └── Switch to another workspace
   └── Show success toast

5. CONFIRMATION
   └── "Workspace permanently deleted"
```

---

## Part 9: Organization-Level Member Management

Workspace members are different from organization members. Here's how they relate:

### Organization vs Workspace Membership

```
Membership Hierarchy:

ORGANIZATION MEMBERS
├── Can be Owner, Admin, or Member
├── Organization-wide access
├── Org Admins/Owners → Admin access to ALL workspaces
│
└── WORKSPACE MEMBERS
    ├── Can be Admin, Editor, or Viewer
    ├── Workspace-specific access
    └── Must be org member FIRST

To access a workspace, you must:
1. Be a member of the organization (Owner/Admin/Member)
2. Either:
   a. Be an org Admin/Owner (auto-admin to all workspaces)
   b. Be explicitly added to the workspace
```

### Organization Roles

| Role | Description | Workspace Access |
|------|-------------|------------------|
| **Owner** | Full control. Can delete org, manage billing. | Admin to ALL workspaces |
| **Admin** | Manage resources and members. | Admin to ALL workspaces |
| **Member** | Basic access. | Only assigned workspaces |

### Managing Organization Members

To manage organization-level members:

**Step 1: Navigate to Organizations Page**

```
Sidebar:
├── Dashboard
├── Chatbots
├── Knowledge Bases
├── Chatflows
├── Organizations  ← Click here
└── Settings
```

**Step 2: Click "Manage" on Your Organization**

```
┌───────────────────────────────────────────────┐
│  📁 Acme Corporation                     ✓    │
│                                               │
│  Billing: billing@acme.com                    │
│  Members: 3  •  Workspaces: 2                 │
│  Subscription: Free (Trial: 25 days)          │
│                                               │
│  [ Manage ]  [ Edit ]  [ Delete ]             │
│      ↑                                        │
│  Click here                                   │
└───────────────────────────────────────────────┘
```

**Step 3: Go to Members Tab**

```
┌─────────────────────────────────────────────────┐
│        MANAGE: ACME CORPORATION                 │
├─────────────────────────────────────────────────┤
│  ┌────────┬────────────┬─────────┬───────────┐  │
│  │Overview│ Workspaces │ Members │  Billing  │  │
│  └────────┴────────────┴────┬────┴───────────┘  │
│                             ↓                    │
│                        Click here               │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │         [ + Send Invitation ]             │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Members (3)                                │  │
│  │                                           │  │
│  │ 👑 John Smith (You)         Owner         │  │
│  │ 🛡️ Sarah Johnson           Admin          │  │
│  │ 👤 Mike Wilson             Member         │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Role Icons for Organization:**
- 👑 Crown: Owner
- 🛡️ Shield: Admin
- 👤 User: Member

### Inviting Organization Members

Same flow as workspace invitations, but:
- Roles are: Admin, Member (cannot invite as Owner)
- Invitee gets organization-level access
- If org Admin/Owner, they can access all workspaces

```
Organization Invitation Roles:

CAN INVITE AS:
├── Admin - Can manage org and access all workspaces
└── Member - Basic access, must be added to workspaces

CANNOT INVITE AS:
└── Owner - Only one owner per org, must be transferred
```

---

## Part 10: Troubleshooting

### Can't Create Workspace

**Symptom:** The "+ Add Workspace" button is missing or disabled.

```
Possible Causes & Solutions:

1. INSUFFICIENT ROLE
   ├── You need: Organization Admin or Owner
   ├── Check: Organization settings → Members
   └── Solution: Ask org Owner to upgrade your role

2. ORGANIZATION LIMIT (if applicable)
   ├── Free tier may have workspace limits
   └── Solution: Upgrade subscription or delete unused

3. UI NOT LOADED
   ├── Button may not render yet
   └── Solution: Refresh the page
```

### Can't See "Manage Members"

**Symptom:** Members tab doesn't show management options.

```
Possible Causes & Solutions:

1. VIEWER ROLE
   ├── Viewers can only see member list
   └── Solution: Ask Admin to upgrade your role

2. EDITOR ROLE
   ├── Editors cannot manage members
   └── Solution: Ask Admin for Admin role

3. NOT YOUR WORKSPACE
   ├── Ensure you're in the right workspace
   └── Solution: Switch to correct workspace
```

### Invitation Expired

**Symptom:** Invitee sees "Invitation has expired" message.

```
Solutions:

1. RESEND INVITATION
   ├── Open workspace → Members → Pending Invitations
   ├── Click "Resend" on the expired invitation
   └── New email sent with 7-day extension

2. CANCEL AND RE-INVITE
   ├── Cancel the old invitation
   └── Create a new invitation

Tip: Invitations expire after 7 days.
Resending extends by another 7 days.
```

### Can't See a Workspace

**Symptom:** Workspace doesn't appear in your workspace switcher.

```
Possible Causes & Solutions:

1. NOT A MEMBER
   ├── You haven't been added to that workspace
   └── Solution: Ask workspace Admin to invite you

2. DIFFERENT ORGANIZATION
   ├── Workspace is in another organization
   ├── Check: Switch organization first
   └── Solution: Switch org, then look for workspace

3. WORKSPACE DELETED
   ├── The workspace may have been deleted
   └── Solution: Contact organization Admin

4. CACHE ISSUE
   └── Solution: Refresh page or clear browser cache
```

### Can't Delete Workspace

**Symptom:** Delete button is disabled or shows warning.

```
Possible Causes & Solutions:

1. DEFAULT WORKSPACE
   ├── Cannot delete the default workspace
   └── Solution: Create another workspace first,
       make it default, then delete

2. INSUFFICIENT ROLE
   ├── Only workspace Admins can delete
   └── Solution: Ask Admin to delete or upgrade you

3. NAME MISMATCH
   ├── Typed name doesn't match exactly
   └── Solution: Type the exact workspace name
       (case-sensitive)
```

### "Permission Denied" Errors

**Symptom:** Error message when trying to perform an action.

```
Debug Steps:

1. CHECK YOUR WORKSPACE ROLE
   ├── Open workspace settings
   ├── Look at "Your Role" in info box
   └── Compare with permission table

2. CHECK YOUR ORGANIZATION ROLE
   ├── Go to Organizations page
   ├── Look at your role on the org card
   └── Org Admins/Owners have elevated access

3. VERIFY CORRECT WORKSPACE
   ├── Check workspace name in header
   └── Make sure you're in the right workspace

4. REFRESH SESSION
   ├── Try logging out and back in
   └── Gets fresh JWT token with current permissions
```

### Invitation Email Not Received

**Symptom:** Invitee says they never got the email.

```
Solutions:

1. CHECK SPAM/JUNK FOLDER
   └── Invitation emails may be filtered

2. VERIFY EMAIL ADDRESS
   ├── Check for typos in email
   └── Cancel and re-send with correct email

3. RESEND INVITATION
   └── Click "Resend" to send a fresh email

4. CORPORATE EMAIL FILTERS
   ├── Some companies block external emails
   └── Try inviting a personal email address first
```

---

## Summary

### Quick Reference

```
WORKSPACE OPERATIONS:

Create Workspace:
└── Click "+" in workspace switcher
└── Enter name and description
└── Requires: Org Admin/Owner role

Edit Workspace:
└── Open Settings → Settings tab
└── Update name/description
└── Requires: Workspace Admin or Editor

Delete Workspace:
└── Open Settings → Delete option
└── Type workspace name to confirm
└── Requires: Workspace Admin role
└── Cannot delete default workspace

Switch Workspace:
└── Click workspace avatar in sidebar
└── Or use header dropdown
└── JWT token updates automatically
```

```
MEMBER OPERATIONS:

Invite Member:
└── Open Settings → Members tab
└── Click "Send Invitation"
└── Enter email and select role
└── 7-day expiration

Change Role:
└── Click role dropdown on member
└── Select new role
└── Instant update

Remove Member:
└── Click trash icon
└── Confirm in toast
└── Cannot remove yourself

Resend/Cancel Invitation:
└── Find in Pending Invitations
└── Click Resend or Cancel
```

### Workspace Roles Summary

```
ADMIN:   Full control (create, edit, delete, manage members)
EDITOR:  Create and edit (no delete, no member management)
VIEWER:  Read-only (view only, no changes)
```

### Organization Roles Summary

```
OWNER:   Full control + billing + delete org
ADMIN:   Manage resources + admin access to all workspaces
MEMBER:  Basic access + only assigned workspaces
```

---

## Next Steps

Now that you understand workspaces and members, you can:

1. **Create Workspaces** for your projects
   - One workspace per client/project/team
   - Keep resources organized

2. **Invite Your Team**
   - Add colleagues with appropriate roles
   - Viewers for stakeholders
   - Editors for contributors
   - Admins for managers

3. **Start Building**
   - Create knowledge bases in each workspace
   - Build chatbots for different purposes
   - Design chatflows for automation

4. **Stay Organized**
   - Use descriptive workspace names
   - Add descriptions for clarity
   - Review member access regularly

Workspaces help you keep everything organized as your AI projects grow.
