# Troubleshooting Guide

This comprehensive guide helps you diagnose and resolve common issues with PrivexBot. Find solutions organized by feature area.

---

## Table of Contents

1. [Common Issues by Feature](#common-issues-by-feature)
2. [Chatbot Issues](#chatbot-issues)
3. [Knowledge Base Issues](#knowledge-base-issues)
4. [Widget Issues](#widget-issues)
5. [Channel Issues](#channel-issues)
6. [Authentication Issues](#authentication-issues)
7. [Permission Issues](#permission-issues)
8. [API Issues](#api-issues)
9. [Getting Help](#getting-help)

---

## Common Issues by Feature

Quick navigation to common problems:

| Problem | Jump To |
|---------|---------|
| Bot not responding | [Chatbot Issues](#chatbot-issues) |
| KB processing stuck | [Knowledge Base Issues](#knowledge-base-issues) |
| Widget not appearing | [Widget Issues](#widget-issues) |
| Telegram bot offline | [Channel Issues](#channel-issues) |
| Can't log in | [Authentication Issues](#authentication-issues) |
| "Access denied" | [Permission Issues](#permission-issues) |
| API 401 errors | [API Issues](#api-issues) |

---

## Chatbot Issues

### Chatbot Not Responding

**Symptoms**: Messages sent but no reply

**Diagnostic Checklist:**

```
Step 1: Check chatbot status
├── Is the chatbot deployed? (not draft)
├── Is the chatbot active? (not paused/archived)
└── Is the channel enabled?

Step 2: Check channel
├── Widget: Is script loaded?
├── Telegram: Is webhook registered?
├── Discord: Is bot online in server?
└── API: Is endpoint correct?

Step 3: Check credentials
├── API key valid? (for private bots)
├── Channel credentials valid?
└── Credentials not expired?

Step 4: Check server
├── PrivexBot server running?
├── AI service available?
└── Database connected?
```

**Solutions by Cause:**

| Cause | Solution |
|-------|----------|
| Chatbot is draft | Deploy the chatbot |
| Chatbot is paused | Resume in settings |
| Invalid API key | Generate new key |
| Webhook not registered | Redeploy channel |
| Server issue | Check status page, contact support |

### Wrong or Irrelevant Responses

**Symptoms**: Bot responds but answers are off-topic

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Completely off-topic | Wrong KB or no KB | Check KB connection |
| Partially relevant | Poor KB quality | Improve content, reindex |
| Hallucinating facts | Temperature too high | Lower to 0.1-0.3 |
| Too generic | KB score threshold too high | Lower to 0.6-0.7 |
| Wrong personality | Prompt issues | Review system prompt |

### Response Too Slow

**Symptoms**: Long delay before responses

| Cause | Typical Delay | Solution |
|-------|---------------|----------|
| Large KB search | 2-5s | Reduce chunk count, optimize |
| Complex chatflow | 3-10s | Simplify flow, reduce nodes |
| External API calls | Variable | Add timeouts, caching |
| AI model latency | 1-3s | Expected, consider faster model |
| Cold start | First request only | Warm up with test message |

### Rate Limit Errors

**Symptoms**: "Too many requests" errors

```
Error: 429 Too Many Requests
```

**Solutions:**

1. **Check usage**: Review Analytics for message volume
2. **Implement client-side limiting**: Debounce rapid requests
3. **Upgrade plan**: Higher tiers have higher limits
4. **Contact support**: For temporary limit increase

---

## Knowledge Base Issues

### Processing Stuck

**Symptoms**: KB shows "Processing" for extended time

**Normal Processing Times:**

| Content Size | Expected Time |
|--------------|---------------|
| <100 pages | 1-5 minutes |
| 100-500 pages | 5-15 minutes |
| 500-1000 pages | 15-30 minutes |
| >1000 pages | 30+ minutes |

**If Processing Exceeds Expected Time:**

1. **Check Pipeline tab** for last activity
2. **Look for error messages** in logs
3. **Cancel and retry** if truly stuck
4. **Contact support** if persistent

### Pipeline Failed

**Symptoms**: Red "Failed" status

**Common Errors and Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Could not parse file" | Corrupted/unsupported file | Convert format, re-upload |
| "Embedding failed" | AI service issue | Wait and retry |
| "Rate limit exceeded" | Too many requests | Wait 15 min, retry |
| "Out of memory" | File too large | Split into smaller files |
| "Invalid encoding" | Non-UTF8 text | Convert to UTF-8 |
| "Connection refused" | Qdrant unavailable | Check infrastructure |

### Poor Search Results

**Symptoms**: Relevant content not returned

**Diagnostic Steps:**

```
1. Verify content exists
   └── Search KB directly in Test tab

2. Check chunking settings
   ├── Too small: Context lost
   └── Too large: Irrelevant matches

3. Try different strategies
   ├── hybrid_search (recommended)
   ├── semantic (conceptual)
   └── keyword (exact matches)

4. Review score threshold
   └── Lower if results missing (try 0.5)
```

**Optimization Tips:**

| Issue | Solution |
|-------|----------|
| Content missing | Add more relevant documents |
| Context fragmented | Increase chunk size |
| Too much noise | Increase score threshold |
| Synonyms not matching | Use hybrid search |

### Cannot Add Documents

**Symptoms**: Upload fails or rejected

| Error | Cause | Solution |
|-------|-------|----------|
| "File too large" | Exceeds 50MB | Split into smaller files |
| "Unsupported format" | Unknown file type | Convert to supported format |
| "Storage limit" | Plan limit reached | Upgrade or delete old content |
| "Processing queue full" | System busy | Wait and retry |

---

## Widget Issues

### Widget Not Appearing

**Symptoms**: No chat bubble on page

**Checklist:**

```
1. Script loaded correctly?
   └── Check browser Network tab for widget.js

2. Initialization called?
   └── Check browser Console for errors

3. Bot ID correct?
   └── Verify against dashboard

4. API key included? (for private bots)
   └── Check initialization code

5. CSS conflicts?
   └── Check z-index, display properties
```

**Common Script Errors:**

```javascript
// Error: privexbot is not defined
// Solution: Script not loaded, check URL

// Error: Invalid botId
// Solution: Check bot ID from dashboard

// Error: Unauthorized
// Solution: Add API key for private bots
```

### CORS Errors

**Symptoms**: Console shows CORS policy errors

```
Access to fetch at 'https://api.privexbot.com' from origin
'https://yoursite.com' has been blocked by CORS policy
```

**Solutions:**

1. **Check domain allowlist**: Add your domain in chatbot settings
2. **Use HTTPS**: HTTP origins may be blocked
3. **Check URL format**: Trailing slashes matter
4. **Clear cache**: Old CORS policies may be cached

### Session Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| History lost on refresh | localStorage disabled | Enable localStorage |
| Wrong conversation | Multiple bots | Use unique botIds |
| Session not starting | Network error | Check API connectivity |
| Can't reset session | Code error | Call `privexbot('reset')` |

### Styling Problems

| Problem | Solution |
|---------|----------|
| Wrong colors | Clear cache, check config |
| Fonts don't match | Override CSS variables |
| Position wrong | Check `position` config |
| Overlaps content | Adjust `offsetX/Y` |
| Too small/large | Set explicit `width/height` |

---

## Channel Issues

### Telegram Bot Not Responding

**Checklist:**

| Check | How | Solution |
|-------|-----|----------|
| Bot token valid | Test with BotFather | Regenerate token |
| Webhook registered | Check deployment status | Redeploy |
| Server accessible | Must be public HTTPS | Fix DNS/firewall |
| Channel active | Dashboard status | Activate channel |

**Webhook Debug:**

```bash
# Check webhook status via Telegram API
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### Discord Bot Offline

**Common Issues:**

| Problem | Solution |
|---------|----------|
| Bot offline in server | Check PrivexBot server status |
| Commands not appearing | Wait for propagation (1hr) or reinvite |
| "Missing permissions" | Check bot role permissions |
| "Missing intents" | Enable MESSAGE CONTENT in Dev Portal |
| Guild not in list | Re-add bot with correct scopes |

### WhatsApp Not Receiving

**Debug Steps:**

1. **Check webhook configuration** in Meta portal
2. **Verify token** hasn't expired (generate permanent)
3. **Test with Meta's test tool** in developer portal
4. **Check phone number status** - must be verified

**Common WhatsApp Errors:**

| Error | Solution |
|-------|----------|
| "Webhook not verified" | Check callback URL and verify token |
| "Outside messaging window" | Use template message |
| "Token expired" | Generate new permanent token |

---

## Authentication Issues

### Can't Log In

| Problem | Solution |
|---------|----------|
| "Invalid credentials" | Check email/password spelling |
| "Account not found" | Try different auth method |
| Wallet not connecting | Refresh page, check extension |
| "Session expired" | Log in again |

### Password Reset Issues

| Problem | Solution |
|---------|----------|
| No email received | Check spam folder |
| Link expired | Request new reset (valid 1hr) |
| Link not working | Copy full URL manually |
| Wrong email | Try other registered emails |

### Wallet Connection Issues

| Problem | Solution |
|---------|----------|
| Extension not detected | Install wallet extension |
| Popup blocked | Allow popups for site |
| Wrong network | Any network works for signing |
| Signature failed | Refresh and retry |

---

## Permission Issues

### "Access Denied" Errors

**Diagnostic:**

```
What are you trying to do?
├── View resource → Need at least Viewer role
├── Edit resource → Need Editor or Admin role
├── Manage credentials → Need Workspace Admin
├── Create workspace → Need Org Admin
└── Manage billing → Need Org Owner
```

**Check Your Access:**

1. Go to the **workspace/org settings**
2. View **Members** section
3. Find your role
4. Compare with required permission

### Missing Features

| Missing Feature | Required Role |
|-----------------|---------------|
| Create chatbot | Editor+ |
| Manage credentials | Workspace Admin |
| Create workspace | Org Admin |
| Billing settings | Org Owner |
| Delete organization | Org Owner |

### Wrong Organization/Workspace

**Symptoms**: Can't find expected resources

**Solution**: Check the organization/workspace selector in the top-left. Make sure you're in the correct context.

---

## API Issues

### 401 Unauthorized

**Symptoms**: `{"detail": "Unauthorized"}`

| Cause | Solution |
|-------|----------|
| Missing API key | Add `X-API-Key` header |
| Invalid API key | Check key in dashboard |
| Key revoked | Generate new key |
| Wrong bot ID | Verify bot ID |

### 403 Forbidden

**Symptoms**: `{"detail": "Forbidden"}`

| Cause | Solution |
|-------|----------|
| Bot is private | Include valid API key |
| Key for wrong bot | Check key belongs to this bot |
| IP blocklist | Contact support |

### 404 Not Found

**Symptoms**: `{"detail": "Not found"}`

| Cause | Solution |
|-------|----------|
| Wrong bot ID/slug | Verify in dashboard |
| Bot deleted | Check bot status |
| Wrong endpoint | Check API documentation |

### 429 Rate Limited

**Symptoms**: `{"detail": "Too many requests"}`

**Headers to Check:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067200
```

**Solutions:**

1. Wait for reset (check `X-RateLimit-Reset`)
2. Implement exponential backoff
3. Reduce request frequency
4. Upgrade plan for higher limits

### 500 Server Error

**Symptoms**: `{"detail": "Internal server error"}`

| Cause | Solution |
|-------|----------|
| Server bug | Report to support |
| Temporary issue | Retry with backoff |
| Configuration error | Check chatbot setup |

---

## Getting Help

### Self-Service Resources

| Resource | URL |
|----------|-----|
| Documentation | docs.privexbot.com |
| Status Page | status.privexbot.com |
| Community Forum | community.privexbot.com |
| FAQ | privexbot.com/faq |

### Reporting Issues

When contacting support, include:

```
Issue Report Template
─────────────────────

1. What were you trying to do?
   [Your action]

2. What happened instead?
   [Actual result]

3. Error messages (exact text):
   [Copy/paste errors]

4. Steps to reproduce:
   1. [Step 1]
   2. [Step 2]
   3. [etc.]

5. Environment:
   - Browser: [Chrome/Firefox/Safari]
   - OS: [Windows/Mac/Linux]
   - Account email: [your@email.com]
   - Bot ID: [if applicable]

6. Screenshots:
   [Attach if helpful]
```

### Support Channels

| Channel | Response Time | Best For |
|---------|---------------|----------|
| Documentation | Immediate | Self-service |
| Community Forum | Hours | General questions |
| Email Support | 24-48h (Starter+) | Account issues |
| Priority Support | 24h (Pro) | Technical issues |
| Dedicated Support | Custom (Enterprise) | Complex issues |

### Emergency Contacts

For critical production issues:
- **Email**: urgent@privexbot.com
- **Status Updates**: status.privexbot.com

---

## Quick Reference

### Error Code Summary

| Code | Meaning | First Step |
|------|---------|------------|
| 400 | Bad request | Check request format |
| 401 | Unauthorized | Check API key |
| 403 | Forbidden | Check permissions |
| 404 | Not found | Check resource ID |
| 429 | Rate limited | Wait and retry |
| 500 | Server error | Report to support |
| 503 | Unavailable | Check status page |

### Health Check Endpoints

```bash
# API health
curl https://api.privexbot.com/health

# Bot availability
curl https://api.privexbot.com/v1/bots/{bot_id}/status
```

### Debug Mode

For detailed error info, check:
1. Browser Console (F12)
2. Network tab for API responses
3. Server logs (if self-hosted)

---

*Still stuck? Contact privexbot@gmail.com with details from the Issue Report Template above.*
