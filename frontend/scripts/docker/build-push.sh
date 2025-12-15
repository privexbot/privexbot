#!/usr/bin/env bash
#
# PrivexBot Frontend - Build and Push Script
# Purpose: Build production Docker image, push to Docker Hub, and output digest
# Usage: ./scripts/docker/build-push.sh [version] [options]
#
# Examples:
#   ./scripts/docker/build-push.sh 0.1.0                    # Build and push v0.1.0 (MVP/prelaunch)
#   ./scripts/docker/build-push.sh 0.2.0-rc.1               # Build and push release candidate
#   ./scripts/docker/build-push.sh 1.0.0 --secretvm         # Build for SecretVM deployment
#   ./scripts/docker/build-push.sh 0.1.0 --secretvm --force # Force push SecretVM build
#
# Options:
#   --secretvm    Use Dockerfile.secretvm and update docker-compose.secretvm.yml
#   --force       Skip confirmation prompts (for CI/CD)
#
# Semantic Versioning for MVP/Prelaunch:
#   - 0.x.x: MVP/prelaunch versions (not production-ready)
#   - 1.0.0: Official launch version (reserved)
#   - Use format: 0.MINOR.PATCH or 0.MINOR.PATCH-rc.N for release candidates

set -euo pipefail

# Configuration
DOCKER_USERNAME="harystyles"
IMAGE_NAME="privexbot-frontend"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"
USE_SECRETVM=false
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
    log_info "Checking prerequisites..."

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

    # Check if logged in to Docker Hub
    # Try multiple methods as different Docker versions show this differently
    if [ -f ~/.docker/config.json ]; then
        if ! grep -q '"auths"' ~/.docker/config.json 2>/dev/null; then
            log_warning "Docker config exists but no auth found. May need to login."
        fi
    else
        log_warning "No Docker credentials found. Please run: docker login"
        log_info "Attempting to continue anyway..."
    fi

    # Alternative check: try to verify Docker Hub access
    # We'll let the push command fail if credentials are actually invalid

    log_success "All prerequisites met"
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
            read -p "Are you sure you want to use this version? (yes/no): " confirm
            if [[ $confirm != "yes" ]]; then
                log_info "Aborted by user"
                exit 0
            fi
        else
            log_info "Force mode enabled - proceeding with version $version"
        fi
    fi

    log_success "Version $version is valid"
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

# Build Docker image
build_image() {
    local version=$1
    local tag="${FULL_IMAGE_NAME}:${version}"
    local dockerfile="Dockerfile"

    # Use SecretVM Dockerfile if flag is set
    if [[ $USE_SECRETVM == true ]]; then
        dockerfile="Dockerfile.secretvm"
        log_info "Building SecretVM Docker image: $tag"
    else
        log_info "Building Docker image: $tag"
    fi

    # Change to frontend directory (where Dockerfile is)
    cd "$(dirname "$0")/../.."

    # Build the image
    # Note: Using cache for base images, but source code changes will be detected
    docker build \
        --file "$dockerfile" \
        --tag "$tag" \
        --tag "${FULL_IMAGE_NAME}:latest" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VERSION="$version" \
        .

    log_success "Image built successfully: $tag"
}

# Push image to Docker Hub
push_image() {
    local version=$1
    local tag="${FULL_IMAGE_NAME}:${version}"

    log_info "Pushing image to Docker Hub: $tag"

    # Push versioned tag
    docker push "$tag"

    # Push latest tag
    docker push "${FULL_IMAGE_NAME}:latest"

    log_success "Image pushed successfully"
}

# Update docker-compose.secretvm.yml with new digest
update_secretvm_compose() {
    local digest=$1
    local compose_file="docker-compose.secretvm.yml"

    log_info "Updating $compose_file with new digest..."

    # Extract just the sha256 part from the digest
    local sha256=$(echo "$digest" | sed 's/.*@sha256:/sha256:/')

    # Update the image line in docker-compose.secretvm.yml
    sed -i.bak "s|image: harystyles/privexbot-frontend@sha256:.*|image: harystyles/privexbot-frontend@${sha256}|" "$compose_file"

    # Remove backup file
    rm -f "${compose_file}.bak"

    log_success "Updated $compose_file with digest: ${sha256}"
}

