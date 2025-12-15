#!/usr/bin/env python3
"""
Integration Test Script for PrivexBot Authentication

WHY: Verify all authentication endpoints work in dev environment
HOW: Test email, EVM, Solana auth flows with real API calls

Usage:
    python scripts/test_integration.py
"""

import requests
import json
import sys
import time
from eth_account import Account
from eth_account.messages import encode_defunct
from solders.keypair import Keypair
import base58

# Configuration
BASE_URL = "http://localhost:8000"
API_V1 = f"{BASE_URL}/api/v1"

# Generate unique suffix for test data to avoid conflicts
UNIQUE_SUFFIX = str(int(time.time()))

# Color codes for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


class IntegrationTester:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []

    def log(self, message, color=RESET):
        print(f"{color}{message}{RESET}")

    def test(self, name):
        """Decorator for test functions"""
        def decorator(func):
            self.tests.append((name, func))
            return func
        return decorator

    def assert_status(self, response, expected_status, test_name):
        """Assert response status code"""
        if response.status_code == expected_status:
            self.log(f"  ✓ {test_name}: {response.status_code}", GREEN)
            self.passed += 1
            return True
        else:
            self.log(f"  ✗ {test_name}: Expected {expected_status}, got {response.status_code}", RED)
            self.log(f"    Response: {response.text}", YELLOW)
            self.failed += 1
            return False

    def assert_key_in_response(self, response, key, test_name):
        """Assert key exists in JSON response"""
        try:
            data = response.json()
            if key in data:
                self.log(f"  ✓ {test_name}: '{key}' present", GREEN)
                self.passed += 1
                return True
            else:
                self.log(f"  ✗ {test_name}: '{key}' missing from response", RED)
                self.failed += 1
                return False
        except:
            self.log(f"  ✗ {test_name}: Invalid JSON response", RED)
            self.failed += 1
            return False

    def run_all_tests(self):
        """Run all registered tests"""
        self.log("\n" + "="*70, BLUE)
        self.log("PRIVEXBOT AUTHENTICATION INTEGRATION TESTS", BLUE)
        self.log("="*70 + "\n", BLUE)

        # Check if server is running
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=5)
            if response.status_code != 200:
                self.log("❌ Server health check failed!", RED)
                return False
            self.log("✓ Server is running at " + BASE_URL, GREEN)
        except requests.exceptions.ConnectionError:
            self.log("❌ Cannot connect to server at " + BASE_URL, RED)
            self.log("   Please start the server with: cd src && uvicorn app.main:app --reload", YELLOW)
            return False

        # Run all tests
        for test_name, test_func in self.tests:
            self.log(f"\n{BLUE}▶ {test_name}{RESET}")
            try:
                test_func(self)
            except Exception as e:
                self.log(f"  ✗ Test crashed: {str(e)}", RED)
                self.failed += 1

        # Summary
        total = self.passed + self.failed
        self.log("\n" + "="*70, BLUE)
        self.log("TEST SUMMARY", BLUE)
        self.log("="*70, BLUE)
        self.log(f"Total assertions: {total}", BLUE)
        self.log(f"Passed: {self.passed}", GREEN)
        self.log(f"Failed: {self.failed}", RED if self.failed > 0 else GREEN)

        if self.failed == 0:
            self.log("\n🎉 ALL TESTS PASSED!", GREEN)
            return True
        else:
            self.log(f"\n❌ {self.failed} test(s) failed", RED)
            return False


# Initialize tester
tester = IntegrationTester()


@tester.test("1. Email Authentication - Signup")
def test_email_signup(t):
    """Test email signup endpoint"""
    response = requests.post(f"{API_V1}/auth/email/signup", json={
        "email": f"integration_test_{UNIQUE_SUFFIX}@example.com",
        "password": "Test@1234",
        "username": f"integration_user_{UNIQUE_SUFFIX}"
    })
    t.assert_status(response, 201, "Signup status")
    t.assert_key_in_response(response, "access_token", "Token returned")


@tester.test("2. Email Authentication - Login")
def test_email_login(t):
    """Test email login endpoint"""
    email = f"login_test_{UNIQUE_SUFFIX}@example.com"
    # First ensure user exists
    requests.post(f"{API_V1}/auth/email/signup", json={
        "email": email,
        "password": "Test@1234",
        "username": f"login_user_{UNIQUE_SUFFIX}"
    })

    # Now test login
    response = requests.post(f"{API_V1}/auth/email/login", json={
        "email": email,
        "password": "Test@1234"
    })
    t.assert_status(response, 200, "Login status")
    t.assert_key_in_response(response, "access_token", "Token returned")


