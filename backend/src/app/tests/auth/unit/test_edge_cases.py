"""
Edge Cases and Security Tests

WHY: Test edge cases and security scenarios
HOW: Use pytest with FastAPI TestClient

Tests:
- Missing required fields
- Empty strings
- SQL injection attempts
- Very long inputs

USAGE:
    pytest app/tests/auth/unit/test_edge_cases.py -v
"""

import pytest
from fastapi.testclient import TestClient


class TestEdgeCases:
    """Test edge cases and error scenarios"""

    def test_missing_required_fields(self, client):
        """
        Test API with missing required fields

        WHY: Verify validation works
        HOW: Send incomplete data, expect 422
        """
        # Missing password
        response = client.post("/api/v1/auth/email/signup", json={
            "email": "test@example.com",
            "username": "testuser"
        })
        assert response.status_code == 422

    def test_empty_strings(self, client):
        """
        Test API with empty strings

        WHY: Verify empty value handling
        HOW: Send empty strings, expect 422
        """
        response = client.post("/api/v1/auth/email/signup", json={
            "email": "",
            "password": "",
            "username": ""
        })
        assert response.status_code == 422

    def test_sql_injection_attempt(self, client):
        """
        Test SQL injection protection

        WHY: Verify security against SQL injection
        HOW: Try SQL injection in username, should be treated as literal string
        """
        sql_injection_data = {
            "email": "test@example.com",
            "password": "Test@1234",
            "username": "admin' OR '1'='1"
        }
        response = client.post("/api/v1/auth/email/signup", json=sql_injection_data)
        # Should either succeed (treating as literal) or reject for invalid chars
        assert response.status_code in [201, 400, 422]  # 201 = Created

    def test_very_long_inputs(self, client):
        """
        Test handling of very long inputs

        WHY: Verify input length validation
        HOW: Send very long strings, expect 422
        """
        long_string = "a" * 10000
        response = client.post("/api/v1/auth/email/signup", json={
            "email": f"{long_string}@example.com",
            "password": "Test@1234",
            "username": long_string
        })
        assert response.status_code in [400, 422]
