# Google Drive OAuth Setup Guide

This guide explains how to set up Google Drive API access for importing documents from Google Drive and Google Docs into your knowledge bases.

---

## Overview

| Field | Value |
|-------|-------|
| **Service** | Google Drive API / Google Docs API |
| **Authentication Type** | OAuth 2.0 |
| **Cost** | Free (within Google API quotas) |
| **Rate Limits** | 1,000 requests/100 seconds per user |

---

## Prerequisites

- A Google account (personal Gmail or Google Workspace)
- Google Drive with documents you want to import
- A Google Cloud project (created during setup)

---

## How OAuth Works with PrivexBot

When you connect Google Drive:

1. Click **"Connect with Google Drive"** in PrivexBot
2. You're redirected to Google's consent screen
3. Select your Google account
4. Grant requested permissions
5. Redirected back to PrivexBot with access granted

---

## Understanding Permissions

### Scopes Requested

| Scope | Purpose | Access Level |
|-------|---------|--------------|
| `drive.readonly` | Read files and folders | View only |
| `docs.readonly` | Read Google Docs content | View only |
| `sheets.readonly` | Read Google Sheets content | View only |

> **Note**: PrivexBot only requests **read-only** access. We cannot modify, delete, or create files.

### What We Can Access

- ✅ Files you explicitly share or select
- ✅ Files in shared drives you have access to
- ✅ Google Docs, Sheets, and PDFs
- ❌ Files you don't have access to
- ❌ Private files not selected during authorization

---

## Connecting Google Drive (User Flow)

### Step 1: Initiate Connection

1. Go to **Settings > API Credentials** in PrivexBot
2. Click **"Add Credential"**
3. Select **"Google Drive"**
4. Click **"Connect with Google Drive"**

### Step 2: Google Sign-In

1. Select your Google account (or sign in)
2. If you see "Google hasn't verified this app":
   - Click **"Advanced"**
   - Click **"Go to [App Name] (unsafe)"**
   - This is normal for development/private apps

### Step 3: Grant Permissions

Review the permissions requested:
- "See and download all your Google Drive files"
- "See all your Google Sheets spreadsheets"
- "See all your Google Docs documents"

Click **"Allow"** to grant access.

### Step 4: Confirmation

You'll be redirected back to PrivexBot with a success message. Your Google Drive is now connected!

---

## Supported File Types

### Direct Import

| File Type | Extension | Notes |
|-----------|-----------|-------|
| Google Docs | - | Native, full content |
| Google Sheets | - | All sheets, as tables |
| PDF | .pdf | Text extraction (OCR if needed) |
| Word Documents | .docx, .doc | Full content |
| Text Files | .txt | Full content |
| Markdown | .md | Full content |
| HTML | .html | Text extraction |
| Rich Text | .rtf | Full content |

### Limited Support

| File Type | Extension | Notes |
|-----------|-----------|-------|
| PowerPoint | .pptx | Slide text only |
| Excel | .xlsx | Data extraction |
| Images | .png, .jpg | OCR (if enabled) |

### Not Supported

| File Type | Reason |
|-----------|--------|
| Videos | Cannot extract text |
| Audio | Cannot transcribe |
| Archives | Must be extracted first |
| Executables | Security risk |

---

## Selecting Files for Import

When importing to a knowledge base:

### Option 1: File Picker

1. Click **"Import from Google Drive"**
2. A file picker dialog opens
3. Navigate and select files/folders
4. Click **"Select"**

### Option 2: Folder Import

1. Select a folder in the picker
2. All supported files in the folder are imported
3. Subfolders can be included optionally

### Option 3: Shared Drives

1. Navigate to **"Shared drives"** in the picker
2. Select files from team drives
3. Requires appropriate access permissions

---

## Rate Limits and Quotas

### Default Quotas

| Quota | Limit |
|-------|-------|
| Queries per day | 1,000,000 |
| Queries per 100 seconds | 1,000 |
| Queries per 100 seconds per user | 100 |

### File Export Limits

| Limit | Value |
|-------|-------|
| Maximum export size | 10 MB per file |
| Maximum download size | 100 MB per file |

### Handling Limits

