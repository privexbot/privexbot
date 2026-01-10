# Widget Production Dockerfile
# Multi-stage build for CDN deployment
# Outputs versioned file (widget.v1.0.0.js) + unversioned copy (widget.js)

# Stage 1: Build the widget
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the widget (outputs versioned file to /app/build/)
RUN npm run build

# Also create an unversioned copy for convenience
RUN cd build && \
    VERSIONED_FILE=$(ls widget.v*.js 2>/dev/null | head -1) && \
    if [ -n "$VERSIONED_FILE" ]; then \
      cp "$VERSIONED_FILE" widget.js; \
    fi

# Stage 2: Serve with Nginx (optional - for self-hosted deployments)
FROM nginx:stable-alpine

# Copy built widget files
COPY --from=build /app/build /usr/share/nginx/html

# Copy test.html for debugging
COPY --from=build /app/test.html /usr/share/nginx/html/

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -q --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
