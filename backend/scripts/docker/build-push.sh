#!/bin/bash
# Build and Push Backend Docker Image to Docker Hub
# Usage: ./scripts/docker/build-push.sh [OPTIONS] [version]
# Options:
#   --no-cache    Force rebuild without using Docker cache
#   --help        Show this help message
# Examples:
#   ./scripts/docker/build-push.sh 0.1.0
#   ./scripts/docker/build-push.sh --no-cache 0.2.1
#   ./scripts/docker/build-push.sh --no-cache

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_USERNAME="harystyles"
IMAGE_NAME="privexbot-backend"
DEFAULT_VERSION="0.1.0"

# Parse arguments
NO_CACHE=""
VERSION=""

show_help() {
    echo "Usage: ./scripts/docker/build-push.sh [OPTIONS] [version]"
    echo ""
    echo "Options:"
    echo "  --no-cache    Force rebuild without using Docker cache (useful when files changed)"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/docker/build-push.sh 0.1.0              # Build version 0.1.0 with cache"
    echo "  ./scripts/docker/build-push.sh --no-cache 0.2.1   # Build version 0.2.1 without cache"
    echo "  ./scripts/docker/build-push.sh --no-cache         # Build default version without cache"
    echo ""
    echo "When to use --no-cache:"
    echo "  - When you've updated scripts or files that Docker didn't detect as changed"
    echo "  - When you want to ensure the latest base image is used"
    echo "  - When debugging build issues"
    echo ""
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            # If it starts with -, it's an unknown option
            if [[ $1 == -* ]]; then
                echo -e "${RED}❌ Error: Unknown option: $1${NC}"
                echo "Use --help to see available options"
                exit 1
            fi
            # Otherwise, it's the version
            VERSION="$1"
            shift
            ;;
    esac
done

# Use default version if not provided
VERSION="${VERSION:-$DEFAULT_VERSION}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PrivexBot Backend - Build and Push${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Validate version format (simple semver check)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
    echo -e "${RED}❌ Error: Invalid version format${NC}"
    echo -e "${YELLOW}Expected: X.Y.Z or X.Y.Z-tag (e.g., 0.1.0 or 0.1.0-rc.1)${NC}"
    exit 1
fi

echo -e "${GREEN}📦 Building version: ${VERSION}${NC}"
echo -e "${GREEN}🐳 Image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    exit 1
fi

# Build the image
if [ -n "$NO_CACHE" ]; then
    echo -e "${YELLOW}🔨 Building Docker image (without cache)...${NC}"
    echo -e "${BLUE}ℹ️  This will take longer but ensures a fresh build${NC}"
else
    echo -e "${YELLOW}🔨 Building Docker image...${NC}"
fi

docker build \
    $NO_CACHE \
    --platform linux/amd64 \
    -f Dockerfile \
    -t "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}" \
    -t "${DOCKER_USERNAME}/${IMAGE_NAME}:latest" \
    .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Push to Docker Hub
echo -e "${YELLOW}📤 Pushing to Docker Hub...${NC}"
docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:latest"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Push failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Push successful${NC}"
echo ""

# Get image digest
echo -e "${YELLOW}🔍 Getting image digest...${NC}"
FULL_IMAGE=$(docker inspect "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}" --format='{{index .RepoDigests 0}}')

if [ -z "$FULL_IMAGE" ]; then
    echo -e "${RED}❌ Could not extract digest${NC}"
    exit 1
fi

DIGEST=$(echo "$FULL_IMAGE" | sed 's/.*@//')

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment Information${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Version:${NC} ${VERSION}"
echo -e "${BLUE}Image:${NC} ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo -e "${BLUE}Digest:${NC} ${DIGEST}"
echo ""
echo -e "${YELLOW}📋 For SecretVM Deployment:${NC}"
echo -e "${BLUE}Update docker-compose.secretvm.yml with:${NC}"
echo ""
echo "services:"
echo "  backend:"
echo "    image: ${FULL_IMAGE}"
echo ""
echo -e "${YELLOW}📋 For Standalone Production:${NC}"
echo -e "${BLUE}Update docker-compose.yml with:${NC}"
echo ""
echo "services:"
echo "  backend:"
echo "    image: ${FULL_IMAGE}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Docker Hub:${NC} https://hub.docker.com/r/${DOCKER_USERNAME}/${IMAGE_NAME}"
echo -e "${GREEN}========================================${NC}"
