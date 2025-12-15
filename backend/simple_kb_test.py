#!/usr/bin/env python3
"""Simple KB test to debug Qdrant indexing"""
import requests
import time
import random

BASE_URL = "http://localhost:8000"

# Generate unique test ID
test_id = int(time.time() * 1000) % 1000000

print("=== Creating test user ===")
signup_data = {
    "email": f"test_{test_id}@test.com",
    "password": "test123456",
    "username": f"tester_{test_id}"
}
signup_resp = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
token = signup_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("=== Creating organization ===")
org_data = {"name": f"Test Org {test_id}", "description": "Test org"}
org_resp = requests.post(f"{BASE_URL}/organizations", json=org_data, headers=headers)
org_id = org_resp.json()["id"]

print("=== Creating workspace ===")
ws_data = {"organization_id": org_id, "name": f"Test WS {test_id}"}
ws_resp = requests.post(f"{BASE_URL}/workspaces", json=ws_data, headers=headers)
ws_id = ws_resp.json()["id"]

print("=== Creating KB ===")
kb_data = {
    "workspace_id": ws_id,
    "name": "Test KB - 2 Pages",
    "description": "Small test",
    "chunking_strategy": "recursive",
    "chunk_size": 512,
    "chunk_overlap": 50
}
kb_resp = requests.post(f"{BASE_URL}/knowledge-bases/draft", json=kb_data, headers=headers)
kb_draft_id = kb_resp.json()["draft_id"]

print(f"KB Draft ID: {kb_draft_id}")

print("=== Adding web source ===")
source_data = {
    "url": "https://example.com",
    "config": {"method": "single", "max_pages": 2, "max_depth": 1}
}
requests.post(f"{BASE_URL}/knowledge-bases/draft/{kb_draft_id}/sources/web",
              json=source_data, headers=headers)

print("=== Finalizing KB ===")
finalize_resp = requests.post(f"{BASE_URL}/knowledge-bases/draft/{kb_draft_id}/finalize",
                               headers=headers)
kb_id = finalize_resp.json()["kb"]["id"]
pipeline_id = finalize_resp.json()["pipeline_id"]

print(f"KB ID: {kb_id}")
print(f"Pipeline ID: {pipeline_id}")
print(f"\nMonitor celery logs for DEBUG output...")
print(f"Waiting 30s for processing...")
time.sleep(30)

print("\nDone! Check celery logs above for errors.")
