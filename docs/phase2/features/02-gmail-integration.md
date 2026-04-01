# Gmail Integration — Implementation Design
> Feature: Send emails via Gmail API (OAuth2) from chatflow email node
> MOU Reference: Appendix A ("Gmail integrations"), Milestone 5
> Status: ❌ NOT IMPLEMENTED — SMTP exists, Gmail OAuth/API does not

---

## 1. What This Feature Provides

The Gmail integration allows chatflows to send emails using a user's connected Gmail account via Google OAuth2. Instead of requiring users to configure an SMTP server, they simply click "Connect Gmail", authorize PrivexBot, and the Email node in their chatflow uses the Gmail API to send on their behalf.

This is the standard "Connect your Gmail" integration seen in Zapier, HubSpot, Intercom, etc.

---

## 2. What Already Exists

### Current Email Infrastructure (Do NOT change)

| File | Purpose | Status |
|---|---|---|
| `src/app/services/email_service.py:1–634` | Transactional SMTP emails (invitations, password reset, verification) | ✅ Keep as-is |
| `src/app/services/email_service_enhanced.py:1–573` | SMTP with port fallback + retry | ✅ Keep as-is |
| `src/app/chatflow/nodes/email_node.py:1–185` | Chatflow email node (SMTP only currently) | ⚠️ EXTEND — add Gmail path |

### Existing Google Infrastructure to Reuse

| File | What to Reuse |
|---|---|
| `src/app/integrations/google_adapter.py:79–130` | Pattern for Google API calls with `Authorization: Bearer {access_token}` |
| `src/app/integrations/google_adapter.py:85–93` | `requests.get(..., headers={"Authorization": f"Bearer {access_token}"})` pattern |
| `src/app/api/v1/routes/integrations.py` | Existing Google OAuth token refresh logic — reuse for Gmail token refresh |
| `src/app/services/credential_service.py` | Encrypted credential storage — reuse for Gmail OAuth tokens |

---

## 3. Architecture

### Current Email Node Flow (SMTP)
```
EmailNode.execute()
  → credential_service.get_decrypted_data(credential)
  → Extract: host, port, username, password
  → smtplib.SMTP + starttls OR smtplib.SMTP_SSL
  → sendmail()
```

### New Email Node Flow (Gmail API added)
```
EmailNode.execute()
  → credential_service.get_decrypted_data(credential)
  → Check credential["type"] (or look at credential.credential_type column)
  → IF type == "smtp": existing SMTP path (unchanged)
  → IF type == "google_oauth_gmail": new Gmail API path
      → Refresh access_token if expired
      → google_adapter.send_gmail(access_token, to, subject, body, ...)
      → Return success result
```

---

## 4. Gmail Credential Structure

Gmail credentials are stored in the existing `credentials` table using `credential_service`. The credential type is `google_oauth_gmail`.

**Credential data shape (JSON, stored encrypted):**
```json
{
    "type": "google_oauth_gmail",
    "access_token": "ya29.a0A...",
    "refresh_token": "1//0g...",
    "client_id": "123456789-xxx.apps.googleusercontent.com",
    "client_secret": "GOCSPX-...",
    "token_expiry": "2026-03-25T15:30:00Z",
    "from_email": "user@gmail.com",
    "from_name": "John Doe"
}
```

**Important:** `access_token` expires after ~1 hour. The implementation must auto-refresh using `refresh_token` before each send. This pattern already exists in `src/app/api/v1/routes/integrations.py` for Google Drive/Docs access.

---

## 5. Google OAuth2 Setup (Platform Configuration)

### Google Cloud Console Steps (one-time by PrivexBot team)

1. Go to https://console.cloud.google.com
2. Create/use existing project
3. Enable Gmail API: `APIs & Services → Enable APIs → Gmail API`
4. Create OAuth 2.0 credentials: `Credentials → Create Credentials → OAuth client ID`
5. Application type: **Web application**
6. Authorized redirect URIs: `https://your-domain.com/api/v1/auth/google/gmail/callback`
7. Required OAuth scopes:
   ```
   https://www.googleapis.com/auth/gmail.send   (send email only — minimal scope)
   https://www.googleapis.com/auth/userinfo.email  (read their email address)
   ```

