#!/bin/bash
# Build and Push Secret VM Docker Image to Docker Hub
# This script builds using Dockerfile.cpu (CPU-only PyTorch) specifically for Secret VM deployment
# Usage: ./scripts/docker/build-push-secretvm.sh [OPTIONS] [version]
# Options:
#   --no-cache    Force rebuild without using Docker cache
#   --push-only   Skip build, only push already-built image
#   --help        Show this help message
# Examples:
#   ./scripts/docker/build-push-secretvm.sh 0.1.0
#   ./scripts/docker/build-push-secretvm.sh --no-cache 0.2.1
#   ./scripts/docker/build-push-secretvm.sh 0.1.0 --push-only

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Secret VM specific
DOCKER_USERNAME="privexbot"
IMAGE_NAME="privexbot-backend"
DEFAULT_VERSION="0.1.0"
DOCKERFILE="Dockerfile.cpu"  # Use CPU-only Dockerfile
DEPLOYMENT_TARGET="Secret VM (privexbot.com)"

# Parse arguments
NO_CACHE=""
VERSION=""
PUSH_ONLY=false

show_help() {
    echo "Usage: ./scripts/docker/build-push-secretvm.sh [OPTIONS] [version]"
    echo ""
    echo "🔥 SECRET VM DEPLOYMENT BUILD: Uses Dockerfile.cpu for privexbot.com deployment"
    echo ""
    echo "Options:"
    echo "  --no-cache    Force rebuild without using Docker cache (useful when files changed)"
    echo "  --push-only   Skip build, only push already-built image (useful when build succeeded but push failed)"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/docker/build-push-secretvm.sh 0.1.0              # Build version 0.1.0 with cache"
    echo "  ./scripts/docker/build-push-secretvm.sh --no-cache 0.2.1   # Build version 0.2.1 without cache"
    echo "  ./scripts/docker/build-push-secretvm.sh 0.1.0 --push-only  # Push existing image (skip build)"
    echo ""
    echo "Secret VM Deployment:"
    echo "  - Docker Hub: ${DOCKER_USERNAME}/${IMAGE_NAME}"
    echo "  - Domain: privexbot.com"
    echo "  - Subdomains: api.privexbot.com, pgadmin.privexbot.com, etc."
    echo "  - Target: CPU-only Secret VM infrastructure"
    echo ""
    echo "Why CPU-only:"
    echo "  - Avoids 2GB+ NVIDIA CUDA package downloads that cause timeouts"
    echo "  - Uses CPU-optimized PyTorch (~140MB vs ~2GB)"
    echo "  - Perfect for Secret VM CPU-only infrastructure"
    echo "  - Builds 10x faster than GPU version"
    echo ""
    echo "When to use --no-cache:"
    echo "  - When you've updated scripts or files that Docker didn't detect as changed"
    echo "  - When you want to ensure the latest base image is used"
    echo "  - When debugging build issues"
    echo ""
    echo "When to use --push-only:"
    echo "  - When build succeeded but push failed (e.g., 'TLS handshake timeout')"
    echo "  - When Docker Hub is experiencing network issues"
    echo "  - To retry push without rebuilding (saves time and resources)"
    echo "  - Example: Build succeeds → Push fails → Wait → Run with --push-only"
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
        --push-only)
            PUSH_ONLY=true
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
echo -e "${BLUE}PrivexBot Secret VM - Build and Push${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Validate version format (simple semver check)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
    echo -e "${RED}❌ Error: Invalid version format${NC}"
    echo -e "${YELLOW}Expected: X.Y.Z or X.Y.Z-tag (e.g., 0.1.0 or 0.1.0-rc.1)${NC}"
    exit 1
fi

echo -e "${GREEN}🎯 Target: ${DEPLOYMENT_TARGET}${NC}"
echo -e "${GREEN}📦 Version: ${VERSION}${NC}"
echo -e "${GREEN}🐳 Image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}${NC}"
if [[ $PUSH_ONLY == true ]]; then
    echo -e "${YELLOW}📦 Mode: Push-only (skip build)${NC}"
