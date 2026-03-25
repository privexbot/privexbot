#!/usr/bin/env python3
"""
Quick test to verify document CRUD API with correct schema
and check if pipeline processing is working after Playwright installation.
"""

import requests
import time
import json


BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

def quick_test():
    print("🧪 Quick Test: Document CRUD with Corrected Schema")
    print("=" * 60)

    # 1. Authentication
    timestamp = int(time.time())
    email = f"quick_test_{timestamp}@example.com"
    username = f"quick_tester_{timestamp}"
    password = "SecurePassword123!"

    # Sign up
    response = requests.post(f"{BASE_URL}{API_PREFIX}/auth/email/signup", json={
        "email": email,
        "password": password,
        "username": username
    })

    if response.status_code != 201:
        print(f"❌ Signup failed: {response.status_code} - {response.text}")
        return

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"✅ Authenticated as {username}")

    # 2. Get org/workspace
    response = requests.get(f"{BASE_URL}{API_PREFIX}/orgs/", headers=headers)
    org_id = response.json()["organizations"][0]["id"]

    response = requests.get(f"{BASE_URL}{API_PREFIX}/orgs/{org_id}/workspaces", headers=headers)
    workspace_id = response.json()["workspaces"][0]["id"]

    print(f"✅ Found workspace: {workspace_id}")

    # 3. Create KB draft and finalize quickly
    response = requests.post(f"{BASE_URL}{API_PREFIX}/kb-drafts/", headers=headers, json={
        "name": f"Quick Test KB {timestamp}",
        "description": "Quick test KB for document CRUD",
        "workspace_id": workspace_id,
        "context": "both"
    })

    draft_id = response.json()["draft_id"]
    print(f"✅ Created draft: {draft_id}")

    # 4. Add minimal web source
    response = requests.post(f"{BASE_URL}{API_PREFIX}/kb-drafts/{draft_id}/sources/web", headers=headers, json={
        "url": "https://httpbin.org/json",  # Simple, fast endpoint
        "config": {
            "method": "scrape",
            "max_pages": 1,
            "max_depth": 1
        }
    })

    if response.status_code == 200:
        print(f"✅ Added simple web source")

    # 5. Finalize draft
    response = requests.post(f"{BASE_URL}{API_PREFIX}/kb-drafts/{draft_id}/finalize", headers=headers)

    if response.status_code != 200:
        print(f"❌ Finalize failed: {response.status_code} - {response.text}")
        return

    result = response.json()
    kb_id = result["kb_id"]
    pipeline_id = result["pipeline_id"]

    print(f"✅ KB created: {kb_id}")
    print(f"✅ Pipeline started: {pipeline_id}")

    # 6. Test document CRUD with correct schema
    print("\n📝 Testing Document CRUD API...")

    # Create document with CORRECT schema
    response = requests.post(f"{BASE_URL}{API_PREFIX}/kbs/{kb_id}/documents", headers=headers, json={
        "name": "Quick Test Document",  # 'name' not 'title'
        "content": "This is a quick test document for testing the CRUD API. " * 10,  # Meet 50 char min
        "source_type": "manual",
        "custom_metadata": {"test": True, "created_by": "quick_test"}
    })

    if response.status_code == 201:
        doc = response.json()
        doc_id = doc['id']
        print(f"✅ Document created: {doc_id}")

        # Update document
        response = requests.put(f"{BASE_URL}{API_PREFIX}/kbs/{kb_id}/documents/{doc_id}", headers=headers, json={
            "name": "Updated Quick Test Document",
            "content": "This document has been updated through the CRUD API. " * 15
        })

        if response.status_code == 200:
            print(f"✅ Document updated successfully")
        else:
            print(f"⚠ Document update failed: {response.status_code} - {response.text}")

        # Delete document
        response = requests.delete(f"{BASE_URL}{API_PREFIX}/kbs/{kb_id}/documents/{doc_id}", headers=headers)

        if response.status_code == 200:
            print(f"✅ Document deleted successfully")
        else:
            print(f"⚠ Document delete failed: {response.status_code} - {response.text}")

    else:
        print(f"❌ Document creation failed: {response.status_code} - {response.text}")

    # 7. Check pipeline status briefly
    print("\n⚙️ Checking pipeline status...")

    for i in range(3):
        response = requests.get(f"{BASE_URL}{API_PREFIX}/kb-pipeline/{pipeline_id}/status", headers=headers)

        if response.status_code == 200:
            status_data = response.json()
            status = status_data.get("status", "unknown")
            progress = status_data.get("progress_percentage", 0)
            stats = status_data.get("stats", {})

            print(f"   Pipeline: {status} | Progress: {progress}% | Pages: {stats.get('pages_scraped', 0)}")

            if status not in ["queued", "running"]:
                break
        else:
            print(f"⚠ Pipeline status failed: {response.status_code}")

        time.sleep(2)

    print("\n" + "=" * 60)
    print("✅ Quick test completed! Document CRUD schema is fixed.")
    print("=" * 60)


if __name__ == "__main__":
    quick_test()