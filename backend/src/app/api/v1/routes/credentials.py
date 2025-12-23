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

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user, get_current_workspace
from app.models.user import User
from app.models.workspace import Workspace
from app.models.credential import Credential, CredentialType
from app.services.credential_service import credential_service
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
            "name": "OpenAI API Key",
            "credential_type": "api_key",
            "data": {
                "api_key": "sk-..."
            }
        }

    RETURNS:
        {
            "credential_id": "uuid",
            "name": "OpenAI API Key",
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
        provider: Filter by service provider (e.g., "telegram", "discord", "openai")

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
