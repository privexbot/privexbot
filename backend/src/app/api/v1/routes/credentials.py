"""
Credential Routes - API endpoints for credential management.

WHY:
- Manage API keys and OAuth tokens
- Secure credential storage
- Usage tracking
- Integration with chatflow nodes

HOW:
- FastAPI router
- Fernet encryption
- Multi-tenant access control via workspace dependency
- Credential validation
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
import base64
import json
import secrets
import httpx

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user, get_current_workspace
from app.models.user import User
from app.models.workspace import Workspace
from app.models.credential import Credential, CredentialType
from app.services.credential_service import credential_service
from app.core.config import settings
from app.schemas.credential import (
    CredentialCreate,
    CredentialUpdate,
    CredentialResponse,
    CredentialListResponse,
    CredentialTestResponse,
    CredentialUsageResponse,
)

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.post("/", response_model=dict)
async def create_credential(
    credential_data: CredentialCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new credential.

    WHY: Store API keys for integrations
    HOW: Encrypt with Fernet, save to DB

    BODY:
        {
            "workspace_id": "uuid",
            "name": "Telegram Bot Token",
            "credential_type": "api_key",
            "data": {
                "api_key": "sk-..."
            }
        }

    RETURNS:
        {
            "credential_id": "uuid",
            "name": "Telegram Bot Token",
            "credential_type": "api_key",
            "is_active": true
        }
    """
    # Verify workspace_id in request matches current workspace context
    if credential_data.workspace_id != workspace.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace ID mismatch"
        )

    # Validate credential type
    try:
        cred_type = CredentialType(credential_data.credential_type.value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid credential type: {credential_data.credential_type}"
        )

    # Encrypt credential data
    encrypted_data, key_id = credential_service.encrypt_with_key_id(
        credential_data.data
    )

    # Create credential
    credential = Credential(
        workspace_id=workspace.id,
        name=credential_data.name,
        credential_type=cred_type,
        provider=credential_data.provider,  # Service provider (telegram, discord, etc.)
        encrypted_data=encrypted_data,
        encryption_key_id=key_id,
        created_by=current_user.id,
        is_active=True
    )

    db.add(credential)
    db.commit()
    db.refresh(credential)

    return {
        "credential_id": str(credential.id),
        "name": credential.name,
        "credential_type": credential.credential_type.value,
        "provider": credential.provider,
        "is_active": credential.is_active
    }


