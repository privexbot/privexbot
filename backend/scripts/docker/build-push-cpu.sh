#!/bin/bash
# Build and Push CPU-only Backend Docker Image to Docker Hub
# This script builds using Dockerfile.cpu (CPU-only PyTorch) to avoid NVIDIA timeout issues
# Usage: ./scripts/docker/build-push-cpu.sh [OPTIONS] [version]
# Options:
#   --no-cache    Force rebuild without using Docker cache
#   --help        Show this help message
# Examples:
#   ./scripts/docker/build-push-cpu.sh 0.1.0
#   ./scripts/docker/build-push-cpu.sh --no-cache 0.2.1
#   ./scripts/docker/build-push-cpu.sh --no-cache

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
DOCKERFILE="Dockerfile.cpu"  # Use CPU-only Dockerfile

# Parse arguments
NO_CACHE=""
VERSION=""

show_help() {
    echo "Usage: ./scripts/docker/build-push-cpu.sh [OPTIONS] [version]"
    echo ""
    echo "🔥 CPU-ONLY BUILD: Uses Dockerfile.cpu to avoid NVIDIA CUDA timeout issues"
    echo ""
    echo "Options:"
    echo "  --no-cache    Force rebuild without using Docker cache (useful when files changed)"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/docker/build-push-cpu.sh 0.1.0              # Build version 0.1.0 with cache"
    echo "  ./scripts/docker/build-push-cpu.sh --no-cache 0.2.1   # Build version 0.2.1 without cache"
    echo "  ./scripts/docker/build-push-cpu.sh --no-cache         # Build default version without cache"
    echo ""
    echo "Why CPU-only:"
    echo "  - Avoids 2GB+ NVIDIA CUDA package downloads that cause timeouts"
    echo "  - Uses CPU-optimized PyTorch (~140MB vs ~2GB)"
    echo "  - Perfect for production deployments on CPU-only servers (SecretVM, most VPS)"
    echo "  - Builds 10x faster than GPU version"
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
echo -e "${BLUE}PrivexBot Backend - CPU Build and Push${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Validate version format (simple semver check)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
    echo -e "${RED}❌ Error: Invalid version format${NC}"
    echo -e "${YELLOW}Expected: X.Y.Z or X.Y.Z-tag (e.g., 0.1.0 or 0.1.0-rc.1)${NC}"
    exit 1
fi

echo -e "${GREEN}📦 Building CPU-only version: ${VERSION}${NC}"
echo -e "${GREEN}🐳 Image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}${NC}"
echo -e "${GREEN}📄 Dockerfile: ${DOCKERFILE}${NC}"
echo -e "${BLUE}💡 Note: Using CPU-only PyTorch to avoid NVIDIA timeout issues${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    exit 1
fi

# Check if CPU Dockerfile exists
if [ ! -f "${DOCKERFILE}" ]; then
    echo -e "${RED}❌ Error: ${DOCKERFILE} not found${NC}"
    echo "Run this script from the backend directory"
    exit 1
fi

# Build the image
if [ -n "$NO_CACHE" ]; then
    echo -e "${YELLOW}🔨 Building CPU-only Docker image (without cache)...${NC}"
    echo -e "${BLUE}ℹ️  This will take longer but ensures a fresh build${NC}"
else
    echo -e "${YELLOW}🔨 Building CPU-only Docker image...${NC}"
fi

# Get current timestamp and git info
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo -e "${BLUE}📋 Build metadata:${NC}"
echo -e "  Build Date: ${BUILD_DATE}"
echo -e "  Git SHA: ${SHORT_SHA}"
echo ""

docker build \
    $NO_CACHE \
    --platform linux/amd64 \
    -f "${DOCKERFILE}" \
    --build-arg BUILD_DATE="${BUILD_DATE}" \
    --build-arg VCS_REF="${SHORT_SHA}" \
    --build-arg VERSION="${VERSION}" \
    -t "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}" \
    -t "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}-cpu" \
    -t "${DOCKER_USERNAME}/${IMAGE_NAME}:latest-cpu" \
    .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Push to Docker Hub
echo -e "${YELLOW}📤 Pushing to Docker Hub...${NC}"

# Push all tags
docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}-cpu"
docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:latest-cpu"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Push failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Push successful${NC}"
echo ""