@tester.test("3. Email Authentication - Change Password")
def test_email_change_password(t):
    """Test password change endpoint"""
    # Signup
    signup_response = requests.post(f"{API_V1}/auth/email/signup", json={
        "email": f"change_pass_{UNIQUE_SUFFIX}@example.com",
        "password": "OldPass@1234",
        "username": f"change_pass_user_{UNIQUE_SUFFIX}"
    })
    token = signup_response.json()["access_token"]

    # Change password
    response = requests.post(
        f"{API_V1}/auth/email/change-password",
        json={
            "old_password": "OldPass@1234",
            "new_password": "NewPass@5678"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    t.assert_status(response, 200, "Change password status")


@tester.test("4. EVM Wallet - Challenge Request")
def test_evm_challenge(t):
    """Test EVM wallet challenge generation"""
    account = Account.create()
    response = requests.post(f"{API_V1}/auth/evm/challenge", json={
        "address": account.address
    })
    t.assert_status(response, 200, "Challenge status")
    t.assert_key_in_response(response, "message", "Message present")
    t.assert_key_in_response(response, "nonce", "Nonce present")


@tester.test("5. EVM Wallet - Signature Verification")
def test_evm_verify(t):
    """Test EVM wallet signature verification"""
    # Create wallet and request challenge
    account = Account.create()
    challenge_response = requests.post(f"{API_V1}/auth/evm/challenge", json={
        "address": account.address
    })
    challenge_data = challenge_response.json()

    # Sign the message
    message = challenge_data["message"]
    message_hash = encode_defunct(text=message)
    signed_message = account.sign_message(message_hash)
    signature = signed_message.signature.hex()

    # Verify signature
    response = requests.post(f"{API_V1}/auth/evm/verify", json={
        "address": account.address,
        "signed_message": message,
        "signature": signature
    })
    t.assert_status(response, 200, "Verify status")
    t.assert_key_in_response(response, "access_token", "Token returned")


@tester.test("6. EVM Wallet - Link to Existing Account")
def test_evm_link(t):
    """Test linking EVM wallet to existing account"""
    # Create user with email
    signup_response = requests.post(f"{API_V1}/auth/email/signup", json={
        "email": f"evm_link_{UNIQUE_SUFFIX}@example.com",
        "password": "Test@1234",
        "username": f"evm_link_user_{UNIQUE_SUFFIX}"
    })
    token = signup_response.json()["access_token"]

    # Create wallet and request challenge
    account = Account.create()
    challenge_response = requests.post(f"{API_V1}/auth/evm/challenge", json={
        "address": account.address
    })
    challenge_data = challenge_response.json()

    # Sign the message
    message = challenge_data["message"]
    message_hash = encode_defunct(text=message)
    signed_message = account.sign_message(message_hash)
    signature = signed_message.signature.hex()

    # Link wallet
    response = requests.post(
        f"{API_V1}/auth/evm/link",
        json={
            "address": account.address,
            "signed_message": message,
            "signature": signature
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    t.assert_status(response, 200, "Link status")


@tester.test("7. Solana Wallet - Challenge Request")
def test_solana_challenge(t):
    """Test Solana wallet challenge generation"""
    keypair = Keypair()
    response = requests.post(f"{API_V1}/auth/solana/challenge", json={
        "address": str(keypair.pubkey())
    })
    t.assert_status(response, 200, "Challenge status")
    t.assert_key_in_response(response, "message", "Message present")
    t.assert_key_in_response(response, "nonce", "Nonce present")


@tester.test("8. Solana Wallet - Signature Verification")
def test_solana_verify(t):
    """Test Solana wallet signature verification"""
    # Create wallet and request challenge
    keypair = Keypair()
    challenge_response = requests.post(f"{API_V1}/auth/solana/challenge", json={
        "address": str(keypair.pubkey())
    })
    challenge_data = challenge_response.json()

    # Sign the message
    message = challenge_data["message"]
    message_bytes = message.encode('utf-8')
    signature = keypair.sign_message(message_bytes)
    signature_b58 = base58.b58encode(bytes(signature)).decode('utf-8')

    # Verify signature
    response = requests.post(f"{API_V1}/auth/solana/verify", json={
        "address": str(keypair.pubkey()),
        "signed_message": message,
        "signature": signature_b58
    })
    t.assert_status(response, 200, "Verify status")
    t.assert_key_in_response(response, "access_token", "Token returned")


@tester.test("9. Solana Wallet - Link to Existing Account")
def test_solana_link(t):
    """Test linking Solana wallet to existing account"""
    # Create user with email
    signup_response = requests.post(f"{API_V1}/auth/email/signup", json={
        "email": f"solana_link_{UNIQUE_SUFFIX}@example.com",
        "password": "Test@1234",
        "username": f"solana_link_user_{UNIQUE_SUFFIX}"
    })
    token = signup_response.json()["access_token"]

    # Create wallet and request challenge
    keypair = Keypair()
    challenge_response = requests.post(f"{API_V1}/auth/solana/challenge", json={
        "address": str(keypair.pubkey())
    })
    challenge_data = challenge_response.json()

    # Sign the message
    message = challenge_data["message"]
    message_bytes = message.encode('utf-8')
    signature = keypair.sign_message(message_bytes)
    signature_b58 = base58.b58encode(bytes(signature)).decode('utf-8')

    # Link wallet
    response = requests.post(
        f"{API_V1}/auth/solana/link",
        json={
            "address": str(keypair.pubkey()),
            "signed_message": message,
            "signature": signature_b58
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    t.assert_status(response, 200, "Link status")


@tester.test("10. Cosmos Wallet - Challenge Request")
def test_cosmos_challenge(t):
    """Test Cosmos wallet challenge generation"""
    response = requests.post(f"{API_V1}/auth/cosmos/challenge", json={
        "address": "secret1ap26qrlp8mcq2pg6r47w43l0y8zkqm8a450s03"
    })
    t.assert_status(response, 200, "Challenge status")
    t.assert_key_in_response(response, "message", "Message present")
    t.assert_key_in_response(response, "nonce", "Nonce present")


@tester.test("11. Edge Cases - Invalid Email Format")
def test_invalid_email(t):
    """Test invalid email rejection"""
    response = requests.post(f"{API_V1}/auth/email/signup", json={
        "email": "not-an-email",
        "password": "Test@1234",
        "username": "test"
    })
    t.assert_status(response, 422, "Invalid email rejected")


@tester.test("12. Edge Cases - Weak Password")
def test_weak_password(t):
    """Test weak password rejection"""
    response = requests.post(f"{API_V1}/auth/email/signup", json={
        "email": "weak@example.com",
        "password": "weak",
        "username": "test"
    })
    # Accept either 400 or 422 (Pydantic validation)
    if response.status_code in [400, 422]:
        t.log(f"  ✓ Weak password rejected: {response.status_code}", GREEN)
        t.passed += 1
    else:
        t.log(f"  ✗ Weak password rejected: Expected 400/422, got {response.status_code}", RED)
        t.failed += 1


@tester.test("13. Edge Cases - Invalid EVM Address")
def test_invalid_evm_address(t):
    """Test invalid EVM address rejection"""
    response = requests.post(f"{API_V1}/auth/evm/challenge", json={
        "address": "invalid-address"
    })
    # Accept either 400 or 422 (Pydantic validation)
    if response.status_code in [400, 422]:
        t.log(f"  ✓ Invalid address rejected: {response.status_code}", GREEN)
        t.passed += 1
    else:
        t.log(f"  ✗ Invalid address rejected: Expected 400/422, got {response.status_code}", RED)
        t.failed += 1


@tester.test("14. Multi-Wallet Linking")
def test_multi_wallet_linking(t):
    """Test linking multiple wallets to one account"""
    # Create user with email
    signup_response = requests.post(f"{API_V1}/auth/email/signup", json={
        "email": f"multi_wallet_{UNIQUE_SUFFIX}@example.com",
        "password": "Test@1234",
        "username": f"multi_wallet_user_{UNIQUE_SUFFIX}"
    })
    token = signup_response.json()["access_token"]

    # Link EVM wallet
    evm_account = Account.create()
    evm_challenge = requests.post(f"{API_V1}/auth/evm/challenge", json={
        "address": evm_account.address
    })
    evm_message = evm_challenge.json()["message"]
    evm_hash = encode_defunct(text=evm_message)
    evm_sig = evm_account.sign_message(evm_hash)

    evm_link = requests.post(
        f"{API_V1}/auth/evm/link",
        json={
            "address": evm_account.address,
            "signed_message": evm_message,
            "signature": evm_sig.signature.hex()
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    t.assert_status(evm_link, 200, "EVM wallet linked")

    # Link Solana wallet
    sol_keypair = Keypair()
    sol_challenge = requests.post(f"{API_V1}/auth/solana/challenge", json={
        "address": str(sol_keypair.pubkey())
    })
    sol_message = sol_challenge.json()["message"]
    sol_sig = sol_keypair.sign_message(sol_message.encode('utf-8'))
    sol_sig_b58 = base58.b58encode(bytes(sol_sig)).decode('utf-8')

    sol_link = requests.post(
        f"{API_V1}/auth/solana/link",
        json={
            "address": str(sol_keypair.pubkey()),
            "signed_message": sol_message,
            "signature": sol_sig_b58
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    t.assert_status(sol_link, 200, "Solana wallet linked")


if __name__ == "__main__":
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
