# PrivexBot Secret VM Deployment Guide

## 🎯 Overview

This guide covers deploying PrivexBot to Secret VM infrastructure using your new `privexbot.com` domain. The deployment includes both backend API and frontend application with full Secret VM integration.

## 🏗️ Architecture Overview

### Secret VM Infrastructure
- **Primary Domain**: `privexbot.com`
- **SSL/TLS**: Custom certificates for privexbot.com
- **Load Balancer**: Traefik with automatic routing
- **Container Platform**: Docker with CPU-optimized builds

### Service Endpoints
| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `https://privexbot.com` | Main application |
| Backend API | `https://api.privexbot.com` | REST API & docs |
| PgAdmin | `https://pgadmin.privexbot.com` | Database management |
| Redis UI | `https://redis-ui.privexbot.com` | Redis monitoring |
| Flower | `https://flower.privexbot.com` | Celery task monitoring |
| Traefik | `https://traefik.privexbot.com` | Load balancer dashboard |

## 📋 Prerequisites

### 1. Domain & DNS Setup
- **Domain**: `privexbot.com` (purchased ✅)
- **DNS Records**: Configure A records pointing to Secret VM IP
- **SSL Certificates**: Obtain wildcard cert for `*.privexbot.com`

```bash
# Required DNS Records (replace with actual Secret VM IP)
privexbot.com         A    67.43.239.18
*.privexbot.com       A    67.43.239.18
```

### 2. Docker Hub Account
- **Username**: `privexbot` (must match build scripts)
- **Repository**: `privexbot/privexbot-backend`
- **Access**: Push permissions to the repository

### 3. Secret VM Access
- **Portal Access**: Secret VM Developer Portal
- **Upload Permissions**: Docker compose & environment files

## 🚀 Deployment Process

### Step 1: Build & Push Backend Image

Build the CPU-optimized backend image specifically for Secret VM:

```bash
# Navigate to backend directory
cd backend

# Build and push to Docker Hub (privexbot account)
./scripts/docker/build-push-secretvm.sh 1.0.0

# This will output the digest needed for step 2
# Example output: privexbot/privexbot-backend@sha256:abc123...
```

**⚠️ Important**: Save the image digest from the output - you'll need it for the next step.

### Step 2: Update Docker Compose Configuration

Update the image references in `docker-compose.secretvm.yml`:

```bash
# The build script will show you the exact digest to use
# Replace all image references with the new digest:

services:
  backend:
    image: privexbot/privexbot-backend@sha256:YOUR_DIGEST_HERE
  celery-worker:
    image: privexbot/privexbot-backend@sha256:YOUR_DIGEST_HERE
  celery-beat:
    image: privexbot/privexbot-backend@sha256:YOUR_DIGEST_HERE
  flower:
    image: privexbot/privexbot-backend@sha256:YOUR_DIGEST_HERE
```

### Step 3: Prepare Environment Configuration

Generate a secure environment configuration:

```bash
# Generate the .env file for Secret VM
./scripts/docker/secretvm-deploy.sh prepare

# This creates: deploy/secretvm/.env
# You MUST update this file with secure credentials
```

**⚠️ Critical Security Steps**:

Edit `deploy/secretvm/.env` and update:

```bash
# Generate strong passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
SECRET_KEY=$(openssl rand -hex 32)
PGADMIN_PASSWORD=$(openssl rand -base64 24)

# Update email configuration
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@privexbot.com

# Verify CORS origins
BACKEND_CORS_ORIGINS=https://privexbot.com,https://www.privexbot.com,https://api.privexbot.com,https://pgadmin.privexbot.com,https://redis-ui.privexbot.com,https://traefik.privexbot.com,https://flower.privexbot.com
```

### Step 4: Build Frontend (Optional)

If you need to customize the frontend build:

```bash
cd frontend

# Copy Secret VM environment config
cp .env.secretvm .env.production

# Build frontend (if hosting separately)
npm run build

# The build output will be in dist/ directory
```

**Note**: For Secret VM, you can serve the frontend as static files or deploy separately.

### Step 5: Deploy to Secret VM

#### 5.1 Get Docker Compose Content
```bash
# Show the complete docker-compose.yml content
./scripts/docker/secretvm-deploy.sh show

# Copy the entire output
```

#### 5.2 Upload to Secret VM Portal
1. **Login** to Secret VM Developer Portal
2. **Create New Project** or select existing project
3. **Paste Docker Compose Content** from step 5.1
4. **Upload Environment File**: `deploy/secretvm/.env`
5. **Upload SSL Certificates**:
   - `privexbot_com_fullchain.pem`
   - `privexbot_com_private.pem`
6. **Deploy** the application

#### 5.3 Certificate Setup
Place your SSL certificates in the Secret VM certificate directory:
```bash
# Certificates should be placed at:
/mnt/secure/cert/privexbot_com_fullchain.pem
/mnt/secure/cert/privexbot_com_private.pem
```

### Step 6: Verify Deployment

Test all endpoints:

