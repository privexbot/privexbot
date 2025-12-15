#!/usr/bin/env bash
#
# PrivexBot Frontend - Secret VM Build and Push Script
# Purpose: Build production Docker image for Secret VM deployment at privexbot.com
# Usage: ./scripts/docker/build-push-secretvm.sh [version] [options]
#
# Examples:
#   ./scripts/docker/build-push-secretvm.sh 0.1.0                    # Build and push v0.1.0 for Secret VM
#   ./scripts/docker/build-push-secretvm.sh 0.2.0-rc.1               # Build and push release candidate
#   ./scripts/docker/build-push-secretvm.sh 1.0.0 --force            # Force push Secret VM build
#   ./scripts/docker/build-push-secretvm.sh 0.1.0 --push-only        # Push existing image only
#
# Options:
#   --force       Skip confirmation prompts (for CI/CD)
#   --push-only   Skip build, only push already-built image
#
# Secret VM Deployment Target:
#   - Domain: privexbot.com
#   - Frontend: https://privexbot.com
#   - Backend API: https://api.privexbot.com
#   - Uses .env.secretvm configuration

set -euo pipefail

# Configuration - Secret VM Specific
DOCKER_USERNAME="privexbot"
IMAGE_NAME="privexbot-frontend"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"
DEPLOYMENT_TARGET="Secret VM (privexbot.com)"
FORCE_MODE=false
PUSH_ONLY=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✔ ${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠ ${NC} $1"
}

log_error() {
    echo -e "${RED}✖ ${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites for Secret VM deployment..."

    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi

    # Check if .env.secretvm exists
    if [ ! -f ".env.secretvm" ]; then
        log_error ".env.secretvm not found. This file is required for Secret VM deployment."
        log_info "Create .env.secretvm with the following content:"
        log_info "VITE_API_BASE_URL=https://api.privexbot.com/api/v1"
        log_info "VITE_ENV=production"
        exit 1
    fi

    # Check if logged in to Docker Hub
    if [ -f ~/.docker/config.json ]; then
        if ! grep -q '"auths"' ~/.docker/config.json 2>/dev/null; then
            log_warning "Docker config exists but no auth found. May need to login."
        fi
    else
        log_warning "No Docker credentials found. Please run: docker login"
        log_info "Attempting to continue anyway..."
    fi

    log_success "All prerequisites met for Secret VM deployment"
}

