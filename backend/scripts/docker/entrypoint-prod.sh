#!/bin/bash
# Production entrypoint script for backend service
# WHY: Ensures database migrations are applied before server starts
# HOW: Runs alembic upgrade, then starts gunicorn with multiple workers

set -e  # Exit on error

echo "🔄 Running database migrations..."
echo "📍 Working directory: $(pwd)"
echo "🔗 DATABASE_URL check..."

# Test database connection before running migrations
# Stay in /app (working directory) and use PYTHONPATH=/app/src

# Simple environment check without importing config.py
# WHY: Avoid pydantic dependency issues in entrypoint
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "💡 Check that usr/.env file exists and is loaded by docker-compose"
    exit 1
fi

if [ -z "$SECRET_KEY" ]; then
    echo "❌ ERROR: SECRET_KEY environment variable not set"
    exit 1
fi

# Show masked DATABASE_URL for verification
masked_db=$(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/user:****@/')
echo "✅ DATABASE_URL: $masked_db"
echo "✅ ENVIRONMENT: ${ENVIRONMENT:-production}"
echo "✅ SECRET_KEY: ${SECRET_KEY:0:10}***"

# Test database connection using environment variable directly
echo "🔌 Testing database connection..."
python -c "
import os
from sqlalchemy import create_engine, text
import sys

try:
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('❌ DATABASE_URL not available to Python')
        print('⚠️ WARNING: Cannot verify database connection without DATABASE_URL')
        sys.exit(1)  # This is critical - cannot proceed without DATABASE_URL

    engine = create_engine(database_url)
    with engine.connect() as conn:
        result = conn.execute(text('SELECT 1'))
        print('✅ Database connection successful')
except Exception as e:
    print('⚠️ Database connection failed:', str(e))
    print('💡 Possible issues:')
    print('   1. PostgreSQL container not ready (check: docker ps)')
    print('   2. Wrong password in DATABASE_URL')
    print('   3. Database does not exist')
    print('   4. Network issue between containers')
    print('🔄 Will retry during migration phase...')
    # Continue instead of exit - Alembic will handle connection retry
" || exit 1

# Check and enable pgvector extension
echo "🧮 Checking pgvector extension..."
python -c "
import os
from sqlalchemy import create_engine, text
import sys

try:
    database_url = os.getenv('DATABASE_URL')
    engine = create_engine(database_url)
    with engine.connect() as conn:
        # Check if pgvector extension exists
        result = conn.execute(text(
            'SELECT 1 FROM pg_available_extensions WHERE name = \\'vector\\''
        ))
        extension_available = result.fetchone() is not None

        if not extension_available:
            print('❌ pgvector extension not available in this PostgreSQL instance')
            print('💡 Ensure you are using pgvector/pgvector Docker image')
            sys.exit(1)

        # Check if pgvector extension is enabled
        result = conn.execute(text(
            'SELECT 1 FROM pg_extension WHERE extname = \\'vector\\''
        ))
        extension_enabled = result.fetchone() is not None

        if extension_enabled:
            print('✅ pgvector extension is enabled')
        else:
            print('🔧 Enabling pgvector extension...')
            try:
                conn.execute(text('CREATE EXTENSION IF NOT EXISTS vector'))
                conn.commit()
                print('✅ pgvector extension enabled successfully')
            except Exception as e:
                print('❌ Failed to enable pgvector extension:', str(e))
                print('💡 Check database permissions or contact administrator')
                sys.exit(1)

except Exception as e:
    print('⚠️  Could not check pgvector extension:', str(e))
    print('🔄 Will attempt migration anyway...')
" || exit 1

# Check current migration status
echo "🔍 Checking current migration status..."
# Run from /app/src for Alembic (needs to be in same dir as alembic.ini)
cd /app/src
python -c "
import os
from sqlalchemy import create_engine, text, inspect
import sys

try:
    database_url = os.getenv('DATABASE_URL')
    engine = create_engine(database_url)
    inspector = inspect(engine)

    # Check if alembic_version table exists
    if 'alembic_version' in inspector.get_table_names():
        with engine.connect() as conn:
            result = conn.execute(text('SELECT version_num FROM alembic_version'))
            version = result.fetchone()
            if version:
                print('📌 Current migration:', version[0])
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
    print('⚠️  Could not check migration status:', str(e))
    print('🔄 Will attempt migration anyway...')
    sys.exit(0)
"

MIGRATION_CHECK_EXIT=$?

# Advanced migration validation and auto-fixing
echo "🔧 Validating migration integrity..."
python -c "
import os
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.environment import EnvironmentContext
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, text, inspect
import sys

try:
    database_url = os.getenv('DATABASE_URL')
    engine = create_engine(database_url)

    # Initialize Alembic config
    alembic_cfg = Config('alembic.ini')
    script_dir = ScriptDirectory.from_config(alembic_cfg)

    # Get current database state
    with engine.connect() as conn:
        migration_ctx = MigrationContext.configure(conn)
        current_rev = migration_ctx.get_current_revision()

    # Check 1: Multiple heads (duplicate migrations)
    heads = script_dir.get_heads()
    if len(heads) > 1:
        print('⚠️  WARNING: Multiple migration heads detected:', heads)
        print('🔧 Auto-merging migration branches...')
        try:
            # Create merge migration
            from alembic.command import merge
            merge(alembic_cfg, message='Auto-merge duplicate migrations', head_only=True)
            print('✅ Migration branches merged successfully')
        except Exception as merge_error:
            print('❌ Could not auto-merge:', str(merge_error))
            print('💡 Manual intervention may be required')
            # Continue anyway - often migrations can still proceed

    # Check 2: Schema drift detection (minimal)
    inspector = inspect(engine)
    actual_tables = set(inspector.get_table_names())

    # Expected core tables (minimal check)
    expected_core_tables = {'users', 'organizations', 'workspaces', 'knowledge_bases'}

    # Check if we have any core tables
    if actual_tables.intersection(expected_core_tables):
        missing_core = expected_core_tables - actual_tables
        if missing_core and current_rev:
            print('⚠️  WARNING: Missing expected tables:', missing_core)
            print('💡 This suggests schema drift or incomplete migration')
            # Don't fail - let Alembic handle it

    # Check 3: Migration chain integrity
    try:
        # Verify we can reach current revision from base
        if current_rev:
            revisions = script_dir.walk_revisions(base='base', head=current_rev)
            revision_list = list(revisions)
            print('✅ Migration chain verified:', len(revision_list), 'revisions')
        else:
            print('📌 No current revision - fresh database detected')
    except Exception as chain_error:
        print('⚠️  Migration chain issue:', str(chain_error))
        print('💡 Will attempt migration anyway...')

    # Check 4: Orphaned alembic_version
    if current_rev and 'alembic_version' in actual_tables:
        try:
            # Verify the revision exists in our migration scripts
            script_dir.get_revision(current_rev)
            print('✅ Current revision', current_rev, 'is valid')
        except Exception:
            print('❌ Current revision', current_rev, 'not found in migration scripts')
            print('🔧 This suggests outdated migration scripts or database from different branch')
            # Reset to head as recovery
            try:
                with engine.connect() as conn:
                    conn.execute(text('DELETE FROM alembic_version'))
                    conn.commit()
                print('✅ Reset alembic_version for clean migration')
            except Exception as reset_error:
                print('⚠️  Could not reset alembic_version:', str(reset_error))

except Exception as e:
    print('⚠️  Migration validation failed:', str(e))
    print('🔄 Will proceed with standard migration...')

print('✅ Migration validation completed')
" || echo "⚠️  Migration validation had issues, continuing..."

MIGRATION_CHECK_EXIT=$?

# If exit code is 2, stamp the database instead of running migration
if [ $MIGRATION_CHECK_EXIT -eq 2 ]; then
    echo "🔧 Stamping database with current migration version..."
    # Ensure we're in the correct directory for Alembic
    cd /app/src
    # Get latest revision dynamically instead of hardcoding
    LATEST_REVISION=$(python -c "
from alembic.config import Config
from alembic.script import ScriptDirectory
config = Config('alembic.ini')
script = ScriptDirectory.from_config(config)
print(script.get_current_head())
" 2>/dev/null || echo "b1a30eec0e64")

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
    # Apply database migrations with timeout and progress tracking
    echo "📦 Applying database migrations..."

    # Ensure we're in the correct directory for Alembic
    cd /app/src
    # Run migration with timeout and detailed logging
    echo "⏱️  Starting alembic upgrade head (with 10-minute timeout)..."

    # Set connection pool settings for migration stability
    export ALEMBIC_CONFIG_pool_size=5
    export ALEMBIC_CONFIG_pool_recycle=300
    export ALEMBIC_CONFIG_pool_pre_ping=true

    # Use timeout command to prevent hangs and capture all output
    timeout 600 alembic upgrade head 2>&1 || MIGRATION_EXIT=$?
    MIGRATION_EXIT=${MIGRATION_EXIT:-0}

    if [ $MIGRATION_EXIT -eq 124 ]; then
        echo "❌ ERROR: Migration timed out after 10 minutes"
        echo "💡 This suggests a complex migration or database lock"
        echo "💡 Check database connections and try restarting services"
        exit 1
    fi

    if [ $MIGRATION_EXIT -ne 0 ]; then
        echo "❌ ERROR: Migration failed with exit code $MIGRATION_EXIT"
        echo "💡 Check the error output above for details"
        exit 1
    fi

    echo "✅ Database migrations completed successfully"
fi

# Step: Comprehensive column validation and auto-management
echo "🔧 Validating critical database columns..."
python -c "
import os
from sqlalchemy import create_engine, text, inspect
import sys

try:
    database_url = os.getenv('DATABASE_URL')
    engine = create_engine(database_url)
    inspector = inspect(engine)

    # Define critical columns that must exist for proper operation
    critical_columns = {
        'users': {
            'is_active': {'type': 'boolean', 'default': True, 'nullable': False},
        },
        'organizations': {
            'is_default': {'type': 'boolean', 'default': False, 'nullable': False},
            'settings': {'type': 'jsonb', 'default': '{}', 'nullable': False},
        },
        'workspaces': {
            'is_default': {'type': 'boolean', 'default': False, 'nullable': False},
            'settings': {'type': 'jsonb', 'default': '{}', 'nullable': False},
        },
        'chunks': {
            'embedding': {'type': 'vector', 'dimensions': 384, 'nullable': True},
            'is_enabled': {'type': 'boolean', 'default': True, 'nullable': False},
            'is_edited': {'type': 'boolean', 'default': False, 'nullable': False},
        },
        'knowledge_bases': {
            'status': {'type': 'character varying', 'nullable': False},
            'indexing_method': {'type': 'character varying', 'default': 'high_quality', 'nullable': False},
            'reindex_required': {'type': 'boolean', 'default': False, 'nullable': False},
        },
        'documents': {
            'status': {'type': 'character varying', 'nullable': False},
            'is_enabled': {'type': 'boolean', 'default': True, 'nullable': False},
            'is_archived': {'type': 'boolean', 'default': False, 'nullable': False},
        }
    }

    missing_columns = []
    tables_to_check = inspector.get_table_names()

    with engine.connect() as conn:
        for table_name, columns in critical_columns.items():
            if table_name not in tables_to_check:
                print('⚠️  Table', table_name, 'does not exist - will be created by migration')
                continue

            # Get existing columns for this table
            existing_columns = {}
            for col in inspector.get_columns(table_name):
                existing_columns[col['name']] = col

            for column_name, expected_props in columns.items():
                if column_name not in existing_columns:
                    missing_columns.append((table_name, column_name, expected_props))
                    print('❌ Missing column:', table_name + '.' + column_name)
                else:
                    print('✅ Column exists:', table_name + '.' + column_name)

        # Auto-add missing columns (conservative approach)
        if missing_columns:
            print('🔧 Found', len(missing_columns), 'missing critical columns')
            for table_name, column_name, props in missing_columns:
                try:
                    # Construct ALTER TABLE statement based on column type
                    if props['type'] == 'boolean':
                        default_val = 'TRUE' if props.get('default') else 'FALSE'
                        nullable = 'NOT NULL' if not props.get('nullable', True) else 'NULL'
                        alter_sql = 'ALTER TABLE ' + table_name + ' ADD COLUMN IF NOT EXISTS ' + column_name + ' BOOLEAN DEFAULT ' + default_val + ' ' + nullable
                    elif props['type'] == 'jsonb':
                        default_val = props.get('default', '{}')
                        nullable = 'NOT NULL' if not props.get('nullable', True) else ''
                        alter_sql = 'ALTER TABLE ' + table_name + ' ADD COLUMN IF NOT EXISTS ' + column_name + ' JSONB DEFAULT \\'' + default_val + '\\'::jsonb ' + nullable
                    elif props['type'] == 'vector':
                        dims = props.get('dimensions', 384)
                        alter_sql = 'ALTER TABLE ' + table_name + ' ADD COLUMN IF NOT EXISTS ' + column_name + ' vector(' + str(dims) + ')'
                    elif props['type'] == 'character varying':
                        default_val = '\\'' + str(props.get('default', '')) + '\\'' if props.get('default') else 'NULL'
                        nullable = 'NOT NULL' if not props.get('nullable', True) else 'NULL'
                        alter_sql = 'ALTER TABLE ' + table_name + ' ADD COLUMN IF NOT EXISTS ' + column_name + ' VARCHAR(255) DEFAULT ' + default_val + ' ' + nullable
                    else:
                        print('⚠️  Unknown column type', props.get('type'), 'for', table_name + '.' + column_name)
                        continue

                    print('🔧 Adding column:', alter_sql)
                    conn.execute(text(alter_sql))
                    conn.commit()
                    print('✅ Added column:', table_name + '.' + column_name)

                except Exception as e:
                    print('⚠️  Could not add column', table_name + '.' + column_name + ':', str(e))
                    print('💡 This column will be handled by migration scripts')

        else:
            print('✅ All critical columns exist')

except Exception as e:
    print('⚠️  Column validation failed:', str(e))
    print('🔄 Will proceed with migration anyway...')

print('✅ Column validation completed')
" || echo "⚠️  Column validation had issues, continuing..."

# Step: Check and apply data migrations for new features
echo "🔍 Checking for required data updates..."

DATA_UPDATE_RESULT=$(python -c "
import os
from sqlalchemy import create_engine, text

try:
    database_url = os.getenv('DATABASE_URL')
    engine = create_engine(database_url)
    with engine.connect() as conn:
        # Check organizations is_default column
        result = conn.execute(text(\"\"\"
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'organizations'
            AND column_name = 'is_default'
        \"\"\"))
        has_org_is_default = result.fetchone()[0] > 0

        # Check workspaces is_default column
        result = conn.execute(text(\"\"\"
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'workspaces'
            AND column_name = 'is_default'
        \"\"\"))
        has_workspace_is_default = result.fetchone()[0] > 0

        update_needed = False

        # Check organizations
        if has_org_is_default:
            result = conn.execute(text('SELECT COUNT(*) FROM organizations WHERE is_default = true'))
            default_orgs = result.fetchone()[0]
            if default_orgs == 0:
                update_needed = True

        # Check workspaces
        if has_workspace_is_default:
            result = conn.execute(text('SELECT COUNT(*) FROM workspaces WHERE is_default = true'))
            default_workspaces = result.fetchone()[0]
            if default_workspaces == 0:
                update_needed = True

        if update_needed:
            print('UPDATE_NEEDED')
        elif has_org_is_default or has_workspace_is_default:
            print('UP_TO_DATE')
        else:
            print('NO_COLUMN')

except Exception as e:
    print('ERROR')
" 2>/dev/null)

if [ "$DATA_UPDATE_RESULT" = "UPDATE_NEEDED" ]; then
    echo "📝 Applying data updates for is_default organizations and workspaces..."

    python -c "
import os
import sys
from sqlalchemy import create_engine, text

try:
    engine = create_engine(os.getenv('DATABASE_URL'))
    with engine.begin() as conn:  # Transaction wrapper for safety

        # Update organizations
        try:
            # Mark first organization of each user as default (personal org)
            result = conn.execute(text(\"\"\"
                WITH first_orgs AS (
                    SELECT DISTINCT ON (created_by) id, created_by
                    FROM organizations
                    WHERE created_by IS NOT NULL
                    ORDER BY created_by, created_at ASC
                )
                UPDATE organizations
                SET is_default = true
                FROM first_orgs
                WHERE organizations.id = first_orgs.id
            \"\"\"))

            # Verify organizations update
            result = conn.execute(text('SELECT COUNT(*) FROM organizations WHERE is_default = true'))
            org_defaults = result.fetchone()[0]
            print('✅ Organizations updated:', org_defaults, 'marked as default')
        except Exception as e:
            print('⚠️  Organizations update failed:', str(e))

        # Update workspaces
        try:
            # Mark first workspace of each organization as default
            result = conn.execute(text(\"\"\"
                WITH first_workspaces AS (
                    SELECT DISTINCT ON (organization_id) id, organization_id
                    FROM workspaces
                    WHERE organization_id IS NOT NULL
                    ORDER BY organization_id, created_at ASC
                )
                UPDATE workspaces
                SET is_default = true
                FROM first_workspaces
                WHERE workspaces.id = first_workspaces.id
            \"\"\"))

            # Verify workspaces update
            result = conn.execute(text('SELECT COUNT(*) FROM workspaces WHERE is_default = true'))
            workspace_defaults = result.fetchone()[0]
            print('✅ Workspaces updated:', workspace_defaults, 'marked as default')
        except Exception as e:
            print('⚠️  Workspaces update failed:', str(e))

        print('✅ Data update completed successfully')

except Exception as e:
    print('⚠️  Data update failed:', str(e))
    print('💡 This is normal for fresh databases')
    print('💡 Defaults will be set when entities are created')
" || {
        echo "❌ ERROR: Data update failed"
        echo "💡 This may affect profile button visibility for existing users"
        echo "💡 Manual fix: Run UPDATE query to mark personal organizations as default"
        # Don't exit - let the application start, but log the issue
    }

elif [ "$DATA_UPDATE_RESULT" = "UP_TO_DATE" ]; then
    echo "✅ Data is up to date - no updates needed"
elif [ "$DATA_UPDATE_RESULT" = "NO_COLUMN" ]; then
    echo "✅ No data updates needed (is_default column not present)"
else
    echo "⚠️  Could not determine data update status - continuing with startup"
fi

# Step: Run initial staff setup script
echo ""
echo "👥 Running initial staff setup..."
# Run from /app (where scripts/ is located)
cd /app
python scripts/set_initial_staff.py && echo "✅ Initial staff setup completed" || {
    echo "⚠️  Initial staff setup had issues (non-blocking, continuing...)"
    # Non-blocking: Don't exit - users may not have registered yet
    # Staff will be auto-granted on first login/signup if they match configured identifiers
}

# Step: Seed marketplace chatflow templates
# Idempotent (upsert-by-slug), safe to run on every boot.
# Non-blocking: a malformed seed must not bring the API down. But the prior
# warning was buried in the boot log — operators couldn't tell whether the
# empty marketplace was a seed failure or a deliberately-empty deployment.
# Loud failure with grep-able marker + recovery instruction.
echo ""
echo "📚 Seeding chatflow templates..."
if python scripts/seed_chatflow_templates.py 2>&1; then
    echo "✅ Chatflow templates seeded"
else
    SEED_RC=$?
    echo "❌ Chatflow template seeding FAILED (rc=$SEED_RC) — non-blocking, continuing."
    echo "   Marketplace will appear empty until staff publishes templates."
    echo "   Diagnose: docker exec \$CONTAINER python scripts/seed_chatflow_templates.py"
fi
cd /app/src

echo "🎭 Checking Playwright browsers..."
# Ensure Playwright browsers are installed (handles volume mount issues)
PLAYWRIGHT_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/app/cache/ms-playwright}"
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
# Return to working directory /app for gunicorn
cd /app

# Verify Python path and module accessibility
echo "🔍 Verifying module import before starting server..."
echo "📍 Working directory: $(pwd)"
echo "📍 PYTHONPATH: ${PYTHONPATH}"
python -c 'import sys
print("Python path:", str(sys.path[:3]) + "...")
try:
    from app.main import app
    print("✅ Successfully imported app.main:app")
except ImportError as e:
    print("❌ Import failed (ImportError):", str(e))
    print("💡 Check that all dependencies are installed and PYTHONPATH is correct")
    sys.exit(1)
except Exception as e:
    print("❌ Import failed (" + type(e).__name__ + "):", str(e))
    import traceback
    traceback.print_exc()
    sys.exit(1)
' || exit 1

# Use asyncio loop instead of uvloop for compatibility with secret-ai-sdk (nest_asyncio)
export UVICORN_LOOP=asyncio

echo "🚀 Starting gunicorn with optimized Secret VM settings..."
exec gunicorn app.main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --forwarded-allow-ips='*' \
    --access-logfile - \
    --error-logfile - \
    --timeout 120 \
    --keep-alive 2 \
    --max-requests 1000 \
    --max-requests-jitter 50