```bash
# Run the comprehensive test suite
./scripts/docker/secretvm-deploy.sh test

# This will test all services:
# ✓ Backend API health
# ✓ Backend API status
# ✓ PgAdmin accessibility
# ✓ Redis UI accessibility
# ✓ Traefik dashboard
```

Expected output:
```
Testing Backend API health... ✓
Testing Backend API status... ✓
Testing PgAdmin... ✓ Accessible
Testing Redis UI... ✓ Accessible
Testing Traefik Dashboard... ✓ Accessible
```

## 🔧 Configuration Details

### Backend Configuration
- **Framework**: FastAPI with CPU-optimized PyTorch
- **Database**: PostgreSQL with pgvector extension
- **Cache**: Redis for sessions and drafts
- **Vector DB**: Qdrant for knowledge base embeddings
- **Tasks**: Celery with Redis broker
- **Monitoring**: Flower for task monitoring

### Frontend Configuration
- **Framework**: React 19 + TypeScript + Vite
- **API**: Connects to `https://api.privexbot.com/api/v1`
- **Build**: Production build with environment variables baked in
- **Routing**: React Router with proper CORS setup

### Security Features
- **SSL/TLS**: Full end-to-end encryption
- **CORS**: Properly configured for all subdomains
- **Authentication**: JWT + wallet-based auth
- **Network**: DNS configuration for reliable email delivery
- **Secrets**: Strong password generation and secure storage

## 🔍 Monitoring & Maintenance

### Health Endpoints
- **Backend Health**: `https://api.privexbot.com/health`
- **API Status**: `https://api.privexbot.com/api/v1/status`
- **API Documentation**: `https://api.privexbot.com/api/docs`

### Admin Interfaces
- **Database**: `https://pgladmin.privexbot.com` (credentials from .env)
- **Cache**: `https://redis-ui.privexbot.com`
- **Tasks**: `https://flower.privexbot.com` (username: admin, password from .env)
- **Load Balancer**: `https://traefik.privexbot.com`

### Logs & Debugging
```bash
# View container logs (from Secret VM portal or SSH)
docker compose logs -f backend
docker compose logs -f celery-worker
docker compose logs -f postgres
```

## 📝 Troubleshooting

### Common Issues

#### 1. SSL Certificate Problems
```bash
# Verify certificate files exist and have correct names
ls -la /mnt/secure/cert/privexbot_com*

# Check certificate validity
openssl x509 -in /mnt/secure/cert/privexbot_com_fullchain.pem -text -noout
```

#### 2. Backend Health Check Failures
```bash
# Check if backend is responding
curl -k https://api.privexbot.com/health

# Check container status
docker compose ps

# View backend logs
docker compose logs backend
```

#### 3. Database Connection Issues
```bash
# Test database connectivity
docker compose exec backend python -c "
from app.db.session import get_db
print('Database connection: OK')
"

# Check PostgreSQL logs
docker compose logs postgres
```

#### 4. Email Delivery Problems
The enhanced email service includes automatic retry and fallback:
- **Multiple SMTP ports**: 587 (TLS), 465 (SSL), 25, 2525
- **DNS configuration**: Google DNS + Cloudflare for reliability
- **Retry logic**: Exponential backoff on network failures

### Emergency Rollback
```bash
# If deployment fails, you can quickly rollback by:
# 1. Reverting to previous image digest in docker-compose.secretvm.yml
# 2. Redeploying through Secret VM portal
# 3. The previous version should restore automatically
```

## 🎯 Post-Deployment Checklist

- [ ] All services responding to health checks
- [ ] Frontend loading correctly at `https://privexbot.com`
- [ ] Backend API accessible at `https://api.privexbot.com`
- [ ] Database migrations completed successfully
- [ ] Email delivery working (test with password reset)
- [ ] SSL certificates valid for all subdomains
- [ ] Admin interfaces accessible with correct credentials
- [ ] Celery workers processing tasks (check Flower)
- [ ] DNS propagation completed worldwide

## 🔄 Updates & Maintenance

### Updating the Application
1. **Build new image**: `./scripts/docker/build-push-secretvm.sh 1.1.0`
2. **Update digest**: Replace in `docker-compose.secretvm.yml`
3. **Deploy**: Through Secret VM portal
4. **Test**: Run verification script

### Backup Strategy
- **Database**: PostgreSQL automatic backups via Secret VM
- **Environment**: Keep `deploy/secretvm/.env` in secure location
- **Certificates**: Backup SSL certificates before expiry
- **Code**: Git repository serves as code backup

## 🆘 Support & Resources

### Documentation Links
- **Secret VM Portal**: [Insert Secret VM portal URL]
- **PrivexBot Docs**: `https://api.privexbot.com/api/docs`
- **Docker Hub**: `https://hub.docker.com/r/privexbot/privexbot-backend`

### Contact Information
- **Technical Support**: [Your support email]
- **Emergency Contact**: [Emergency contact info]
- **Development Team**: [Team contact info]

---

**Last Updated**: December 15, 2024
**Document Version**: 1.0.0
**Target Deployment**: Secret VM with privexbot.com domain