# Password Reset Email Configuration Guide

## Implementation Status ✅

The password reset functionality has been fully implemented with the following components:

### Backend Components
- ✅ **Email Service**: Added `send_password_reset_email()` function to `/backend/src/app/services/email_service.py`
- ✅ **Password Reset Logic**: Updated `request_password_reset()` in `/backend/src/app/auth/strategies/email.py` to send emails
- ✅ **API Endpoints**: All three endpoints are working:
  - `POST /api/v1/auth/password-reset/request` - Request reset email
  - `POST /api/v1/auth/password-reset/validate` - Validate reset token
  - `POST /api/v1/auth/password-reset/confirm` - Reset password with token

### Frontend Components
- ✅ **SignIn Page**: "Forgot Password?" dialog for requesting reset
- ✅ **Password Reset Page**: Complete reset flow at `/password-reset?token={token}`
- ✅ **API Client**: Full integration in `/frontend/src/api/auth.ts`

## Required SMTP Configuration

To enable email sending, you need to configure the SMTP settings in `/backend/.env.dev`:

### Step 1: Configure SMTP Settings

Edit `/backend/.env.dev` and update these settings:

```env
# Email (SMTP) Configuration
SMTP_HOST=smtp.gmail.com          # Your SMTP server
SMTP_PORT=587                      # SMTP port (587 for TLS, 465 for SSL)
SMTP_USER=your-email@gmail.com    # Your email address
SMTP_PASSWORD=your-app-password   # App password (NOT your regular password)
SMTP_FROM_EMAIL=noreply@privexbot.com  # From address (can be same as SMTP_USER)
SMTP_FROM_NAME=PrivexBot          # Display name in emails

# Frontend URL Configuration
FRONTEND_URL=http://localhost:5174  # Your frontend URL (already configured)
```

### Step 2: Gmail Configuration (Recommended)

If using Gmail:

1. **Enable 2-Factor Authentication**:
   - Go to your Google Account settings
   - Security → 2-Step Verification → Turn on

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Select "Other" as the device and name it "PrivexBot"
   - Copy the 16-character password
   - Use this password for `SMTP_PASSWORD` (without spaces)

3. **Example Gmail Configuration**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop  # Remove spaces: abcdefghijklmnop
SMTP_FROM_EMAIL=your.email@gmail.com
SMTP_FROM_NAME=PrivexBot
```

### Step 3: Other Email Providers

**Outlook/Office365:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

**Custom SMTP Server:**
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-password
```

## Testing the Complete Flow

### Step 1: Restart Backend Services

After updating `.env.dev`, restart the backend to load new settings:

```bash
# Stop services
docker compose -f backend/docker-compose.dev.yml down

# Start services
docker compose -f backend/docker-compose.dev.yml up -d
```

### Step 2: Test Password Reset Flow

1. **Request Password Reset**:
   - Go to http://localhost:5174/signin
   - Click "Forgot Password?"
   - Enter your email address
   - Click "Send reset link"

2. **Check Email**:
   - You should receive an email with subject: "Reset your PrivexBot password"
   - The email contains a button and link to reset password
   - Link format: `http://localhost:5174/password-reset?token=...`

3. **Reset Password**:
   - Click the link in the email
   - Enter new password (min 8 characters)
   - Confirm password
   - Click "Reset Password"

4. **Login with New Password**:
   - After successful reset, you'll be redirected to login
   - Use your new password to login

### Step 3: Manual Testing (Without SMTP)

If SMTP is not configured, the system will log the email content. To test:

1. **Request Reset**:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/password-reset/request" \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

2. **Check Logs for Reset Link**:
```bash
docker compose -f backend/docker-compose.dev.yml logs backend-dev | grep "password_reset"
```

3. **Get Token from Redis**:
```bash
docker compose -f backend/docker-compose.dev.yml exec redis redis-cli keys "*password_reset*"
```

4. **Manually Construct URL**:
```
http://localhost:5174/password-reset?token=YOUR_TOKEN_HERE
```

## Security Features

- ✅ **Secure Token Generation**: 32-byte cryptographically secure tokens
- ✅ **Token Expiration**: 1-hour TTL stored in Redis
- ✅ **One-Time Use**: Tokens are deleted after successful use
- ✅ **No User Enumeration**: Always returns success even if email doesn't exist
- ✅ **Password Strength**: Frontend validation with visual indicators
- ✅ **bcrypt Hashing**: Secure password storage

## Troubleshooting

### Email Not Sending

1. **Check Backend Logs**:
```bash
docker compose -f backend/docker-compose.dev.yml logs -f backend-dev
```

2. **Common Issues**:
   - **Wrong SMTP credentials**: Verify username and password
   - **2FA not enabled**: Gmail requires 2FA for app passwords
   - **Port blocked**: Some networks block port 587/465
   - **Less secure apps**: Ensure using app password, not regular password

### Token Invalid/Expired

- Tokens expire after 1 hour
- Tokens can only be used once
- Check Redis for token existence:
```bash
docker compose -f backend/docker-compose.dev.yml exec redis redis-cli ttl "password_reset:YOUR_TOKEN"
```

### Frontend Not Loading

- Ensure frontend is running on port 5174
- Check FRONTEND_URL in `.env.dev` matches your frontend URL
- Clear browser cache if having issues

## Production Considerations

1. **Use Production SMTP Service**: Consider SendGrid, AWS SES, or Mailgun
2. **Update FRONTEND_URL**: Set to your production domain
3. **Secure Redis**: Use password-protected Redis
4. **Rate Limiting**: Implement rate limiting on reset requests
5. **Email Templates**: Consider using HTML email templates service
6. **Monitoring**: Add logging and monitoring for failed emails

## API Documentation

### Request Password Reset
```http
POST /api/v1/auth/password-reset/request
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: 200 OK
{
  "message": "Password reset email sent successfully"
}
```

### Validate Reset Token
```http
POST /api/v1/auth/password-reset/validate
Content-Type: application/json

{
  "token": "abc123..."
}

Response: 200 OK
{
  "message": "Reset token is valid"
}
```

### Confirm Password Reset
```http
POST /api/v1/auth/password-reset/confirm
Content-Type: application/json

{
  "token": "abc123...",
  "new_password": "NewSecurePassword123!"
}

Response: 200 OK
{
  "message": "Password reset successfully"
}
```

## Summary

The password reset feature is fully implemented and ready to use. You just need to:

1. **Configure SMTP settings** in `/backend/.env.dev` with your email credentials
2. **Restart the backend** to load the new settings
3. **Test the flow** from the frontend

The system will work immediately once you add your SMTP credentials. Without SMTP configured, the backend will log the reset emails but won't actually send them - useful for development testing.