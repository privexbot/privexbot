# PrivexBot Data Privacy & Security

## Overview

PrivexBot is built on a privacy-first architecture, running entirely on **Secret VM** - a Trusted Execution Environment (TEE) that provides hardware-level isolation and encryption. This ensures user data remains private throughout the entire AI chatbot lifecycle.

## Secret VM & TEE

### What is Secret VM?

Secret VM is a confidential computing environment that uses hardware-based security features to:

1. **Encrypt data in use**: Memory encrypted during processing
2. **Isolate workloads**: Each VM completely isolated
3. **Provide attestation**: Verify the execution environment
4. **Prevent access**: Even infrastructure operators can't access data

### Architecture

```
┌──────────────────────────────────────────────────┐
│              Secret VM (TEE)                      │
│  ┌────────────────────────────────────────────┐  │
│  │         PrivexBot Application              │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐      │  │
│  │  │ Backend │ │ Frontend│ │ Widget  │      │  │
│  │  └────┬────┘ └─────────┘ └─────────┘      │  │
│  │       │                                    │  │
│  │  ┌────┴─────────────────────────────┐     │  │
│  │  │         Self-Hosted Stack        │     │  │
│  │  │ ┌────────┐ ┌─────┐ ┌──────────┐ │     │  │
│  │  │ │Postgres│ │Redis│ │  Qdrant  │ │     │  │
│  │  │ └────────┘ └─────┘ └──────────┘ │     │  │
│  │  │ ┌────────┐ ┌─────────────────┐  │     │  │
│  │  │ │ Celery │ │ Sentence-Trans  │  │     │  │
│  │  │ └────────┘ └─────────────────┘  │     │  │
│  │  └──────────────────────────────────┘     │  │
│  └────────────────────────────────────────────┘  │
│                    ↕ HTTPS                        │
│  ┌────────────────────────────────────────────┐  │
│  │              Secret AI (TEE)               │  │
│  │   Privacy-preserving inference engine      │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## Self-Hosted Components

All PrivexBot components run within Secret VM:

| Component | Purpose | Self-Hosted |
|-----------|---------|-------------|
| **PostgreSQL** | User data, chatbots, KBs | Yes |
| **Redis** | Drafts, sessions, cache | Yes |
| **Qdrant** | Vector embeddings | Yes |
| **Celery** | Background processing | Yes |
| **sentence-transformers** | Embedding generation | Yes |
| **Secret AI** | LLM inference | Yes (TEE) |

## What Data is Encrypted

### Encrypted at Rest

| Data Type | Encryption Method |
|-----------|------------------|
| API Keys | Hashed (SHA-256, never stored plaintext) |
| Credentials | Encrypted (AES-256) |
| Passwords | Hashed (bcrypt with salt) |
| OAuth Tokens | Encrypted |

### Encrypted in Transit

- All API calls use HTTPS (TLS 1.3)
- Internal service communication encrypted
- Secret AI calls encrypted end-to-end

### Encrypted in Use (TEE)

- AI inference prompts encrypted during processing
- Memory encrypted by hardware
- No plaintext accessible to operators

## What Data is NOT Encrypted

For performance reasons, general user data is stored unencrypted:

| Data Type | Reason |
|-----------|--------|
| Chatbot configurations | Need fast queries |
| Knowledge base content | Searchable/indexable |
| Chunk text | Required for retrieval |
| Conversation history | Analytics access |
| User profiles | Application logic |

**Note**: While not encrypted, this data is:
- Isolated within Secret VM TEE
- Protected by hardware isolation
- Not accessible to infrastructure operators
- Subject to strict access controls

## User Rights

### Right to Access

Users can access all their data through the dashboard:
- Chatbot configurations
- Knowledge bases and documents
- Conversation history
- Analytics and metrics

### Right to Delete (Hard Delete)

Users can permanently delete their data at any time:

```python
# Permanent deletion cascade
DELETE chatbot →
    DELETE chat_sessions →
        DELETE chat_messages
    DELETE api_keys
    DELETE deployments

DELETE knowledge_base →
    DELETE documents →
        DELETE chunks
    DELETE qdrant_collection
