#!/bin/bash
# Enhanced CPU Development Environment Manager for PrivexBot Backend
# Comprehensive Docker management with advanced CPU support features
# Usage: ./scripts/docker/dev-cpu.sh [COMMAND] [OPTIONS]
# Commands: up, down, restart, logs, build, clean, shell, db, migrate, test, ps, exec, port, health, install, monitor, backup, restore, env, status
# Services: backend-dev, postgres, redis, qdrant, celery-worker, celery-beat, flower, all (default)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.dev.yml"
PROJECT_NAME="privexbot"
BACKEND_SERVICE="backend-dev"
POSTGRES_SERVICE="postgres"
REDIS_SERVICE="redis"
QDRANT_SERVICE="qdrant"
CELERY_SERVICE="celery-worker"
CELERY_BEAT_SERVICE="celery-beat"
FLOWER_SERVICE="flower"

# Check if we're in the backend directory
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Error: $COMPOSE_FILE not found${NC}"
    echo "Please run this script from the backend directory"
    exit 1
fi

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Show help
show_help() {
    cat << 'EOF'
$(echo -e "${BLUE}")PrivexBot CPU Development Environment Manager$(echo -e "${NC}")

$(echo -e "${YELLOW}")Usage:$(echo -e "${NC}") ./scripts/docker/dev-cpu.sh [COMMAND] [OPTIONS]

$(echo -e "${YELLOW}")Commands:$(echo -e "${NC}")
  $(echo -e "${GREEN}")up$(echo -e "${NC}")              Start all services (detached by default)
  $(echo -e "${GREEN}")down$(echo -e "${NC}")            Stop and remove all services
  $(echo -e "${GREEN}")restart$(echo -e "${NC}")         Restart all services
  $(echo -e "${GREEN}")logs$(echo -e "${NC}")            Show logs (all services or specific)
  $(echo -e "${GREEN}")status$(echo -e "${NC}")          Show status of all services
  $(echo -e "${GREEN}")shell$(echo -e "${NC}")           Open shell in backend container
  $(echo -e "${GREEN}")db$(echo -e "${NC}")              Database management commands
  $(echo -e "${GREEN}")migrate$(echo -e "${NC}")         Run database migrations
  $(echo -e "${GREEN}")clean$(echo -e "${NC}")           Clean everything (containers, volumes, images)
  $(echo -e "${GREEN}")build$(echo -e "${NC}")           Rebuild Docker images
  $(echo -e "${GREEN}")test$(echo -e "${NC}")            Run tests in container
  $(echo -e "${GREEN}")ps$(echo -e "${NC}")              Show running containers
  $(echo -e "${GREEN}")exec$(echo -e "${NC}")            Execute command in service
  $(echo -e "${GREEN}")port$(echo -e "${NC}")            Show port mappings
  $(echo -e "${GREEN}")health$(echo -e "${NC}")          Check health of all services
  $(echo -e "${GREEN}")install$(echo -e "${NC}")         Install Playwright browsers
  $(echo -e "${GREEN}")monitor$(echo -e "${NC}")         Start monitoring tools (Flower)
  $(echo -e "${GREEN}")backup$(echo -e "${NC}")          Backup database and volumes
  $(echo -e "${GREEN}")restore$(echo -e "${NC}")         Restore from backup
  $(echo -e "${GREEN}")env$(echo -e "${NC}")             Setup environment file

$(echo -e "${YELLOW}")Service Control:$(echo -e "${NC}")
  $(echo -e "${GREEN}")up [service]$(echo -e "${NC}")    Start specific service(s)
  $(echo -e "${GREEN}")down [service]$(echo -e "${NC}")  Stop specific service(s)
  $(echo -e "${GREEN}")restart [service]$(echo -e "${NC}") Restart specific service(s)
  $(echo -e "${GREEN}")logs [service]$(echo -e "${NC}")  Show logs for specific service(s)

$(echo -e "${YELLOW}")Database Commands:$(echo -e "${NC}")
  $(echo -e "${GREEN}")db shell$(echo -e "${NC}")        Open PostgreSQL shell
  $(echo -e "${GREEN}")db create$(echo -e "${NC}")       Create database
  $(echo -e "${GREEN}")db drop$(echo -e "${NC}")         Drop database
  $(echo -e "${GREEN}")db reset$(echo -e "${NC}")        Reset database (drop + create + migrate)
  $(echo -e "${GREEN}")db backup$(echo -e "${NC}")       Backup database
  $(echo -e "${GREEN}")db restore$(echo -e "${NC}")      Restore database from backup

$(echo -e "${YELLOW}")Options:$(echo -e "${NC}")
  $(echo -e "${GREEN}")--attach$(echo -e "${NC}")        Run services in foreground (for 'up')
  $(echo -e "${GREEN}")--follow, -f$(echo -e "${NC}")    Follow logs (for 'logs')
  $(echo -e "${GREEN}")--tail [N]$(echo -e "${NC}")      Show last N lines of logs
  $(echo -e "${GREEN}")--no-cache$(echo -e "${NC}")      Build without cache (for 'build')
  $(echo -e "${GREEN}")--volumes$(echo -e "${NC}")       Remove volumes too (for 'clean')

$(echo -e "${YELLOW}")Examples:$(echo -e "${NC}")
  ./scripts/docker/dev-cpu.sh up               # Start all services
  ./scripts/docker/dev-cpu.sh up backend       # Start only backend service
  ./scripts/docker/dev-cpu.sh logs -f backend  # Follow backend logs
  ./scripts/docker/dev-cpu.sh db shell         # Open PostgreSQL shell
  ./scripts/docker/dev-cpu.sh migrate          # Run database migrations
  ./scripts/docker/dev-cpu.sh shell            # Open backend shell
  ./scripts/docker/dev-cpu.sh test             # Run tests
  ./scripts/docker/dev-cpu.sh clean --volumes  # Clean everything including data

$(echo -e "${YELLOW}")Services:$(echo -e "${NC}")
  • backend-dev    (Port 8000)  - FastAPI application
  • postgres       (Port 5434)  - PostgreSQL database
  • redis          (Port 6380)  - Redis cache/broker
  • qdrant         (Port 6335)  - Vector database
  • celery-worker             - Background task worker
  • celery-beat               - Scheduled task scheduler
  • flower         (Port 5555)  - Celery monitoring UI

$(echo -e "${YELLOW}")URLs:$(echo -e "${NC}")
  • Backend API:    http://localhost:8000
  • API Docs:       http://localhost:8000/api/docs
  • Flower UI:      http://localhost:5555 (admin:admin123)
  • Health Check:   http://localhost:8000/health

EOF
}

