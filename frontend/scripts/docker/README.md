# Docker Scripts - PrivexBot Frontend

Quick reference for Docker helper scripts.

## Available Scripts

### 1. `check.sh` - Environment Check
Verify your Docker setup and prerequisites.

```bash
./scripts/docker/check.sh
```

**What it checks:**
- Docker installation and version
- Docker daemon status
- Docker Compose availability
- Docker Hub authentication
- Required files existence
- Docker resources (CPU, memory)
- Running containers

### 2. `dev.sh` - Development Environment
Manage local development environment.

```bash
# Start development environment
./scripts/docker/dev.sh up

# Stop development environment
./scripts/docker/dev.sh down

# Restart environment
./scripts/docker/dev.sh restart

# View logs
./scripts/docker/dev.sh logs

# Rebuild image
./scripts/docker/dev.sh build

# Clean up everything
./scripts/docker/dev.sh clean

# Open shell in container
./scripts/docker/dev.sh shell
```

### 3. `build-push.sh` - Build and Push Production Image
Build production Docker image and push to Docker Hub.

```bash
# Build and push version
./scripts/docker/build-push.sh <version>

# Examples:
./scripts/docker/build-push.sh 0.1.0        # MVP version
./scripts/docker/build-push.sh 0.2.0-rc.1   # Release candidate
./scripts/docker/build-push.sh 1.0.0        # Official launch
```

**Versioning Guidelines:**
- `0.x.x` - MVP/prelaunch versions
- `0.x.x-rc.N` - Release candidates
- `1.0.0` - Official launch version (reserved)
- `1.x.x+` - Post-launch versions

## Quick Start

### First Time Setup

1. Check your environment:
```bash
./scripts/docker/check.sh
```

2. Login to Docker Hub (if not already):
```bash
docker login
```

3. Start development:
```bash
./scripts/docker/dev.sh up
```

4. Access frontend at: http://localhost:5173

### Building for Production

1. Build and push:
```bash
./scripts/docker/build-push.sh 0.1.0
```

2. Copy the digest from output

3. Update `docker-compose.prod.yml` with the digest

4. Deploy:
```bash
docker compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Docker daemon not running
```bash
# macOS/Windows: Start Docker Desktop
# Linux:
sudo systemctl start docker
```

### Not logged in to Docker Hub
```bash
docker login
# Enter username: harystyles
# Enter password/token
```

### Port already in use
```bash
# Check what's using the port
lsof -i :5173  # or :80 for production

# Stop the conflicting process or use different port
```

### Clean slate rebuild
```bash
./scripts/docker/dev.sh clean
./scripts/docker/dev.sh up
```
