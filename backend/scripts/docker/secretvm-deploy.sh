#!/bin/bash
# SecretVM Deployment Helper
# Usage: ./scripts/docker/secretvm-deploy.sh [command]
# Commands: prepare, show, test

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
# SECRETVM_DOMAIN="sapphire-finch.vm.scrtlabs.com"
# SECRETVM_DOMAIN="harystyles.store"
SECRETVM_DOMAIN="privexbot.com"
COMPOSE_FILE="docker-compose.secretvm.yml"

# Function to display usage
usage() {
    echo -e "${BLUE}SecretVM Deployment Helper${NC}"
    echo ""
    echo "Usage: ./scripts/docker/secretvm-deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  prepare     Prepare .env file for SecretVM"
    echo "  show        Display docker-compose.yml for copying to SecretVM portal"
    echo "  test        Test all SecretVM endpoints"
    echo ""
    echo "Deployment Workflow:"
    echo "  1. Build & push image:  ./scripts/docker/build-push-secretvm.sh 0.1.0"
    echo "  2. Update digest in docker-compose.secretvm.yml"
    echo "  3. Prepare .env:        ./scripts/docker/secretvm-deploy.sh prepare"
    echo "  4. Show compose file:   ./scripts/docker/secretvm-deploy.sh show"
    echo "  5. Copy & paste compose file content to SecretVM Dev Portal"
    echo "  6. Upload .env file to SecretVM Dev Portal"
    echo "  7. Test deployment:     ./scripts/docker/secretvm-deploy.sh test"
    echo ""
    echo "SecretVM Configuration:"
    echo "  IP:     67.43.239.18"
    echo "  Domain: ${SECRETVM_DOMAIN}"
    echo "  Endpoints:"
    echo "    - https://api.${SECRETVM_DOMAIN}/health"
    echo "    - https://pgadmin.${SECRETVM_DOMAIN}"
    echo "    - https://redis-ui.${SECRETVM_DOMAIN}"
    echo "    - https://traefik.${SECRETVM_DOMAIN}"
    echo ""
}

# Check if command is provided
if [ -z "$1" ]; then
    usage
    exit 1
fi

COMMAND=$1

