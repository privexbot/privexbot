# Docker Setup Guide
## Complete Dockerized Document Processing Environment

**Version:** 1.0
**Last Updated:** 2025-12-15
**Prerequisites:** Docker 24+, Docker Compose 2.20+

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Complete docker-compose.yml](#complete-docker-composeyml)
4. [Environment Configuration](#environment-configuration)
5. [Service Dockerfiles](#service-dockerfiles)
6. [Initialization Scripts](#initialization-scripts)
7. [Deployment](#deployment)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides complete Docker configuration for the self-hosted document processing system. All services run in containers with proper networking, volume management, and health checks.

### Services Included

| Service | Image | Purpose | Ports |
|---------|-------|---------|-------|
| **backend** | Custom (FastAPI) | API server | 8000 |
| **postgres** | postgres:16-alpine | Database | 5432 |
| **redis** | redis:7-alpine | Cache, draft storage | 6379 |
| **rabbitmq** | rabbitmq:3-management | Message broker | 5672, 15672 |
| **qdrant** | qdrant/qdrant:latest | Vector database | 6333 |
| **tika-server** | apache/tika:latest-full | Document parser | 9998 |
| **celery-file-processing** | Custom (Celery) | File processing worker | - |
| **celery-embeddings** | Custom (Celery) | Embedding worker | - |
| **celery-indexing** | Custom (Celery) | Indexing worker | - |
| **flower** | Custom (Celery) | Queue monitoring | 5555 |

---

## Directory Structure

```
backend/
├── docker-compose.yml              # Production config
├── docker-compose.dev.yml          # Development config
├── .env.example                    # Environment template
├── .env                            # Actual environment (gitignored)
│
├── docker/
│   ├── backend/
│   │   ├── Dockerfile              # FastAPI image
│   │   └── entrypoint.sh           # Startup script
│   │
│   ├── celery/
│   │   ├── Dockerfile              # Celery worker image
│   │   └── entrypoint.sh           # Worker startup
│   │
│   └── init/
│       ├── 01-init-db.sh           # Database init
│       ├── 02-download-models.sh   # ML models download
│       └── 03-setup-tika.sh        # Tika config
│
├── src/
│   └── app/
│       ├── main.py
│       ├── tasks/
│       │   └── celery_worker.py
│       └── ...
│
└── volumes/                        # Persistent data (gitignored)
    ├── postgres_data/
    ├── redis_data/
    ├── rabbitmq_data/
    ├── qdrant_data/
    ├── uploads/
    └── models_cache/
```

---

## Complete docker-compose.yml

### Production Configuration

**File:** `backend/docker-compose.yml`

```yaml
version: '3.8'

services:
  # ============================================================================
  # DATABASE LAYER
  # ============================================================================

  postgres:
    image: postgres:16-alpine
    container_name: privexbot-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-privexbot}
      POSTGRES_USER: ${POSTGRES_USER:-privexbot}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=en_US.UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init/01-init-db.sh:/docker-entrypoint-initdb.d/01-init-db.sh:ro
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-privexbot}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  # ============================================================================
  # CACHE & SESSION LAYER
  # ============================================================================

  redis:
    image: redis:7-alpine
    container_name: privexbot-redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 2gb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --appendfsync everysec
    volumes:
      - redis_data:/data
    ports:
      - "${REDIS_PORT:-6379}:6379"
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  # ============================================================================
  # MESSAGE BROKER
  # ============================================================================

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: privexbot-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-admin}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
      RABBITMQ_DEFAULT_VHOST: /
      RABBITMQ_VM_MEMORY_HIGH_WATERMARK: 1GB
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
      - ./docker/rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
    ports:
      - "5672:5672"   # AMQP
      - "15672:15672" # Management UI
    networks:
      - backend
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  # ============================================================================
  # VECTOR DATABASE
  # ============================================================================

  qdrant:
    image: qdrant/qdrant:latest
    container_name: privexbot-qdrant
    restart: unless-stopped
    volumes:
      - qdrant_data:/qdrant/storage
    ports:
      - "6333:6333"
    networks:
      - backend
    environment:
      QDRANT__SERVICE__GRPC_PORT: 6334
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  # ============================================================================
  # DOCUMENT PROCESSING LAYER
  # ============================================================================

  tika-server:
    image: apache/tika:latest-full  # Includes Tesseract OCR
    container_name: privexbot-tika
    restart: unless-stopped
    ports:
      - "9998:9998"
    networks:
      - backend
    environment:
      TIKA_CONFIG: /config/tika-config.xml
      # Increase heap size for large documents
      JAVA_OPTS: >-
        -Xms2g
        -Xmx4g
        -Djava.awt.headless=true
    volumes:
      - ./docker/tika/tika-config.xml:/config/tika-config.xml:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9998/tika"]
      interval: 30s
      timeout: 10s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 6G
        reservations:
          cpus: '2'
          memory: 4G

  # ============================================================================
  # BACKEND API
  # ============================================================================

  backend:
    build:
      context: .
      dockerfile: docker/backend/Dockerfile
      args:
        PYTHON_VERSION: "3.11"
    container_name: privexbot-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      qdrant:
        condition: service_healthy
      tika-server:
        condition: service_healthy
    environment:
      # Database
      DATABASE_URL: postgresql://${POSTGRES_USER:-privexbot}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-privexbot}

      # Redis
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0

      # RabbitMQ
      CELERY_BROKER_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD}@rabbitmq:5672/
      CELERY_RESULT_BACKEND: redis://:${REDIS_PASSWORD}@redis:6379/1

      # Qdrant
      QDRANT_URL: http://qdrant:6333

      # Tika
      TIKA_URL: http://tika-server:9998

      # Application
      SECRET_KEY: ${SECRET_KEY}
      DEBUG: ${DEBUG:-false}
      BACKEND_CORS_ORIGINS: ${BACKEND_CORS_ORIGINS}
      FRONTEND_URL: ${FRONTEND_URL}

      # ML Models
      SENTENCE_TRANSFORMERS_HOME: /app/.cache/huggingface
    volumes:
      - ./src:/app/src:ro
      - uploads:/app/uploads
      - models_cache:/app/.cache/huggingface
    ports:
      - "8000:8000"
    networks:
      - backend
      - frontend
    command: >
      sh -c "
        alembic upgrade head &&
        uvicorn src.app.main:app
          --host 0.0.0.0
          --port 8000
          --workers 4
          --loop uvloop
          --log-level info
      "
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G

  # ============================================================================
  # CELERY WORKERS
  # ============================================================================

  celery-file-processing:
    build:
      context: .
      dockerfile: docker/celery/Dockerfile
    container_name: privexbot-celery-file
    restart: unless-stopped
    depends_on:
      rabbitmq:
        condition: service_healthy
      redis:
        condition: service_healthy
      tika-server:
        condition: service_healthy
    environment:
      CELERY_BROKER_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD}@rabbitmq:5672/
      CELERY_RESULT_BACKEND: redis://:${REDIS_PASSWORD}@redis:6379/1
      TIKA_URL: http://tika-server:9998
      DATABASE_URL: postgresql://${POSTGRES_USER:-privexbot}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-privexbot}
      QDRANT_URL: http://qdrant:6333
      SENTENCE_TRANSFORMERS_HOME: /app/.cache/huggingface
    volumes:
      - ./src:/app/src:ro
      - uploads:/app/uploads
      - models_cache:/app/.cache/huggingface
    networks:
      - backend
    command: >
      celery -A src.app.tasks.celery_worker worker
        --queue=high_priority,file_processing
        --loglevel=info
        --concurrency=4
        --max-tasks-per-child=50
        --prefetch-multiplier=1
        --time-limit=600
        --soft-time-limit=540
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  celery-embeddings:
    build:
      context: .
      dockerfile: docker/celery/Dockerfile
    container_name: privexbot-celery-embeddings
    restart: unless-stopped
    depends_on:
      rabbitmq:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      CELERY_BROKER_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD}@rabbitmq:5672/
      CELERY_RESULT_BACKEND: redis://:${REDIS_PASSWORD}@redis:6379/1
      SENTENCE_TRANSFORMERS_HOME: /app/.cache/huggingface
      # OpenVINO optimization
      OMP_NUM_THREADS: 4
      MKL_NUM_THREADS: 4
    volumes:
      - ./src:/app/src:ro
      - models_cache:/app/.cache/huggingface
    networks:
      - backend
    command: >
      celery -A src.app.tasks.celery_worker worker
        --queue=embeddings
        --loglevel=info
        --concurrency=2
        --max-tasks-per-child=100
        --prefetch-multiplier=1
        --time-limit=300
        --soft-time-limit=270
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G

  celery-indexing:
    build:
      context: .
      dockerfile: docker/celery/Dockerfile
    container_name: privexbot-celery-indexing
    restart: unless-stopped
    depends_on:
      rabbitmq:
        condition: service_healthy
      redis:
        condition: service_healthy
      qdrant:
        condition: service_healthy
    environment:
      CELERY_BROKER_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD}@rabbitmq:5672/
      CELERY_RESULT_BACKEND: redis://:${REDIS_PASSWORD}@redis:6379/1
      DATABASE_URL: postgresql://${POSTGRES_USER:-privexbot}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-privexbot}
      QDRANT_URL: http://qdrant:6333
    volumes:
      - ./src:/app/src:ro
    networks:
      - backend
    command: >
      celery -A src.app.tasks.celery_worker worker
        --queue=indexing
        --loglevel=info
        --concurrency=2
        --max-tasks-per-child=100
        --prefetch-multiplier=1
        --time-limit=600
        --soft-time-limit=540
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  # ============================================================================
  # MONITORING
  # ============================================================================

  flower:
    build:
      context: .
      dockerfile: docker/celery/Dockerfile
    container_name: privexbot-flower
    restart: unless-stopped
    depends_on:
      - rabbitmq
      - redis
    environment:
      CELERY_BROKER_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD}@rabbitmq:5672/
      CELERY_RESULT_BACKEND: redis://:${REDIS_PASSWORD}@redis:6379/1
      FLOWER_BASIC_AUTH: ${FLOWER_USER:-admin}:${FLOWER_PASSWORD}
    ports:
      - "5555:5555"
    networks:
      - backend
      - frontend
    command: >
      celery -A src.app.tasks.celery_worker flower
        --port=5555
        --basic_auth=${FLOWER_USER:-admin}:${FLOWER_PASSWORD}
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

# ==============================================================================
# NETWORKS
# ==============================================================================

networks:
  backend:
    driver: bridge
    internal: true  # No external access
  frontend:
    driver: bridge  # Public-facing

# ==============================================================================
# VOLUMES
# ==============================================================================

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  rabbitmq_data:
    driver: local
  qdrant_data:
    driver: local
  uploads:
    driver: local
  models_cache:
    driver: local
```

---

## Environment Configuration

### `.env` File

**File:** `backend/.env`

```bash
# ==============================================================================
# DATABASE CONFIGURATION
# ==============================================================================
POSTGRES_DB=privexbot
POSTGRES_USER=privexbot
POSTGRES_PASSWORD=your_super_secure_postgres_password_here
POSTGRES_PORT=5432

# ==============================================================================
# REDIS CONFIGURATION
# ==============================================================================
REDIS_PASSWORD=your_super_secure_redis_password_here
REDIS_PORT=6379

# ==============================================================================
# RABBITMQ CONFIGURATION
# ==============================================================================
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=your_super_secure_rabbitmq_password_here

# ==============================================================================
# APPLICATION CONFIGURATION
# ==============================================================================
SECRET_KEY=your_super_secure_secret_key_here_generate_with_openssl_rand_hex_32
DEBUG=false

# CORS Origins (comma-separated)
BACKEND_CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# ==============================================================================
# MONITORING
# ==============================================================================
FLOWER_USER=admin
FLOWER_PASSWORD=your_super_secure_flower_password_here

# ==============================================================================
# OPTIONAL: EXTERNAL SERVICES
# ==============================================================================
# SMTP for emails (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Sentry for error tracking (optional)
SENTRY_DSN=https://your_sentry_dsn_here

# ==============================================================================
# ML MODELS CONFIGURATION
# ==============================================================================
# Default embedding model
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Chunking defaults
DEFAULT_CHUNK_SIZE=512
DEFAULT_CHUNK_OVERLAP=50
```

### `.env.example` Template

**File:** `backend/.env.example`

```bash
# Copy this file to .env and fill in your values
# DO NOT commit .env to Git

POSTGRES_DB=privexbot
POSTGRES_USER=privexbot
POSTGRES_PASSWORD=changeme
POSTGRES_PORT=5432

REDIS_PASSWORD=changeme
REDIS_PORT=6379

RABBITMQ_USER=admin
RABBITMQ_PASSWORD=changeme

SECRET_KEY=changeme_generate_with_openssl_rand_hex_32
DEBUG=false

BACKEND_CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000

FLOWER_USER=admin
FLOWER_PASSWORD=changeme

EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
DEFAULT_CHUNK_SIZE=512
DEFAULT_CHUNK_OVERLAP=50
```

### Generating Secure Secrets

```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate passwords
openssl rand -base64 32

# Or use Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Service Dockerfiles

### Backend Dockerfile

**File:** `backend/docker/backend/Dockerfile`

```dockerfile
# ==============================================================================
# Stage 1: Builder
# ==============================================================================
FROM python:3.11-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libpq-dev \
    libmagic1 \
    # For PyMuPDF (if using)
    libfreetype6-dev \
    libjpeg-dev \
    libopenjp2-7-dev \
    # For Tesseract
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    # For image processing
    libpng-dev \
    libtiff-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package installer)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install Python dependencies
RUN uv sync --frozen --no-dev

# ==============================================================================
# Stage 2: Runtime
# ==============================================================================
FROM python:3.11-slim

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libpq5 \
    libmagic1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app /app/uploads /app/.cache && \
    chown -R appuser:appuser /app

# Set working directory
WORKDIR /app

# Copy Python dependencies from builder
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv

# Copy application code
COPY --chown=appuser:appuser src /app/src
COPY --chown=appuser:appuser alembic /app/alembic
COPY --chown=appuser:appuser alembic.ini /app/

# Add venv to PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app:$PYTHONPATH" \
    PYTHONUNBUFFERED=1

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "src.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Celery Worker Dockerfile

**File:** `backend/docker/celery/Dockerfile`

```dockerfile
# ==============================================================================
# Stage 1: Builder
# ==============================================================================
FROM python:3.11-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libpq-dev \
    libmagic1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    libfreetype6-dev \
    libjpeg-dev \
    libopenjp2-7-dev \
    libpng-dev \
    libtiff-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

WORKDIR /app

COPY pyproject.toml uv.lock ./

# Install dependencies with ML extras
RUN uv sync --frozen --no-dev --extra ml

# ==============================================================================
# Stage 2: Runtime
# ==============================================================================
FROM python:3.11-slim

# Install runtime dependencies + OpenVINO for CPU optimization
RUN apt-get update && apt-get install -y \
    libpq5 \
    libmagic1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    curl \
    # OpenVINO dependencies
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 celeryuser && \
    mkdir -p /app /app/uploads /app/.cache && \
    chown -R celeryuser:celeryuser /app

WORKDIR /app

# Copy Python dependencies
COPY --from=builder --chown=celeryuser:celeryuser /app/.venv /app/.venv

# Copy application code
COPY --chown=celeryuser:celeryuser src /app/src

# Add venv to PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app:$PYTHONPATH" \
    PYTHONUNBUFFERED=1 \
    # CPU optimization
    OMP_NUM_THREADS=4 \
    MKL_NUM_THREADS=4

USER celeryuser

# Default command
CMD ["celery", "-A", "src.app.tasks.celery_worker", "worker", "--loglevel=info"]
```

---

## Initialization Scripts

### Database Initialization

**File:** `backend/docker/init/01-init-db.sh`

```bash
#!/bin/bash
set -e

echo "Initializing PrivexBot database..."

# Create extensions
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable UUID support
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Enable pgvector for vector search (if needed)
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Enable full-text search
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- Enable case-insensitive text
    CREATE EXTENSION IF NOT EXISTS citext;

    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE "$POSTGRES_DB" TO "$POSTGRES_USER";
EOSQL

echo "Database initialization complete!"
```

### Model Download Script

**File:** `backend/docker/init/02-download-models.sh`

```bash
#!/bin/bash
set -e

echo "Downloading sentence-transformers models..."

MODELS_DIR="/app/.cache/huggingface"
mkdir -p "$MODELS_DIR"

# Download all-MiniLM-L6-v2 (primary model)
python3 -c "
from sentence_transformers import SentenceTransformer
import os

os.environ['SENTENCE_TRANSFORMERS_HOME'] = '$MODELS_DIR'

print('Downloading all-MiniLM-L6-v2...')
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
print('Model downloaded successfully!')

# Warm up model (first run is slower)
_ = model.encode(['test'])
print('Model warm-up complete!')
"

echo "Model download complete!"
echo "Models cached at: $MODELS_DIR"
```

### Tika Configuration

**File:** `backend/docker/tika/tika-config.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<properties>
  <parsers>
    <!-- Enable all parsers -->
    <parser class="org.apache.tika.parser.DefaultParser">
      <parser-exclude class="org.apache.tika.parser.executable.ExecutableParser"/>
    </parser>
  </parsers>

  <!-- OCR Configuration -->
  <service-loader loadErrorHandler="IGNORE"/>

  <properties>
    <!-- Tesseract OCR settings -->
    <property>
      <name>tesseract.path</name>
      <value>/usr/bin/tesseract</value>
    </property>
    <property>
      <name>tesseract.language</name>
      <value>eng</value>
    </property>
    <property>
      <name>tesseract.timeout</name>
      <value>120</value>
    </property>

    <!-- PDF settings -->
    <property>
      <name>pdfbox.extractInlineImages</name>
      <value>true</value>
    </property>
    <property>
      <name>pdfbox.sortByPosition</name>
      <value>true</value>
    </property>
  </properties>
</properties>
```

### RabbitMQ Configuration

**File:** `backend/docker/rabbitmq/rabbitmq.conf`

```conf
# Memory limits
vm_memory_high_watermark.relative = 0.6
vm_memory_high_watermark_paging_ratio = 0.75

# Disk space
disk_free_limit.relative = 2.0

# Connection limits
channel_max = 256
heartbeat = 60

# Management plugin
management.tcp.port = 15672
management.tcp.ip = 0.0.0.0

# Enable all queues to be durable
queue_master_locator = min-masters

# Log levels
log.console = true
log.console.level = info
```

---

## Deployment

### Development Deployment

```bash
# 1. Clone repository
cd /path/to/privexbot/backend

# 2. Create .env file
cp .env.example .env
# Edit .env with your values
nano .env

# 3. Start services
docker compose -f docker-compose.dev.yml up -d

# 4. Check logs
docker compose logs -f backend

# 5. Run migrations
docker compose exec backend alembic upgrade head

# 6. Download ML models (first time only)
docker compose exec celery-embeddings bash /app/docker/init/02-download-models.sh

# 7. Access services
# API: http://localhost:8000
# API Docs: http://localhost:8000/api/docs
# Flower: http://localhost:5555
# RabbitMQ UI: http://localhost:15672
```

### Production Deployment

```bash
# 1. Create production .env
cp .env.example .env
# Fill in production values

# 2. Build images
docker compose build --no-cache

# 3. Start services
docker compose up -d

# 4. Run migrations
docker compose exec backend alembic upgrade head

# 5. Download models
docker compose exec celery-embeddings bash /app/docker/init/02-download-models.sh

# 6. Verify all services healthy
docker compose ps

# 7. Check logs
docker compose logs -f

# 8. Set up monitoring (see Monitoring section)
```

### Scaling Workers

```bash
# Scale file processing workers to 5
docker compose up -d --scale celery-file-processing=5

# Scale embedding workers to 3
docker compose up -d --scale celery-embeddings=3

# Scale indexing workers to 3
docker compose up -d --scale celery-indexing=3
```

---

## Monitoring

### Health Checks

```bash
# Check all services
docker compose ps

# Check specific service health
docker inspect --format='{{.State.Health.Status}}' privexbot-backend

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' privexbot-backend
```

### Flower (Celery Monitoring)

Access Flower UI: `http://localhost:5555`

**Features:**
- Task monitoring (success/failure rates)
- Worker status and performance
- Queue depths
- Task history
- Broker statistics

**Authentication:**
```
Username: admin (from FLOWER_USER)
Password: (from FLOWER_PASSWORD)
```

### RabbitMQ Management UI

Access RabbitMQ UI: `http://localhost:15672`

**Features:**
- Queue depths and rates
- Connection monitoring
- Exchange routing
- Message rates

**Authentication:**
```
Username: admin (from RABBITMQ_USER)
Password: (from RABBITMQ_PASSWORD)
```

### Prometheus + Grafana (Optional)

Add to `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - backend

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"
    networks:
      - backend
      - frontend
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}

volumes:
  prometheus_data:
  grafana_data:
```

---

## Troubleshooting

### Common Issues

#### 1. Services Not Starting

```bash
# Check logs
docker compose logs <service-name>

# Check resource limits
docker stats

# Restart specific service
docker compose restart <service-name>
```

#### 2. Database Connection Errors

```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Test connection
docker compose exec postgres psql -U privexbot -d privexbot -c "SELECT 1"

# Reset database (CAUTION: deletes all data)
docker compose down -v
docker compose up -d postgres
```

#### 3. Celery Workers Not Processing

```bash
# Check worker logs
docker compose logs celery-file-processing

# Check RabbitMQ queues
docker compose exec rabbitmq rabbitmqctl list_queues

# Purge queue (CAUTION: deletes pending tasks)
docker compose exec rabbitmq rabbitmqctl purge_queue file_processing
```

#### 4. Out of Memory Errors

```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.yml
# Or reduce worker concurrency
```

#### 5. Tika Server Timeouts

```bash
# Increase Java heap size
# Edit docker-compose.yml:
environment:
  JAVA_OPTS: "-Xms4g -Xmx8g"

# Restart Tika
docker compose restart tika-server
```

#### 6. Model Download Failures

```bash
# Download models manually
docker compose exec celery-embeddings python3 -c "
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
"

# Check models are cached
docker compose exec celery-embeddings ls -lah /app/.cache/huggingface
```

### Cleanup

```bash
# Stop all services
docker compose down

# Stop and remove volumes (CAUTION: deletes all data)
docker compose down -v

# Remove all PrivexBot containers
docker ps -a | grep privexbot | awk '{print $1}' | xargs docker rm -f

# Remove all PrivexBot images
docker images | grep privexbot | awk '{print $3}' | xargs docker rmi -f

# Clean up Docker system (frees disk space)
docker system prune -a --volumes
```

---

## Next Steps

- **Implementation Guide**: See `03_IMPLEMENTATION_GUIDE.md` for detailed code examples
- **Performance Optimization**: See `04_PERFORMANCE_OPTIMIZATION_GUIDE.md` for tuning
- **Testing**: See `05_TESTING_AND_MONITORING_GUIDE.md` for QA strategies

---

**Document Version:** 1.0
**Last Updated:** 2025-12-15
**Status:** Ready for Deployment
**Next Document:** `03_IMPLEMENTATION_GUIDE.md`