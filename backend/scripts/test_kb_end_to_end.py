#!/usr/bin/env python3
"""
KB End-to-End Testing Script

Tests the complete Knowledge Base creation flow:
1. Authentication (signup/login)
2. Organization and workspace creation
3. KB preview testing
4. KB creation with different scenarios
5. Error handling and edge cases

Usage:
    python scripts/test_kb_end_to_end.py
"""

import requests
import json
import time
from typing import Dict, Any, Optional
from datetime import datetime


class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'


class KBTester:
    """End-to-end tester for Knowledge Base functionality"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        # Use base URL without /api/v1 prefix, add it where needed
        self.base_url = base_url
        self.api_base = f"{base_url}/api/v1"
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.org_id: Optional[str] = None
        self.workspace_id: Optional[str] = None
        self.session = requests.Session()
        self.session.headers.update({"Connection": "close"})  # Prevent connection pooling issues

    def print_header(self, text: str):
        """Print formatted header"""
        import sys
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.END}", flush=True)
        print(f"{Colors.HEADER}{Colors.BOLD}{text.center(80)}{Colors.END}", flush=True)
        print(f"{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.END}\n", flush=True)

    def print_step(self, text: str):
        """Print test step"""
        print(f"{Colors.BLUE}▶ {text}{Colors.END}", flush=True)

    def print_success(self, text: str):
        """Print success message"""
        print(f"{Colors.GREEN}✓ {text}{Colors.END}", flush=True)

    def print_error(self, text: str):
        """Print error message"""
        print(f"{Colors.RED}✗ {text}{Colors.END}", flush=True)

    def print_warning(self, text: str):
        """Print warning message"""
        print(f"{Colors.YELLOW}⚠ {text}{Colors.END}", flush=True)

    def print_info(self, text: str):
        """Print info message"""
        print(f"{Colors.CYAN}ℹ {text}{Colors.END}", flush=True)

    def print_json(self, data: Dict[str, Any], title: str = "Response"):
        """Print formatted JSON"""
        print(f"{Colors.CYAN}{title}:{Colors.END}")
        print(json.dumps(data, indent=2))

    def make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        expect_success: bool = True,
        use_api_base: bool = True,
        timeout: int = 30
    ) -> requests.Response:
        """Make HTTP request with error handling"""
        # Use api_base for API endpoints, base_url for health/root
        base = self.api_base if use_api_base else self.base_url
        url = f"{base}{endpoint}"
        headers = {}

        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        try:
            if method == "GET":
                response = self.session.get(url, headers=headers, params=params, timeout=timeout)
            elif method == "POST":
                headers["Content-Type"] = "application/json"
                response = self.session.post(url, headers=headers, json=data, timeout=timeout)
            elif method == "PUT":
                headers["Content-Type"] = "application/json"
                response = self.session.put(url, headers=headers, json=data, timeout=timeout)
            elif method == "DELETE":
                response = self.session.delete(url, headers=headers, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")

            if expect_success and not response.ok:
                self.print_error(f"Request failed: {method} {endpoint}")
                self.print_error(f"Status: {response.status_code}")
                try:
                    self.print_json(response.json(), "Error Response")
                except:
                    self.print_error(f"Response: {response.text}")

            return response

        except requests.exceptions.Timeout:
            self.print_error(f"Request timeout after {timeout}s: {method} {url}")
            raise
        except requests.exceptions.ConnectionError as e:
            self.print_error(f"Connection error: {method} {url}")
            self.print_error(f"Error: {str(e)}")
            raise
        except Exception as e:
            self.print_error(f"Request exception: {str(e)}")
            raise

    def test_health_check(self):
        """Test API health"""
        self.print_step("Testing API health...")

        try:
            # Health endpoint is at /health (not /api/v1/health)
            response = self.make_request("GET", "/health", expect_success=False, use_api_base=False, timeout=10)

            if response.ok:
                health_data = response.json()
                self.print_success(f"API is healthy: {health_data.get('status', 'unknown')}")
                self.print_info(f"Service: {health_data.get('service', 'unknown')}")
                return True
            else:
                self.print_warning(f"Health check returned status {response.status_code}")
                # Try root endpoint as fallback
                response = self.make_request("GET", "/", expect_success=False, use_api_base=False, timeout=10)
                if response.ok:
                    self.print_success("API root endpoint is accessible")
                    return True
                return False

        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            self.print_error(f"Cannot reach API: {type(e).__name__}")
            self.print_error(f"Make sure the backend is running: docker compose -f docker-compose.dev.yml up -d")
            return False
        except Exception as e:
            self.print_error(f"Unexpected error during health check: {str(e)}")
            return False

    def test_auth_signup(self, email: str, password: str, username: str):
        """Test user signup"""
        self.print_step(f"Signing up user: {email}")

        data = {
            "email": email,
            "password": password,
            "username": username
        }

        response = self.make_request("POST", "/auth/email/signup", data=data, expect_success=False)

        if response.status_code == 201:
            result = response.json()
            self.token = result["access_token"]
            self.print_success(f"Signup successful! Token received")
            return True
        elif response.status_code == 409:
            self.print_warning("User already exists, trying login instead...")
            return self.test_auth_login(email, password)
        else:
            self.print_error(f"Signup failed: {response.status_code}")
            return False

    def test_auth_login(self, email: str, password: str):
        """Test user login"""
        self.print_step(f"Logging in user: {email}")

        data = {
            "email": email,
            "password": password
        }

        response = self.make_request("POST", "/auth/email/login", data=data)

        if response.ok:
            result = response.json()
            self.token = result["access_token"]
            self.print_success("Login successful! Token received")
            return True
        else:
            return False

    def test_get_current_user(self):
        """Get current user profile"""
        self.print_step("Fetching current user profile...")

        response = self.make_request("GET", "/auth/me")

        if response.ok:
            user = response.json()
            self.user_id = user["id"]
            self.print_success(f"User ID: {self.user_id}")
            self.print_success(f"Username: {user['username']}")
            return True
        else:
            return False

    def test_create_organization(self, name: str, email: str):
        """Create organization"""
        self.print_step(f"Creating organization: {name}")

        data = {
            "name": name,
            "billing_email": email
        }

        response = self.make_request("POST", "/orgs", data=data, expect_success=False)

        if response.status_code in [200, 201]:
            org = response.json()
            self.org_id = org["id"]
            self.print_success(f"Organization created: {self.org_id}")
            return True
        else:
            # Try to get existing organizations
            self.print_warning("Could not create organization, fetching existing ones...")
            response = self.make_request("GET", "/orgs", expect_success=False)
            if response.ok:
                orgs = response.json()
                # Handle different response formats
                if isinstance(orgs, dict) and "items" in orgs:
                    orgs = orgs["items"]
                if isinstance(orgs, list) and len(orgs) > 0:
                    self.org_id = orgs[0]["id"]
                    self.print_success(f"Using existing organization: {self.org_id}")
                    return True
            self.print_error("Could not create or find any existing organizations")
            return False

    def test_create_workspace(self, name: str):
        """Create workspace"""
        self.print_step(f"Creating workspace: {name}")

        data = {
            "name": name,
            "description": "Test workspace for KB testing"
        }

        response = self.make_request("POST", f"/orgs/{self.org_id}/workspaces", data=data, expect_success=False)

        if response.status_code in [200, 201]:
            workspace = response.json()
            self.workspace_id = workspace["id"]
            self.print_success(f"Workspace created: {self.workspace_id}")
            return True
        else:
            # Try to get existing workspaces
            self.print_warning("Could not create workspace, fetching existing ones...")
            response = self.make_request("GET", f"/orgs/{self.org_id}/workspaces", expect_success=False)
            if response.ok:
                workspaces = response.json()
                if workspaces:
                    self.workspace_id = workspaces[0]["id"]
                    self.print_success(f"Using existing workspace: {self.workspace_id}")
                    return True
            return False

    def test_preview_simple(self, url: str):
        """Test simple chunking preview"""
        self.print_header("TEST: Simple Chunking Preview")
        self.print_step(f"Testing preview for URL: {url}")

        data = {
            "url": url,
            "chunking_config": {
                "strategy": "by_heading",
                "chunk_size": 1000,
                "chunk_overlap": 200
            }
        }

        response = self.make_request("POST", "/kb-drafts/preview", data=data)

        if response.ok:
            result = response.json()
            self.print_success(f"Preview generated successfully!")
            self.print_info(f"Total chunks: {result.get('total_chunks', 0)}")

            preview_chunks = result.get('preview_chunks', [])
            self.print_info(f"Preview chunks shown: {len(preview_chunks)}")

            if preview_chunks:
                self.print_info("\nFirst chunk preview:")
                first_chunk = preview_chunks[0]
                print(f"  Content: {first_chunk.get('content', '')[:200]}...")
                print(f"  Metadata: {first_chunk.get('metadata', {})}")

            return True
        else:
            return False

    def test_create_kb_draft(self, name: str):
        """Create KB draft"""
        self.print_step(f"Creating KB draft: {name}")

        data = {
            "name": name,
            "description": "Test KB for Secret Network documentation",
            "workspace_id": self.workspace_id,
            "context": "both"
        }

        response = self.make_request("POST", "/kb-drafts/", data=data)

        if response.ok:
            draft = response.json()
            draft_id = draft["draft_id"]
            self.print_success(f"Draft created: {draft_id}")
            return draft_id
        else:
            return None

    def test_add_web_source(self, draft_id: str, url: str, max_pages: int = 10, max_depth: int = 2):
        """Add web source to draft"""
        self.print_step(f"Adding web source: {url}")
        self.print_info(f"Config: max_pages={max_pages}, max_depth={max_depth}")

        data = {
            "url": url,
            "config": {
                "method": "crawl",
                "max_pages": max_pages,
                "max_depth": max_depth,
                "stealth_mode": True
            }
        }

        response = self.make_request("POST", f"/kb-drafts/{draft_id}/sources/web", data=data)

        if response.ok:
            result = response.json()
            self.print_success("Web source added to draft")
            return True
        else:
            return False

    def test_draft_preview(self, draft_id: str, max_preview_pages: int = 5):
        """Test draft-based preview"""
        self.print_step(f"Generating preview for draft (max {max_preview_pages} pages)...")

        data = {
            "max_preview_pages": max_preview_pages
        }

        response = self.make_request("POST", f"/kb-drafts/{draft_id}/preview", data=data)

        if response.ok:
            result = response.json()
            self.print_success("Preview generated!")
            self.print_info(f"Pages previewed: {result.get('pages_previewed', 0)}")
            self.print_info(f"Total chunks: {result.get('total_chunks', 0)}")
            self.print_info(f"Preview chunks: {len(result.get('preview_chunks', []))}")

            # Show sample chunks
            preview_chunks = result.get('preview_chunks', [])
            if preview_chunks:
                self.print_info(f"\nShowing first 3 chunks:")
                for i, chunk in enumerate(preview_chunks[:3]):
                    print(f"\n  Chunk {i+1}:")
                    print(f"    Content: {chunk.get('content', '')[:150]}...")
                    print(f"    Metadata: {chunk.get('metadata', {})}")

            return True
        else:
            return False

    def test_finalize_kb(self, draft_id: str):
        """Finalize KB and start processing"""
        self.print_step("Finalizing KB and starting background processing...")

        response = self.make_request("POST", f"/kb-drafts/{draft_id}/finalize")

        if response.ok:
            result = response.json()
            kb_id = result.get("kb_id")
            pipeline_id = result.get("pipeline_id")

            self.print_success(f"KB finalized!")
            self.print_info(f"KB ID: {kb_id}")
            self.print_info(f"Pipeline ID: {pipeline_id}")

            return kb_id, pipeline_id
        else:
            return None, None

    def test_poll_pipeline_status(self, pipeline_id: str, max_wait: int = 300, poll_interval: int = 5):
        """Poll pipeline status until completion with retry logic for connection errors"""
        self.print_step(f"Polling pipeline status (max {max_wait}s)...")

        start_time = time.time()
        last_progress = -1
        consecutive_errors = 0
        max_consecutive_errors = 5

        while time.time() - start_time < max_wait:
            try:
                response = self.make_request("GET", f"/kb-pipeline/{pipeline_id}/status", expect_success=False)

                if response.ok:
                    consecutive_errors = 0  # Reset error counter on success
                    status = response.json()
                    current_status = status.get("status")

                    # Print progress update
                    current_progress = status.get("progress_percentage", 0)
                    if current_progress != last_progress:
                        self.print_info(f"Status: {current_status} - {current_progress}% complete")
                        last_progress = current_progress

                    # Check if completed
                    if current_status in ["completed", "ready", "ready_with_warnings"]:
                        self.print_success(f"Pipeline completed: {current_status}")
                        stats = status.get("stats", {})
                        self.print_info(f"Stats: {stats}")
                        return True, status

                    # Check if failed
                    if current_status == "failed":
                        self.print_error("Pipeline failed!")
                        error = status.get("error_message", "Unknown error")
                        self.print_error(f"Error: {error}")
                        return False, status

            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                consecutive_errors += 1
                self.print_warning(f"Connection error (attempt {consecutive_errors}/{max_consecutive_errors}): {type(e).__name__}")

                if consecutive_errors >= max_consecutive_errors:
                    self.print_error(f"Max consecutive errors ({max_consecutive_errors}) reached")
                    return False, None

                # Exponential backoff: wait longer after each error
                backoff_time = min(2 ** consecutive_errors, 30)  # Max 30s backoff
                self.print_info(f"Retrying in {backoff_time}s...")
                time.sleep(backoff_time)
                continue

            time.sleep(poll_interval)

        self.print_warning("Polling timeout reached")
        return False, None

    def test_get_kb_details(self, kb_id: str):
        """Get KB details"""
        self.print_step(f"Fetching KB details...")

        response = self.make_request("GET", f"/kbs/{kb_id}")

        if response.ok:
            kb = response.json()
            self.print_success("KB details fetched")
            self.print_info(f"Name: {kb.get('name')}")
            self.print_info(f"Status: {kb.get('status')}")
            self.print_info(f"Total documents: {kb.get('total_documents', 0)}")
            self.print_info(f"Total chunks: {kb.get('total_chunks', 0)}")
            return kb
        else:
            return None

    def run_scenario_1(self):
        """Scenario 1: Preview and create KB with first 10 pages"""
        self.print_header("SCENARIO 1: Preview and Create KB (First 10 Pages)")

        url = "https://docs.scrt.network/secret-network-documentation"

        # Test simple preview first
        if not self.test_preview_simple(url):
            self.print_error("Preview failed, cannot continue scenario 1")
            return False

        # Create draft
        draft_id = self.test_create_kb_draft("Secret Network Docs - First 10 Pages")
        if not draft_id:
            return False

        # Add web source with limit of 10 pages
        if not self.test_add_web_source(draft_id, url, max_pages=10, max_depth=2):
            return False

        # Preview draft
        if not self.test_draft_preview(draft_id, max_preview_pages=5):
            return False

        # Finalize KB
        kb_id, pipeline_id = self.test_finalize_kb(draft_id)
        if not kb_id:
            return False

        # Poll until completion
        success, status = self.test_poll_pipeline_status(pipeline_id, max_wait=180)

        if success:
            # Get final KB details
            self.test_get_kb_details(kb_id)
            self.print_success("Scenario 1 completed successfully!")
            return True
        else:
            self.print_error("Scenario 1 failed during processing")
            return False

    def run_scenario_2(self):
        """Scenario 2: Create KB with page that has subsections"""
        self.print_header("SCENARIO 2: Page with Subsections")

        # Test with the nested page
        url = "https://docs.scrt.network/secret-network-documentation/secret-ai/sdk/setting-up-your-environment"

        # Test preview
        if not self.test_preview_simple(url):
            self.print_error("Preview failed, cannot continue scenario 2")
            return False

        # Create draft
        draft_id = self.test_create_kb_draft("Secret Network - Environment Setup")
        if not draft_id:
            return False

        # Add web source - this page has subsections
        if not self.test_add_web_source(draft_id, url, max_pages=10, max_depth=3):
            return False

        # Preview
        if not self.test_draft_preview(draft_id, max_preview_pages=5):
            return False

        # Finalize
        kb_id, pipeline_id = self.test_finalize_kb(draft_id)
        if not kb_id:
            return False

        # Poll
        success, status = self.test_poll_pipeline_status(pipeline_id, max_wait=180)

        if success:
            self.test_get_kb_details(kb_id)
            self.print_success("Scenario 2 completed successfully!")
            return True
        else:
            self.print_error("Scenario 2 failed during processing")
            return False

    def run_all_tests(self):
        """Run complete test suite"""
        self.print_header("KB END-TO-END TESTING")

        results = {}

        # Health check
        self.print_header("STEP 1: API Health Check")
        results["health"] = self.test_health_check()
        if not results["health"]:
            self.print_error("API is not accessible. Aborting tests.")
            return results

        # Authentication
        self.print_header("STEP 2: Authentication")
        email = f"kb_test_{int(time.time())}@test.com"
        password = "Test123!@#"
        username = f"kb_tester_{int(time.time())}"

        results["signup"] = self.test_auth_signup(email, password, username)
        if not results["signup"]:
            self.print_error("Authentication failed. Aborting tests.")
            return results

        results["get_user"] = self.test_get_current_user()

        # Organization and Workspace
        self.print_header("STEP 3: Organization & Workspace Setup")
        results["org"] = self.test_create_organization(
            name=f"KB Test Org {int(time.time())}",
            email=email
        )
        if not results["org"]:
            self.print_error("Organization creation failed. Aborting tests.")
            return results

        results["workspace"] = self.test_create_workspace(f"KB Test Workspace {int(time.time())}")
        if not results["workspace"]:
            self.print_error("Workspace creation failed. Aborting tests.")
            return results

        # Test scenarios
        results["scenario_1"] = self.run_scenario_1()
        results["scenario_2"] = self.run_scenario_2()

        # Print summary
        self.print_header("TEST SUMMARY")

        passed = sum(1 for v in results.values() if v)
        total = len(results)

        for test, result in results.items():
            if result:
                self.print_success(f"{test}: PASSED")
            else:
                self.print_error(f"{test}: FAILED")

        print(f"\n{Colors.BOLD}Total: {passed}/{total} tests passed{Colors.END}\n")

        return results


def main():
    """Main entry point"""
    tester = KBTester()
    results = tester.run_all_tests()

    # Exit with appropriate code
    all_passed = all(results.values())
    exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
