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
- Multi-tenant access control
- Credential validation

PSEUDOCODE follows the existing codebase patterns.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.models.credential import Credential, CredentialType
from app.services.credential_service import credential_service

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.post("/")
async def create_credential(
    workspace_id: UUID,
    credential_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new credential.

    WHY: Store API keys for integrations
    HOW: Encrypt with Fernet, save to DB

    BODY:
        {
            "name": "OpenAI API Key",
            "credential_type": "openai",
            "data": {
                "api_key": "sk-..."
            }
        }

    RETURNS:
        {
            "credential_id": "uuid",
            "name": "OpenAI API Key",
            "credential_type": "openai",
            "is_active": true
        }
    """

    from app.models.workspace import Workspace

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Validate credential type
    try:
        cred_type = CredentialType(credential_data["credential_type"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid credential type: {credential_data['credential_type']}"
        )

    # Encrypt credential data
    encrypted_data, key_id = credential_service.encrypt_credential_data(
        credential_data["data"]
    )

    # Create credential
    credential = Credential(
        workspace_id=workspace_id,
        name=credential_data["name"],
        credential_type=cred_type,
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
        "is_active": credential.is_active
    }


@router.get("/")
async def list_credentials(
    workspace_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all credentials in workspace.

    WHY: Display credentials in dashboard
    HOW: Query database (exclude encrypted data)

    RETURNS:
        {
            "items": [
                {
                    "id": "uuid",
                    "name": "OpenAI API Key",
                    "credential_type": "openai",
                    "is_active": true,
                    "usage_count": 42,
                    "last_used_at": "2025-10-01T12:00:00Z"
                }
            ],
            "total": 5,
            "skip": 0,
            "limit": 50
        }
    """

    from app.models.workspace import Workspace

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Get credentials (exclude encrypted_data)
    query = db.query(Credential).filter(
        Credential.workspace_id == workspace_id
    )

    total = query.count()
    credentials = query.offset(skip).limit(limit).all()

    # Format response (exclude encrypted data)
    items = [
        {
            "id": str(cred.id),
            "name": cred.name,
            "credential_type": cred.credential_type.value,
            "is_active": cred.is_active,
            "usage_count": cred.usage_count,
            "last_used_at": cred.last_used_at.isoformat() if cred.last_used_at else None,
            "created_at": cred.created_at.isoformat()
        }
        for cred in credentials
    ]

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{credential_id}")
async def get_credential(
    credential_id: UUID,
    include_data: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get single credential by ID.

    WHY: View credential details
    HOW: Query database, optionally decrypt

    QUERY PARAMS:
        include_data: If true, include decrypted data (use carefully)

    RETURNS:
        {
            "id": "uuid",
            "name": "OpenAI API Key",
            "credential_type": "openai",
            "is_active": true,
            "data": {...}  // Only if include_data=true
        }
    """

    credential = db.query(Credential).filter(
        Credential.id == credential_id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == credential.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    result = {
        "id": str(credential.id),
        "name": credential.name,
        "credential_type": credential.credential_type.value,
        "is_active": credential.is_active,
        "usage_count": credential.usage_count,
        "last_used_at": credential.last_used_at.isoformat() if credential.last_used_at else None,
        "created_at": credential.created_at.isoformat()
    }

    # Optionally include decrypted data
    if include_data:
        try:
            decrypted_data = credential_service.get_decrypted_data(db, credential)
            result["data"] = decrypted_data
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to decrypt credential: {str(e)}"
            )

    return result


@router.patch("/{credential_id}")
async def update_credential(
    credential_id: UUID,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update credential.

    WHY: Modify credential settings or rotate keys
    HOW: Update database, re-encrypt if data changed

    BODY:
        {
            "name": "Updated Name",
            "is_active": false,
            "data": {  // Optional - re-encrypt if provided
                "api_key": "sk-new..."
            }
        }
    """

    credential = db.query(Credential).filter(
        Credential.id == credential_id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == credential.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update name and is_active
    if "name" in updates:
        credential.name = updates["name"]

    if "is_active" in updates:
        credential.is_active = updates["is_active"]

    # Re-encrypt data if provided
    if "data" in updates:
        encrypted_data, key_id = credential_service.encrypt_credential_data(
            updates["data"]
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete credential.

    WHY: Remove credential
    HOW: Soft delete or hard delete

    NOTE: Check if credential is in use by chatflows before deleting
    """

    credential = db.query(Credential).filter(
        Credential.id == credential_id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == credential.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # TODO: Check if credential is in use by chatflows
    # If in use, prevent deletion or warn user

    # Hard delete
    db.delete(credential)
    db.commit()

    return {"status": "deleted"}


@router.post("/{credential_id}/test")
async def test_credential(
    credential_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Test credential validity.

    WHY: Verify credential works before using
    HOW: Make test API call based on credential type

    RETURNS:
        {
            "is_valid": true,
            "message": "Connection successful",
            "metadata": {...}  // API-specific info
        }
    """

    credential = db.query(Credential).filter(
        Credential.id == credential_id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == credential.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Test credential based on type
    try:
        result = await credential_service.test_credential(db, credential)
        return result
    except Exception as e:
        return {
            "is_valid": False,
            "message": str(e),
            "metadata": {}
        }


@router.get("/{credential_id}/usage")
async def get_credential_usage(
    credential_id: UUID,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get credential usage statistics.

    WHY: Monitor credential usage
    HOW: Aggregate from usage logs

    RETURNS:
        {
            "total_uses": 1234,
            "last_used_at": "2025-10-01T12:00:00Z",
            "usage_by_day": [
                {"date": "2025-10-01", "count": 150},
                {"date": "2025-10-02", "count": 200}
            ]
        }
    """

    credential = db.query(Credential).filter(
        Credential.id == credential_id
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == credential.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # TODO: Implement usage tracking and aggregation

    return {
        "total_uses": credential.usage_count,
        "last_used_at": credential.last_used_at.isoformat() if credential.last_used_at else None,
        "usage_by_day": []
    }
