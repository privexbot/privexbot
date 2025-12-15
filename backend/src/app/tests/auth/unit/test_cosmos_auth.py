"""
Cosmos Wallet Authentication Unit Tests

WHY: Test Cosmos wallet authentication endpoints
HOW: Use pytest with FastAPI TestClient

Tests:
- Challenge generation
- Address validation

USAGE:
    pytest app/tests/auth/unit/test_cosmos_auth.py -v
"""

import pytest
from fastapi.testclient import TestClient


class TestCosmosAuth:
    """Test Cosmos wallet authentication endpoints"""

    def test_cosmos_challenge_success(self, client):
        """
        Test Cosmos wallet challenge generation

        WHY: Verify challenge-response flow starts correctly
        HOW: Request challenge with wallet address
        """
        wallet_address = "secret1ap26qrlp8mcq2pg6r47w43l0y8zkqm8a450s03"

        response = client.post("/api/v1/auth/cosmos/challenge", json={"address": wallet_address})
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "nonce" in data

    def test_cosmos_challenge_invalid_address(self, client):
        """
        Test Cosmos challenge with invalid address

        WHY: Validate wallet address format
        HOW: Request challenge with invalid address, expect 400/422
        """
        response = client.post("/api/v1/auth/cosmos/challenge", json={"address": "invalid"})
        assert response.status_code in [400, 422]
