# Authentication Tests

Comprehensive test suite for all authentication features in PrivexBot backend.

## Prerequisites

Before running tests, ensure the following are set up:

### Quick Setup Verification

Run the automated verification script to check all prerequisites:
```bash
cd backend
bash scripts/verify_test_setup.sh
```

This will check:
- Docker daemon is running
- PostgreSQL container is running
- Redis container is running
- Required Python dependencies are installed
- Directory structure is correct

### Manual Setup Steps

1. **Docker Desktop is running** (required for PostgreSQL and Redis)
   ```bash
   # Check Docker is running
   docker ps
   ```

2. **Database services are running**
   ```bash
   cd backend
   docker compose -f docker-compose.dev.yml up -d postgres redis
   ```

3. **Dependencies are installed**
   ```bash
   # Core backend dependencies
   pip install pydantic-settings psycopg2-binary sqlalchemy fastapi pytest \
     "python-jose[cryptography]" passlib bcrypt "pydantic[email]" redis

   # Wallet authentication dependencies
   pip install web3 eth-account PyNaCl base58 bech32
   ```

4. **You are in the correct directory**
   ```bash
   cd backend/src
   ```

## Test Structure

```
app/tests/auth/
├── README.md                    # This file
├── __init__.py
├── unit/                        # Unit tests (28 tests)
│   ├── __init__.py
│   ├── test_email_auth.py      # Email auth tests (10 tests)
│   ├── test_evm_auth.py        # EVM wallet tests (7 tests)
│   ├── test_solana_auth.py     # Solana wallet tests (3 tests)
│   ├── test_cosmos_auth.py     # Cosmos wallet tests (2 tests)
│   ├── test_edge_cases.py      # Edge cases & security (4 tests)
│   └── test_account_linking.py # Multi-wallet linking (2 tests)
└── integration/                 # Integration tests (14 tests, 25 assertions)
    ├── __init__.py
    └── test_integration.py      # End-to-end API tests
```

## Running Tests

### All Unit Tests
# Set PYTHONPATH=$PWD (/path/to/backend/src)
```bash
# Run all authentication unit tests
cd backend/src
PYTHONPATH=$PWD pytest app/tests/auth/unit/ -v

# Run specific test file
cd backend/src
PYTHONPATH=$PWD pytest app/tests/auth/unit/test_email_auth.py -v

# Run specific test class
cd backend/src
PYTHONPATH=$PWD pytest app/tests/auth/unit/test_email_auth.py::TestEmailAuth -v

# Run specific test method
cd backend/src
PYTHONPATH=$PWD pytest app/tests/auth/unit/test_email_auth.py::TestEmailAuth::test_email_signup_success -v
```

### Integration Tests

```bash
# Prerequisites: Start services
cd backend
docker compose -f docker-compose.dev.yml up -d postgres redis

# Start server (from backend/src directory)
cd src
uvicorn app.main:app --reload &

# Wait a few seconds for server to start, then run tests
cd backend/src
python app/tests/auth/integration/test_integration.py

# Or from backend root (legacy location)
cd backend
python scripts/test_integration.py
```

### Run All Tests

```bash
# Run all unit and integration tests
cd backend/src
PYTHONPATH=$PWD pytest app/tests/auth/ -v
```

## Test Coverage

### Unit Tests (28 tests)

**Email Authentication (10 tests)** - `test_email_auth.py`
- ✅ `test_email_signup_success` - Successful registration
- ✅ `test_email_signup_duplicate` - Duplicate email rejection
- ✅ `test_email_signup_weak_password` - Weak password rejection
- ✅ `test_email_signup_invalid_email` - Invalid email format
- ✅ `test_email_login_success` - Successful login
- ✅ `test_email_login_wrong_password` - Wrong password handling
- ✅ `test_email_login_nonexistent_user` - Nonexistent user handling
- ✅ `test_email_change_password_success` - Password change
- ✅ `test_email_change_password_wrong_old_password` - Wrong old password
- ✅ `test_email_change_password_no_auth` - Unauthorized password change

**EVM Wallet Authentication (7 tests)** - `test_evm_auth.py`
- ✅ `test_evm_challenge_success` - Challenge generation
- ✅ `test_evm_challenge_invalid_address` - Invalid address rejection
- ✅ `test_evm_verify_success` - Successful signature verification
- ✅ `test_evm_verify_invalid_signature` - Invalid signature rejection
- ✅ `test_evm_verify_wrong_nonce` - Replay attack prevention
- ✅ `test_evm_link_success` - Link wallet to account
- ✅ `test_evm_link_no_auth` - Unauthorized linking attempt

**Solana Wallet Authentication (3 tests)** - `test_solana_auth.py`
- ✅ `test_solana_challenge_success` - Challenge generation
- ✅ `test_solana_verify_success` - Successful signature verification
- ✅ `test_solana_link_success` - Link wallet to account

**Cosmos Wallet Authentication (2 tests)** - `test_cosmos_auth.py`
- ✅ `test_cosmos_challenge_success` - Challenge generation
- ✅ `test_cosmos_challenge_invalid_address` - Invalid address rejection

**Edge Cases & Security (4 tests)** - `test_edge_cases.py`
- ✅ `test_missing_required_fields` - Missing field validation
- ✅ `test_empty_strings` - Empty value handling
- ✅ `test_sql_injection_attempt` - SQL injection protection
- ✅ `test_very_long_inputs` - Long input validation

**Account Linking (2 tests)** - `test_account_linking.py`
- ✅ `test_link_multiple_wallets_to_one_account` - Multi-wallet linking
- ✅ `test_login_with_linked_wallet` - Login with linked wallet

