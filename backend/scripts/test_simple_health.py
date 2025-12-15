#!/usr/bin/env python3
"""Simple health check test to diagnose issues"""
import sys
import requests

print("=" * 60, flush=True)
print("Simple Health Check Test", flush=True)
print("=" * 60, flush=True)

# Test 1: Health endpoint
print("\n1. Testing /health endpoint...", flush=True)
try:
    response = requests.get("http://localhost:8000/health", timeout=5)
    print(f"   Status: {response.status_code}", flush=True)
    print(f"   Response: {response.json()}", flush=True)
except Exception as e:
    print(f"   ERROR: {e}", flush=True)
    sys.exit(1)

# Test 2: Root endpoint
print("\n2. Testing / endpoint...", flush=True)
try:
    response = requests.get("http://localhost:8000/", timeout=5)
    print(f"   Status: {response.status_code}", flush=True)
    print(f"   Response: {response.json()}", flush=True)
except Exception as e:
    print(f"   ERROR: {e}", flush=True)

# Test 3: Signup endpoint
print("\n3. Testing /api/v1/auth/email/signup endpoint...", flush=True)
try:
    test_data = {
        "email": "test@example.com",
        "password": "Test123!@#",
        "username": "testuser"
    }
    response = requests.post(
        "http://localhost:8000/api/v1/auth/email/signup",
        json=test_data,
        timeout=5
    )
    print(f"   Status: {response.status_code}", flush=True)
    if response.status_code in [201, 409]:
        print(f"   Response: {response.json()}", flush=True)
    else:
        print(f"   Response: {response.text[:200]}", flush=True)
except Exception as e:
    print(f"   ERROR: {e}", flush=True)

print("\n" + "=" * 60, flush=True)
print("Test completed!", flush=True)
print("=" * 60, flush=True)