@router.get("/", response_model=CredentialListResponse)
async def list_credentials(
    skip: int = 0,
    limit: int = 50,
    credential_type: str = None,
    provider: str = None,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """
    List all credentials in workspace.

    WHY: Display credentials in dashboard
    HOW: Query database (exclude encrypted data)

    QUERY PARAMS:
        credential_type: Filter by auth type (e.g., "api_key", "oauth2")
        provider: Filter by service provider (e.g., "telegram", "discord", "notion")

    RETURNS:
        {
            "items": [...],
            "total": 5,
            "skip": 0,
            "limit": 50
        }
    """
    # Get credentials for current workspace
    query = db.query(Credential).filter(
        Credential.workspace_id == workspace.id
    )

    # Filter by credential_type if provided
    if credential_type:
        try:
            cred_type = CredentialType(credential_type)
            query = query.filter(Credential.credential_type == cred_type)
        except ValueError:
            # Invalid credential type, return empty results
            pass

    # Filter by provider if provided
    if provider:
        query = query.filter(Credential.provider == provider)

    total = query.count()
    credentials = query.offset(skip).limit(limit).all()

    # Format response (exclude encrypted data)
    items = [
        CredentialResponse(
            id=cred.id,
            workspace_id=cred.workspace_id,
            name=cred.name,
            credential_type=cred.credential_type,
            provider=cred.provider,
            is_active=cred.is_active,
            usage_count=cred.usage_count,
            last_used_at=cred.last_used_at,
            created_at=cred.created_at,
            updated_at=cred.updated_at,
            data=None  # Never include data in list
        )
        for cred in credentials
    ]

    return CredentialListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{credential_id}", response_model=CredentialResponse)
async def get_credential(
    credential_id: UUID,
    include_data: bool = False,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """
    Get single credential by ID.

    WHY: View credential details
    HOW: Query database, optionally decrypt

    QUERY PARAMS:
        include_data: If true, include decrypted data (use carefully)

    RETURNS:
        Credential details with optional decrypted data
    """
    credential = db.query(Credential).filter(
        Credential.id == credential_id,
        Credential.workspace_id == workspace.id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    # Optionally include decrypted data
    decrypted_data = None
    if include_data:
        try:
            decrypted_data = credential_service.get_decrypted_data(db, credential)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to decrypt credential: {str(e)}"
            )

    return CredentialResponse(
        id=credential.id,
        workspace_id=credential.workspace_id,
        name=credential.name,
        credential_type=credential.credential_type,
        is_active=credential.is_active,
        usage_count=credential.usage_count,
        last_used_at=credential.last_used_at,
        created_at=credential.created_at,
        updated_at=credential.updated_at,
        data=decrypted_data
    )


@router.patch("/{credential_id}", response_model=dict)
async def update_credential(
    credential_id: UUID,
    updates: CredentialUpdate,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """
    Update credential.

    WHY: Modify credential settings or rotate keys
    HOW: Update database, re-encrypt if data changed

    BODY:
        {
            "name": "Updated Name",
            "is_active": false,
            "data": {"api_key": "sk-new..."}  // Optional - re-encrypt if provided
        }
    """
    credential = db.query(Credential).filter(
        Credential.id == credential_id,
        Credential.workspace_id == workspace.id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    # Update name if provided
    if updates.name is not None:
        credential.name = updates.name

    # Update is_active if provided
    if updates.is_active is not None:
        credential.is_active = updates.is_active

    # Re-encrypt data if provided
    if updates.data is not None:
        encrypted_data, key_id = credential_service.encrypt_with_key_id(
            updates.data
        )
        credential.encrypted_data = encrypted_data
        credential.encryption_key_id = key_id

    db.commit()
    db.refresh(credential)

    return {
        "id": str(credential.id),
        "name": credential.name,
        "credential_type": credential.credential_type.value,
        "is_active": credential.is_active
    }


@router.delete("/{credential_id}")
async def delete_credential(
    credential_id: UUID,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """
    Delete credential.

    WHY: Remove credential
    HOW: Hard delete from database

    NOTE: Consider checking if credential is in use by chatflows before deleting
    """
    credential = db.query(Credential).filter(
        Credential.id == credential_id,
        Credential.workspace_id == workspace.id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    # Hard delete
    db.delete(credential)
    db.commit()

    return {"status": "deleted"}


@router.post("/{credential_id}/test", response_model=CredentialTestResponse)
async def test_credential(
    credential_id: UUID,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """
    Test credential validity.

    WHY: Verify credential works before using
    HOW: Make test API call based on credential type

    RETURNS:
        {
            "is_valid": true,
            "message": "Connection successful",
            "metadata": {...}
        }
    """
    credential = db.query(Credential).filter(
        Credential.id == credential_id,
        Credential.workspace_id == workspace.id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    # Test credential
    result = await credential_service.test_credential(db, credential)

    return CredentialTestResponse(
        is_valid=result["is_valid"],
        message=result["message"],
        metadata=result.get("metadata", {})
    )


@router.get("/{credential_id}/usage", response_model=CredentialUsageResponse)
async def get_credential_usage(
    credential_id: UUID,
    days: int = 7,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """
    Get credential usage statistics.

    WHY: Monitor credential usage
    HOW: Return basic usage info from credential record

    RETURNS:
        {
            "credential_id": "uuid",
            "total_uses": 1234,
            "last_used_at": "2025-10-01T12:00:00Z",
            "usage_by_day": [],
            "usage_by_bot": []
        }

    NOTE: Detailed usage tracking (usage_by_day, usage_by_bot) requires
    a separate usage log table which is not yet implemented.
    """
    credential = db.query(Credential).filter(
        Credential.id == credential_id,
        Credential.workspace_id == workspace.id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    return CredentialUsageResponse(
        credential_id=credential.id,
        total_uses=credential.usage_count,
        last_used_at=credential.last_used_at,
        usage_by_day=[],  # Not yet implemented
        usage_by_bot=[]   # Not yet implemented
    )


# ========================================
# OAUTH ENDPOINTS
# ========================================

SUPPORTED_OAUTH_PROVIDERS = {"notion", "google", "google_gmail", "calendly"}


@router.post("/oauth/authorize")
async def oauth_authorize(
    provider: str = Query(..., description="OAuth provider (e.g. 'notion')"),
    workspace_id: UUID = Query(..., description="Workspace ID to associate credential with"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Initiate OAuth authorization flow.

    Redirects to the provider's consent page. After user authorizes,
    the provider redirects back to /credentials/oauth/callback.
    """
    if provider not in SUPPORTED_OAUTH_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider: {provider}. Supported: {', '.join(SUPPORTED_OAUTH_PROVIDERS)}"
        )

    # Validate workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    # Build state token with CSRF protection
    csrf_token = secrets.token_urlsafe(32)
    state_data = {
        "workspace_id": str(workspace_id),
        "user_id": str(current_user.id),
        "provider": provider,
        "csrf": csrf_token,
    }
    state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()

    # Store CSRF token in Redis with 5 min TTL
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL)
        r.setex(f"oauth_csrf:{csrf_token}", 300, str(current_user.id))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store CSRF token: {str(e)}"
        )

    if provider == "notion":
        if not settings.NOTION_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Notion OAuth not configured. Set NOTION_CLIENT_ID in environment."
            )

        authorize_url = (
            f"https://api.notion.com/v1/oauth/authorize"
            f"?client_id={settings.NOTION_CLIENT_ID}"
            f"&redirect_uri={settings.notion_redirect_uri}"
            f"&response_type=code"
            f"&state={state}"
            f"&owner=user"
        )
        return {"redirect_url": authorize_url}

    elif provider == "google":
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID in environment."
            )

        from urllib.parse import quote
        scopes = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/spreadsheets.readonly"

        authorize_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={settings.GOOGLE_CLIENT_ID}"
            f"&redirect_uri={quote(settings.google_redirect_uri, safe='')}"
            f"&response_type=code"
            f"&scope={quote(scopes, safe='')}"
            f"&access_type=offline"
            f"&prompt=consent"
            f"&state={state}"
        )
        return {"redirect_url": authorize_url}

    elif provider == "google_gmail":
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID in environment."
            )

        from urllib.parse import quote
        scopes = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email"

        authorize_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={settings.GOOGLE_CLIENT_ID}"
            f"&redirect_uri={quote(settings.google_redirect_uri, safe='')}"
            f"&response_type=code"
            f"&scope={quote(scopes, safe='')}"
            f"&access_type=offline"
            f"&prompt=consent"
            f"&state={state}"
        )
        return {"redirect_url": authorize_url}

    elif provider == "calendly":
        from app.core.config import settings as app_settings
        if not app_settings.CALENDLY_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Calendly OAuth not configured. Set CALENDLY_CLIENT_ID in environment."
            )

        from urllib.parse import quote
        redirect_uri = settings.google_redirect_uri  # Same callback endpoint, state distinguishes provider

        authorize_url = (
            f"https://auth.calendly.com/oauth/authorize"
            f"?client_id={app_settings.CALENDLY_CLIENT_ID}"
            f"&redirect_uri={quote(redirect_uri, safe='')}"
            f"&response_type=code"
            f"&state={state}"
        )
        return {"redirect_url": authorize_url}

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider not implemented")


@router.get("/oauth/callback")
async def oauth_callback(
    code: str = Query(..., description="Authorization code from provider"),
    state: str = Query(..., description="State token for CSRF validation"),
    db: Session = Depends(get_db),
):
    """
    Handle OAuth callback from provider.

    Exchanges authorization code for access token and stores credential.
    Redirects back to frontend KB creation page.
    """
    # Decode and validate state
    try:
        state_data = json.loads(base64.urlsafe_b64decode(state))
        workspace_id = state_data["workspace_id"]
        user_id = state_data["user_id"]
        provider = state_data["provider"]
        csrf_token = state_data["csrf"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state token")

    # Validate CSRF token
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL)
        stored_user_id = r.get(f"oauth_csrf:{csrf_token}")
        if not stored_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSRF token expired or invalid")
        if stored_user_id.decode() != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token mismatch")
        r.delete(f"oauth_csrf:{csrf_token}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CSRF validation failed: {str(e)}"
        )

    if provider == "notion":
        # Exchange code for access token
        if not settings.NOTION_CLIENT_ID or not settings.NOTION_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Notion OAuth not configured"
            )

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://api.notion.com/v1/oauth/token",
                auth=(settings.NOTION_CLIENT_ID, settings.NOTION_CLIENT_SECRET),
                json={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.notion_redirect_uri,
                },
                headers={"Content-Type": "application/json"},
            )

        if token_response.status_code != 200:
            error_detail = token_response.text
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/knowledge-bases/create?notion_error=token_exchange_failed",
                status_code=302,
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        notion_workspace_id = token_data.get("workspace_id")
        notion_workspace_name = token_data.get("workspace_name", "Notion Workspace")
        bot_id = token_data.get("bot_id")

        if not access_token:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/knowledge-bases/create?notion_error=no_access_token",
                status_code=302,
            )

        # Encrypt and store credential
        credential_data = {
            "access_token": access_token,
            "workspace_id": notion_workspace_id,
            "workspace_name": notion_workspace_name,
            "bot_id": bot_id,
        }

        encrypted_data, key_id = credential_service.encrypt_with_key_id(credential_data)

        # Upsert: update existing Notion credential or create new one
        existing = db.query(Credential).filter(
            Credential.workspace_id == UUID(workspace_id),
            Credential.provider == "notion",
            Credential.is_active == True,
        ).first()

        if existing:
            existing.encrypted_data = encrypted_data
            existing.encryption_key_id = key_id
            existing.name = f"Notion - {notion_workspace_name}"
            db.commit()
        else:
            credential = Credential(
                workspace_id=UUID(workspace_id),
                name=f"Notion - {notion_workspace_name}",
                credential_type=CredentialType.OAUTH2,
                provider="notion",
                encrypted_data=encrypted_data,
                encryption_key_id=key_id,
                created_by=UUID(user_id),
                is_active=True,
            )
            db.add(credential)
            db.commit()

        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/knowledge-bases/create?notion_connected=true",
            status_code=302,
        )

    elif provider == "google":
        # Exchange code for access token
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured"
            )

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.google_redirect_uri,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if token_response.status_code != 200:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/knowledge-bases/create?google_error=token_exchange_failed",
                status_code=302,
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

        if not access_token:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/knowledge-bases/create?google_error=no_access_token",
                status_code=302,
            )

        # Get user info for credential name
        google_email = "Google Account"
        try:
            async with httpx.AsyncClient() as client:
                userinfo = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if userinfo.status_code == 200:
                    google_email = userinfo.json().get("email", "Google Account")
        except Exception:
            pass

        # Encrypt and store credential
        expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
        credential_data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": expires_in,
            "expires_at": expires_at,
            "email": google_email,
        }

        encrypted_data, key_id = credential_service.encrypt_with_key_id(credential_data)

        # Upsert: update existing Google credential or create new one
        existing = db.query(Credential).filter(
            Credential.workspace_id == UUID(workspace_id),
            Credential.provider == "google",
            Credential.is_active == True,
        ).first()

        if existing:
            existing.encrypted_data = encrypted_data
            existing.encryption_key_id = key_id
            existing.name = f"Google - {google_email}"
            db.commit()
        else:
            credential = Credential(
                workspace_id=UUID(workspace_id),
                name=f"Google - {google_email}",
                credential_type=CredentialType.OAUTH2,
                provider="google",
                encrypted_data=encrypted_data,
                encryption_key_id=key_id,
                created_by=UUID(user_id),
                is_active=True,
            )
            db.add(credential)
            db.commit()

        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/knowledge-bases/create?google_connected=true",
            status_code=302,
        )

    elif provider == "google_gmail":
        # Gmail OAuth - same token exchange as Google, different scope
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured"
            )

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.google_redirect_uri,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if token_response.status_code != 200:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/settings/credentials?gmail_error=token_exchange_failed",
                status_code=302,
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

        if not access_token:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/settings/credentials?gmail_error=no_access_token",
                status_code=302,
            )

        # Get user email for credential name
        gmail_email = "Gmail Account"
        try:
            async with httpx.AsyncClient() as client:
                userinfo = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if userinfo.status_code == 200:
                    gmail_email = userinfo.json().get("email", "Gmail Account")
        except Exception:
            pass

        # Encrypt and store credential
        expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
        credential_data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": expires_in,
            "expires_at": expires_at,
            "email": gmail_email,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
        }

        encrypted_data, key_id = credential_service.encrypt_with_key_id(credential_data)

        # Upsert: update existing Gmail credential or create new one
        existing = db.query(Credential).filter(
            Credential.workspace_id == UUID(workspace_id),
            Credential.provider == "google_gmail",
            Credential.is_active == True,
        ).first()

        if existing:
            existing.encrypted_data = encrypted_data
            existing.encryption_key_id = key_id
            existing.name = f"Gmail - {gmail_email}"
            db.commit()
        else:
            credential = Credential(
                workspace_id=UUID(workspace_id),
                name=f"Gmail - {gmail_email}",
                credential_type=CredentialType.OAUTH2,
                provider="google_gmail",
                encrypted_data=encrypted_data,
                encryption_key_id=key_id,
                created_by=UUID(user_id),
                is_active=True,
            )
            db.add(credential)
            db.commit()

        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/credentials?gmail_connected=true",
            status_code=302,
        )

    elif provider == "calendly":
        # Calendly OAuth token exchange
        from app.core.config import settings as app_settings
        if not app_settings.CALENDLY_CLIENT_ID or not app_settings.CALENDLY_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Calendly OAuth not configured"
            )

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://auth.calendly.com/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.google_redirect_uri,
                    "client_id": app_settings.CALENDLY_CLIENT_ID,
                    "client_secret": app_settings.CALENDLY_CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if token_response.status_code != 200:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/settings/credentials?calendly_error=token_exchange_failed",
                status_code=302,
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 7200)

        if not access_token:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/settings/credentials?calendly_error=no_access_token",
                status_code=302,
            )

        # Get Calendly user info
        calendly_name = "Calendly Account"
        calendly_uri = ""
        try:
            async with httpx.AsyncClient() as client:
                user_resp = await client.get(
                    "https://api.calendly.com/users/me",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if user_resp.status_code == 200:
                    user_data = user_resp.json().get("resource", {})
                    calendly_name = user_data.get("name", "Calendly Account")
                    calendly_uri = user_data.get("uri", "")
        except Exception:
            pass

        # Encrypt and store credential
        expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
        credential_data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": expires_in,
            "expires_at": expires_at,
            "user_name": calendly_name,
            "user_uri": calendly_uri,
            "client_id": app_settings.CALENDLY_CLIENT_ID,
            "client_secret": app_settings.CALENDLY_CLIENT_SECRET,
        }

        encrypted_data, key_id = credential_service.encrypt_with_key_id(credential_data)

        existing = db.query(Credential).filter(
            Credential.workspace_id == UUID(workspace_id),
            Credential.provider == "calendly",
            Credential.is_active == True,
        ).first()

        if existing:
            existing.encrypted_data = encrypted_data
            existing.encryption_key_id = key_id
            existing.name = f"Calendly - {calendly_name}"
            db.commit()
        else:
            credential = Credential(
                workspace_id=UUID(workspace_id),
                name=f"Calendly - {calendly_name}",
                credential_type=CredentialType.OAUTH2,
                provider="calendly",
                encrypted_data=encrypted_data,
                encryption_key_id=key_id,
                created_by=UUID(user_id),
                is_active=True,
            )
            db.add(credential)
            db.commit()

        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/credentials?calendly_connected=true",
            status_code=302,
        )

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported provider")
