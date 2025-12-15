#!/usr/bin/env bash
#
# PrivexBot Frontend - Development Environment Script
# Purpose: Start local development environment with Docker
# Usage: ./scripts/docker/dev.sh [command]
#
# Commands:
#   up        - Start development environment
#   down      - Stop development environment
#   restart   - Restart development environment
#   logs      - View logs
#   build     - Rebuild development image
#   clean     - Clean up containers and volumes

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✔ ${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠ ${NC} $1"
}

# Change to frontend directory
cd "$(dirname "$0")/../.."

COMPOSE_FILE="docker-compose.dev.yml"

# Display usage
usage() {
    cat <<EOF
Usage: $0 [command]

Commands:
  up        - Start development environment (default)
  down      - Stop development environment
  restart   - Restart development environment
  logs      - View logs (follow mode)
  build     - Rebuild development image
  clean     - Clean up containers, volumes, and images
  shell     - Open shell in running container

EOF
    exit 1
}

# Start development environment
dev_up() {
    log_info "Starting development environment..."

    # Note: Backend must be running for API calls to work
    # Check if backend is accessible
    if ! curl -s http://localhost:8000/api/v1/auth/email/login > /dev/null 2>&1; then
        log_warning "Backend not accessible at http://localhost:8000"
        log_warning "Please start backend first:"
        log_warning "  cd ../backend && ./scripts/docker/dev.sh up"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cancelled"
            exit 1
        fi
    else
        log_success "Backend is running and accessible"
    fi

    docker compose -f "$COMPOSE_FILE" up --build -d
    log_success "Development environment started"
    log_info "Frontend available at: http://localhost:5173"
    log_info "Browser makes API calls to: http://localhost:8000/api/v1"
    log_info "View logs: ./scripts/docker/dev.sh logs"
}

# Stop development environment
dev_down() {
    log_info "Stopping development environment..."
    docker compose -f "$COMPOSE_FILE" down
    log_success "Development environment stopped"
}

# Restart development environment
dev_restart() {
    log_info "Restarting development environment..."
    docker compose -f "$COMPOSE_FILE" restart
    log_success "Development environment restarted"
}

# View logs
dev_logs() {
    log_info "Viewing logs (Ctrl+C to exit)..."
    docker compose -f "$COMPOSE_FILE" logs -f
}

# Rebuild development image
dev_build() {
    log_info "Rebuilding development image..."
    docker compose -f "$COMPOSE_FILE" build --no-cache
    log_success "Development image rebuilt"
}

# Clean up
dev_clean() {
    log_warning "This will remove containers, volumes, and images"
    read -p "Are you sure? (yes/no): " confirm
    if [[ $confirm == "yes" ]]; then
        log_info "Cleaning up..."
        docker compose -f "$COMPOSE_FILE" down -v --rmi all
        log_success "Cleanup complete"
    else
        log_info "Cleanup cancelled"
    fi
}

# Open shell in container
dev_shell() {
    log_info "Opening shell in container..."
    docker compose -f "$COMPOSE_FILE" exec frontend-dev sh
}

# Main
case "${1:-up}" in
    up)
        dev_up
        ;;
    down)
        dev_down
        ;;
    restart)
        dev_restart
        ;;
    logs)
        dev_logs
        ;;
    build)
        dev_build
        ;;
    clean)
        dev_clean
        ;;
    shell)
        dev_shell
        ;;
    *)
        usage
        ;;
esac