# Command: up - Start services
cmd_up() {
    local services="$@"
    local attach_mode=""

    # Check for --attach flag
    for arg in "$@"; do
        if [ "$arg" == "--attach" ]; then
            attach_mode="true"
            services="${services//--attach/}"
            break
        fi
    done

    print_header "Starting Development Environment"

    # Check if .env.dev exists
    if [ ! -f ".env.dev" ] && [ ! -f ".env" ]; then
        print_warning ".env.dev file not found"
        echo "Creating from template..."
        if [ -f ".env.dev.example" ]; then
            cp .env.dev.example .env.dev
            print_success "Created .env.dev from template"
            print_info "Please edit .env.dev with your configuration"
        else
            print_error ".env.dev.example not found"
            exit 1
        fi
    fi

    if [ -n "$attach_mode" ]; then
        print_info "Starting services in foreground mode (Ctrl+C to stop)"
        docker compose -f "$COMPOSE_FILE" up $services
    else
        print_info "Starting services in detached mode"
        docker compose -f "$COMPOSE_FILE" up -d $services

        if [ $? -eq 0 ]; then
            print_success "Services started successfully"
            echo ""
            cmd_status
            echo ""
            print_info "Run './scripts/docker/dev-cpu.sh logs -f' to follow logs"
        else
            print_error "Failed to start services"
            exit 1
        fi
    fi
}

