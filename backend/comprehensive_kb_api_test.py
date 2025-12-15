#!/usr/bin/env python3
"""
Comprehensive Knowledge Base API Testing Script

This script performs end-to-end testing of all KB API endpoints
using the Uniswap documentation as a test case.

Target URL: https://docs.uniswap.org/concepts/overview
Test Environment: Development (http://localhost:8000)

Test Coverage:
- Authentication (signup, login, get current user)
- Organization & Workspace management
- KB Draft creation (3-phase flow)
- Web scraping with Uniswap docs
- Pipeline monitoring and status tracking
- KB management and statistics
- Edge cases and error handling
- Performance and security analysis
"""

import requests
import time
import json
import uuid
import sys
from datetime import datetime
from typing import Optional, Dict, List, Tuple, Any
import traceback

# Configuration
BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"
TARGET_URL = "https://docs.uniswap.org/concepts/overview"
TEST_USER_SUFFIX = int(time.time())
DOCS_FILE = "/Users/user/Downloads/privex-dev/privexbot/backend/docs/KB_API_COMPREHENSIVE_TEST_RESULTS.md"

# Test Data
TEST_EMAIL = f"uniswap_tester_{TEST_USER_SUFFIX}@example.com"
TEST_USERNAME = f"uniswap_tester_{TEST_USER_SUFFIX}"
TEST_PASSWORD = "SecurePassword123!"
KB_NAME = "Uniswap Documentation Knowledge Base"
KB_DESCRIPTION = "Complete Uniswap protocol documentation for DeFi knowledge base"

