"""
Integration Service - Centralized cloud integration orchestration.

WHY:
- Unified management of all cloud integrations (Notion, Google, etc.)
- Consistent authentication and credential handling
- Centralized sync scheduling and monitoring
- Streamlined integration health checks

HOW:
- Orchestrates multiple integration adapters
- Manages OAuth flows and token refresh
- Schedules background sync tasks
- Monitors integration health and errors
"""

from typing import Dict, List, Optional, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

from app.integrations.notion_adapter import notion_adapter
from app.integrations.google_adapter import google_adapter
from app.models.credential import Credential, CredentialType
from app.services.credential_service import credential_service


class IntegrationService:
    """
    Centralized cloud integration management.

    WHY: Single point for all cloud integration operations
    HOW: Orchestrates multiple adapters, manages credentials
    """

    def __init__(self):
        self.adapters = {
            "notion": notion_adapter,
            "google_docs": google_adapter,
            "google_drive": google_adapter,
            "google_sheets": google_adapter,
        }

    async def list_available_integrations(self) -> List[Dict[str, Any]]:
        """
        List all available integrations.

        WHY: Show users what they can connect
        HOW: Return static list with status info

        RETURNS:
            [
                {
                    "type": "notion",
                    "name": "Notion",
                    "description": "Import pages and databases",
                    "oauth_required": true,
                    "scopes": ["read_content"]
                }
            ]
        """

        return [
            {
                "type": "notion",
                "name": "Notion",
                "description": "Import pages and databases from Notion workspace",
                "oauth_required": True,
                "scopes": ["read_content"],
                "icon": "notion",
                "status": "active"
            },
            {
                "type": "google_docs",
                "name": "Google Docs",
                "description": "Import documents from Google Drive",
                "oauth_required": True,
                "scopes": ["https://www.googleapis.com/auth/documents.readonly"],
                "icon": "google-docs",
                "status": "active"
            },
            {
                "type": "google_drive",
                "name": "Google Drive",
                "description": "Import files from Google Drive folders",
                "oauth_required": True,
                "scopes": ["https://www.googleapis.com/auth/drive.readonly"],
                "icon": "google-drive",
                "status": "active"
            },
            {
                "type": "google_sheets",
                "name": "Google Sheets",
                "description": "Import data from Google Sheets",
                "oauth_required": True,
                "scopes": ["https://www.googleapis.com/auth/spreadsheets.readonly"],
                "icon": "google-sheets",
                "status": "active"
            }
        ]

    async def get_oauth_url(
        self,
        integration_type: str,
        workspace_id: UUID,
        redirect_uri: str
    ) -> str:
        """
        Get OAuth authorization URL.

        WHY: Start OAuth flow for integration
        HOW: Delegate to appropriate adapter

        ARGS:
            integration_type: "notion" | "google_docs" | etc.
            workspace_id: Target workspace
            redirect_uri: Where to redirect after auth

        RETURNS:
            OAuth authorization URL
        """

        if integration_type not in self.adapters:
            raise ValueError(f"Unsupported integration: {integration_type}")

        adapter = self.adapters[integration_type]

        return await adapter.get_oauth_url(
            workspace_id=workspace_id,
            redirect_uri=redirect_uri
        )

    async def handle_oauth_callback(
        self,
        db: Session,
        integration_type: str,
        workspace_id: UUID,
        code: str,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Handle OAuth callback and store credentials.

        WHY: Complete OAuth flow and save tokens
        HOW: Exchange code for tokens, encrypt and store in credentials

        ARGS:
            db: Database session
            integration_type: Integration type
            workspace_id: Target workspace
            code: OAuth authorization code
            user_id: User completing OAuth

        RETURNS:
            {
                "credential_id": "uuid",
                "integration_type": "notion",
                "status": "connected"
            }
        """

        if integration_type not in self.adapters:
            raise ValueError(f"Unsupported integration: {integration_type}")

        adapter = self.adapters[integration_type]

        # Exchange code for tokens
        tokens = await adapter.exchange_code_for_tokens(code)

        # Test connection
        user_info = await adapter.get_user_info(tokens["access_token"])

        # Prepare OAuth2 credential data (to be encrypted)
        oauth_data = {
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
            "expires_at": tokens.get("expires_at"),
            "token_type": tokens.get("token_type", "Bearer"),
            "integration_type": integration_type,  # Store the service type
            "user_info": user_info,
            "connected_at": datetime.utcnow().isoformat(),
        }

        # Encrypt the credential data
        encrypted_data, key_id = credential_service.encrypt_with_key_id(oauth_data)

        # Store credential using correct model fields
        credential = Credential(
            workspace_id=workspace_id,
            name=f"{integration_type.title()} Integration",
            description=f"OAuth2 credentials for {integration_type}",
            credential_type=CredentialType.OAUTH2,
            encrypted_data=encrypted_data,
            encryption_key_id=key_id,
            created_by=user_id
        )

        db.add(credential)
        db.commit()
        db.refresh(credential)

        return {
            "credential_id": str(credential.id),
            "integration_type": integration_type,
            "status": "connected",
            "user_info": user_info
        }

    async def list_workspace_integrations(
        self,
        db: Session,
        workspace_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        List connected integrations for workspace.

        WHY: Show user's connected integrations
        HOW: Query OAuth2 credentials and decrypt to get integration info

        RETURNS:
            [
                {
                    "credential_id": "uuid",
                    "integration_type": "notion",
                    "status": "active",
                    "connected_at": "2025-01-10T10:00:00Z",
                    "last_sync_at": "2025-01-10T09:00:00Z"
                }
            ]
        """

        # Get only OAuth2 credentials (integrations)
        credentials = db.query(Credential).filter(
            Credential.workspace_id == workspace_id,
            Credential.credential_type == CredentialType.OAUTH2,
            Credential.is_active == True
        ).all()

        results = []
        for cred in credentials:
            try:
                # Decrypt to get integration data
                cred_data = credential_service.decrypt_credential_data(cred.encrypted_data)
                integration_type = cred_data.get("integration_type", "unknown")

                # Check connection health
                health_status = await self._check_integration_health(cred, cred_data)

                results.append({
                    "credential_id": str(cred.id),
                    "integration_type": integration_type,
                    "status": health_status["status"],
                    "connected_at": cred_data.get("connected_at"),
                    "last_sync_at": cred_data.get("last_sync_at"),
                    "error_message": health_status.get("error"),
                    "user_info": cred_data.get("user_info")
                })
            except Exception as e:
                # Skip credentials that can't be decrypted
                results.append({
                    "credential_id": str(cred.id),
                    "integration_type": "unknown",
                    "status": "error",
                    "error_message": f"Failed to decrypt: {str(e)}"
                })

        return results

    async def sync_integration_content(
        self,
        db: Session,
        credential_id: UUID,
        source_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Sync content from integration source.

        WHY: Import content from connected integration
        HOW: Decrypt credentials, use appropriate adapter to fetch content

        ARGS:
            db: Database session
            credential_id: Integration credential
            source_config: Source-specific configuration

        RETURNS:
            {
                "documents_imported": 5,
                "pages_processed": 12,
                "status": "completed"
            }
        """

        # Get credential
        credential = db.query(Credential).get(credential_id)
        if not credential:
            raise ValueError("Credential not found")

        # Decrypt to get tokens and integration type
        cred_data = credential_service.decrypt_credential_data(credential.encrypted_data)
        integration_type = cred_data.get("integration_type")

        adapter = self.adapters.get(integration_type)
        if not adapter:
            raise ValueError(f"No adapter for {integration_type}")

        # Refresh tokens if needed
        if await self._should_refresh_tokens(cred_data):
            cred_data = await self._refresh_integration_tokens(db, credential, cred_data)

        # Prepare tokens dict for adapter
        tokens = {
            "access_token": cred_data.get("access_token"),
            "refresh_token": cred_data.get("refresh_token"),
            "expires_at": cred_data.get("expires_at"),
            "token_type": cred_data.get("token_type", "Bearer"),
        }

        # Sync content
        result = await adapter.sync_content(
            tokens=tokens,
            source_config=source_config
        )

        # Update last sync time in encrypted data
        cred_data["last_sync_at"] = datetime.utcnow().isoformat()
        encrypted_data, key_id = credential_service.encrypt_with_key_id(cred_data)
        credential.encrypted_data = encrypted_data
        credential.encryption_key_id = key_id
        db.commit()

        return result

    async def disconnect_integration(
        self,
        db: Session,
        credential_id: UUID
    ) -> Dict[str, str]:
        """
        Disconnect integration.

        WHY: Remove integration connection
        HOW: Revoke tokens if possible, soft delete credential

        ARGS:
            db: Database session
            credential_id: Credential to disconnect

        RETURNS:
            {"status": "disconnected"}
        """

        credential = db.query(Credential).get(credential_id)
        if not credential:
            raise ValueError("Credential not found")

        # Decrypt to get integration type and tokens
        cred_data = credential_service.decrypt_credential_data(credential.encrypted_data)
        integration_type = cred_data.get("integration_type")

        adapter = self.adapters.get(integration_type)

        # Revoke tokens if adapter supports it
        if adapter and hasattr(adapter, 'revoke_tokens'):
            try:
                tokens = {
                    "access_token": cred_data.get("access_token"),
                    "refresh_token": cred_data.get("refresh_token"),
                }
                await adapter.revoke_tokens(tokens)
            except Exception:
                pass  # Continue even if revocation fails

        # Hard delete credential (privacy-first: users control their data)
        # GDPR Right to Erasure: permanent removal of sensitive data
        db.delete(credential)
        db.commit()

        return {"status": "disconnected"}

    async def _check_integration_health(
        self,
        credential: Credential,
        cred_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Check if integration is healthy.

        WHY: Monitor integration status
        HOW: Test API connection with stored tokens

        ARGS:
            credential: Credential model instance
            cred_data: Optional decrypted credential data (to avoid double decrypt)

        RETURNS:
            {
                "status": "active" | "error" | "expired",
                "error": "Token expired"
            }
        """
        # Decrypt if not provided
        if cred_data is None:
            cred_data = credential_service.decrypt_credential_data(credential.encrypted_data)

        integration_type = cred_data.get("integration_type")
        adapter = self.adapters.get(integration_type)

        if not adapter:
            return {"status": "error", "error": "No adapter available"}

        try:
            # Prepare tokens dict for adapter
            tokens = {
                "access_token": cred_data.get("access_token"),
                "refresh_token": cred_data.get("refresh_token"),
                "expires_at": cred_data.get("expires_at"),
            }

            # Test connection
            await adapter.test_connection(tokens)
            return {"status": "active"}

        except Exception as e:
            error_msg = str(e)

            # Determine status based on error
            if "expired" in error_msg.lower() or "unauthorized" in error_msg.lower():
                return {"status": "expired", "error": error_msg}
            else:
                return {"status": "error", "error": error_msg}

    async def _should_refresh_tokens(self, cred_data: Dict[str, Any]) -> bool:
        """
        Check if tokens need refresh.

        WHY: Prevent API errors from expired tokens
        HOW: Check token expiry time

        ARGS:
            cred_data: Decrypted credential data

        RETURNS:
            True if refresh needed
        """

        if not cred_data.get("refresh_token"):
            return False

        expires_at = cred_data.get("expires_at")
        if not expires_at:
            return False

        # Refresh if expires within 5 minutes
        try:
            expiry_time = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            return datetime.utcnow() + timedelta(minutes=5) >= expiry_time.replace(tzinfo=None)
        except ValueError:
            return False

    async def _refresh_integration_tokens(
        self,
        db: Session,
        credential: Credential,
        cred_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Refresh expired tokens.

        WHY: Maintain active connection
        HOW: Use refresh token to get new access token

        ARGS:
            db: Database session
            credential: Credential model instance
            cred_data: Decrypted credential data

        RETURNS:
            Updated credential data with new tokens
        """
        integration_type = cred_data.get("integration_type")
        adapter = self.adapters.get(integration_type)

        if not adapter or not hasattr(adapter, 'refresh_tokens'):
            return cred_data

        try:
            new_tokens = await adapter.refresh_tokens(
                cred_data["refresh_token"]
            )

            # Update credential data with new tokens
            cred_data["access_token"] = new_tokens.get("access_token", cred_data["access_token"])
            if new_tokens.get("refresh_token"):
                cred_data["refresh_token"] = new_tokens["refresh_token"]
            if new_tokens.get("expires_at"):
                cred_data["expires_at"] = new_tokens["expires_at"]
            cred_data["last_refreshed_at"] = datetime.utcnow().isoformat()

            # Re-encrypt and save
            encrypted_data, key_id = credential_service.encrypt_with_key_id(cred_data)
            credential.encrypted_data = encrypted_data
            credential.encryption_key_id = key_id
            db.commit()

            return cred_data

        except Exception as e:
            # Mark as expired if refresh fails
            cred_data["status"] = "expired"
            cred_data["error"] = str(e)
            encrypted_data, key_id = credential_service.encrypt_with_key_id(cred_data)
            credential.encrypted_data = encrypted_data
            credential.encryption_key_id = key_id
            db.commit()
            raise

    async def schedule_auto_sync(
        self,
        db: Session,
        credential_id: UUID,
        sync_config: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Schedule automatic syncing.

        WHY: Keep content up-to-date automatically
        HOW: Store sync config in encrypted data, queue periodic tasks

        ARGS:
            db: Database session
            credential_id: Integration credential
            sync_config: {
                "frequency": "daily" | "weekly" | "manual",
                "source_config": {...}
            }

        RETURNS:
            {"status": "scheduled"}
        """

        credential = db.query(Credential).get(credential_id)
        if not credential:
            raise ValueError("Credential not found")

        # Decrypt, update, and re-encrypt
        cred_data = credential_service.decrypt_credential_data(credential.encrypted_data)
        cred_data["auto_sync"] = sync_config
        cred_data["auto_sync_enabled"] = True

        encrypted_data, key_id = credential_service.encrypt_with_key_id(cred_data)
        credential.encrypted_data = encrypted_data
        credential.encryption_key_id = key_id
        db.commit()

        # Queue the first sync task based on frequency
        frequency = sync_config.get("frequency", "manual")
        if frequency != "manual":
            countdown_seconds = {
                "hourly": 3600,
                "daily": 86400,
                "weekly": 604800,
            }.get(frequency, 86400)  # Default to daily

            try:
                from app.tasks.integration_sync_tasks import run_auto_sync
                run_auto_sync.apply_async(
                    args=[str(credential_id)],
                    countdown=countdown_seconds
                )
                logger.info(f"Scheduled auto-sync for credential {credential_id} in {countdown_seconds}s ({frequency})")
            except Exception as e:
                logger.warning(f"Failed to queue auto-sync task: {e}. Sync config saved but task not scheduled.")

        return {"status": "scheduled"}


# Global instance
integration_service = IntegrationService()