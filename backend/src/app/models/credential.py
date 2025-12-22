"""
Credential model - Encrypted storage for API keys and tokens used in chatflow nodes.

WHY:
- Chatflow nodes need external API keys (HTTP requests, database connections)
- Keys must be encrypted at rest (security)
- Workspace-scoped (tenant isolation)
- Reusable across multiple chatflows

HOW:
- Store encrypted credentials per workspace
- Nodes reference credentials by ID
- Decrypt only when needed in node execution
- Support multiple credential types

PSEUDOCODE:
-----------
class Credential(Base):
    __tablename__ = "credentials"

    # Identity
    id: UUID (primary key, auto-generated)

    workspace_id: UUID (foreign key -> workspaces.id, indexed, cascade delete)
        WHY: CRITICAL - Credentials belong to workspace
        SECURITY: Cannot access credentials from other workspaces

    # Metadata
    name: str (required, max_length=255)
        WHY: User-friendly name for selection in UI
        EXAMPLE: "Stripe API Key", "PostgreSQL Production", "SendGrid SMTP"

    description: text | None
        WHY: Help users remember what this is for
        EXAMPLE: "Production Stripe key for payment processing"

    credential_type: str (enum)
        WHY: Different types have different fields
        VALUES:
            - "api_key": Simple API key
            - "oauth2": OAuth2 token
            - "basic_auth": Username + password
            - "database": Database connection string
            - "smtp": Email server credentials
            - "aws": AWS access key + secret
            - "custom": Custom key-value pairs

    # Encrypted Data (CRITICAL)
    encrypted_data: bytes (required)
        WHY: Store sensitive credentials securely
        HOW: Encrypted using Fernet (symmetric encryption)

        PLAINTEXT STRUCTURE (before encryption):
        {
            # For api_key type
            "api_key": "secrettt-key_live_abc123..."

            # For oauth2 type
            "access_token": "ya29.a0AfH6...",
            "refresh_token": "1//0gHZ...",
            "expires_at": "2025-01-15T10:30:00Z"

            # For basic_auth type
            "username": "john_doe",
            "password": "secret123"

            # For database type
            "connection_string": "postgresql://user:pass@host:5432/db",
            "host": "db.example.com",
            "port": 5432,
            "database": "production",
            "username": "app_user",
            "password": "db_password"

            # For smtp type
            "host": "smtp.gmail.com",
            "port": 587,
            "username": "noreply@example.com",
            "password": "email_password",
            "use_tls": true

            # For aws type
            "access_key_id": "AKIAIOSFODNN7EXAMPLE",
            "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "region": "us-east-1"

            # For custom type
            "custom_field_1": "value1",
            "custom_field_2": "value2"
        }

    encryption_key_id: str (required)
        WHY: Track which encryption key was used
        HOW: Key rotation support
        EXAMPLE: "key_v2_2025"

    # Usage Tracking
    last_used_at: datetime | None
        WHY: Track credential usage
        HOW: Updated when node executes

    usage_count: int (default: 0)
        WHY: How many times used
        HOW: Increment on each use

    # Status
    is_active: bool (default: True)
        WHY: Disable without deleting
        HOW: Disabled credentials cannot be used in flows

    # Timestamps
    created_by: UUID (foreign key -> users.id)
    created_at: datetime (auto-set)
    updated_at: datetime (auto-update)

    # Relationships
    workspace: Workspace (many-to-one)
    creator: User (many-to-one)

    # Indexes
    index: (workspace_id, credential_type)
        WHY: List credentials by type

    index: (workspace_id, is_active)
        WHY: List active credentials

See credential_service.py for encryption/decryption implementation.
"""

from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, Index, Enum, ForeignKey, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base_class import Base


class CredentialType(str, enum.Enum):
    """Credential type enum."""
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    BASIC_AUTH = "basic_auth"
    DATABASE = "database"
    SMTP = "smtp"
    AWS = "aws"
    CUSTOM = "custom"


class Credential(Base):
    """Credential model for encrypted storage of API keys and tokens."""

    __tablename__ = "credentials"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign keys
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Metadata
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    credential_type = Column(Enum(CredentialType), nullable=False, index=True)

    # Encrypted data (CRITICAL - stores sensitive information)
    encrypted_data = Column(LargeBinary, nullable=False)
    encryption_key_id = Column(String(50), nullable=False)

    # Usage tracking
    last_used_at = Column(DateTime, nullable=True)
    usage_count = Column(Integer, nullable=False, default=0)

    # Status
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="credentials")
    creator = relationship("User")

    # Indexes
    __table_args__ = (
        Index("ix_credentials_workspace_type", "workspace_id", "credential_type"),
        Index("ix_credentials_workspace_active", "workspace_id", "is_active"),
    )

    def __repr__(self):
        return f"<Credential {self.id} ({self.name})>"
