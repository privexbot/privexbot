# Production Migration Guide - is_default Field

## Overview
This guide covers deploying the `is_default` field migration to production and secretvm environments.

## Pre-Migration Checklist

### 1. Database Backup
```bash
# Create full database backup before migration
pg_dump -h <host> -U <user> -d <database> > backup_pre_is_default_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Test Migration in Staging
- Apply migration to staging environment first
- Test profile button visibility
- Verify new user signup creates `is_default=true` organizations

## Migration Steps

### Step 1: Apply Schema Migration
The migration file `144563994efd_add_is_default_field_to_organizations_.py` handles:
1. Add column as nullable
2. Set all existing orgs to `is_default = false`
3. Make column NOT NULL

```bash
# Apply migration
cd src && alembic upgrade head
```

### Step 2: Automatic Data Updates
**AUTOMATIC**: The enhanced `entrypoint-prod.sh` script now handles data updates automatically:
- ✅ Detects if `is_default` column exists
- ✅ Checks if data migration is needed
- ✅ Automatically marks personal organizations as default
- ✅ Uses transactions for safety
- ✅ Continues startup even if data update fails (with warnings)

**No manual intervention required** - the container startup handles everything.

### Step 3: Verify Data Integrity
```sql
-- Check that each user has exactly one default organization
SELECT created_by, COUNT(*) as default_org_count
FROM organizations
WHERE is_default = true
GROUP BY created_by
HAVING COUNT(*) != 1;
-- Should return no rows

-- Check total default organizations matches user count
SELECT
  (SELECT COUNT(DISTINCT created_by) FROM organizations) as unique_users,
  (SELECT COUNT(*) FROM organizations WHERE is_default = true) as default_orgs;
-- Numbers should match
```

## Environment-Specific Considerations

### Production Environment
- **Downtime**: Migration requires brief downtime (< 30 seconds)
- **User Impact**: Existing users won't see profile button until data update
- **Timing**: Deploy during low-traffic hours

### SecretVM Environment
- **Resource Constraints**: May have limited database resources
- **Network**: Ensure stable connection during migration
- **Monitoring**: Watch for memory/CPU spikes during data update

## Rollback Plan

If migration fails:

```bash
# Rollback schema
cd src && alembic downgrade -1

# Restore from backup if needed
psql -h <host> -U <user> -d <database> < backup_pre_is_default_YYYYMMDD_HHMMSS.sql
```

## Post-Migration Verification

### 1. Test User Flows
- New user signup: Creates `is_default=true` organization
- Profile button: Visible in personal org + default workspace
- Organization switching: Profile button hides in non-personal orgs

### 2. Check Application Health
- Frontend loads correctly
- API responses include `is_default` field
- No 500 errors in logs

### 3. Monitor Performance
- Query performance on organizations table
- API response times
- User experience feedback

## Common Issues & Solutions

### Issue: Profile Button Still Not Visible
**Cause**: Frontend cache or JWT token doesn't include updated organization data
**Solution**:
- Clear browser cache
- Force user re-login to refresh JWT
- Check API response includes `is_default: true`

### Issue: Multiple Default Organizations Per User
**Cause**: Data update script ran multiple times
**Solution**:
```sql
-- Fix duplicate defaults
WITH first_orgs AS (
  SELECT DISTINCT ON (created_by) id, created_by
  FROM organizations
  WHERE is_default = true
  ORDER BY created_by, created_at ASC
)
UPDATE organizations
SET is_default = false
WHERE is_default = true
AND id NOT IN (SELECT id FROM first_orgs);
```

### Issue: Migration Timeout
**Cause**: Large organizations table
**Solution**:
- Run during low-traffic hours
- Consider batching the data update
- Increase database connection timeout

## Deployment Command Sequence

```bash
# 1. Backup (still recommended)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Deploy new container (handles everything automatically)
docker compose pull
docker compose up -d

# The enhanced entrypoint-prod.sh now handles:
# - Schema migration (alembic upgrade head)
# - Data migration (mark personal orgs as default)
# - Verification and error handling
# - Safe startup even if data update fails

# 3. Verify deployment
docker logs <backend-container> | grep "Data update completed"
docker exec <postgres-container> psql -U $DB_USER -d $DB_NAME -c "
SELECT COUNT(*) as default_orgs FROM organizations WHERE is_default = true;"
```

**Key Improvement**: No manual data migration steps required! 🎉

## Success Criteria
- ✅ Migration completes without errors
- ✅ All existing users have one `is_default=true` organization
- ✅ New users can see profile button in personal context
- ✅ Existing users can see profile button after refresh
- ✅ No API errors related to `is_default` field
- ✅ Application performance remains stable