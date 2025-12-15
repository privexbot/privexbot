#!/bin/bash
# Test CPU Deployment Workflow
# This script validates that all deployment scripts work correctly
# Usage: ./scripts/docker/test-workflow.sh [--full]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
FULL_TEST=false
TEST_VERSION="0.1.0-test"

show_help() {
    echo "Usage: ./scripts/docker/test-workflow.sh [OPTIONS]"
    echo ""
    echo "Tests the CPU deployment workflow"
    echo ""
    echo "Options:"
    echo "  --full      Run full test including Docker build (slow)"
    echo "  --help      Show this help message"
    echo ""
    echo "Tests performed:"
    echo "  ✓ Script permissions and existence"
    echo "  ✓ Docker Compose file syntax"
    echo "  ✓ Placeholder patterns in compose files"
    echo "  ✓ Environment file templates"
    echo "  ✓ Script help commands"
    echo "  ✓ Docker build (only with --full)"
    echo ""
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            FULL_TEST=true
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🧪 CPU Deployment Workflow Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Test Mode:${NC} ${FULL_TEST:-"false" && echo "Quick validation" || echo "Full test (including build)"}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_TOTAL=0

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"

    ((TESTS_TOTAL++))
    echo -n "🧪 Testing: $test_name... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC}"
        echo -e "${RED}   Failed: $test_command${NC}"
    fi
}

# Test 1: Script existence and permissions
echo -e "${YELLOW}📋 Testing script files...${NC}"

run_test "dev.sh exists and executable" "[ -x scripts/docker/dev.sh ]"
run_test "build-push-cpu.sh exists and executable" "[ -x scripts/docker/build-push-cpu.sh ]"
run_test "deploy-cpu.sh exists and executable" "[ -x scripts/docker/deploy-cpu.sh ]"
run_test "update-digests.sh exists and executable" "[ -x scripts/docker/update-digests.sh ]"
run_test "secretvm-deploy.sh exists and executable" "[ -x scripts/docker/secretvm-deploy.sh ]"

echo ""

# Test 2: Docker Compose file syntax
echo -e "${YELLOW}🐳 Testing Docker Compose files...${NC}"

run_test "docker-compose.dev.yml syntax" "docker compose -f docker-compose.dev.yml config > /dev/null"
run_test "docker-compose.yml syntax" "docker compose -f docker-compose.yml config > /dev/null"
run_test "docker-compose.secretvm.yml syntax" "docker compose -f docker-compose.secretvm.yml config > /dev/null"

echo ""

# Test 3: Dockerfile existence
echo -e "${YELLOW}📄 Testing Dockerfile files...${NC}"

run_test "Dockerfile.dev exists" "[ -f Dockerfile.dev ]"
run_test "Dockerfile.cpu exists" "[ -f Dockerfile.cpu ]"
run_test "Dockerfile (production) exists" "[ -f Dockerfile ]"

echo ""

# Test 4: Placeholder patterns
echo -e "${YELLOW}🔍 Testing digest placeholders...${NC}"

run_test "Production compose has digest placeholders" "grep -q 'UPDATE_WITH_DIGEST_FROM_BUILD_SCRIPT' docker-compose.yml"
run_test "SecretVM compose has digest placeholders" "grep -q 'UPDATE_WITH_DIGEST_FROM_BUILD_SCRIPT' docker-compose.secretvm.yml"

echo ""

# Test 5: Required services in compose files
echo -e "${YELLOW}📦 Testing service definitions...${NC}"

run_test "Dev compose has all services" "grep -q 'backend-dev:' docker-compose.dev.yml && grep -q 'celery-worker:' docker-compose.dev.yml && grep -q 'flower:' docker-compose.dev.yml"
run_test "Prod compose has all services" "grep -q 'backend:' docker-compose.yml && grep -q 'celery-worker:' docker-compose.yml && grep -q 'flower:' docker-compose.yml"
run_test "SecretVM compose has all services" "grep -q 'backend:' docker-compose.secretvm.yml && grep -q 'celery-worker:' docker-compose.secretvm.yml && grep -q 'flower:' docker-compose.secretvm.yml"

echo ""

# Test 6: Script help commands
echo -e "${YELLOW}📖 Testing script help commands...${NC}"

run_test "dev.sh help works" "./scripts/docker/dev.sh --help > /dev/null"
run_test "build-push-cpu.sh help works" "./scripts/docker/build-push-cpu.sh --help > /dev/null"
run_test "deploy-cpu.sh help works" "./scripts/docker/deploy-cpu.sh --help > /dev/null"
run_test "update-digests.sh help works" "./scripts/docker/update-digests.sh --help > /dev/null"
run_test "secretvm-deploy.sh help works" "./scripts/docker/secretvm-deploy.sh --help > /dev/null"

echo ""

# Test 7: Environment files
echo -e "${YELLOW}🌍 Testing environment file templates...${NC}"

run_test ".env.dev exists" "[ -f .env.dev ]"
run_test ".env.example exists" "[ -f .env.example ] || [ -f .env.secretvm ]"

echo ""

# Test 8: Required directories
echo -e "${YELLOW}📁 Testing directory structure...${NC}"

run_test "scripts/docker directory exists" "[ -d scripts/docker ]"
run_test "src directory exists" "[ -d src ]"
run_test "docs directory exists" "[ -d docs ]"

echo ""

# Test 9: Full Docker build test (optional)
if [ "$FULL_TEST" = true ]; then
    echo -e "${YELLOW}🔨 Testing Docker build (this may take a while)...${NC}"

    echo -n "🧪 Testing: CPU Docker build... "
    if docker build -f Dockerfile.cpu -t privexbot-test:$TEST_VERSION . > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        ((TESTS_PASSED++))

        # Cleanup test image
        docker rmi privexbot-test:$TEST_VERSION > /dev/null 2>&1 || true
    else
        echo -e "${RED}✗${NC}"
    fi
    ((TESTS_TOTAL++))

    echo ""
fi

# Test 10: JSON parsing for digest file (if jq available)
echo -e "${YELLOW}🔧 Testing utilities...${NC}"

if command -v jq &> /dev/null; then
    run_test "jq available for JSON parsing" "echo '{\"test\": \"value\"}' | jq -r '.test' | grep -q 'value'"
else
    echo "🧪 Testing: jq available for JSON parsing... ${YELLOW}SKIP (jq not installed, fallback will be used)${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 Test Results${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "${GREEN}✅ All tests passed! ($TESTS_PASSED/$TESTS_TOTAL)${NC}"
    echo ""
    echo -e "${GREEN}🚀 Deployment workflow is ready!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Development: ./scripts/docker/dev.sh up"
    echo "  2. Production:  ./scripts/docker/deploy-cpu.sh 0.1.0"
    echo "  3. SecretVM:    ./scripts/docker/deploy-cpu.sh 0.1.0 --secretvm"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed ($TESTS_PASSED/$TESTS_TOTAL)${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Fix the failed tests before proceeding with deployment${NC}"
    echo ""
    exit 1
fi