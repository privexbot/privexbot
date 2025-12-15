"""
Credential Service - Handle encryption/decryption of credentials.

WHY:
- Securely store API keys and tokens
- Encrypt data at rest
- Support key rotation
- Audit access

HOW:
- Use Fernet symmetric encryption
- Store encrypted bytes in database
- Decrypt only when needed
- Track usage

PSEUDOCODE follows the existing codebase patterns.
"""

from cryptography.fernet import Fernet
from datetime import datetime
from uuid import UUID
import json
import os

from sqlalchemy.orm import Session

from app.models.credential import Credential
from app.core.config import settings


class CredentialService:
    """
    Handle credential encryption/decryption.

    WHY: Secure storage of sensitive API keys and tokens
    HOW: Fernet symmetric encryption with key rotation support
    """

    def __init__(self):
        """
        Initialize encryption.

        WHY: Load encryption key from environment
        HOW: Use Fernet for symmetric encryption
        """
        # Load encryption key from environment
        encryption_key = os.getenv("ENCRYPTION_KEY") or settings.ENCRYPTION_KEY
        if not encryption_key:
            raise ValueError("ENCRYPTION_KEY not set in environment")

        self.fernet = Fernet(encryption_key.encode())
        self.current_key_id = "key_v1_2025"


    def encrypt_credential_data(self, data: dict) -> bytes:
        """
        Encrypt credential data.

        WHY: Store sensitive data securely
        HOW: JSON -> bytes -> encrypt

        ARGS:
            data: Plain credential data

        RETURNS:
            Encrypted bytes
        """
        # Convert dict to JSON string
        json_data = json.dumps(data)

        # Encrypt
        encrypted = self.fernet.encrypt(json_data.encode())

        return encrypted


    def decrypt_credential_data(self, encrypted_data: bytes) -> dict:
        """
        Decrypt credential data.

        WHY: Use credentials in nodes/integrations
        HOW: decrypt -> bytes -> JSON

        ARGS:
            encrypted_data: Encrypted bytes

        RETURNS:
            Plain credential data
        """
        # Decrypt
        decrypted = self.fernet.decrypt(encrypted_data)

        # Parse JSON
        data = json.loads(decrypted.decode())

        return data


    def create_credential(
        self,
        db: Session,
        workspace_id: UUID,
        name: str,
        credential_type: str,
        data: dict,
        user_id: UUID,
        description: str = None
    ) -> Credential:
        """
        Create new encrypted credential.

        WHY: Store credential securely
        HOW: Validate, encrypt, save to database

        ARGS:
            db: Database session
            workspace_id: Workspace ID
            name: User-friendly name
            credential_type: Type of credential
            data: Plain credential data
            user_id: User creating credential
            description: Optional description

        RETURNS:
            Created Credential instance
        """
        # Validate data structure
        self._validate_credential_data(credential_type, data)

        # Encrypt data
        encrypted_data = self.encrypt_credential_data(data)

        # Create credential
        credential = Credential(
            workspace_id=workspace_id,
            name=name,
            description=description,
            credential_type=credential_type,
            encrypted_data=encrypted_data,
            encryption_key_id=self.current_key_id,
            created_by=user_id
        )

        db.add(credential)
        db.commit()
        db.refresh(credential)

        return credential


    def get_decrypted_data(
        self,
        db: Session,
        credential: Credential
    ) -> dict:
        """
        Get decrypted credential data for use.

        WHY: Use credentials in execution
        HOW: Check active, decrypt, track usage

        ARGS:
            db: Database session
            credential: Credential instance

        RETURNS:
            Plain credential data

        RAISES:
            ValueError: If credential is disabled
        """
        # Check if active
        if not credential.is_active:
            raise ValueError(f"Credential '{credential.name}' is disabled")

        # Decrypt
        data = self.decrypt_credential_data(credential.encrypted_data)

        # Update usage tracking
        credential.last_used_at = datetime.utcnow()
        credential.usage_count += 1
        db.commit()

        return data


    def update_credential(
        self,
        db: Session,
        credential: Credential,
        updates: dict
    ) -> Credential:
        """
        Update credential (re-encrypt if data changes).

        WHY: Allow credential updates
        HOW: Re-encrypt data if changed

        ARGS:
            db: Database session
            credential: Credential instance
            updates: Fields to update

        RETURNS:
            Updated Credential instance
        """
        # Handle data updates (requires re-encryption)
        if "data" in updates:
            new_data = updates.pop("data")
            self._validate_credential_data(credential.credential_type, new_data)
            credential.encrypted_data = self.encrypt_credential_data(new_data)

        # Handle other updates
        for key, value in updates.items():
            if hasattr(credential, key):
                setattr(credential, key, value)

        db.commit()
        db.refresh(credential)

        return credential


    def rotate_encryption_key(
        self,
        db: Session,
        old_key: str,
        new_key: str,
        new_key_id: str
    ):
        """
        Migrate all credentials to new encryption key.

        WHY: Security best practice - rotate keys periodically
        HOW: Decrypt with old key, re-encrypt with new key

        ARGS:
            db: Database session
            old_key: Old encryption key
            new_key: New encryption key
            new_key_id: New key identifier

        SECURITY: Only run during maintenance window
        """
        old_fernet = Fernet(old_key.encode())
        new_fernet = Fernet(new_key.encode())

        credentials = db.query(Credential).all()

        for cred in credentials:
            try:
                # Decrypt with old key
                decrypted = old_fernet.decrypt(cred.encrypted_data)

                # Re-encrypt with new key
                encrypted = new_fernet.encrypt(decrypted)

                # Update
                cred.encrypted_data = encrypted
                cred.encryption_key_id = new_key_id

            except Exception as e:
                # Log error but continue with others
                print(f"Failed to rotate key for credential {cred.id}: {e}")

        db.commit()


    def _validate_credential_data(self, credential_type: str, data: dict):
        """
        Validate credential data before encryption.

        WHY: Ensure required fields present
        HOW: Type-specific validation

        ARGS:
            credential_type: Type of credential
            data: Data to validate

        RAISES:
            ValueError: If validation fails
        """
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

        elif credential_type == "smtp":
            required = ["host", "port", "username", "password"]
            for field in required:
                if field not in data:
                    raise ValueError(f"{field} required for SMTP credential")

        elif credential_type == "oauth2":
            if "access_token" not in data:
                raise ValueError("access_token required for OAuth2 credential")

        elif credential_type == "aws":
            if "access_key_id" not in data or "secret_access_key" not in data:
                raise ValueError("access_key_id and secret_access_key required for AWS credential")

        # custom type allows any fields


# Global instance
credential_service = CredentialService()
