# PrivexBot CPU Deployment Guide

This guide covers the complete deployment workflow for PrivexBot using CPU-optimized Docker images.

## Why CPU-Only?

🔥 **Problem Solved**: The original Docker builds failed due to 2GB+ NVIDIA CUDA package downloads causing timeouts.

✅ **CPU Benefits**:
- Builds 10x faster (~3 min vs 30+ min)
- Uses CPU-optimized PyTorch (~140MB vs 2GB+)
- Perfect for production servers (SecretVM, VPS)
- No timeout issues with large packages
- Same performance for inference workloads

## Architecture Overview

### Services
- **Backend**: FastAPI application
- **Celery Worker**: Background tasks (KB processing, embeddings)
- **Celery Beat**: Scheduled tasks (maintenance, re-indexing)
- **Flower**: Celery monitoring UI
- **PostgreSQL**: Database with pgvector extension
- **Redis**: Cache and message broker
- **Qdrant**: Vector database for knowledge base

### Deployment Environments

1. **Development**: Local build, hot reload
2. **Production**: Registry images with digest
3. **SecretVM**: Registry images with Traefik

## Quick Start

### Development
```bash
# Start all services
./scripts/docker/dev.sh up

# View status
./scripts/docker/dev.sh status

# View specific service logs
./scripts/docker/dev.sh logs celery

# Access services
./scripts/docker/dev.sh shell    # Backend shell
./scripts/docker/dev.sh db       # Database shell
```

### Production Deployment
```bash
# 1. Build and deploy (one command)
./scripts/docker/deploy-cpu.sh 0.1.0

# 2. Copy files to production server
scp docker-compose.yml .env server:/path/to/app/

# 3. Deploy on server
docker compose pull
docker compose up -d
```

### SecretVM Deployment
```bash
# 1. Build and deploy
./scripts/docker/deploy-cpu.sh 0.1.0 --secretvm

# 2. Show compose file for portal
./scripts/docker/secretvm-deploy.sh show

# 3. Prepare environment
./scripts/docker/secretvm-deploy.sh prepare

# 4. Copy-paste into SecretVM Dev Portal and deploy

# 5. Test deployment
./scripts/docker/secretvm-deploy.sh test
```

## Detailed Deployment Workflow

### 1. Development Environment

#### Start Development
```bash
./scripts/docker/dev.sh up
```

**What this does**:
- Builds local CPU-optimized image once
- Reuses same image for all services (backend, celery, flower)
- Mounts source code for hot reload
- Starts: postgres, redis, qdrant, backend, celery-worker, celery-beat, flower

#### Available URLs
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs
- Flower Monitor: http://localhost:5555 (admin:admin123)
- PostgreSQL: localhost:5434
- Redis: localhost:6380
- Qdrant: localhost:6335

#### Development Commands
```bash
# Service management
./scripts/docker/dev.sh up             # Start all
./scripts/docker/dev.sh down           # Stop all
./scripts/docker/dev.sh restart        # Restart all
./scripts/docker/dev.sh restart celery # Restart celery only
./scripts/docker/dev.sh build          # Rebuild image

# Monitoring
./scripts/docker/dev.sh status         # Show service status
./scripts/docker/dev.sh logs           # All logs
./scripts/docker/dev.sh logs backend   # Backend logs only
./scripts/docker/dev.sh logs flower    # Flower logs only

# Database
./scripts/docker/dev.sh migrate        # Run migrations
./scripts/docker/dev.sh db             # Access PostgreSQL

# Development
./scripts/docker/dev.sh shell          # Backend shell
./scripts/docker/dev.sh test           # Run tests
```

### 2. Production Deployment

#### Complete Workflow (One Command)
```bash
./scripts/docker/deploy-cpu.sh 0.1.0
```

**What this does**:
1. Builds CPU-optimized Docker image
2. Pushes to Docker Hub registry
3. Updates docker-compose.yml with immutable digest
4. Provides deployment instructions

#### Manual Steps
```bash
# 1. Build and push only
./scripts/docker/build-push-cpu.sh 0.1.0

# 2. Update compose files only
./scripts/docker/update-digests.sh --production

# 3. Deploy
scp docker-compose.yml .env server:/path/to/app/
# On server:
docker compose pull
docker compose up -d
```

#### Environment Configuration (.env)
```bash
# Required
POSTGRES_PASSWORD=$(openssl rand -base64 32)
SECRET_KEY=$(openssl rand -hex 32)
FLOWER_PASSWORD=$(openssl rand -base64 16)

# CORS
BACKEND_CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Optional: Email for notifications
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-password
```

#### Optional Monitoring
```bash
# Enable Flower monitoring
docker compose --profile monitoring up -d

# Access at: http://server:5555
```

### 3. SecretVM Deployment

#### Complete Workflow
```bash
./scripts/docker/deploy-cpu.sh 0.1.0 --secretvm
```

#### Manual Steps

**Step 1: Prepare**
```bash
# Build and push image
./scripts/docker/build-push-cpu.sh 0.1.0

# Update SecretVM compose file
./scripts/docker/update-digests.sh --secretvm

# Prepare environment file
./scripts/docker/secretvm-deploy.sh prepare
```

