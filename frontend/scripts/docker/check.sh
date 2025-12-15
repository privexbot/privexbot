#!/usr/bin/env bash
#
# PrivexBot Frontend - Docker Environment Check Script
# Purpose: Verify Docker setup and prerequisites
# Usage: ./scripts/docker/check.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() {
    echo -e "${GREEN}✔${NC} $1"
}

fail() {
    echo -e "${RED}✖${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        PrivexBot Frontend - Docker Environment Check          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check Docker installation
info "Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    pass "Docker is installed: $DOCKER_VERSION"
else
    fail "Docker is not installed"
    info "Install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi
echo ""

# Check Docker daemon
info "Checking Docker daemon..."
if docker info &> /dev/null; then
    pass "Docker daemon is running"
else
    fail "Docker daemon is not running"
    info "Start Docker Desktop or run: sudo systemctl start docker"
    exit 1
fi
echo ""

# Check Docker Compose
info "Checking Docker Compose..."
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    pass "Docker Compose is available: $COMPOSE_VERSION"
else
    fail "Docker Compose is not available"
    info "Docker Compose v2 comes with Docker Desktop"
    exit 1
fi
echo ""

# Check Docker Hub login
info "Checking Docker Hub authentication..."

# Check Docker config file for credentials (works with all Docker versions)
if [ -f ~/.docker/config.json ]; then
    if grep -q '"auths"' ~/.docker/config.json 2>/dev/null; then
        # Extract registry info
        REGISTRIES=$(grep -o '"[^"]*docker.io[^"]*"' ~/.docker/config.json 2>/dev/null | head -1)
        if [ -n "$REGISTRIES" ]; then
            pass "Logged in to Docker Hub (credentials found in config)"
            info "Expected username: harystyles"
        else
            warn "Docker config exists but no Docker Hub auth found"
            info "Run: docker login"
        fi
    else
        warn "Docker config exists but no authentication found"
        info "Run: docker login"
    fi
else
    warn "Not logged in to Docker Hub (no config file)"
    info "For pushing images, run: docker login"
fi
echo ""

# Check if required files exist
info "Checking required files..."
cd "$(dirname "$0")/../.."

FILES=(
    "Dockerfile"
    "Dockerfile.dev"
    "docker-compose.dev.yml"
    "docker-compose.prod.yml"
    "nginx.conf"
    ".dockerignore"
    "package.json"
)

all_files_present=true
for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        pass "$file exists"
    else
        fail "$file is missing"
        all_files_present=false
    fi
done
echo ""

if ! $all_files_present; then
    fail "Some required files are missing"
    exit 1
fi

# Check Docker resources
info "Checking Docker resources..."
DOCKER_INFO=$(docker info 2>/dev/null)

# CPU
if echo "$DOCKER_INFO" | grep -q "CPUs:"; then
    CPUS=$(echo "$DOCKER_INFO" | grep "CPUs:" | awk '{print $2}')
    if [[ $CPUS -ge 2 ]]; then
        pass "CPUs: $CPUS (recommended: 2+)"
    else
        warn "CPUs: $CPUS (recommended: 2+)"
    fi
fi

# Memory
if echo "$DOCKER_INFO" | grep -q "Total Memory:"; then
    MEMORY=$(echo "$DOCKER_INFO" | grep "Total Memory:" | awk '{print $3 $4}')
    pass "Memory: $MEMORY"
fi
echo ""

# Check for running containers
info "Checking for running containers..."
RUNNING=$(docker ps --filter "name=privexbot-frontend" --format "{{.Names}}" | wc -l)
if [[ $RUNNING -gt 0 ]]; then
    warn "Found $RUNNING running frontend container(s):"
    docker ps --filter "name=privexbot-frontend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    info "No frontend containers currently running"
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                       Check Summary                            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
pass "Docker environment is ready"
echo ""
info "Next steps:"
echo "  - Development: ./scripts/docker/dev.sh up"
echo "  - Production:  ./scripts/docker/build-push.sh 0.1.0"
echo ""
