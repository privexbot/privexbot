"""
API Key model - Public API access for deployed chatbots, chatflows, and knowledge bases.

WHY:
- Platform feature: Users deploy bots and call them from anywhere
- API-first architecture: Every entity (chatbot/chatflow/KB) has public API
- Secure access control with key-based authentication
- Usage tracking and rate limiting

HOW:
- Each workspace/resource can have multiple API keys
- Keys are scoped to specific resource types (chatbot, chatflow, KB, or workspace)
- Includes rate limiting, expiration, and usage tracking
- Keys are hashed for security (only shown once on creation)

KEY DESIGN:
- Format: {prefix}_{env}_{random} e.g., secrettt-key_live_abc123...
- Prefix: sk (secret key) or pk (public key)
- Env: live or test
- Random: 32 bytes base64-encoded
"""

from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey, Index, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
import enum
import secrets
import hashlib
from datetime import datetime


class KeyScopeType(str, enum.Enum):
    """API key scope types."""
    WORKSPACE = "workspace"       # Access all resources in workspace
    CHATBOT = "chatbot"          # Access specific chatbot only
    CHATFLOW = "chatflow"        # Access specific chatflow only
    KNOWLEDGE_BASE = "kb"        # Access specific KB only
    PUBLIC = "public"            # Limited read-only for widgets


