"""
Integration Routes - API endpoints for cloud service integrations.

WHY:
- List pages/documents from connected cloud services
- Bridge between OAuth credentials and content import

HOW:
- Use stored credentials to authenticate with external APIs
- Return normalized data for frontend consumption
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.models.credential import Credential
from app.services.credential_service import credential_service
from app.integrations.notion_adapter import notion_adapter
from app.integrations.google_adapter import google_adapter

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/notion/pages")
async def list_notion_pages(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List pages from connected Notion workspace.

    Requires an active Notion credential (OAuth) in the workspace.
    Returns pages shared with the Notion integration.
    """
    # Find active Notion credential for this workspace
    credential = db.query(Credential).filter(
        Credential.workspace_id == workspace_id,
        Credential.provider == "notion",
        Credential.is_active == True,
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notion not connected. Please connect your Notion workspace first."
        )

    # Decrypt credential to get access token
    try:
        decrypted = credential_service.get_decrypted_data(db, credential)
        access_token = decrypted.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Notion credential missing access token"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to decrypt Notion credential: {str(e)}"
        )

    # Fetch pages from Notion
    try:
        pages = await notion_adapter.list_workspace_pages(access_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch Notion pages: {str(e)}"
        )

    return {"pages": pages}


@router.get("/google/files")
async def list_google_files(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    file_type: Optional[str] = Query(None, description="Filter: 'document' or 'spreadsheet'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List files from connected Google Drive.

    Requires an active Google credential (OAuth) in the workspace.
    Returns Google Docs and Sheets accessible to the connected account.
    """
    # Find active Google credential for this workspace
    credential = db.query(Credential).filter(
        Credential.workspace_id == workspace_id,
        Credential.provider == "google",
        Credential.is_active == True,
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Google not connected. Please connect your Google account first."
        )

    # Get valid access token (auto-refreshes if expired)
    try:
        access_token = await credential_service.get_google_access_token(db, credential)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {str(e)}. Please reconnect your Google account."
        )

    # Fetch files from Google Drive
    try:
        files = await google_adapter.list_drive_files(
            access_token,
            file_type=file_type
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch Google Drive files: {str(e)}"
        )

    return {"files": files}
