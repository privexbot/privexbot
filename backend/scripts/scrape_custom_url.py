#!/usr/bin/env python3
"""
Scrape any URL and see results
Usage: python3 scripts/scrape_custom_url.py "https://your-url-here.com" [max_pages]
"""
import sys
import os
import time
import requests

# Add current dir to path
sys.path.insert(0, os.path.dirname(__file__))
from test_kb_end_to_end import KBTester

def scrape_url(url: str, max_pages: int = 10):
    """Scrape a URL and show results"""
    tester = KBTester()
    
    print("=" * 80)
    print(f"SCRAPING: {url}")
    print(f"Max pages: {max_pages}")
    print("=" * 80)
    
    # Setup
    print("\n1. Setting up test environment...")
    tester.test_auth_signup()
    tester.test_auth_get_current_user()
    tester.test_org_create()
    tester.test_workspace_create()
    
    # Create KB
    print(f"\n2. Creating Knowledge Base...")
    kb_data = {
        "workspace_id": tester.workspace_id,
        "name": f"Scrape: {url[:50]}...",
        "description": f"Scraped from {url}",
        "chunking_strategy": "recursive",
        "chunk_size": 1000,
        "chunk_overlap": 200
    }
    
    response = tester.make_request("POST", "/knowledge-bases/draft", data=kb_data)
    draft_id = response.json()["draft_id"]
    
    # Add source
    source_data = {
        "url": url,
        "config": {
            "method": "crawl",
            "max_pages": max_pages,
            "max_depth": 2
        }
    }
    
    tester.make_request("POST", f"/knowledge-bases/draft/{draft_id}/sources/web", data=source_data)
    
    # Finalize and process
    print(f"\n3. Starting scrape & processing...")
    response = tester.make_request("POST", f"/knowledge-bases/draft/{draft_id}/finalize")
    kb_id = response.json()["kb"]["id"]
    pipeline_id = response.json()["pipeline_id"]
    
    print(f"   KB ID: {kb_id}")
    print(f"   Pipeline ID: {pipeline_id}")
    
    # Monitor
    print(f"\n4. Monitoring pipeline (max 180s)...")
    success, status = tester.test_poll_pipeline_status(pipeline_id, max_wait=180)
    
    if success:
        print(f"\n{'=' * 80}")
        print("SUCCESS! Scraping Complete")
        print(f"{'=' * 80}")
        
        stats = status.get("stats", {})
        print(f"\n📊 Statistics:")
        for key, value in stats.items():
            print(f"   {key}: {value}")
        
        # Show samples from Qdrant
        print(f"\n📄 Sample Results from Qdrant:")
        collection_name = f"kb_{kb_id.replace('-', '_')}"
        
        try:
            resp = requests.post(
                f"http://localhost:6335/collections/{collection_name}/points/scroll",
                json={"limit": 3, "with_vector": False, "with_payload": True}
            )
            points = resp.json()["result"]["points"]
            
            for i, point in enumerate(points, 1):
                payload = point["payload"]
                print(f"\n   Chunk #{i}:")
                print(f"   ├─ Page: {payload.get('page_title', 'N/A')[:60]}")
                print(f"   ├─ URL: {payload.get('page_url', 'N/A')}")
                print(f"   └─ Content: {payload.get('content', '')[:200]}...")
        except Exception as e:
            print(f"   Could not fetch samples: {e}")
        
        print(f"\n\n✅ Done! Check Qdrant collection: {collection_name}")
    else:
        print("\n⚠️  Pipeline timed out. Check logs for details.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/scrape_custom_url.py <url> [max_pages]")
        print("Example: python3 scripts/scrape_custom_url.py 'https://docs.aws.amazon.com/secretsmanager/' 10")
        sys.exit(1)
    
    url = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    
    scrape_url(url, max_pages)