else
    echo -e "${GREEN}📄 Dockerfile: ${DOCKERFILE}${NC}"
    echo -e "${BLUE}💡 Note: CPU-optimized for Secret VM infrastructure${NC}"
fi
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    exit 1
fi

# Verify image exists locally (for push-only mode)
verify_image_exists() {
    local version=$1
    local tag="${DOCKER_USERNAME}/${IMAGE_NAME}:${version}"

    echo -e "${YELLOW}🔍 Checking if image exists locally: $tag${NC}"

    if ! docker image inspect "$tag" &> /dev/null; then
        echo -e "${RED}❌ Error: Image not found: $tag${NC}"
        echo -e "${YELLOW}Available images:${NC}"
        docker images "${DOCKER_USERNAME}/${IMAGE_NAME}" --format "  - {{.Repository}}:{{.Tag}}" 2>/dev/null || echo "  (no images found)"
        echo ""
        echo -e "${BLUE}💡 Build the image first or use a different version${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Image found: $tag${NC}"
}

# Check if CPU Dockerfile exists
if [ ! -f "${DOCKERFILE}" ]; then
    echo -e "${RED}❌ Error: ${DOCKERFILE} not found${NC}"
    echo "Run this script from the backend directory"
    exit 1
fi

# Build or verify image based on mode
if [[ $PUSH_ONLY == true ]]; then
    echo -e "${YELLOW}📦 Push-only mode: Skipping build, verifying existing image...${NC}"
    verify_image_exists "$VERSION"
    echo ""
else
    # Build the image
    if [ -n "$NO_CACHE" ]; then
        echo -e "${YELLOW}🔨 Building Secret VM Docker image (without cache)...${NC}"
        echo -e "${BLUE}ℹ️  This will take longer but ensures a fresh build${NC}"
    else
        echo -e "${YELLOW}🔨 Building Secret VM Docker image...${NC}"
    fi

    # Get current timestamp and git info
    BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
    GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

    echo -e "${BLUE}📋 Build metadata:${NC}"
    echo -e "  Build Date: ${BUILD_DATE}"
    echo -e "  Git SHA: ${SHORT_SHA}"
    echo -e "  Target: ${DEPLOYMENT_TARGET}"
    echo ""

    # Build with compatibility for Secret VM's Docker version
    # Disable provenance and SBOM attestations to avoid manifest schema issues
    DOCKER_BUILDKIT=1 docker build \
        $NO_CACHE \
        --platform linux/amd64 \
        --provenance=false \
        --sbom=false \
        -f "${DOCKERFILE}" \
        --build-arg BUILD_DATE="${BUILD_DATE}" \
        --build-arg VCS_REF="${SHORT_SHA}" \
        --build-arg VERSION="${VERSION}" \
        -t "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}" \
        -t "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}-secretvm" \
        -t "${DOCKER_USERNAME}/${IMAGE_NAME}:latest-secretvm" \
        .

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Build successful${NC}"
    echo ""
fi

# Push to Docker Hub
echo -e "${YELLOW}📤 Pushing to Docker Hub (${DOCKER_USERNAME})...${NC}"

# Push all tags
docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}-secretvm"
docker push "${DOCKER_USERNAME}/${IMAGE_NAME}:latest-secretvm"

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

# Update docker-compose.secretvm.yml with new digest
update_secretvm_compose() {
    local digest=$1
    local compose_file="docker-compose.secretvm.yml"

    echo -e "${YELLOW}📝 Updating $compose_file with new backend digest...${NC}"

    # Check if compose file exists
    if [ ! -f "$compose_file" ]; then
        echo -e "${YELLOW}⚠️  docker-compose.secretvm.yml not found in current directory${NC}"
        echo -e "${BLUE}💡 You may need to manually update the compose file with:${NC}"
        echo -e "  image: ${digest}"
        return
    fi

    # Update all backend service image lines in docker-compose.secretvm.yml
    # This updates backend, celery-worker, celery-beat, and flower services
    sed -i.bak "s|image: privexbot/privexbot-backend@sha256:.*|image: ${digest}|g" "$compose_file"

    # Remove backup file
    rm -f "${compose_file}.bak" 2>/dev/null || true

    echo -e "${GREEN}✅ Updated $compose_file with backend digest${NC}"
}

