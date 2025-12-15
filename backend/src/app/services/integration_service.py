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

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Dict, List, Optional, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.integrations.notion_adapter import notion_adapter
from app.integrations.google_adapter import google_adapter
from app.models.credential import Credential


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
        HOW: Exchange code for tokens, store in credentials

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

        # Store credential
        credential = Credential(
            workspace_id=workspace_id,
            integration_type=integration_type,
            tokens=tokens,
            metadata={
                "user_info": user_info,
                "connected_at": datetime.utcnow().isoformat(),
                "status": "active"
            },
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
        HOW: Query credentials table

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

        credentials = db.query(Credential).filter(
            Credential.workspace_id == workspace_id,
            Credential.is_active == True
        ).all()

        results = []
        for cred in credentials:
            # Check connection health
            health_status = await self._check_integration_health(cred)

            results.append({
                "credential_id": str(cred.id),
                "integration_type": cred.integration_type,
                "status": health_status["status"],
                "connected_at": cred.metadata.get("connected_at"),
                "last_sync_at": cred.metadata.get("last_sync_at"),
                "error_message": health_status.get("error"),
                "user_info": cred.metadata.get("user_info")
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
        HOW: Use appropriate adapter to fetch content

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

        adapter = self.adapters.get(credential.integration_type)
        if not adapter:
            raise ValueError(f"No adapter for {credential.integration_type}")

        # Refresh tokens if needed
        if await self._should_refresh_tokens(credential):
            await self._refresh_integration_tokens(db, credential)

        # Sync content
        result = await adapter.sync_content(
            tokens=credential.tokens,
            source_config=source_config
        )

        # Update last sync time
        credential.metadata["last_sync_at"] = datetime.utcnow().isoformat()
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
        HOW: Revoke tokens, soft delete credential

        ARGS:
            db: Database session
            credential_id: Credential to disconnect

        RETURNS:
            {"status": "disconnected"}
        """

        credential = db.query(Credential).get(credential_id)
        if not credential:
            raise ValueError("Credential not found")

        adapter = self.adapters.get(credential.integration_type)

        # Revoke tokens if adapter supports it
        if hasattr(adapter, 'revoke_tokens'):
            try:
                await adapter.revoke_tokens(credential.tokens)
            except Exception:
                pass  # Continue even if revocation fails

        # Soft delete credential
        credential.is_active = False
        credential.metadata["disconnected_at"] = datetime.utcnow().isoformat()
        db.commit()

        return {"status": "disconnected"}

    async def _check_integration_health(
        self,
        credential: Credential
    ) -> Dict[str, Any]:
        """
        Check if integration is healthy.

        WHY: Monitor integration status
        HOW: Test API connection with stored tokens

        RETURNS:
            {
                "status": "active" | "error" | "expired",
                "error": "Token expired"
            }
        """

        adapter = self.adapters.get(credential.integration_type)
        if not adapter:
            return {"status": "error", "error": "No adapter available"}

        try:
            # Test connection
            await adapter.test_connection(credential.tokens)
            return {"status": "active"}

        except Exception as e:
            error_msg = str(e)

            # Determine status based on error
            if "expired" in error_msg.lower() or "unauthorized" in error_msg.lower():
                return {"status": "expired", "error": error_msg}
            else:
                return {"status": "error", "error": error_msg}

    async def _should_refresh_tokens(self, credential: Credential) -> bool:
        """
        Check if tokens need refresh.

        WHY: Prevent API errors from expired tokens
        HOW: Check token expiry time

        RETURNS:
            True if refresh needed
        """

        if not credential.tokens.get("refresh_token"):
            return False

        expires_at = credential.tokens.get("expires_at")
        if not expires_at:
            return False

        # Refresh if expires within 5 minutes
        expiry_time = datetime.fromisoformat(expires_at)
        return datetime.utcnow() + timedelta(minutes=5) >= expiry_time

    async def _refresh_integration_tokens(
        self,
        db: Session,
        credential: Credential
    ) -> None:
        """
        Refresh expired tokens.

        WHY: Maintain active connection
        HOW: Use refresh token to get new access token

        ARGS:
            db: Database session
            credential: Credential to refresh
        """

        adapter = self.adapters.get(credential.integration_type)
        if not adapter or not hasattr(adapter, 'refresh_tokens'):
            return

        try:
            new_tokens = await adapter.refresh_tokens(
                credential.tokens["refresh_token"]
            )

            # Update stored tokens
            credential.tokens = new_tokens
            credential.metadata["last_refreshed_at"] = datetime.utcnow().isoformat()
            db.commit()

        except Exception as e:
            # Mark as expired if refresh fails
            credential.metadata["status"] = "expired"
            credential.metadata["error"] = str(e)
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
        HOW: Queue periodic sync tasks

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

        # Store sync configuration
        credential.metadata["auto_sync"] = sync_config
        credential.metadata["auto_sync_enabled"] = True
        db.commit()

        # TODO: Queue periodic task based on frequency
        # This would integrate with Celery beat for scheduling

        return {"status": "scheduled"}


# Global instance
integration_service = IntegrationService()