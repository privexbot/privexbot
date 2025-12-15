"""
Pytest configuration and fixtures for authentication tests

WHY: Provide reusable test fixtures and setup/teardown
HOW: Use pytest fixtures for database, client, and test data
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.core.config import settings

# Use PostgreSQL database for testing (supports UUID)
# WHY: SQLite doesn't support UUID type, so we use PostgreSQL
# HOW: Connect to PostgreSQL instance running in Docker
# NOTE: hostname is 'postgres' (Docker service name), not 'localhost'
SQLALCHEMY_DATABASE_URL = "postgresql://privexbot:privexbot_dev@postgres:5432/privexbot_dev"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """
    Create a fresh database session for each test

    WHY: Isolate tests from each other
    HOW: Clean data between tests (tables already exist from migration)
    """
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        # Clean up data after test
        session.rollback()
        # Delete all test data (order matters due to foreign keys)
        from app.models.workspace_member import WorkspaceMember
        from app.models.workspace import Workspace
        from app.models.organization_member import OrganizationMember
        from app.models.organization import Organization
        from app.models.auth_identity import AuthIdentity
        from app.models.user import User

        # Delete in reverse dependency order
        session.query(WorkspaceMember).delete()
        session.query(Workspace).delete()
        session.query(OrganizationMember).delete()
        session.query(Organization).delete()
        session.query(AuthIdentity).delete()
        session.query(User).delete()
        session.commit()
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """
    Create a test client with overridden database dependency

    WHY: Test API endpoints without affecting production database
    HOW: Override get_db dependency with test database session
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Provide test user data"""
    return {
        "email": "test@example.com",
        "password": "Test@1234",
        "username": "testuser"
    }


@pytest.fixture
def test_user_data_2():
    """Provide second test user data"""
    return {
        "email": "test2@example.com",
        "password": "Test@5678",
        "username": "testuser2"
    }
