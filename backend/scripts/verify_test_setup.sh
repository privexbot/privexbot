#!/bin/bash
# Test Environment Verification Script
# WHY: Verify all prerequisites are met before running tests
# HOW: Check Docker, services, dependencies, and directories

set -e

echo "========================================"
echo "Test Environment Verification"
echo "========================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# 1. Check Docker is running
echo -n "1. Checking Docker daemon... "
if docker ps &> /dev/null; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "   → Start Docker Desktop first"
    FAILURES=$((FAILURES + 1))
fi

# 2. Check PostgreSQL container
echo -n "2. Checking PostgreSQL container... "
if docker ps | grep -q "privexbot-postgres-dev"; then
    echo -e "${GREEN}✓ Running${NC}"
elif docker ps -a | grep -q "privexbot-postgres-dev"; then
    echo -e "${YELLOW}! Exists but not running${NC}"
    echo "   → Run: cd backend && docker compose -f docker-compose.dev.yml up -d postgres"
    FAILURES=$((FAILURES + 1))
else
    echo -e "${RED}✗ Not found${NC}"
    echo "   → Run: cd backend && docker compose -f docker-compose.dev.yml up -d postgres redis"
    FAILURES=$((FAILURES + 1))
fi

# 3. Check Redis container
echo -n "3. Checking Redis container... "
if docker ps | grep -q "privexbot-redis-dev"; then
    echo -e "${GREEN}✓ Running${NC}"
elif docker ps -a | grep -q "privexbot-redis-dev"; then
    echo -e "${YELLOW}! Exists but not running${NC}"
    echo "   → Run: cd backend && docker compose -f docker-compose.dev.yml up -d redis"
    FAILURES=$((FAILURES + 1))
else
    echo -e "${RED}✗ Not found${NC}"
    echo "   → Run: cd backend && docker compose -f docker-compose.dev.yml up -d postgres redis"
    FAILURES=$((FAILURES + 1))
fi

# 4. Check Python dependencies
echo -n "4. Checking pydantic-settings... "
if python -c "import pydantic_settings" 2>/dev/null; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    echo "   → Run: pip install pydantic-settings"
    FAILURES=$((FAILURES + 1))
fi

echo -n "5. Checking psycopg2... "
if python -c "import psycopg2" 2>/dev/null; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    echo "   → Run: pip install psycopg2-binary"
    FAILURES=$((FAILURES + 1))
fi

echo -n "6. Checking pytest... "
if python -c "import pytest" 2>/dev/null; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    echo "   → Run: pip install pytest"
    FAILURES=$((FAILURES + 1))
fi

echo -n "7. Checking python-jose... "
if python -c "import jose" 2>/dev/null; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    echo "   → Run: pip install python-jose[cryptography]"
    FAILURES=$((FAILURES + 1))
fi

echo -n "8. Checking passlib... "
if python -c "import passlib" 2>/dev/null; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    echo "   → Run: pip install passlib bcrypt"
    FAILURES=$((FAILURES + 1))
fi

echo -n "9. Checking email-validator... "
if python -c "import email_validator" 2>/dev/null; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    echo "   → Run: pip install pydantic[email]"
    FAILURES=$((FAILURES + 1))
fi

# 10. Check directory structure
echo -n "10. Checking backend/src directory... "
if [ -d "backend/src/app" ]; then
    echo -e "${GREEN}✓ Found${NC}"
elif [ -d "src/app" ]; then
    echo -e "${GREEN}✓ Found${NC}"
elif [ -d "app" ]; then
    echo -e "${GREEN}✓ Found (in src/)${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
    echo "   → Navigate to the correct directory"
    FAILURES=$((FAILURES + 1))
fi

# 11. Check if backend server is already running
echo -n "11. Checking if port 8000 is available... "
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}! Port 8000 in use${NC}"
    echo "   → Server already running (this is OK for integration tests)"
else
    echo -e "${GREEN}✓ Available${NC}"
fi

echo ""
echo "========================================"
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo "You can now run tests:"
    echo ""
    echo "  # Unit tests"
    echo "  cd backend/src"
    echo "  PYTHONPATH=\$PWD pytest app/tests/auth/unit/ -v"
    echo ""
    echo "  # Integration tests (start server first if not running)"
    echo "  python app/tests/auth/integration/test_integration.py"
    exit 0
else
    echo -e "${RED}✗ $FAILURES check(s) failed${NC}"
    echo "Please resolve the issues above before running tests."
    exit 1
fi
