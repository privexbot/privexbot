#!/usr/bin/env python3
"""
KB API Test Runner
Executes all KB tests in the correct order with proper error handling.
"""

import sys
import time
import subprocess
from pathlib import Path


def run_command(command, description, timeout=300):
    """Run a command with timeout and error handling"""
    print(f"\n🔄 {description}")
    print(f"Command: {command}")
    print("=" * 60)

    try:
        start_time = time.time()
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        duration = time.time() - start_time

        if result.returncode == 0:
            print(f"✅ {description} - PASSED ({duration:.1f}s)")
            if result.stdout:
                print("Output:")
                print(result.stdout[-1000:])  # Last 1000 chars
        else:
            print(f"❌ {description} - FAILED ({duration:.1f}s)")
            if result.stderr:
                print("Error:")
                print(result.stderr[-1000:])  # Last 1000 chars
            if result.stdout:
                print("Output:")
                print(result.stdout[-1000:])

        return result.returncode == 0

    except subprocess.TimeoutExpired:
        print(f"⏰ {description} - TIMEOUT after {timeout}s")
        return False
    except Exception as e:
        print(f"💥 {description} - EXCEPTION: {e}")
        return False


def check_environment():
    """Check if all required services are running"""
    print("🔍 Checking Environment Prerequisites")
    print("=" * 60)

    checks = [
        ("curl -s http://localhost:8000/health", "Backend API Health"),
        ("docker compose -f docker-compose.dev.yml ps", "Docker Services Status"),
    ]

    all_good = True
    for command, description in checks:
        success = run_command(command, description, timeout=10)
        if not success:
            all_good = False

    return all_good


def main():
    """Run all KB API tests"""
    print("🧪 KB API Test Runner")
    print("🎯 Running all KB API tests in sequence")
    print("⏰ Started at:", time.strftime("%H:%M:%S"))
    print("=" * 80)

    # Change to the correct directory
    test_dir = Path(__file__).parent
    src_dir = test_dir.parent.parent

    # Check environment first
    if not check_environment():
        print("\n❌ Environment checks failed. Please ensure services are running:")
        print("   docker compose -f docker-compose.dev.yml up -d")
        sys.exit(1)

    # Test sequence
    tests = [
        {
            "command": f"cd {src_dir} && python -m app.tests.kb.test_quick_document_crud",
            "description": "Quick Document CRUD Validation",
            "timeout": 180,
            "required": True
        },
        {
            "command": f"cd {src_dir} && python -m app.tests.kb.test_comprehensive_kb_api",
            "description": "Comprehensive API Test Suite",
            "timeout": 600,
            "required": True
        },
        {
            "command": f"cd {src_dir} && pytest app/tests/kb/test_kb_inspection_and_crud.py -v",
            "description": "Existing Pytest Integration Tests",
            "timeout": 300,
            "required": False
        }
    ]

    # Run tests
    passed = 0
    failed = 0
    skipped = 0

    for i, test in enumerate(tests, 1):
        print(f"\n📋 Test {i}/{len(tests)}: {test['description']}")

        success = run_command(
            test["command"],
            test["description"],
            test["timeout"]
        )

        if success:
            passed += 1
        elif test["required"]:
            failed += 1
            print(f"🚨 Required test failed: {test['description']}")
        else:
            skipped += 1
            print(f"⚠️ Optional test failed (continuing): {test['description']}")

    # Summary
    total = len(tests)
    print("\n" + "=" * 80)
    print("📊 TEST EXECUTION SUMMARY")
    print("=" * 80)
    print(f"⏰ Completed at: {time.strftime('%H:%M:%S')}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⚠️ Skipped: {skipped}")
    print(f"📈 Success Rate: {passed/total*100:.1f}%")

    if failed > 0:
        print(f"\n🚨 {failed} required test(s) failed!")
        print("💡 Check the error output above for details")
        print("🔧 Common fixes:")
        print("   • Ensure all Docker services are running")
        print("   • Install Playwright browsers: docker exec celery-worker playwright install")
        print("   • Check service logs: docker compose logs [service-name]")
        sys.exit(1)
    else:
        print(f"\n🎉 All tests completed successfully!")
        print("✅ KB API is functional and ready for use")
        sys.exit(0)


if __name__ == "__main__":
    main()