# Get image digest for immutable deployments
echo -e "${YELLOW}🔍 Getting image digest for immutable deployments...${NC}"

# Get the manifest digest
DIGEST=$(docker manifest inspect "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}" | grep -o '"digest": *"[^"]*"' | head -n1 | sed 's/"digest": *"\(.*\)"/\1/')

if [ -z "$DIGEST" ]; then
    echo -e "${YELLOW}⚠️  Could not extract digest, trying alternative method...${NC}"
    # Alternative: get from local image
    IMAGE_ID=$(docker images --no-trunc --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}" | grep "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}" | awk '{print $2}' | head -n1)
    if [ -n "$IMAGE_ID" ]; then
        DIGEST="${IMAGE_ID}"
    else
        echo -e "${RED}❌ Could not extract digest${NC}"
        exit 1
    fi
fi

FULL_IMAGE="${DOCKER_USERNAME}/${IMAGE_NAME}@${DIGEST}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ CPU Deployment Information${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Version:${NC} ${VERSION}"
echo -e "${BLUE}Image:${NC} ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo -e "${BLUE}CPU Tag:${NC} ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}-cpu"
echo -e "${BLUE}Build Date:${NC} ${BUILD_DATE}"
echo -e "${BLUE}Git SHA:${NC} ${SHORT_SHA}"
echo -e "${BLUE}Digest:${NC} ${DIGEST}"
echo -e "${BLUE}Full Image:${NC} ${FULL_IMAGE}"
echo ""
echo -e "${YELLOW}📋 For SecretVM Deployment (CPU-optimized):${NC}"
echo -e "${BLUE}Update docker-compose.secretvm.yml services with:${NC}"
echo ""
echo "services:"
echo "  backend:"
echo "    image: ${FULL_IMAGE}"
echo "  celery-worker:"
echo "    image: ${FULL_IMAGE}"
echo "  celery-beat:"
echo "    image: ${FULL_IMAGE}"
echo "  flower:"
echo "    image: ${FULL_IMAGE}"
echo ""
echo -e "${YELLOW}📋 For Standalone Production (CPU-optimized):${NC}"
echo -e "${BLUE}Update docker-compose.yml services with:${NC}"
echo ""
echo "services:"
echo "  backend:"
echo "    image: ${FULL_IMAGE}"
echo "  celery-worker:"
echo "    image: ${FULL_IMAGE}"
echo "  celery-beat:"
echo "    image: ${FULL_IMAGE}"
echo "  flower:"
echo "    image: ${FULL_IMAGE}"
echo ""
echo -e "${GREEN}🏷️  Available Tags:${NC}"
echo -e "  • ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo -e "  • ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}-cpu"
echo -e "  • ${DOCKER_USERNAME}/${IMAGE_NAME}:latest-cpu"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Docker Hub:${NC} https://hub.docker.com/r/${DOCKER_USERNAME}/${IMAGE_NAME}"
echo -e "${GREEN}Deployment Guide:${NC} Use the digest above for immutable deployments"
echo -e "${GREEN}========================================${NC}"

# Save deployment info to file for automation
mkdir -p deploy
cat > deploy/cpu-image-info.json <<EOF
{
  "image": "${DOCKER_USERNAME}/${IMAGE_NAME}",
  "version": "${VERSION}",
  "digest": "${DIGEST}",
  "full_image": "${FULL_IMAGE}",
  "cpu_tag": "${VERSION}-cpu",
  "build_date": "${BUILD_DATE}",
  "git_sha": "${GIT_SHA}",
  "short_sha": "${SHORT_SHA}",
  "dockerfile": "${DOCKERFILE}"
}
EOF

echo -e "${BLUE}💾 Deployment info saved to: deploy/cpu-image-info.json${NC}"