### Environment Variables Required
```
GOOGLE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

**Note:** These may already exist if Google Docs integration is configured. Gmail uses the same Google Cloud project but adds the `gmail.send` scope.

---

## 6. Files to Modify

### File 1: `src/app/integrations/google_adapter.py`

**Where to add:** After line 399 (before the `google_adapter = GoogleAdapter()` singleton line)

**New method to add to `GoogleAdapter` class:**

```python
async def send_gmail(
    self,
    access_token: str,
    to: str,
    subject: str,
    body: str,
    body_type: str = "html",
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
    reply_to: Optional[str] = None,
    from_name: Optional[str] = None
) -> dict:
    """
    Send email via Gmail API v1.

    WHY: Send emails using a connected Gmail account (OAuth2) instead of SMTP.
    HOW: Construct RFC 2822 message, base64url encode it, POST to Gmail API.

    ARGS:
        access_token: Valid Gmail OAuth2 access token
        to: Recipient email(s), comma-separated
        subject: Email subject
        body: Email body (HTML or plain text)
        body_type: "html" or "text"
        cc: CC addresses (optional)
        bcc: BCC addresses (optional)
        reply_to: Reply-To header (optional)
        from_name: Display name for From header (optional)

    RETURNS:
        {
            "success": True,
            "message_id": "17abc123...",    # Gmail message ID
            "thread_id": "17abc123..."
        }
        OR
        {
            "success": False,
            "error": "error description"
        }

    API Reference:
        https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send
        POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
        Authorization: Bearer {access_token}
        Body: {"raw": "<base64url encoded RFC 2822 message>"}
    """
    import base64
    import requests
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    try:
        # Build RFC 2822 message
        msg = MIMEMultipart("alternative") if body_type == "html" else MIMEText(body, "plain")
        msg["To"] = to
        msg["Subject"] = subject
        if cc:
            msg["Cc"] = cc
        if reply_to:
            msg["Reply-To"] = reply_to
        if body_type == "html":
            msg.attach(MIMEText(body, "html"))

        # Encode as base64url (Gmail API requirement)
        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

        # POST to Gmail API
        response = requests.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json={"raw": raw_message},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        return {
            "success": True,
            "message_id": data.get("id"),
            "thread_id": data.get("threadId")
        }

    except requests.HTTPError as e:
        error_body = e.response.json() if e.response else {}
        error_msg = error_body.get("error", {}).get("message", str(e))
        return {"success": False, "error": f"Gmail API error: {error_msg}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def refresh_gmail_token(
    self,
    refresh_token: str,
    client_id: str,
    client_secret: str
) -> dict:
    """
    Refresh an expired Gmail OAuth2 access token.

    WHY: access_token expires after ~1 hour; must refresh to continue sending.
    HOW: POST to Google token endpoint with refresh_token.

    RETURNS:
        {
            "access_token": "ya29.new_token...",
            "expires_in": 3599,
            "token_type": "Bearer"
        }

    API Reference:
        POST https://oauth2.googleapis.com/token
        Body: grant_type=refresh_token&refresh_token=...&client_id=...&client_secret=...
    """
    import requests

    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret
        },
        timeout=15
    )
    response.raise_for_status()
    return response.json()
```

---

### File 2: `src/app/chatflow/nodes/email_node.py`

**Where to modify:** After the credential lookup at line 80, before SMTP connection at line 132.

**Add Gmail API path:**

The credential stored in the database has a `credential_type` field (or the decrypted JSON has a `"type"` key). Check for `"google_oauth_gmail"` and branch accordingly.

```python
# After existing credential lookup (line 80):
cred_data = credential_service.get_decrypted_data(db, credential)

# NEW: Check credential type — route to Gmail API or SMTP
credential_type = cred_data.get("type", "smtp")

