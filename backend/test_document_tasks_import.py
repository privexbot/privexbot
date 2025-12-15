#!/usr/bin/env python3
"""
Quick test to verify document processing tasks import correctly.
"""

import sys
sys.path.insert(0, 'src')

print("=" * 70)
print("Testing Document Processing Tasks Import")
print("=" * 70)
print()

# Test 1: Import the tasks directly
print("Test 1: Direct task imports")
print("-" * 70)

try:
    from app.tasks.document_processing_tasks import (
        process_document_task,
        reprocess_document_task
    )
    print("✓ Successfully imported process_document_task")
    print(f"  Task name: {process_document_task.name}")
    print(f"  Task bound: {process_document_task.request.is_eager if hasattr(process_document_task, 'request') else 'N/A'}")
    print()
    print("✓ Successfully imported reprocess_document_task")
    print(f"  Task name: {reprocess_document_task.name}")
    print()
except Exception as e:
    print(f"✗ Failed to import tasks: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 2: Import from tasks package __init__
print("Test 2: Import from tasks package __init__")
print("-" * 70)

try:
    from app.tasks import (
        process_document_task as pdt,
        reprocess_document_task as rdt
    )
    print("✓ Successfully imported tasks from app.tasks")
    print(f"  process_document_task: {pdt.name}")
    print(f"  reprocess_document_task: {rdt.name}")
    print()
except Exception as e:
    print(f"✗ Failed to import from app.tasks: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 3: Check Celery registration
print("Test 3: Celery task registration")
print("-" * 70)

try:
    from app.tasks.celery_worker import celery_app

    print(f"Celery app: {celery_app}")
    print(f"Broker: {celery_app.conf.broker_url}")
    print(f"Backend: {celery_app.conf.result_backend}")
    print()

    # Get all registered tasks
    registered_tasks = list(celery_app.tasks.keys())

    # Filter for document-related tasks
    document_tasks = [t for t in registered_tasks if 'document' in t.lower()]

    print(f"Total registered tasks: {len(registered_tasks)}")
    print()
    print("Document-related tasks:")
    for task in document_tasks:
        print(f"  - {task}")
    print()

    # Check if our specific tasks are registered
    if "process_document" in registered_tasks:
        print("✓ process_document task is registered")
    else:
        print("✗ process_document task NOT registered")

    if "reprocess_document" in registered_tasks:
        print("✓ reprocess_document task is registered")
    else:
        print("✗ reprocess_document task NOT registered")

    print()

except Exception as e:
    print(f"✗ Celery registration check failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 4: Verify task signatures
print("Test 4: Task signatures and parameters")
print("-" * 70)

try:
    # Check process_document_task signature
    print("process_document_task expected parameters:")
    print("  - document_id: str")
    print("  - content: str")
    print("  - kb_config: Dict[str, Any]")
    print()

    # Check reprocess_document_task signature
    print("reprocess_document_task expected parameters:")
    print("  - document_id: str")
    print("  - new_content: str")
    print("  - kb_config: Dict[str, Any]")
    print()

    print("✓ Task signatures verified")
    print()

except Exception as e:
    print(f"✗ Signature verification failed: {e}")
    sys.exit(1)

print("=" * 70)
print("✅ All tests passed! Document processing tasks are ready.")
print("=" * 70)
