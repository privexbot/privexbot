"""
Account Linking Tests

WHY: Test multi-wallet account linking functionality
HOW: Use pytest with FastAPI TestClient

Tests:
- Link multiple wallets to one account (EVM + Solana)
- Login with linked wallet

USAGE:
    pytest app/tests/auth/unit/test_account_linking.py -v
"""

import pytest
from fastapi.testclient import TestClient
from eth_account import Account
from eth_account.messages import encode_defunct
from solders.keypair import Keypair
import base58


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
