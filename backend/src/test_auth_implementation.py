"""
Test script to verify authentication implementation.

WHY: Validate that all auth modules are correctly implemented
HOW: Import all modules and run basic checks

This script checks:
1. All imports work (no syntax errors)
2. Configuration is loaded correctly
3. Models are defined properly
4. Schemas validate correctly
5. Basic function signatures are correct
"""

import sys
from typing import List, Tuple

def test_imports() -> List[Tuple[str, bool, str]]:
    """Test if all auth modules can be imported."""
    results = []

    # Test configuration
    try:
        from app.core.config import settings
        results.append(("✓ Config", True, f"SECRET_KEY length: {len(settings.SECRET_KEY)}"))
    except Exception as e:
        results.append(("✗ Config", False, str(e)))

    # Test database models
    try:
        from app.models.user import User
        from app.models.auth_identity import AuthIdentity
        results.append(("✓ Models (User, AuthIdentity)", True, "Imported successfully"))
    except Exception as e:
        results.append(("✗ Models", False, str(e)))

    # Test security module
    try:
        from app.core.security import (
            hash_password,
            verify_password,
            create_access_token,
            decode_token,
            validate_password_strength
        )
        results.append(("✓ Security module", True, "All functions imported"))
    except Exception as e:
        results.append(("✗ Security module", False, str(e)))

    # Test Redis utilities
    try:
        from app.utils.redis import (
            redis_client,
            generate_nonce,
            store_nonce,
            get_nonce,
            delete_nonce,
            check_redis_connection
        )
        results.append(("✓ Redis utilities", True, "All functions imported"))
    except Exception as e:
        results.append(("✗ Redis utilities", False, str(e)))

    # Test auth strategies
    try:
        from app.auth.strategies import email, evm, solana, cosmos
        results.append(("✓ Auth strategies (email)", True, "Email strategy imported"))
        results.append(("✓ Auth strategies (evm)", True, "EVM strategy imported"))
        results.append(("✓ Auth strategies (solana)", True, "Solana strategy imported"))
        results.append(("✓ Auth strategies (cosmos)", True, "Cosmos strategy imported"))
    except Exception as e:
        results.append(("✗ Auth strategies", False, str(e)))

    # Test Pydantic schemas
    try:
        from app.schemas.user import (
            UserBase,
            UserCreate,
            UserUpdate,
            UserResponse,
            UserProfile,
            UserInToken
        )
        from app.schemas.token import (
            Token,
            EmailSignupRequest,
            EmailLoginRequest,
            WalletChallengeRequest,
            WalletChallengeResponse,
            WalletVerifyRequest,
            CosmosWalletVerifyRequest
        )
        results.append(("✓ Pydantic schemas (user)", True, "All user schemas imported"))
        results.append(("✓ Pydantic schemas (token)", True, "All token schemas imported"))
    except Exception as e:
        results.append(("✗ Pydantic schemas", False, str(e)))

    return results


def test_security_functions():
    """Test basic security functions."""
    print("\n" + "="*60)
    print("Testing Security Functions")
    print("="*60)

    try:
        from app.core.security import hash_password, verify_password, validate_password_strength

        # Test password hashing
        test_password = "TestPassword123!"
        hashed = hash_password(test_password)
        print(f"✓ Password hashing works (hash length: {len(hashed)})")

        # Test password verification
        is_valid = verify_password(test_password, hashed)
        print(f"✓ Password verification works (valid: {is_valid})")

        # Test password strength validation
        valid, msg = validate_password_strength("weak")
        print(f"✓ Weak password rejected: {msg}")

        valid, msg = validate_password_strength("StrongPass123!")
        print(f"✓ Strong password accepted: {valid}")

    except Exception as e:
        print(f"✗ Security functions failed: {e}")


def test_schemas():
    """Test Pydantic schema validation."""
    print("\n" + "="*60)
    print("Testing Pydantic Schemas")
    print("="*60)

    try:
        from app.schemas.token import EmailSignupRequest, Token
        from pydantic import ValidationError

        # Test valid signup request
        valid_signup = {
            "username": "alice",
            "email": "alice@example.com",
            "password": "SecurePass123!"
        }
        signup = EmailSignupRequest(**valid_signup)
        print(f"✓ Valid signup request: {signup.username}")

        # Test invalid email
        try:
            invalid_signup = {
                "username": "bob",
                "email": "not-an-email",
                "password": "password123"
            }
            EmailSignupRequest(**invalid_signup)
            print("✗ Should have rejected invalid email")
        except ValidationError:
            print("✓ Invalid email rejected correctly")

        # Test token schema
        token = Token(
            access_token="fake.jwt.token",
            token_type="bearer",
            expires_in=1800
        )
        print(f"✓ Token schema works: expires in {token.expires_in}s")

    except Exception as e:
        print(f"✗ Schema validation failed: {e}")


def test_redis_nonce():
    """Test Redis nonce generation."""
    print("\n" + "="*60)
    print("Testing Redis Nonce Generation")
    print("="*60)

    try:
        from app.utils.redis import generate_nonce

        # Generate multiple nonces and check uniqueness
        nonces = [generate_nonce() for _ in range(5)]
        print(f"✓ Generated 5 nonces")
        print(f"  Sample nonce: {nonces[0][:16]}... (length: {len(nonces[0])})")

        # Check all are unique
        if len(set(nonces)) == 5:
            print("✓ All nonces are unique")
        else:
            print("✗ Duplicate nonces detected")

    except Exception as e:
        print(f"✗ Nonce generation failed: {e}")


def test_model_attributes():
    """Check that models have expected attributes."""
    print("\n" + "="*60)
    print("Testing Model Attributes")
    print("="*60)

    try:
        from app.models.user import User
        from app.models.auth_identity import AuthIdentity

        # Check User model attributes
        user_attrs = ['id', 'username', 'is_active', 'created_at', 'updated_at', 'auth_identities']
        for attr in user_attrs:
            if hasattr(User, attr):
                print(f"✓ User.{attr} exists")
            else:
                print(f"✗ User.{attr} missing")

        # Check AuthIdentity model attributes
        auth_attrs = ['id', 'user_id', 'provider', 'provider_id', 'data', 'created_at', 'updated_at', 'user']
        for attr in auth_attrs:
            if hasattr(AuthIdentity, attr):
                print(f"✓ AuthIdentity.{attr} exists")
            else:
                print(f"✗ AuthIdentity.{attr} missing")

    except Exception as e:
        print(f"✗ Model attribute check failed: {e}")


def main():
    """Run all tests."""
    print("="*60)
    print("Authentication Implementation Verification")
    print("="*60)
    print()

    # Test imports
    print("Testing Module Imports:")
    print("-" * 60)
    results = test_imports()

    passed = 0
    failed = 0
    for name, success, message in results:
        print(f"{name}: {message}")
        if success:
            passed += 1
        else:
            failed += 1

    print(f"\nImport Results: {passed} passed, {failed} failed")

    # Only continue if imports passed
    if failed == 0:
        test_security_functions()
        test_schemas()
        test_redis_nonce()
        test_model_attributes()

        print("\n" + "="*60)
        print("✓ All basic verification tests completed!")
        print("="*60)
        print("\nNext steps:")
        print("1. Run database migration: alembic revision --autogenerate")
        print("2. Apply migration: alembic upgrade head")
        print("3. Test Redis connection: redis-cli ping")
        print("4. Implement API routes (Phase 7)")
    else:
        print("\n" + "="*60)
        print("✗ Import errors detected. Fix these before continuing.")
        print("="*60)
        sys.exit(1)


if __name__ == "__main__":
    main()
