#!/bin/bash
# Complete CPU Deployment Workflow for Production and SecretVM
# This script handles: build -> push -> update digests -> deployment instructions
# Usage: ./scripts/docker/deploy-cpu.sh [version] [--production|--secretvm|--all]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEFAULT_VERSION="0.1.0"

show_help() {
    echo -e "${BLUE}PrivexBot CPU Deployment Workflow${NC}"
    echo ""
    echo "Usage: ./scripts/docker/deploy-cpu.sh [version] [OPTIONS]"
    echo ""
    echo "This script performs the complete deployment workflow:"
    echo "  1. 🔨 Build CPU-optimized Docker image"
    echo "  2. 📤 Push to Docker Hub registry"
    echo "  3. 🔄 Update docker-compose files with digest"
    echo "  4. 📋 Provide deployment instructions"
    echo ""
    echo "Arguments:"
    echo "  version         Version tag (e.g., 0.1.0, 0.2.1-rc.1) [default: $DEFAULT_VERSION]"
    echo ""
    echo "Options:"
    echo "  --production    Update docker-compose.yml only"
    echo "  --secretvm      Update docker-compose.secretvm.yml only"
    echo "  --all           Update both compose files (default)"
    echo "  --no-cache      Force rebuild without Docker cache"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/docker/deploy-cpu.sh                    # v0.1.0, update both"
    echo "  ./scripts/docker/deploy-cpu.sh 0.2.0             # v0.2.0, update both"
    echo "  ./scripts/docker/deploy-cpu.sh 0.2.0 --secretvm  # v0.2.0, SecretVM only"
    echo "  ./scripts/docker/deploy-cpu.sh --no-cache        # v0.1.0, no cache"
    echo ""
    echo "Why CPU-only:"
    echo "  ✅ Builds 10x faster (no 2GB+ NVIDIA downloads)"
    echo "  ✅ Perfect for production servers (SecretVM, VPS)"
    echo "  ✅ Uses CPU-optimized PyTorch (~140MB vs ~2GB)"
    echo "  ✅ Avoids timeout issues with large packages"
    echo ""
    exit 0
}

# Parse arguments
VERSION=""
TARGET=""
NO_CACHE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --production)
            TARGET="--production"
            shift
            ;;
        --secretvm)
            TARGET="--secretvm"
            shift
            ;;
        --all)
            TARGET="--all"
            shift
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        --help|-h)
            show_help
            ;;
        -*)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo "Use --help to see available options"
            exit 1
            ;;
        *)
            VERSION="$1"
            shift
            ;;
    esac
done

# Use default version if not provided
VERSION="${VERSION:-$DEFAULT_VERSION}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 PrivexBot CPU Deployment Workflow${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}📦 Version:${NC} ${VERSION}"
echo -e "${GREEN}🎯 Target:${NC} ${TARGET:-"--all (both production and SecretVM)"}"
echo -e "${GREEN}🔨 Cache:${NC} ${NO_CACHE:-"enabled (use --no-cache to disable)"}"
echo ""

# Step 1: Build and push CPU image
echo -e "${YELLOW}🔨 Step 1/3: Building and pushing CPU-optimized image...${NC}"
echo ""

BUILD_ARGS="$NO_CACHE $VERSION"
if ! ./scripts/docker/build-push-cpu.sh $BUILD_ARGS; then
    echo -e "${RED}❌ Build and push failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build and push completed successfully${NC}"

# Step 2: Update digest placeholders
echo ""
echo -e "${YELLOW}🔄 Step 2/3: Updating docker-compose files with image digest...${NC}"
echo ""

if ! ./scripts/docker/update-digests.sh $TARGET; then
    echo -e "${RED}❌ Digest update failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Docker compose files updated with digest${NC}"

# Step 3: Provide deployment instructions
echo ""
echo -e "${YELLOW}📋 Step 3/3: Deployment Instructions${NC}"
echo ""

# Check which files were updated
UPDATED_PRODUCTION=false
UPDATED_SECRETVM=false

case "$TARGET" in
    "--production")
        UPDATED_PRODUCTION=true
        ;;
    "--secretvm")
        UPDATED_SECRETVM=true
        ;;
    *)
        UPDATED_PRODUCTION=true
        UPDATED_SECRETVM=true
        ;;
esac

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Deployment Ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ "$UPDATED_PRODUCTION" = true ]; then
    echo -e "${BLUE}🏭 Production Deployment (docker-compose.yml):${NC}"
    echo ""
    echo "1. Copy files to production server:"
    echo "   scp docker-compose.yml user@server:/path/to/app/"
    echo "   scp .env.example user@server:/path/to/app/.env"
    echo ""
    echo "2. Configure environment on server:"
    echo "   # Edit .env with production values"
    echo "   POSTGRES_PASSWORD=\$(openssl rand -base64 32)"
    echo "   FLOWER_PASSWORD=\$(openssl rand -base64 16)"
    echo "   SECRET_KEY=\$(openssl rand -hex 32)"
    echo ""
    echo "3. Deploy:"
    echo "   docker compose pull"
    echo "   docker compose up -d"
    echo ""
    echo "4. Optional monitoring (Flower):"
    echo "   docker compose --profile monitoring up -d"
    echo "   # Access at: http://server:5555"
    echo ""
fi

if [ "$UPDATED_SECRETVM" = true ]; then
    echo -e "${BLUE}🔐 SecretVM Deployment (docker-compose.secretvm.yml):${NC}"
    echo ""
    echo "1. Show updated compose file:"
    echo "   ${GREEN}./scripts/docker/secretvm-deploy.sh show${NC}"
    echo ""
    echo "2. Prepare environment file:"
    echo "   ${GREEN}./scripts/docker/secretvm-deploy.sh prepare${NC}"
    echo ""
    echo "3. Deploy via SecretVM Dev Portal:"
    echo "   - Copy compose file output from step 1"
    echo "   - Paste into SecretVM Dev Portal"
    echo "   - Upload deploy/secretvm/.env to portal"
    echo "   - Click \"Deploy\" in portal"
    echo ""
    echo "4. Test deployment:"
    echo "   ${GREEN}./scripts/docker/secretvm-deploy.sh test${NC}"
    echo ""
    echo -e "${BLUE}🌐 SecretVM Services (after deployment):${NC}"
    echo "   • Backend API:    https://api.harystyles.store"
    echo "   • API Docs:       https://api.harystyles.store/api/docs"
    echo "   • Flower Monitor: https://flower.harystyles.store"
    echo "   • PgAdmin:        https://pgadmin.harystyles.store"
    echo "   • Redis UI:       https://redis-ui.harystyles.store"
    echo "   • Traefik:        https://traefik.harystyles.store"
    echo ""
fi

echo -e "${GREEN}🏷️  Docker Image Information:${NC}"
echo "   • Version: ${VERSION}"
echo "   • Registry: harystyles/privexbot-backend"
echo "   • Tags: ${VERSION}, ${VERSION}-cpu, latest-cpu"
echo "   • Hub: https://hub.docker.com/r/harystyles/privexbot-backend"
echo ""

echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "   ✅ CPU-optimized image built and pushed"
echo "   ✅ Docker compose files updated with immutable digest"
echo "   ✅ Ready for production and SecretVM deployment"
echo "   ✅ All services: backend, celery, celery-beat, flower, postgres, redis, qdrant"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"