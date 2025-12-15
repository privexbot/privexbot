"""
Solana Wallet Authentication Unit Tests

WHY: Test Solana wallet authentication endpoints
HOW: Use pytest with FastAPI TestClient and solders

Tests:
- Challenge generation
- Signature verification
- Account linking

USAGE:
    pytest app/tests/auth/unit/test_solana_auth.py -v
"""

import pytest
from fastapi.testclient import TestClient
from solders.keypair import Keypair
import base58


class TestSolanaAuth:
    """Test Solana wallet authentication endpoints"""

    def test_solana_challenge_success(self, client):
        """
        Test Solana wallet challenge generation

        WHY: Verify challenge-response flow starts correctly
        HOW: Request challenge with wallet address
        """
        keypair = Keypair()
        wallet_address = str(keypair.pubkey())

        response = client.post("/api/v1/auth/solana/challenge", json={"address": wallet_address})
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "nonce" in data
        assert len(data["nonce"]) == 32

    def test_solana_verify_success(self, client):
        """
        Test successful Solana wallet verification

        WHY: Verify signature validation works
        HOW: Request challenge, sign it with Solana keypair, verify
        """
        # Create wallet and request challenge
        keypair = Keypair()
        wallet_address = str(keypair.pubkey())

        challenge_response = client.post(
            "/api/v1/auth/solana/challenge",
            json={"address": wallet_address}
        )
        assert challenge_response.status_code == 200
        challenge_data = challenge_response.json()

        # Sign the challenge
        message = challenge_data["message"]
        message_bytes = message.encode('utf-8')
        signature = keypair.sign_message(message_bytes)
        signature_b58 = base58.b58encode(bytes(signature)).decode('utf-8')

        # Verify signature
        verify_data = {
            "address": wallet_address,
            "signed_message": message,  # Send as string
            "signature": signature_b58
        }
        verify_response = client.post("/api/v1/auth/solana/verify", json=verify_data)
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert "access_token" in data

    def test_solana_link_success(self, client, test_user_data):
        """
        Test linking Solana wallet to existing account

        WHY: Verify account linking functionality
        HOW: Signup with email, then link Solana wallet
        """
        # Signup with email
        signup_response = client.post("/api/v1/auth/email/signup", json=test_user_data)
        token = signup_response.json()["access_token"]

        # Create new wallet and request challenge
        keypair = Keypair()
        wallet_address = str(keypair.pubkey())

        challenge_response = client.post(
            "/api/v1/auth/solana/challenge",
            json={"address": wallet_address}
        )
        challenge_data = challenge_response.json()

        # Sign the challenge
        message = challenge_data["message"]
        message_bytes = message.encode('utf-8')
        signature = keypair.sign_message(message_bytes)
        signature_b58 = base58.b58encode(bytes(signature)).decode('utf-8')

        # Link wallet to account
        link_data = {
            "address": wallet_address,
            "signed_message": message,  # Send as string
            "signature": signature_b58
        }
        headers = {"Authorization": f"Bearer {token}"}
        link_response = client.post("/api/v1/auth/solana/link", json=link_data, headers=headers)
        assert link_response.status_code == 200