# Command: down - Stop services
cmd_down() {
    local services="$@"
    print_header "Stopping Development Environment"

    if [ -z "$services" ]; then
        docker compose -f "$COMPOSE_FILE" down
    else
        docker compose -f "$COMPOSE_FILE" stop $services
        docker compose -f "$COMPOSE_FILE" rm -f $services
    fi

    if [ $? -eq 0 ]; then
        print_success "Services stopped successfully"
    else
        print_error "Failed to stop services"
        exit 1
    fi
}

# Command: restart - Restart services
cmd_restart() {
    local services="$@"
    print_header "Restarting Services"

    if [ -z "$services" ]; then
        docker compose -f "$COMPOSE_FILE" restart
    else
        docker compose -f "$COMPOSE_FILE" restart $services
    fi

    if [ $? -eq 0 ]; then
        print_success "Services restarted successfully"
        cmd_status
    else
        print_error "Failed to restart services"
        exit 1
    fi
}

# Command: logs - Show logs
cmd_logs() {
    local follow=""
    local tail=""
    local services=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--follow)
                follow="-f"
                shift
                ;;
            --tail)
                tail="--tail $2"
                shift 2
                ;;
            *)
                services="$services $1"
                shift
                ;;
        esac
    done

    print_header "Service Logs"
    docker compose -f "$COMPOSE_FILE" logs $follow $tail $services
}

# Command: status - Show status
cmd_status() {
    print_header "Service Status"

    echo -e "${CYAN}Container Status:${NC}"
    docker compose -f "$COMPOSE_FILE" ps

    echo ""
    echo -e "${CYAN}Health Status:${NC}"

    # Check each service health
    services=("$BACKEND_SERVICE" "$POSTGRES_SERVICE" "$REDIS_SERVICE" "$QDRANT_SERVICE")

    for service in "${services[@]}"; do
        if docker compose -f "$COMPOSE_FILE" ps --status running | grep -q "$service"; then
            echo -e "  ${GREEN}●${NC} $service: Running"
        else
            echo -e "  ${RED}●${NC} $service: Not running"
        fi
    done

    echo ""
    echo -e "${CYAN}Port Mappings:${NC}"
    echo "  • Backend:   http://localhost:8000"
    echo "  • PostgreSQL: localhost:5434"
    echo "  • Redis:     localhost:6380"
    echo "  • Qdrant:    http://localhost:6335"
    echo "  • Flower:    http://localhost:5555"
}

# Command: shell - Open shell in backend container
cmd_shell() {
    print_header "Opening Backend Shell"
    docker compose -f "$COMPOSE_FILE" exec "$BACKEND_SERVICE" bash
}