case $COMMAND in
    prepare)
        echo -e "${GREEN}📦 Preparing .env file for SecretVM...${NC}"

        # Check if .env.secretvm.example exists (the template)
        if [ ! -f ".env.secretvm.example" ]; then
            echo -e "${RED}❌ Error: .env.secretvm.example template not found${NC}"
            exit 1
        fi

        # Create deployment directory
        mkdir -p deploy/secretvm

        # Copy .env template
        # Priority: .env.secretvm.local (with real credentials) > .env.secretvm.example (template)
        if [ -f ".env.secretvm.local" ]; then
            echo -e "${BLUE}Using existing .env.secretvm.local (contains real credentials)${NC}"
            cp .env.secretvm.local deploy/secretvm/.env
        else
            echo -e "${YELLOW}Creating .env from .env.secretvm.example template${NC}"
            cp .env.secretvm.example deploy/secretvm/.env
        fi

        echo -e "${GREEN}✅ .env prepared in deploy/secretvm/.env${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: Update deploy/secretvm/.env with:${NC}"
        echo "  1. Generate strong credentials:"
        echo "     POSTGRES_PASSWORD=\$(openssl rand -base64 32)"
        echo "     SECRET_KEY=\$(openssl rand -hex 32)"
        echo "     PGADMIN_PASSWORD=\$(openssl rand -base64 24)"
        echo ""
        echo "  2. Update CORS origins with your frontend domain:"
        echo "     BACKEND_CORS_ORIGINS=https://privexbot.com,https://api.privexbot.com"
        echo ""
        echo -e "${GREEN}Next step: Upload deploy/secretvm/.env to SecretVM Dev Portal${NC}"
        ;;

    show)
        echo -e "${BLUE}📋 Docker Compose file for SecretVM${NC}"
        echo ""

        if [ ! -f "$COMPOSE_FILE" ]; then
            echo -e "${RED}❌ Error: ${COMPOSE_FILE} not found${NC}"
            exit 1
        fi

        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}Copy the content below and paste it in SecretVM Dev Portal:${NC}"
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
        echo ""

        cat "$COMPOSE_FILE"

        echo ""
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
        echo ""
        echo -e "${GREEN}Next steps:${NC}"
        echo "  1. Copy the docker-compose.yml content above"
        echo "  2. Go to SecretVM Dev Portal"
        echo "  3. Paste the content"
        echo "  4. Upload deploy/secretvm/.env file"
        echo "  5. Deploy on SecretVM platform"
        echo "  6. Wait for services to start"
        echo "  7. Test: ./scripts/docker/secretvm-deploy.sh test"
        ;;

    test)
        echo -e "${BLUE}🧪 Testing SecretVM endpoints...${NC}"
        echo ""
        echo -e "${YELLOW}Note: Services must be deployed on SecretVM first${NC}"
        echo ""

        # Test backend health
        echo -n "Testing Backend API health... "
        if curl -s -f -k "https://api.${SECRETVM_DOMAIN}/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
            echo "  Response:"
            curl -s -k "https://api.${SECRETVM_DOMAIN}/health" | python3 -m json.tool 2>/dev/null || curl -s -k "https://api.${SECRETVM_DOMAIN}/health"
        else
            echo -e "${RED}✗ Failed${NC}"
            echo -e "${YELLOW}  Check: https://api.${SECRETVM_DOMAIN}/health${NC}"
        fi
        echo ""

        # Test backend status
        echo -n "Testing Backend API status... "
        if curl -s -f -k "https://api.${SECRETVM_DOMAIN}/api/v1/status" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
            echo "  Response:"
            curl -s -k "https://api.${SECRETVM_DOMAIN}/api/v1/status" | python3 -m json.tool 2>/dev/null || curl -s -k "https://api.${SECRETVM_DOMAIN}/api/v1/status"
        else
            echo -e "${RED}✗ Failed${NC}"
            echo -e "${YELLOW}  Check: https://api.${SECRETVM_DOMAIN}/api/v1/status${NC}"
        fi
        echo ""

        # Test PgAdmin
        echo -n "Testing PgAdmin... "
        if curl -s -f -k "https://pgadmin.${SECRETVM_DOMAIN}" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Accessible${NC}"
            echo -e "  URL: https://pgadmin.${SECRETVM_DOMAIN}"
        else
            echo -e "${RED}✗ Failed${NC}"
            echo -e "${YELLOW}  Check: https://pgadmin.${SECRETVM_DOMAIN}${NC}"
        fi
        echo ""

        # Test Redis UI
        echo -n "Testing Redis UI... "
        if curl -s -f -k "https://redis-ui.${SECRETVM_DOMAIN}" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Accessible${NC}"
            echo -e "  URL: https://redis-ui.${SECRETVM_DOMAIN}"
        else
            echo -e "${RED}✗ Failed${NC}"
            echo -e "${YELLOW}  Check: https://redis-ui.${SECRETVM_DOMAIN}${NC}"
        fi
        echo ""

        # Test Traefik Dashboard
        echo -n "Testing Traefik Dashboard... "
        if curl -s -f -k "https://traefik.${SECRETVM_DOMAIN}" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Accessible${NC}"
            echo -e "  URL: https://traefik.${SECRETVM_DOMAIN}"
        else
            echo -e "${RED}✗ Failed${NC}"
            echo -e "${YELLOW}  Check: https://traefik.${SECRETVM_DOMAIN}${NC}"
        fi
        echo ""

        echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}All SecretVM Endpoints:${NC}"
        echo "  • Backend API:  https://api.${SECRETVM_DOMAIN}"
        echo "  • API Docs:     https://api.${SECRETVM_DOMAIN}/api/docs"
        echo "  • PgAdmin:      https://pgadmin.${SECRETVM_DOMAIN}"
        echo "  • Redis UI:     https://redis-ui.${SECRETVM_DOMAIN}"
        echo "  • Traefik:      https://traefik.${SECRETVM_DOMAIN}"
        ;;

    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        echo ""
        usage
        exit 1
        ;;
esac