if credential_type == "google_oauth_gmail":
    # Gmail API path
    from app.integrations.google_adapter import google_adapter
    import datetime

    access_token = cred_data.get("access_token")
    refresh_token = cred_data.get("refresh_token")
    client_id = cred_data.get("client_id")
    client_secret = cred_data.get("client_secret")
    token_expiry_str = cred_data.get("token_expiry")

    # Auto-refresh if token expired or about to expire (within 60 seconds)
    if token_expiry_str:
        token_expiry = datetime.datetime.fromisoformat(token_expiry_str)
        if datetime.datetime.utcnow() >= token_expiry - datetime.timedelta(seconds=60):
            refresh_result = await google_adapter.refresh_gmail_token(
                refresh_token=refresh_token,
                client_id=client_id,
                client_secret=client_secret
            )
            access_token = refresh_result["access_token"]
            # Update credential in database with new token + expiry
            new_expiry = (
                datetime.datetime.utcnow() +
                datetime.timedelta(seconds=refresh_result.get("expires_in", 3599))
            ).isoformat()
            cred_data["access_token"] = access_token
            cred_data["token_expiry"] = new_expiry
            credential_service.update_encrypted_data(db, credential, cred_data)

    # Send via Gmail API
    result = await google_adapter.send_gmail(
        access_token=access_token,
        to=to_addr,
        subject=subject,
        body=body,
        body_type=body_type,
        cc=cc_addr or None,
        bcc=bcc_addr or None,
        reply_to=reply_to or None
    )

    if not result["success"]:
        return {
            "output": None,
            "success": False,
            "error": result["error"],
            "metadata": {"node_id": self.node_id}
        }

    return {
        "output": "Email sent via Gmail successfully",
        "success": True,
        "error": None,
        "metadata": {
            "to": to_addr,
            "subject": subject,
            "message_id": result.get("message_id"),
            "provider": "gmail_api"
        }
    }

# ELSE: existing SMTP path continues below (lines 132–157) unchanged
```

---

### File 3: `src/app/api/v1/routes/auth.py` (or a new `src/app/api/v1/routes/google_oauth.py`)

**Purpose:** OAuth2 callback route to handle Google authorization code → store tokens as credential.

**New endpoints:**

```
GET /auth/google/gmail/authorize
  - Returns the Google OAuth authorization URL for Gmail scope
  - Frontend redirects user to this URL
  - URL includes: client_id, redirect_uri, scope=gmail.send+userinfo.email, access_type=offline, prompt=consent

GET /auth/google/gmail/callback?code=xxx&state=workspace_id
  - Called by Google after user authorizes
  - Exchanges authorization code → access_token + refresh_token
  - Creates/updates a Credential record with type="google_oauth_gmail"
  - Returns credential_id to frontend
  - Frontend stores credential_id for use in Email node config
```

**Token exchange:**
```
POST https://oauth2.googleapis.com/token
Body: {
    code: <authorization_code>,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: https://your-domain.com/api/v1/auth/google/gmail/callback,
    grant_type: authorization_code
}
Response: {
    access_token: "ya29...",
    refresh_token: "1//...",    # Only returned on first authorization (prompt=consent)
    expires_in: 3599,
    token_type: "Bearer"
}
```

---

## 7. Credential Type Documentation

The existing credential system in `src/app/models/credential.py` and `src/app/services/credential_service.py` stores any JSON data encrypted. The new `google_oauth_gmail` credential type uses the same mechanism.

**Credential type string:** `"google_oauth_gmail"`

**Frontend display name:** "Gmail (OAuth)"

**Fields shown in Credentials UI:**
- This credential type is NOT manually configured by users
- It is created automatically via the OAuth flow (`/auth/google/gmail/authorize`)
- Frontend shows "Connect Gmail" button instead of a form

---

## 8. Email Node Config (Updated)

The email node config remains the same — only the credential changes:

```json
{
    "credential_id": "uuid-of-gmail-oauth-credential",
    "to": "customer@example.com",
    "subject": "Your inquiry - {{topic}}",
    "body": "<p>Hello {{user_name}},</p><p>Thanks for reaching out.</p>",
    "body_type": "html",
    "cc": "",
    "bcc": "",
    "reply_to": ""
}
```

When a user selects a Gmail credential in the Email node config panel, the node automatically uses the Gmail API path instead of SMTP.

---

## 9. Verification Steps

1. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
2. Enable Gmail API in Google Cloud Console
3. Add authorized redirect URI to OAuth client
4. Call `GET /api/v1/auth/google/gmail/authorize` from frontend → redirects to Google
5. User authorizes → redirected to `/api/v1/auth/google/gmail/callback`
6. Check that a `Credential` record with `type=google_oauth_gmail` is created in database
7. Create a chatflow with Email node, select the Gmail credential
8. Run chatflow → verify email arrives in recipient inbox
9. Check email sender shows the Gmail account that authorized
10. Test token refresh: manually set `token_expiry` to past time → verify auto-refresh on next send

---

## 10. Scope Boundary

**In scope (MOU requirement):**
- Send emails from chatflows using a connected Gmail account

**Out of scope (not in MOU):**
- Reading incoming Gmail messages
- Gmail as a chatflow trigger (receive email → trigger bot)
- Gmail inbox sync
- Attachments
- Sending from Google Workspace domain emails (works the same way — just different Gmail account)