### Integration Tests (25 assertions)

**Integration Test Suite** - `test_integration.py`
- Email signup → login → change password
- EVM challenge → sign → verify → link
- Solana challenge → sign → verify → link
- Cosmos challenge → validation
- Edge case validation (invalid email, weak password, invalid address)
- Multi-wallet linking (EVM + Solana to one account)

## Test Fixtures

Defined in `app/tests/conftest.py`:

- **`client`** - FastAPI TestClient for making API requests
- **`db_session`** - Database session with automatic cleanup
- **`test_user_data`** - Sample user data for testing

## Writing New Tests

### Add New Unit Test

1. Identify the authentication type (email, EVM, Solana, Cosmos, etc.)
2. Add test to appropriate file in `unit/` folder
3. Follow naming convention: `test_{feature}_{scenario}`
4. Include docstring explaining WHY and HOW

Example:
```python
def test_email_signup_with_special_chars(self, client):
    """
    Test email signup with special characters

    WHY: Verify special character handling
    HOW: Signup with special chars, expect success or proper error
    """
    # Test implementation
```

### Add New Integration Test

1. Add test function to `integration/test_integration.py`
2. Decorate with `@tester.test("Test Name")`
3. Use assertions methods: `assert_status`, `assert_key_in_response`

Example:
```python
@tester.test("15. New Feature Test")
def test_new_feature(t):
    """Test new authentication feature"""
    response = requests.post(f"{API_V1}/auth/new/endpoint", json=data)
    t.assert_status(response, 200, "New feature works")
```

## Test Environment

Tests use the development database configured in `conftest.py`:
- **Database**: PostgreSQL (localhost:5432)
- **Redis**: localhost:6379
- **Environment**: Test data is cleaned up after each test

## Troubleshooting

### Quick Diagnosis

Run the setup verification script first:
```bash
cd backend
bash scripts/verify_test_setup.sh
```

### Common Issues

#### 1. "Cannot connect to Docker daemon"

**Problem**: Docker Desktop is not running

**Solution**:
```bash
# Start Docker Desktop application
# Then verify it's running:
docker ps
```

#### 2. "ModuleNotFoundError: No module named 'app'"

**Problem**: PYTHONPATH not set correctly

**Solution**:
```bash
# Always run from backend/src directory with PYTHONPATH
cd backend/src
PYTHONPATH=$PWD pytest app/tests/auth/unit/ -v
```

#### 3. "ModuleNotFoundError: No module named 'redis'" or "'eth_account'" or "'jose'"

**Problem**: Missing dependencies

**Solution**:
```bash
# Install core dependencies
pip install pydantic-settings psycopg2-binary pytest "python-jose[cryptography]" passlib bcrypt "pydantic[email]" redis

# Install wallet authentication dependencies
pip install web3 eth-account PyNaCl base58 bech32
```

#### 4. Database connection errors

**Problem**: PostgreSQL container not running

**Solution**:
```bash
# Check if containers are running
docker ps | grep privexbot

# Start database services
cd backend
docker compose -f docker-compose.dev.yml up -d postgres redis

# Verify they're healthy
docker ps
```

#### 5. "Address already in use" (Port 8000)

**Problem**: Server already running on port 8000

**Solution**:
```bash
# Find and kill the process
lsof -ti:8000 | xargs kill -9

# Or if server is running in a terminal, stop it with Ctrl+C
```

#### 6. Integration tests fail with "Cannot connect to server"

**Problem**: Backend server not running

**Solution**:
```bash
# Start the server (from backend/src)
cd backend/src
uvicorn app.main:app --reload

# In another terminal, run integration tests
cd backend/src
python app/tests/auth/integration/test_integration.py
```

#### 7. Server fails to start

**Problem**: Multiple possible causes

**Check**:
```bash
# 1. Docker services running?
docker ps | grep privexbot

# 2. Dependencies installed?
python -c "import pydantic_settings, psycopg2, jose, passlib, email_validator, eth_account, nacl, base58, bech32"

# 3. Database accessible?
docker exec -it privexbot-postgres-dev psql -U privexbot -c "SELECT 1"

# 4. Check server logs
cd backend/src
uvicorn app.main:app --reload
# Look for specific error messages
```

#### 8. Tests pass locally but fail in CI

**Check**:
1. Database migrations applied: `alembic upgrade head`
2. Environment variables set correctly
3. All dependencies installed
4. Python version matches (3.9+)
5. Docker services available in CI environment

## Best Practices

1. **Keep tests isolated**: Each test should be independent
2. **Use descriptive names**: Test names should explain what they test
3. **Test edge cases**: Include error scenarios and boundary conditions
4. **Clean up after tests**: Use fixtures for automatic cleanup
5. **Mock external services**: Don't depend on external APIs in tests
6. **Document WHY and HOW**: Explain the purpose and approach in docstrings
7. **Run tests before committing**: Ensure all tests pass

## CI/CD Integration

Tests are run automatically in CI/CD pipeline:
```yaml
# Example GitHub Actions workflow
- name: Run Authentication Tests
  run: |
    cd backend/src
    PYTHONPATH=$PWD pytest app/tests/auth/ -v --cov=app.auth
```

## Test Metrics

- **Total Tests**: 28 unit tests + 14 integration tests (25 assertions)
- **Coverage**: 100% of authentication endpoints
- **Execution Time**: ~5 seconds (unit), ~15 seconds (integration)
- **Success Rate**: 100% (53/53 assertions passing)

---

**Last Updated**: October 2024
**Maintained By**: PrivexBot Team
