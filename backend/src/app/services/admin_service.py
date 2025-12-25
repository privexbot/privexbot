"""
Admin Service - Cross-tenant queries for staff backoffice.

WHY:
- Provide system-wide statistics for admin dashboard
- Enable user lookup and support across all organizations
- Allow staff to view user resources without tenant isolation

HOW:
- Query without organization/workspace filters
- Aggregate counts across all tenants
- Join user data with their memberships and resources
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember
from app.models.chatbot import Chatbot
from app.models.chatflow import Chatflow
from app.models.knowledge_base import KnowledgeBase
from app.models.auth_identity import AuthIdentity


class AdminService:
    """Service for admin/backoffice cross-tenant operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_system_stats(self) -> Dict[str, Any]:
        """
        Get system-wide statistics for admin dashboard.

        Returns:
            Dict with total counts of all major entities
        """
        now = datetime.utcnow()
        last_7_days = now - timedelta(days=7)
        last_30_days = now - timedelta(days=30)

        # Total counts
        total_users = self.db.query(func.count(User.id)).scalar() or 0
        total_orgs = self.db.query(func.count(Organization.id)).scalar() or 0
        total_workspaces = self.db.query(func.count(Workspace.id)).scalar() or 0
        total_chatbots = self.db.query(func.count(Chatbot.id)).scalar() or 0
        total_chatflows = self.db.query(func.count(Chatflow.id)).scalar() or 0
        total_kbs = self.db.query(func.count(KnowledgeBase.id)).scalar() or 0

        # Active users (users with activity in last 7 days)
        active_users = self.db.query(func.count(User.id)).filter(
            User.updated_at >= last_7_days
        ).scalar() or 0

        # New users in last 7 days
        new_users_7d = self.db.query(func.count(User.id)).filter(
            User.created_at >= last_7_days
        ).scalar() or 0

        # New users in last 30 days
        new_users_30d = self.db.query(func.count(User.id)).filter(
            User.created_at >= last_30_days
        ).scalar() or 0

        # New orgs in last 7 days
        new_orgs_7d = self.db.query(func.count(Organization.id)).filter(
            Organization.created_at >= last_7_days
        ).scalar() or 0

        return {
            "total_users": total_users,
            "total_organizations": total_orgs,
            "total_workspaces": total_workspaces,
            "total_chatbots": total_chatbots,
            "total_chatflows": total_chatflows,
            "total_knowledge_bases": total_kbs,
            "active_users_7d": active_users,
            "new_users_7d": new_users_7d,
            "new_users_30d": new_users_30d,
            "new_organizations_7d": new_orgs_7d,
        }

    def list_organizations(
        self,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        List all organizations with member and workspace counts.

        Args:
            search: Optional search term for org name
            limit: Max results to return
            offset: Pagination offset

        Returns:
            Dict with items list and total count
        """
        query = self.db.query(Organization)

        if search:
            query = query.filter(
                Organization.name.ilike(f"%{search}%")
            )

        # Get total count
        total = query.count()

        # Get paginated results
        orgs = query.order_by(Organization.created_at.desc()).offset(offset).limit(limit).all()

        # Build response with counts
        items = []
        for org in orgs:
            member_count = self.db.query(func.count(OrganizationMember.id)).filter(
                OrganizationMember.organization_id == org.id
            ).scalar() or 0

            workspace_count = self.db.query(func.count(Workspace.id)).filter(
                Workspace.organization_id == org.id
            ).scalar() or 0

            items.append({
                "id": str(org.id),
                "name": org.name,
                "billing_email": org.billing_email,
                "subscription_tier": org.subscription_tier,
                "subscription_status": org.subscription_status,
                "created_at": org.created_at.isoformat() if org.created_at else None,
                "member_count": member_count,
                "workspace_count": workspace_count,
            })

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_organization_details(self, org_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about an organization.

        Args:
            org_id: Organization ID

        Returns:
            Dict with org details, workspaces, and members
        """
        org = self.db.query(Organization).filter(Organization.id == org_id).first()

        if not org:
            return None

        # Get workspaces
        workspaces = self.db.query(Workspace).filter(
            Workspace.organization_id == org_id
        ).all()

        workspace_data = []
        for ws in workspaces:
            chatbot_count = self.db.query(func.count(Chatbot.id)).filter(
                Chatbot.workspace_id == ws.id
            ).scalar() or 0

            chatflow_count = self.db.query(func.count(Chatflow.id)).filter(
                Chatflow.workspace_id == ws.id
            ).scalar() or 0

            kb_count = self.db.query(func.count(KnowledgeBase.id)).filter(
                KnowledgeBase.workspace_id == ws.id
            ).scalar() or 0

            workspace_data.append({
                "id": str(ws.id),
                "name": ws.name,
                "is_default": ws.is_default,
                "created_at": ws.created_at.isoformat() if ws.created_at else None,
                "chatbot_count": chatbot_count,
                "chatflow_count": chatflow_count,
                "kb_count": kb_count,
            })

        # Get members with user info
        members = self.db.query(OrganizationMember).options(
            joinedload(OrganizationMember.user)
        ).filter(
            OrganizationMember.organization_id == org_id
        ).all()

        member_data = []
        for member in members:
            if member.user:
                member_data.append({
                    "user_id": str(member.user.id),
                    "username": member.user.username,
                    "role": member.role,
                    "is_active": member.user.is_active,
                    "joined_at": member.created_at.isoformat() if member.created_at else None,
                })

        return {
            "id": str(org.id),
            "name": org.name,
            "billing_email": org.billing_email,
            "subscription_tier": org.subscription_tier,
            "subscription_status": org.subscription_status,
            "created_at": org.created_at.isoformat() if org.created_at else None,
            "settings": org.settings,
            "workspaces": workspace_data,
            "members": member_data,
        }

    def search_users(
        self,
        query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Search users by username or email.

        Args:
            query: Search term (matches username or email)
            limit: Max results to return
            offset: Pagination offset

        Returns:
            Dict with items list and total count
        """
        db_query = self.db.query(User)

        if query:
            # Search in username and auth_identity emails
            db_query = db_query.outerjoin(AuthIdentity).filter(
                or_(
                    User.username.ilike(f"%{query}%"),
                    AuthIdentity.identifier.ilike(f"%{query}%")
                )
            ).distinct()

        # Get total count
        total = db_query.count()

        # Get paginated results
        users = db_query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()

        # Build response
        items = []
        for user in users:
            # Get primary email if exists
            email_identity = self.db.query(AuthIdentity).filter(
                AuthIdentity.user_id == user.id,
                AuthIdentity.provider == "email"
            ).first()

            org_count = self.db.query(func.count(OrganizationMember.id)).filter(
                OrganizationMember.user_id == user.id
            ).scalar() or 0

            items.append({
                "id": str(user.id),
                "username": user.username,
                "email": email_identity.identifier if email_identity else None,
                "is_active": user.is_active,
                "is_staff": user.is_staff,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "organization_count": org_count,
            })

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_user_details(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a user.

        Args:
            user_id: User ID

        Returns:
            Dict with user profile, auth methods, and memberships
        """
        user = self.db.query(User).filter(User.id == user_id).first()

        if not user:
            return None

        # Get auth identities
        auth_identities = self.db.query(AuthIdentity).filter(
            AuthIdentity.user_id == user_id
        ).all()

        auth_methods = []
        for identity in auth_identities:
            auth_methods.append({
                "provider": identity.provider,
                "identifier": identity.identifier,
                "created_at": identity.created_at.isoformat() if identity.created_at else None,
            })

        # Get organization memberships
        org_memberships = self.db.query(OrganizationMember).options(
            joinedload(OrganizationMember.organization)
        ).filter(
            OrganizationMember.user_id == user_id
        ).all()

        organizations = []
        for membership in org_memberships:
            if membership.organization:
                organizations.append({
                    "id": str(membership.organization.id),
                    "name": membership.organization.name,
                    "role": membership.role,
                    "joined_at": membership.created_at.isoformat() if membership.created_at else None,
                })

        # Get workspace memberships
        ws_memberships = self.db.query(WorkspaceMember).options(
            joinedload(WorkspaceMember.workspace)
        ).filter(
            WorkspaceMember.user_id == user_id
        ).all()

        workspaces = []
        for membership in ws_memberships:
            if membership.workspace:
                workspaces.append({
                    "id": str(membership.workspace.id),
                    "name": membership.workspace.name,
                    "organization_id": str(membership.workspace.organization_id),
                    "role": membership.role,
                })

        return {
            "id": str(user.id),
            "username": user.username,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
            "auth_methods": auth_methods,
            "organizations": organizations,
            "workspaces": workspaces,
        }

    def get_user_resources(self, user_id: UUID) -> Dict[str, Any]:
        """
        Get all resources created by a user.

        Args:
            user_id: User ID

        Returns:
            Dict with chatbots, chatflows, and knowledge bases
        """
        # Get chatbots created by user
        chatbots = self.db.query(Chatbot).filter(
            Chatbot.created_by == user_id
        ).order_by(Chatbot.created_at.desc()).limit(50).all()

        chatbot_data = []
        for bot in chatbots:
            chatbot_data.append({
                "id": str(bot.id),
                "name": bot.name,
                "status": bot.status.value if bot.status else None,
                "workspace_id": str(bot.workspace_id),
                "created_at": bot.created_at.isoformat() if bot.created_at else None,
            })

        # Get chatflows created by user
        chatflows = self.db.query(Chatflow).filter(
            Chatflow.created_by == user_id
        ).order_by(Chatflow.created_at.desc()).limit(50).all()

        chatflow_data = []
        for flow in chatflows:
            chatflow_data.append({
                "id": str(flow.id),
                "name": flow.name,
                "status": flow.status.value if flow.status else None,
                "workspace_id": str(flow.workspace_id),
                "created_at": flow.created_at.isoformat() if flow.created_at else None,
            })

        # Get knowledge bases created by user
        kbs = self.db.query(KnowledgeBase).filter(
            KnowledgeBase.created_by == user_id
        ).order_by(KnowledgeBase.created_at.desc()).limit(50).all()

        kb_data = []
        for kb in kbs:
            kb_data.append({
                "id": str(kb.id),
                "name": kb.name,
                "status": kb.status,
                "workspace_id": str(kb.workspace_id),
                "created_at": kb.created_at.isoformat() if kb.created_at else None,
            })

        return {
            "user_id": str(user_id),
            "chatbots": chatbot_data,
            "chatflows": chatflow_data,
            "knowledge_bases": kb_data,
            "totals": {
                "chatbots": len(chatbot_data),
                "chatflows": len(chatflow_data),
                "knowledge_bases": len(kb_data),
            }
        }
