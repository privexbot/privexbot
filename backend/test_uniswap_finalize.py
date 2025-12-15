#!/usr/bin/env python3
"""
Test script to finalize the Uniswap KB draft and monitor the complete pipeline
"""

import requests
import json
import time
from typing import Optional

class UniswapTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api/v1"
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.org_id: Optional[str] = None
        self.workspace_id: Optional[str] = None
        self.session = requests.Session()

    def make_request(self, method: str, endpoint: str, data=None):
        """Make authenticated request"""
        url = f"{self.api_base}{endpoint}"
        headers = {}

        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        if method == "POST":
            headers["Content-Type"] = "application/json"
            response = self.session.post(url, headers=headers, json=data)
        elif method == "GET":
            response = self.session.get(url, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")

        return response

    def authenticate(self):
        """Authenticate with test credentials"""
        print("🔐 Authenticating...")

        # Try to login first
        login_data = {
            "email": "uniswaptest@example.com",
            "password": "TestPassword123!"
        }

        response = self.make_request("POST", "/auth/email/login", login_data)

        if response.status_code == 200:
            result = response.json()
            self.token = result["access_token"]
            print("✅ Login successful!")
            return True

        # If login fails, try signup
        print("⚠️  Login failed, trying signup...")
        signup_data = {
            "email": "uniswaptest@example.com",
            "password": "TestPassword123!",
            "username": "uniswaptester"
        }

        response = self.make_request("POST", "/auth/email/signup", signup_data)

        if response.status_code == 201:
            result = response.json()
            self.token = result["access_token"]
            print("✅ Signup successful!")
            return True
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            print(response.text)
            return False

    def get_user_info(self):
        """Get user profile"""
        print("👤 Getting user info...")

        response = self.make_request("GET", "/auth/me")

        if response.status_code == 200:
            user = response.json()
            self.user_id = user["id"]
            print(f"✅ User ID: {self.user_id}")
            return True
        else:
            print(f"❌ Failed to get user info: {response.status_code}")
            return False

    def create_organization(self):
        """Create organization"""
        print("🏢 Creating organization...")

        data = {
            "name": "Uniswap Test Org",
            "billing_email": "uniswaptest@example.com"
        }

        response = self.make_request("POST", "/orgs/", data)

        if response.status_code == 201:
            org = response.json()
            self.org_id = org["id"]
            print(f"✅ Organization created: {self.org_id}")
            return True
        else:
            print(f"❌ Failed to create organization: {response.status_code}")
            return False

    def create_workspace(self):
        """Create workspace"""
        print("🏠 Creating workspace...")

        data = {
            "name": "Uniswap Test Workspace",
            "description": "Workspace for testing Uniswap KB"
        }

        response = self.make_request("POST", f"/orgs/{self.org_id}/workspaces", data)

        if response.status_code == 201:
            workspace = response.json()
            self.workspace_id = workspace["id"]
            print(f"✅ Workspace created: {self.workspace_id}")
            return True
        else:
            print(f"❌ Failed to create workspace: {response.status_code}")
            print(response.text)
            return False

    def create_uniswap_kb_draft(self):
        """Create a new Uniswap KB draft"""
        print("📝 Creating new Uniswap KB draft...")

        draft_data = {
            "name": "Real Uniswap Documentation KB - Test 2",
            "description": "Knowledge base created from real Uniswap documentation for comprehensive testing",
            "workspace_id": self.workspace_id,
            "context": "both"
        }

        response = self.make_request("POST", "/kb-drafts/", draft_data)

        if response.status_code == 201:
            result = response.json()
            draft_id = result['draft_id']
            print(f"✅ Draft created: {draft_id}")
            return draft_id
        else:
            print(f"❌ Failed to create draft: {response.status_code}")
            print(response.text)
            return None

    def add_uniswap_url(self, draft_id: str):
        """Add Uniswap documentation URL to draft"""
        print("🔗 Adding Uniswap documentation URL...")

        url_data = {
            "url": "https://docs.uniswap.org/concepts/overview"
        }

        response = self.make_request("POST", f"/kb-drafts/{draft_id}/sources/web", url_data)

        if response.status_code == 200:
            print("✅ URL added successfully")
            return True
        else:
            print(f"❌ Failed to add URL: {response.status_code}")
            print(response.text)
            return False

    def generate_preview(self, draft_id: str):
        """Generate preview for the draft"""
        print("🔍 Generating preview...")

        preview_data = {
            "chunking_strategy": "by_heading",
            "max_chunk_size": 1000,
            "chunk_overlap": 200
        }

        response = self.make_request("POST", f"/kb-drafts/{draft_id}/preview", preview_data)

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Preview generated - {result['total_chunks']} chunks from {result['pages_previewed']} pages")
            return True
        else:
            print(f"❌ Preview failed: {response.status_code}")
            print(response.text)
            return False

    def finalize_uniswap_kb(self, draft_id: str):
        """Finalize the Uniswap KB draft"""
        print("🚀 Finalizing Uniswap KB draft...")

        response = self.make_request("POST", f"/kb-drafts/{draft_id}/finalize")

        if response.status_code == 200:
            result = response.json()
            print("✅ KB finalization successful!")
            print(f"📊 KB ID: {result['kb_id']}")
            print(f"🔄 Pipeline ID: {result['pipeline_id']}")
            print(f"⏱️  Status: {result['status']}")
            return result['kb_id'], result['pipeline_id']
        else:
            print(f"❌ Finalization failed: {response.status_code}")
            print(response.text)
            return None, None

    def monitor_pipeline(self, pipeline_id: str, kb_id: str):
        """Monitor the pipeline progress"""
        print(f"📊 Monitoring pipeline: {pipeline_id}")

        for i in range(30):  # Monitor for up to 5 minutes
            response = self.make_request("GET", f"/kb-pipeline/{pipeline_id}/status")

            if response.status_code == 200:
                status = response.json()
                print(f"🔄 Status: {status['status']} - Progress: {status.get('progress_percentage', 0)}%")

                if status['status'] in ['completed', 'failed']:
                    print(f"🏁 Pipeline finished with status: {status['status']}")
                    return status['status'] == 'completed'

            time.sleep(10)  # Wait 10 seconds

        print("⏰ Monitoring timeout")
        return False

    def test_processed_kb(self, kb_id: str):
        """Test all post-finalization endpoints with real processed data"""
        print(f"🧪 Testing all post-finalization endpoints: {kb_id}")

        # Test KB stats (enhanced)
        print("📊 Testing KB Stats endpoint...")
        response = self.make_request("GET", f"/kbs/{kb_id}/stats")
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ KB Stats:")
            print(f"   Documents: Total={stats['documents']['total']}, Active={stats['documents']['active']}")
            print(f"   Chunks: Total={stats['chunks']['total']}")
            print(f"   Status: {stats['status']}")

        # Test KB documents listing
        print("📑 Testing Documents listing endpoint...")
        response = self.make_request("GET", f"/kbs/{kb_id}/documents")
        if response.status_code == 200:
            documents = response.json()
            print(f"✅ Documents Found: {len(documents['documents'])}")
            if documents['documents']:
                doc = documents['documents'][0]
                print(f"   First document: {doc['name']} ({doc['status']})")
                print(f"   Word count: {doc.get('word_count', 0)}, Chunks: {doc.get('chunk_count', 0)}")

        # Test KB chunks with pagination
        print("🔍 Testing Chunks endpoint...")
        response = self.make_request("GET", f"/kbs/{kb_id}/chunks?limit=5")
        if response.status_code == 200:
            chunks = response.json()
            print(f"✅ Chunks Found: {len(chunks['chunks'])}")
            print(f"   Total chunks: {chunks['total_chunks']}, Page: {chunks['page']}")
            if chunks['chunks']:
                first_chunk = chunks['chunks'][0]
                print(f"   First chunk preview: {first_chunk['content'][:150]}...")
                print(f"   Word count: {first_chunk.get('word_count', 0)}")

        # Test knowledge search
        print("🔎 Testing Knowledge search...")
        search_data = {
            "query": "Uniswap protocol",
            "limit": 3
        }
        response = self.make_request("POST", f"/kbs/{kb_id}/search", search_data)
        if response.status_code == 200:
            results = response.json()
            print(f"✅ Search Results: {len(results['results'])} relevant chunks found")
            if results['results']:
                best_result = results['results'][0]
                print(f"   Best match (score: {best_result['score']:.4f}): {best_result['content'][:100]}...")

        return True

    def test_draft_pages_endpoints(self, draft_id: str):
        """Test the draft pages endpoints that should return COMPLETE FULL CONTENT"""
        print(f"📄 Testing draft pages endpoints for FULL CONTENT: {draft_id}")
        print("=" * 80)

        # Test list all pages - should return FULL content
        print("📋 Testing LIST PAGES endpoint (should return FULL content)...")
        response = self.make_request("GET", f"/kb-drafts/{draft_id}/pages")
        if response.status_code == 200:
            pages = response.json()
            print(f"✅ Pages Found: {pages['total_pages']}")
            if pages['pages']:
                first_page = pages['pages'][0]
                full_content = first_page.get('content', '')

                print(f"\n📊 PAGE DETAILS:")
                print(f"   URL: {first_page['url']}")
                print(f"   Title: {first_page['title']}")
                print(f"   Character count: {first_page.get('character_count', 0)}")
                print(f"   Word count: {first_page.get('word_count', 0)}")
                print(f"   Actual content length: {len(full_content)} characters")

                if len(full_content) > 1000:  # Should have substantial content
                    print(f"✅ FULL CONTENT CONFIRMED - Contains {len(full_content)} characters")
                    print(f"\n📄 FULL CONTENT SAMPLE (first 500 chars):")
                    print("-" * 50)
                    print(full_content[:500] + "..." if len(full_content) > 500 else full_content)
                    print("-" * 50)
                    print(f"\n📄 FULL CONTENT SAMPLE (last 300 chars):")
                    print("-" * 50)
                    print("..." + full_content[-300:] if len(full_content) > 300 else full_content)
                    print("-" * 50)
                else:
                    print(f"❌ INSUFFICIENT CONTENT - Only {len(full_content)} characters")
                    print(f"   Expected: >1000 characters for real webpage")
                    print(f"   Actual content: {full_content}")
        else:
            print(f"❌ List pages failed: {response.status_code}")
            print(response.text)

        print("\n" + "=" * 80)

        # Test specific page content - should return FULL content
        print("📄 Testing SPECIFIC PAGE content endpoint (should return FULL content)...")
        response = self.make_request("GET", f"/kb-drafts/{draft_id}/pages/0")
        if response.status_code == 200:
            page = response.json()
            page_content = page.get('content', '')

            print(f"\n📊 SPECIFIC PAGE DETAILS:")
            print(f"   URL: {page['url']}")
            print(f"   Title: {page['title']}")
            print(f"   Content length: {len(page_content)} characters")
            print(f"   Word count: {page.get('word_count', 0)}")

            if len(page_content) > 1000:  # Should have substantial content
                print(f"✅ FULL CONTENT CONFIRMED - Contains {len(page_content)} characters")
                print(f"\n📄 SPECIFIC PAGE CONTENT SAMPLE (first 400 chars):")
                print("-" * 50)
                print(page_content[:400] + "..." if len(page_content) > 400 else page_content)
                print("-" * 50)

                # Verify it contains actual Uniswap content
                if "Uniswap" in page_content and "protocol" in page_content.lower():
                    print("✅ CONTENT VALIDATION: Contains expected Uniswap terminology")
                else:
                    print("⚠️  CONTENT VALIDATION: Missing expected Uniswap terminology")
            else:
                print(f"❌ INSUFFICIENT CONTENT - Only {len(page_content)} characters")
                print(f"   Expected: >1000 characters for real webpage")
                print(f"   Actual content: {page_content}")
        else:
            print(f"❌ Specific page failed: {response.status_code}")
            print(response.text)

        print("=" * 80)
        return True

def main():
    tester = UniswapTester()

    if not tester.authenticate():
        return

    if not tester.get_user_info():
        return

    if not tester.create_organization():
        return

    if not tester.create_workspace():
        return

    # Create new KB draft
    draft_id = tester.create_uniswap_kb_draft()
    if not draft_id:
        return

    # Add Uniswap URL
    if not tester.add_uniswap_url(draft_id):
        return

    # Generate preview
    if not tester.generate_preview(draft_id):
        return

    # Test draft pages endpoints (should return full content)
    tester.test_draft_pages_endpoints(draft_id)

    # Finalize the KB
    kb_id, pipeline_id = tester.finalize_uniswap_kb(draft_id)

    if kb_id and pipeline_id:
        success = tester.monitor_pipeline(pipeline_id, kb_id)

        if success:
            tester.test_processed_kb(kb_id)
            print("🎉 Uniswap KB processing completed successfully!")
        else:
            print("❌ Pipeline processing failed")
    else:
        print("❌ Failed to finalize KB")

if __name__ == "__main__":
    main()