#!/bin/bash
# Backend Development Environment Helper
# Usage: ./scripts/docker/dev.sh [OPTIONS] [command] [service]
# Commands: up, down, restart, logs, build, clean, shell, db, migrate, status
# Services: backend, celery, beat, flower, postgres, redis, qdrant, all (default)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.dev.yml"
SERVICE_BACKEND="backend-dev"
SERVICE_CELERY="celery-worker"
SERVICE_BEAT="celery-beat"
SERVICE_FLOWER="flower"
SERVICE_POSTGRES="postgres"
SERVICE_REDIS="redis"
SERVICE_QDRANT="qdrant"

# Global options
NO_CACHE=""

# Function to display usage
usage() {
    echo -e "${BLUE}Backend Development Environment Helper${NC}"
    echo ""
    echo "Usage: ./scripts/docker/dev.sh [OPTIONS] [command] [service]"
    echo ""
    echo "Options:"
    echo "  --no-cache      Force rebuild without Docker cache (applies to build command)"
    echo "  --help          Show this help message"
    echo ""
    echo "Commands:"
    echo "  up          Start development environment"
    echo "  down        Stop development environment"
    echo "  restart     Restart service(s)"
    echo "  logs        View service logs (follow mode)"
    echo "  build       Rebuild backend container"
    echo "  clean       Stop and remove all containers, volumes"
    echo "  shell       Access backend container shell"
    echo "  db          Access PostgreSQL shell"
    echo "  migrate     Run database migrations"
    echo "  test        Run tests inside container"
    echo "  status      Show status of all services"
    echo ""
    echo "Services (optional for restart, logs):"
    echo "  backend     Backend API service (default)"
    echo "  celery      Celery worker service"
    echo "  beat        Celery beat scheduler"
    echo "  flower      Celery monitoring UI (http://localhost:5555)"
    echo "  postgres    PostgreSQL database"
    echo "  redis       Redis cache and message broker"
    echo "  qdrant      Vector database for KB features"
    echo "  all         All services (default)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/docker/dev.sh up                      # Start all services"
    echo "  ./scripts/docker/dev.sh logs backend            # View backend logs only"
    echo "  ./scripts/docker/dev.sh restart celery          # Restart celery worker"
    echo "  ./scripts/docker/dev.sh --no-cache build        # Force rebuild without cache"
    echo "  ./scripts/docker/dev.sh shell                   # Access backend shell"
    echo "  ./scripts/docker/dev.sh status                  # Show all service status"
    echo ""
    echo "When to use --no-cache:"
    echo "  - When you've updated scripts or files (like entrypoint scripts)"
    echo "  - When Docker cache is causing issues with updated dependencies"
    echo "  - When you want to ensure the latest base image is used"
    echo "  - When debugging build issues"
    echo ""
}

# Parse command line arguments
COMMAND=""
SERVICE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        -*)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo "Use --help to see available options"
            exit 1
            ;;
        *)
            if [ -z "$COMMAND" ]; then
                COMMAND="$1"
            elif [ -z "$SERVICE" ]; then
                SERVICE="$1"
            else
                echo -e "${RED}❌ Too many arguments${NC}"
                usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if command is provided
if [ -z "$COMMAND" ]; then
    usage
    exit 1
fi

# Map service names to container service names
get_service_name() {
    case "$1" in
        backend) echo "$SERVICE_BACKEND" ;;
        celery) echo "$SERVICE_CELERY" ;;
        beat) echo "$SERVICE_BEAT" ;;
        flower) echo "$SERVICE_FLOWER" ;;
        postgres) echo "$SERVICE_POSTGRES" ;;
        redis) echo "$SERVICE_REDIS" ;;
        qdrant) echo "$SERVICE_QDRANT" ;;
        all|*) echo "" ;;  # Empty means all services
    esac
}

