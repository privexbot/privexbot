"""
KB RBAC Service - Role-Based Access Control for Knowledge Bases.

WHY:
- Granular access control for knowledge bases
- Multi-user collaboration with different permission levels
- Secure access to KB operations
- Flexible permission model (creator + workspace + KB members)

HOW:
- 3-tier permission system: admin, editor, viewer
- Permission hierarchy: KB creator > workspace admin > KB member
- Database-backed access control
- Integration with audit logging
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.kb_member import KBMember
from app.models.knowledge_base import KnowledgeBase
from app.models.user import User
from app.models.workspace_member import WorkspaceMember


# Permission definitions for KB roles
KB_PERMISSIONS = {
    "admin": [
        "read",
        "edit",
        "delete",
        "reindex",
        "manage_members",
        "view_analytics"
    ],
    "editor": [
        "read",
        "edit",
        "reindex",
        "view_analytics"
    ],
    "viewer": [
        "read",
        "view_analytics"
    ]
}


def add_kb_member(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    role: str,
    added_by: UUID
) -> KBMember:
    """
    Add a member to a knowledge base.

    WHY: Enable collaborative KB management
    HOW: Create KB member record with specified role

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user to add
        role: Role to assign (admin, editor, viewer)
        added_by: UUID of user adding the member

    Returns:
        Created KBMember object

    Raises:
        HTTPException: If KB not found, user already member, or invalid role
    """
    # Validate role
    if role not in KB_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {role}. Must be one of: admin, editor, viewer"
        )

    # Verify KB exists
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Verify adder has permission to manage members
    if not has_kb_permission(db, kb_id, added_by, "manage_members"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage KB members"
        )

    # Check if user is already a member
    existing = db.query(KBMember).filter(
        KBMember.kb_id == kb_id,
        KBMember.user_id == user_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this knowledge base"
        )

    # Create KB member
    try:
        member = KBMember(
            kb_id=kb_id,
            user_id=user_id,
            role=role,
            added_by=added_by
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return member
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to add member"
        )


def remove_kb_member(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    removed_by: UUID
) -> None:
    """
    Remove a member from a knowledge base.

    WHY: Revoke access when collaboration ends
    HOW: Delete KB member record

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user to remove
        removed_by: UUID of user removing the member

    Raises:
        HTTPException: If member not found or no permission
    """
    # Verify remover has permission
    if not has_kb_permission(db, kb_id, removed_by, "manage_members"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage KB members"
        )

    # Prevent removing the KB creator
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if kb and kb.created_by == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove KB creator"
        )

    # Find and delete member
    member = db.query(KBMember).filter(
        KBMember.kb_id == kb_id,
        KBMember.user_id == user_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this knowledge base"
        )

    db.delete(member)
    db.commit()


def update_kb_member_role(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    new_role: str,
    updated_by: UUID
) -> KBMember:
    """
    Update a KB member's role.

    WHY: Change permissions as collaboration needs evolve
    HOW: Update role field in KB member record

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user whose role to update
        new_role: New role to assign
        updated_by: UUID of user making the change

    Returns:
        Updated KBMember object

    Raises:
        HTTPException: If member not found, invalid role, or no permission
    """
    # Validate role
    if new_role not in KB_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {new_role}. Must be one of: admin, editor, viewer"
        )

    # Verify updater has permission
    if not has_kb_permission(db, kb_id, updated_by, "manage_members"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage KB members"
        )

    # Prevent changing the KB creator's role
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if kb and kb.created_by == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change KB creator's role"
        )

    # Find and update member
    member = db.query(KBMember).filter(
        KBMember.kb_id == kb_id,
        KBMember.user_id == user_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this knowledge base"
        )

    old_role = member.role
    member.role = new_role
    db.commit()
    db.refresh(member)
    return member


def list_kb_members(
    db: Session,
    kb_id: UUID,
    requesting_user_id: UUID
) -> List[KBMember]:
    """
    List all members of a knowledge base.

    WHY: View who has access to KB
    HOW: Query all KB members with user details

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        requesting_user_id: UUID of user requesting the list

    Returns:
        List of KBMember objects with relationships loaded

    Raises:
        HTTPException: If no read permission
    """
    # Verify user has read permission
    if not has_kb_permission(db, kb_id, requesting_user_id, "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this KB"
        )

    # Get all members
    members = db.query(KBMember).filter(
        KBMember.kb_id == kb_id
    ).all()

    return members


def has_kb_permission(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    permission: str
) -> bool:
    """
    Check if user has specific permission on a knowledge base.

    WHY: Centralized permission checking
    HOW: Check creator, workspace admin, or KB member role

    Permission Hierarchy:
        1. KB creator - full access (all permissions)
        2. Workspace admin - full access (all permissions)
        3. KB member - role-based permissions

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user to check
        permission: Permission to check (read, edit, delete, reindex, manage_members, view_analytics)

    Returns:
        True if user has permission, False otherwise
    """
    # Get KB
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        return False

    # Check 1: Is user the KB creator?
    if kb.created_by == user_id:
        return True  # Creator has all permissions

    # Check 2: Is user a workspace admin?
    workspace_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == kb.workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()

    if workspace_member and workspace_member.role == "admin":
        return True  # Workspace admins have all KB permissions

    # Check 3: Is user a KB member with the required permission?
    kb_member = db.query(KBMember).filter(
        KBMember.kb_id == kb_id,
        KBMember.user_id == user_id
    ).first()

    if kb_member:
        # Check if role has the required permission
        role_permissions = KB_PERMISSIONS.get(kb_member.role, [])
        return permission in role_permissions

    # No access
    return False


def get_user_kb_role(
    db: Session,
    kb_id: UUID,
    user_id: UUID
) -> Optional[str]:
    """
    Get user's effective role for a knowledge base.

    WHY: Determine what UI elements to show
    HOW: Check creator, workspace admin, or KB member

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user

    Returns:
        Role string (admin, editor, viewer) or None if no access
    """
    # Get KB
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        return None

    # Check if creator
    if kb.created_by == user_id:
        return "admin"

    # Check if workspace admin
    workspace_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == kb.workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()

    if workspace_member and workspace_member.role == "admin":
        return "admin"

    # Check KB member role
    kb_member = db.query(KBMember).filter(
        KBMember.kb_id == kb_id,
        KBMember.user_id == user_id
    ).first()

    if kb_member:
        return kb_member.role

    # No access
    return None


def get_user_kb_permissions(
    db: Session,
    kb_id: UUID,
    user_id: UUID
) -> List[str]:
    """
    Get list of all permissions user has on a KB.

    WHY: Return complete permission set for frontend
    HOW: Get role and map to permissions

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user

    Returns:
        List of permission strings
    """
    role = get_user_kb_role(db, kb_id, user_id)
    if not role:
        return []

    return KB_PERMISSIONS.get(role, [])


def verify_kb_access(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    required_permission: str
) -> KnowledgeBase:
    """
    Verify user has permission and return KB.

    WHY: Common pattern in API endpoints
    HOW: Check permission and fetch KB in one call

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user
        required_permission: Permission required to access

    Returns:
        KnowledgeBase object if access granted

    Raises:
        HTTPException: If KB not found or no permission
    """
    # Get KB
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Check permission
    if not has_kb_permission(db, kb_id, user_id, required_permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have '{required_permission}' permission on this knowledge base"
        )

    return kb


def get_accessible_kbs(
    db: Session,
    user_id: UUID,
    workspace_id: UUID
) -> List[KnowledgeBase]:
    """
    Get all KBs user has access to in a workspace.

    WHY: Show user's KB list in UI
    HOW: Query creator KBs + member KBs + workspace admin KBs

    Args:
        db: Database session
        user_id: UUID of user
        workspace_id: UUID of workspace

    Returns:
        List of KnowledgeBase objects user can access
    """
    accessible_kb_ids = set()

    # 1. KBs created by user
    created_kbs = db.query(KnowledgeBase).filter(
        KnowledgeBase.workspace_id == workspace_id,
        KnowledgeBase.created_by == user_id
    ).all()
    accessible_kb_ids.update([kb.id for kb in created_kbs])

    # 2. KBs where user is a member
    kb_memberships = db.query(KBMember).filter(
        KBMember.user_id == user_id
    ).all()

    for membership in kb_memberships:
        # Verify KB is in the workspace
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == membership.kb_id,
            KnowledgeBase.workspace_id == workspace_id
        ).first()
        if kb:
            accessible_kb_ids.add(kb.id)

    # 3. If workspace admin, all KBs in workspace
    workspace_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()

    if workspace_member and workspace_member.role == "admin":
        all_workspace_kbs = db.query(KnowledgeBase).filter(
            KnowledgeBase.workspace_id == workspace_id
        ).all()
        accessible_kb_ids.update([kb.id for kb in all_workspace_kbs])

    # Fetch all accessible KBs
    if not accessible_kb_ids:
        return []

    kbs = db.query(KnowledgeBase).filter(
        KnowledgeBase.id.in_(accessible_kb_ids)
    ).all()

    return kbs
