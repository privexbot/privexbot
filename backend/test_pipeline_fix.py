#!/usr/bin/env python3
"""Minimal test to verify KB pipeline fixes"""
import requests
import time

BASE_URL = "http://localhost:8000"

# Create test user
test_id = int(time.time() * 1000) % 1000000
print(f"Creating test user (ID: {test_id})...")
signup_resp = requests.post(f"{BASE_URL}/auth/signup", json={
    "email": f"test_{test_id}@test.com",
    "password": "test123456",
    "username": f"tester_{test_id}"
})
token = signup_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Create org and workspace
print("Creating organization...")
org_resp = requests.post(f"{BASE_URL}/organizations", json={"name": f"Test Org {test_id}"}, headers=headers)
org_id = org_resp.json()["id"]

print("Creating workspace...")
ws_resp = requests.post(f"{BASE_URL}/workspaces", json={"organization_id": org_id, "name": f"Test WS {test_id}"}, headers=headers)
ws_id = ws_resp.json()["id"]

# Create KB with minimal config (only 2 pages)
print("Creating KB draft...")
kb_resp = requests.post(f"{BASE_URL}/knowledge-bases/draft", json={
    "workspace_id": ws_id,
    "name": "Pipeline Fix Test - 2 Pages",
    "description": "Testing datetime fix",
    "chunking_strategy": "recursive",
    "chunk_size": 512,
    "chunk_overlap": 50
}, headers=headers)
kb_draft_id = kb_resp.json()["draft_id"]

print("Adding web source (https://example.com, max 2 pages)...")
requests.post(f"{BASE_URL}/knowledge-bases/draft/{kb_draft_id}/sources/web", json={
    "url": "https://example.com",
    "config": {"method": "single", "max_pages": 2, "max_depth": 1}
}, headers=headers)

print("Finalizing KB...")
finalize_resp = requests.post(f"{BASE_URL}/knowledge-bases/draft/{kb_draft_id}/finalize", headers=headers)
kb_id = finalize_resp.json()["kb"]["id"]
pipeline_id = finalize_resp.json()["pipeline_id"]

print(f"\nKB ID: {kb_id}")
print(f"Pipeline ID: {pipeline_id}")
print(f"\nWaiting 45s for processing...")
print("Monitor celery logs with: docker compose -f docker-compose.dev.yml logs celery-worker --tail=50 -f")
print("\nChecking celery logs now for errors...")

# Check celery logs immediately
import subprocess
result = subprocess.run(
    ["docker", "compose", "-f", "docker-compose.dev.yml", "logs", "celery-worker", "--tail=30"],
    capture_output=True,
    text=True
)
print("\n=== Recent Celery Logs ===")
print(result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)

# Wait for processing
time.sleep(45)

# Check Qdrant collection
print(f"\n=== Checking Qdrant collection kb_{kb_id.replace('-', '_')} ===")
try:
    qdrant_resp = requests.get(f"http://localhost:6335/collections/kb_{kb_id.replace('-', '_')}")
    data = qdrant_resp.json()["result"]
    print(f"Points indexed: {data['points_count']}")
    print(f"Vectors indexed: {data['indexed_vectors_count']}")

    if data['points_count'] > 0:
        print("\n✅ SUCCESS! Vectors were indexed successfully!")
    else:
        print("\n⚠️  No vectors indexed. Check celery logs for errors.")
except Exception as e:
    print(f"❌ Error checking Qdrant: {e}")

print("\nDone!")