class APIKey(Base):
    """
    API Key model - Secure access to PrivexBot resources.

    Security:
    - Keys are hashed using SHA256, original only shown once on creation
    - Supports rate limiting, expiration, and usage tracking
    - Scoped to specific resources or entire workspace

    Format: secrettt-key_live_abc123... or pk_live_xyz789...
    """
    __tablename__ = "api_keys"

    # ═══════════════════════════════════════════════════════════════
    # IDENTITY
    # ═══════════════════════════════════════════════════════════════
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name = Column(String(100), nullable=False)
    # Human-readable name for the key
    # Example: "Production Widget", "Development Testing"

    key_hash = Column(String(64), nullable=False, unique=True, index=True)
    # SHA256 hash of the actual API key
    # SECURITY: Never store plain key in database

    key_prefix = Column(String(20), nullable=False)
    # First 15 chars + "..." for identification
    # Example: "secrettt-key_live_abc123d..."

    # ═══════════════════════════════════════════════════════════════
    # TENANT ISOLATION (CRITICAL)
    # ═══════════════════════════════════════════════════════════════
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # ═══════════════════════════════════════════════════════════════
    # SCOPE AND ACCESS CONTROL
    # ═══════════════════════════════════════════════════════════════
    scope_type = Column(
        Enum(KeyScopeType),
        nullable=False,
        default=KeyScopeType.CHATBOT
    )

    entity_type = Column(String(50), nullable=True)
    # For backward compatibility: "chatbot", "chatflow", "kb"

    entity_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    # Specific resource ID if scope is chatbot/chatflow/kb
    # NULL if scope is "workspace" (access all resources)

    permissions = Column(ARRAY(String), nullable=False, default=list)
    # Fine-grained access control
    # Values: "read", "write", "execute", "admin"
    # Default: ["read", "execute"]

    # ═══════════════════════════════════════════════════════════════
    # RATE LIMITING
    # ═══════════════════════════════════════════════════════════════
    rate_limit_config = Column(JSONB, nullable=False, default=dict)
    # Structure:
    # {
    #     "requests_per_minute": 60,
    #     "requests_per_hour": 1000,
    #     "requests_per_day": 10000,
    #     "tokens_per_month": 1000000,
    #     "burst_limit": 100
    # }

    # ═══════════════════════════════════════════════════════════════
    # USAGE TRACKING
    # ═══════════════════════════════════════════════════════════════
    usage_stats = Column(JSONB, nullable=False, default=dict)
    # Structure:
    # {
    #     "total_requests": 12450,
    #     "successful_requests": 12200,
    #     "failed_requests": 250,
    #     "total_tokens_used": 450000,
    #     "current_month_requests": 1500,
    #     "current_month_tokens": 75000
    # }

    # ═══════════════════════════════════════════════════════════════
    # LIFECYCLE MANAGEMENT
    # ═══════════════════════════════════════════════════════════════
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    # Enable/disable without deleting

    expires_at = Column(DateTime, nullable=True)
    # Auto-expiring keys for security
    # NULL means no expiration

    last_used_at = Column(DateTime, nullable=True)
    # Track when key was last used

    last_used_ip = Column(String(45), nullable=True)
    # IPv4 or IPv6 for security monitoring

    # ═══════════════════════════════════════════════════════════════
    # REVOCATION
    # ═══════════════════════════════════════════════════════════════
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    revoke_reason = Column(Text, nullable=True)

    # ═══════════════════════════════════════════════════════════════
    # AUDIT TRAIL
    # ═══════════════════════════════════════════════════════════════
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # ═══════════════════════════════════════════════════════════════
    # RELATIONSHIPS
    # ═══════════════════════════════════════════════════════════════
    workspace = relationship("Workspace")
    creator = relationship("User", foreign_keys=[created_by])
    revoker = relationship("User", foreign_keys=[revoked_by])

    # ═══════════════════════════════════════════════════════════════
    # INDEXES
    # ═══════════════════════════════════════════════════════════════
    __table_args__ = (
        Index("ix_api_keys_workspace_scope", "workspace_id", "scope_type", "is_active"),
        Index("ix_api_keys_entity", "entity_type", "entity_id"),
        Index("ix_api_keys_expires", "expires_at"),
    )

    def __repr__(self):
        return f"<APIKey(id={self.id}, name={self.name}, prefix={self.key_prefix})>"

    # ═══════════════════════════════════════════════════════════════
    # STATIC METHODS FOR KEY GENERATION
    # ═══════════════════════════════════════════════════════════════
    @staticmethod
    def generate_key(is_secret: bool = True, is_live: bool = True) -> tuple[str, str, str]:
        """
        Generate a new API key.

        Returns:
            (plain_key, key_hash, key_prefix)

        The plain_key should only be shown once to the user.
        """
        # Generate random part
        random_part = secrets.token_urlsafe(32)

        # Build key format: {prefix}_{env}_{random}
        prefix = "sk" if is_secret else "pk"
        env = "live" if is_live else "test"
        plain_key = f"{prefix}_{env}_{random_part}"

        # Hash for storage
        key_hash = hashlib.sha256(plain_key.encode()).hexdigest()

        # Prefix for display
        key_prefix = plain_key[:15] + "..."

        return plain_key, key_hash, key_prefix

    @staticmethod
    def hash_key(plain_key: str) -> str:
        """Hash an API key for lookup."""
        return hashlib.sha256(plain_key.encode()).hexdigest()

    def verify_key(self, plain_key: str) -> bool:
        """Verify a plain key against stored hash."""
        return self.key_hash == hashlib.sha256(plain_key.encode()).hexdigest()

    @property
    def is_expired(self) -> bool:
        """Check if key is expired."""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_revoked(self) -> bool:
        """Check if key is revoked."""
        return self.revoked_at is not None

    @property
    def is_valid(self) -> bool:
        """Check if key is valid (active, not expired, not revoked)."""
        return self.is_active and not self.is_expired and not self.is_revoked

    def record_usage(self, tokens_used: int = 0):
        """Update usage statistics."""
        if not self.usage_stats:
            self.usage_stats = {}

        self.usage_stats["total_requests"] = self.usage_stats.get("total_requests", 0) + 1
        self.usage_stats["successful_requests"] = self.usage_stats.get("successful_requests", 0) + 1
        self.usage_stats["total_tokens_used"] = self.usage_stats.get("total_tokens_used", 0) + tokens_used
        self.usage_stats["current_month_requests"] = self.usage_stats.get("current_month_requests", 0) + 1
        self.usage_stats["current_month_tokens"] = self.usage_stats.get("current_month_tokens", 0) + tokens_used

        self.last_used_at = datetime.utcnow()


# Helper function for API key creation (outside the class for easier import)
def create_api_key(
    workspace_id: uuid.UUID,
    name: str,
    entity_type: str,
    entity_id: uuid.UUID,
    created_by: uuid.UUID = None,
    permissions: list[str] = None,
    is_live: bool = True
) -> tuple["APIKey", str]:
    """
    Create a new API key with defaults.

    Returns:
        (APIKey instance, plain_key)

    Important: plain_key should only be shown once to the user.
    """
    plain_key, key_hash, key_prefix = APIKey.generate_key(is_secret=True, is_live=is_live)

    api_key = APIKey(
        workspace_id=workspace_id,
        name=name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        scope_type=KeyScopeType.CHATBOT if entity_type == "chatbot" else KeyScopeType.CHATFLOW if entity_type == "chatflow" else KeyScopeType.KNOWLEDGE_BASE,
        entity_type=entity_type,
        entity_id=entity_id,
        permissions=permissions or ["read", "execute"],
        created_by=created_by,
        rate_limit_config={
            "requests_per_minute": 60,
            "requests_per_hour": 1000,
            "requests_per_day": 10000,
            "tokens_per_month": 1000000
        }
    )

    return api_key, plain_key
