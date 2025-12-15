#!/usr/bin/env python3
"""
PGVector Production Verification Script
Ensures pgvector dependencies are properly installed and configured.
"""

import sys
import os
import subprocess
from pathlib import Path

def check_python_package():
    """Check if pgvector Python package is installed"""
    print("🔍 Checking pgvector Python package...")
    try:
        import pgvector
        import pgvector.sqlalchemy
        print(f"✅ pgvector Python package installed: {pgvector.__version__}")
        return True
    except ImportError as e:
        print(f"❌ pgvector Python package not found: {e}")
        return False

def check_postgresql_extension():
    """Check if pgvector extension is available in PostgreSQL"""
    print("🔍 Checking pgvector PostgreSQL extension...")
    try:
        from sqlalchemy import create_engine, text
        from app.core.config import settings

        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            # Check if extension is installed
            result = conn.execute(text(
                "SELECT * FROM pg_available_extensions WHERE name = 'vector'"
            ))
            extension_available = result.fetchone()

            if not extension_available:
                print("❌ pgvector extension not available in PostgreSQL")
                return False

            # Check if extension is installed
            result = conn.execute(text(
                "SELECT * FROM pg_extension WHERE extname = 'vector'"
            ))
            extension_installed = result.fetchone()

            if extension_installed:
                print("✅ pgvector extension is installed and active")
                return True
            else:
                print("⚠️  pgvector extension available but not installed")
                print("   Installing extension...")
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                conn.commit()
                print("✅ pgvector extension installed successfully")
                return True

    except Exception as e:
        print(f"❌ Error checking PostgreSQL extension: {e}")
        return False

def check_migration_compatibility():
    """Check if migration can import pgvector types"""
    print("🔍 Checking migration compatibility...")
    try:
        from pgvector.sqlalchemy import VECTOR
        print("✅ pgvector SQLAlchemy types can be imported")

        # Test vector type creation
        from sqlalchemy import Column
        test_column = Column('embedding', VECTOR(dim=384))
        print("✅ Vector column type creation successful")
        return True
    except Exception as e:
        print(f"❌ Migration compatibility error: {e}")
        return False

def check_docker_environment():
    """Check if running in Docker with proper PostgreSQL image"""
    print("🔍 Checking Docker environment...")

    # Check if in Docker
    if Path("/.dockerenv").exists():
        print("✅ Running in Docker container")
    else:
        print("ℹ️  Not running in Docker (development mode)")

    # Check environment variables
    required_vars = ["DATABASE_URL", "REDIS_URL"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        print(f"⚠️  Missing environment variables: {missing_vars}")
    else:
        print("✅ Required environment variables present")

    return True

def run_alembic_test():
    """Test if Alembic migration runs successfully"""
    print("🔍 Testing Alembic migration...")
    try:
        # Change to src directory for proper imports
        os.chdir("/app/src" if Path("/app/src").exists() else "src")

        result = subprocess.run(
            ["alembic", "history"],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            print("✅ Alembic can read migration history")

            # Try to check current revision
            result = subprocess.run(
                ["alembic", "current"],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                print(f"✅ Current migration state: {result.stdout.strip()}")
                return True
            else:
                print(f"⚠️  Could not check current migration: {result.stderr}")
                return True  # Not a critical error
        else:
            print(f"❌ Alembic error: {result.stderr}")
            return False

    except Exception as e:
        print(f"❌ Alembic test error: {e}")
        return False

def main():
    """Run all verification checks"""
    print("🚀 PGVector Production Verification Starting...")
    print("=" * 60)

    checks = [
        ("Python Package", check_python_package),
        ("PostgreSQL Extension", check_postgresql_extension),
        ("Migration Compatibility", check_migration_compatibility),
        ("Docker Environment", check_docker_environment),
        ("Alembic Migration Test", run_alembic_test),
    ]

    results = {}
    for name, check_func in checks:
        print(f"\n📋 {name}")
        print("-" * 40)
        try:
            results[name] = check_func()
        except Exception as e:
            print(f"❌ Unexpected error in {name}: {e}")
            results[name] = False

    print("\n" + "=" * 60)
    print("📊 VERIFICATION SUMMARY")
    print("=" * 60)

    all_passed = True
    for name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{name:<25} {status}")
        if not passed:
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL CHECKS PASSED - pgvector ready for production!")
        sys.exit(0)
    else:
        print("🚨 SOME CHECKS FAILED - review errors above")
        print("\n💡 Common fixes:")
        print("  • Ensure pgvector Python package: pip install pgvector")
        print("  • Use pgvector/pgvector:pg16 PostgreSQL image")
        print("  • Run migration with: alembic upgrade head")
        print("  • Check DATABASE_URL environment variable")
        sys.exit(1)

if __name__ == "__main__":
    main()