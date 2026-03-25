"""
File management routes - Avatar uploads, KB file downloads, chat file uploads.

Endpoints:
  POST   /files/avatars/{entity_type}/{entity_id}  - Upload avatar
  DELETE /files/avatars/{entity_type}/{entity_id}  - Delete avatar
"""

import time
import uuid
from typing import Literal

import magic
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user, get_current_workspace
from app.db.session import get_db
from app.models.chatbot import Chatbot
from app.models.organization import Organization
from app.models.user import User
from app.models.workspace import Workspace
from app.services.storage_service import BUCKET_AVATARS, storage_service

router = APIRouter(prefix="/files", tags=["files"])

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2MB

ENTITY_TYPE_LITERAL = Literal["orgs", "workspaces", "chatbots", "users"]


def _get_extension(content_type: str) -> str:
    """Map MIME type to file extension."""
    mapping = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    return mapping.get(content_type, "bin")


@router.post("/avatars/{entity_type}/{entity_id}")
async def upload_avatar(
    entity_type: ENTITY_TYPE_LITERAL,
    entity_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload an avatar image for an entity.

    Validates image type (JPEG/PNG/WebP/GIF), max 2MB, and user permission.
    Stores in MinIO avatars bucket and updates the entity's avatar_url.
    """
    # Read file content
    content = await file.read()

    # Validate size
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_AVATAR_SIZE // (1024 * 1024)}MB",
        )

    # Validate MIME type using python-magic (checks actual content, not extension)
    detected_type = magic.from_buffer(content, mime=True)
    if detected_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image type: {detected_type}. Allowed: JPEG, PNG, WebP, GIF",
        )

    # Look up entity and verify permission
    entity = _get_entity_with_permission(
        db, entity_type, entity_id, current_user
    )

    # Build object key
    ext = _get_extension(detected_type)
    object_key = f"{entity_type}/{entity_id}/avatar.{ext}"

    # Delete old avatar if exists (different extension)
    _delete_existing_avatar(entity_type, entity_id)

    # Upload to MinIO
    storage_service.upload_file(
        bucket=BUCKET_AVATARS,
        object_key=object_key,
        data=content,
        content_type=detected_type,
    )

    # Get public URL with cache-busting timestamp
    base_url = storage_service.get_public_url(BUCKET_AVATARS, object_key)
    # Add timestamp to force browser to fetch new image (cache busting)
    avatar_url = f"{base_url}?t={int(time.time())}"

    if entity_type == "chatbots":
        # Chatbot stores avatar in branding_config JSONB
        branding = dict(entity.branding_config or {})
        branding["avatar_url"] = avatar_url
        entity.branding_config = branding
    else:
        entity.avatar_url = avatar_url

    db.commit()

    return {"avatar_url": avatar_url}


@router.delete("/avatars/{entity_type}/{entity_id}")
async def delete_avatar(
    entity_type: ENTITY_TYPE_LITERAL,
    entity_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete an avatar image for an entity.

    Removes from MinIO and sets avatar_url to NULL in the database.
    """
    entity = _get_entity_with_permission(
        db, entity_type, entity_id, current_user
    )

    # Delete all avatar files for this entity (any extension)
    _delete_existing_avatar(entity_type, entity_id)

    # Clear avatar_url in database
    if entity_type == "chatbots":
        branding = dict(entity.branding_config or {})
        branding.pop("avatar_url", None)
        entity.branding_config = branding
    else:
        entity.avatar_url = None

    db.commit()

    return {"message": "Avatar deleted"}


def _delete_existing_avatar(entity_type: str, entity_id: str) -> None:
    """Delete all avatar files for an entity prefix."""
    prefix = f"{entity_type}/{entity_id}/"
    storage_service.delete_prefix(BUCKET_AVATARS, prefix)


def _get_entity_with_permission(
    db: Session,
    entity_type: str,
    entity_id: str,
    current_user: User,
):
    """
    Look up the entity and verify the current user has permission to modify it.

    Returns the entity ORM object.
    Raises HTTPException 404 if not found, 403 if no permission.
    """
    try:
        entity_uuid = uuid.UUID(entity_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid entity ID format",
        )

    if entity_type == "users":
        # Users can only change their own avatar
        if entity_uuid != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only modify your own avatar",
            )
        # Query user fresh from db session to ensure proper session attachment
        # This ensures db.commit() will persist the avatar_url change
        user = db.query(User).filter(User.id == entity_uuid).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    if entity_type == "orgs":
        org = db.query(Organization).filter(
            Organization.id == entity_uuid
        ).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        # Verify user is a member of this organization
        from app.models.organization_member import OrganizationMember
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == entity_uuid,
            OrganizationMember.user_id == current_user.id,
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        return org

    if entity_type == "workspaces":
        ws = db.query(Workspace).filter(
            Workspace.id == entity_uuid
        ).first()
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")
        # Verify user is a member of the parent organization
        from app.models.organization_member import OrganizationMember
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == ws.organization_id,
            OrganizationMember.user_id == current_user.id,
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this workspace's organization")
        return ws

    if entity_type == "chatbots":
        chatbot = db.query(Chatbot).filter(
            Chatbot.id == entity_uuid
        ).first()
        if not chatbot:
            raise HTTPException(status_code=404, detail="Chatbot not found")
        # Verify user is a member of the chatbot's workspace organization
        ws = db.query(Workspace).filter(
            Workspace.id == chatbot.workspace_id
        ).first()
        if ws:
            from app.models.organization_member import OrganizationMember
            membership = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == ws.organization_id,
                OrganizationMember.user_id == current_user.id,
            ).first()
            if not membership:
                raise HTTPException(status_code=403, detail="Not a member of this chatbot's organization")
        return chatbot

    raise HTTPException(status_code=400, detail=f"Unknown entity type: {entity_type}")
