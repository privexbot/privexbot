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
"""

from cryptography.fernet import Fernet
from datetime import datetime, timedelta
from uuid import UUID
from typing import Dict, Any, Tuple, Optional
import json
import os
import httpx

from sqlalchemy.orm import Session

from app.models.credential import Credential, CredentialType
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
        HOW: Use Fernet for symmetric encryption (lazy init)
        """
        self._fernet: Optional[Fernet] = None
        self.current_key_id = "key_v1_2025"

    @property
    def fernet(self) -> Fernet:
        """
        Lazy initialization of Fernet encryption.

        WHY: Allow service to be imported even if ENCRYPTION_KEY not set
        HOW: Initialize on first use
        """
        if self._fernet is None:
            encryption_key = os.getenv("ENCRYPTION_KEY") or getattr(settings, "ENCRYPTION_KEY", "")
            if not encryption_key:
                raise ValueError(
                    "ENCRYPTION_KEY not set. Generate one with: "
                    "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
                )
            self._fernet = Fernet(encryption_key.encode())
        return self._fernet


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

    async def get_google_access_token(self, db: Session, credential) -> str:
        """
        Get a valid Google access token, refreshing if expired.

        Checks expires_at and refreshes via Google OAuth API if within
        5 minutes of expiry.

        ARGS:
            db: Database session
            credential: Credential model instance

        RETURNS:
            Valid access token string

        RAISES:
            ValueError: If no access token found
            RuntimeError: If refresh fails (no refresh_token or API error)
        """
        data = self.get_decrypted_data(db, credential)
        access_token = data.get("access_token")
        if not access_token:
            raise ValueError("Google credential missing access token")

        # Check if token needs refresh
        expires_at = data.get("expires_at")
        needs_refresh = False

        if expires_at:
            try:
                expiry = datetime.fromisoformat(expires_at)
                if expiry < datetime.utcnow() + timedelta(minutes=5):
                    needs_refresh = True
            except (ValueError, TypeError):
                pass  # Can't parse expires_at, use token as-is

        if not needs_refresh:
            return access_token

        # Refresh the token
        refresh_token = data.get("refresh_token")
        if not refresh_token:
            raise RuntimeError(
                "Google token expired and no refresh token available. "
                "Please reconnect your Google account."
            )

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if resp.status_code != 200:
            raise RuntimeError(
                f"Failed to refresh Google token (HTTP {resp.status_code}). "
                "Please reconnect your Google account."
            )

        token_data = resp.json()
        new_access_token = token_data.get("access_token")
        if not new_access_token:
            raise RuntimeError("Google token refresh returned no access token")

        # Update stored credential with new token info
        new_expires_in = token_data.get("expires_in", 3600)
        new_expires_at = (datetime.utcnow() + timedelta(seconds=new_expires_in)).isoformat()

        data["access_token"] = new_access_token
        data["expires_at"] = new_expires_at
        data["expires_in"] = new_expires_in

        # Google may issue a new refresh token
        if token_data.get("refresh_token"):
            data["refresh_token"] = token_data["refresh_token"]

        # Re-encrypt and persist
        encrypted, key_id = self.encrypt_with_key_id(data)
        credential.encrypted_data = encrypted
        credential.encryption_key_id = key_id
        db.commit()

        return new_access_token

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

    def encrypt_with_key_id(self, data: dict) -> Tuple[bytes, str]:
        """
        Encrypt credential data and return with key ID.

        WHY: Routes need both encrypted data and key ID
        HOW: Encrypt and return tuple

        ARGS:
            data: Plain credential data

        RETURNS:
            Tuple of (encrypted_bytes, key_id)
        """
        encrypted = self.encrypt_credential_data(data)
        return (encrypted, self.current_key_id)

    async def test_credential(
        self,
        db: Session,
        credential: Credential
    ) -> Dict[str, Any]:
        """
        Test if credential is valid by making a test request.

        WHY: Verify credential works before using in workflows
        HOW: Make type-specific API test call

        ARGS:
            db: Database session
            credential: Credential to test

        RETURNS:
            {
                "is_valid": bool,
                "message": str,
                "metadata": dict
            }
        """
        try:
            # Decrypt credential data
            cred_data = self.decrypt_credential_data(credential.encrypted_data)
            cred_type = credential.credential_type.value if hasattr(credential.credential_type, 'value') else str(credential.credential_type)

            # Test based on credential type
            if cred_type == "api_key":
                return await self._test_api_key(cred_data)

            elif cred_type == "database":
                return self._test_database(cred_data)

            elif cred_type == "smtp":
                return self._test_smtp(cred_data)

            elif cred_type == "oauth2":
                return await self._test_oauth2(cred_data)

            elif cred_type == "aws":
                return await self._test_aws(cred_data)

            elif cred_type == "basic_auth":
                # Basic auth requires URL to test
                return {
                    "is_valid": True,
                    "message": "Basic auth credentials stored (cannot validate without target URL)",
                    "metadata": {"username": cred_data.get("username", "N/A")}
                }

            else:
                # Custom credentials can't be tested
                return {
                    "is_valid": True,
                    "message": "Custom credentials stored (validation not applicable)",
                    "metadata": {}
                }

        except Exception as e:
            return {
                "is_valid": False,
                "message": str(e),
                "metadata": {}
            }

    async def _test_api_key(self, cred_data: dict) -> Dict[str, Any]:
        """Test API key by checking if it's properly formatted."""
        api_key = cred_data.get("api_key", "")

        if not api_key:
            return {
                "is_valid": False,
                "message": "API key is empty",
                "metadata": {}
            }

        # Check common API key formats
        if api_key.startswith("sk-"):
            # OpenAI-style key
            return {
                "is_valid": True,
                "message": "API key format is valid (OpenAI-style)",
                "metadata": {"format": "openai", "key_prefix": api_key[:7] + "..."}
            }
        elif api_key.startswith("sk-ant-"):
            # Anthropic-style key
            return {
                "is_valid": True,
                "message": "API key format is valid (Anthropic-style)",
                "metadata": {"format": "anthropic", "key_prefix": api_key[:10] + "..."}
            }
        else:
            # Generic API key
            return {
                "is_valid": True,
                "message": "API key stored",
                "metadata": {"key_length": len(api_key)}
            }

    def _test_database(self, cred_data: dict) -> Dict[str, Any]:
        """Test database connection."""
        from sqlalchemy import create_engine, text

        try:
            db_type = cred_data.get("type", "postgresql")
            host = cred_data["host"]
            port = cred_data["port"]
            database = cred_data["database"]
            username = cred_data["username"]
            password = cred_data["password"]

            conn_str = f"{db_type}://{username}:{password}@{host}:{port}/{database}"
            engine = create_engine(conn_str, connect_args={"connect_timeout": 5})

            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))

            return {
                "is_valid": True,
                "message": f"Successfully connected to {database}@{host}",
                "metadata": {"host": host, "database": database}
            }

        except Exception as e:
            return {
                "is_valid": False,
                "message": f"Database connection failed: {str(e)}",
                "metadata": {}
            }

    def _test_smtp(self, cred_data: dict) -> Dict[str, Any]:
        """Test SMTP connection."""
        import smtplib

        try:
            host = cred_data["host"]
            port = cred_data["port"]
            username = cred_data["username"]
            password = cred_data["password"]
            use_tls = cred_data.get("use_tls", True)

            if use_tls:
                server = smtplib.SMTP(host, port, timeout=10)
                server.starttls()
            else:
                server = smtplib.SMTP(host, port, timeout=10)

            server.login(username, password)
            server.quit()

            return {
                "is_valid": True,
                "message": f"Successfully authenticated with {host}",
                "metadata": {"host": host, "username": username}
            }

        except Exception as e:
            return {
                "is_valid": False,
                "message": f"SMTP connection failed: {str(e)}",
                "metadata": {}
            }

    async def _test_oauth2(self, cred_data: dict) -> Dict[str, Any]:
        """Test OAuth2 token validity."""
        access_token = cred_data.get("access_token", "")
        expires_at = cred_data.get("expires_at")

        if not access_token:
            return {
                "is_valid": False,
                "message": "Access token is empty",
                "metadata": {}
            }

        # Check expiry if available
        if expires_at:
            from datetime import datetime
            try:
                expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if expiry < datetime.now(expiry.tzinfo):
                    has_refresh = bool(cred_data.get("refresh_token"))
                    return {
                        "is_valid": False,
                        "message": "Token expired" + (" (refresh token available)" if has_refresh else ""),
                        "metadata": {"expires_at": expires_at, "has_refresh_token": has_refresh}
                    }
            except ValueError:
                pass

        return {
            "is_valid": True,
            "message": "OAuth2 token stored",
            "metadata": {
                "has_refresh_token": bool(cred_data.get("refresh_token")),
                "expires_at": expires_at
            }
        }

    async def _test_aws(self, cred_data: dict) -> Dict[str, Any]:
        """Test AWS credentials format."""
        access_key_id = cred_data.get("access_key_id", "")
        secret_key = cred_data.get("secret_access_key", "")
        region = cred_data.get("region", "us-east-1")

        if not access_key_id or not secret_key:
            return {
                "is_valid": False,
                "message": "AWS credentials incomplete",
                "metadata": {}
            }

        # Validate format (AWS keys have specific patterns)
        if access_key_id.startswith("AKIA") and len(access_key_id) == 20:
            return {
                "is_valid": True,
                "message": "AWS credentials format is valid",
                "metadata": {
                    "access_key_prefix": access_key_id[:4] + "...",
                    "region": region
                }
            }

        return {
            "is_valid": True,
            "message": "AWS credentials stored (format validation skipped)",
            "metadata": {"region": region}
        }


# Global instance
credential_service = CredentialService()
