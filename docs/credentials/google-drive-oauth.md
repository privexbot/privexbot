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
