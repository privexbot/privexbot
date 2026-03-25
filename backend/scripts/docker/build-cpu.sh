#!/bin/bash
# Build script for CPU-only development environment
# This avoids large NVIDIA CUDA packages that cause timeout issues

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔨 Building CPU-only backend container...${NC}"
echo -e "${GREEN}This build excludes GPU support to avoid timeout issues with NVIDIA packages${NC}"

# Use the CPU-optimized Dockerfile
docker build \
    -f Dockerfile.dev.cpu \
    -t privexbot-backend-dev:cpu \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
    echo -e "${YELLOW}To use this image, update docker-compose.dev.yml to use 'privexbot-backend-dev:cpu'${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi