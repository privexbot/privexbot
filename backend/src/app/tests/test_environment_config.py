"""
Environment configuration tests to ensure proper setup across all environments.

WHY:
- Verify configuration works in local, Docker, and SecretVM environments
- Test database connections and environment variable handling
- Ensure CORS and security settings are properly configured

HOW:
- Test configuration loading from environment variables
- Verify database connection strings for different environments
- Test CORS settings and security configurations
"""

import pytest
import os
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

from app.core.config import settings, Settings
from app.main import app
from app.db.session import engine


class TestEnvironmentConfiguration:
    """Test configuration across different environments"""

    def test_default_configuration_values(self):
        """Test that default configuration values are properly set"""
        assert settings.PROJECT_NAME == "PrivexBot"
        assert settings.API_V1_PREFIX == "/api/v1"
        assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 30
        assert settings.ALGORITHM == "HS256"

    def test_environment_detection(self):
        """Test environment detection"""
        # Test that ENVIRONMENT is properly set
        assert hasattr(settings, 'ENVIRONMENT')
        assert settings.ENVIRONMENT in ['development', 'production', 'testing']

    @patch.dict(os.environ, {
        'SECRET_KEY': 'test-secret-key',
        'DATABASE_URL': 'postgresql://user:pass@localhost/testdb',
        'REDIS_URL': 'redis://localhost:6379/0',
        'ENVIRONMENT': 'testing'
    })
    def test_local_environment_config(self):
        """Test configuration for local development environment"""
        # Reload settings with test environment variables
        test_settings = Settings()

        assert test_settings.SECRET_KEY == 'test-secret-key'
        assert test_settings.DATABASE_URL == 'postgresql://user:pass@localhost/testdb'
        assert test_settings.REDIS_URL == 'redis://localhost:6379/0'
        assert test_settings.ENVIRONMENT == 'testing'

    @patch.dict(os.environ, {
        'SECRET_KEY': 'docker-secret-key',
        'DATABASE_URL': 'postgresql://user:pass@postgres:5432/privexbot',
        'REDIS_URL': 'redis://redis:6379/0',
        'ENVIRONMENT': 'development',
        'BACKEND_CORS_ORIGINS': '["http://localhost:3000", "http://frontend:3000"]'
    })
    def test_docker_environment_config(self):
        """Test configuration for Docker environment"""
        test_settings = Settings()

        assert test_settings.SECRET_KEY == 'docker-secret-key'
        assert 'postgres:5432' in test_settings.DATABASE_URL
        assert 'redis:6379' in test_settings.REDIS_URL
        assert test_settings.ENVIRONMENT == 'development'

        # Test CORS origins parsing
        cors_origins = test_settings.cors_origins
        assert 'http://localhost:3000' in cors_origins
        assert 'http://frontend:3000' in cors_origins

    @patch.dict(os.environ, {
        'SECRET_KEY': 'production-secret-key',
        'DATABASE_URL': 'postgresql://user:pass@prod-db:5432/privexbot',
        'REDIS_URL': 'redis://prod-redis:6379/0',
        'ENVIRONMENT': 'production',
        'BACKEND_CORS_ORIGINS': '["https://app.privexbot.com"]'
    })
    def test_production_environment_config(self):
        """Test configuration for production (SecretVM) environment"""
        test_settings = Settings()

        assert test_settings.SECRET_KEY == 'production-secret-key'
        assert 'prod-db:5432' in test_settings.DATABASE_URL
        assert 'prod-redis:6379' in test_settings.REDIS_URL
        assert test_settings.ENVIRONMENT == 'production'

        # Test production CORS settings
        cors_origins = test_settings.cors_origins
        assert 'https://app.privexbot.com' in cors_origins

    def test_required_environment_variables(self):
        """Test that required environment variables are validated"""
        required_vars = [
            'SECRET_KEY',
            'DATABASE_URL'
        ]

        for var in required_vars:
            # Check that the variable exists in settings
            assert hasattr(settings, var.lower())
            # Check that it's not None or empty
            value = getattr(settings, var.lower())
            assert value is not None
            assert value != ""

    def test_cors_configuration(self):
        """Test CORS configuration for different environments"""
        # Test that CORS origins are properly configured
        cors_origins = settings.cors_origins
        assert isinstance(cors_origins, list)

        # In development, should allow localhost
        if settings.ENVIRONMENT == 'development':
            localhost_allowed = any('localhost' in origin for origin in cors_origins)
            assert localhost_allowed or len(cors_origins) == 1 and cors_origins[0] == "*"

    def test_security_settings(self):
        """Test security-related configuration"""
        # Secret key should be present and non-trivial
        assert settings.SECRET_KEY
        assert len(settings.SECRET_KEY) >= 32  # Minimum secure length

        # Algorithm should be secure
        assert settings.ALGORITHM in ['HS256', 'RS256']

        # Token expiration should be reasonable
        assert 15 <= settings.ACCESS_TOKEN_EXPIRE_MINUTES <= 1440  # 15 minutes to 24 hours