```

**Important**: Hard delete is:
- Immediate and permanent
- Cascades to all related data
- Removes vectors from Qdrant
- Cannot be recovered

### Data Retention

| Data Type | Retention |
|-----------|-----------|
| Active data | Until user deletes |
| Draft data | 24 hours (Redis TTL) |
| Session data | 24 hours default |
| Deleted data | Immediately purged |

## Multi-Tenant Isolation

### Workspace Isolation

All data queries filter by workspace:

```python
# Every query includes workspace filter
kbs = db.query(KnowledgeBase).filter(
    KnowledgeBase.workspace_id == current_user.workspace_id
)

chatbots = db.query(Chatbot).filter(
    Chatbot.workspace_id == current_user.workspace_id
)
```

### Organization Hierarchy

```
Organization (Company)
  └── Workspace 1 (Team A)
        ├── KBs only visible to Team A
        └── Chatbots only visible to Team A
  └── Workspace 2 (Team B)
        ├── KBs only visible to Team B
        └── Chatbots only visible to Team B
```

### Database Indexes

```sql
-- Workspace isolation indexes
CREATE INDEX ix_knowledge_bases_workspace_id ON knowledge_bases(workspace_id);
CREATE INDEX ix_documents_workspace_id ON documents(workspace_id);
CREATE INDEX ix_chatbots_workspace_id ON chatbots(workspace_id);
CREATE INDEX ix_chat_sessions_workspace_id ON chat_sessions(workspace_id);
```

## API Security

### Authentication

```bash
# Bearer token authentication
Authorization: Bearer <api_key>
```

### API Key Security

- Keys shown only once at creation
- Stored as SHA-256 hash
- Prefix visible for identification
- Usage tracked (last_used_at)
- Can be revoked instantly

### Rate Limiting

```python
rate_limiting = {
    "messages_per_minute": 10,
    "messages_per_session": 100
}
```

### Domain Restriction

Web widgets can be restricted to specific domains:

```python
"domains": ["example.com", "*.example.com"]
```

## Audit Logging

### KB Audit Logs

```python
class KBAuditLog(Base):
    kb_id: UUID
    user_id: UUID
    action: str  # kb.created, kb.updated, kb.deleted, kb.queried
    target_type: str
    event_metadata: JSONB
    ip_address: str
    user_agent: str
    created_at: datetime
```

### Tracked Actions

- Knowledge base CRUD operations
- Document additions/deletions
- Chatbot deployments
- API key operations
- User authentication events

## Compliance Considerations

### GDPR Alignment

| Requirement | Implementation |
|-------------|---------------|
| Right to access | Dashboard data access |
| Right to deletion | Hard delete available |
| Data portability | Export functionality |
| Consent | Lead capture consent flows |
| Data minimization | Only collect necessary data |

### Security Best Practices

1. **Principle of Least Privilege**: Users only access their workspace data
2. **Defense in Depth**: Multiple layers of security (TEE + encryption + access control)
3. **Audit Trail**: All sensitive operations logged
4. **Secure Defaults**: Encryption enabled by default

## Infrastructure Security

### Network Security

- All traffic encrypted (TLS 1.3)
- Internal services on private network
- External access only through API gateway
- Firewall rules restrict access

### Container Security

- Minimal base images
- Regular security updates
- Non-root containers
- Resource limits enforced

### Secret Management

```bash
# Environment variables for secrets
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_AI_API_KEY=...
```

Secrets never logged or exposed in responses.

## Data Flow Security

### Chat Message Flow

```
1. User sends message (HTTPS)
   ↓
2. Backend validates API key (hash comparison)
   ↓
3. Message saved to PostgreSQL (workspace isolated)
   ↓
4. KB retrieval via Qdrant (tenant filtered)
   ↓
5. Secret AI inference (TEE encrypted)
   ↓
6. Response saved and returned (HTTPS)
```

### KB Processing Flow

```
1. User uploads file (HTTPS)
   ↓
2. Parsed in backend (memory only)
   ↓
3. Content stored in Redis draft (24hr TTL)
   ↓
4. On finalize: PostgreSQL + Qdrant (workspace isolated)
   ↓
5. Draft deleted from Redis
```

## Summary

PrivexBot's privacy architecture provides:

1. **TEE Protection**: Hardware-level isolation via Secret VM
2. **Self-Hosted**: All components under user control
3. **Selective Encryption**: Sensitive data encrypted, general data isolated
4. **Hard Delete**: Permanent, immediate data deletion
5. **Multi-Tenant Isolation**: Strict workspace boundaries
6. **Audit Logging**: Complete operation history
7. **Secure AI**: Secret AI TEE for private inference
8. **API Security**: Hashed keys, rate limiting, domain restriction