# Validate version format
validate_version() {
    local version=$1

    # Check if version follows semantic versioning
    if ! [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
        log_error "Invalid version format: $version"
        log_info "Version must follow semantic versioning: MAJOR.MINOR.PATCH[-PRERELEASE]"
        log_info "Examples: 0.1.0, 0.2.3, 0.3.0-rc.1, 1.0.0"
        exit 1
    fi

    # Warn if using v1.0.0 or higher (reserved for official launch)
    if [[ $version =~ ^1\. ]] || [[ $version =~ ^[2-9]\. ]]; then
        log_warning "Version $version is >= 1.0.0 (official launch version)"
        if [[ $FORCE_MODE == false ]]; then
            read -p "Are you sure you want to use this version for Secret VM? (yes/no): " confirm
            if [[ $confirm != "yes" ]]; then
                log_info "Aborted by user"
                exit 0
            fi
        else
            log_info "Force mode enabled - proceeding with version $version"
        fi
    fi

    log_success "Version $version is valid for Secret VM deployment"
}

# Verify image exists locally
verify_image_exists() {
    local version=$1
    local tag="${FULL_IMAGE_NAME}:${version}"

    log_info "Checking if image exists: $tag"

    if ! docker image inspect "$tag" &> /dev/null; then
        log_error "Image not found: $tag"
        log_info "Available images:"
        docker images "${FULL_IMAGE_NAME}" --format "  - {{.Repository}}:{{.Tag}}" || true
        log_info ""
        log_info "Build the image first or use a different version"
        exit 1
    fi

    log_success "Image found: $tag"
}

# Build Docker image for Secret VM
build_image() {
    local version=$1
    local tag="${FULL_IMAGE_NAME}:${version}"

    log_info "Building Secret VM Docker image: $tag"
    log_info "Target: ${DEPLOYMENT_TARGET}"

    # Change to frontend directory (where Dockerfile is)
    cd "$(dirname "$0")/../.."

    # Ensure .env.secretvm is copied to .env.production for the build
    log_info "Preparing Secret VM environment configuration..."
    cp .env.secretvm .env.production

    # Get current timestamp and git info
    BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
    GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

    log_info "Build metadata:"
    log_info "  Build Date: ${BUILD_DATE}"
    log_info "  Git SHA: ${SHORT_SHA}"
    log_info "  Target: ${DEPLOYMENT_TARGET}"

    # Build the image with Secret VM specific tags
    docker build \
        --file "Dockerfile" \
        --tag "$tag" \
        --tag "${FULL_IMAGE_NAME}:${version}-secretvm" \
        --tag "${FULL_IMAGE_NAME}:latest-secretvm" \
        --build-arg BUILD_DATE="${BUILD_DATE}" \
        --build-arg VERSION="$version" \
        --build-arg VCS_REF="${SHORT_SHA}" \
        .

    log_success "Secret VM image built successfully: $tag"
}

# Push image to Docker Hub
push_image() {
    local version=$1
    local tag="${FULL_IMAGE_NAME}:${version}"

    log_info "Pushing Secret VM image to Docker Hub (${DOCKER_USERNAME})..."

    # Push all tags
    docker push "$tag"
    docker push "${FULL_IMAGE_NAME}:${version}-secretvm"
    docker push "${FULL_IMAGE_NAME}:latest-secretvm"

    log_success "Secret VM image pushed successfully"
}

# Update docker-compose.secretvm.yml with new digest
update_secretvm_compose() {
    local digest=$1
    local compose_file="docker-compose.secretvm.yml"

    log_info "Updating $compose_file with new frontend digest..."

    # Check if compose file exists
    if [ ! -f "$compose_file" ]; then
        log_warning "docker-compose.secretvm.yml not found in expected location"
        log_info "You may need to manually update the compose file with:"
        log_info "  image: ${digest}"
        return
    fi

    # Extract just the sha256 part from the digest
    local sha256=$(echo "$digest" | sed 's/.*@sha256:/sha256:/')

    # Update the frontend image line in docker-compose.secretvm.yml
    # Note: This assumes there's a frontend service in the compose file
    sed -i.bak "s|image: privexbot/privexbot-frontend@sha256:.*|image: privexbot/privexbot-frontend@${sha256}|" "$compose_file" 2>/dev/null || {
        log_info "No existing frontend image reference found in compose file"
        log_info "You may need to manually add the frontend service with:"
        log_info "  image: ${digest}"
    }

    # Remove backup file if sed succeeded
    rm -f "${compose_file}.bak" 2>/dev/null || true

    log_success "Updated compose file with digest: ${sha256}"
}

# Get and display image digest
get_digest() {
    local version=$1
    local tag="${FULL_IMAGE_NAME}:${version}"

    log_info "Fetching image digest for Secret VM deployment..."

    # Get the RepoDigest
    local digest=$(docker inspect --format='{{index .RepoDigests 0}}' "$tag" 2>/dev/null || echo "")

    if [[ -z "$digest" ]]; then
        log_error "Failed to get image digest. Image may not be pushed yet."
        exit 1
    fi

    log_success "Image digest retrieved for Secret VM"

    # Update docker-compose.secretvm.yml
    update_secretvm_compose "$digest"

    # Display the digest prominently
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════════════╗"
    echo "║                   SECRET VM DEPLOYMENT READY                               ║"
    echo "╠════════════════════════════════════════════════════════════════════════════╣"
    echo "║                                                                            ║"
    echo "║  Target: privexbot.com                                                    ║"
    echo "║  Frontend Image Digest:                                                   ║"
    echo "║  ${digest}"
    echo "║                                                                            ║"
    echo "║  docker-compose.secretvm.yml updated (if found)                           ║"
    echo "║                                                                            ║"
    echo "╚════════════════════════════════════════════════════════════════════════════╝"
    echo ""

    # Save digest to file for CI/CD and automation
    mkdir -p deploy/secretvm
    echo "$digest" > deploy/secretvm/frontend-digest.txt

    # Save detailed deployment info
    cat > deploy/secretvm/frontend-image-info.json <<EOF
{
  "deployment_target": "${DEPLOYMENT_TARGET}",
  "docker_username": "${DOCKER_USERNAME}",
  "image": "${DOCKER_USERNAME}/${IMAGE_NAME}",
  "version": "${version}",
  "digest": "${digest}",
  "secretvm_tag": "${version}-secretvm",
  "build_date": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "git_sha": "$(git rev-parse HEAD 2>/dev/null || echo "unknown")",
  "domain": "privexbot.com",
  "endpoints": {
    "frontend": "https://privexbot.com",
    "api": "https://api.privexbot.com"
  }
}
EOF

    log_info "Digest saved to deploy/secretvm/frontend-digest.txt"
    log_info "Deployment info saved to deploy/secretvm/frontend-image-info.json"
}

# Display usage information
usage() {
    cat <<EOF
Usage: $0 [version] [options]

Build and push PrivexBot frontend Docker image for Secret VM deployment at privexbot.com.

Arguments:
  version       Semantic version (e.g., 0.1.0, 0.2.0-rc.1, 1.0.0)

Options:
  --force       Skip confirmation prompts (useful for CI/CD)
  --push-only   Skip build, only push already-built image
                Useful when build succeeded but push failed (network timeout)

Examples:
  $0 0.1.0                       # Build and push for Secret VM
  $0 0.2.0-rc.1                  # Build and push release candidate
  $0 1.0.0 --force               # Force build for Secret VM (no prompts)
  $0 0.1.0 --push-only           # Only push existing image (skip build)

Secret VM Deployment Target:
  - Domain: privexbot.com
  - Frontend: https://privexbot.com
  - Backend API: https://api.privexbot.com
  - Docker Hub: ${DOCKER_USERNAME}/${IMAGE_NAME}

Versioning Guidelines:
  - 0.x.x         : MVP/prelaunch versions
  - 0.x.x-rc.N    : Release candidates
  - 1.0.0         : Official launch version (reserved)
  - 1.x.x+        : Post-launch versions

Prerequisites:
  - Docker installed and running
  - Logged in to Docker Hub (docker login)
  - .env.secretvm file configured for privexbot.com

Secret VM Deployment Process:
  1. Script builds using Dockerfile with .env.secretvm → .env.production
  2. Pushes image to privexbot Docker Hub organization
  3. Updates docker-compose.secretvm.yml with new digest (if found)
  4. Deploy via Secret VM Portal:
     - Upload docker-compose.secretvm.yml
     - Upload backend .env file
     - Deploy through Secret VM interface

Available Image Tags:
  - ${DOCKER_USERNAME}/${IMAGE_NAME}:VERSION
  - ${DOCKER_USERNAME}/${IMAGE_NAME}:VERSION-secretvm
  - ${DOCKER_USERNAME}/${IMAGE_NAME}:latest-secretvm

Push-Only Mode:
  When build succeeds but push fails (e.g., Docker Hub timeout):
  1. Wait a few minutes for Docker Hub to recover
  2. Run script again with --push-only flag
  3. Script will push existing image without rebuilding

EOF
    exit 1
}

# Main execution
main() {
    # Parse arguments
    local version=""

    # Check if at least version is provided
    if [[ $# -lt 1 ]]; then
        usage
    fi

    # Parse all arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE_MODE=true
                shift
                ;;
            --push-only)
                PUSH_ONLY=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                # First non-flag argument is version
                if [[ -z "$version" ]]; then
                    version=$1
                else
                    log_error "Unknown argument: $1"
                    usage
                fi
                shift
                ;;
        esac
    done

    # Ensure version was provided
    if [[ -z "$version" ]]; then
        log_error "Version argument is required"
        usage
    fi

    # Display header
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════════════╗"
    echo "║               PrivexBot Frontend - Secret VM Build & Push                  ║"
    echo "╚════════════════════════════════════════════════════════════════════════════╝"
    echo ""
    log_info "Version: $version"
    log_info "Target: ${DEPLOYMENT_TARGET}"
    log_info "Docker Hub: ${DOCKER_USERNAME}/${IMAGE_NAME}"
    if [[ $FORCE_MODE == true ]]; then
        log_info "Force mode: Enabled"
    fi
    if [[ $PUSH_ONLY == true ]]; then
        log_info "Mode: Push Only (skip build)"
    fi
    echo ""

    # Run steps based on mode
    check_prerequisites
    validate_version "$version"

    if [[ $PUSH_ONLY == true ]]; then
        # Push-only mode: verify image exists, then push
        verify_image_exists "$version"
    else
        # Normal mode: build then push
        build_image "$version"
    fi

    push_image "$version"
    get_digest "$version"

    log_success "Secret VM frontend build completed successfully!"

    # Display next steps for Secret VM deployment
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════════════╗"
    echo "║                     SECRET VM DEPLOYMENT INSTRUCTIONS                      ║"
    echo "╚════════════════════════════════════════════════════════════════════════════╝"
    echo ""
    log_info "Secret VM Deployment Steps:"
    log_info "  1. Ensure backend is built and deployed: cd ../backend && ./scripts/docker/build-push-secretvm.sh $version"
    log_info "  2. Update docker-compose.secretvm.yml with both frontend and backend digests"
    log_info "  3. Deploy via Secret VM Portal:"
    log_info "     • Upload docker-compose.secretvm.yml"
    log_info "     • Upload backend .env file"
    log_info "     • Click Deploy"
    log_info "  4. Test deployment:"
    log_info "     • Frontend: https://privexbot.com"
    log_info "     • Backend: https://api.privexbot.com/health"
    echo ""
    log_success "Production frontend will be available at: https://privexbot.com"
    log_success "API endpoint: https://api.privexbot.com/api/v1"
}

# Run main function
main "$@"