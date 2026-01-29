# Signup and Authentication Guide

Get started with PrivexBot by creating an account. This guide covers all signup methods, login options, and what happens after you create your account.

---

## Table of Contents

1. [Creating an Account](#creating-an-account)
2. [Logging In](#logging-in)
3. [Password Requirements](#password-requirements)
4. [Wallet Authentication Flow](#wallet-authentication-flow)
5. [Password Reset](#password-reset)
6. [Session Management](#session-management)
7. [What Happens After Signup](#what-happens-after-signup)
8. [Troubleshooting](#troubleshooting)

---

## Creating an Account

PrivexBot offers multiple signup methods.

### Method 1: Email and Password

Traditional signup with email verification.

**Step 1: Go to Signup Page**
```
https://app.privexbot.com/signup
```

**Step 2: Fill in Details**
```
Create Your Account
───────────────────

Email:
┌─────────────────────────────────────────────────────┐
│ your@email.com                                      │
└─────────────────────────────────────────────────────┘

Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••                                        │
└─────────────────────────────────────────────────────┘
At least 8 characters

Confirm Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••                                        │
└─────────────────────────────────────────────────────┘

[✓] I agree to the Terms of Service and Privacy Policy

[      Create Account      ]
```

**Step 3: Verify Email**
- Check your inbox
- Click verification link
- Account activated!

### Method 2: MetaMask (Ethereum/EVM)

Sign up using your Ethereum wallet.

**Step 1: Click "Continue with MetaMask"**

```
Or continue with:
[🦊 MetaMask] [👻 Phantom] [🔮 Keplr]
```

**Step 2: Connect Wallet**
- MetaMask popup appears
- Select account to connect
- Click "Connect"

**Step 3: Sign Verification Message**
```
┌─────────────────────────────────────────────────────┐
│ MetaMask - Signature Request                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│ PrivexBot wants you to sign:                       │
│                                                     │
│ "Sign this message to verify your wallet           │
│ ownership for PrivexBot.                            │
│                                                     │
│ Timestamp: 1705234567890                           │
│ Nonce: abc123xyz789"                               │
│                                                     │
│ This request will not trigger a blockchain         │
│ transaction or cost any gas fees.                  │
│                                                     │
│ [  Cancel  ] [  Sign  ]                            │
└─────────────────────────────────────────────────────┘
```

**Step 4: Account Created**
- No password needed
- Wallet address is your identifier
- Can add email later (optional)

### Method 3: Phantom (Solana)

Sign up using your Solana wallet.

1. Click "Continue with Phantom"
2. Phantom popup appears
3. Approve connection
4. Sign verification message
5. Account created!

### Method 4: Keplr (Cosmos)

Sign up using your Cosmos wallet.

1. Click "Continue with Keplr"
2. Keplr popup appears
3. Approve connection
4. Sign verification message
5. Account created!

### Comparison of Methods

| Method | Pros | Cons |
|--------|------|------|
| **Email** | Familiar, recoverable | Password to remember |
| **MetaMask** | No password, Web3 native | Need wallet installed |
| **Phantom** | Solana ecosystem | Need wallet installed |
| **Keplr** | Cosmos ecosystem | Need wallet installed |

---

## Logging In

### Email Login

```
Log In
──────

Email:
┌─────────────────────────────────────────────────────┐
│ your@email.com                                      │
└─────────────────────────────────────────────────────┘

Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••                                        │
└─────────────────────────────────────────────────────┘

[✓] Remember me

[      Log In      ]

Forgot password?
```

### Wallet Login

```
Log In
──────

[      Log in with Email      ]

─────────── or ───────────

[🦊 MetaMask] [👻 Phantom] [🔮 Keplr]
```

For wallet login:
1. Click your wallet button
2. Wallet extension opens
3. Approve connection
4. Sign verification message
5. Logged in!

### Multiple Methods Same Account

If you've linked multiple auth methods:
- Log in with ANY linked method
- All lead to the same account
- Example: Email AND MetaMask both work

---

## Password Requirements

When creating or changing passwords:

### Minimum Requirements

| Requirement | Minimum |
|-------------|---------|
| **Length** | 8 characters |
| **Uppercase** | 1 letter (A-Z) |
| **Lowercase** | 1 letter (a-z) |
| **Number** | 1 digit (0-9) |

### Strength Indicator

```
Password Strength
─────────────────

Weak:     ██░░░░░░░░  "password1"
Fair:     ████░░░░░░  "Password1"
Good:     ██████░░░░  "Password1!"
Strong:   ████████░░  "Tr0ub4dor&3"
Excellent:██████████  "correct-horse-battery-staple"
```

### Password Tips

**Good Practices:**
- Use a password manager
- Make it 12+ characters
- Use a passphrase
- Include special characters

**Avoid:**
- Dictionary words alone
- Personal information (birthday, name)
- Sequences (123456, qwerty)
- Reusing passwords from other sites

---

## Wallet Authentication Flow

Understanding how wallet authentication works.

### The Challenge-Response Process

```
You (Browser)                    PrivexBot Server
     │                                  │
     │ 1. Request login                 │
     │─────────────────────────────────▶│
     │                                  │
     │ 2. Challenge (random string)     │
     │◀─────────────────────────────────│
     │                                  │
     │ 3. Sign challenge with wallet    │
     │   (happens locally in browser)   │
     │                                  │
     │ 4. Send signature                │
     │─────────────────────────────────▶│
     │                                  │
     │ 5. Verify signature matches      │
     │    wallet's public key           │
     │                                  │
     │ 6. Success + session token       │
     │◀─────────────────────────────────│
     │                                  │
```

### Why It's Secure

| Security Feature | Explanation |
|------------------|-------------|
| **No password transmitted** | Nothing to intercept |
| **Private key stays local** | Never sent to server |
| **Challenge expires** | Can't reuse old challenges |
| **Cryptographic proof** | Mathematically verifiable |

### What You're Signing

The message you sign contains:
- Statement of intent
- Timestamp (prevents replay attacks)
- Random nonce (prevents reuse)
- Domain (prevents phishing)

```
"Sign this message to verify your wallet ownership for PrivexBot.

Domain: app.privexbot.com
Timestamp: 2024-01-15T10:30:00Z
Nonce: f7a3b2c1d4e5..."
```

### Supported Wallets

| Wallet | Blockchain | How to Get |
|--------|------------|------------|
| **MetaMask** | Ethereum, Polygon, etc. | metamask.io |
| **Phantom** | Solana | phantom.app |
| **Keplr** | Cosmos, Osmosis, etc. | keplr.app |

---

## Password Reset

### Requesting a Reset

1. Go to login page
2. Click **Forgot password?**
3. Enter your email
4. Click **Send Reset Link**

```
Reset Password
──────────────

Enter the email address associated with your account:
┌─────────────────────────────────────────────────────┐
│ your@email.com                                      │
└─────────────────────────────────────────────────────┘

[      Send Reset Link      ]

Remember your password? Log in
```

### Reset Email

```
Subject: Reset your PrivexBot password

Hi,

We received a request to reset your password.
Click the link below to set a new password:

[Reset Password]

This link expires in 1 hour.

If you didn't request this, you can ignore this email.
```

### Setting New Password

```
Set New Password
────────────────

New Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••                                        │
└─────────────────────────────────────────────────────┘

Confirm Password:
┌─────────────────────────────────────────────────────┐
│ ••••••••••••                                        │
└─────────────────────────────────────────────────────┘

[      Update Password      ]
```

### Reset for Wallet-Only Accounts

If you signed up with only a wallet:
- No password to reset!
- Just log in with your wallet
- Consider linking an email for recovery

---

## Session Management

### Session Duration

| Setting | Duration |
|---------|----------|
| **Default** | 30 minutes of inactivity |
| **"Remember me"** | 7 days |
| **Maximum** | 30 days |

### JWT Tokens

PrivexBot uses JWT (JSON Web Tokens):
- Access token: 30 minutes
- Refresh token: 7 days (with "remember me")
- Auto-refresh on activity

### Active Sessions

View and manage in Account Settings:

```
Active Sessions
───────────────

Current Session (this device)
• Chrome on macOS
• San Francisco, US
• Active now

Other Sessions:
┌─────────────────────────────────────────────────────┐
│ Firefox on Windows                                  │
│ New York, US • 2 days ago                          │
│ [Revoke]                                            │
├─────────────────────────────────────────────────────┤
│ Safari on iOS                                       │
│ Los Angeles, US • 5 days ago                       │
│ [Revoke]                                            │
└─────────────────────────────────────────────────────┘

[  Log Out All Other Sessions  ]
```

### Security Alerts

You'll be notified of:
- Login from new device
- Login from new location
- Multiple failed attempts
- Password changes

---

## What Happens After Signup

When you create a new account, PrivexBot automatically sets up your workspace.

### Automatic Setup

```
Account Created!
────────────────

✓ Account verified
✓ Default organization created
✓ Default workspace created

Organization: Your Name's Org
Workspace: Default Workspace

[  Continue to Dashboard  ]
```

### Default Resources Created

| Resource | Name | Purpose |
|----------|------|---------|
| **Organization** | "[Your Name]'s Organization" | Top-level container |
| **Workspace** | "Default Workspace" | Your working area |

### First Steps

After signup, you can:
1. Create your first chatbot
2. Create a knowledge base
3. Invite team members
4. Customize organization settings

### Organization Structure

```
Your Account
    │
    └── Your Organization (auto-created)
            │
            └── Default Workspace (auto-created)
                    │
                    ├── Chatbots (empty)
                    ├── Knowledge Bases (empty)
                    ├── Credentials (empty)
                    └── Leads (empty)
```

---

## Troubleshooting

### Signup Issues

| Problem | Solution |
|---------|----------|
| "Email already registered" | Use login instead, or reset password |
| "Invalid email format" | Check for typos |
| "Password too weak" | Meet all requirements |
| Verification email not received | Check spam, request resend |

### Login Issues

| Problem | Solution |
|---------|----------|
| "Invalid credentials" | Check email/password |
| "Account not found" | Try different auth method |
| Wallet not connecting | Refresh page, check extension |
| "Session expired" | Log in again |

### Wallet Connection Issues

| Problem | Solution |
|---------|----------|
| Extension not detected | Install wallet extension |
| Popup blocked | Allow popups for site |
| Wrong network | MetaMask: any network works |
| Transaction rejected | You clicked cancel, retry |
| "Signature failed" | Try again, check wallet is unlocked |

### Email Verification Issues

| Problem | Solution |
|---------|----------|
| Link expired | Request new verification email |
| Link not working | Copy full URL manually |
| No email received | Check spam, verify address |
| Already verified | Just log in |

### Browser Compatibility

Supported browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

For wallet connections:
- Desktop browser required
- Wallet extension must be installed
- Mobile: use wallet's built-in browser

---

## Security Recommendations

### For Email Accounts

1. Use a strong, unique password
2. Enable email notifications for login
3. Link a wallet as backup auth
4. Keep email account secure

### For Wallet Accounts

1. Use hardware wallet for high security
2. Link email as backup
3. Never share seed phrase
4. Verify you're on official site before signing

### General Tips

1. Don't share credentials
2. Log out on shared devices
3. Review active sessions regularly
4. Enable security notifications

---

## Next Steps

After creating your account:

- **[Account Settings](46-how-to-manage-account.md)**: Configure your profile
- **[Create Your First Chatbot](34-how-to-create-chatflows.md)**: Build an AI assistant
- **[Multi-Tenant Setup](49-multi-tenant-setup.md)**: Organize your team

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
