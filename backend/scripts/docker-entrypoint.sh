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

# Run migrations. Only fall back to stamp if the error is a missing revision
# (i.e., DB has an old revision ID not found in migration files — not a fresh DB).
MIGRATION_OUTPUT=$(alembic upgrade head 2>&1)
MIGRATION_EXIT=$?

if [ $MIGRATION_EXIT -ne 0 ]; then
    echo "⚠️  Migration output:"
    echo "$MIGRATION_OUTPUT"

    # Only stamp if Alembic reports a missing revision (not a schema/table error)
    if echo "$MIGRATION_OUTPUT" | grep -q "Can't locate revision"; then
        LATEST_REVISION=$(python -c "
from alembic.config import Config
from alembic.script import ScriptDirectory
config = Config('alembic.ini')
script = ScriptDirectory.from_config(config)
print(script.get_current_head())
" 2>/dev/null)
        echo "🔧 Unknown revision in DB — stamping to head: $LATEST_REVISION"
        alembic stamp head
        echo "✅ Database stamped. Re-running upgrade..."
        alembic upgrade head
    else
        echo "❌ Migration failed with a real error. Fix the issue before starting the server."
        exit 1
    fi
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