case $COMMAND in
    up)
        echo -e "${GREEN}🚀 Starting development environment...${NC}"
        docker compose -f $COMPOSE_FILE up
        ;;

    down)
        echo -e "${YELLOW}🛑 Stopping development environment...${NC}"
        docker compose -f $COMPOSE_FILE down
        echo -e "${GREEN}✅ Stopped${NC}"
        ;;

    restart)
        TARGET_SERVICE=$(get_service_name "$SERVICE")
        if [ -n "$TARGET_SERVICE" ]; then
            echo -e "${YELLOW}🔄 Restarting $SERVICE service...${NC}"
            docker compose -f $COMPOSE_FILE restart $TARGET_SERVICE
            echo -e "${GREEN}✅ $SERVICE service restarted${NC}"
        else
            echo -e "${YELLOW}🔄 Restarting all services...${NC}"
            docker compose -f $COMPOSE_FILE restart
            echo -e "${GREEN}✅ All services restarted${NC}"
        fi
        ;;

    logs)
        TARGET_SERVICE=$(get_service_name "$SERVICE")
        if [ -n "$TARGET_SERVICE" ]; then
            echo -e "${BLUE}📋 Viewing $SERVICE logs (Ctrl+C to exit)...${NC}"
            docker compose -f $COMPOSE_FILE logs -f $TARGET_SERVICE
        else
            echo -e "${BLUE}📋 Viewing all service logs (Ctrl+C to exit)...${NC}"
            docker compose -f $COMPOSE_FILE logs -f
        fi
        ;;

    build)
        if [ -n "$NO_CACHE" ]; then
            echo -e "${YELLOW}🔨 Rebuilding backend container (without cache)...${NC}"
            echo -e "${BLUE}ℹ️  This ensures fresh build with updated scripts and dependencies${NC}"
        else
            echo -e "${YELLOW}🔨 Rebuilding backend container...${NC}"
        fi
        docker compose -f $COMPOSE_FILE build $NO_CACHE $SERVICE_BACKEND
        echo -e "${GREEN}✅ Build complete${NC}"
        echo -e "${BLUE}💡 Note: Celery services will use the rebuilt image on next restart${NC}"
        ;;

    clean)
        echo -e "${RED}🧹 Cleaning up (removes containers and volumes)...${NC}"
        read -p "Are you sure? This will delete all data (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose -f $COMPOSE_FILE down -v
            echo -e "${GREEN}✅ Cleanup complete${NC}"
        else
            echo -e "${YELLOW}Cancelled${NC}"
        fi
        ;;

    shell)
        echo -e "${BLUE}🐚 Accessing backend container shell...${NC}"
        docker compose -f $COMPOSE_FILE exec $SERVICE_BACKEND /bin/bash
        ;;

    db)
        echo -e "${BLUE}🗄️  Accessing PostgreSQL shell...${NC}"
        docker compose -f $COMPOSE_FILE exec postgres psql -U privexbot -d privexbot_dev
        ;;

    migrate)
        echo -e "${YELLOW}🔄 Running database migrations...${NC}"
        docker compose -f $COMPOSE_FILE exec $SERVICE_BACKEND alembic upgrade head
        echo -e "${GREEN}✅ Migrations complete${NC}"
        ;;

    test)
        echo -e "${YELLOW}🧪 Running tests...${NC}"
        docker compose -f $COMPOSE_FILE exec $SERVICE_BACKEND pytest
        ;;

    status)
        echo -e "${BLUE}📊 Development Environment Status${NC}"
        echo ""
        docker compose -f $COMPOSE_FILE ps
        echo ""
        echo -e "${BLUE}🌐 Service URLs:${NC}"
        echo "  • Backend API:    http://localhost:8000"
        echo "  • API Docs:       http://localhost:8000/api/docs"
        echo "  • Flower Monitor: http://localhost:5555 (admin:admin123)"
        echo "  • PostgreSQL:     localhost:5434"
        echo "  • Redis:          localhost:6380"
        echo "  • Qdrant:         localhost:6335"
        ;;

    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        echo ""
        if [ -n "$SERVICE" ]; then
            echo -e "${YELLOW}💡 Did you mean: ./scripts/docker/dev.sh $COMMAND${NC}"
        fi
        usage
        exit 1
        ;;
esac