class TestDatabaseConfiguration:
    """Test database configuration and connectivity"""

    def test_database_url_format(self):
        """Test that database URL is properly formatted"""
        db_url = settings.DATABASE_URL
        assert db_url.startswith('postgresql://')

        # Should contain required components
        assert '@' in db_url  # username:password@
        assert '/' in db_url.split('@')[1]  # host:port/database

    def test_database_engine_creation(self):
        """Test that database engine can be created"""
        # This tests that the engine configuration is valid
        assert engine is not None
        assert engine.url.drivername == 'postgresql'

    def test_database_connection_parameters(self):
        """Test database connection parameters"""
        # Test that connection pool settings are reasonable
        pool = engine.pool
        assert hasattr(pool, 'size')
        assert hasattr(pool, 'max_overflow')

        # Pool size should be reasonable for different environments
        if settings.ENVIRONMENT == 'production':
            # Production should have larger pool
            assert pool.size() >= 5
        else:
            # Development can have smaller pool
            assert pool.size() >= 1

    @pytest.mark.skipif(
        'postgres' not in settings.DATABASE_URL or 'localhost' not in settings.DATABASE_URL,
        reason="Requires local PostgreSQL database"
    )
    def test_database_connectivity_local(self):
        """Test database connectivity in local environment"""
        try:
            with engine.connect() as conn:
                result = conn.execute("SELECT 1")
                assert result.fetchone()[0] == 1
        except OperationalError:
            pytest.skip("Local PostgreSQL database not available")

    def test_database_url_environment_specific(self):
        """Test that database URL is appropriate for environment"""
        db_url = settings.DATABASE_URL

        if settings.ENVIRONMENT == 'development':
            # Development might use localhost or docker containers
            assert 'localhost' in db_url or 'postgres' in db_url
        elif settings.ENVIRONMENT == 'production':
            # Production should use production database host
            assert 'localhost' not in db_url  # Should not use localhost in production


class TestRedisConfiguration:
    """Test Redis configuration"""

    def test_redis_url_format(self):
        """Test that Redis URL is properly formatted"""
        if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL:
            redis_url = settings.REDIS_URL
            assert redis_url.startswith('redis://')

            # Should contain host and port
            url_parts = redis_url.replace('redis://', '').split('/')
            host_port = url_parts[0]
            assert ':' in host_port  # host:port format

    def test_redis_environment_specific(self):
        """Test that Redis URL is appropriate for environment"""
        if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL:
            redis_url = settings.REDIS_URL

            if settings.ENVIRONMENT == 'development':
                # Development might use localhost or docker containers
                assert 'localhost' in redis_url or 'redis' in redis_url
            elif settings.ENVIRONMENT == 'production':
                # Production should use production Redis host
                assert 'localhost' not in redis_url


class TestApplicationStartup:
    """Test application startup behavior"""

    def test_app_creation(self):
        """Test that FastAPI app can be created successfully"""
        assert app is not None
        assert app.title == settings.PROJECT_NAME
        assert app.docs_url == "/api/docs"
        assert app.redoc_url == "/api/redoc"

    def test_middleware_configuration(self):
        """Test that middleware is properly configured"""
        # Test that CORS middleware is added
        middleware_types = [type(middleware) for middleware in app.user_middleware]

        from fastapi.middleware.cors import CORSMiddleware
        assert any(CORSMiddleware in str(middleware_type) for middleware_type in middleware_types)

    def test_route_registration(self):
        """Test that all routes are properly registered"""
        client = TestClient(app)

        # Test that our new routes are accessible
        routes_to_test = [
            "/health",
            "/api/v1/ping",
            "/api/v1/status",
            "/api/docs",
            "/openapi.json"
        ]

        for route in routes_to_test:
            response = client.get(route)
            assert response.status_code in [200, 401, 403]  # 401/403 for protected routes

    def test_lifespan_events(self):
        """Test that lifespan events are properly configured"""
        # Test that app has lifespan configuration
        assert hasattr(app, 'router')
        assert hasattr(app.router, 'lifespan')

    def test_error_handlers(self):
        """Test that error handlers work properly"""
        client = TestClient(app)

        # Test 404 handling
        response = client.get("/nonexistent-endpoint")
        assert response.status_code == 404

        # Test validation error handling
        response = client.post("/api/v1/test", json="invalid-json-for-dict")
        assert response.status_code in [422, 400]


class TestProductionReadiness:
    """Test production readiness indicators"""

    def test_debug_mode_disabled_in_production(self):
        """Test that debug mode is disabled in production"""
        if settings.ENVIRONMENT == 'production':
            # In production, debug should be disabled
            assert not getattr(settings, 'DEBUG', True)

    def test_security_headers_configuration(self):
        """Test that security headers are properly configured"""
        client = TestClient(app)
        response = client.get("/health")

        # Test basic security - API should not expose sensitive information
        assert response.status_code == 200

        # Headers should not reveal internal implementation details
        headers = response.headers
        server_header = headers.get('server', '').lower()
        assert 'fastapi' not in server_header or settings.ENVIRONMENT != 'production'

    def test_api_documentation_security(self):
        """Test API documentation security settings"""
        if settings.ENVIRONMENT == 'production':
            # In production, consider if docs should be disabled
            # This is a policy decision - some APIs keep docs enabled
            pass

        # Test that docs don't expose sensitive information
        client = TestClient(app)
        response = client.get("/openapi.json")

        if response.status_code == 200:
            spec = response.json()
            # Should not contain sensitive server information
            assert 'servers' not in spec or not spec['servers'] or \
                   not any('localhost' in str(server) for server in spec['servers'])

    def test_environment_variable_security(self):
        """Test that sensitive environment variables are properly handled"""
        # Secret key should not be default or weak
        secret_key = settings.SECRET_KEY
        weak_keys = ['secret', 'password', 'key', 'test', 'development', 'changeme']

        assert not any(weak in secret_key.lower() for weak in weak_keys)

        # Database URL should not contain default credentials
        db_url = settings.DATABASE_URL
        weak_credentials = ['password', 'admin', 'root', 'test']

        for cred in weak_credentials:
            assert cred not in db_url.lower() or settings.ENVIRONMENT != 'production'


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])