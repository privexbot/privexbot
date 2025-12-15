# Production Dockerfile for PrivexBot Backend
# Multi-stage build for optimized image size

# Build stage - Install dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install uv for fast dependency management
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv pip install --system -r pyproject.toml

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Install production web server
RUN pip install --no-cache-dir gunicorn uvicorn[standard]

# Copy entrypoint script
COPY scripts/docker/entrypoint-prod.sh /app/scripts/
RUN chmod +x /app/scripts/entrypoint-prod.sh

# Copy application code
COPY src/ ./src/

# Set Python path to include src directory
ENV PYTHONPATH=/app/src

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check (using curl instead of requests to avoid extra dependency)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run entrypoint script (handles migrations and starts gunicorn)
CMD ["/app/scripts/entrypoint-prod.sh"]