PrivexBot automatically:
- Batches requests efficiently
- Implements exponential backoff
- Queues large imports

---

## Troubleshooting

### "Access Denied" Error

- You don't have access to the file/folder
- File is in a restricted drive
- Solution: Request access from file owner

### "Token Expired" Error

- OAuth token has expired
- Solution: Re-authenticate by clicking "Connect with Google Drive" again

### "Quota Exceeded" Error

- Too many API requests
- Solution: Wait and retry (automatic in PrivexBot)

### "File Not Found" Error

- File was deleted or moved
- File ID is incorrect
- Solution: Re-select the file

### "Cannot Export File" Error

- File is too large (>10 MB export)
- File type not supported for export
- Solution: Download file manually and upload

### "App Not Verified" Warning

During OAuth, you may see "Google hasn't verified this app":

1. Click **"Advanced"**
2. Click **"Go to [App Name] (unsafe)"**
3. Continue with authorization

> **Note**: This warning appears for apps in development or with limited users. It's safe to proceed for PrivexBot.

---

## Revoking Access

To disconnect Google Drive from PrivexBot:

### Method 1: From PrivexBot

1. Go to **Settings > API Credentials**
2. Find your Google Drive credential
3. Click **"Delete"**

### Method 2: From Google

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click **"Third-party apps with account access"**
3. Find PrivexBot
4. Click **"Remove Access"**

---

## Google Workspace (Formerly G Suite)

### Domain-Wide Delegation

For Google Workspace admins who want to grant access across the organization:

