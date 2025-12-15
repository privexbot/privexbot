#!/bin/bash
# Diagnostic script for frontend deployment issues
# Purpose: Test if assets are accessible and identify potential issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Icons
SUCCESS="✔"
FAILURE="✖"
WARNING="⚠"
INFO="ℹ"

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  PrivexBot Frontend Deployment Diagnostics    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
IMAGE_DIGEST="harystyles/privexbot-frontend@sha256:3abf5a7d54322c7cc1924555213b5e4f0ab665e28e9aeb389dbd32224db14f98"
PRODUCTION_URL="${1:-https://silver-hedgehog.vm.scrtlabs.com}"

echo -e "${YELLOW}Testing URL: ${PRODUCTION_URL}${NC}"
echo ""

# Test 1: Check if main page loads
echo -e "${BLUE}[1/6]${NC} Testing main page..."
if curl -sS -o /dev/null -w "%{http_code}" "${PRODUCTION_URL}/" | grep -q "200"; then
    echo -e "${GREEN}${SUCCESS}${NC} Main page loads (HTTP 200)"
else
    echo -e "${RED}${FAILURE}${NC} Main page failed to load"
    exit 1
fi

# Test 2: Check if config.js is accessible
echo -e "${BLUE}[2/6]${NC} Testing runtime configuration..."
CONFIG_RESPONSE=$(curl -sS "${PRODUCTION_URL}/config.js")
if echo "$CONFIG_RESPONSE" | grep -q "window.ENV_CONFIG"; then
    echo -e "${GREEN}${SUCCESS}${NC} Runtime config accessible"
    echo -e "  ${BLUE}${INFO}${NC} Config content:"
    echo "$CONFIG_RESPONSE" | sed 's/^/    /'
else
    echo -e "${RED}${FAILURE}${NC} Runtime config not found or malformed"
fi
echo ""

# Test 3: Extract asset filenames from index.html
echo -e "${BLUE}[3/6]${NC} Extracting asset references from index.html..."
INDEX_HTML=$(curl -sS "${PRODUCTION_URL}/")

# Extract JS file
JS_FILE=$(echo "$INDEX_HTML" | grep -o '/assets/index-[^"]*\.js' | head -1)
if [ -n "$JS_FILE" ]; then
    echo -e "${GREEN}${SUCCESS}${NC} Found JS asset: ${JS_FILE}"
else
    echo -e "${RED}${FAILURE}${NC} No JS asset found in index.html"
    echo -e "${YELLOW}${WARNING}${NC} Index.html content:"
    echo "$INDEX_HTML" | sed 's/^/    /'
    exit 1
fi

# Extract CSS file
CSS_FILE=$(echo "$INDEX_HTML" | grep -o '/assets/index-[^"]*\.css' | head -1)
if [ -n "$CSS_FILE" ]; then
    echo -e "${GREEN}${SUCCESS}${NC} Found CSS asset: ${CSS_FILE}"
else
    echo -e "${YELLOW}${WARNING}${NC} No CSS asset found in index.html"
fi
echo ""

# Test 4: Test if JS asset is accessible
echo -e "${BLUE}[4/6]${NC} Testing JavaScript asset accessibility..."
JS_HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "${PRODUCTION_URL}${JS_FILE}")
JS_CONTENT_TYPE=$(curl -sS -I "${PRODUCTION_URL}${JS_FILE}" | grep -i "content-type:" | tr -d '\r')

if [ "$JS_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}${SUCCESS}${NC} JS asset accessible (HTTP ${JS_HTTP_CODE})"
    echo -e "  ${BLUE}${INFO}${NC} ${JS_CONTENT_TYPE}"

    # Check MIME type
    if echo "$JS_CONTENT_TYPE" | grep -qiE "(application/javascript|text/javascript)"; then
        echo -e "${GREEN}${SUCCESS}${NC} Correct MIME type for ES modules"
    else
        echo -e "${RED}${FAILURE}${NC} Incorrect MIME type - ES modules require application/javascript or text/javascript"
        echo -e "  ${YELLOW}${WARNING}${NC} This will cause the browser to reject the module!"
    fi
else
    echo -e "${RED}${FAILURE}${NC} JS asset not accessible (HTTP ${JS_HTTP_CODE})"
fi

# Get file size
JS_SIZE=$(curl -sS -I "${PRODUCTION_URL}${JS_FILE}" | grep -i "content-length:" | awk '{print $2}' | tr -d '\r')
if [ -n "$JS_SIZE" ]; then
    echo -e "  ${BLUE}${INFO}${NC} File size: $((JS_SIZE / 1024)) KB"
fi
echo ""

# Test 5: Test if CSS asset is accessible
if [ -n "$CSS_FILE" ]; then
    echo -e "${BLUE}[5/6]${NC} Testing CSS asset accessibility..."
    CSS_HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "${PRODUCTION_URL}${CSS_FILE}")
    CSS_CONTENT_TYPE=$(curl -sS -I "${PRODUCTION_URL}${CSS_FILE}" | grep -i "content-type:" | tr -d '\r')

    if [ "$CSS_HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}${SUCCESS}${NC} CSS asset accessible (HTTP ${CSS_HTTP_CODE})"
        echo -e "  ${BLUE}${INFO}${NC} ${CSS_CONTENT_TYPE}"
    else
        echo -e "${RED}${FAILURE}${NC} CSS asset not accessible (HTTP ${CSS_HTTP_CODE})"
    fi
    echo ""
fi

# Test 6: Check security headers
echo -e "${BLUE}[6/6]${NC} Checking security headers..."
HEADERS=$(curl -sS -I "${PRODUCTION_URL}/" | tr -d '\r')

# Check for CSP
if echo "$HEADERS" | grep -qi "content-security-policy:"; then
    CSP=$(echo "$HEADERS" | grep -i "content-security-policy:" | head -1)
    echo -e "${YELLOW}${WARNING}${NC} Content-Security-Policy found:"
    echo -e "  $CSP"
    echo -e "  ${BLUE}${INFO}${NC} This might block scripts if not configured correctly"
else
    echo -e "${GREEN}${SUCCESS}${NC} No CSP header (scripts should load)"
fi

# Check for HTTPS upgrade
if echo "$HEADERS" | grep -qi "strict-transport-security:"; then
    echo -e "${GREEN}${SUCCESS}${NC} HSTS enabled (good for security)"
fi

# Check X-Content-Type-Options
if echo "$HEADERS" | grep -qi "x-content-type-options: nosniff"; then
    echo -e "${GREEN}${SUCCESS}${NC} X-Content-Type-Options: nosniff (MIME type must be correct)"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║             Diagnostic Complete                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Recommendations
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. ${BLUE}Check browser console${NC} for JavaScript errors"
echo -e "   Open DevTools (F12) → Console tab"
echo -e ""
echo -e "2. ${BLUE}Check browser network tab${NC} to see if assets are requested"
echo -e "   Open DevTools (F12) → Network tab → Reload page"
echo -e ""
echo -e "3. ${BLUE}Look for these specific errors:${NC}"
echo -e "   - MIME type errors (application/octet-stream instead of application/javascript)"
echo -e "   - CORS errors (shouldn't happen for same-origin)"
echo -e "   - CSP violations (blocked by Content-Security-Policy)"
echo -e "   - Mixed content (HTTPS page loading HTTP resources)"
echo -e ""
echo -e "4. ${BLUE}If assets are accessible but page is blank:${NC}"
echo -e "   - Check if the root div exists: document.getElementById('root')"
echo -e "   - Check for React errors in console"
echo -e "   - Verify API_BASE_URL is accessible from browser"
echo ""
