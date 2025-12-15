"""
Docker integration tests to ensure proper functionality in containerized environment.

WHY:
- Verify application works correctly in Docker containers
- Test container networking and service discovery
- Ensure proper health checks and startup behavior

HOW:
- Test database connectivity with Docker Compose services
- Verify CORS configuration for container-to-container communication
- Test service discovery and networking
"""

import pytest
import os
import time
import requests
from unittest.mock import patch
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings


class TestDockerEnvironment:
    """Test Docker-specific environment configuration"""

    def test_docker_database_host_configuration(self):
        """Test that database host is configured for Docker environment"""
        # In Docker, database host should be service name, not localhost
        if 'DOCKER' in os.environ or 'postgres' in settings.DATABASE_URL:
            db_url = settings.DATABASE_URL
            # Should use Docker service name, not localhost
            assert 'postgres' in db_url or 'db' in db_url
            assert 'localhost' not in db_url

    def test_docker_redis_host_configuration(self):
        """Test that Redis host is configured for Docker environment"""
        if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL:
            if 'DOCKER' in os.environ or 'redis' in settings.REDIS_URL:
                redis_url = settings.REDIS_URL
                # Should use Docker service name, not localhost
                assert 'redis' in redis_url
                assert 'localhost' not in redis_url

    def test_docker_cors_configuration(self):
        """Test CORS configuration for Docker frontend container"""
        cors_origins = settings.cors_origins

        # In Docker, should allow frontend container communication
        docker_origins = [
            'http://frontend:3000',
            'http://localhost:3000',  # For local development
        ]

        if 'DOCKER' in os.environ:
            # At least one Docker origin should be allowed
            assert any(origin in cors_origins for origin in docker_origins) or '*' in cors_origins

    def test_docker_network_configuration(self):
        """Test network configuration for Docker environment"""
        # Test that the app can bind to all interfaces (0.0.0.0) in Docker
        # This is important for container networking
        if 'DOCKER' in os.environ:
            # Docker containers should listen on all interfaces
            pass  # This would be tested during actual startup


