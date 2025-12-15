"""
Comprehensive Multi-Tenancy Model Tests

WHY: Test all multi-tenancy models and relationships
HOW: Use pytest with database fixtures to verify model behavior

Tests:
1. Organization model (create, subscription management, trial periods)
2. OrganizationMember model (roles, permissions, unique constraints)
3. Workspace model (creation, default workspaces, relationships)
4. WorkspaceMember model (roles, permissions, access control)
5. Integration tests (full hierarchy, cascade deletes, tenant isolation)

USAGE:
    pytest app/tests/test_tenancy.py -v
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember


# ============================================================================
# ORGANIZATION MODEL TESTS
# ============================================================================

class TestOrganizationModel:
    """Test Organization model functionality"""

    def test_create_organization_success(self, db_session):
        """
        Test creating an organization with required fields

        WHY: Verify basic organization creation works
        HOW: Create org with minimal required fields
        """
        # Create a user first
        user = User(username="owner_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create organization
        org = Organization(
            name="Test Organization",
            billing_email="billing@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Verify
        assert org.id is not None
        assert org.name == "Test Organization"
        assert org.billing_email == "billing@test.com"
        assert org.subscription_tier == "free"
        assert org.subscription_status == "trial"
        assert org.created_by == user.id

    def test_organization_subscription_tiers(self, db_session):
        """
        Test different subscription tiers

        WHY: Verify all subscription tiers can be set
        HOW: Create orgs with each tier (free, starter, pro, enterprise)
        """
        user = User(username="owner", is_active=True)
        db_session.add(user)
        db_session.commit()

        tiers = ["free", "starter", "pro", "enterprise"]
        for tier in tiers:
            org = Organization(
                name=f"Org {tier}",
                billing_email=f"{tier}@test.com",
                subscription_tier=tier,
                subscription_status="active",
                created_by=user.id
            )
            db_session.add(org)
            db_session.commit()

            assert org.subscription_tier == tier
            assert org.subscription_status == "active"

    def test_organization_trial_period(self, db_session):
        """
        Test trial period management

        WHY: Verify trial period helper method works
        HOW: Create org, set trial, check trial properties
        """
        user = User(username="trial_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="Trial Org",
            billing_email="trial@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Set trial period
        org.set_trial_period(days=30)
        db_session.commit()

        # Verify trial properties
        assert org.is_trial is True
        assert org.trial_ends_at is not None
        assert org.trial_ends_at > datetime.utcnow()
        assert org.is_trial_expired is False

    def test_organization_trial_expired(self, db_session):
        """
        Test expired trial detection

        WHY: Verify trial expiration is detected correctly
        HOW: Create org with expired trial date
        """
        user = User(username="expired_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="Expired Trial Org",
            billing_email="expired@test.com",
            subscription_tier="free",
            subscription_status="trial",
            trial_ends_at=datetime.utcnow() - timedelta(days=1),  # Yesterday
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Verify trial is expired
        assert org.is_trial is True
        assert org.is_trial_expired is True

    def test_organization_active_subscription(self, db_session):
        """
        Test active subscription detection

        WHY: Verify is_active property works correctly
        HOW: Create org with active subscription
        """
        user = User(username="active_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="Active Org",
            billing_email="active@test.com",
            subscription_tier="pro",
            subscription_status="active",
            subscription_starts_at=datetime.utcnow() - timedelta(days=30),
            subscription_ends_at=datetime.utcnow() + timedelta(days=335),  # ~1 year
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Verify subscription is active
        assert org.is_active is True
        assert org.subscription_status == "active"

    def test_organization_settings_jsonb(self, db_session):
        """
        Test JSONB settings field

        WHY: Verify flexible settings storage works
        HOW: Create org with settings, retrieve and verify
        """
        user = User(username="settings_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        settings_data = {
            "branding": {"logo_url": "https://example.com/logo.png"},
            "features": {"analytics": True, "api_access": True},
            "limits": {"max_chatbots": 10}
        }

        org = Organization(
            name="Settings Org",
            billing_email="settings@test.com",
            subscription_tier="pro",
            subscription_status="active",
            settings=settings_data,
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Verify settings stored correctly
        assert org.settings == settings_data
        assert org.settings["branding"]["logo_url"] == "https://example.com/logo.png"
        assert org.settings["features"]["analytics"] is True


# ============================================================================
# ORGANIZATION MEMBER MODEL TESTS
# ============================================================================

class TestOrganizationMemberModel:
    """Test OrganizationMember model functionality"""

    def test_create_organization_member_success(self, db_session):
        """
        Test creating an organization member

        WHY: Verify membership creation works
        HOW: Create user, org, then membership
        """
        # Create user and org
        user = User(username="member_user", is_active=True)
        inviter = User(username="inviter_user", is_active=True)
        db_session.add_all([user, inviter])
        db_session.commit()

        org = Organization(
            name="Member Test Org",
            billing_email="member@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=inviter.id
        )
        db_session.add(org)
        db_session.commit()

        # Create membership
        member = OrganizationMember(
            user_id=user.id,
            organization_id=org.id,
            role="member",
            invited_by=inviter.id
        )
        db_session.add(member)
        db_session.commit()

        # Verify
        assert member.id is not None
        assert member.user_id == user.id
        assert member.organization_id == org.id
        assert member.role == "member"
        assert member.invited_by == inviter.id
        assert member.joined_at is not None

    def test_organization_member_roles(self, db_session):
        """
        Test different member roles

        WHY: Verify all roles can be assigned
        HOW: Create members with each role (owner, admin, member)
        """
        # Create users and org
        owner = User(username="owner", is_active=True)
        admin = User(username="admin", is_active=True)
        member = User(username="member", is_active=True)
        db_session.add_all([owner, admin, member])
        db_session.commit()

        org = Organization(
            name="Roles Test Org",
            billing_email="roles@test.com",
            subscription_tier="pro",
            subscription_status="active",
            created_by=owner.id
        )
        db_session.add(org)
        db_session.commit()

        # Create memberships with different roles
        owner_member = OrganizationMember(
            user_id=owner.id,
            organization_id=org.id,
            role="owner"
        )
        admin_member = OrganizationMember(
            user_id=admin.id,
            organization_id=org.id,
            role="admin",
            invited_by=owner.id
        )
        regular_member = OrganizationMember(
            user_id=member.id,
            organization_id=org.id,
            role="member",
            invited_by=owner.id
        )
        db_session.add_all([owner_member, admin_member, regular_member])
        db_session.commit()

        # Verify roles and properties
        assert owner_member.is_owner is True
        assert owner_member.is_admin is True  # Owners have admin permissions too
        assert owner_member.can_manage_members is True
        assert owner_member.can_manage_billing is True

        assert admin_member.is_owner is False
        assert admin_member.is_admin is True
        assert admin_member.can_manage_members is True
        assert admin_member.can_manage_billing is False

        assert regular_member.is_owner is False
        assert regular_member.is_admin is False
        assert regular_member.can_manage_members is False
        assert regular_member.can_manage_billing is False

    def test_organization_member_unique_constraint(self, db_session):
        """
        Test unique constraint on (user_id, organization_id)

        WHY: Prevent duplicate memberships
        HOW: Try creating same membership twice, expect IntegrityError
        """
        # Create user and org
        user = User(username="unique_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="Unique Test Org",
            billing_email="unique@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Create first membership
        member1 = OrganizationMember(
            user_id=user.id,
            organization_id=org.id,
            role="owner"
        )
        db_session.add(member1)
        db_session.commit()

        # Try creating duplicate membership - should fail
        member2 = OrganizationMember(
            user_id=user.id,
            organization_id=org.id,
            role="admin"  # Different role, same user+org
        )
        db_session.add(member2)

        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_organization_member_cascade_delete_org(self, db_session):
        """
        Test cascade delete when organization is deleted

        WHY: Verify memberships are deleted with org
        HOW: Create org with members, delete org, verify members gone
        """
        # Create users and org
        user1 = User(username="cascade_user1", is_active=True)
        user2 = User(username="cascade_user2", is_active=True)
        db_session.add_all([user1, user2])
        db_session.commit()

        org = Organization(
            name="Cascade Delete Org",
            billing_email="cascade@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user1.id
        )
        db_session.add(org)
        db_session.commit()

        # Create memberships
        member1 = OrganizationMember(user_id=user1.id, organization_id=org.id, role="owner")
        member2 = OrganizationMember(user_id=user2.id, organization_id=org.id, role="member")
        db_session.add_all([member1, member2])
        db_session.commit()

        org_id = org.id

        # Delete organization
        db_session.delete(org)
        db_session.commit()

        # Verify memberships are deleted
        remaining_members = db_session.query(OrganizationMember).filter_by(
            organization_id=org_id
        ).all()
        assert len(remaining_members) == 0


# ============================================================================
# WORKSPACE MODEL TESTS
# ============================================================================

class TestWorkspaceModel:
    """Test Workspace model functionality"""

    def test_create_workspace_success(self, db_session):
        """
        Test creating a workspace

        WHY: Verify workspace creation works
        HOW: Create org, then workspace within it
        """
        # Create user and org
        user = User(username="ws_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="Workspace Test Org",
            billing_email="workspace@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Create workspace
        workspace = Workspace(
            organization_id=org.id,
            name="Engineering",
            description="Engineering team workspace",
            is_default=False,
            created_by=user.id
        )
        db_session.add(workspace)
        db_session.commit()

        # Verify
        assert workspace.id is not None
        assert workspace.organization_id == org.id
        assert workspace.name == "Engineering"
        assert workspace.description == "Engineering team workspace"
        assert workspace.is_default is False
        assert workspace.created_by == user.id

    def test_workspace_default_flag(self, db_session):
        """
        Test default workspace flag

        WHY: Verify is_default flag works
        HOW: Create default and non-default workspaces
        """
        user = User(username="default_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="Default Test Org",
            billing_email="default@test.com",
            subscription_tier="pro",
            subscription_status="active",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Create default workspace
        default_ws = Workspace(
            organization_id=org.id,
            name="Default",
            is_default=True,
            created_by=user.id
        )
        db_session.add(default_ws)
        db_session.commit()

        # Create non-default workspace
        other_ws = Workspace(
            organization_id=org.id,
            name="Marketing",
            is_default=False,
            created_by=user.id
        )
        db_session.add(other_ws)
        db_session.commit()

        # Verify
        assert default_ws.is_default is True
        assert other_ws.is_default is False

    def test_workspace_unique_constraint(self, db_session):
        """
        Test unique constraint on (organization_id, name)

        WHY: Prevent duplicate workspace names in same org
        HOW: Try creating two workspaces with same name in same org
        """
        user = User(username="unique_ws_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="Unique WS Org",
            billing_email="uniquews@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Create first workspace
        ws1 = Workspace(
            organization_id=org.id,
            name="Engineering",
            is_default=False,
            created_by=user.id
        )
        db_session.add(ws1)
        db_session.commit()

        # Try creating duplicate workspace name
        ws2 = Workspace(
            organization_id=org.id,
            name="Engineering",  # Same name, same org
            is_default=False,
            created_by=user.id
        )
        db_session.add(ws2)

        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_workspace_settings_jsonb(self, db_session):
        """
        Test JSONB settings field

        WHY: Verify flexible settings storage works
        HOW: Create workspace with settings, retrieve and verify
        """
        user = User(username="ws_settings_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="WS Settings Org",
            billing_email="wssettings@test.com",
            subscription_tier="pro",
            subscription_status="active",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        settings_data = {
            "theme": {"color": "#3B82F6", "icon": "briefcase"},
            "defaults": {"chatbot_model": "secret-ai-v1"},
            "integrations": {"slack_channel": "#engineering"}
        }

        workspace = Workspace(
            organization_id=org.id,
            name="Engineering",
            settings=settings_data,
            is_default=False,
            created_by=user.id
        )
        db_session.add(workspace)
        db_session.commit()

        # Verify settings stored correctly
        assert workspace.settings == settings_data
        assert workspace.settings["theme"]["color"] == "#3B82F6"
        assert workspace.settings["integrations"]["slack_channel"] == "#engineering"

    def test_workspace_cascade_delete_org(self, db_session):
        """
        Test cascade delete when organization is deleted

        WHY: Verify workspaces are deleted with org
        HOW: Create org with workspaces, delete org, verify workspaces gone
        """
        user = User(username="ws_cascade_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="WS Cascade Org",
            billing_email="wscascade@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Create multiple workspaces
        ws1 = Workspace(organization_id=org.id, name="Engineering", is_default=True, created_by=user.id)
        ws2 = Workspace(organization_id=org.id, name="Marketing", is_default=False, created_by=user.id)
        db_session.add_all([ws1, ws2])
        db_session.commit()

        org_id = org.id

        # Delete organization
        db_session.delete(org)
        db_session.commit()

        # Verify workspaces are deleted
        remaining_workspaces = db_session.query(Workspace).filter_by(
            organization_id=org_id
        ).all()
        assert len(remaining_workspaces) == 0


# ============================================================================
# WORKSPACE MEMBER MODEL TESTS
# ============================================================================

class TestWorkspaceMemberModel:
    """Test WorkspaceMember model functionality"""

    def test_create_workspace_member_success(self, db_session):
        """
        Test creating a workspace member

        WHY: Verify workspace membership creation works
        HOW: Create user, org, workspace, then workspace membership
        """
        # Create users
        user = User(username="ws_member_user", is_active=True)
        inviter = User(username="ws_inviter", is_active=True)
        db_session.add_all([user, inviter])
        db_session.commit()

        # Create org and workspace
        org = Organization(
            name="WS Member Org",
            billing_email="wsmember@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=inviter.id
        )
        db_session.add(org)
        db_session.commit()

        workspace = Workspace(
            organization_id=org.id,
            name="Engineering",
            is_default=False,
            created_by=inviter.id
        )
        db_session.add(workspace)
        db_session.commit()

        # Create workspace membership
        ws_member = WorkspaceMember(
            user_id=user.id,
            workspace_id=workspace.id,
            role="editor",
            invited_by=inviter.id
        )
        db_session.add(ws_member)
        db_session.commit()

        # Verify
        assert ws_member.id is not None
        assert ws_member.user_id == user.id
        assert ws_member.workspace_id == workspace.id
        assert ws_member.role == "editor"
        assert ws_member.invited_by == inviter.id

    def test_workspace_member_roles(self, db_session):
        """
        Test different workspace member roles

        WHY: Verify all roles can be assigned
        HOW: Create members with each role (admin, editor, viewer)
        """
        # Create users
        admin = User(username="ws_admin", is_active=True)
        editor = User(username="ws_editor", is_active=True)
        viewer = User(username="ws_viewer", is_active=True)
        db_session.add_all([admin, editor, viewer])
        db_session.commit()

        # Create org and workspace
        org = Organization(
            name="WS Roles Org",
            billing_email="wsroles@test.com",
            subscription_tier="pro",
            subscription_status="active",
            created_by=admin.id
        )
        db_session.add(org)
        db_session.commit()

        workspace = Workspace(
            organization_id=org.id,
            name="Engineering",
            is_default=False,
            created_by=admin.id
        )
        db_session.add(workspace)
        db_session.commit()

        # Create memberships with different roles
        admin_member = WorkspaceMember(
            user_id=admin.id,
            workspace_id=workspace.id,
            role="admin"
        )
        editor_member = WorkspaceMember(
            user_id=editor.id,
            workspace_id=workspace.id,
            role="editor",
            invited_by=admin.id
        )
        viewer_member = WorkspaceMember(
            user_id=viewer.id,
            workspace_id=workspace.id,
            role="viewer",
            invited_by=admin.id
        )
        db_session.add_all([admin_member, editor_member, viewer_member])
        db_session.commit()

        # Verify admin role properties
        assert admin_member.is_admin is True
        assert admin_member.can_edit is True
        assert admin_member.can_delete is True
        assert admin_member.can_manage_members is True
        assert admin_member.is_viewer is False

        # Verify editor role properties
        assert editor_member.is_admin is False
        assert editor_member.can_edit is True
        assert editor_member.can_delete is False
        assert editor_member.can_manage_members is False
        assert editor_member.is_viewer is False

        # Verify viewer role properties
        assert viewer_member.is_admin is False
        assert viewer_member.can_edit is False
        assert viewer_member.can_delete is False
        assert viewer_member.can_manage_members is False
        assert viewer_member.is_viewer is True

    def test_workspace_member_permissions(self, db_session):
        """
        Test permission hierarchy via has_permission method

        WHY: Verify permission checking works correctly
        HOW: Create members with different roles, test permissions
        """
        # Create users
        admin = User(username="perm_admin", is_active=True)
        editor = User(username="perm_editor", is_active=True)
        viewer = User(username="perm_viewer", is_active=True)
        db_session.add_all([admin, editor, viewer])
        db_session.commit()

        # Create org and workspace
        org = Organization(
            name="Perm Test Org",
            billing_email="perm@test.com",
            subscription_tier="pro",
            subscription_status="active",
            created_by=admin.id
        )
        db_session.add(org)
        db_session.commit()

        workspace = Workspace(
            organization_id=org.id,
            name="Engineering",
            is_default=False,
            created_by=admin.id
        )
        db_session.add(workspace)
        db_session.commit()

        # Create memberships
        admin_member = WorkspaceMember(user_id=admin.id, workspace_id=workspace.id, role="admin")
        editor_member = WorkspaceMember(user_id=editor.id, workspace_id=workspace.id, role="editor")
        viewer_member = WorkspaceMember(user_id=viewer.id, workspace_id=workspace.id, role="viewer")
        db_session.add_all([admin_member, editor_member, viewer_member])
        db_session.commit()

        # Test admin permissions (has all)
        assert admin_member.has_permission('read') is True
        assert admin_member.has_permission('create') is True
        assert admin_member.has_permission('edit') is True
        assert admin_member.has_permission('delete') is True
        assert admin_member.has_permission('manage_members') is True

        # Test editor permissions (no delete, no manage_members)
        assert editor_member.has_permission('read') is True
        assert editor_member.has_permission('create') is True
        assert editor_member.has_permission('edit') is True
        assert editor_member.has_permission('delete') is False
        assert editor_member.has_permission('manage_members') is False

        # Test viewer permissions (read only)
        assert viewer_member.has_permission('read') is True
        assert viewer_member.has_permission('create') is False
        assert viewer_member.has_permission('edit') is False
        assert viewer_member.has_permission('delete') is False
        assert viewer_member.has_permission('manage_members') is False

    def test_workspace_member_unique_constraint(self, db_session):
        """
        Test unique constraint on (user_id, workspace_id)

        WHY: Prevent duplicate workspace memberships
        HOW: Try creating same membership twice, expect IntegrityError
        """
        user = User(username="ws_unique_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="WS Unique Org",
            billing_email="wsunique@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        workspace = Workspace(
            organization_id=org.id,
            name="Engineering",
            is_default=False,
            created_by=user.id
        )
        db_session.add(workspace)
        db_session.commit()

        # Create first membership
        member1 = WorkspaceMember(
            user_id=user.id,
            workspace_id=workspace.id,
            role="admin"
        )
        db_session.add(member1)
        db_session.commit()

        # Try creating duplicate membership
        member2 = WorkspaceMember(
            user_id=user.id,
            workspace_id=workspace.id,
            role="viewer"  # Different role, same user+workspace
        )
        db_session.add(member2)

        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_workspace_member_cascade_delete_workspace(self, db_session):
        """
        Test cascade delete when workspace is deleted

        WHY: Verify memberships are deleted with workspace
        HOW: Create workspace with members, delete workspace, verify members gone
        """
        user1 = User(username="ws_del_user1", is_active=True)
        user2 = User(username="ws_del_user2", is_active=True)
        db_session.add_all([user1, user2])
        db_session.commit()

        org = Organization(
            name="WS Delete Org",
            billing_email="wsdelete@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user1.id
        )
        db_session.add(org)
        db_session.commit()

        workspace = Workspace(
            organization_id=org.id,
            name="Engineering",
            is_default=False,
            created_by=user1.id
        )
        db_session.add(workspace)
        db_session.commit()

        # Create memberships
        member1 = WorkspaceMember(user_id=user1.id, workspace_id=workspace.id, role="admin")
        member2 = WorkspaceMember(user_id=user2.id, workspace_id=workspace.id, role="editor")
        db_session.add_all([member1, member2])
        db_session.commit()

        workspace_id = workspace.id

        # Delete workspace
        db_session.delete(workspace)
        db_session.commit()

        # Verify memberships are deleted
        remaining_members = db_session.query(WorkspaceMember).filter_by(
            workspace_id=workspace_id
        ).all()
        assert len(remaining_members) == 0


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestMultiTenancyIntegration:
    """Test multi-tenancy integration scenarios"""

    def test_full_hierarchy_creation(self, db_session):
        """
        Test creating full multi-tenancy hierarchy

        WHY: Verify all models work together correctly
        HOW: Create Organization -> Workspace -> Members at both levels
        """
        # Create users
        owner = User(username="hierarchy_owner", is_active=True)
        member1 = User(username="hierarchy_member1", is_active=True)
        member2 = User(username="hierarchy_member2", is_active=True)
        db_session.add_all([owner, member1, member2])
        db_session.commit()

        # Create organization
        org = Organization(
            name="Full Hierarchy Org",
            billing_email="hierarchy@test.com",
            subscription_tier="enterprise",
            subscription_status="active",
            created_by=owner.id
        )
        db_session.add(org)
        db_session.commit()

        # Create organization memberships
        org_owner = OrganizationMember(user_id=owner.id, organization_id=org.id, role="owner")
        org_member1 = OrganizationMember(user_id=member1.id, organization_id=org.id, role="admin", invited_by=owner.id)
        org_member2 = OrganizationMember(user_id=member2.id, organization_id=org.id, role="member", invited_by=owner.id)
        db_session.add_all([org_owner, org_member1, org_member2])
        db_session.commit()

        # Create workspaces
        ws_eng = Workspace(organization_id=org.id, name="Engineering", is_default=True, created_by=owner.id)
        ws_sales = Workspace(organization_id=org.id, name="Sales", is_default=False, created_by=owner.id)
        db_session.add_all([ws_eng, ws_sales])
        db_session.commit()

        # Create workspace memberships
        ws_eng_admin = WorkspaceMember(user_id=owner.id, workspace_id=ws_eng.id, role="admin")
        ws_eng_editor = WorkspaceMember(user_id=member1.id, workspace_id=ws_eng.id, role="editor", invited_by=owner.id)
        ws_sales_viewer = WorkspaceMember(user_id=member2.id, workspace_id=ws_sales.id, role="viewer", invited_by=owner.id)
        db_session.add_all([ws_eng_admin, ws_eng_editor, ws_sales_viewer])
        db_session.commit()

        # Verify full hierarchy
        assert org.member_count == 3
        assert db_session.query(Workspace).filter_by(organization_id=org.id).count() == 2
        assert db_session.query(WorkspaceMember).filter_by(workspace_id=ws_eng.id).count() == 2
        assert db_session.query(WorkspaceMember).filter_by(workspace_id=ws_sales.id).count() == 1

    def test_cascade_delete_full_hierarchy(self, db_session):
        """
        Test cascade delete of full hierarchy

        WHY: Verify deleting org deletes everything below it
        HOW: Create full hierarchy, delete org, verify all deleted
        """
        # Create minimal hierarchy
        user = User(username="cascade_full_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="Cascade Full Org",
            billing_email="cascadefull@test.com",
            subscription_tier="free",
            subscription_status="trial",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        org_member = OrganizationMember(user_id=user.id, organization_id=org.id, role="owner")
        db_session.add(org_member)
        db_session.commit()

        workspace = Workspace(organization_id=org.id, name="Engineering", is_default=True, created_by=user.id)
        db_session.add(workspace)
        db_session.commit()

        ws_member = WorkspaceMember(user_id=user.id, workspace_id=workspace.id, role="admin")
        db_session.add(ws_member)
        db_session.commit()

        org_id = org.id
        workspace_id = workspace.id

        # Delete organization
        db_session.delete(org)
        db_session.commit()

        # Verify everything is deleted
        assert db_session.query(Organization).filter_by(id=org_id).first() is None
        assert db_session.query(OrganizationMember).filter_by(organization_id=org_id).count() == 0
        assert db_session.query(Workspace).filter_by(organization_id=org_id).count() == 0
        assert db_session.query(WorkspaceMember).filter_by(workspace_id=workspace_id).count() == 0

    def test_tenant_isolation(self, db_session):
        """
        Test tenant isolation between organizations

        WHY: Verify data doesn't leak between orgs
        HOW: Create two orgs with workspaces, verify queries are isolated
        """
        # Create users
        user1 = User(username="tenant1_user", is_active=True)
        user2 = User(username="tenant2_user", is_active=True)
        db_session.add_all([user1, user2])
        db_session.commit()

        # Create two separate organizations
        org1 = Organization(
            name="Tenant 1 Org",
            billing_email="tenant1@test.com",
            subscription_tier="pro",
            subscription_status="active",
            created_by=user1.id
        )
        org2 = Organization(
            name="Tenant 2 Org",
            billing_email="tenant2@test.com",
            subscription_tier="pro",
            subscription_status="active",
            created_by=user2.id
        )
        db_session.add_all([org1, org2])
        db_session.commit()

        # Create workspaces in each org (same name to test isolation)
        ws1 = Workspace(organization_id=org1.id, name="Engineering", is_default=True, created_by=user1.id)
        ws2 = Workspace(organization_id=org2.id, name="Engineering", is_default=True, created_by=user2.id)
        db_session.add_all([ws1, ws2])
        db_session.commit()

        # Verify isolation - each org only sees its own workspaces
        org1_workspaces = db_session.query(Workspace).filter_by(organization_id=org1.id).all()
        org2_workspaces = db_session.query(Workspace).filter_by(organization_id=org2.id).all()

        assert len(org1_workspaces) == 1
        assert len(org2_workspaces) == 1
        assert org1_workspaces[0].id != org2_workspaces[0].id
        assert org1_workspaces[0].name == "Engineering"
        assert org2_workspaces[0].name == "Engineering"

    def test_relationships_work_correctly(self, db_session):
        """
        Test SQLAlchemy relationships between models

        WHY: Verify relationship navigation works
        HOW: Create hierarchy, navigate relationships both directions
        """
        # Create user and org
        user = User(username="rel_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = Organization(
            name="Relationship Test Org",
            billing_email="rel@test.com",
            subscription_tier="pro",
            subscription_status="active",
            created_by=user.id
        )
        db_session.add(org)
        db_session.commit()

        # Create org membership
        org_member = OrganizationMember(user_id=user.id, organization_id=org.id, role="owner")
        db_session.add(org_member)
        db_session.commit()

        # Create workspace
        workspace = Workspace(organization_id=org.id, name="Engineering", is_default=True, created_by=user.id)
        db_session.add(workspace)
        db_session.commit()

        # Create workspace membership
        ws_member = WorkspaceMember(user_id=user.id, workspace_id=workspace.id, role="admin")
        db_session.add(ws_member)
        db_session.commit()

        # Test relationships - Organization to Workspace
        assert workspace.organization.id == org.id
        assert workspace.organization.name == "Relationship Test Org"

        # Test relationships - OrganizationMember to User and Organization
        assert org_member.user.id == user.id
        assert org_member.organization.id == org.id

        # Test relationships - WorkspaceMember to User and Workspace
        assert ws_member.user.id == user.id
        assert ws_member.workspace.id == workspace.id

        # Test relationships - Workspace to Organization
        assert workspace.organization.id == org.id
