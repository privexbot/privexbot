"""
Real integration tests for KB Inspection and Document CRUD endpoints.

WHY:
- Test actual API endpoints with real database
- Verify document CRUD operations work end-to-end
- No mocks - test against actual implementation

HOW:
- Use pytest fixtures for database setup/teardown
- Create real users, workspaces, KBs in test database
- Make real API calls through TestClient
- Clean up after each test
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import uuid4
from datetime import datetime

from app.main import app
from app.db.base_class import Base
from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.models.workspace import Workspace
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.chunk import Chunk
from app.models.organization_member import OrganizationMember
from app.models.workspace_member import WorkspaceMember


@pytest.fixture(scope="function")
def db_session():
    """Use the existing test database (from get_db dependency)."""
    # Simply use the existing database - no need to create/drop tables
    # The database is already set up and running
    from app.db.session import SessionLocal

    session = SessionLocal()
    try:
        yield session
        # Rollback any uncommitted changes
        session.rollback()
    finally:
        # Clean up test data
        session.query(Chunk).delete()
        session.query(Document).delete()
        session.query(KnowledgeBase).delete()
        session.query(WorkspaceMember).delete()
        session.query(Workspace).delete()
        session.query(OrganizationMember).delete()
        session.query(Organization).delete()
        session.query(User).delete()
        session.commit()
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database dependency override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db_session):
    """Create a test user."""
    user = User(
        id=uuid4(),
        username=f"testuser_{uuid4().hex[:8]}",
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def test_org(db_session, test_user):
    """Create a test organization."""
    org = Organization(
        id=uuid4(),
        name=f"Test Org {uuid4().hex[:8]}",
        billing_email=f"billing_{uuid4().hex[:8]}@test.com",  # Required field
        created_by=test_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    # Add user as org member
    member = OrganizationMember(
        organization_id=org.id,
        user_id=test_user.id,
        role="owner",
        joined_at=datetime.utcnow()
    )
    db_session.add(member)
    db_session.commit()

    return org


@pytest.fixture(scope="function")
def test_workspace(db_session, test_user, test_org):
    """Create a test workspace."""
    workspace = Workspace(
        id=uuid4(),
        name=f"Test Workspace {uuid4().hex[:8]}",
        organization_id=test_org.id,
        created_by=test_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(workspace)
    db_session.commit()
    db_session.refresh(workspace)

    # Add user as workspace member
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user.id,
        role="admin",
        joined_at=datetime.utcnow()
    )
    db_session.add(member)
    db_session.commit()

    return workspace


@pytest.fixture(scope="function")
def test_kb(db_session, test_user, test_workspace):
    """Create a test knowledge base."""
    kb = KnowledgeBase(
        id=uuid4(),
        workspace_id=test_workspace.id,
        name=f"Test KB {uuid4().hex[:8]}",
        description="Test knowledge base",
        status="ready",
        created_by=test_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(kb)
    db_session.commit()
    db_session.refresh(kb)
    return kb


@pytest.fixture(scope="function")
def test_document(db_session, test_kb, test_workspace, test_user):
    """Create a test document."""
    doc = Document(
        id=uuid4(),
        kb_id=test_kb.id,
        workspace_id=test_workspace.id,
        name=f"Test Document {uuid4().hex[:8]}",
        source_type="manual",
        source_url="https://example.com/doc",
        content_preview="This is a test document content...",
        status="completed",
        word_count=100,
        character_count=500,
        chunk_count=5,
        is_enabled=True,
        created_by=test_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@pytest.fixture(scope="function")
def authenticated_client(client, test_user):
    """Create an authenticated test client."""
    # Override get_current_user to return test_user
    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_get_current_user

    yield client

    # Clean up
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]


class TestKBDocumentsEndpoint:
    """Test GET /kbs/{kb_id}/documents endpoint."""

    def test_list_kb_documents_success(
        self,
        authenticated_client,
        test_kb,
        test_document,
        db_session
    ):
        """Test successfully listing documents in a KB."""
        response = authenticated_client.get(f"/api/v1/kbs/{test_kb.id}/documents")

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "kb_id" in data
        assert "total_documents" in data
        assert "documents" in data
        assert "page" in data
        assert "limit" in data

        # Check data
        assert str(data["kb_id"]) == str(test_kb.id)
        assert data["total_documents"] >= 1
        assert len(data["documents"]) >= 1

        # Check document structure
        doc = data["documents"][0]
        assert "id" in doc
        assert "name" in doc
        assert "status" in doc
        assert "source_type" in doc

    def test_list_kb_documents_with_pagination(
        self,
        authenticated_client,
        test_kb,
        test_document,
        db_session
    ):
        """Test pagination parameters."""
        response = authenticated_client.get(
            f"/api/v1/kbs/{test_kb.id}/documents?page=1&limit=10"
        )

        assert response.status_code == 200
        data = response.json()

        assert data["page"] == 1
        assert data["limit"] == 10

    def test_list_kb_documents_nonexistent_kb(self, authenticated_client):
        """Test listing documents for non-existent KB."""
        fake_kb_id = uuid4()
        response = authenticated_client.get(f"/api/v1/kbs/{fake_kb_id}/documents")

        # Should return 404 or 403 (depending on implementation)
        assert response.status_code in [403, 404]


class TestDocumentCRUDEndpoints:
    """Test document CRUD operations."""

    def test_create_document_success(
        self,
        authenticated_client,
        test_kb,
        db_session
    ):
        """Test creating a new document."""
        payload = {
            "name": "New Test Document",
            "content": "This is test content that is definitely longer than 50 characters to meet validation requirements.",
            "source_type": "manual"
        }

        response = authenticated_client.post(
            f"/api/v1/kbs/{test_kb.id}/documents",
            json=payload
        )

        # Should create successfully
        assert response.status_code == 201
        data = response.json()

        assert "id" in data
        assert data["name"] == payload["name"]
        assert "status" in data

        # Verify document was created in database
        doc = db_session.query(Document).filter(
            Document.name == payload["name"]
        ).first()
        assert doc is not None

    def test_create_document_content_too_short(
        self,
        authenticated_client,
        test_kb
    ):
        """Test validation fails for content < 50 characters."""
        payload = {
            "name": "Test Doc",
            "content": "Too short",  # Less than 50 chars
            "source_type": "manual"
        }

        response = authenticated_client.post(
            f"/api/v1/kbs/{test_kb.id}/documents",
            json=payload
        )

        # Should fail validation (FastAPI returns 422 for validation errors)
        assert response.status_code == 422

    def test_get_document_by_id(
        self,
        authenticated_client,
        test_kb,
        test_document
    ):
        """Test retrieving a specific document."""
        response = authenticated_client.get(
            f"/api/v1/kbs/{test_kb.id}/documents/{test_document.id}"
        )

        assert response.status_code == 200
        data = response.json()

        assert str(data["id"]) == str(test_document.id)
        assert data["name"] == test_document.name
        assert data["source_type"] == test_document.source_type

    def test_update_document(
        self,
        authenticated_client,
        test_kb,
        test_document,
        db_session
    ):
        """Test updating a document."""
        payload = {
            "name": "Updated Document Name",
            "is_enabled": False
        }

        response = authenticated_client.put(
            f"/api/v1/kbs/{test_kb.id}/documents/{test_document.id}",
            json=payload
        )

        assert response.status_code == 200

        # Verify update in database
        db_session.refresh(test_document)
        assert test_document.name == payload["name"]
        assert test_document.is_enabled == payload["is_enabled"]

    def test_delete_document(
        self,
        authenticated_client,
        test_kb,
        test_document,
        db_session
    ):
        """Test deleting a document."""
        doc_id = test_document.id

        response = authenticated_client.delete(
            f"/api/v1/kbs/{test_kb.id}/documents/{doc_id}"
        )

        # Refresh to get latest state
        db_session.refresh(test_document)

        if response.status_code == 200:
            # Success case: Document should be deleted from database
            doc = db_session.query(Document).filter(Document.id == doc_id).first()
            assert doc is None, "Document should be deleted when Qdrant delete succeeds"

        elif response.status_code == 500:
            # Qdrant delete failed case (expected in test environment)
            # Document should still exist but marked as pending_deletion
            doc = db_session.query(Document).filter(Document.id == doc_id).first()
            assert doc is not None, "Document should still exist when Qdrant delete fails"
            assert doc.status == "pending_deletion", f"Document should be marked pending_deletion, got {doc.status}"
            assert "Qdrant" in response.json().get("detail", ""), "Error message should mention Qdrant"

        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")


class TestDocumentChunksEndpoint:
    """Test GET /kbs/{kb_id}/chunks endpoint (with document_id query param)."""

    def test_list_document_chunks(
        self,
        authenticated_client,
        test_kb,
        test_document,
        db_session
    ):
        """Test listing chunks for a document."""
        # Create test chunks
        for i in range(3):
            chunk = Chunk(
                id=uuid4(),
                document_id=test_document.id,
                kb_id=test_kb.id,
                content=f"This is test chunk {i} with some content for testing purposes.",
                position=i,
                chunk_index=i,
                word_count=10,
                character_count=64,
                is_enabled=True,
                created_at=datetime.utcnow()
            )
            db_session.add(chunk)
        db_session.commit()

        # Note: Endpoint uses query parameter, not path parameter
        response = authenticated_client.get(
            f"/api/v1/kbs/{test_kb.id}/chunks?document_id={test_document.id}"
        )

        assert response.status_code == 200
        data = response.json()

        # Response structure from kb.py:857-960
        assert "kb_id" in data
        assert "total_chunks" in data
        assert "chunks" in data

        assert data["total_chunks"] >= 3
        assert len(data["chunks"]) >= 3


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