# Command: db - Database management
cmd_db() {
    local subcmd="$1"
    shift

    case "$subcmd" in
        shell)
            print_header "Opening PostgreSQL Shell"
            docker compose -f "$COMPOSE_FILE" exec "$POSTGRES_SERVICE" psql -U privexbot -d privexbot_dev
            ;;
        create)
            print_header "Creating Database"
            docker compose -f "$COMPOSE_FILE" exec "$POSTGRES_SERVICE" createdb -U privexbot privexbot_dev || true
            print_success "Database created (or already exists)"
            ;;
        drop)
            print_header "Dropping Database"
            print_warning "This will delete all data!"
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker compose -f "$COMPOSE_FILE" exec "$POSTGRES_SERVICE" dropdb -U privexbot privexbot_dev || true
                print_success "Database dropped"
            else
                print_info "Cancelled"
            fi
            ;;
        reset)
            print_header "Resetting Database"
            print_warning "This will delete all data and recreate the database!"
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cmd_db drop
                cmd_db create
                cmd_migrate
                print_success "Database reset complete"
            else
                print_info "Cancelled"
            fi
            ;;
        backup)
            print_header "Backing Up Database"
            local backup_file="backups/db_$(date +%Y%m%d_%H%M%S).sql"
            mkdir -p backups
            docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
                pg_dump -U privexbot privexbot_dev > "$backup_file"
            print_success "Database backed up to $backup_file"
            ;;
        restore)
            print_header "Restoring Database"
            local backup_file="$1"
            if [ -z "$backup_file" ]; then
                echo "Available backups:"
                ls -la backups/*.sql 2>/dev/null || echo "No backups found"
                echo ""
                echo "Usage: ./scripts/docker/dev-cpu.sh db restore <backup_file>"
                exit 1
            fi
            if [ ! -f "$backup_file" ]; then
                print_error "Backup file not found: $backup_file"
                exit 1
            fi
            docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
                psql -U privexbot privexbot_dev < "$backup_file"
            print_success "Database restored from $backup_file"
            ;;
        *)
            echo "Unknown database command: $subcmd"
            echo "Available commands: shell, create, drop, reset, backup, restore"
            exit 1
            ;;
    esac
}

# Command: migrate - Run database migrations
cmd_migrate() {
    print_header "Running Database Migrations"

    # Check if backend is running
    if ! docker compose -f "$COMPOSE_FILE" ps --status running | grep -q "$BACKEND_SERVICE"; then
        print_warning "Backend service not running. Starting it..."
        cmd_up "$BACKEND_SERVICE"
        sleep 5
    fi

    docker compose -f "$COMPOSE_FILE" exec "$BACKEND_SERVICE" \
        bash -c "cd /app/src && alembic upgrade head"

    if [ $? -eq 0 ]; then
        print_success "Migrations completed successfully"
    else
        print_error "Migration failed"
        print_info "Try: ./scripts/docker/dev-cpu.sh db reset"
        exit 1
    fi
}

# Command: clean - Clean everything
cmd_clean() {
    print_header "Cleaning Development Environment"

    local remove_volumes=""
    for arg in "$@"; do
        if [ "$arg" == "--volumes" ]; then
            remove_volumes="-v"
            print_warning "This will also remove all data volumes!"
            break
        fi
    done

    read -p "Are you sure you want to clean? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cancelled"
        exit 0
    fi

    print_info "Stopping and removing containers..."
    docker compose -f "$COMPOSE_FILE" down $remove_volumes

    print_info "Removing development images..."
    docker images | grep "privexbot-backend-dev" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

    if [ -n "$remove_volumes" ]; then
        print_info "Removing named volumes..."
        docker volume ls | grep "privexbot" | awk '{print $2}' | xargs -r docker volume rm 2>/dev/null || true
    fi

    print_success "Cleanup complete"
}

# Command: build - Build Docker images
cmd_build() {
    print_header "Building Docker Images"

    local no_cache=""
    for arg in "$@"; do
        if [ "$arg" == "--no-cache" ]; then
            no_cache="--no-cache"
            print_info "Building without cache"
            break
        fi
    done

    docker compose -f "$COMPOSE_FILE" build $no_cache

    if [ $? -eq 0 ]; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Command: test - Run tests
cmd_test() {
    print_header "Running Tests"

    # Integration tests
    print_info "Running integration tests..."
    docker compose -f "$COMPOSE_FILE" exec "$BACKEND_SERVICE" \
        python scripts/test_integration.py

    if [ $? -eq 0 ]; then
        print_success "Integration tests passed"
    else
        print_error "Integration tests failed"
    fi

    # Unit tests (if available)
    if docker compose -f "$COMPOSE_FILE" exec "$BACKEND_SERVICE" \
        test -d "src/app/tests"; then
        print_info "Running unit tests..."
        docker compose -f "$COMPOSE_FILE" exec "$BACKEND_SERVICE" \
            pytest src/app/tests/ -v
    fi
}

# Command: ps - Show running containers
cmd_ps() {
    print_header "Running Containers"
    docker compose -f "$COMPOSE_FILE" ps
}

# Command: exec - Execute command in service
cmd_exec() {
    local service="$1"
    shift
    local command="$@"

    if [ -z "$service" ] || [ -z "$command" ]; then
        echo "Usage: ./scripts/docker/dev-cpu.sh exec <service> <command>"
        echo "Example: ./scripts/docker/dev-cpu.sh exec backend-dev python --version"
        exit 1
    fi

    docker compose -f "$COMPOSE_FILE" exec "$service" $command
}

# Command: port - Show port mappings
cmd_port() {
    print_header "Port Mappings"

    echo -e "${CYAN}Service Port Mappings:${NC}"
    echo ""
    echo "  Backend API:"
    echo "    • Internal: 8000"
    echo "    • External: http://localhost:8000"
    echo "    • API Docs: http://localhost:8000/api/docs"
    echo ""
    echo "  PostgreSQL Database:"
    echo "    • Internal: 5432"
    echo "    • External: localhost:5434"
    echo "    • Connection: postgresql://privexbot:privexbot_dev@localhost:5434/privexbot_dev"
    echo ""
    echo "  Redis Cache:"
    echo "    • Internal: 6379"
    echo "    • External: localhost:6380"
    echo "    • Connection: redis://localhost:6380/0"
    echo ""
    echo "  Qdrant Vector DB:"
    echo "    • Internal: 6333 (HTTP)"
    echo "    • External: http://localhost:6335"
    echo "    • gRPC: localhost:6336"
    echo ""
    echo "  Flower (Celery Monitor):"
    echo "    • Internal: 5555"
    echo "    • External: http://localhost:5555"
    echo "    • Auth: admin:admin123"
}

# Command: health - Check health of all services
cmd_health() {
    print_header "Health Check"

    # Backend API health
    echo -n "Backend API: "
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health | grep -q "200"; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi

    # PostgreSQL health
    echo -n "PostgreSQL: "
    if docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" pg_isready -U privexbot > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi

    # Redis health
    echo -n "Redis: "
    if docker compose -f "$COMPOSE_FILE" exec -T "$REDIS_SERVICE" redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi

    # Qdrant health
    echo -n "Qdrant: "
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:6335/health | grep -q "200"; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi

    echo ""
    echo -e "${CYAN}Container Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        $(docker compose -f "$COMPOSE_FILE" ps -q) 2>/dev/null || echo "No containers running"
}

# Command: install - Install Playwright browsers
cmd_install() {
    print_header "Installing Playwright Browsers"

    print_info "Installing Chromium browser for web scraping..."
    docker compose -f "$COMPOSE_FILE" exec "$BACKEND_SERVICE" \
        python -m playwright install chromium

    if [ $? -eq 0 ]; then
        print_success "Playwright browsers installed successfully"
    else
        print_error "Failed to install Playwright browsers"
        exit 1
    fi
}

# Command: monitor - Start monitoring tools
cmd_monitor() {
    print_header "Starting Monitoring Tools"

    print_info "Starting Flower (Celery monitoring)..."
    docker compose -f "$COMPOSE_FILE" up -d "$FLOWER_SERVICE"

    if [ $? -eq 0 ]; then
        print_success "Monitoring tools started"
        echo ""
        echo "Flower UI: http://localhost:5555"
        echo "Username: admin"
        echo "Password: admin123"
    else
        print_error "Failed to start monitoring tools"
        exit 1
    fi
}

# Command: backup - Backup all data
cmd_backup() {
    print_header "Backing Up Development Data"

    local backup_dir="backups/full_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"

    # Backup database
    print_info "Backing up database..."
    docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
        pg_dump -U privexbot privexbot_dev > "$backup_dir/database.sql"

    # Backup volumes
    print_info "Backing up Docker volumes..."
    docker run --rm \
        -v privexbot_postgres_data_dev:/postgres \
        -v privexbot_redis_data_dev:/redis \
        -v privexbot_qdrant_data_dev:/qdrant \
        -v "$(pwd)/$backup_dir":/backup \
        alpine tar czf /backup/volumes.tar.gz /postgres /redis /qdrant

    print_success "Backup complete: $backup_dir"
}

# Command: restore - Restore from backup
cmd_restore() {
    local backup_dir="$1"

    if [ -z "$backup_dir" ]; then
        echo "Available backups:"
        ls -la backups/full_* 2>/dev/null || echo "No backups found"
        echo ""
        echo "Usage: ./scripts/docker/dev-cpu.sh restore <backup_dir>"
        exit 1
    fi

    if [ ! -d "$backup_dir" ]; then
        print_error "Backup directory not found: $backup_dir"
        exit 1
    fi

    print_header "Restoring from Backup"
    print_warning "This will overwrite all current data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cancelled"
        exit 0
    fi

    # Stop services
    cmd_down

    # Restore database
    if [ -f "$backup_dir/database.sql" ]; then
        print_info "Restoring database..."
        cmd_up "$POSTGRES_SERVICE"
        sleep 5
        docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
            psql -U privexbot privexbot_dev < "$backup_dir/database.sql"
    fi

    # Restore volumes
    if [ -f "$backup_dir/volumes.tar.gz" ]; then
        print_info "Restoring volumes..."
        docker run --rm \
            -v privexbot_postgres_data_dev:/postgres \
            -v privexbot_redis_data_dev:/redis \
            -v privexbot_qdrant_data_dev:/qdrant \
            -v "$(pwd)/$backup_dir":/backup \
            alpine tar xzf /backup/volumes.tar.gz -C /
    fi

    # Start services
    cmd_up

    print_success "Restore complete"
}

# Command: env - Setup environment file
cmd_env() {
    print_header "Environment Setup"

    if [ -f ".env.dev" ]; then
        print_info ".env.dev already exists"
        read -p "Do you want to recreate it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi

    if [ ! -f ".env.dev.example" ]; then
        print_error ".env.dev.example not found"
        exit 1
    fi

    cp .env.dev.example .env.dev

    # Generate secure passwords
    print_info "Generating secure passwords..."

    # Generate random passwords
    POSTGRES_PASSWORD=$(openssl rand -base64 32)
    FLOWER_PASSWORD=$(openssl rand -base64 16)
    SECRET_KEY=$(openssl rand -hex 32)

    # Update .env.dev with generated values (macOS compatible)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env.dev
        sed -i '' "s/FLOWER_PASSWORD=.*/FLOWER_PASSWORD=$FLOWER_PASSWORD/" .env.dev
        sed -i '' "s/SECRET_KEY=.*/SECRET_KEY=$SECRET_KEY/" .env.dev
    else
        # Linux
        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env.dev
        sed -i "s/FLOWER_PASSWORD=.*/FLOWER_PASSWORD=$FLOWER_PASSWORD/" .env.dev
        sed -i "s/SECRET_KEY=.*/SECRET_KEY=$SECRET_KEY/" .env.dev
    fi

    print_success ".env.dev created with secure passwords"
    print_info "Please review and update other settings as needed"
}

# Main command dispatcher
main() {
    case "$1" in
        up)
            shift
            cmd_up "$@"
            ;;
        down)
            shift
            cmd_down "$@"
            ;;
        restart)
            shift
            cmd_restart "$@"
            ;;
        logs)
            shift
            cmd_logs "$@"
            ;;
        status)
            cmd_status
            ;;
        shell)
            cmd_shell
            ;;
        db)
            shift
            cmd_db "$@"
            ;;
        migrate)
            cmd_migrate
            ;;
        clean)
            shift
            cmd_clean "$@"
            ;;
        build)
            shift
            cmd_build "$@"
            ;;
        test)
            cmd_test
            ;;
        ps)
            cmd_ps
            ;;
        exec)
            shift
            cmd_exec "$@"
            ;;
        port|ports)
            cmd_port
            ;;
        health)
            cmd_health
            ;;
        install)
            cmd_install
            ;;
        monitor)
            cmd_monitor
            ;;
        backup)
            cmd_backup
            ;;
        restore)
            shift
            cmd_restore "$@"
            ;;
        env)
            cmd_env
            ;;
        help|--help|-h|"")
            show_help
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo "Run './scripts/docker/dev-cpu.sh help' for usage"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"