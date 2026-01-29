# User Account Settings Guide

Manage your PrivexBot account settings, authentication methods, and security preferences. This guide covers all account-related options.

---

## Table of Contents

1. [Accessing Account Settings](#accessing-account-settings)
2. [Profile Information](#profile-information)
3. [Authentication Methods](#authentication-methods)
4. [Changing Password](#changing-password)
5. [Security Best Practices](#security-best-practices)
6. [Deleting Your Account](#deleting-your-account)
7. [Troubleshooting](#troubleshooting)

---

## Accessing Account Settings

### Navigation

1. Log in to PrivexBot
2. Click your **profile icon** in the top-right corner
3. Select **Account Settings**

```
┌─────────────────────────────────────────┐
│                          [👤 ▼]         │
│                          ├─────────────┤│
│                          │ Account     ││
│                          │ Settings    ││
│                          │ ───────     ││
│                          │ Log Out     ││
│                          └─────────────┘│
└─────────────────────────────────────────┘
```

### Settings Overview

```
Account Settings
────────────────────────────────────────────────────────
┌─────────────┐
│ Profile     │  Your account information
├─────────────┤
│ Auth        │  Login methods
├─────────────┤
│ Security    │  Password & 2FA
├─────────────┤
│ Danger Zone │  Account deletion
└─────────────┘
```

---

## Profile Information

### Viewing Your Profile

```
Profile
───────
Email: john@example.com
Username: johndoe
Account Status: Active
Member Since: January 15, 2024
```

### Updating Username

1. Go to **Account Settings** → **Profile**
2. Click **Edit** next to Username
3. Enter new username
4. Click **Save**

```
Update Username
───────────────
Current: johndoe

New Username:
┌─────────────────────────────────────────────────────┐
│ john_doe_2024                                       │
└─────────────────────────────────────────────────────┘

Username requirements:
• 3-30 characters
• Letters, numbers, underscores only
• Must be unique

[  Cancel  ] [  Save  ]
```

### Account Status

| Status | Meaning |
|--------|---------|
| **Active** | Normal account |
| **Pending Verification** | Email not yet verified |
| **Suspended** | Contact support |

---

## Authentication Methods

PrivexBot supports multiple authentication methods per account.

### Viewing Linked Methods

```
Authentication Methods
──────────────────────

Email & Password
├─ john@example.com
└─ Status: Linked ✓

Crypto Wallets
├─ MetaMask (EVM): 0x1234...5678 ✓
├─ Phantom (Solana): Not linked
└─ Keplr (Cosmos): Not linked
```

### Supported Methods

| Method | Type | Description |
|--------|------|-------------|
| **Email/Password** | Traditional | Standard login |
| **MetaMask** | EVM Wallet | Ethereum, Polygon, etc. |
| **Phantom** | Solana Wallet | Solana blockchain |
| **Keplr** | Cosmos Wallet | Cosmos ecosystem |

### Linking Email to Wallet Account

If you signed up with a wallet and want to add email:

1. Go to **Account Settings** → **Authentication**
2. Click **Link Email Address**
3. Enter your email
4. Enter a password
5. Verify via email link

```
Link Email Address
──────────────────

Email:
┌─────────────────────────────────────────────────────┐
│ john@example.com                                    │
└─────────────────────────────────────────────────────┘

Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••                                        │
└─────────────────────────────────────────────────────┘

Confirm Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••                                        │
└─────────────────────────────────────────────────────┘

[  Cancel  ] [  Link Email  ]
```

### Linking Wallet to Email Account

If you signed up with email and want to add a wallet:

1. Go to **Account Settings** → **Authentication**
2. Click **Link Wallet** under desired wallet type
3. Approve the connection in your wallet
4. Sign the verification message
5. Wallet linked!

```
Link MetaMask Wallet
────────────────────

Step 1: Connect Wallet
[  Connect MetaMask  ]

Step 2: Sign Message
Your wallet will prompt you to sign a verification message.
This proves you own the wallet without sharing your private key.

Step 3: Confirm
Wallet address will be linked to your account.
```

### Wallet Authentication Flow

How wallet login works:

```
1. You click "Login with MetaMask"
            │
            ▼
2. PrivexBot generates a random challenge
            │
            ▼
3. You sign the challenge with your wallet
   (proves ownership without sharing private key)
            │
            ▼
4. PrivexBot verifies the signature
            │
            ▼
5. You're logged in!
```

### Unlinking Authentication Methods

**Important**: You must keep at least one authentication method linked.

To unlink a method:

1. Ensure you have at least 2 methods linked
2. Click **Unlink** next to the method to remove
3. Confirm the action

```
Unlink Authentication Method
────────────────────────────

You are about to unlink:
MetaMask Wallet: 0x1234...5678

⚠️ You will no longer be able to log in with this wallet.

Your remaining login method:
• Email: john@example.com

[  Cancel  ] [  Unlink Wallet  ]
```

### Minimum Methods Requirement

```
⚠️ Cannot Unlink
────────────────
You must keep at least one authentication method.

Currently linked methods: 1
• Email: john@example.com

Link another method before unlinking this one.
```

---

## Changing Password

### For Email/Password Accounts

1. Go to **Account Settings** → **Security**
2. Click **Change Password**
3. Enter current password
4. Enter new password twice
5. Click **Update Password**

```
Change Password
───────────────

Current Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••                                        │
└─────────────────────────────────────────────────────┘

New Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••••••                                    │
└─────────────────────────────────────────────────────┘

Confirm New Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••••••                                    │
└─────────────────────────────────────────────────────┘

Password Requirements:
✓ At least 8 characters
✓ Contains uppercase letter
✓ Contains lowercase letter
✓ Contains number

[  Cancel  ] [  Update Password  ]
```

### Password Requirements

| Requirement | Minimum |
|-------------|---------|
| Length | 8 characters |
| Uppercase | 1 letter |
| Lowercase | 1 letter |
| Number | 1 digit |
| Special char | Recommended |

### Forgot Password

If you can't log in:

1. Go to the login page
2. Click **Forgot Password?**
3. Enter your email
4. Check inbox for reset link
5. Click link and set new password

```
Password Reset
──────────────

Enter your email address:
┌─────────────────────────────────────────────────────┐
│ john@example.com                                    │
└─────────────────────────────────────────────────────┘

[  Send Reset Link  ]

We'll send a password reset link to your email.
Link expires in 1 hour.
```

---

## Security Best Practices

### Account Security Checklist

- [ ] Strong, unique password
- [ ] Multiple auth methods linked
- [ ] Recovery email verified
- [ ] Regular password changes
- [ ] Logout from unused sessions

### Strong Password Tips

| Do | Don't |
|----|-------|
| 12+ characters | Use common words |
| Mix character types | Reuse passwords |
| Use password manager | Share credentials |
| Change regularly | Write down passwords |

### Wallet Security

For wallet-linked accounts:

| Do | Don't |
|----|-------|
| Use hardware wallet | Share seed phrase |
| Verify signing requests | Sign blindly |
| Keep wallet updated | Use compromised wallets |

### Multiple Auth Methods

Benefits of linking multiple methods:

1. **Backup access**: If one method fails
2. **Convenience**: Login from any device
3. **Security**: Harder to lock yourself out

### Session Management

```
Active Sessions
───────────────

Current Session:
• Browser: Chrome on macOS
• Location: San Francisco, US
• Started: 2 hours ago

Other Sessions:
• Browser: Firefox on Windows
• Location: New York, US
• Started: 3 days ago
  [Revoke]

[  Log Out All Other Sessions  ]
```

---

## Deleting Your Account

### Before Deleting

Understand what happens:

| What Gets Deleted | What Remains |
|-------------------|--------------|
| Your profile | Nothing |
| Your organizations* | Transferred or deleted |
| All chatbots | Permanently removed |
| All knowledge bases | Permanently removed |
| All leads | Permanently removed |
| All analytics | Permanently removed |

*Organizations with other members are transferred; sole-owner organizations are deleted.

### Deletion Process

1. Go to **Account Settings** → **Danger Zone**
2. Click **Delete Account**
3. Review what will be deleted
4. Enter your password or sign with wallet
5. Type "DELETE" to confirm
6. Click **Permanently Delete Account**

```
Delete Account
──────────────

⚠️ WARNING: This action cannot be undone!

Deleting your account will permanently remove:
• All your chatbots and chatflows
• All knowledge bases and documents
• All leads and conversation history
• All analytics data
• Access to all organizations

Organizations you own:
• Acme Corp (sole owner) - Will be deleted
• Partner Inc (3 other admins) - Ownership transferred

To confirm, enter your password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••                                        │
└─────────────────────────────────────────────────────┘

Type DELETE to confirm:
┌─────────────────────────────────────────────────────┐
│                                                     │
└─────────────────────────────────────────────────────┘

[  Cancel  ] [  Permanently Delete Account  ]
```

### Export Before Deleting

Export your data before deletion:

1. Go to **Settings** → **Data Export**
2. Click **Request Data Export**
3. Wait for export to generate
4. Download the archive
5. Then proceed with deletion

### After Deletion

- Immediate logout from all sessions
- Email confirmation sent
- 30-day grace period (contact support to cancel)
- After 30 days: permanent, irreversible deletion

---

## Troubleshooting

### Can't Log In

| Issue | Solution |
|-------|----------|
| Forgot password | Use password reset |
| Email not recognized | Check for typos, try other emails |
| Wallet not connecting | Check wallet extension, try refresh |
| "Account not found" | May have used different method |

### Password Reset Not Working

| Issue | Solution |
|-------|----------|
| No email received | Check spam folder |
| Link expired | Request new reset |
| Link not working | Copy full URL, don't click |
| Wrong email | Try other registered emails |

### Wallet Connection Issues

| Issue | Solution |
|-------|----------|
| MetaMask not detected | Install/enable extension |
| Transaction rejected | User cancelled, try again |
| Wrong network | Switch to correct network |
| Signature failed | Refresh and retry |

### Can't Link New Method

| Issue | Solution |
|-------|----------|
| Email already used | That email has another account |
| Wallet already linked | That wallet has another account |
| Verification failed | Check email/sign correctly |

### Can't Unlink Method

| Issue | Solution |
|-------|----------|
| "Must keep one method" | Link another method first |
| Confirmation failed | Enter correct password |

### Account Recovery

If completely locked out:

1. Try password reset first
2. Try all linked wallets
3. Contact support with:
   - Original email
   - Wallet addresses (if any)
   - Any account identifiers

---

## Account Settings Reference

### All Settings

| Section | Settings |
|---------|----------|
| **Profile** | Username, display name |
| **Authentication** | Email, wallets |
| **Security** | Password, sessions |
| **Notifications** | Email preferences |
| **Data** | Export, privacy |
| **Danger Zone** | Account deletion |

### Quick Links

From account menu:
- **Account Settings**: Full settings page
- **Billing**: Subscription management
- **Log Out**: End current session

---

## Next Steps

- **[Signup Guide](47-signup-and-authentication.md)**: Learn about authentication
- **[Multi-Tenant Setup](49-multi-tenant-setup.md)**: Manage organizations
- **[Troubleshooting](50-troubleshooting-guide.md)**: More help

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
