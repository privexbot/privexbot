"""
Email Authentication Unit Tests

WHY: Test email/password authentication endpoints
HOW: Use pytest with FastAPI TestClient

Tests:
- Signup with email/password
- Login with credentials
- Change password
- Edge cases (duplicate email, weak password, wrong password)

USAGE:
    pytest app/tests/auth/unit/test_email_auth.py -v
"""

import pytest
from fastapi.testclient import TestClient


class TestEmailAuth:
    """Test email authentication endpoints"""

    def test_email_signup_success(self, client, test_user_data):
        """
        Test successful email signup

        WHY: Verify users can register with email/password
        HOW: POST to /auth/email/signup with valid data
        """
        response = client.post("/api/v1/auth/email/signup", json=test_user_data)
        assert response.status_code == 201  # HTTP_201_CREATED
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0

    def test_email_signup_duplicate(self, client, test_user_data):
        """
        Test duplicate email signup rejection

        WHY: Prevent multiple accounts with same email
        HOW: Sign up twice with same email, expect 400
        """
        # First signup succeeds
        response1 = client.post("/api/v1/auth/email/signup", json=test_user_data)
        assert response1.status_code == 201  # HTTP_201_CREATED

        # Second signup with same email fails
        response2 = client.post("/api/v1/auth/email/signup", json=test_user_data)
        assert response2.status_code == 400
        detail = response2.json()["detail"].lower()
        assert "already" in detail and ("registered" in detail or "exists" in detail)

    def test_email_signup_weak_password(self, client):
        """
        Test weak password rejection

        WHY: Enforce password strength requirements
        HOW: Try signup with weak password, expect 400/422
        """
        weak_data = {
            "email": "weak@example.com",
            "password": "weak",
            "username": "weakuser"
        }
        response = client.post("/api/v1/auth/email/signup", json=weak_data)
        assert response.status_code in [400, 422]

    def test_email_signup_invalid_email(self, client):
        """
        Test invalid email format rejection

        WHY: Validate email format
        HOW: Try signup with invalid email, expect 422
        """
        invalid_data = {
            "email": "not-an-email",
            "password": "Test@1234",
            "username": "testuser"
        }
        response = client.post("/api/v1/auth/email/signup", json=invalid_data)
        assert response.status_code == 422

    def test_email_login_success(self, client, test_user_data):
        """
        Test successful email login

        WHY: Verify users can login with correct credentials
        HOW: Signup, then login with same credentials
        """
        # Signup first
        client.post("/api/v1/auth/email/signup", json=test_user_data)

        # Login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/api/v1/auth/email/login", json=login_data)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data

    def test_email_login_wrong_password(self, client, test_user_data):
        """
        Test login with wrong password

        WHY: Verify authentication security
        HOW: Signup, then try login with wrong password, expect 401
        """
        # Signup first
        client.post("/api/v1/auth/email/signup", json=test_user_data)

        # Try login with wrong password
        login_data = {
            "email": test_user_data["email"],
            "password": "WrongPassword@123"
        }
        response = client.post("/api/v1/auth/email/login", json=login_data)
        assert response.status_code == 401

    def test_email_login_nonexistent_user(self, client):
        """
        Test login with nonexistent email

        WHY: Verify proper error handling
        HOW: Try login without signup, expect 401
        """
        login_data = {
            "email": "nonexistent@example.com",
            "password": "Test@1234"
        }
        response = client.post("/api/v1/auth/email/login", json=login_data)
        assert response.status_code == 401

    def test_email_change_password_success(self, client, test_user_data):
        """
        Test successful password change

        WHY: Verify users can update their password
        HOW: Signup, login, change password with auth token
        """
        # Signup and get token
        signup_response = client.post("/api/v1/auth/email/signup", json=test_user_data)
        token = signup_response.json()["access_token"]

        # Change password
        change_data = {
            "old_password": test_user_data["password"],
            "new_password": "NewTest@5678"
        }
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post(
            "/api/v1/auth/email/change-password",
            json=change_data,
            headers=headers
        )
        assert response.status_code == 200

        # Verify can login with new password
        login_data = {
            "email": test_user_data["email"],
            "password": "NewTest@5678"
        }
        login_response = client.post("/api/v1/auth/email/login", json=login_data)
        assert login_response.status_code == 200

    def test_email_change_password_wrong_old_password(self, client, test_user_data):
        """
        Test password change with wrong old password

        WHY: Verify old password validation
        HOW: Try changing password with wrong old password, expect 401
        """
        # Signup and get token
        signup_response = client.post("/api/v1/auth/email/signup", json=test_user_data)
        token = signup_response.json()["access_token"]

        # Try change password with wrong old password
        change_data = {
            "old_password": "WrongOld@123",
            "new_password": "NewTest@5678"
        }
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post(
            "/api/v1/auth/email/change-password",
            json=change_data,
            headers=headers
        )
        assert response.status_code == 401  # Unauthorized - wrong password

    def test_email_change_password_no_auth(self, client):
        """
        Test password change without authentication

        WHY: Verify auth protection
        HOW: Try changing password without token, expect 403
        """
        change_data = {
            "old_password": "Test@1234",
            "new_password": "NewTest@5678"
        }
        response = client.post("/api/v1/auth/email/change-password", json=change_data)
        assert response.status_code == 403  # Forbidden - no auth token
