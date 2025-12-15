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

# Install Playwright browsers (required for web scraping)
RUN python -m playwright install chromium
RUN python -m playwright install-deps

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies (including Playwright and crawl4ai system dependencies)
RUN apt-get update && apt-get install -y \
    # Core dependencies
    libpq5 \
    curl \
    ca-certificates \
    # Playwright browser dependencies (complete set for chromium)
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    # Additional dependencies for crawl4ai and web scraping
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
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

# Create non-root user and set up Playwright browsers
RUN useradd -m -u 1000 appuser

# Copy Playwright browsers from builder and ensure correct ownership
COPY --from=builder /root/.cache/ms-playwright /home/appuser/.cache/ms-playwright

# Change ownership of all app files to appuser
RUN chown -R appuser:appuser /app /home/appuser/.cache

# Set Playwright browsers path for non-root user
ENV PLAYWRIGHT_BROWSERS_PATH=/home/appuser/.cache/ms-playwright

USER appuser

# Expose port
EXPOSE 8000

# Health check (using curl instead of requests to avoid extra dependency)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run entrypoint script (handles migrations and starts gunicorn)
CMD ["/app/scripts/entrypoint-prod.sh"]