**Step 2: Deploy via Portal**
```bash
# Show compose file for copy-paste
./scripts/docker/secretvm-deploy.sh show
```
- Copy the output
- Paste into SecretVM Dev Portal
- Upload `deploy/secretvm/.env` to portal
- Click "Deploy"

**Step 3: Test**
```bash
./scripts/docker/secretvm-deploy.sh test
```

#### SecretVM Services (after deployment)
- Backend API: https://api.harystyles.store
- API Docs: https://api.harystyles.store/api/docs
- Flower Monitor: https://flower.harystyles.store
- PgAdmin: https://pgadmin.harystyles.store
- Redis UI: https://redis-ui.harystyles.store
- Traefik Dashboard: https://traefik.harystyles.store

## Script Reference

### Main Deployment Scripts

| Script | Purpose | Usage |
|--------|---------|--------|
| `deploy-cpu.sh` | Complete deployment workflow | `./scripts/docker/deploy-cpu.sh 0.1.0 [--production\|--secretvm\|--all]` |
| `build-push-cpu.sh` | Build and push CPU image | `./scripts/docker/build-push-cpu.sh 0.1.0 [--no-cache]` |
| `update-digests.sh` | Update compose files with digest | `./scripts/docker/update-digests.sh [--production\|--secretvm\|--all]` |
| `dev.sh` | Development environment | `./scripts/docker/dev.sh [up\|down\|restart\|logs] [service]` |

### Environment-Specific Scripts

| Script | Purpose | Environment |
|--------|---------|-------------|
| `secretvm-deploy.sh` | SecretVM deployment helper | SecretVM |
| `dev.sh` | Development management | Development |

## Best Practices

### Development
1. Always use `./scripts/docker/dev.sh` for local development
2. Use `./scripts/docker/dev.sh status` to check service health
3. Use service-specific commands: `logs celery`, `restart flower`
4. Run migrations after model changes: `./scripts/docker/dev.sh migrate`

### Production
1. Always use versioned releases: `0.1.0`, `0.2.0`, etc.
2. Use `--no-cache` for clean builds after dependency changes
3. Keep `.env` secure and never commit it
4. Use digest-based deployments for immutability
5. Test locally before production deployment

### SecretVM
1. Always update digest after building new images
2. Use `secretvm-deploy.sh prepare` to generate secure passwords
3. Test deployment with `secretvm-deploy.sh test`
4. Monitor services via Traefik dashboard

## Troubleshooting

### Build Issues
```bash
# Clean rebuild
./scripts/docker/build-push-cpu.sh --no-cache 0.1.0

# Check Docker space
docker system df
docker system prune -a
```

### Development Issues
```bash
# Restart problematic service
./scripts/docker/dev.sh restart celery

# Check logs
./scripts/docker/dev.sh logs celery

# Full reset
./scripts/docker/dev.sh clean
./scripts/docker/dev.sh up
```

### Production Issues
```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f

# Update and restart
docker compose pull
docker compose up -d
```

### SecretVM Issues
```bash
# Test connectivity
./scripts/docker/secretvm-deploy.sh test

# Check specific service
curl -k https://api.harystyles.store/health
curl -k https://flower.harystyles.store
```

## File Structure

```
backend/
├── docker-compose.dev.yml         # Development environment
├── docker-compose.yml             # Production environment
├── docker-compose.secretvm.yml    # SecretVM with Traefik
├── Dockerfile.dev                 # Development Dockerfile
├── Dockerfile.cpu                 # Production CPU-optimized
├── scripts/docker/
│   ├── dev.sh                     # Development management
│   ├── deploy-cpu.sh              # Complete deployment
│   ├── build-push-cpu.sh          # Build and push CPU image
│   ├── update-digests.sh          # Update compose digests
│   ├── secretvm-deploy.sh         # SecretVM deployment
│   └── entrypoint-prod.sh         # Production entrypoint
├── deploy/
│   ├── cpu-image-info.json        # Build metadata
│   └── secretvm/
│       └── .env                   # SecretVM environment
└── docs/
    └── DEPLOYMENT_CPU.md          # This file
```

## Security Notes

1. **Never commit secrets**: Use `.env` files that are gitignored
2. **Use strong passwords**: Generate with `openssl rand -base64 32`
3. **Secure Flower**: Production Flower should use strong auth
4. **CORS configuration**: Set proper origins in production
5. **Container security**: Images run as non-root user in production

## Performance Tips

1. **CPU optimization**: Images use CPU-optimized PyTorch
2. **Celery workers**: Adjust `--concurrency` based on CPU cores
3. **Database**: Tune PostgreSQL for your workload
4. **Redis**: Configure max memory and eviction policies
5. **Vector DB**: Tune Qdrant for your vector dimensions

## Support

For issues:
1. Check service logs: `./scripts/docker/dev.sh logs [service]`
2. Verify service status: `./scripts/docker/dev.sh status`
3. Review this documentation
4. Check project README for additional troubleshooting