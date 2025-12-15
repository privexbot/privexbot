#!/bin/bash
# Check Prerequisites for Docker Deployment
# Usage: ./scripts/docker/check.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Backend Prerequisites Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

ERRORS=0

# Check Docker
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
    echo -e "${GREEN}✓ Found (v${DOCKER_VERSION})${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
    echo -e "${YELLOW}  Install from: https://www.docker.com/get-started${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker Compose
echo -n "Checking Docker Compose... "
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version --short)
    echo -e "${GREEN}✓ Found (v${COMPOSE_VERSION})${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
    echo -e "${YELLOW}  Install Docker Compose v2${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check if Docker is running
echo -n "Checking Docker daemon... "
if docker info &> /dev/null; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo -e "${YELLOW}  Start Docker Desktop or Docker daemon${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker Hub login
echo -n "Checking Docker Hub login... "
if [ -f ~/.docker/config.json ]; then
    if grep -q "harystyles" ~/.docker/config.json 2>/dev/null || grep -q "index.docker.io" ~/.docker/config.json 2>/dev/null; then
        echo -e "${GREEN}✓ Logged in${NC}"
    else
        echo -e "${YELLOW}⚠ Not logged in${NC}"
        echo -e "${YELLOW}  Run: docker login${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Not logged in${NC}"
    echo -e "${YELLOW}  Run: docker login${NC}"
fi

# Check for required files
echo ""
echo -e "${BLUE}Checking required files:${NC}"

FILES=(
    "Dockerfile"
    "Dockerfile.dev"
    "Dockerfile.secretvm"
    "docker-compose.yml"
    "docker-compose.dev.yml"
    "docker-compose.secretvm.yml"
    "pyproject.toml"
    "uv.lock"
    ".env.example"
    ".env.dev.example"
    ".env.secretvm.local"
)

for file in "${FILES[@]}"; do
    echo -n "  $file... "
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ Missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check for src directory
echo -n "  src/ directory... "
if [ -d "src" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Summary
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}You can now:${NC}"
    echo -e "  ${YELLOW}Development:${NC}     ./scripts/docker/dev.sh up"
    echo -e "  ${YELLOW}Build & Push:${NC}    ./scripts/docker/build-push.sh 0.1.0"
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}❌ Found ${ERRORS} issue(s)${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Please fix the issues above before proceeding.${NC}"
    exit 1
fi
