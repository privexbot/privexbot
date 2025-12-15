"""
Comprehensive TenantService Tests

WHY: Test all tenant service layer operations
HOW: Use pytest with database fixtures to verify service logic

Tests:
1. Organization Operations (create, get, list, update, delete)
2. Workspace Operations (create, get, list, update, delete)
3. Membership Operations (add/remove org members, add/remove workspace members)
4. Permission Verification (org permissions, workspace permissions, access checks)
5. Context Operations (default context, context switching)
6. Business Logic (trial periods, default workspace creation, role hierarchy)
7. Error Cases (permission denied, not found, invalid operations)

USAGE:
    pytest app/tests/test_tenant_service.py -v
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from fastapi import HTTPException

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember
from app.services.tenant_service import (
    # Organization operations
    create_organization,
    get_organization,
    list_user_organizations,
    update_organization,
    delete_organization,
    # Workspace operations
    create_workspace,
    get_workspace,
    list_organization_workspaces,
    update_workspace,
    delete_workspace,
    # Membership operations
    add_organization_member,
    update_organization_member_role,
    remove_organization_member,
    add_workspace_member,
    update_workspace_member_role,
    remove_workspace_member,
    # Permission helpers
    verify_organization_permission,
    verify_workspace_access,
    verify_workspace_permission,
    # Context helpers
    get_user_default_context,
    get_organization_members,
    get_workspace_members,
)


# ============================================================================
# ORGANIZATION OPERATIONS TESTS
# ============================================================================

class TestOrganizationOperations:
    """Test TenantService organization operations"""

    def test_create_organization_success(self, db_session):
        """
        Test creating organization with default workspace

        WHY: Verify org creation creates owner membership and default workspace
        HOW: Create org, check org/workspace/memberships created
        """
        # Create user
        user = User(username="org_creator", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create organization
        org = create_organization(
            db=db_session,
            name="Test Organization",
            billing_email="billing@test.com",
            creator_id=user.id
        )

        # Verify organization created
        assert org.id is not None
        assert org.name == "Test Organization"
        assert org.billing_email == "billing@test.com"
        assert org.subscription_tier == "free"
        assert org.subscription_status == "trial"
        assert org.created_by == user.id

        # Verify trial period set (30 days)
        assert org.trial_ends_at is not None
        assert org.trial_ends_at > datetime.utcnow()

        # Verify creator is owner
        org_member = db_session.query(OrganizationMember).filter_by(
            user_id=user.id,
            organization_id=org.id
        ).first()
        assert org_member is not None
        assert org_member.role == "owner"

        # Verify default workspace created
        default_workspace = db_session.query(Workspace).filter_by(
            organization_id=org.id,
            is_default=True
        ).first()
        assert default_workspace is not None
        assert default_workspace.name == "Default"

        # Verify creator is workspace admin
        ws_member = db_session.query(WorkspaceMember).filter_by(
            user_id=user.id,
            workspace_id=default_workspace.id
        ).first()
        assert ws_member is not None
        assert ws_member.role == "admin"

    def test_get_organization_success(self, db_session):
        """
        Test getting organization with access verification

        WHY: Verify authorized users can retrieve org details
        HOW: Create org, get as member
        """
        # Setup
        user = User(username="org_getter", is_active=True)
        db_session.add(user)
        db_session.commit()

        org = create_organization(
            db=db_session,
            name="Get Test Org",
            billing_email="get@test.com",
            creator_id=user.id
        )

        # Get organization
        retrieved_org, user_role = get_organization(
            db=db_session,
            organization_id=org.id,
            user_id=user.id
        )

        assert retrieved_org.id == org.id
        assert retrieved_org.name == "Get Test Org"
        assert user_role == "owner"  # Creator is owner

    def test_get_organization_no_access(self, db_session):
        """
        Test getting organization without access

        WHY: Verify non-members cannot access org
        HOW: Create org with user1, try to access with user2
        """
        # Create users
        owner = User(username="org_owner", is_active=True)
        outsider = User(username="outsider", is_active=True)
        db_session.add_all([owner, outsider])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Private Org",
            billing_email="private@test.com",
            creator_id=owner.id
        )

        # Try to access as outsider
        with pytest.raises(HTTPException) as exc_info:
            get_organization(
                db=db_session,
                organization_id=org.id,
                user_id=outsider.id
            )

        assert exc_info.value.status_code == 403
        assert "No access" in str(exc_info.value.detail)

    def test_list_user_organizations(self, db_session):
        """
        Test listing user's organizations with roles

        WHY: Verify user can see all their orgs with roles
        HOW: Create multiple orgs with different roles
        """
        # Create user
        user = User(username="multi_org_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create org as owner
        org1 = create_organization(
            db=db_session,
            name="Owned Org",
            billing_email="owned@test.com",
            creator_id=user.id
        )

        # Create another user's org and add our user as member
        other_user = User(username="other_user", is_active=True)
        db_session.add(other_user)
        db_session.commit()

        org2 = create_organization(
            db=db_session,
            name="Member Org",
            billing_email="member@test.com",
            creator_id=other_user.id
        )

        add_organization_member(
            db=db_session,
            organization_id=org2.id,
            inviter_id=other_user.id,
            invitee_id=user.id,
            role="member"
        )

        # List user's organizations
        orgs = list_user_organizations(db=db_session, user_id=user.id)

        assert len(orgs) == 2

        # Convert to dict for easier checking
        org_dict = {org.id: role for org, role in orgs}

        assert org_dict[org1.id] == "owner"
        assert org_dict[org2.id] == "member"

    def test_update_organization_as_admin(self, db_session):
        """
        Test updating organization as admin

        WHY: Verify admins can update org details
        HOW: Create org, update name and billing email
        """
        # Create user
        user = User(username="org_updater", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Original Name",
            billing_email="original@test.com",
            creator_id=user.id
        )

        # Update organization
        updated_org = update_organization(
            db=db_session,
            organization_id=org.id,
            user_id=user.id,
            name="Updated Name",
            billing_email="updated@test.com",
            settings={"branding": {"color": "#3B82F6"}}
        )

        assert updated_org.name == "Updated Name"
        assert updated_org.billing_email == "updated@test.com"
        assert updated_org.settings["branding"]["color"] == "#3B82F6"

    def test_update_organization_as_member_fails(self, db_session):
        """
        Test updating organization as member fails

        WHY: Verify only admin/owner can update org
        HOW: Create org, add member, try to update as member
        """
        # Create users
        owner = User(username="update_owner", is_active=True)
        member = User(username="update_member", is_active=True)
        db_session.add_all([owner, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Update Test Org",
            billing_email="update@test.com",
            creator_id=owner.id
        )

        # Add member (not admin)
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Try to update as member
        with pytest.raises(HTTPException) as exc_info:
            update_organization(
                db=db_session,
                organization_id=org.id,
                user_id=member.id,
                name="Hacked Name"
            )

        assert exc_info.value.status_code == 403
        assert "admin" in str(exc_info.value.detail).lower()

    def test_delete_organization_as_owner(self, db_session):
        """
        Test deleting organization as owner

        WHY: Verify owner can delete org and all cascades
        HOW: Create org with workspace, delete, verify all gone
        """
        # Create user
        user = User(username="org_deleter", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create org (also creates default workspace)
        org = create_organization(
            db=db_session,
            name="Delete Me Org",
            billing_email="deleteme@test.com",
            creator_id=user.id
        )

        org_id = org.id

        # Delete organization
        delete_organization(
            db=db_session,
            organization_id=org.id,
            user_id=user.id
        )

        # Verify org deleted
        deleted_org = db_session.query(Organization).filter_by(id=org_id).first()
        assert deleted_org is None

        # Verify memberships deleted (cascade)
        org_members = db_session.query(OrganizationMember).filter_by(
            organization_id=org_id
        ).all()
        assert len(org_members) == 0

        # Verify workspaces deleted (cascade)
        workspaces = db_session.query(Workspace).filter_by(
            organization_id=org_id
        ).all()
        assert len(workspaces) == 0

    def test_delete_organization_as_admin_fails(self, db_session):
        """
        Test deleting organization as admin fails

        WHY: Verify only owner can delete org
        HOW: Create org, add admin, try to delete as admin
        """
        # Create users
        owner = User(username="delete_owner", is_active=True)
        admin = User(username="delete_admin", is_active=True)
        db_session.add_all([owner, admin])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Delete Test Org",
            billing_email="delete@test.com",
            creator_id=owner.id
        )

        # Add admin
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=admin.id,
            role="admin"
        )

        # Try to delete as admin
        with pytest.raises(HTTPException) as exc_info:
            delete_organization(
                db=db_session,
                organization_id=org.id,
                user_id=admin.id
            )

        assert exc_info.value.status_code == 403
        assert "owner" in str(exc_info.value.detail).lower()


# ============================================================================
# WORKSPACE OPERATIONS TESTS
# ============================================================================

class TestWorkspaceOperations:
    """Test TenantService workspace operations"""

    def test_create_workspace_as_admin(self, db_session):
        """
        Test creating workspace as org admin

        WHY: Verify admins can create workspaces
        HOW: Create org, create workspace, verify membership
        """
        # Create user
        user = User(username="ws_creator", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Test Org",
            billing_email="ws@test.com",
            creator_id=user.id
        )

        # Create workspace
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Engineering",
            description="Engineering team workspace",
            creator_id=user.id,
            is_default=False
        )

        assert workspace.id is not None
        assert workspace.name == "Engineering"
        assert workspace.description == "Engineering team workspace"
        assert workspace.organization_id == org.id
        assert workspace.is_default is False

        # Verify creator added as admin
        ws_member = db_session.query(WorkspaceMember).filter_by(
            user_id=user.id,
            workspace_id=workspace.id
        ).first()
        assert ws_member is not None
        assert ws_member.role == "admin"

    def test_create_workspace_duplicate_name_fails(self, db_session):
        """
        Test creating workspace with duplicate name fails

        WHY: Verify unique constraint on workspace names per org
        HOW: Create workspace, try to create another with same name
        """
        # Create user
        user = User(username="ws_dup_creator", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Dup WS Org",
            billing_email="dupws@test.com",
            creator_id=user.id
        )

        # Create first workspace
        create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Engineering",
            creator_id=user.id,
            is_default=False
        )

        # Try to create duplicate
        with pytest.raises(HTTPException) as exc_info:
            create_workspace(
                db=db_session,
                organization_id=org.id,
                name="Engineering",  # Same name
                creator_id=user.id,
                is_default=False
            )

        assert exc_info.value.status_code == 400
        assert "already exists" in str(exc_info.value.detail).lower()

    def test_create_workspace_as_member_fails(self, db_session):
        """
        Test creating workspace as member fails

        WHY: Verify only admin/owner can create workspaces
        HOW: Create org, add member, try to create workspace as member
        """
        # Create users
        owner = User(username="ws_owner", is_active=True)
        member = User(username="ws_member", is_active=True)
        db_session.add_all([owner, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Perm Org",
            billing_email="wsperm@test.com",
            creator_id=owner.id
        )

        # Add member
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Try to create workspace as member
        with pytest.raises(HTTPException) as exc_info:
            create_workspace(
                db=db_session,
                organization_id=org.id,
                name="Unauthorized WS",
                creator_id=member.id,
                is_default=False
            )

        assert exc_info.value.status_code == 403

    def test_list_organization_workspaces_as_admin(self, db_session):
        """
        Test listing workspaces as admin sees all

        WHY: Verify admins see all workspaces in org
        HOW: Create multiple workspaces, list as admin
        """
        # Create user
        admin = User(username="ws_lister_admin", is_active=True)
        db_session.add(admin)
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS List Org",
            billing_email="wslist@test.com",
            creator_id=admin.id
        )

        # Create additional workspaces
        create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Engineering",
            creator_id=admin.id,
            is_default=False
        )
        create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Sales",
            creator_id=admin.id,
            is_default=False
        )

        # List workspaces
        workspaces = list_organization_workspaces(
            db=db_session,
            organization_id=org.id,
            user_id=admin.id
        )

        # Should see all 3 (Default + Engineering + Sales)
        assert len(workspaces) == 3
        workspace_names = [ws.name for ws in workspaces]
        assert "Default" in workspace_names
        assert "Engineering" in workspace_names
        assert "Sales" in workspace_names

    def test_list_organization_workspaces_as_member(self, db_session):
        """
        Test listing workspaces as member sees only assigned

        WHY: Verify members only see workspaces they're assigned to
        HOW: Create workspaces, assign member to one, list as member
        """
        # Create users
        owner = User(username="ws_list_owner", is_active=True)
        member = User(username="ws_list_member", is_active=True)
        db_session.add_all([owner, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Member List Org",
            billing_email="wsmemberlist@test.com",
            creator_id=owner.id
        )

        # Add member to org
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Get default workspace
        default_ws = db_session.query(Workspace).filter_by(
            organization_id=org.id,
            is_default=True
        ).first()

        # Create Engineering workspace
        eng_ws = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Engineering",
            creator_id=owner.id,
            is_default=False
        )

        # Create Sales workspace (don't add member)
        create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Sales",
            creator_id=owner.id,
            is_default=False
        )

        # Add member to Engineering workspace only
        add_workspace_member(
            db=db_session,
            workspace_id=eng_ws.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="viewer"
        )

        # List workspaces as member
        workspaces = list_organization_workspaces(
            db=db_session,
            organization_id=org.id,
            user_id=member.id
        )

        # Should only see Engineering (not Default, not Sales)
        assert len(workspaces) == 1
        assert workspaces[0].name == "Engineering"

    def test_update_workspace_success(self, db_session):
        """
        Test updating workspace as admin

        WHY: Verify admins can update workspace details
        HOW: Create workspace, update name and settings
        """
        # Create user
        user = User(username="ws_updater", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Update Org",
            billing_email="wsupdate@test.com",
            creator_id=user.id
        )

        # Create workspace
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Original Name",
            creator_id=user.id,
            is_default=False
        )

        # Update workspace
        updated_ws = update_workspace(
            db=db_session,
            workspace_id=workspace.id,
            user_id=user.id,
            name="Updated Name",
            description="New description",
            settings={"theme": "dark"}
        )

        assert updated_ws.name == "Updated Name"
        assert updated_ws.description == "New description"
        assert updated_ws.settings["theme"] == "dark"

    def test_delete_workspace_success(self, db_session):
        """
        Test deleting workspace as admin

        WHY: Verify admins can delete non-default workspaces
        HOW: Create workspace, delete, verify gone
        """
        # Create user
        user = User(username="ws_deleter", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Delete Org",
            billing_email="wsdelete@test.com",
            creator_id=user.id
        )

        # Create workspace
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Temporary WS",
            creator_id=user.id,
            is_default=False
        )

        workspace_id = workspace.id

        # Delete workspace
        delete_workspace(
            db=db_session,
            workspace_id=workspace.id,
            user_id=user.id
        )

        # Verify deleted
        deleted_ws = db_session.query(Workspace).filter_by(id=workspace_id).first()
        assert deleted_ws is None

    def test_delete_default_workspace_fails(self, db_session):
        """
        Test deleting default workspace fails

        WHY: Verify default workspace cannot be deleted
        HOW: Try to delete default workspace, expect error
        """
        # Create user
        user = User(username="default_deleter", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create org (creates default workspace)
        org = create_organization(
            db=db_session,
            name="Default Delete Org",
            billing_email="defaultdelete@test.com",
            creator_id=user.id
        )

        # Get default workspace
        default_ws = db_session.query(Workspace).filter_by(
            organization_id=org.id,
            is_default=True
        ).first()

        # Try to delete default workspace
        with pytest.raises(HTTPException) as exc_info:
            delete_workspace(
                db=db_session,
                workspace_id=default_ws.id,
                user_id=user.id
            )

        assert exc_info.value.status_code == 400
        assert "default" in str(exc_info.value.detail).lower()


# ============================================================================
# MEMBERSHIP OPERATIONS TESTS
# ============================================================================

class TestMembershipOperations:
    """Test TenantService membership operations"""

    def test_add_organization_member_as_admin(self, db_session):
        """
        Test adding member to organization

        WHY: Verify admins can invite users to org
        HOW: Create org, add member, verify membership
        """
        # Create users
        owner = User(username="member_owner", is_active=True)
        new_member = User(username="new_member", is_active=True)
        db_session.add_all([owner, new_member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Member Test Org",
            billing_email="member@test.com",
            creator_id=owner.id
        )

        # Add member
        org_member = add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=new_member.id,
            role="member"
        )

        assert org_member.user_id == new_member.id
        assert org_member.organization_id == org.id
        assert org_member.role == "member"
        assert org_member.invited_by == owner.id

    def test_add_organization_member_as_non_admin_fails(self, db_session):
        """
        Test adding member as non-admin fails

        WHY: Verify only admin/owner can invite
        HOW: Try to invite as regular member
        """
        # Create users
        owner = User(username="invite_owner", is_active=True)
        member = User(username="invite_member", is_active=True)
        new_user = User(username="invite_new", is_active=True)
        db_session.add_all([owner, member, new_user])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Invite Test Org",
            billing_email="invite@test.com",
            creator_id=owner.id
        )

        # Add regular member
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Try to invite as member
        with pytest.raises(HTTPException) as exc_info:
            add_organization_member(
                db=db_session,
                organization_id=org.id,
                inviter_id=member.id,
                invitee_id=new_user.id,
                role="member"
            )

        assert exc_info.value.status_code == 403

    def test_update_organization_member_role(self, db_session):
        """
        Test updating member role

        WHY: Verify admins can change member roles
        HOW: Add member, promote to admin
        """
        # Create users
        owner = User(username="role_owner", is_active=True)
        member = User(username="role_member", is_active=True)
        db_session.add_all([owner, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Role Test Org",
            billing_email="role@test.com",
            creator_id=owner.id
        )

        # Add member
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Promote to admin
        updated_member = update_organization_member_role(
            db=db_session,
            organization_id=org.id,
            member_id=member.id,
            new_role="admin",
            updater_id=owner.id
        )

        assert updated_member.role == "admin"

    def test_promote_to_owner_requires_owner(self, db_session):
        """
        Test promoting to owner requires owner permission

        WHY: Verify only owners can create new owners
        HOW: Try to promote as admin
        """
        # Create users
        owner = User(username="promote_owner", is_active=True)
        admin = User(username="promote_admin", is_active=True)
        member = User(username="promote_member", is_active=True)
        db_session.add_all([owner, admin, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Promote Test Org",
            billing_email="promote@test.com",
            creator_id=owner.id
        )

        # Add admin and member
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=admin.id,
            role="admin"
        )
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Try to promote to owner as admin
        with pytest.raises(HTTPException) as exc_info:
            update_organization_member_role(
                db=db_session,
                organization_id=org.id,
                member_id=member.id,
                new_role="owner",
                updater_id=admin.id
            )

        assert exc_info.value.status_code == 403
        assert "owner" in str(exc_info.value.detail).lower()

    def test_remove_organization_member(self, db_session):
        """
        Test removing organization member

        WHY: Verify admins can remove members
        HOW: Add member, remove, verify gone
        """
        # Create users
        owner = User(username="remove_owner", is_active=True)
        member = User(username="remove_member", is_active=True)
        db_session.add_all([owner, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Remove Test Org",
            billing_email="remove@test.com",
            creator_id=owner.id
        )

        # Add member
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Remove member
        remove_organization_member(
            db=db_session,
            organization_id=org.id,
            member_id=member.id,
            remover_id=owner.id
        )

        # Verify removed
        membership = db_session.query(OrganizationMember).filter_by(
            organization_id=org.id,
            user_id=member.id
        ).first()
        assert membership is None

    def test_remove_last_owner_fails(self, db_session):
        """
        Test removing last owner fails

        WHY: Verify org must have at least one owner
        HOW: Try to remove only owner
        """
        # Create user
        owner = User(username="last_owner", is_active=True)
        db_session.add(owner)
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Last Owner Org",
            billing_email="lastowner@test.com",
            creator_id=owner.id
        )

        # Try to remove owner (the only owner)
        with pytest.raises(HTTPException) as exc_info:
            remove_organization_member(
                db=db_session,
                organization_id=org.id,
                member_id=owner.id,
                remover_id=owner.id
            )

        assert exc_info.value.status_code == 400
        assert "last owner" in str(exc_info.value.detail).lower()

    def test_add_workspace_member(self, db_session):
        """
        Test adding member to workspace

        WHY: Verify workspace admins can add members
        HOW: Create workspace, add member
        """
        # Create users
        owner = User(username="ws_member_owner", is_active=True)
        member = User(username="ws_member_user", is_active=True)
        db_session.add_all([owner, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Member Org",
            billing_email="wsmember@test.com",
            creator_id=owner.id
        )

        # Add member to org first (required)
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Create workspace
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Team WS",
            creator_id=owner.id,
            is_default=False
        )

        # Add member to workspace
        ws_member = add_workspace_member(
            db=db_session,
            workspace_id=workspace.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="viewer"
        )

        assert ws_member.user_id == member.id
        assert ws_member.workspace_id == workspace.id
        assert ws_member.role == "viewer"

    def test_add_workspace_member_not_org_member_fails(self, db_session):
        """
        Test adding non-org-member to workspace fails

        WHY: Verify users must be org members first
        HOW: Try to add user to workspace without org membership
        """
        # Create users
        owner = User(username="ws_org_owner", is_active=True)
        outsider = User(username="ws_outsider", is_active=True)
        db_session.add_all([owner, outsider])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Org Member Org",
            billing_email="wsorgmember@test.com",
            creator_id=owner.id
        )

        # Create workspace
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Private WS",
            creator_id=owner.id,
            is_default=False
        )

        # Try to add outsider to workspace (not org member)
        with pytest.raises(HTTPException) as exc_info:
            add_workspace_member(
                db=db_session,
                workspace_id=workspace.id,
                inviter_id=owner.id,
                invitee_id=outsider.id,
                role="viewer"
            )

        assert exc_info.value.status_code == 400
        assert "organization member" in str(exc_info.value.detail).lower()

    def test_update_workspace_member_role(self, db_session):
        """
        Test updating workspace member role

        WHY: Verify workspace admins can change roles
        HOW: Add viewer, promote to editor
        """
        # Create users
        owner = User(username="ws_role_owner", is_active=True)
        member = User(username="ws_role_member", is_active=True)
        db_session.add_all([owner, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Role Org",
            billing_email="wsrole@test.com",
            creator_id=owner.id
        )

        # Add member to org
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Create workspace
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Role WS",
            creator_id=owner.id,
            is_default=False
        )

        # Add member as viewer
        add_workspace_member(
            db=db_session,
            workspace_id=workspace.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="viewer"
        )

        # Promote to editor
        updated_member = update_workspace_member_role(
            db=db_session,
            workspace_id=workspace.id,
            member_id=member.id,
            updater_id=owner.id,
            new_role="editor"
        )

        assert updated_member.role == "editor"

    def test_remove_workspace_member(self, db_session):
        """
        Test removing workspace member

        WHY: Verify workspace admins can remove members
        HOW: Add member, remove, verify gone
        """
        # Create users
        owner = User(username="ws_remove_owner", is_active=True)
        member = User(username="ws_remove_member", is_active=True)
        db_session.add_all([owner, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Remove Org",
            billing_email="wsremove@test.com",
            creator_id=owner.id
        )

        # Add member to org
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Create workspace
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Remove WS",
            creator_id=owner.id,
            is_default=False
        )

        # Add member to workspace
        add_workspace_member(
            db=db_session,
            workspace_id=workspace.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="viewer"
        )

        # Remove member from workspace
        remove_workspace_member(
            db=db_session,
            workspace_id=workspace.id,
            member_id=member.id,
            remover_id=owner.id
        )

        # Verify removed
        ws_membership = db_session.query(WorkspaceMember).filter_by(
            workspace_id=workspace.id,
            user_id=member.id
        ).first()
        assert ws_membership is None


# ============================================================================
# PERMISSION VERIFICATION TESTS
# ============================================================================

class TestPermissionVerification:
    """Test permission verification helpers"""

    def test_verify_organization_permission_owner(self, db_session):
        """
        Test owner has all permissions

        WHY: Verify owner role has highest permissions
        HOW: Create org as owner, verify permissions
        """
        # Create user
        owner = User(username="perm_owner", is_active=True)
        db_session.add(owner)
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Perm Test Org",
            billing_email="perm@test.com",
            creator_id=owner.id
        )

        # Verify owner permission (no required role)
        org_member = verify_organization_permission(
            db=db_session,
            organization_id=org.id,
            user_id=owner.id
        )
        assert org_member.role == "owner"

        # Verify owner has admin permission
        org_member = verify_organization_permission(
            db=db_session,
            organization_id=org.id,
            user_id=owner.id,
            required_role="admin"
        )
        assert org_member.role == "owner"

        # Verify owner has owner permission
        org_member = verify_organization_permission(
            db=db_session,
            organization_id=org.id,
            user_id=owner.id,
            required_role="owner"
        )
        assert org_member.role == "owner"

    def test_verify_organization_permission_insufficient_role(self, db_session):
        """
        Test member cannot perform admin actions

        WHY: Verify role hierarchy enforcement
        HOW: Create member, require admin role, expect failure
        """
        # Create users
        owner = User(username="hier_owner", is_active=True)
        member = User(username="hier_member", is_active=True)
        db_session.add_all([owner, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Hierarchy Org",
            billing_email="hierarchy@test.com",
            creator_id=owner.id
        )

        # Add member
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Try to verify admin permission as member
        with pytest.raises(HTTPException) as exc_info:
            verify_organization_permission(
                db=db_session,
                organization_id=org.id,
                user_id=member.id,
                required_role="admin"
            )

        assert exc_info.value.status_code == 403

    def test_verify_workspace_access_org_admin(self, db_session):
        """
        Test org admin has access to all workspaces

        WHY: Verify org admins bypass workspace membership
        HOW: Create workspace, verify org admin can access
        """
        # Create users
        owner = User(username="ws_access_owner", is_active=True)
        admin = User(username="ws_access_admin", is_active=True)
        db_session.add_all([owner, admin])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Access Org",
            billing_email="wsaccess@test.com",
            creator_id=owner.id
        )

        # Add admin to org (not to workspace)
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=admin.id,
            role="admin"
        )

        # Create workspace (only owner is member)
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Private WS",
            creator_id=owner.id,
            is_default=False
        )

        # Verify admin can access (org admin override)
        has_access = verify_workspace_access(
            db=db_session,
            workspace_id=workspace.id,
            organization_id=org.id,
            user_id=admin.id
        )
        assert has_access is True

    def test_verify_workspace_permission_viewer_cannot_edit(self, db_session):
        """
        Test viewer cannot perform editor actions

        WHY: Verify workspace role hierarchy
        HOW: Create viewer, require editor role, expect failure
        """
        # Create users
        owner = User(username="ws_perm_owner", is_active=True)
        viewer = User(username="ws_perm_viewer", is_active=True)
        db_session.add_all([owner, viewer])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Perm Org",
            billing_email="wsperm@test.com",
            creator_id=owner.id
        )

        # Add viewer to org
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=viewer.id,
            role="member"
        )

        # Create workspace
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Perm WS",
            creator_id=owner.id,
            is_default=False
        )

        # Add viewer to workspace
        add_workspace_member(
            db=db_session,
            workspace_id=workspace.id,
            inviter_id=owner.id,
            invitee_id=viewer.id,
            role="viewer"
        )

        # Try to verify editor permission as viewer
        with pytest.raises(HTTPException) as exc_info:
            verify_workspace_permission(
                db=db_session,
                workspace_id=workspace.id,
                organization_id=org.id,
                user_id=viewer.id,
                required_role="editor"
            )

        assert exc_info.value.status_code == 403


# ============================================================================
# CONTEXT OPERATIONS TESTS
# ============================================================================

class TestContextOperations:
    """Test context helper operations"""

    def test_get_user_default_context(self, db_session):
        """
        Test getting user's default context

        WHY: Verify default context returns first org and default workspace
        HOW: Create org, get default context
        """
        # Create user
        user = User(username="context_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Context Org",
            billing_email="context@test.com",
            creator_id=user.id
        )

        # Get default context
        context = get_user_default_context(db=db_session, user_id=user.id)

        assert context is not None
        assert context["org_id"] == org.id
        assert context["workspace_id"] is not None

    def test_get_user_default_context_no_orgs(self, db_session):
        """
        Test getting default context with no organizations

        WHY: Verify None returned when user has no orgs
        HOW: Create user, get context without creating org
        """
        # Create user (no org)
        user = User(username="no_org_user", is_active=True)
        db_session.add(user)
        db_session.commit()

        # Get default context
        context = get_user_default_context(db=db_session, user_id=user.id)

        assert context["org_id"] is None
        assert context["workspace_id"] is None

    def test_get_organization_members(self, db_session):
        """
        Test getting organization members with user details

        WHY: Verify member list includes user info
        HOW: Create org with multiple members, get list
        """
        # Create users
        owner = User(username="list_owner", is_active=True)
        admin = User(username="list_admin", is_active=True)
        member = User(username="list_member", is_active=True)
        db_session.add_all([owner, admin, member])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="Member List Org",
            billing_email="memberlist@test.com",
            creator_id=owner.id
        )

        # Add members
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=admin.id,
            role="admin"
        )
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=member.id,
            role="member"
        )

        # Get members
        members = get_organization_members(db=db_session, organization_id=org.id, user_id=owner.id)

        assert len(members) == 3

        # Verify all members present (exact order may vary)
        usernames = [user.username for membership, user in members]
        roles = [membership.role for membership, user in members]

        assert "list_owner" in usernames
        assert "list_admin" in usernames
        assert "list_member" in usernames
        assert "owner" in roles
        assert "admin" in roles
        assert "member" in roles

    def test_get_workspace_members(self, db_session):
        """
        Test getting workspace members with user details

        WHY: Verify workspace member list includes user info
        HOW: Create workspace with multiple members, get list
        """
        # Create users
        owner = User(username="ws_list_owner", is_active=True)
        editor = User(username="ws_list_editor", is_active=True)
        viewer = User(username="ws_list_viewer", is_active=True)
        db_session.add_all([owner, editor, viewer])
        db_session.commit()

        # Create org
        org = create_organization(
            db=db_session,
            name="WS Member List Org",
            billing_email="wsmemberlist@test.com",
            creator_id=owner.id
        )

        # Add members to org
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=editor.id,
            role="member"
        )
        add_organization_member(
            db=db_session,
            organization_id=org.id,
            inviter_id=owner.id,
            invitee_id=viewer.id,
            role="member"
        )

        # Create workspace
        workspace = create_workspace(
            db=db_session,
            organization_id=org.id,
            name="Member List WS",
            creator_id=owner.id,
            is_default=False
        )

        # Add members to workspace
        add_workspace_member(
            db=db_session,
            workspace_id=workspace.id,
            inviter_id=owner.id,
            invitee_id=editor.id,
            role="editor"
        )
        add_workspace_member(
            db=db_session,
            workspace_id=workspace.id,
            inviter_id=owner.id,
            invitee_id=viewer.id,
            role="viewer"
        )

        # Get members
        members = get_workspace_members(db=db_session, workspace_id=workspace.id, user_id=owner.id)

        assert len(members) == 3

        # Verify all members present (exact order may vary)
        usernames = [user.username for membership, user in members]
        roles = [membership.role for membership, user in members]

        assert "ws_list_owner" in usernames
        assert "ws_list_editor" in usernames
        assert "ws_list_viewer" in usernames
        assert "admin" in roles
        assert "editor" in roles
        assert "viewer" in roles
