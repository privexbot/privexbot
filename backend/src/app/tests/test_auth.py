"""
Comprehensive Authentication Tests

WHY: Test all authentication endpoints and edge cases
HOW: Use pytest with FastAPI TestClient and fixtures

Tests:
1. Email authentication (signup, login, change-password)
2. EVM wallet authentication (challenge, verify, link)
3. Solana wallet authentication (challenge, verify, link)
4. Cosmos wallet authentication (challenge, verify, link)
5. Edge cases and error handling
6. Account linking functionality

USAGE:
    pytest app/tests/test_auth.py -v
"""

import pytest
from fastapi.testclient import TestClient
from eth_account import Account
from eth_account.messages import encode_defunct
from solders.keypair import Keypair
import base64
import base58


# ============================================================================
# EMAIL AUTHENTICATION TESTS
# ============================================================================

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


# ============================================================================
# EVM WALLET AUTHENTICATION TESTS
# ============================================================================

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


# ============================================================================
# SOLANA WALLET AUTHENTICATION TESTS
# ============================================================================

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


# ============================================================================
# COSMOS WALLET AUTHENTICATION TESTS
# ============================================================================

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


# ============================================================================
# EDGE CASES AND INTEGRATION TESTS
# ============================================================================

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


class TestAccountLinking:
    """Test account linking scenarios"""

    def test_link_multiple_wallets_to_one_account(self, client, test_user_data):
        """
        Test linking multiple wallets to single account

        WHY: Verify multi-wallet linking works
        HOW: Signup with email, link EVM and Solana wallets
        """
        # Signup with email
        signup_response = client.post("/api/v1/auth/email/signup", json=test_user_data)
        token = signup_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Link EVM wallet
        evm_account = Account.create()
        evm_address = evm_account.address

        evm_challenge = client.post("/api/v1/auth/evm/challenge", json={"address": evm_address})
        evm_challenge_data = evm_challenge.json()

        message_hash = encode_defunct(text=evm_challenge_data["message"])
        signed_message = evm_account.sign_message(message_hash)

        evm_link_response = client.post("/api/v1/auth/evm/link", json={
            "address": evm_address,
            "signed_message": evm_challenge_data["message"],
            "signature": signed_message.signature.hex()
        }, headers=headers)
        assert evm_link_response.status_code == 200

        # Link Solana wallet
        sol_keypair = Keypair()
        sol_address = str(sol_keypair.pubkey())

        sol_challenge = client.post("/api/v1/auth/solana/challenge", json={"address": sol_address})
        sol_challenge_data = sol_challenge.json()

        sol_message = sol_challenge_data["message"].encode('utf-8')
        sol_signature = sol_keypair.sign_message(sol_message)
        sol_signature_b58 = base58.b58encode(bytes(sol_signature)).decode('utf-8')

        sol_link_response = client.post("/api/v1/auth/solana/link", json={
            "address": sol_address,
            "signed_message": sol_challenge_data["message"],
            "signature": sol_signature_b58
        }, headers=headers)
        assert sol_link_response.status_code == 200

    def test_login_with_linked_wallet(self, client, test_user_data):
        """
        Test logging in with a previously linked wallet

        WHY: Verify linked wallet can be used for login
        HOW: Signup with email, link wallet, logout, login with wallet
        """
        # Signup with email
        signup_response = client.post("/api/v1/auth/email/signup", json=test_user_data)
        email_token = signup_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {email_token}"}

        # Link EVM wallet
        evm_account = Account.create()
        evm_address = evm_account.address

        evm_challenge = client.post("/api/v1/auth/evm/challenge", json={"address": evm_address})
        evm_challenge_data = evm_challenge.json()

        message_hash = encode_defunct(text=evm_challenge_data["message"])
        signed_message = evm_account.sign_message(message_hash)

        evm_link_response = client.post("/api/v1/auth/evm/link", json={
            "address": evm_address,
            "signed_message": evm_challenge_data["message"],
            "signature": signed_message.signature.hex()
        }, headers=headers)
        assert evm_link_response.status_code == 200

        # Now login with the linked wallet
        new_challenge = client.post("/api/v1/auth/evm/challenge", json={"address": evm_address})
        new_challenge_data = new_challenge.json()

        new_message = new_challenge_data["message"]
        new_message_hash = encode_defunct(text=new_message)
        new_signed_message = evm_account.sign_message(new_message_hash)

        verify_response = client.post("/api/v1/auth/evm/verify", json={
            "address": evm_address,
            "signed_message": new_message,
            "signature": new_signed_message.signature.hex()
        })
        assert verify_response.status_code == 200
        assert "access_token" in verify_response.json()