# Call the update function
update_secretvm_compose "$FULL_IMAGE"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Secret VM Deployment Information${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Target:${NC} ${DEPLOYMENT_TARGET}"
echo -e "${BLUE}Version:${NC} ${VERSION}"
echo -e "${BLUE}Image:${NC} ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo -e "${BLUE}Secret VM Tag:${NC} ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}-secretvm"
echo -e "${BLUE}Build Date:${NC} ${BUILD_DATE}"
echo -e "${BLUE}Git SHA:${NC} ${SHORT_SHA}"
echo -e "${BLUE}Digest:${NC} ${DIGEST}"
echo -e "${BLUE}Full Image:${NC} ${FULL_IMAGE}"
echo ""
echo -e "${YELLOW}📋 docker-compose.secretvm.yml automatically updated with:${NC}"
echo -e "${BLUE}All backend services now use:${NC}"
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
echo -e "${YELLOW}📋 Next Steps for Secret VM Deployment:${NC}"
echo "  1. ./scripts/docker/secretvm-deploy.sh prepare"
echo "  2. ./scripts/docker/secretvm-deploy.sh show"
echo "  3. Copy compose file to Secret VM Dev Portal"
echo "  4. Upload .env file to Secret VM Dev Portal"
echo "  5. Deploy on Secret VM"
echo "  6. ./scripts/docker/secretvm-deploy.sh test"
echo ""
echo -e "${GREEN}🏷️  Available Tags:${NC}"
echo -e "  • ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo -e "  • ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}-secretvm"
echo -e "  • ${DOCKER_USERNAME}/${IMAGE_NAME}:latest-secretvm"
echo ""
echo -e "${GREEN}🌐 Deployment URLs (after deployment):${NC}"
echo -e "  • Frontend: https://privexbot.com"
echo -e "  • Backend API: https://api.privexbot.com"
echo -e "  • API Docs: https://api.privexbot.com/api/docs"
echo -e "  • PgAdmin: https://pgadmin.privexbot.com"
echo -e "  • Redis UI: https://redis-ui.privexbot.com"
echo -e "  • Flower: https://flower.privexbot.com"
echo -e "  • Traefik: https://traefik.privexbot.com"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Docker Hub:${NC} https://hub.docker.com/r/${DOCKER_USERNAME}/${IMAGE_NAME}"
echo -e "${GREEN}Deployment Guide:${NC} Use the digest above for immutable deployments"
echo -e "${GREEN}========================================${NC}"

# Save deployment info to file for automation
mkdir -p deploy/secretvm
cat > deploy/secretvm/image-info.json <<EOF
{
  "deployment_target": "${DEPLOYMENT_TARGET}",
  "docker_username": "${DOCKER_USERNAME}",
  "image": "${DOCKER_USERNAME}/${IMAGE_NAME}",
  "version": "${VERSION}",
  "digest": "${DIGEST}",
  "full_image": "${FULL_IMAGE}",
  "secretvm_tag": "${VERSION}-secretvm",
  "build_date": "${BUILD_DATE}",
  "git_sha": "${GIT_SHA}",
  "short_sha": "${SHORT_SHA}",
  "dockerfile": "${DOCKERFILE}",
  "domain": "privexbot.com",
  "endpoints": {
    "frontend": "https://privexbot.com",
    "api": "https://api.privexbot.com",
    "docs": "https://api.privexbot.com/api/docs",
    "pgadmin": "https://pgadmin.privexbot.com",
    "redis_ui": "https://redis-ui.privexbot.com",
    "flower": "https://flower.privexbot.com",
    "traefik": "https://traefik.privexbot.com"
  }
}
EOF

echo -e "${BLUE}💾 Secret VM deployment info saved to: deploy/secretvm/image-info.json${NC}"