1. Go to [Google Admin Console](https://admin.google.com/)
2. Navigate to **Security > API Controls > Domain-wide Delegation**
3. Add the client ID and required scopes
4. Enable for specific OUs or entire organization

### Admin Controls

Workspace admins can:
- Control which apps can access Drive
- Set sharing restrictions
- Monitor third-party app access
- Revoke access organization-wide

---

## Security Best Practices

### Access Control

- Only grant **read-only** access
- Regularly **audit** connected applications
- **Revoke** access for unused connections
- Use **specific file selection** over full drive access

### For Organizations

- Review third-party app policies
- Enable **alerts** for new OAuth grants
- Implement **app whitelisting** if available
- Regular **access audits**

### Token Security

- Tokens are encrypted in PrivexBot
- Never share OAuth tokens
- Use separate connections for different projects
- Revoke immediately if compromised

---

## Shared Drives (Team Drives)

### Accessing Shared Drives

1. Ensure you have access to the shared drive
2. Navigate to "Shared drives" in the file picker
3. Select files from the shared drive

### Permission Requirements

| Action | Required Role |
|--------|---------------|
| View files | Viewer |
| Download files | Viewer |
| List contents | Viewer |

### Limitations

- Cannot access drives you're not a member of
- May require admin approval in some organizations
- Some drives may have download restrictions

---

## API Information (For Developers)

### Endpoints Used

```
# List files
GET https://www.googleapis.com/drive/v3/files

# Get file metadata
GET https://www.googleapis.com/drive/v3/files/{fileId}

# Export Google Docs
GET https://www.googleapis.com/drive/v3/files/{fileId}/export

# Download file content
GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
```

### OAuth Endpoints

```
# Authorization
https://accounts.google.com/o/oauth2/v2/auth

# Token exchange
https://oauth2.googleapis.com/token

# Token revoke
https://oauth2.googleapis.com/revoke
```

---

## Testing the Connection

### Verify Access

After connecting, verify by:

1. Going to a knowledge base
2. Clicking "Add Source"
3. Selecting "Google Drive"
4. Confirming files are visible in the picker

### Test File Import

1. Select a small Google Doc
2. Add to knowledge base
3. Verify content is extracted correctly

---

## Troubleshooting: "Access blocked: ... has not completed the Google verification process" (Error 403 access_denied)

This error means Google's OAuth consent screen blocked the user before any token exchange happened. The cause is **never a code bug in PrivexBot** — it's the publishing status of the Google Cloud Console OAuth client and which scopes the app requests.

PrivexBot ships two distinct Google providers, and they behave differently:

| Provider | Backend route | Scopes | Sensitivity tier | Used by |
|---|---|---|---|---|
| `google` | `routes/credentials.py` (line 497–517) | `drive.readonly`, `documents.readonly`, `spreadsheets.readonly` | **Sensitive** | KB document import (Drive picker → Docs/Sheets read) |
| `google_gmail` | `routes/credentials.py` (line 519–539) | `gmail.send`, `userinfo.email` | **Restricted** (highest tier) | Chatflow email node (Gmail API as alternative to SMTP) |

The unblock path depends on which provider is failing.

### Case A — `google` provider (Drive / Docs / Sheets)

Sensitive scopes can be unblocked **today** without waiting for Google's verification audit:

1. Open Google Cloud Console → **APIs & Services** → **OAuth consent screen**.
2. Confirm Publishing status is **Testing**. Scroll to **Test users** → click **Add users**.
3. Add the email of every user who needs to connect Google to PrivexBot (yourself first, plus testers). Cap is 100 users.
4. Save. The user retries the Connect Google flow on PrivexBot.
5. Google now shows an **"unverified app"** warning screen with the text *"Continue to privexbot.com (unsafe)"*. This is expected for sensitive scopes in Testing mode — clicking Continue completes the OAuth and creates the credential.
6. To remove the warning entirely, the OAuth client must be moved to **Production** and pass Google's sensitive-scope verification audit. That review typically takes **2–4 weeks** but can run longer; do not rely on the timeline.

### Case B — `google_gmail` provider (Gmail send)

`gmail.send` is in Google's most-strict tier (Restricted). The behaviour is harsher than Sensitive scopes:

- **Test users do NOT get a click-through warning** — they get a hard "Access blocked" error with no Continue button.
- The only path to unblock is **completing Google's Restricted-scope verification** (a deeper review than Sensitive scopes; typically 4–6 weeks; possibly longer for Gmail-class scopes due to incremental review milestones).

While verification is pending, **the chatflow Email node still works via SMTP** (`backend/src/app/chatflow/nodes/email_node.py:180-294`). Operators can:

- Tell users to attach a generic SMTP credential rather than `google_gmail` until verification clears.
- Hide the `google_gmail` connect option in the credentials UI if it's adding more confusion than value.

### Required: register the redirect URI byte-for-byte

Whichever provider, the OAuth client in Google Cloud Console must have `{API_BASE_URL}/api/v1/credentials/oauth/callback` registered under **Authorized redirect URIs**. Examples:

- Dev: `http://localhost:8000/api/v1/credentials/oauth/callback`
- Prod: `https://api.privexbot.com/api/v1/credentials/oauth/callback`

If the redirect URI is missing or wrong, Google returns `redirect_uri_mismatch` (a different error from `access_denied` — but worth checking when troubleshooting). Add both dev and prod URIs to the same client so both deployments share one `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### What end users see (and how to handle it in product)

When the OAuth screen blocks the user, PrivexBot's KB-creation wizard receives a `?google_error=access_denied` callback. The wizard surfaces a destructive toast: *"Google connection failed — verify the OAuth client and try again."* No data loss; the user can retry once the operator completes the steps above.

### Reduce-scope alternatives we explicitly DO NOT take

- `drive.readonly` → `drive.file`: would limit access to files opened via the Drive picker. PrivexBot opens documents by ID after user selection (`google_adapter.py:46-282`), which `drive.file` does not cover. This would break document import.
- Disable `google_gmail`: would remove the Gmail-send option for chatflows. The Email node falls back to SMTP, but power users rely on Gmail auth for deliverability.

---

## Useful Links

- [Google Drive API Documentation](https://developers.google.com/drive)
- [Google Docs API Documentation](https://developers.google.com/docs)
- [OAuth 2.0 for Google APIs](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Manage Third-Party Access](https://myaccount.google.com/permissions)
- [API Status Dashboard](https://status.cloud.google.com/)
- [Google Workspace Admin Console](https://admin.google.com/)

---

## Support

If you encounter issues:

1. Check [Google Drive API Documentation](https://developers.google.com/drive)
2. Visit [Google Cloud Community](https://cloud.google.com/community)
3. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/google-drive-api)
4. Contact [Google Cloud Support](https://cloud.google.com/support)