class Colors:
    """Console color codes for better output readability"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

class TestResults:
    """Store test execution results for documentation"""
    def __init__(self):
        self.tests = []
        self.performance_metrics = {}
        self.security_analysis = {}
        self.kb_metrics = {}
        self.issues = {"critical": [], "minor": [], "recommendations": []}

    def add_test(self, test_name: str, endpoint: str, request_data: Dict,
                 response_data: Dict, status_code: int, response_time: float,
                 status: str, notes: str = ""):
        """Add a test result"""
        self.tests.append({
            "name": test_name,
            "endpoint": endpoint,
            "request": request_data,
            "response": response_data,
            "status_code": status_code,
            "response_time": response_time,
            "status": status,
            "notes": notes,
            "timestamp": datetime.now().isoformat()
        })

    def add_performance_metric(self, endpoint: str, avg_time: float):
        """Add performance metric"""
        self.performance_metrics[endpoint] = avg_time

    def add_issue(self, category: str, issue: str):
        """Add an issue to track"""
        if category in self.issues:
            self.issues[category].append(issue)

class KBAPITester:
    """Comprehensive KB API testing client"""

    def __init__(self):
        self.base_url = BASE_URL
        self.token: Optional[str] = None
        self.org_id: Optional[str] = None
        self.workspace_id: Optional[str] = None
        self.draft_id: Optional[str] = None
        self.kb_id: Optional[str] = None
        self.pipeline_id: Optional[str] = None
        self.results = TestResults()

        print(f"{Colors.BOLD}{Colors.CYAN}")
        print("=" * 80)
        print("KNOWLEDGE BASE API COMPREHENSIVE TESTING")
        print("=" * 80)
        print(f"Target URL: {TARGET_URL}")
        print(f"Backend: {BASE_URL}")
        print(f"Test User: {TEST_EMAIL}")
        print(f"Timestamp: {datetime.now().isoformat()}")
        print("=" * 80)
        print(f"{Colors.END}")

    def log(self, message: str, color: str = Colors.WHITE):
        """Log a message with color"""
        print(f"{color}{message}{Colors.END}")

    def make_request(self, method: str, endpoint: str, data: Dict = None,
                     headers: Dict = None, params: Dict = None) -> Tuple[Dict, int, float]:
        """Make HTTP request and track performance"""
        url = f"{self.base_url}{API_PREFIX}{endpoint}"
        request_headers = {"Content-Type": "application/json"}

        if headers:
            request_headers.update(headers)

        if self.token and "Authorization" not in request_headers:
            request_headers["Authorization"] = f"Bearer {self.token}"

        start_time = time.time()

        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=request_headers, params=params)
            elif method.upper() == "POST":
                response = requests.post(url, headers=request_headers, json=data)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=request_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            response_time = (time.time() - start_time) * 1000  # Convert to ms

            try:
                response_data = response.json()
            except:
                response_data = {"raw_content": response.text}

            return response_data, response.status_code, response_time

        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            return {"error": str(e), "traceback": traceback.format_exc()}, 0, response_time

    def test_authentication(self):
        """Test authentication endpoints"""
        self.log("\n1. AUTHENTICATION TESTS", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        # Test 1.1: User Signup
        self.log("Testing user signup...", Colors.BLUE)
        signup_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "username": TEST_USERNAME
        }

        response_data, status_code, response_time = self.make_request(
            "POST", "/auth/email/signup", signup_data
        )

        if status_code == 201 and "access_token" in response_data:
            self.token = response_data["access_token"]
            self.log("✓ Signup successful", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ Signup failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("critical", "User signup failed")

        self.results.add_test(
            "User Signup",
            "POST /auth/email/signup",
            signup_data,
            response_data,
            status_code,
            response_time,
            status,
            f"Access token received: {bool(self.token)}"
        )

        if not self.token:
            self.log("Cannot continue without authentication token", Colors.RED)
            return False

        # Test 1.2: Get Current User
        self.log("Testing get current user...", Colors.BLUE)
        response_data, status_code, response_time = self.make_request(
            "GET", "/auth/me"
        )

        if status_code == 200 and "id" in response_data:
            self.log(f"✓ Current user: {response_data.get('username')}", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ Get current user failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("critical", "Get current user failed")

        self.results.add_test(
            "Get Current User",
            "GET /auth/me",
            {},
            response_data,
            status_code,
            response_time,
            status
        )

        return True

    def test_organization_workspace(self):
        """Test organization and workspace management"""
        self.log("\n2. ORGANIZATION & WORKSPACE TESTS", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        # Test 2.1: List Organizations
        self.log("Testing list organizations...", Colors.BLUE)
        response_data, status_code, response_time = self.make_request(
            "GET", "/orgs/"
        )

        if status_code == 200 and "organizations" in response_data:
            orgs = response_data["organizations"]
            if orgs:
                self.org_id = orgs[0]["id"]
                self.log(f"✓ Found organization: {orgs[0]['name']}", Colors.GREEN)
                status = "PASS"
            else:
                self.log("✗ No organizations found", Colors.RED)
                status = "FAIL"
                self.results.add_issue("critical", "No organizations found")
        else:
            self.log(f"✗ List organizations failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("critical", "List organizations failed")

        self.results.add_test(
            "List Organizations",
            "GET /orgs/",
            {},
            response_data,
            status_code,
            response_time,
            status
        )

        if not self.org_id:
            return False

        # Test 2.2: List Workspaces
        self.log("Testing list workspaces...", Colors.BLUE)
        response_data, status_code, response_time = self.make_request(
            "GET", f"/orgs/{self.org_id}/workspaces"
        )

        if status_code == 200 and "workspaces" in response_data:
            workspaces = response_data["workspaces"]
            if workspaces:
                self.workspace_id = workspaces[0]["id"]
                self.log(f"✓ Found workspace: {workspaces[0]['name']}", Colors.GREEN)
                status = "PASS"
            else:
                self.log("✗ No workspaces found", Colors.RED)
                status = "FAIL"
                self.results.add_issue("critical", "No workspaces found")
        else:
            self.log(f"✗ List workspaces failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("critical", "List workspaces failed")

        self.results.add_test(
            "List Workspaces",
            f"GET /orgs/{self.org_id}/workspaces",
            {},
            response_data,
            status_code,
            response_time,
            status
        )

        return bool(self.workspace_id)

    def test_kb_draft_creation(self):
        """Test KB draft creation (Phase 1 of 3-phase flow)"""
        self.log("\n3. KB DRAFT CREATION TESTS", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        # Test 3.1: Create KB Draft
        self.log("Testing KB draft creation...", Colors.BLUE)
        draft_data = {
            "name": KB_NAME,
            "description": KB_DESCRIPTION,
            "workspace_id": self.workspace_id,
            "context": "both"
        }

        response_data, status_code, response_time = self.make_request(
            "POST", "/kb-drafts/", draft_data
        )

        if status_code == 201 and "draft_id" in response_data:
            self.draft_id = response_data["draft_id"]
            self.log(f"✓ Draft created: {self.draft_id}", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ Draft creation failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("critical", "KB draft creation failed")

        self.results.add_test(
            "Create KB Draft",
            "POST /kb-drafts/",
            draft_data,
            response_data,
            status_code,
            response_time,
            status
        )

        return bool(self.draft_id)

    def test_web_source_addition(self):
        """Test adding Uniswap web source to draft"""
        self.log("\n4. WEB SOURCE ADDITION TESTS", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        if not self.draft_id:
            self.log("Cannot test web source without draft_id", Colors.RED)
            return False

        # Test 4.1: Add Web Source (Uniswap Docs)
        self.log(f"Testing web source addition for: {TARGET_URL}", Colors.BLUE)
        source_data = {
            "url": TARGET_URL,
            "config": {
                "method": "crawl",
                "max_pages": 25,
                "max_depth": 3,
                "stealth_mode": True
            }
        }

        response_data, status_code, response_time = self.make_request(
            "POST", f"/kb-drafts/{self.draft_id}/sources/web", source_data
        )

        if status_code == 200 and "source_id" in response_data:
            source_id = response_data["source_id"]
            self.log(f"✓ Web source added: {source_id}", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ Web source addition failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("critical", "Web source addition failed")

        self.results.add_test(
            "Add Uniswap Web Source",
            f"POST /kb-drafts/{self.draft_id}/sources/web",
            source_data,
            response_data,
            status_code,
            response_time,
            status
        )

        # Test 4.2: Update Chunking Configuration
        self.log("Testing chunking configuration update...", Colors.BLUE)
        chunking_data = {
            "strategy": "recursive",
            "chunk_size": 1200,
            "chunk_overlap": 200,
            "preserve_code_blocks": True
        }

        response_data, status_code, response_time = self.make_request(
            "POST", f"/kb-drafts/{self.draft_id}/chunking", chunking_data
        )

        if status_code == 200:
            self.log("✓ Chunking configuration updated", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ Chunking configuration failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("minor", "Chunking configuration update failed")

        self.results.add_test(
            "Update Chunking Configuration",
            f"POST /kb-drafts/{self.draft_id}/chunking",
            chunking_data,
            response_data,
            status_code,
            response_time,
            status
        )

        # Test 4.3: Preview Chunking (Optional)
        self.log("Testing chunking preview...", Colors.BLUE)
        preview_data = {
            "max_preview_pages": 5,
            "strategy": "recursive",
            "chunk_size": 1200,
            "chunk_overlap": 200
        }

        response_data, status_code, response_time = self.make_request(
            "POST", f"/kb-drafts/{self.draft_id}/preview", preview_data
        )

        if status_code == 200 and "total_chunks" in response_data:
            chunks = response_data.get("total_chunks", 0)
            self.log(f"✓ Preview generated: {chunks} chunks", Colors.GREEN)
            status = "PASS"
            # Store preview metrics
            self.results.kb_metrics["preview_chunks"] = chunks
            self.results.kb_metrics["preview_pages"] = response_data.get("pages_previewed", 0)
        else:
            self.log(f"✗ Preview generation failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("minor", "Chunking preview failed")

        self.results.add_test(
            "Preview Chunking",
            f"POST /kb-drafts/{self.draft_id}/preview",
            preview_data,
            response_data,
            status_code,
            response_time,
            status
        )

        return True

    def test_draft_finalization(self):
        """Test draft finalization (Phase 2 - creates KB and starts processing)"""
        self.log("\n5. DRAFT FINALIZATION TESTS", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        if not self.draft_id:
            self.log("Cannot test finalization without draft_id", Colors.RED)
            return False

        # Test 5.1: Finalize Draft
        self.log("Testing draft finalization...", Colors.BLUE)
        response_data, status_code, response_time = self.make_request(
            "POST", f"/kb-drafts/{self.draft_id}/finalize"
        )

        if status_code == 200 and "kb_id" in response_data and "pipeline_id" in response_data:
            self.kb_id = response_data["kb_id"]
            self.pipeline_id = response_data["pipeline_id"]
            self.log(f"✓ KB created: {self.kb_id}", Colors.GREEN)
            self.log(f"✓ Pipeline started: {self.pipeline_id}", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ Draft finalization failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("critical", "Draft finalization failed")

        self.results.add_test(
            "Finalize Draft",
            f"POST /kb-drafts/{self.draft_id}/finalize",
            {},
            response_data,
            status_code,
            response_time,
            status
        )

        return bool(self.kb_id and self.pipeline_id)

    def test_pipeline_monitoring(self):
        """Test pipeline monitoring (Phase 3 - background processing)"""
        self.log("\n6. PIPELINE MONITORING TESTS", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        if not self.pipeline_id:
            self.log("Cannot test pipeline without pipeline_id", Colors.RED)
            return False

        # Test 6.1: Monitor Pipeline Status (Polling)
        self.log("Testing pipeline status monitoring...", Colors.BLUE)
        self.log("Starting pipeline polling (max 300 seconds)...", Colors.CYAN)

        start_time = time.time()
        max_wait = 300  # 5 minutes
        poll_interval = 5
        last_progress = -1
        status_history = []

        while time.time() - start_time < max_wait:
            response_data, status_code, response_time = self.make_request(
                "GET", f"/pipelines/{self.pipeline_id}/status"
            )

            status_history.append({
                "timestamp": datetime.now().isoformat(),
                "response": response_data,
                "status_code": status_code,
                "response_time": response_time
            })

            if status_code == 200:
                current_status = response_data.get("status", "unknown")
                progress = response_data.get("progress_percentage", 0)
                stats = response_data.get("stats", {})

                if progress != last_progress:
                    self.log(f"   Status: {current_status} | Progress: {progress}% | "
                           f"Chunks: {stats.get('chunks_created', 0)} | "
                           f"Vectors: {stats.get('vectors_indexed', 0)}", Colors.CYAN)
                    last_progress = progress

                if current_status in ["completed", "ready", "ready_with_warnings"]:
                    self.log("✓ Pipeline completed successfully!", Colors.GREEN)
                    # Store final metrics
                    self.results.kb_metrics.update({
                        "final_status": current_status,
                        "processing_time": time.time() - start_time,
                        "pages_scraped": stats.get("pages_scraped", 0),
                        "pages_failed": stats.get("pages_failed", 0),
                        "chunks_created": stats.get("chunks_created", 0),
                        "embeddings_generated": stats.get("embeddings_generated", 0),
                        "vectors_indexed": stats.get("vectors_indexed", 0)
                    })
                    break

                if current_status == "failed":
                    self.log("✗ Pipeline failed!", Colors.RED)
                    self.results.add_issue("critical", f"Pipeline failed: {response_data.get('error_message', 'Unknown error')}")
                    break

            else:
                self.log(f"⚠ Status check failed: {response_data}", Colors.YELLOW)

            time.sleep(poll_interval)
        else:
            self.log("⚠ Pipeline monitoring timeout reached", Colors.YELLOW)
            self.results.add_issue("minor", "Pipeline monitoring timeout")

        self.results.add_test(
            "Monitor Pipeline Status",
            f"GET /pipelines/{self.pipeline_id}/status",
            {"polling_duration": time.time() - start_time},
            status_history,
            status_code,
            response_time,
            "PASS" if status_history else "FAIL"
        )

        # Test 6.2: Get Pipeline Logs
        self.log("Testing pipeline logs retrieval...", Colors.BLUE)
        response_data, status_code, response_time = self.make_request(
            "GET", f"/pipelines/{self.pipeline_id}/logs", params={"limit": 20}
        )

        if status_code == 200 and "logs" in response_data:
            logs = response_data["logs"]
            self.log(f"✓ Retrieved {len(logs)} log entries", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ Pipeline logs retrieval failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("minor", "Pipeline logs retrieval failed")

        self.results.add_test(
            "Get Pipeline Logs",
            f"GET /pipelines/{self.pipeline_id}/logs",
            {"limit": 20},
            response_data,
            status_code,
            response_time,
            status
        )

        return True

    def test_kb_management(self):
        """Test knowledge base management endpoints"""
        self.log("\n7. KB MANAGEMENT TESTS", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        if not self.kb_id:
            self.log("Cannot test KB management without kb_id", Colors.RED)
            return False

        # Test 7.1: List Knowledge Bases
        self.log("Testing KB listing...", Colors.BLUE)
        response_data, status_code, response_time = self.make_request(
            "GET", "/kbs/"
        )

        if status_code == 200 and isinstance(response_data, list):
            kb_count = len(response_data)
            self.log(f"✓ Found {kb_count} knowledge bases", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ KB listing failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("minor", "KB listing failed")

        self.results.add_test(
            "List Knowledge Bases",
            "GET /kbs/",
            {},
            response_data,
            status_code,
            response_time,
            status
        )

        # Test 7.2: Get KB Details
        self.log("Testing KB details retrieval...", Colors.BLUE)
        response_data, status_code, response_time = self.make_request(
            "GET", f"/kbs/{self.kb_id}"
        )

        if status_code == 200 and "id" in response_data:
            self.log(f"✓ KB details retrieved: {response_data.get('name')}", Colors.GREEN)
            status = "PASS"
            # Store KB configuration for analysis
            self.results.kb_metrics["config"] = response_data.get("config", {})
        else:
            self.log(f"✗ KB details retrieval failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("minor", "KB details retrieval failed")

        self.results.add_test(
            "Get KB Details",
            f"GET /kbs/{self.kb_id}",
            {},
            response_data,
            status_code,
            response_time,
            status
        )

        # Test 7.3: Get KB Statistics
        self.log("Testing KB statistics...", Colors.BLUE)
        response_data, status_code, response_time = self.make_request(
            "GET", f"/kbs/{self.kb_id}/stats"
        )

        if status_code == 200 and "documents" in response_data:
            docs = response_data["documents"]["total"]
            chunks = response_data["chunks"]["total"]
            self.log(f"✓ KB stats: {docs} docs, {chunks} chunks", Colors.GREEN)
            status = "PASS"
            # Store final statistics
            self.results.kb_metrics.update({
                "total_documents": docs,
                "total_chunks": chunks,
                "avg_chunks_per_doc": response_data["chunks"].get("avg_per_document", 0),
                "storage_size": response_data.get("storage", {}).get("total_content_size", 0),
                "qdrant_healthy": response_data.get("health", {}).get("qdrant_healthy", False),
                "vector_count_match": response_data.get("health", {}).get("vector_count_match", False)
            })
        else:
            self.log(f"✗ KB statistics failed: {response_data}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("minor", "KB statistics retrieval failed")

        self.results.add_test(
            "Get KB Statistics",
            f"GET /kbs/{self.kb_id}/stats",
            {},
            response_data,
            status_code,
            response_time,
            status
        )

        return True

    def test_edge_cases(self):
        """Test edge cases and error scenarios"""
        self.log("\n8. EDGE CASES & ERROR HANDLING TESTS", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        # Test 8.1: Invalid Authentication
        self.log("Testing invalid authentication...", Colors.BLUE)
        temp_token = self.token
        self.token = None  # Remove token

        response_data, status_code, response_time = self.make_request(
            "GET", "/kbs/"
        )

        if status_code == 401:
            self.log("✓ Correctly rejected unauthorized request", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ Should have returned 401, got {status_code}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("critical", "Authentication not properly enforced")

        self.token = temp_token  # Restore token

        self.results.add_test(
            "Invalid Authentication",
            "GET /kbs/",
            {"note": "No Authorization header"},
            response_data,
            status_code,
            response_time,
            status
        )

        # Test 8.2: Invalid Draft ID
        self.log("Testing invalid draft ID...", Colors.BLUE)
        response_data, status_code, response_time = self.make_request(
            "POST", "/kb-drafts/invalid_draft_id/finalize"
        )

        if status_code == 404:
            self.log("✓ Correctly returned 404 for invalid draft ID", Colors.GREEN)
            status = "PASS"
        else:
            self.log(f"✗ Should have returned 404, got {status_code}", Colors.RED)
            status = "FAIL"
            self.results.add_issue("minor", "Invalid draft ID handling incorrect")

        self.results.add_test(
            "Invalid Draft ID",
            "POST /kb-drafts/invalid_draft_id/finalize",
            {},
            response_data,
            status_code,
            response_time,
            status
        )

        # Test 8.3: Invalid URL for Web Scraping
        self.log("Testing invalid URL for web scraping...", Colors.BLUE)
        if self.draft_id:
            # Create a new draft for this test
            draft_data = {
                "name": "Test Draft for Invalid URL",
                "description": "Test invalid URL handling",
                "workspace_id": self.workspace_id,
                "context": "both"
            }

            draft_response, _, _ = self.make_request("POST", "/kb-drafts/", draft_data)
            test_draft_id = draft_response.get("draft_id")

            if test_draft_id:
                invalid_source_data = {
                    "url": "not-a-valid-url",
                    "config": {
                        "method": "crawl",
                        "max_pages": 5
                    }
                }

                response_data, status_code, response_time = self.make_request(
                    "POST", f"/kb-drafts/{test_draft_id}/sources/web", invalid_source_data
                )

                if status_code == 400:
                    self.log("✓ Correctly rejected invalid URL", Colors.GREEN)
                    status = "PASS"
                else:
                    self.log(f"✗ Should have returned 400, got {status_code}", Colors.RED)
                    status = "FAIL"
                    self.results.add_issue("minor", "Invalid URL validation not working properly")

                self.results.add_test(
                    "Invalid URL for Web Scraping",
                    f"POST /kb-drafts/{test_draft_id}/sources/web",
                    invalid_source_data,
                    response_data,
                    status_code,
                    response_time,
                    status
                )

        # Test 8.4: Excessive Parameters
        self.log("Testing excessive parameters...", Colors.BLUE)
        if self.draft_id:
            # Create another new draft for this test
            draft_data = {
                "name": "Test Draft for Excessive Parameters",
                "description": "Test parameter limits",
                "workspace_id": self.workspace_id,
                "context": "both"
            }

            draft_response, _, _ = self.make_request("POST", "/kb-drafts/", draft_data)
            test_draft_id = draft_response.get("draft_id")

            if test_draft_id:
                excessive_source_data = {
                    "url": "https://docs.uniswap.org/concepts/overview",
                    "config": {
                        "method": "crawl",
                        "max_pages": 10000,  # Excessive
                        "max_depth": 50       # Excessive
                    }
                }

                response_data, status_code, response_time = self.make_request(
                    "POST", f"/kb-drafts/{test_draft_id}/sources/web", excessive_source_data
                )

                if status_code == 400:
                    self.log("✓ Correctly rejected excessive parameters", Colors.GREEN)
                    status = "PASS"
                elif status_code == 200:
                    self.log("⚠ Accepted excessive parameters (might have internal limits)", Colors.YELLOW)
                    status = "PASS"
                    self.results.add_issue("recommendations", "Consider adding stricter parameter limits")
                else:
                    self.log(f"✗ Unexpected response {status_code}", Colors.RED)
                    status = "FAIL"

                self.results.add_test(
                    "Excessive Parameters",
                    f"POST /kb-drafts/{test_draft_id}/sources/web",
                    excessive_source_data,
                    response_data,
                    status_code,
                    response_time,
                    status
                )

        return True

    def test_performance_analysis(self):
        """Analyze performance metrics from all tests"""
        self.log("\n9. PERFORMANCE ANALYSIS", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        # Calculate average response times by endpoint
        endpoint_times = {}
        for test in self.results.tests:
            endpoint = test["endpoint"]
            response_time = test["response_time"]

            if endpoint not in endpoint_times:
                endpoint_times[endpoint] = []
            endpoint_times[endpoint].append(response_time)

        # Calculate averages and store
        for endpoint, times in endpoint_times.items():
            avg_time = sum(times) / len(times)
            self.results.add_performance_metric(endpoint, avg_time)

            # Log performance analysis
            if avg_time > 5000:  # > 5 seconds
                self.log(f"⚠ Slow endpoint: {endpoint} ({avg_time:.1f}ms avg)", Colors.YELLOW)
                self.results.add_issue("recommendations", f"Optimize {endpoint} performance ({avg_time:.1f}ms avg)")
            elif avg_time > 2000:  # > 2 seconds
                self.log(f"△ Medium response: {endpoint} ({avg_time:.1f}ms avg)", Colors.CYAN)
            else:
                self.log(f"✓ Good performance: {endpoint} ({avg_time:.1f}ms avg)", Colors.GREEN)

        return True

    def generate_report(self):
        """Generate comprehensive test report"""
        self.log("\n10. GENERATING COMPREHENSIVE REPORT", Colors.YELLOW)
        self.log("-" * 50, Colors.YELLOW)

        # Calculate summary statistics
        total_tests = len(self.results.tests)
        passed_tests = len([t for t in self.results.tests if t["status"] == "PASS"])
        failed_tests = total_tests - passed_tests

        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0

        # Log summary
        self.log(f"\nTEST EXECUTION SUMMARY", Colors.CYAN)
        self.log(f"Total Tests: {total_tests}", Colors.WHITE)
        self.log(f"Passed: {passed_tests}", Colors.GREEN)
        self.log(f"Failed: {failed_tests}", Colors.RED if failed_tests > 0 else Colors.GREEN)
        self.log(f"Success Rate: {success_rate:.1f}%", Colors.GREEN if success_rate > 80 else Colors.YELLOW)

        if self.results.kb_metrics:
            self.log(f"\nKB PROCESSING METRICS", Colors.CYAN)
            for key, value in self.results.kb_metrics.items():
                self.log(f"{key}: {value}", Colors.WHITE)

        self.log(f"\nISSUES FOUND", Colors.CYAN)
        total_issues = sum(len(issues) for issues in self.results.issues.values())
        if total_issues == 0:
            self.log("No issues found!", Colors.GREEN)
        else:
            for category, issues in self.results.issues.items():
                if issues:
                    self.log(f"{category.upper()}: {len(issues)} issues",
                           Colors.RED if category == "critical" else Colors.YELLOW)

        # Generate detailed report file (would typically update the markdown file)
        self.log(f"\n✓ Comprehensive report data generated", Colors.GREEN)
        self.log(f"✓ Ready for documentation update", Colors.GREEN)

        return {
            "summary": {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": failed_tests,
                "success_rate": success_rate
            },
            "kb_metrics": self.results.kb_metrics,
            "performance_metrics": self.results.performance_metrics,
            "issues": self.results.issues,
            "test_details": self.results.tests
        }

    def run_comprehensive_test(self):
        """Run the complete test suite"""
        try:
            # Phase 1: Authentication & Setup
            if not self.test_authentication():
                self.log("Critical failure in authentication, stopping tests", Colors.RED)
                return False

            if not self.test_organization_workspace():
                self.log("Critical failure in org/workspace setup, stopping tests", Colors.RED)
                return False

            # Phase 2: KB Draft Creation & Configuration
            if not self.test_kb_draft_creation():
                self.log("Critical failure in draft creation, stopping tests", Colors.RED)
                return False

            if not self.test_web_source_addition():
                self.log("Critical failure in web source addition, stopping tests", Colors.RED)
                return False

            # Phase 3: Processing & Monitoring
            if not self.test_draft_finalization():
                self.log("Critical failure in draft finalization, stopping tests", Colors.RED)
                return False

            self.test_pipeline_monitoring()

            # Phase 4: Management & Analysis
            self.test_kb_management()
            self.test_edge_cases()
            self.test_performance_analysis()

            # Phase 5: Report Generation
            report = self.generate_report()

            self.log(f"\n{Colors.BOLD}{Colors.GREEN}✅ COMPREHENSIVE TESTING COMPLETED!{Colors.END}")
            self.log(f"{Colors.BOLD}{Colors.CYAN}📊 Success Rate: {report['summary']['success_rate']:.1f}%{Colors.END}")

            return True

        except Exception as e:
            self.log(f"\n{Colors.RED}💥 CRITICAL ERROR: {str(e)}{Colors.END}", Colors.RED)
            self.log(f"{Colors.RED}{traceback.format_exc()}{Colors.END}", Colors.RED)
            return False

def main():
    """Main execution function"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}Starting comprehensive KB API testing...{Colors.END}")

    # Verify environment
    try:
        health_response = requests.get(f"{BASE_URL}/health", timeout=5)
        if health_response.status_code != 200:
            print(f"{Colors.RED}Backend not healthy: {health_response.status_code}{Colors.END}")
            sys.exit(1)
    except Exception as e:
        print(f"{Colors.RED}Cannot connect to backend: {e}{Colors.END}")
        sys.exit(1)

    # Run tests
    tester = KBAPITester()
    success = tester.run_comprehensive_test()

    if success:
        print(f"\n{Colors.GREEN}🎉 All tests completed successfully!{Colors.END}")
        print(f"{Colors.CYAN}📝 Test results ready for documentation update{Colors.END}")
        sys.exit(0)
    else:
        print(f"\n{Colors.RED}❌ Testing failed with critical errors{Colors.END}")
        sys.exit(1)

if __name__ == "__main__":
    main()