#!/bin/bash
# Production entrypoint script for backend service
# WHY: Ensures database migrations are applied before server starts
# HOW: Runs alembic upgrade, then starts gunicorn with multiple workers

set -e  # Exit on error

echo "🔄 Running database migrations..."
echo "📍 Working directory: $(pwd)"
echo "🔗 DATABASE_URL check..."

# Test database connection before running migrations
cd /app/src

# Show DATABASE_URL (mask password for security)
python -c "
from app.core.config import settings
import re
# Mask password in URL for logging
masked_url = re.sub(r'://([^:]+):([^@]+)@', r'://\1:****@', settings.DATABASE_URL)
print(f'📊 Database URL: {masked_url}')
print(f'🌍 Environment: {settings.ENVIRONMENT}')
" || {
    echo "❌ ERROR: Failed to load application settings"
    echo "💡 Check that .env file exists and DATABASE_URL is set correctly"
    exit 1
}

# Test database connection
echo "🔌 Testing database connection..."
python -c "
from sqlalchemy import create_engine, text
from app.core.config import settings
import sys

try:
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text('SELECT 1'))
        print('✅ Database connection successful')
except Exception as e:
    print(f'❌ Database connection failed: {e}')
    print('💡 Possible issues:')
    print('   1. PostgreSQL container not ready (check: docker ps)')
    print('   2. Wrong password in DATABASE_URL')
    print('   3. Database does not exist')
    print('   4. Network issue between containers')
    sys.exit(1)
" || exit 1

# Check current migration status
echo "🔍 Checking current migration status..."
python -c "
from sqlalchemy import create_engine, text, inspect
from app.core.config import settings
import sys

try:
    engine = create_engine(settings.DATABASE_URL)
    inspector = inspect(engine)

    # Check if alembic_version table exists
    if 'alembic_version' in inspector.get_table_names():
        with engine.connect() as conn:
            result = conn.execute(text('SELECT version_num FROM alembic_version'))
            version = result.fetchone()
            if version:
                print(f'📌 Current migration: {version[0]}')
            else:
                print('📌 No migration applied yet (alembic_version table is empty)')
    else:
        print('📌 Fresh database (no alembic_version table)')

    # Check if our target tables exist
    tables = inspector.get_table_names()
    if 'users' in tables and 'auth_identities' in tables:
        print('⚠️  WARNING: Target tables already exist!')
        print('💡 This might cause migration to fail. Checking if we need to stamp...')

        # If tables exist but no alembic version, we need to stamp
        if 'alembic_version' not in inspector.get_table_names():
            print('🔧 Tables exist but no alembic_version - will attempt to stamp database')
            sys.exit(2)  # Special exit code for stamp needed
        elif 'alembic_version' in inspector.get_table_names():
            with engine.connect() as conn:
                result = conn.execute(text('SELECT version_num FROM alembic_version'))
                version = result.fetchone()
                if not version:
                    print('🔧 Tables exist but alembic_version is empty - will attempt to stamp database')
                    sys.exit(2)  # Special exit code for stamp needed

except Exception as e:
    print(f'⚠️  Could not check migration status: {e}')
    print('🔄 Will attempt migration anyway...')
    sys.exit(0)
"

MIGRATION_CHECK_EXIT=$?

