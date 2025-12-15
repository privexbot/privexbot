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
            "api_key": "sk_live_abc123..."

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


ENCRYPTION/DECRYPTION:
----------------------
from cryptography.fernet import Fernet
import os
import json

class CredentialService:
    """Handle credential encryption/decryption."""

    def __init__(self):
        # Load encryption key from environment
        self.encryption_key = os.getenv("ENCRYPTION_KEY").encode()
        self.fernet = Fernet(self.encryption_key)

    def encrypt_credential_data(self, data: dict) -> bytes:
        """Encrypt credential data."""

        # Convert dict to JSON string
        json_data = json.dumps(data)

        # Encrypt
        encrypted = self.fernet.encrypt(json_data.encode())

        return encrypted

    def decrypt_credential_data(self, encrypted_data: bytes) -> dict:
        """Decrypt credential data."""

        # Decrypt
        decrypted = self.fernet.decrypt(encrypted_data)

        # Parse JSON
        data = json.loads(decrypted.decode())

        return data

    def create_credential(
        self,
        workspace_id: UUID,
        name: str,
        credential_type: str,
        data: dict,
        user_id: UUID
    ) -> Credential:
        """Create new encrypted credential."""

        # Encrypt data
        encrypted_data = self.encrypt_credential_data(data)

        # Create credential
        credential = Credential(
            workspace_id=workspace_id,
            name=name,
            description=data.get("_description"),  # Optional
            credential_type=credential_type,
            encrypted_data=encrypted_data,
            encryption_key_id="key_v1_2025",
            created_by=user_id
        )

        db.add(credential)
        db.commit()

        return credential

    def get_decrypted_data(self, credential: Credential) -> dict:
        """Get decrypted credential data for use."""

        # Check if active
        if not credential.is_active:
            raise ValueError("Credential is disabled")

        # Decrypt
        data = self.decrypt_credential_data(credential.encrypted_data)

        # Update usage tracking
        credential.last_used_at = datetime.utcnow()
        credential.usage_count += 1
        db.commit()

        return data


USAGE IN CHATFLOW NODES:
-------------------------
# In HTTP Request Node
class HTTPRequestNode:
    def execute(self, context: dict):
        # Node config references credential by ID
        credential_id = self.config["credential_id"]

        # Get credential
        credential = db.query(Credential).filter(
            Credential.id == credential_id,
            Credential.workspace_id == context["workspace_id"]
        ).first()

        if not credential:
            raise ValueError("Credential not found")

        # Decrypt
        cred_data = credential_service.get_decrypted_data(credential)

        # Use API key in request
        headers = {
            "Authorization": f"Bearer {cred_data['api_key']}"
        }

        response = requests.post(
            url=self.config["url"],
            headers=headers,
            json=context["data"]
        )

        return response.json()


SECURITY BEST PRACTICES:
------------------------
1. Never log decrypted data
2. Decrypt only when needed (just before use)
3. Use environment variable for encryption key
4. Rotate encryption keys periodically
5. Audit credential access
6. Support key rotation with migration


KEY ROTATION:
-------------
WHY: Security best practice to rotate encryption keys
HOW: Migrate credentials to new key

def rotate_encryption_key(old_key: str, new_key: str):
    """Migrate all credentials to new encryption key."""

    old_fernet = Fernet(old_key.encode())
    new_fernet = Fernet(new_key.encode())

    credentials = db.query(Credential).all()

    for cred in credentials:
        # Decrypt with old key
        decrypted = old_fernet.decrypt(cred.encrypted_data)

        # Re-encrypt with new key
        encrypted = new_fernet.encrypt(decrypted)

        # Update
        cred.encrypted_data = encrypted
        cred.encryption_key_id = "key_v2_2025"

    db.commit()


VALIDATION:
-----------
def validate_credential_data(credential_type: str, data: dict):
    """Validate credential data before encryption."""

    if credential_type == "api_key":
        if "api_key" not in data:
            raise ValueError("API key required")

    elif credential_type == "basic_auth":
        if "username" not in data or "password" not in data:
            raise ValueError("Username and password required")

    elif credential_type == "database":
        required = ["host", "port", "database", "username", "password"]
        for field in required:
            if field not in data:
                raise ValueError(f"{field} required for database credential")

    # Add more validation as needed


AUDIT LOG:
----------
WHY: Track who accessed what credentials
HOW: Log every decrypt operation

def audit_credential_access(credential_id: UUID, user_id: UUID, action: str):
    """Log credential access for security."""

    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "credential_id": str(credential_id),
        "user_id": str(user_id),
        "action": action,  # "created" | "accessed" | "updated" | "deleted"
        "ip_address": request.remote_addr
    }

    # Store in audit log table or external service
    redis.lpush(f"audit:credential:{credential_id}", json.dumps(log_entry))
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
