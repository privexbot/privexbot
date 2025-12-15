"""
API Key model - Public API access for deployed chatbots, chatflows, and knowledge bases.

WHY:
- Platform feature: Users deploy bots and call them from anywhere
- API-first architecture: Every entity (chatbot/chatflow/KB) has public API
- Secure access control with key-based authentication
- Usage tracking and rate limiting

HOW:
- Each workspace/resource can have multiple API keys
- Keys are scoped to specific resource types (chatbot, chatflow, KB, or all)
- Includes rate limiting, expiration, and usage tracking
- Keys are hashed for security (only shown once on creation)

KEY DESIGN PRINCIPLE:
- API keys enable platform deployment model
- Users create bots → deploy them → call via API anywhere
- Fine-grained permissions per key (read-only, write, admin)

PSEUDOCODE:
-----------
class APIKey(Base):
    __tablename__ = "api_keys"

    # Identity
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier for this API key

    name: str (required, max_length=100)
        WHY: Human-readable name for the key
        EXAMPLE: "Production Chatbot API", "Development KB Access"
        USE: Helps users identify keys in dashboard

    key_hash: str (required, indexed, unique)
        WHY: Store hashed version of API key for security
        HOW: SHA256 hash of actual key
        SECURITY: Never store plain key in database
        NOTE: Plain key only shown once on creation

    key_prefix: str (required, max_length=10)
        WHY: Show first 8 chars for identification
        EXAMPLE: "sk_live_abc123..."
        USE: Users can identify keys without seeing full value

    # Scope and Access Control
    workspace_id: UUID (foreign key -> workspaces.id, indexed, cascade delete)
        WHY: Keys belong to workspace for tenant isolation
        HOW: Cannot access resources from other workspaces
        SECURITY: Enforces multi-tenancy

    scope_type: str (enum, required)
        WHY: Control what this key can access
        VALUES:
            - "workspace": Access all resources in workspace
            - "chatbot": Access specific chatbot only
            - "chatflow": Access specific chatflow only
            - "knowledge_base": Access specific KB only
            - "public": Limited read-only access for embedded widgets

    scope_resource_id: UUID | None
        WHY: Specific resource ID if scope is chatbot/chatflow/KB
        EXAMPLE: If scope_type="chatbot", this is chatbot_id
        NULL: If scope_type="workspace" (access all resources)

    permissions: list[str] (array, default: ["read"])
        WHY: Fine-grained access control
        VALUES:
            - "read": Query/use the resource
            - "write": Create/update data (e.g., add documents to KB)
            - "admin": Delete resources
            - "execute": Run chatbot/chatflow queries
            - "train": Update KB embeddings

        EXAMPLES:
            ["read", "execute"] → Can query chatbot, no modifications
            ["read", "write", "execute"] → Can query and update
            ["admin"] → Full access including delete

    # Rate Limiting and Quotas
    rate_limit_config: JSONB
        WHY: Prevent abuse and control costs
        HOW: Token bucket or sliding window algorithm

        STRUCTURE:
        {
            "requests_per_minute": 60,
            "requests_per_hour": 1000,
            "requests_per_day": 10000,
            "tokens_per_month": 1000000,  # For LLM token tracking
            "burst_limit": 100  # Allow temporary bursts
        }

    usage_stats: JSONB (default: {})
        WHY: Track actual usage for billing and monitoring

        STRUCTURE:
        {
            "total_requests": 12450,
            "successful_requests": 12200,
            "failed_requests": 250,
            "total_tokens_used": 450000,
            "last_used_at": "2024-01-15T10:30:00Z",
            "current_month_requests": 1500,
            "current_month_tokens": 75000
        }

    # Lifecycle Management
    is_active: bool (default: True)
        WHY: Enable/disable without deleting
        HOW: Disabled keys return 401 Unauthorized
        USE: Temporary suspension or incident response

    expires_at: datetime | None
        WHY: Auto-expiring keys for security
        EXAMPLE: "2025-12-31T23:59:59Z"
        NULL: No expiration (permanent key)

    last_used_at: datetime | None
        WHY: Track when key was last used
        HOW: Updated on each API call
        USE: Identify unused keys for cleanup

    last_used_ip: str | None
        WHY: Security monitoring
        EXAMPLE: "192.168.1.1"
        USE: Detect suspicious access patterns

    # Metadata
    created_by: UUID (foreign key -> users.id)
        WHY: Audit trail - who created this key
        HOW: Set to current user's ID on creation

    created_at: datetime (auto-set)
    updated_at: datetime (auto-update)
    revoked_at: datetime | None
        WHY: Track when key was revoked (different from deleted)
        USE: Audit and compliance

    revoked_by: UUID | None (foreign key -> users.id)
        WHY: Who revoked this key

    revoke_reason: text | None
        WHY: Explain why key was revoked
        EXAMPLE: "Security incident", "Key leaked", "No longer needed"

    # Relationships
    workspace: Workspace (many-to-one)
        WHY: Access parent workspace and org
        HOW: apikey.workspace.organization.name

    creator: User (many-to-one)
        WHY: Reference to creator

    revoker: User (many-to-one)
        WHY: Reference to user who revoked

    # Indexes
    index: (key_hash)
        WHY: Fast authentication lookup
        NOTE: Unique index

    index: (workspace_id, scope_type, is_active)
        WHY: Fast queries for active keys by scope

    index: (expires_at)
        WHY: Cleanup expired keys

    index: (last_used_at)
        WHY: Identify stale keys

API KEY FORMAT:
---------------
WHY: User-friendly and secure format
HOW: Prefix + environment + random bytes

FORMAT: {prefix}_{env}_{random}
    prefix: "sk" (secret key) or "pk" (public key)
    env: "live" | "test"
    random: 32 random bytes (base64 encoded)

EXAMPLES:
    sk_live_abc123def456ghi789jkl012mno345
    pk_test_xyz789abc123def456ghi789jkl012
    sk_live_qrs123tuv456wxy789zab012cde345

WHY THIS FORMAT:
    - Prefix identifies key type at a glance
    - Environment prevents accidental use of test keys in production
    - Random bytes ensure uniqueness and security

KEY GENERATION PROCESS:
-----------------------
function create_api_key(workspace_id, scope_type, scope_resource_id, permissions):
    1. Generate random bytes:
        random_part = secrets.token_urlsafe(32)

    2. Create key with format:
        if workspace.environment == "production":
            env = "live"
        else:
            env = "test"

        if "admin" in permissions or "write" in permissions:
            prefix = "sk"  # Secret key
        else:
            prefix = "pk"  # Public key (read-only)

        plain_key = f"{prefix}_{env}_{random_part}"

    3. Hash for storage:
        key_hash = hashlib.sha256(plain_key.encode()).hexdigest()
        key_prefix = plain_key[:15] + "..."

    4. Store in database:
        api_key = APIKey(
            key_hash=key_hash,
            key_prefix=key_prefix,
            workspace_id=workspace_id,
            scope_type=scope_type,
            scope_resource_id=scope_resource_id,
            permissions=permissions
        )
        db.add(api_key)
        db.commit()

    5. Return plain key (ONLY ONCE):
        return {
            "key": plain_key,  # Show once, never again
            "key_id": api_key.id,
            "key_prefix": key_prefix
        }

AUTHENTICATION FLOW:
--------------------
WHY: Secure and fast API authentication
HOW: Hash incoming key and compare with database

function authenticate_api_key(request_key: str):
    1. Validate format:
        if not matches("^(sk|pk)_(live|test)_[A-Za-z0-9_-]{43}$", request_key):
            raise AuthenticationError("Invalid API key format")

    2. Hash incoming key:
        key_hash = hashlib.sha256(request_key.encode()).hexdigest()

    3. Query database:
        api_key = db.query(APIKey).filter(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True
        ).first()

        if not api_key:
            raise AuthenticationError("Invalid or inactive API key")

    4. Check expiration:
        if api_key.expires_at and api_key.expires_at < now():
            raise AuthenticationError("API key expired")

    5. Check rate limits:
        if exceeds_rate_limit(api_key):
            raise RateLimitError("Rate limit exceeded")

    6. Update usage:
        api_key.last_used_at = now()
        api_key.last_used_ip = request.client.ip
        api_key.usage_stats["total_requests"] += 1
        db.commit()

    7. Return API key context:
        return {
            "api_key_id": api_key.id,
            "workspace_id": api_key.workspace_id,
            "scope_type": api_key.scope_type,
            "scope_resource_id": api_key.scope_resource_id,
            "permissions": api_key.permissions
        }

USAGE EXAMPLES:
---------------

1. CHATBOT API KEY (Execute queries):
    POST /api/v1/chatbots/{chatbot_id}/chat
    Headers:
        Authorization: Bearer sk_live_abc123...
    Body:
        {"message": "What are your business hours?"}

    API Key scope:
        scope_type = "chatbot"
        scope_resource_id = chatbot_id
        permissions = ["read", "execute"]

2. KNOWLEDGE BASE API KEY (Add documents):
    POST /api/v1/kb/{kb_id}/documents
    Headers:
        Authorization: Bearer sk_live_xyz789...
    Body:
        {"file": <uploaded_file>, "metadata": {...}}

    API Key scope:
        scope_type = "knowledge_base"
        scope_resource_id = kb_id
        permissions = ["read", "write"]

3. WORKSPACE API KEY (Access all resources):
    GET /api/v1/workspaces/{workspace_id}/chatbots
    Headers:
        Authorization: Bearer sk_live_qrs123...

    API Key scope:
        scope_type = "workspace"
        scope_resource_id = None
        permissions = ["read"]

4. PUBLIC KEY (Embedded widget):
    POST /api/v1/public/chatbots/{chatbot_id}/chat
    Headers:
        Authorization: Bearer pk_live_mno345...

    API Key scope:
        scope_type = "public"
        scope_resource_id = chatbot_id
        permissions = ["read", "execute"]

    WHY: Public keys for website widgets, stricter rate limits

PERMISSION CHECKS:
------------------
function check_permission(api_key, resource_type, action):
    1. Verify scope:
        if api_key.scope_type == "chatbot" and resource_type != "chatbot":
            raise PermissionError("Key scoped to chatbot only")

        if api_key.scope_resource_id and resource.id != api_key.scope_resource_id:
            raise PermissionError("Key not authorized for this resource")

    2. Verify action permission:
        required_permission = action_to_permission(action)
        # GET -> "read", POST/PUT -> "write", DELETE -> "admin", etc.

        if required_permission not in api_key.permissions:
            raise PermissionError(f"Key lacks {required_permission} permission")

    3. Return success

RATE LIMITING:
--------------
WHY: Prevent abuse and control costs
HOW: Token bucket algorithm with multiple time windows

function check_rate_limit(api_key):
    config = api_key.rate_limit_config
    usage = api_key.usage_stats

    # Minute limit
    if get_requests_last_minute(api_key) > config["requests_per_minute"]:
        raise RateLimitError("Minute limit exceeded")

    # Hour limit
    if get_requests_last_hour(api_key) > config["requests_per_hour"]:
        raise RateLimitError("Hour limit exceeded")

    # Day limit
    if get_requests_last_day(api_key) > config["requests_per_day"]:
        raise RateLimitError("Day limit exceeded")

    # Token limit (monthly)
    if usage["current_month_tokens"] > config["tokens_per_month"]:
        raise RateLimitError("Monthly token limit exceeded")

SECURITY BEST PRACTICES:
-------------------------
1. Never log full API keys (only prefix)
2. Use HTTPS only for API calls
3. Rotate keys regularly (prompt users after 90 days)
4. Monitor for suspicious patterns (multiple IPs, unusual usage)
5. Allow users to set IP whitelists per key
6. Implement webhook notifications for key usage anomalies

DEPLOYMENT EXAMPLE:
-------------------
User creates chatbot → generates API key → deploys to website:

<script>
  const chatbot = new PrivexBotSDK({
    apiKey: 'pk_live_abc123...',
    chatbotId: 'chatbot-uuid'
  });

  chatbot.mount('#chatbot-container');
</script>

SDK makes API calls to:
    POST https://api.privexbot.com/v1/public/chatbots/{chatbot_id}/chat
    Authorization: Bearer pk_live_abc123...
"""