# If exit code is 2, stamp the database instead of running migration
if [ $MIGRATION_CHECK_EXIT -eq 2 ]; then
    echo "🔧 Stamping database with current migration version..."
    # Get latest revision dynamically instead of hardcoding
    LATEST_REVISION=$(python -c "
from alembic.config import Config
from alembic.script import ScriptDirectory
config = Config('alembic.ini')
script = ScriptDirectory.from_config(config)
print(script.get_current_head())
" 2>/dev/null || echo "e5c1c1c3f41b")

    echo "📌 Using latest revision: $LATEST_REVISION"
    alembic stamp head || {
        echo "❌ ERROR: Failed to stamp database"
        echo "💡 Manual fix required. Connect to database and run:"
        echo "   CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL);"
        echo "   INSERT INTO alembic_version VALUES ('$LATEST_REVISION');"
        exit 1
    }
    echo "✅ Database stamped successfully"
else
    # Try migration with robust error handling, including missing revision detection
    echo "📦 Applying database migrations..."
    MIGRATION_OUTPUT=$(alembic upgrade head 2>&1)
    MIGRATION_EXIT=$?

    echo "$MIGRATION_OUTPUT"

    if [ $MIGRATION_EXIT -ne 0 ]; then
        echo ""
        echo "❌ ERROR: Migration failed with exit code $MIGRATION_EXIT"
        echo ""
        echo "📋 Full error output:"
        echo "$MIGRATION_OUTPUT"
        echo ""

        # Check for common error patterns with enhanced handling
        if echo "$MIGRATION_OUTPUT" | grep -q "already exists"; then
            echo "💡 DIAGNOSIS: Tables already exist"
            echo "🔧 SOLUTION: Stamping database with current version..."
            alembic stamp head && {
                echo "✅ Database stamped successfully - migrations are now in sync"
            } || {
                echo "❌ Failed to stamp database"
                echo "💡 Manual fix: Connect to postgres and run:"
                echo "   docker exec -it privexbot-postgres-secretvm psql -U privexbot -d privexbot"
                echo "   Then execute:"
                echo "   CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL);"
                echo "   DELETE FROM alembic_version;"
                # Get latest revision dynamically instead of hardcoding
                LATEST_REVISION=$(python -c "from alembic.config import Config; from alembic.script import ScriptDirectory; config = Config('alembic.ini'); script = ScriptDirectory.from_config(config); print(script.get_current_head())" 2>/dev/null || echo "e5c1c1c3f41b")
                echo "   INSERT INTO alembic_version VALUES ('$LATEST_REVISION');"
                exit 1
            }
        elif echo "$MIGRATION_OUTPUT" | grep -q "permission denied"; then
            echo "💡 DIAGNOSIS: Permission issue"
            echo "🔧 SOLUTION: Check database user has CREATE permissions"
            exit 1
        elif echo "$MIGRATION_OUTPUT" | grep -q "Can't locate revision"; then
            echo "💡 DIAGNOSIS: Migration revision not found in current codebase"
            echo "🔧 SOLUTION: Stamping database with latest revision..."
            # Get the latest revision from migration files dynamically
            LATEST_REVISION=$(python -c "
from alembic.config import Config
from alembic.script import ScriptDirectory
config = Config('alembic.ini')
script = ScriptDirectory.from_config(config)
print(script.get_current_head())
" 2>/dev/null || echo "e5c1c1c3f41b")

            echo "📌 Latest available revision: $LATEST_REVISION"
            alembic stamp head && {
                echo "✅ Database stamped successfully with revision: $LATEST_REVISION"
                echo "✅ Migrations are now in sync"
            } || {
                echo "❌ Failed to stamp database"
                echo "💡 Manual fix: Connect to postgres and run:"
                echo "   docker exec -it privexbot-postgres-secretvm psql -U privexbot -d privexbot"
                echo "   Then execute:"
                echo "   CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL);"
                echo "   DELETE FROM alembic_version;"
                echo "   INSERT INTO alembic_version VALUES ('$LATEST_REVISION');"
                exit 1
            }
        else
            echo "💡 Debugging steps:"
            echo "   1. Check migration files in alembic/versions/"
            echo "   2. Run: alembic current (to see current migration)"
            echo "   3. Run: alembic history (to see all migrations)"
            echo "   4. Check PostgreSQL logs: docker logs privexbot-postgres-secretvm"
            echo "   5. Manual inspection: docker exec -it privexbot-postgres-secretvm psql -U privexbot -d privexbot"
            exit 1
        fi
    fi

    echo "✅ Database migrations completed successfully"
fi

echo "🎭 Checking Playwright browsers..."
# Ensure Playwright browsers are installed (handles volume mount issues)
PLAYWRIGHT_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/home/appuser/.cache/ms-playwright}"
if [ ! -d "$PLAYWRIGHT_PATH/chromium-"* ] 2>/dev/null; then
    echo "🔧 Installing Playwright browsers (missing from runtime)..."
    python -m playwright install chromium || {
        echo "⚠️  Warning: Could not install Playwright browsers"
        echo "   Web scraping features may not work properly"
        echo "   To fix: Rebuild image with: ./scripts/docker/build-push-cpu.sh --no-cache"
    }
else
    echo "✅ Playwright browsers already available"
fi

echo "🚀 Starting production server with gunicorn..."
cd /app
exec gunicorn src.app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --access-logfile - \
    --error-logfile -
