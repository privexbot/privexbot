"""
EVM Wallet Authentication Unit Tests

WHY: Test EVM (Ethereum) wallet authentication endpoints
HOW: Use pytest with FastAPI TestClient and eth_account

Tests:
- Challenge generation
- Signature verification
- Account linking
- Error handling (invalid address, invalid signature, wrong nonce)

USAGE:
    pytest app/tests/auth/unit/test_evm_auth.py -v
"""

import pytest
from fastapi.testclient import TestClient
from eth_account import Account
from eth_account.messages import encode_defunct


class TestEVMAuth:
    """Test EVM wallet authentication endpoints"""

    def test_evm_challenge_success(self, client):
        """
        Test EVM wallet challenge generation

        WHY: Verify challenge-response flow starts correctly
        HOW: Request challenge with wallet address
        """
        account = Account.create()
        wallet_address = account.address

        response = client.post("/api/v1/auth/evm/challenge", json={"address": wallet_address})
        assert response.status_code == 200
        data = response.json()
        assert "message" in data  # API uses 'message' not 'challenge'
        assert "nonce" in data
        assert len(data["nonce"]) == 32  # hex string

    def test_evm_challenge_invalid_address(self, client):
        """
        Test EVM challenge with invalid address

        WHY: Validate wallet address format
        HOW: Request challenge with invalid address, expect 400/422
        """
        response = client.post("/api/v1/auth/evm/challenge", json={"address": "invalid"})
        assert response.status_code in [400, 422]

    def test_evm_verify_success(self, client):
        """
        Test successful EVM wallet verification

        WHY: Verify signature validation works
        HOW: Request challenge, sign it, verify signature
        """
        # Create wallet and request challenge
        account = Account.create()
        wallet_address = account.address

        challenge_response = client.post(
            "/api/v1/auth/evm/challenge",
            json={"address": wallet_address}
        )
        assert challenge_response.status_code == 200
        challenge_data = challenge_response.json()

        # Sign the challenge
        message = challenge_data["message"]
        message_hash = encode_defunct(text=message)
        signed_message = account.sign_message(message_hash)
        signature = signed_message.signature.hex()

        # Verify signature
        verify_data = {
            "address": wallet_address,
            "signed_message": message,
            "signature": signature
        }
        verify_response = client.post("/api/v1/auth/evm/verify", json=verify_data)
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert "access_token" in data
        assert "token_type" in data

    def test_evm_verify_invalid_signature(self, client):
        """
        Test EVM verification with invalid signature

        WHY: Verify signature validation is secure
        HOW: Request challenge, send wrong signature, expect 401
        """
        # Create wallet and request challenge
        account = Account.create()
        wallet_address = account.address

        challenge_response = client.post(
            "/api/v1/auth/evm/challenge",
            json={"address": wallet_address}
        )
        challenge_data = challenge_response.json()

        # Send invalid signature
        message = challenge_data["message"]
        verify_data = {
            "address": wallet_address,
            "signed_message": message,
            "signature": "0x" + "0" * 130  # Invalid signature
        }
        verify_response = client.post("/api/v1/auth/evm/verify", json=verify_data)
        assert verify_response.status_code == 401

    def test_evm_verify_wrong_nonce(self, client):
        """
        Test EVM verification with wrong nonce

        WHY: Prevent replay attacks
        HOW: Request challenge twice, use first message with second challenge, expect 400
        """
        # Create wallet and request first challenge
        account = Account.create()
        wallet_address = account.address

        first_challenge = client.post(
            "/api/v1/auth/evm/challenge",
            json={"address": wallet_address}
        )
        first_message = first_challenge.json()["message"]

        # Request second challenge (this invalidates the first nonce in Redis)
        second_challenge = client.post(
            "/api/v1/auth/evm/challenge",
            json={"address": wallet_address}
        )

        # Sign the FIRST message but the nonce is now different
        message_hash = encode_defunct(text=first_message)
        signed_message = account.sign_message(message_hash)
        signature = signed_message.signature.hex()

        # Try to verify with old message (wrong nonce)
        verify_data = {
            "address": wallet_address,
            "signed_message": first_message,
            "signature": signature
        }
        verify_response = client.post("/api/v1/auth/evm/verify", json=verify_data)
        assert verify_response.status_code == 400  # Nonce expired/invalid

    def test_evm_link_success(self, client, test_user_data):
        """
        Test linking EVM wallet to existing account

        WHY: Verify account linking functionality
        HOW: Signup with email, then link EVM wallet
        """
        # Signup with email
        signup_response = client.post("/api/v1/auth/email/signup", json=test_user_data)
        token = signup_response.json()["access_token"]

        # Create new wallet and request challenge
        account = Account.create()
        wallet_address = account.address

        challenge_response = client.post(
            "/api/v1/auth/evm/challenge",
            json={"address": wallet_address}
        )
        challenge_data = challenge_response.json()

        # Sign the challenge
        message = challenge_data["message"]
        message_hash = encode_defunct(text=message)
        signed_message = account.sign_message(message_hash)
        signature = signed_message.signature.hex()

        # Link wallet to account
        link_data = {
            "address": wallet_address,
            "signed_message": message,
            "signature": signature
        }
        headers = {"Authorization": f"Bearer {token}"}
        link_response = client.post("/api/v1/auth/evm/link", json=link_data, headers=headers)
        assert link_response.status_code == 200

    def test_evm_link_no_auth(self, client):
        """
        Test EVM wallet linking without authentication

        WHY: Verify auth protection
        HOW: Try linking wallet without token, expect 401
        """
        account = Account.create()
        wallet_address = account.address

        challenge_response = client.post(
            "/api/v1/auth/evm/challenge",
            json={"address": wallet_address}
        )
        challenge_data = challenge_response.json()
        message = challenge_data["message"]

        link_data = {
            "address": wallet_address,
            "signed_message": message,
            "signature": "0x" + "0" * 130
        }
        link_response = client.post("/api/v1/auth/evm/link", json=link_data)
        assert link_response.status_code in [401, 403]  # Either unauthorized or forbidden
