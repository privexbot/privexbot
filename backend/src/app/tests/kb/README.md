# KB API Comprehensive Test Suite

This directory contains comprehensive tests for all Knowledge Base API endpoints.

## Test Structure

```
kb/
├── README.md                           # This file - Quick start guide
├── test_comprehensive_kb_api.py        # Complete endpoint testing (25+ endpoints)
├── test_quick_document_crud.py         # Quick validation of fixes
├── test_kb_inspection_and_crud.py      # Existing KB inspection tests
└── __init__.py                         # Python package marker
```

## Quick Start Guide

### Prerequisites

Ensure the development environment is running:

```bash
# Start all services
docker compose -f docker-compose.dev.yml up -d

# Verify services are healthy
docker compose -f docker-compose.dev.yml ps
```

**Required Services:**
- ✅ Backend API (localhost:8000)
- ✅ PostgreSQL (localhost:5434)
- ✅ Redis (localhost:6380)
- ✅ Qdrant (localhost:6335)
- ✅ Celery Worker (background processing)

### Running Tests

#### 1. Quick Validation Test (2-3 minutes)

Tests document CRUD operations and basic functionality:

```bash
cd /app/src
python -m app.tests.kb.test_quick_document_crud
```

**What it tests:**
- Authentication flow
- KB draft creation
- Document CRUD operations (create, update, delete)
- Pipeline monitoring basics

#### 2. Comprehensive API Test (10-15 minutes)

Tests ALL KB endpoints including previously missing ones:

```bash
cd /app/src
python -m app.tests.kb.test_comprehensive_kb_api
```

**What it tests:**
- All 25+ KB API endpoints
- Draft inspection endpoints (pages, chunks)
- KB inspection endpoints (documents, chunks)
- Document CRUD operations
- Pipeline monitoring (status, logs, cancellation)
- Multi-page scraping (Uniswap docs, 25 pages)
- Data consistency verification
- Error handling and edge cases

#### 3. Existing Pytest Integration Tests

Run traditional pytest-based tests:

```bash
cd /app/src
pytest app/tests/kb/ -v
```

### Test Configuration

#### Environment Variables

The comprehensive tests use these configurations:

```python
# Test Configuration
BASE_URL = "http://localhost:8000"
TARGET_URL = "https://docs.uniswap.org/concepts/overview"  # Test scraping target
MAX_PAGES = 25                                            # Pages to scrape
TEST_TIMEOUT = 300                                        # 5 minutes max per test
```

#### Customizing Tests

**Change Target URL:**
```python
# Edit test_comprehensive_kb_api.py
TARGET_URL = "https://your-docs-site.com"
MAX_PAGES = 10  # Adjust for your site
```

**Modify Timeout:**
```python
TEST_TIMEOUT = 600  # 10 minutes for larger sites
```

## Test Results and Reporting

### Comprehensive Test Output

The comprehensive test generates detailed reports:

```bash
====================================================================================================
🧪 COMPLETE KB API COMPREHENSIVE TEST SUITE
🎯 Target URL: https://docs.uniswap.org/concepts/overview
📄 Max Pages: 25
⏰ Timeout: 300s
====================================================================================================

# Real-time progress logging
[04:34:15] INFO: POST /auth/email/signup -> 201
[04:34:15] INFO: ✓ Signed up successfully as uniswap_tester_1763523255
...

# Final summary
📊 COMPREHENSIVE TEST RESULTS SUMMARY
🎯 Overall Results:
   ✅ Passed: 6/6 tests
   📈 Success Rate: 100%
   🆔 Final KB ID: f991e6a7-f282-415e-9b3e-85e4fd23a119
```

### Interpreting Results

**Success Indicators:**
- ✅ `Success Rate: 100%` - All endpoints working
- ✅ `KB ID: uuid` - Knowledge base created successfully
- ✅ `Pipeline: completed` - Background processing finished

**Common Issues:**
- ❌ `Pipeline: stuck at 10%` - Playwright browsers not installed
- ❌ `Document CRUD: FAIL` - Schema mismatch (fixed)
- ❌ `Pipeline: 404 Error` - Wrong endpoint paths (fixed)

## Troubleshooting

### Common Issues and Fixes

#### 1. Pipeline Stuck at 10%
```bash
# Install Playwright browsers
docker compose -f docker-compose.dev.yml exec celery-worker playwright install
docker compose -f docker-compose.dev.yml exec celery-worker playwright install-deps
```

#### 2. Connection Refused
```bash
# Check services are running
docker compose -f docker-compose.dev.yml ps

# Restart if needed
docker compose -f docker-compose.dev.yml restart
```

#### 3. Database Issues
```bash
# Check PostgreSQL logs
docker compose -f docker-compose.dev.yml logs postgres

# Reset database if needed
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
```

#### 4. Authentication Failures
```bash
# Check backend logs
docker compose -f docker-compose.dev.yml logs backend-dev

# Common issue: Database not ready during startup
```

### Debug Mode

Enable detailed logging by modifying the test:

```python
# In test_comprehensive_kb_api.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Performance Tuning

**For Faster Tests:**
- Reduce `MAX_PAGES` to 5-10
- Use simpler test URLs (e.g., `https://httpbin.org/json`)
- Skip certain test categories

**For Comprehensive Coverage:**
- Increase `TEST_TIMEOUT` for large sites
- Test with multiple different URLs
- Enable all edge case tests

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Run KB API Tests
  run: |
    docker compose -f docker-compose.dev.yml up -d
    docker compose -f docker-compose.dev.yml exec -T backend-dev python -m app.tests.kb.test_comprehensive_kb_api
```

### Local Development

Add to your development workflow:

```bash
# Before committing KB changes
./scripts/docker/dev.sh test  # Run quick tests
python -m app.tests.kb.test_comprehensive_kb_api  # Full validation
```

## Contributing

When adding new KB endpoints:

1. **Add test cases** to `test_comprehensive_kb_api.py`
2. **Update the client class** with new methods
3. **Document the endpoint** in the comprehensive test results
4. **Verify** all tests still pass
5. **Update** this README if needed

### Test Client Pattern

```python
def test_new_endpoint(self, kb_id: str) -> bool:
    \"\"\"Test new KB endpoint\"\"\"
    response = self._make_request("GET", f"/new-endpoint/{kb_id}")
    if response.status_code == 200:
        self._log(f"✓ New endpoint working")
        return True
    else:
        self._log(f"⚠ New endpoint failed: {response.status_code}", "WARNING")
        return False
```

## Documentation References

- **API Guide**: `/docs/KB_API_TESTING_GUIDE.md`
- **Test Results**: `/docs/KB_API_COMPREHENSIVE_TEST_RESULTS.md`
- **Analysis Report**: `/KB_API_COMPLETE_ANALYSIS_REPORT.md`
- **Architecture**: `/CLAUDE.md` (KB section)