#!/bin/bash

# SecretVM Service Testing Script
# Tests all SecretVM services via IP with Host headers (workaround for DNS)

BASE_URL="https://67.43.239.18"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SecretVM Service Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test function
test_service() {
    local name=$1
    local host=$2
    local path=$3
    local expected_code=$4

    echo -e "${BLUE}Testing ${name}...${NC}"

    response=$(curl -k -s -w "\n%{http_code}" -H "Host: ${host}" "${BASE_URL}${path}" 2>&1)
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}✅ ${name}: HTTP ${http_code}${NC}"
        if [ "$path" = "/health" ] || [ "$path" = "/api/v1/status" ]; then
            echo -e "${YELLOW}Response:${NC} ${body}"
        fi
    else
        echo -e "${RED}❌ ${name}: HTTP ${http_code} (expected ${expected_code})${NC}"
        if [ ${#body} -lt 200 ]; then
            echo -e "${YELLOW}Response:${NC} ${body}"
        fi
    fi
    echo
}

# Test backend health
test_service "Backend Health" "api.harystyles.store" "/health" "200"

# Test backend status (check CORS)
test_service "Backend Status" "api.harystyles.store" "/api/v1/status" "200"

# Check CORS origins specifically
echo -e "${BLUE}Checking CORS Configuration...${NC}"
cors_check=$(curl -k -s -H "Host: api.harystyles.store" "${BASE_URL}/api/v1/status" | grep -o '"cors_origins":\[.*\]')
if echo "$cors_check" | grep -q "silver-hedgehog"; then
    echo -e "${RED}⚠️  WARNING: Old CORS config detected (includes silver-hedgehog)${NC}"
    echo -e "${YELLOW}Action: Upload updated .env file and restart backend container${NC}"
else
    echo -e "${GREEN}✅ CORS Configuration: Correct (no silver-hedgehog)${NC}"
fi
echo "$cors_check"
echo

# Test API docs
test_service "API Docs" "api.harystyles.store" "/api/docs" "200"

# Test Redis UI
test_service "Redis UI" "redis-ui.harystyles.store" "/" "200"

# Test PgAdmin (expects 302 redirect to /login when not authenticated)
echo -e "${BLUE}Testing PgAdmin...${NC}"
response=$(curl -k -s -w "\n%{http_code}" -H "Host: pgadmin.harystyles.store" "${BASE_URL}/" 2>&1)
http_code=$(echo "$response" | tail -n 1)
if [ "$http_code" = "302" ] || [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ PgAdmin: HTTP ${http_code}${NC}"
    if [ "$http_code" = "302" ]; then
        echo -e "${YELLOW}  (Redirect to /login - this is normal when not authenticated)${NC}"
    fi
else
    echo -e "${RED}❌ PgAdmin: HTTP ${http_code} (expected 302 or 200)${NC}"
fi
echo

# Test Traefik Dashboard (expects 302 redirect to /dashboard/)
echo -e "${BLUE}Testing Traefik Dashboard...${NC}"
response=$(curl -k -s -w "\n%{http_code}" -H "Host: traefik.harystyles.store" "${BASE_URL}/" 2>&1)
http_code=$(echo "$response" | tail -n 1)
if [ "$http_code" = "302" ] || [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Traefik Dashboard: HTTP ${http_code}${NC}"
    if [ "$http_code" = "302" ]; then
        echo -e "${YELLOW}  (Redirect to /dashboard/ - this is normal)${NC}"
    fi
else
    echo -e "${RED}❌ Traefik Dashboard: HTTP ${http_code} (expected 302 or 200)${NC}"
fi
echo

# DNS Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}DNS Resolution Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

dns_ok=false
if nslookup api.harystyles.store > /dev/null 2>&1; then
    echo -e "${GREEN}✅ DNS resolving correctly${NC}"
    dns_ok=true

    # If DNS works, test via domain
    echo
    echo -e "${BLUE}Testing via domain name...${NC}"
    curl -k -s https://api.harystyles.store/health -w "\nHTTP Code: %{http_code}\n"
else
    echo -e "${RED}❌ DNS not resolving${NC}"
    echo -e "${YELLOW}Workaround: Add to /etc/hosts:${NC}"
    echo "67.43.239.18 api.harystyles.store"
    echo "67.43.239.18 pgadmin.harystyles.store"
    echo "67.43.239.18 redis-ui.harystyles.store"
    echo "67.43.239.18 traefik.harystyles.store"
fi
echo

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Service URLs${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo "Backend API:        https://api.harystyles.store"
echo "API Docs:           https://api.harystyles.store/api/docs"
echo "PgAdmin:            https://pgadmin.harystyles.store"
echo "Redis UI:           https://redis-ui.harystyles.store"
echo "Traefik Dashboard:  https://traefik.harystyles.store"
echo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
