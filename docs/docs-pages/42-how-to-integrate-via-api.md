# Direct API Integration Guide

Integrate PrivexBot chatbots directly into your applications using the REST API. This guide covers authentication, endpoints, and code examples for building custom integrations.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Chat Endpoint](#chat-endpoint)
4. [Code Examples](#code-examples)
5. [Session Best Practices](#session-best-practices)
6. [Handling Responses](#handling-responses)
7. [Rate Limiting](#rate-limiting)
8. [Feedback Endpoint](#feedback-endpoint)
9. [Lead Capture Endpoint](#lead-capture-endpoint)
10. [Event Tracking](#event-tracking)
11. [Integration Patterns](#integration-patterns)
12. [Troubleshooting](#troubleshooting)

---

## API Overview

The PrivexBot API lets you integrate AI chatbots into any application.

### Base URL

```
Production: https://api.privexbot.com/v1
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Unified Endpoint** | Same API for chatbots and chatflows |
| **Session Management** | Built-in conversation context |
| **RAG Sources** | Knowledge base citations in responses |
| **Feedback Collection** | User satisfaction tracking |
| **Lead Capture** | Programmatic lead submission |

### Access Methods

| Method | URL Pattern | Auth Required |
|--------|-------------|---------------|
| **By UUID** | `/bots/{bot_id}/chat` | Based on visibility |
| **By Slug** | `/bots/{slug}/chat` | Based on visibility |

---

## Authentication

### Public vs Private Bots

| Visibility | Authentication | Use Case |
|------------|---------------|----------|
| **Public** | None required | Open support bots |
| **Private** | API key required | Internal tools, apps |

### API Key Authentication

For private bots, include your API key in the header:

```
X-API-Key: pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Getting an API Key

1. Go to **Chatbots** → Select your bot
2. Navigate to **Settings** → **API Keys**
3. Click **+ Create API Key**
4. Name it (e.g., "Production App")
5. Copy the key immediately (shown only once)

### Security Best Practices

| Do | Don't |
|----|-------|
| Store in environment variables | Hardcode in source code |
| Use server-side only | Expose in client JavaScript |
| Rotate periodically | Share across applications |
| Use one key per integration | Use in browser |

---

## Chat Endpoint

### Request

```http
POST /v1/bots/{bot_id}/chat
Content-Type: application/json
X-API-Key: pk_live_xxx (if private)
```

### Request Body

```json
{
  "message": "How do I reset my password?",
  "session_id": "user-123-session-456",
  "variables": {
    "user_name": "John",
    "plan": "premium"
  }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | User's message |
| `session_id` | string | No | Conversation identifier |
| `variables` | object | No | Custom variables for prompts |

### Response

```json
{
  "response": "To reset your password, follow these steps:\n\n1. Go to the login page\n2. Click 'Forgot Password'\n3. Enter your email address\n4. Check your inbox for the reset link\n5. Click the link and create a new password",
  "session_id": "user-123-session-456",
  "sources": [
    {
      "title": "User Guide",
      "source": "user-guide.pdf",
      "page": 15,
      "score": 0.92,
      "chunk_id": "abc123"
    }
  ],
  "metadata": {
    "tokens_used": 245,
    "model": "secret-ai-v1",
    "latency_ms": 1234
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `response` | string | AI-generated response |
| `session_id` | string | Session for follow-ups |
| `sources` | array | Knowledge base citations |
| `metadata` | object | Usage information |

---

## Code Examples

### JavaScript/TypeScript

```javascript
// Using fetch
async function sendMessage(message, sessionId = null) {
  const response = await fetch('https://api.privexbot.com/v1/bots/my-bot/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.PRIVEXBOT_API_KEY
    },
    body: JSON.stringify({
      message: message,
      session_id: sessionId
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

// Usage
const result = await sendMessage("What are your business hours?");
console.log(result.response);
console.log("Session:", result.session_id);
```

### TypeScript with Types

```typescript
interface ChatRequest {
  message: string;
  session_id?: string;
  variables?: Record<string, string>;
}

interface Source {
  title: string;
  source: string;
  page?: number;
  score: number;
  chunk_id: string;
}

interface ChatResponse {
  response: string;
  session_id: string;
  sources: Source[];
  metadata: {
    tokens_used: number;
    model: string;
    latency_ms: number;
  };
}

async function chat(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch('https://api.privexbot.com/v1/bots/my-bot/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.PRIVEXBOT_API_KEY!
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Chat failed');
  }

  return response.json();
}
```

### Python

```python
import os
import requests
from typing import Optional, Dict, Any

class PrivexBotClient:
    def __init__(self, api_key: str, bot_id: str):
        self.api_key = api_key
        self.bot_id = bot_id
        self.base_url = "https://api.privexbot.com/v1"

    def chat(
        self,
        message: str,
        session_id: Optional[str] = None,
        variables: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send a message to the chatbot."""

        url = f"{self.base_url}/bots/{self.bot_id}/chat"

        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key
        }

        payload = {"message": message}
        if session_id:
            payload["session_id"] = session_id
        if variables:
            payload["variables"] = variables

        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()

        return response.json()

# Usage
client = PrivexBotClient(
    api_key=os.environ["PRIVEXBOT_API_KEY"],
    bot_id="my-bot"
)

result = client.chat("What are your business hours?")
print(result["response"])

# Continue conversation
result = client.chat(
    "What about weekends?",
    session_id=result["session_id"]
)
print(result["response"])
```

### cURL

```bash
# Basic request
curl -X POST https://api.privexbot.com/v1/bots/my-bot/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_live_xxx" \
  -d '{"message": "Hello, what can you help me with?"}'

# With session
curl -X POST https://api.privexbot.com/v1/bots/my-bot/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_live_xxx" \
  -d '{
    "message": "Tell me more about that",
    "session_id": "session-123"
  }'

# With variables
curl -X POST https://api.privexbot.com/v1/bots/my-bot/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_live_xxx" \
  -d '{
    "message": "What is my account status?",
    "variables": {
      "user_name": "John",
      "account_id": "A12345"
    }
  }'
```

---

## Session Best Practices

### What Sessions Do

Sessions maintain conversation context:
- Previous messages remembered
- Follow-up questions understood
- Context-aware responses

### Session ID Strategies

| Strategy | When to Use | Example |
|----------|-------------|---------|
| **User-based** | Logged-in users | `user-{user_id}` |
| **Device-based** | Anonymous users | `device-{uuid}` |
| **Conversation-based** | New chat each time | `conv-{timestamp}` |
| **Hybrid** | User + conversation | `user-123-conv-456` |

### Session Examples

```javascript
// User-based sessions (maintain history across page loads)
const sessionId = `user-${currentUser.id}`;

// Device-based sessions (anonymous users)
let sessionId = localStorage.getItem('chat_session');
if (!sessionId) {
  sessionId = `device-${crypto.randomUUID()}`;
  localStorage.setItem('chat_session', sessionId);
}

// Conversation-based (fresh start each time)
const sessionId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

### Resetting Sessions

To start a fresh conversation:

```javascript
// Simply use a new session ID
const newSessionId = `user-${userId}-conv-${Date.now()}`;
```

### Session Expiration

- Sessions expire after 24 hours of inactivity
- Expired sessions start fresh automatically
- No error thrown—just new context

---

## Handling Responses

### Response Structure

```json
{
  "response": "The answer to your question...",
  "session_id": "sess-123",
  "sources": [...],
  "metadata": {...}
}
```

### Working with Sources

Sources show where the answer came from:

```javascript
function displayResponse(result) {
  console.log(result.response);

  if (result.sources && result.sources.length > 0) {
    console.log("\nSources:");
    result.sources.forEach((source, i) => {
      console.log(`${i + 1}. ${source.title}`);
      console.log(`   File: ${source.source}`);
      if (source.page) {
        console.log(`   Page: ${source.page}`);
      }
      console.log(`   Relevance: ${(source.score * 100).toFixed(0)}%`);
    });
  }
}
```

### Error Handling

```javascript
async function safeChatRequest(message, sessionId) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({ message, session_id: sessionId })
    });

    if (!response.ok) {
      const error = await response.json();

      switch (response.status) {
        case 401:
          throw new Error('Invalid API key');
        case 403:
          throw new Error('Access denied to this bot');
        case 404:
          throw new Error('Bot not found');
        case 429:
          throw new Error('Rate limit exceeded. Try again later.');
        case 503:
          throw new Error('Bot is currently unavailable');
        default:
          throw new Error(error.detail || 'Request failed');
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
}
```

### Error Response Format

```json
{
  "detail": "Error message here",
  "error_code": "SPECIFIC_ERROR_CODE"
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `INVALID_API_KEY` | 401 | API key invalid or missing |
| `BOT_NOT_FOUND` | 404 | Bot ID/slug doesn't exist |
| `BOT_INACTIVE` | 503 | Bot is paused or archived |
| `RATE_LIMITED` | 429 | Too many requests |
| `INVALID_REQUEST` | 400 | Malformed request body |

---

## Rate Limiting

### Default Limits

| Limit | Value |
|-------|-------|
| Requests per minute | 60 |
| Requests per day | 10,000 |
| Concurrent requests | 10 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
```

### Handling Rate Limits

```javascript
async function chatWithRetry(message, sessionId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendMessage(message, sessionId);
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        // Get retry delay from header or use exponential backoff
        const retryAfter = error.headers?.get('Retry-After') || Math.pow(2, attempt);
        console.log(`Rate limited. Retrying in ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
      } else {
        throw error;
      }
    }
  }
}
```

---

## Feedback Endpoint

Collect user feedback on responses.

### Request

```http
POST /v1/bots/{bot_id}/feedback
Content-Type: application/json
```

### Request Body

```json
{
  "session_id": "sess-123",
  "message_id": "msg-456",
  "rating": "positive",
  "comment": "Very helpful answer!"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string | Yes | Session identifier |
| `message_id` | string | No | Specific message (if available) |
| `rating` | string | Yes | `positive`, `negative`, or `neutral` |
| `comment` | string | No | User's feedback text |

### Example

```javascript
async function submitFeedback(sessionId, rating, comment = null) {
  const response = await fetch(`${API_URL}/bots/${BOT_ID}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      session_id: sessionId,
      rating: rating,
      comment: comment
    })
  });

  return response.ok;
}

// Usage
await submitFeedback("sess-123", "positive", "Got exactly what I needed!");
```

---

## Lead Capture Endpoint

Submit leads programmatically.

### Request

```http
POST /v1/bots/{bot_id}/leads
Content-Type: application/json
```

### Request Body

```json
{
  "email": "john@example.com",
  "name": "John Doe",
  "phone": "+1-555-123-4567",
  "session_id": "sess-123",
  "custom_fields": {
    "company": "Acme Corp",
    "interest": "Enterprise plan"
  },
  "gdpr_consent": true
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes* | Lead's email |
| `name` | string | No | Lead's name |
| `phone` | string | No | Lead's phone |
| `session_id` | string | No | Link to conversation |
| `custom_fields` | object | No | Additional data |
| `gdpr_consent` | boolean | No | Privacy consent |

*Required fields depend on bot configuration.

### Example

```javascript
async function captureLead(leadData) {
  const response = await fetch(`${API_URL}/bots/${BOT_ID}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify(leadData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail);
  }

  return await response.json();
}

// Usage
await captureLead({
  email: "john@example.com",
  name: "John Doe",
  custom_fields: {
    source: "product_page",
    interest: "pricing"
  },
  gdpr_consent: true
});
```

---

## Event Tracking

Track custom events for analytics.

### Request

```http
POST /v1/bots/{bot_id}/events
Content-Type: application/json
```

### Request Body

```json
{
  "session_id": "sess-123",
  "event_type": "button_click",
  "event_data": {
    "button_id": "contact_sales",
    "page": "/pricing"
  }
}
```

### Common Event Types

| Event Type | Description |
|------------|-------------|
| `widget_open` | User opened chat widget |
| `widget_close` | User closed chat widget |
| `message_sent` | User sent a message |
| `link_click` | User clicked a link |
| `button_click` | User clicked a button |
| `form_submit` | User submitted a form |

---

## Integration Patterns

### Website Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>Support Chat</title>
</head>
<body>
  <div id="chat-container">
    <div id="messages"></div>
    <form id="chat-form">
      <input type="text" id="message-input" placeholder="Type your message...">
      <button type="submit">Send</button>
    </form>
  </div>

  <script>
    const API_URL = 'https://api.privexbot.com/v1/bots/my-bot/chat';
    let sessionId = localStorage.getItem('chat_session') ||
                    `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chat_session', sessionId);

    document.getElementById('chat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('message-input');
      const message = input.value.trim();
      if (!message) return;

      // Display user message
      addMessage(message, 'user');
      input.value = '';

      // Send to API
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, session_id: sessionId })
        });

        const data = await response.json();
        addMessage(data.response, 'bot');
        sessionId = data.session_id;
      } catch (error) {
        addMessage('Sorry, something went wrong.', 'error');
      }
    });

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = `message ${type}`;
      div.textContent = text;
      document.getElementById('messages').appendChild(div);
    }
  </script>
</body>
</html>
```

### Mobile App (React Native)

```javascript
// ChatService.js
class ChatService {
  constructor(apiKey, botId) {
    this.apiKey = apiKey;
    this.botId = botId;
    this.baseUrl = 'https://api.privexbot.com/v1';
    this.sessionId = null;
  }

  async sendMessage(message) {
    const response = await fetch(
      `${this.baseUrl}/bots/${this.botId}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          message,
          session_id: this.sessionId
        })
      }
    );

    const data = await response.json();
    this.sessionId = data.session_id;
    return data;
  }

  resetSession() {
    this.sessionId = null;
  }
}

// Usage in component
const chatService = new ChatService(
  'pk_live_xxx',
  'my-bot'
);

const response = await chatService.sendMessage('Hello!');
```

### Server-to-Server

```python
# Internal support tool
import os
from privexbot_client import PrivexBotClient

client = PrivexBotClient(
    api_key=os.environ["PRIVEXBOT_API_KEY"],
    bot_id="internal-support"
)

def handle_support_ticket(ticket):
    """Use chatbot to draft initial response."""

    # Get AI-suggested response
    result = client.chat(
        message=f"Customer issue: {ticket.subject}\n\n{ticket.body}",
        variables={
            "customer_name": ticket.customer_name,
            "account_tier": ticket.account_tier
        }
    )

    # Save draft response
    ticket.draft_response = result["response"]
    ticket.ai_sources = result.get("sources", [])
    ticket.save()

    return ticket
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid/missing API key | Check key, ensure in header |
| 404 Not Found | Wrong bot ID/slug | Verify bot exists, check spelling |
| 503 Unavailable | Bot paused/archived | Activate bot in dashboard |
| Empty response | No KB match | Check KB has relevant content |
| Slow response | Large KB search | Optimize KB, check server |

### Debug Checklist

1. **Verify API key**: Test with curl
2. **Check bot status**: Ensure active in dashboard
3. **Test simple message**: Rule out content issues
4. **Check session**: Try without session_id
5. **Review logs**: Check server-side errors

### Testing Your Integration

```bash
# Test basic connectivity
curl -X POST https://api.privexbot.com/v1/bots/my-bot/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"message": "test"}' \
  -w "\n\nStatus: %{http_code}\nTime: %{time_total}s\n"
```

---

## Next Steps

- **[Credentials Management](43-how-to-manage-credentials.md)**: Secure your API keys
- **[View Analytics](44-how-to-use-analytics.md)**: Monitor API usage
- **[Troubleshooting Guide](50-troubleshooting-guide.md)**: More solutions

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
