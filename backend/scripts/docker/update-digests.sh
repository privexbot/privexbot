#!/bin/bash
# Update Docker Compose files with image digest from CPU build
# This script reads the digest from deploy/cpu-image-info.json and updates docker-compose files
# Usage: ./scripts/docker/update-digests.sh [--production] [--secretvm] [--all]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DIGEST_FILE="deploy/cpu-image-info.json"
PROD_COMPOSE="docker-compose.yml"
SECRETVM_COMPOSE="docker-compose.secretvm.yml"
DIGEST_PLACEHOLDER="UPDATE_WITH_DIGEST_FROM_BUILD_SCRIPT"

show_help() {
    echo "Usage: ./scripts/docker/update-digests.sh [OPTIONS]"
    echo ""
    echo "Updates Docker Compose files with image digest from CPU build"
    echo ""
    echo "Options:"
    echo "  --production    Update docker-compose.yml only"
    echo "  --secretvm      Update docker-compose.secretvm.yml only"
    echo "  --all           Update both compose files (default)"
    echo "  --help          Show this help message"
    echo ""
    echo "Prerequisites:"
    echo "  1. Run: ./scripts/docker/build-push-cpu.sh 0.1.0"
    echo "  2. This creates: deploy/cpu-image-info.json"
    echo "  3. Then run this script to update compose files"
    echo ""
    echo "Examples:"
    echo "  ./scripts/docker/update-digests.sh                # Update both files"
    echo "  ./scripts/docker/update-digests.sh --production   # Update production only"
    echo "  ./scripts/docker/update-digests.sh --secretvm     # Update SecretVM only"
    echo ""
    exit 0
}

# Parse arguments
UPDATE_PROD=false
UPDATE_SECRETVM=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --production)
            UPDATE_PROD=true
            shift
            ;;
        --secretvm)
            UPDATE_SECRETVM=true
            shift
            ;;
        --all)
            UPDATE_PROD=true
            UPDATE_SECRETVM=true
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo "Use --help to see available options"
            exit 1
            ;;
    esac
done

# Default to updating both if no specific option provided
if [ "$UPDATE_PROD" = false ] && [ "$UPDATE_SECRETVM" = false ]; then
    UPDATE_PROD=true
    UPDATE_SECRETVM=true
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Docker Compose Digest Update${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if digest file exists
if [ ! -f "$DIGEST_FILE" ]; then
    echo -e "${RED}❌ Error: $DIGEST_FILE not found${NC}"
    echo -e "${YELLOW}Please run the build script first:${NC}"
    echo "  ./scripts/docker/build-push-cpu.sh 0.1.0"
    exit 1
fi

# Read digest from file
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq not found, using grep to extract digest...${NC}"
    DIGEST=$(grep '"digest"' "$DIGEST_FILE" | cut -d'"' -f4)
    FULL_IMAGE=$(grep '"full_image"' "$DIGEST_FILE" | cut -d'"' -f4)
    VERSION=$(grep '"version"' "$DIGEST_FILE" | cut -d'"' -f4)
else
    DIGEST=$(jq -r '.digest' "$DIGEST_FILE")
    FULL_IMAGE=$(jq -r '.full_image' "$DIGEST_FILE")
    VERSION=$(jq -r '.version' "$DIGEST_FILE")
fi

if [ -z "$DIGEST" ] || [ "$DIGEST" = "null" ]; then
    echo -e "${RED}❌ Error: Could not extract digest from $DIGEST_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}📋 Build Information:${NC}"
echo -e "  Version: ${VERSION}"
echo -e "  Digest: ${DIGEST}"
echo -e "  Full Image: ${FULL_IMAGE}"
echo ""

# Function to update compose file
update_compose_file() {
    local file=$1
    local description=$2

    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Error: $file not found${NC}"
        return 1
    fi

    echo -e "${YELLOW}🔄 Updating $description ($file)...${NC}"

    # Count placeholders before replacement
    local placeholder_count=$(grep -c "$DIGEST_PLACEHOLDER" "$file" 2>/dev/null | tr -d '\n' || echo "0")

    if [ "$placeholder_count" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No digest placeholders found in $file${NC}"
        echo -e "${BLUE}ℹ️  This file may already be updated or use a different format${NC}"
        return 0
    fi

    # Create backup
    cp "$file" "${file}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${BLUE}💾 Backup created: ${file}.backup.$(date +%Y%m%d_%H%M%S)${NC}"

    # Replace placeholders with actual digest
    sed -i.tmp "s|$DIGEST_PLACEHOLDER|$DIGEST|g" "$file" && rm "${file}.tmp"

    # Verify replacement
    local remaining_placeholders=$(grep -c "$DIGEST_PLACEHOLDER" "$file" 2>/dev/null | tr -d '\n' || echo "0")

    if [ "$remaining_placeholders" -eq 0 ]; then
        echo -e "${GREEN}✅ Updated $placeholder_count digest placeholders in $file${NC}"
    else
        echo -e "${RED}❌ Warning: $remaining_placeholders placeholders remain in $file${NC}"
        return 1
    fi
}

# Update files based on options
if [ "$UPDATE_PROD" = true ]; then
    update_compose_file "$PROD_COMPOSE" "Production Compose File"
fi

if [ "$UPDATE_SECRETVM" = true ]; then
    update_compose_file "$SECRETVM_COMPOSE" "SecretVM Compose File"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Digest Update Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"

if [ "$UPDATE_PROD" = true ]; then
    echo -e "${YELLOW}For Production Deployment:${NC}"
    echo "  1. Copy docker-compose.yml to your production server"
    echo "  2. Ensure .env file is configured with:"
    echo "     - POSTGRES_PASSWORD=<strong_password>"
    echo "     - FLOWER_PASSWORD=<monitoring_password>"
    echo "  3. Deploy:"
    echo "     docker compose pull"
    echo "     docker compose up -d"
    echo "  4. Optional monitoring:"
    echo "     docker compose --profile monitoring up -d"
    echo ""
fi

if [ "$UPDATE_SECRETVM" = true ]; then
    echo -e "${YELLOW}For SecretVM Deployment:${NC}"
    echo "  1. Show updated compose file:"
    echo "     ./scripts/docker/secretvm-deploy.sh show"
    echo "  2. Copy output and paste into SecretVM Dev Portal"
    echo "  3. Upload deploy/secretvm/.env to portal"
    echo "  4. Click Deploy in SecretVM portal"
    echo "  5. Test deployment:"
    echo "     ./scripts/docker/secretvm-deploy.sh test"
    echo ""
    echo -e "${BLUE}SecretVM Services will be available at:${NC}"
    echo "  • Backend API:    https://api.harystyles.store"
    echo "  • Flower Monitor: https://flower.harystyles.store"
    echo "  • PgAdmin:        https://pgadmin.harystyles.store"
    echo "  • Redis UI:       https://redis-ui.harystyles.store"
    echo "  • Traefik:        https://traefik.harystyles.store"
    echo ""
fi

echo -e "${GREEN}🏷️  Docker Image Tags Created:${NC}"
echo "  • harystyles/privexbot-backend:${VERSION}"
echo "  • harystyles/privexbot-backend:${VERSION}-cpu"
echo "  • harystyles/privexbot-backend:latest-cpu"
echo ""
echo -e "${BLUE}🔗 Docker Hub: https://hub.docker.com/r/harystyles/privexbot-backend${NC}"