# Get and display image digest
get_digest() {
    local version=$1
    local tag="${FULL_IMAGE_NAME}:${version}"

    log_info "Fetching image digest..."

    # Get the RepoDigest
    local digest=$(docker inspect --format='{{index .RepoDigests 0}}' "$tag" 2>/dev/null || echo "")

    if [[ -z "$digest" ]]; then
        log_error "Failed to get image digest. Image may not be pushed yet."
        exit 1
    fi

    log_success "Image digest retrieved"

    # Update docker-compose.secretvm.yml if SecretVM mode
    if [[ $USE_SECRETVM == true ]]; then
        update_secretvm_compose "$digest"
    fi

    # Display the digest prominently
    echo ""
    if [[ $USE_SECRETVM == true ]]; then
        echo "╔════════════════════════════════════════════════════════════════════════════╗"
        echo "║                    SECRETVM DEPLOYMENT READY                               ║"
        echo "╠════════════════════════════════════════════════════════════════════════════╣"
        echo "║                                                                            ║"
        echo "║  Image Digest:                                                            ║"
        echo "║  ${digest}"
        echo "║                                                                            ║"
        echo "║  docker-compose.secretvm.yml has been updated automatically!              ║"
        echo "║                                                                            ║"
        echo "╚════════════════════════════════════════════════════════════════════════════╝"
        echo ""
    else
        echo "╔════════════════════════════════════════════════════════════════════════════╗"
        echo "║                          IMAGE DIGEST (PRODUCTION)                         ║"
        echo "╠════════════════════════════════════════════════════════════════════════════╣"
        echo "║                                                                            ║"
        echo "║  Copy this digest and update docker-compose.yml:                           ║"
        echo "║                                                                            ║"
        echo "║  image: ${digest}"
        echo "║                                                                            ║"
        echo "╚════════════════════════════════════════════════════════════════════════════╝"
        echo ""
    fi

    # Save digest to file for CI/CD
    echo "$digest" > .docker-digest
    log_info "Digest also saved to .docker-digest file"
}

# Display usage information
usage() {
    cat <<EOF
Usage: $0 [version] [options]

Build, push, and get digest for PrivexBot frontend Docker image.

Arguments:
  version       Semantic version (e.g., 0.1.0, 0.2.0-rc.1, 1.0.0)

Options:
  --secretvm    Build for SecretVM deployment (uses Dockerfile.secretvm)
                Automatically updates docker-compose.secretvm.yml with digest
  --force       Skip confirmation prompts (useful for CI/CD)
  --push-only   Skip build, only push already-built image
                Useful when build succeeded but push failed (network timeout)

Examples:
  $0 0.1.0                       # Build and push MVP version 0.1.0
  $0 0.2.0-rc.1                  # Build and push release candidate
  $0 1.0.0 --secretvm            # Build for SecretVM deployment
  $0 0.1.0 --secretvm --force    # Force build for SecretVM (no prompts)
  $0 0.1.0 --push-only           # Only push existing image (skip build)
  $0 0.1.0 --secretvm --push-only # Push existing SecretVM image

Versioning Guidelines:
  - 0.x.x         : MVP/prelaunch versions
  - 0.x.x-rc.N    : Release candidates
  - 1.0.0         : Official launch version (reserved)
  - 1.x.x+        : Post-launch versions

Prerequisites:
  - Docker installed and running
  - Logged in to Docker Hub (docker login)

SecretVM Deployment:
  When using --secretvm flag:
  1. Script builds using Dockerfile.secretvm (with .env.secretvm → .env.production)
  2. Pushes image to Docker Hub
  3. Automatically updates docker-compose.secretvm.yml with new digest
  4. Copy docker-compose.secretvm.yml to SecretVM deployment interface
  5. Deploy via SecretVM web interface (no SSH required)

Push-Only Mode:
  When build succeeds but push fails (e.g., 504 Gateway Timeout from Docker Hub):
  1. Wait a few minutes for Docker Hub to recover
  2. Run script again with --push-only flag
  3. Script will push existing image without rebuilding
  4. Saves time and resources

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
            --secretvm)
                USE_SECRETVM=true
                shift
                ;;
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
    log_info "PrivexBot Frontend - Build and Push Script"
    log_info "Version: $version"
    if [[ $USE_SECRETVM == true ]]; then
        log_info "Mode: SecretVM Deployment"
    fi
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

    log_success "All steps completed successfully!"

    # Display next steps based on mode
    if [[ $USE_SECRETVM == true ]]; then
        echo ""
        log_info "SecretVM Deployment Instructions:"
        log_info "  1. docker-compose.secretvm.yml has been updated with the new digest"
        log_info "  2. Commit the changes: git add docker-compose.secretvm.yml && git commit -m 'Update SecretVM deployment'"
        log_info "  3. Copy the contents of docker-compose.secretvm.yml"
        log_info "  4. Paste into SecretVM deployment interface"
        log_info "  5. Deploy via SecretVM web interface"
        echo ""
        log_success "Production frontend will connect to: https://api.harystyles.store/api/v1"
    else
        echo ""
        log_info "Next steps:"
        log_info "  1. Update docker-compose.prod.yml with the digest above"
        log_info "  2. Commit and push the updated docker-compose.prod.yml"
        log_info "  3. Deploy to production"
    fi
}

# Run main function
main "$@"
