#!/usr/bin/env python3
"""
Set Initial Staff Users

WHY: Bootstrap initial staff/admin users for backoffice access
HOW: Look up users by email or wallet address and set is_staff = true

This script is:
- Idempotent: Safe to run multiple times
- Non-blocking: Won't fail if users don't exist yet (they might register later)

Usage (dev):
    docker compose -f docker-compose.dev.yml exec backend-dev python scripts/set_initial_staff.py

Usage (production):
    Automatically runs on container startup
"""

import sys
import os

# Add src to path for imports (handles both local and Docker environments)
script_dir = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(script_dir, '..', 'src')
if os.path.exists(src_path):
    sys.path.insert(0, src_path)
else:
    # Docker environment: /app/src
    sys.path.insert(0, '/app/src')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import after path setup
try:
    from app.core.config import settings
    from app.core.initial_staff import INITIAL_STAFF_IDENTIFIERS
    from app.models.user import User
    from app.models.auth_identity import AuthIdentity
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("   Make sure you're running from the correct directory or in Docker")
    sys.exit(1)


def set_initial_staff() -> dict:
    """
    Set is_staff = true for initial staff users.

    Returns:
        dict: Summary of results {found: int, updated: int, already_staff: int, not_found: int}
    """
    results = {
        "found": 0,
        "updated": 0,
        "already_staff": 0,
        "not_found": 0,
        "errors": []
    }

    # Create database connection
    try:
        engine = create_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        results["errors"].append(f"Database connection failed: {e}")
        return results

    try:
        print("=" * 60)
        print("🔧 Setting Initial Staff Users")
        print("=" * 60)

        for (identifier_type, identifier), description in INITIAL_STAFF_IDENTIFIERS.items():

            print(f"\n📋 {description}")
            print(f"   Looking for {identifier_type}: {identifier}")

            try:
                # Find auth identity (case-insensitive for wallet addresses)
                auth_identity = db.query(AuthIdentity).filter(
                    AuthIdentity.provider == identifier_type,
                    AuthIdentity.provider_id.ilike(identifier)
                ).first()

                if not auth_identity:
                    print(f"   ⏭️  User not registered yet (will be set when they sign up)")
                    results["not_found"] += 1
                    continue

                results["found"] += 1

                # Get user
                user = db.query(User).filter(User.id == auth_identity.user_id).first()

                if not user:
                    print(f"   ⚠️  Auth identity exists but user record missing")
                    results["errors"].append(f"Orphaned auth identity for {identifier}")
                    continue

                if user.is_staff:
                    print(f"   ✅ User '{user.username}' is already staff")
                    results["already_staff"] += 1
                    continue

                # Set as staff
                user.is_staff = True
                db.commit()
                results["updated"] += 1
                print(f"   🎉 SUCCESS: User '{user.username}' (ID: {user.id}) is now staff!")

            except Exception as e:
                print(f"   ❌ Error processing {identifier}: {e}")
                results["errors"].append(f"Error for {identifier}: {e}")
                db.rollback()

        # Summary
        print("\n" + "=" * 60)
        print("📊 Summary")
        print("=" * 60)
        print(f"   Found: {results['found']}")
        print(f"   Updated to staff: {results['updated']}")
        print(f"   Already staff: {results['already_staff']}")
        print(f"   Not registered yet: {results['not_found']}")
        if results["errors"]:
            print(f"   Errors: {len(results['errors'])}")
            for err in results["errors"]:
                print(f"      - {err}")
        print("=" * 60)

        return results

    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        results["errors"].append(f"Unexpected error: {e}")
        db.rollback()
        return results
    finally:
        db.close()


def main():
    """Main entry point."""
    print("\n🚀 Initial Staff Setup Script")
    print("   This script sets is_staff=true for configured admin users.\n")

    results = set_initial_staff()

    # Exit with error code only if there were actual errors (not just missing users)
    if results["errors"]:
        print("\n⚠️  Completed with some errors (see above)")
        sys.exit(1)
    else:
        print("\n✅ Staff setup completed successfully!")
        sys.exit(0)


if __name__ == "__main__":
    main()
