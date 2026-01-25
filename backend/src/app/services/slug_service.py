"""
Slug Service - Manage slug updates with history tracking and redirects.

WHY:
- Allow users to change slugs while maintaining backward-compatible URLs
- Prevent confusion/security issues from immediate slug reuse after deletion
- Provide 301 redirects from old slugs to new ones

HOW:
- Validate slug format and uniqueness
- Track old slugs in slug_history table
- Resolve slugs by checking current entities first, then history
- Enforce cooldown period for deleted slugs
"""

import re
from datetime import datetime, timedelta
from typing import Optional, Tuple, Literal
from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.workspace import Workspace
from app.models.chatbot import Chatbot
from app.models.slug_history import SlugHistory


# Reserved words that cannot be used as slugs
RESERVED_SLUGS = frozenset({
    'api', 'admin', 'public', 'static', 'assets', 'health',
    'docs', 'schema', 'openapi', 'auth', 'login', 'logout',
    'register', 'signup', 'settings', 'config', 'system',
    'internal', 'private', 'new', 'create', 'edit', 'delete',
})

# Slug validation pattern: lowercase alphanumeric with hyphens
# Must start and end with alphanumeric, 2-100 characters
SLUG_PATTERN = re.compile(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$')
SLUG_SINGLE_CHAR_PATTERN = re.compile(r'^[a-z0-9]$')  # For 1-char slugs

# Cooldown period for deleted slugs (days)
SLUG_COOLDOWN_DAYS = 30


class SlugService:
    """
    Service for managing slugs with history tracking.

    Handles:
    - Slug validation (format, uniqueness, reserved words)
    - Slug updates with automatic history recording
    - Slug resolution with redirect support
    - Cooldown enforcement for deleted slugs
    """

    def validate_slug_format(self, slug: str) -> Tuple[bool, Optional[str]]:
        """
        Validate slug format.

        Args:
            slug: The slug to validate

        Returns:
            (is_valid, error_message)
        """
        if not slug:
            return False, "Slug cannot be empty"

        if len(slug) < 2:
            return False, "Slug must be at least 2 characters"

        if len(slug) > 100:
            return False, "Slug cannot exceed 100 characters"

        if slug in RESERVED_SLUGS:
            return False, f"'{slug}' is a reserved word and cannot be used as a slug"

        # Check pattern
        if len(slug) == 1:
            if not SLUG_SINGLE_CHAR_PATTERN.match(slug):
                return False, "Single character slugs must be alphanumeric"
        else:
            if not SLUG_PATTERN.match(slug):
                return False, (
                    "Slug must contain only lowercase letters, numbers, and hyphens. "
                    "Must start and end with a letter or number."
                )

        # Check for consecutive hyphens
        if '--' in slug:
            return False, "Slug cannot contain consecutive hyphens"

        return True, None

    def is_workspace_slug_available(
        self,
        db: Session,
        slug: str,
        exclude_workspace_id: Optional[UUID] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a workspace slug is available (globally unique).

        Args:
            db: Database session
            slug: The slug to check
            exclude_workspace_id: Workspace ID to exclude (for updates)

        Returns:
            (is_available, reason_if_not)
        """
        # Check format first
        is_valid, error = self.validate_slug_format(slug)
        if not is_valid:
            return False, error

        # Check if slug exists on another workspace
        query = db.query(Workspace).filter(Workspace.slug == slug)
        if exclude_workspace_id:
            query = query.filter(Workspace.id != exclude_workspace_id)

        if query.first():
            return False, "This slug is already in use by another workspace"

        # Check cooldown from deleted workspaces
        cooldown_entry = db.query(SlugHistory).filter(
            SlugHistory.entity_type == 'workspace',
            SlugHistory.old_slug == slug,
            SlugHistory.workspace_id.is_(None),  # Global scope for workspace slugs
            SlugHistory.new_slug.is_(None),  # Was deleted, not renamed
            SlugHistory.expires_at > datetime.utcnow()  # Still in cooldown
        ).first()

        if cooldown_entry:
            days_remaining = (cooldown_entry.expires_at - datetime.utcnow()).days + 1
            return False, (
                f"This slug was recently used and is in a {days_remaining}-day cooldown period"
            )

        return True, None

    def is_chatbot_slug_available(
        self,
        db: Session,
        slug: str,
        workspace_id: UUID,
        exclude_chatbot_id: Optional[UUID] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a chatbot slug is available within a workspace.

        Args:
            db: Database session
            slug: The slug to check
            workspace_id: The workspace to check within
            exclude_chatbot_id: Chatbot ID to exclude (for updates)

        Returns:
            (is_available, reason_if_not)
        """
        # Check format first
        is_valid, error = self.validate_slug_format(slug)
        if not is_valid:
            return False, error

        # Check if slug exists on another chatbot in this workspace
        query = db.query(Chatbot).filter(
            Chatbot.workspace_id == workspace_id,
            Chatbot.slug == slug
        )
        if exclude_chatbot_id:
            query = query.filter(Chatbot.id != exclude_chatbot_id)

        if query.first():
            return False, "This slug is already in use by another chatbot in this workspace"

        # Check cooldown from deleted chatbots in this workspace
        cooldown_entry = db.query(SlugHistory).filter(
            SlugHistory.entity_type == 'chatbot',
            SlugHistory.old_slug == slug,
            SlugHistory.workspace_id == workspace_id,
            SlugHistory.new_slug.is_(None),  # Was deleted, not renamed
            SlugHistory.expires_at > datetime.utcnow()  # Still in cooldown
        ).first()

        if cooldown_entry:
            days_remaining = (cooldown_entry.expires_at - datetime.utcnow()).days + 1
            return False, (
                f"This slug was recently used and is in a {days_remaining}-day cooldown period"
            )

        return True, None

    def update_workspace_slug(
        self,
        db: Session,
        workspace_id: UUID,
        new_slug: str,
        changed_by: UUID
    ) -> dict:
        """
        Update a workspace's slug with history tracking.

        Args:
            db: Database session
            workspace_id: The workspace to update
            new_slug: The new slug
            changed_by: User making the change

        Returns:
            {
                "success": True,
                "old_slug": "...",
                "new_slug": "...",
                "redirect_active": True
            }

        Raises:
            HTTPException: If validation fails or workspace not found
        """
        # Get workspace
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        old_slug = workspace.slug

        # If slug is the same, nothing to do
        if old_slug == new_slug:
            return {
                "success": True,
                "old_slug": old_slug,
                "new_slug": new_slug,
                "redirect_active": False,
                "message": "Slug unchanged"
            }

        # Check if new slug is available
        is_available, reason = self.is_workspace_slug_available(
            db, new_slug, exclude_workspace_id=workspace_id
        )
        if not is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=reason
            )

        # Record old slug in history (only if there was an old slug)
        if old_slug:
            history_entry = SlugHistory(
                entity_type='workspace',
                entity_id=workspace_id,
                old_slug=old_slug,
                new_slug=new_slug,
                workspace_id=None,  # Workspace slugs are globally scoped
                changed_by=changed_by,
                expires_at=None  # Redirect forever (not a deletion)
            )
            db.add(history_entry)

        # Update workspace slug
        workspace.slug = new_slug

        db.commit()
        db.refresh(workspace)

        return {
            "success": True,
            "old_slug": old_slug,
            "new_slug": new_slug,
            "redirect_active": old_slug is not None
        }

    def update_chatbot_slug(
        self,
        db: Session,
        chatbot_id: UUID,
        new_slug: str,
        changed_by: UUID
    ) -> dict:
        """
        Update a chatbot's slug with history tracking.

        Args:
            db: Database session
            chatbot_id: The chatbot to update
            new_slug: The new slug
            changed_by: User making the change

        Returns:
            {
                "success": True,
                "old_slug": "...",
                "new_slug": "...",
                "redirect_active": True
            }

        Raises:
            HTTPException: If validation fails or chatbot not found
        """
        # Get chatbot
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not chatbot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chatbot not found"
            )

        old_slug = chatbot.slug

        # If slug is the same, nothing to do
        if old_slug == new_slug:
            return {
                "success": True,
                "old_slug": old_slug,
                "new_slug": new_slug,
                "redirect_active": False,
                "message": "Slug unchanged"
            }

        # Check if new slug is available
        is_available, reason = self.is_chatbot_slug_available(
            db, new_slug, chatbot.workspace_id, exclude_chatbot_id=chatbot_id
        )
        if not is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=reason
            )

        # Record old slug in history (only if there was an old slug)
        if old_slug:
            history_entry = SlugHistory(
                entity_type='chatbot',
                entity_id=chatbot_id,
                old_slug=old_slug,
                new_slug=new_slug,
                workspace_id=chatbot.workspace_id,  # Chatbot slugs are workspace-scoped
                changed_by=changed_by,
                expires_at=None  # Redirect forever (not a deletion)
            )
            db.add(history_entry)

        # Update chatbot slug
        chatbot.slug = new_slug

        db.commit()
        db.refresh(chatbot)

        return {
            "success": True,
            "old_slug": old_slug,
            "new_slug": new_slug,
            "redirect_active": old_slug is not None
        }

    def record_workspace_deletion(
        self,
        db: Session,
        workspace_id: UUID,
        slug: str,
        deleted_by: Optional[UUID] = None
    ) -> None:
        """
        Record a workspace slug for cooldown after deletion.

        Args:
            db: Database session
            workspace_id: The deleted workspace's ID
            slug: The slug that was in use
            deleted_by: User who deleted the workspace
        """
        if not slug:
            return

        history_entry = SlugHistory(
            entity_type='workspace',
            entity_id=workspace_id,
            old_slug=slug,
            new_slug=None,  # Deleted, no redirect
            workspace_id=None,
            changed_by=deleted_by,
            expires_at=datetime.utcnow() + timedelta(days=SLUG_COOLDOWN_DAYS)
        )
        db.add(history_entry)

    def record_chatbot_deletion(
        self,
        db: Session,
        chatbot_id: UUID,
        workspace_id: UUID,
        slug: str,
        deleted_by: Optional[UUID] = None
    ) -> None:
        """
        Record a chatbot slug for cooldown after deletion.

        Args:
            db: Database session
            chatbot_id: The deleted chatbot's ID
            workspace_id: The workspace the chatbot belonged to
            slug: The slug that was in use
            deleted_by: User who deleted the chatbot
        """
        if not slug:
            return

        history_entry = SlugHistory(
            entity_type='chatbot',
            entity_id=chatbot_id,
            old_slug=slug,
            new_slug=None,  # Deleted, no redirect
            workspace_id=workspace_id,
            changed_by=deleted_by,
            expires_at=datetime.utcnow() + timedelta(days=SLUG_COOLDOWN_DAYS)
        )
        db.add(history_entry)

    def resolve_workspace_slug(
        self,
        db: Session,
        slug: str
    ) -> Tuple[Optional[Workspace], Optional[str]]:
        """
        Resolve a workspace slug, checking history if not found directly.

        Args:
            db: Database session
            slug: The slug to resolve

        Returns:
            (workspace, redirect_slug) where:
            - If found directly: (workspace, None)
            - If found in history: (workspace, new_slug) - caller should redirect
            - If not found: (None, None)
        """
        # First try direct lookup
        workspace = db.query(Workspace).filter(Workspace.slug == slug).first()
        if workspace:
            return workspace, None

        # Check slug history
        history = db.query(SlugHistory).filter(
            SlugHistory.entity_type == 'workspace',
            SlugHistory.old_slug == slug,
            SlugHistory.workspace_id.is_(None),  # Global scope
            SlugHistory.new_slug.isnot(None)  # Has a redirect target
        ).order_by(SlugHistory.created_at.desc()).first()

        if history:
            # Found in history - get the current workspace
            workspace = db.query(Workspace).filter(
                Workspace.id == history.entity_id
            ).first()
            if workspace and workspace.slug:
                return workspace, workspace.slug

        return None, None

    def resolve_chatbot_slug(
        self,
        db: Session,
        workspace_slug: str,
        chatbot_slug: str
    ) -> Tuple[Optional[Workspace], Optional[Chatbot], Optional[str], Optional[str]]:
        """
        Resolve workspace and chatbot slugs, checking history for both.

        Args:
            db: Database session
            workspace_slug: The workspace slug
            chatbot_slug: The chatbot slug

        Returns:
            (workspace, chatbot, redirect_workspace_slug, redirect_chatbot_slug) where:
            - If both found directly: (workspace, chatbot, None, None)
            - If redirect needed: (workspace, chatbot, new_ws_slug, new_bot_slug)
            - If not found: (None, None, None, None) or partial results
        """
        # Resolve workspace first
        workspace, ws_redirect = self.resolve_workspace_slug(db, workspace_slug)
        if not workspace:
            return None, None, None, None

        # Now resolve chatbot within workspace
        chatbot = db.query(Chatbot).filter(
            Chatbot.workspace_id == workspace.id,
            Chatbot.slug == chatbot_slug
        ).first()

        if chatbot:
            # Found directly - check if workspace needed redirect
            return workspace, chatbot, ws_redirect, None

        # Check chatbot slug history
        history = db.query(SlugHistory).filter(
            SlugHistory.entity_type == 'chatbot',
            SlugHistory.old_slug == chatbot_slug,
            SlugHistory.workspace_id == workspace.id,
            SlugHistory.new_slug.isnot(None)  # Has a redirect target
        ).order_by(SlugHistory.created_at.desc()).first()

        if history:
            # Found in history - get current chatbot
            chatbot = db.query(Chatbot).filter(
                Chatbot.id == history.entity_id
            ).first()
            if chatbot and chatbot.slug:
                return workspace, chatbot, ws_redirect, chatbot.slug

        return workspace, None, ws_redirect, None


# Singleton instance
slug_service = SlugService()
