"""
API dependencies for FastAPI routes.

WHY:
- Provide reusable dependencies for all routes
- Handle database sessions
- Handle authentication/authorization
- Keep route handlers clean and focused

HOW:
- Database: get_db provides session via dependency injection
- Auth: get_current_user extracts and validates JWT token
"""

from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import get_db as get_database_session
from app.core.security import decode_token
from app.models.user import User
from app.models.workspace import Workspace


# Re-export get_db for convenience
def get_db() -> Generator[Session, None, None]:
    """
    Provide database session to route handlers.

    WHY: Dependency injection pattern for database access
    HOW: Yields session, closes it after request completes

    Usage:
        @router.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()
    """
    yield from get_database_session()


# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get currently authenticated user from JWT token.

    WHY: Protect routes that require authentication
    HOW: Extract token from Authorization header, decode, lookup user

    Args:
        credentials: HTTP Bearer token from header
        db: Database session

    Returns:
        User object if token valid

    Raises:
        HTTPException(401): If token invalid, expired, or user not found

    Usage:
        @router.get("/me")
        def get_profile(user: User = Depends(get_current_user)):
            return {"username": user.username}
    """
    # Extract token from "Bearer <token>"
    token = credentials.credentials

    # Decode and verify JWT
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    # Lookup user in database
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive"
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current user and verify account is active.

    WHY: Additional check for active account status
    HOW: Builds on get_current_user, adds is_active check

    Note: get_current_user already checks is_active, so this is redundant
    but kept for explicit clarity and future extension.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_user_with_org(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> tuple[User, str, str | None]:
    """
    Get authenticated user with validated organization context.

    WHY: Org-scoped endpoints need to ensure user has valid organization
    HOW: Validates JWT, verifies org_id exists and user is a member

    This dependency is for ORGANIZATION-SCOPED resources like:
    - Chatbots, Chatflows, Knowledge Bases
    - Workspaces (within an org)
    - Org-level analytics

    For USER-LEVEL resources (profile, create org, invitations),
    use get_current_user instead.

    Args:
        credentials: HTTP Bearer token from header
        db: Database session

    Returns:
        Tuple of (User, org_id: str, ws_id: str | None)

    Raises:
        HTTPException(401): Invalid token or inactive user
        HTTPException(400): No organization or org deleted
            - Returns structured error with action_required field
            - Frontend can catch this and show "Create Organization" prompt

    Usage:
        @router.post("/chatbots")
        def create_chatbot(
            user_and_org: tuple = Depends(get_current_user_with_org),
            db: Session = Depends(get_db)
        ):
            user, org_id, ws_id = user_and_org
            # Now safe to create chatbot in org context
    """
    from uuid import UUID
    from app.models.organization_member import OrganizationMember
    from app.models.organization import Organization

    # Extract and decode token
    token = credentials.credentials

    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        org_id: str | None = payload.get("org_id")
        ws_id: str | None = payload.get("ws_id")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    # Lookup user in database
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive"
        )

    # CRITICAL: Validate organization context
    if not org_id:
        # User has no organization in JWT
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "NO_ORGANIZATION",
                "message": "You need an organization to access this resource.",
                "action_required": "CREATE_ORGANIZATION",
                "suggestions": [
                    "Create a new organization",
                    "Accept a pending invitation"
                ]
            }
        )

    # Verify organization exists and user is a member
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user_id
    ).first()

    if not org_member:
        # Organization was deleted or user was removed
        org_exists = db.query(Organization).filter(
            Organization.id == org_id
        ).first()

        if not org_exists:
            error_detail = {
                "error_code": "ORGANIZATION_DELETED",
                "message": "Your organization was deleted. Please create a new one.",
                "action_required": "CREATE_ORGANIZATION",
                "suggestions": [
                    "Create a new organization",
                    "Accept a pending invitation"
                ]
            }
        else:
            error_detail = {
                "error_code": "NO_ORGANIZATION_ACCESS",
                "message": "You no longer have access to this organization.",
                "action_required": "CREATE_ORGANIZATION",
                "suggestions": [
                    "Create a new organization",
                    "Accept a pending invitation"
                ]
            }

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail
        )

    # All validations passed - return user with org context
    return (user, org_id, ws_id)


async def get_current_workspace(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Workspace:
    """
    Get current workspace from JWT token and validate access.

    WHY: Workspace-scoped endpoints need to ensure valid workspace context
    HOW: Extract workspace ID from JWT, verify it exists and user has access

    Args:
        credentials: HTTP Bearer token from header
        db: Database session

    Returns:
        Workspace object if valid

    Raises:
        HTTPException(401): Invalid token or inactive user
        HTTPException(404): Workspace not found or no access

    Usage:
        @router.get("/endpoint")
        def my_endpoint(workspace: Workspace = Depends(get_current_workspace)):
            # Use workspace.id for filtering
    """
    from app.models.organization_member import OrganizationMember

    # Get user and org context first
    user, org_id, ws_id = await get_current_user_with_org(credentials, db)

    # If no workspace in token, we need to handle this case
    if not ws_id:
        # For backward compatibility, we could get the default workspace for the org
        # or require workspace to be specified in the token
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "NO_WORKSPACE_CONTEXT",
                "message": "No workspace specified in authentication token.",
                "action_required": "SWITCH_WORKSPACE"
            }
        )

    # Verify workspace exists and belongs to the org
    workspace = db.query(Workspace).filter(
        Workspace.id == ws_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )

    # Verify user has access to this workspace via organization membership
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id
    ).first()

    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to workspace"
        )

    return workspace