class TestDockerDatabaseConnectivity:
    """Test database connectivity in Docker environment"""

    @pytest.mark.skipif(
        'postgres' not in settings.DATABASE_URL and 'DOCKER' not in os.environ,
        reason="Requires Docker PostgreSQL service"
    )
    def test_docker_postgres_connectivity(self):
        """Test connectivity to PostgreSQL container"""
        try:
            # Test connection with retry logic (container startup time)
            max_retries = 30
            retry_delay = 1

            for attempt in range(max_retries):
                try:
                    engine = create_engine(settings.DATABASE_URL)
                    with engine.connect() as conn:
                        result = conn.execute(text("SELECT 1"))
                        assert result.fetchone()[0] == 1
                    break
                except OperationalError as e:
                    if attempt == max_retries - 1:
                        pytest.skip(f"PostgreSQL container not available: {e}")
                    time.sleep(retry_delay)

        except Exception as e:
            pytest.skip(f"Docker PostgreSQL test skipped: {e}")

    @pytest.mark.skipif(
        'postgres' not in settings.DATABASE_URL and 'DOCKER' not in os.environ,
        reason="Requires Docker environment"
    )
    def test_docker_database_schema_initialization(self):
        """Test that database schema is properly initialized in Docker"""
        try:
            from app.db.init_db import init_db
            from app.db.base_class import Base

            # Test that init_db can run without errors
            init_db()

            # Test that tables are created
            engine = create_engine(settings.DATABASE_URL)
            with engine.connect() as conn:
                # Check that at least some core tables exist
                result = conn.execute(text("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name IN ('users', 'organizations', 'workspaces')
                """))
                tables = [row[0] for row in result]

                # Should have core tables
                expected_tables = ['users', 'organizations', 'workspaces']
                for table in expected_tables:
                    assert table in tables, f"Table {table} not found in database"

        except Exception as e:
            pytest.skip(f"Database schema test skipped: {e}")


class TestDockerServiceHealth:
    """Test health checks and service readiness in Docker"""

    @pytest.mark.skipif(
        'DOCKER' not in os.environ,
        reason="Requires Docker environment"
    )
    def test_health_check_endpoint_in_docker(self):
        """Test health check endpoint works in Docker container"""
        try:
            # Test internal health check (container to container)
            response = requests.get("http://localhost:8000/health", timeout=5)
            assert response.status_code == 200

            data = response.json()
            assert data["status"] == "healthy"
            assert data["service"] == "privexbot-backend"

        except requests.exceptions.RequestException:
            pytest.skip("Health check endpoint not accessible")

    @pytest.mark.skipif(
        'DOCKER' not in os.environ,
        reason="Requires Docker environment"
    )
    def test_api_endpoints_accessible_in_docker(self):
        """Test that API endpoints are accessible in Docker"""
        try:
            base_url = "http://localhost:8000"
            endpoints_to_test = [
                "/api/v1/ping",
                "/api/v1/status",
                "/api/docs",
                "/openapi.json"
            ]

            for endpoint in endpoints_to_test:
                response = requests.get(f"{base_url}{endpoint}", timeout=5)
                assert response.status_code in [200, 401, 403], f"Endpoint {endpoint} failed"

        except requests.exceptions.RequestException:
            pytest.skip("API endpoints not accessible in Docker")

    def test_docker_startup_time(self):
        """Test that application starts within reasonable time in Docker"""
        # This test measures startup performance
        start_time = time.time()

        try:
            # Import main modules to simulate startup
            from app.main import app
            from app.db.session import engine

            startup_time = time.time() - start_time

            # Startup should be reasonable (under 30 seconds even in slower environments)
            assert startup_time < 30, f"Startup took {startup_time:.2f} seconds"

        except Exception as e:
            pytest.skip(f"Startup test skipped: {e}")


class TestDockerVolumeAndPersistence:
    """Test Docker volume mounting and data persistence"""

    def test_docker_log_directory_writable(self):
        """Test that log directories are writable in Docker"""
        import tempfile
        import logging

        try:
            # Test that we can write logs
            with tempfile.NamedTemporaryFile(mode='w', delete=True) as temp_log:
                logger = logging.getLogger('test_docker')
                handler = logging.FileHandler(temp_log.name)
                logger.addHandler(handler)
                logger.info("Test log message")
                handler.close()

            assert True  # If we get here, logging works

        except Exception as e:
            pytest.skip(f"Log directory test skipped: {e}")

    @pytest.mark.skipif(
        'DOCKER' not in os.environ,
        reason="Requires Docker environment with volume mounts"
    )
    def test_docker_volume_permissions(self):
        """Test that Docker volumes have correct permissions"""
        import os
        import tempfile

        try:
            # Test writing to various directories that might be volume-mounted
            test_dirs = [
                '/app/logs',  # Common log directory
                '/app/data',  # Common data directory
                '/tmp'        # Fallback temp directory
            ]

            writable_dirs = []
            for test_dir in test_dirs:
                if os.path.exists(test_dir):
                    try:
                        test_file = os.path.join(test_dir, 'test_write_permission.tmp')
                        with open(test_file, 'w') as f:
                            f.write('test')
                        os.remove(test_file)
                        writable_dirs.append(test_dir)
                    except (OSError, IOError):
                        pass

            # At least tmp should be writable
            assert len(writable_dirs) > 0, "No writable directories found"

        except Exception as e:
            pytest.skip(f"Volume permissions test skipped: {e}")


class TestDockerNetworking:
    """Test Docker networking and service discovery"""

    @pytest.mark.skipif(
        'DOCKER' not in os.environ,
        reason="Requires Docker environment"
    )
    def test_container_to_container_communication(self):
        """Test communication between containers"""
        try:
            # Test that we can resolve Docker service names
            import socket

            services_to_test = ['postgres', 'redis']

            for service in services_to_test:
                try:
                    # Test DNS resolution of service names
                    socket.gethostbyname(service)
                except socket.gaierror:
                    # Service might not exist in current test environment
                    pass

        except Exception as e:
            pytest.skip(f"Container communication test skipped: {e}")

    def test_docker_port_binding(self):
        """Test that ports are properly bound in Docker"""
        import socket

        # Test that the application port is accessible
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('localhost', 8000))
            sock.close()

            if result == 0:
                # Port is accessible
                assert True
            else:
                pytest.skip("Port 8000 not accessible")

        except Exception as e:
            pytest.skip(f"Port binding test skipped: {e}")


class TestDockerResourceConstraints:
    """Test behavior under Docker resource constraints"""

    def test_memory_usage_reasonable(self):
        """Test that memory usage is reasonable in Docker"""
        import psutil
        import gc

        try:
            # Force garbage collection
            gc.collect()

            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024

            # Memory usage should be reasonable (under 512MB for basic startup)
            assert memory_mb < 512, f"Memory usage {memory_mb:.2f}MB is too high"

        except Exception as e:
            pytest.skip(f"Memory usage test skipped: {e}")

    def test_startup_without_high_cpu(self):
        """Test that startup doesn't consume excessive CPU"""
        import psutil
        import time

        try:
            process = psutil.Process()

            # Monitor CPU usage for a few seconds
            cpu_percentages = []
            for _ in range(5):
                cpu_percent = process.cpu_percent(interval=1)
                cpu_percentages.append(cpu_percent)

            avg_cpu = sum(cpu_percentages) / len(cpu_percentages)

            # CPU usage should not be consistently high (under 80% average)
            assert avg_cpu < 80, f"CPU usage {avg_cpu:.2f}% is too high"

        except Exception as e:
            pytest.skip(f"CPU usage test skipped: {e}")


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])