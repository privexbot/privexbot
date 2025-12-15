# API Reference

PrivexBot provides a comprehensive REST API for managing chatbots, knowledge bases, and integrations.

## Base URL

```
Development:  http://localhost:8000/api/v1
Production:   https://api.privexbot.com/api/v1
```

## Authentication

All API requests (except public endpoints) require authentication via JWT token.

### Get Access Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

### Using the Token

```http
GET /chatbots
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

---

## Core Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "username": "johndoe"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

#### Wallet Authentication (MetaMask, Phantom, Keplr)
```http
GET /auth/{provider}/challenge?address={wallet_address}
POST /auth/{provider}/verify
```

### Organizations

#### List Organizations
```http
GET /organizations
Authorization: Bearer {token}
```

#### Create Organization
```http
POST /organizations
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Acme Corp",
  "slug": "acme-corp"
}
```

#### Get Organization
```http
GET /organizations/{org_id}
Authorization: Bearer {token}
```

### Workspaces

#### List Workspaces
```http
GET /organizations/{org_id}/workspaces
Authorization: Bearer {token}
```

#### Create Workspace
```http
POST /organizations/{org_id}/workspaces
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production",
  "description": "Production environment"
}
```

### Chatbots

#### Create Draft Chatbot
```http
POST /chatbots/draft
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Support Bot",
  "description": "Customer support chatbot",
  "workspace_id": "uuid"
}
```

#### Update Draft
```http
PUT /chatbots/draft/{draft_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "system_prompt": "You are a helpful assistant...",
  "llm_config": {
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 1000
  }
}
```

#### Deploy Chatbot
```http
POST /chatbots/draft/{draft_id}/deploy
Authorization: Bearer {token}
Content-Type: application/json

{
  "channels": ["website", "telegram", "discord"]
}
```

#### List Chatbots
```http
GET /chatbots?workspace_id={workspace_id}
Authorization: Bearer {token}
```

#### Get Chatbot
```http
GET /chatbots/{chatbot_id}
Authorization: Bearer {token}
```

#### Delete Chatbot
```http
DELETE /chatbots/{chatbot_id}
Authorization: Bearer {token}
```

### Chatflows

#### Create Draft Chatflow
```http
POST /chatflows/draft
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Lead Qualifier",
  "description": "Qualify leads with multi-step flow",
  "workspace_id": "uuid"
}
```

#### Update Chatflow Nodes
```http
PUT /chatflows/draft/{draft_id}/nodes
Authorization: Bearer {token}
Content-Type: application/json

{
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "data": {}
    },
    {
      "id": "llm-1",
      "type": "llm",
      "data": {
        "model": "gpt-4",
        "prompt": "Greet the user"
      }
    }
  ],
  "edges": [
    {
      "source": "start",
      "target": "llm-1"
    }
  ]
}
```

### Knowledge Bases

#### Create Draft KB
```http
POST /knowledge-bases/draft
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Product Documentation",
  "description": "All product docs",
  "workspace_id": "uuid",
  "chunk_config": {
    "strategy": "size-based",
    "chunk_size": 500,
    "chunk_overlap": 50
  }
}
```

#### Add Source to Draft
```http
POST /knowledge-bases/draft/{draft_id}/sources
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: (binary)
source_type: upload
```

#### Preview Chunks
```http
GET /knowledge-bases/draft/{draft_id}/preview-chunks
Authorization: Bearer {token}
```

#### Finalize KB
```http
POST /knowledge-bases/draft/{draft_id}/finalize
Authorization: Bearer {token}
```

#### List Knowledge Bases
```http
GET /knowledge-bases?workspace_id={workspace_id}
Authorization: Bearer {token}
```

### Documents

#### Upload Document
```http
POST /documents
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: (binary)
knowledge_base_id: uuid
```

#### Get Document Status
```http
GET /documents/{document_id}
Authorization: Bearer {token}
```

### Leads

#### List Leads
```http
GET /leads?workspace_id={workspace_id}
Authorization: Bearer {token}
```

#### Get Lead Analytics
```http
GET /leads/analytics?workspace_id={workspace_id}&start_date=2024-01-01&end_date=2024-12-31
Authorization: Bearer {token}
```

---

## Public API (No Auth Required)

### Chat with Bot
```http
POST /public/bots/{bot_id}/chat
Content-Type: application/json

{
  "message": "Hello, how can you help me?",
  "session_id": "user-session-123",
  "metadata": {
    "ip_address": "1.2.3.4",
    "user_agent": "Mozilla/5.0..."
  }
}
```

**Response:**
```json
{
  "response": "Hello! I can help you with...",
  "sources": [
    {
      "content": "Relevant chunk from KB",
      "document_id": "uuid",
      "score": 0.95
    }
  ],
  "session_id": "user-session-123"
}
```

### Submit Lead
```http
POST /public/bots/{bot_id}/leads
Content-Type: application/json

{
  "session_id": "user-session-123",
  "email": "customer@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "custom_fields": {
    "company": "Acme Inc"
  }
}
```

### Get Widget Config
```http
GET /public/bots/{bot_id}/widget/config
```

**Response:**
```json
{
  "bot_id": "uuid",
  "bot_name": "Support Bot",
  "widget_config": {
    "position": "bottom-right",
    "color": "#6366f1",
    "greeting": "Hi! How can I help?",
    "show_branding": true
  },
  "lead_config": {
    "enabled": true,
    "timing": "after_messages",
    "message_count": 3,
    "fields": [...]
  }
}
```

---

## Webhooks

### Telegram
```http
POST /webhooks/telegram/{bot_id}
```

### Discord
```http
POST /webhooks/discord/{bot_id}
```

### WhatsApp
```http
POST /webhooks/whatsapp/{bot_id}
```

---

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  }
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Rate Limiting

**Limits:**
- Authenticated: 1000 requests/hour
- Public API: 100 requests/hour per IP
- Widget chat: 50 messages/hour per session

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

---

## Pagination

List endpoints support pagination:

```http
GET /chatbots?page=1&per_page=20
```

**Response:**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "per_page": 20,
  "pages": 8
}
```

---

## Interactive API Documentation

**Swagger UI:** http://localhost:8000/docs
**ReDoc:** http://localhost:8000/redoc

---

For detailed technical documentation, see:
- [Architecture Overview](./ARCHITECTURE.md)
- [Getting Started](./GETTING_STARTED.md)
- [Deployment Guide](./DEPLOYMENT.md)
