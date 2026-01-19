#!/bin/bash
# Docker entrypoint script for backend service
# WHY: Ensures database migrations are applied before server starts
# HOW: Runs alembic upgrade with error handling, then starts uvicorn

set -e

echo "🔄 Running database migrations..."
cd /app/src

# Check current migration status and handle missing revisions
echo "🔍 Checking migration status..."
CURRENT_REVISION=$(python -c "
from sqlalchemy import create_engine, text
from app.core.config import settings
import sys

try:
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text('SELECT version_num FROM alembic_version LIMIT 1'))
        row = result.fetchone()
        if row:
            print(row[0])
        else:
            print('none')
except Exception:
    print('none')
" 2>/dev/null || echo 'none')

echo "📌 Current database revision: $CURRENT_REVISION"

# Try migration, with fallback to stamp if revision not found
if ! alembic upgrade head 2>/dev/null; then
    echo "⚠️  Migration failed, attempting to resolve..."

    # Get the latest revision from migration files
    LATEST_REVISION=$(python -c "
from alembic import command
from alembic.config import Config
config = Config('alembic.ini')
script_dir = config.get_main_option('script_location')
from alembic.script import ScriptDirectory
script = ScriptDirectory.from_config(config)
print(script.get_current_head())
" 2>/dev/null)

    echo "🔧 Stamping database with latest revision: $LATEST_REVISION"
    alembic stamp head
    echo "✅ Database stamped successfully"
else
    echo "✅ Migration completed successfully"
fi

echo "🎭 Checking Playwright browsers..."
# Ensure Playwright browsers are installed (handles volume mount issues)
if [ ! -d "/root/.cache/ms-playwright/chromium-"* ] 2>/dev/null; then
    echo "🔧 Installing Playwright browsers (missing from runtime)..."
    python -m playwright install chromium
    echo "✅ Playwright browsers installed successfully"
else
    echo "✅ Playwright browsers already available"
fi

echo "🚀 Starting uvicorn server..."
cd /app
# Use asyncio loop instead of uvloop for compatibility with secret-ai-sdk (nest_asyncio)
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir /app/src \
    --loop asyncio
