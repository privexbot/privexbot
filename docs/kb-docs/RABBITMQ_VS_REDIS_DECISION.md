# RabbitMQ vs Redis for Celery: Technical Decision

**Decision:** Use **Redis** (stick with what you have)
**Confidence:** High
**Reasoning:** Based on your existing architecture and scale

---

## Quick Answer

**For your use case (PrivexBot document processing):**

✅ **Use Redis** as Celery broker (what you already have)
❌ **Don't add RabbitMQ** (unnecessary complexity)

---

## Why Redis is Better for Your Case

### 1. You Already Have It Running

```python
# Your current setup (from code analysis):
CELERY_BROKER_URL = "redis://redis:6379/0"
CELERY_RESULT_BACKEND = "redis://redis:6379/1"

# Redis is already:
✅ Running in Docker
✅ Configured for Celery
✅ Handling drafts (24hr TTL)
✅ Caching data
✅ Working in production
```

**Adding RabbitMQ would mean:**
- ❌ Another Docker container (memory overhead)
- ❌ Another service to monitor
- ❌ Another failure point
- ❌ More operational complexity
- ❌ No real benefit at your scale

### 2. Your Scale Doesn't Need RabbitMQ

**Your Expected Volume:**
```
Documents/day: 100-500
Messages/day: 1,000-5,000 (including status updates)
Peak: ~10 messages/second
```

**Redis can easily handle:**
```
Messages/second: 50,000+
Throughput: Far exceeds your needs
Latency: <1ms (in-memory)
```

**RabbitMQ is overkill when:**
- Volume < 100,000 messages/day ✅ (you're at 1,000-5,000)
- Simple queue patterns ✅ (you have: file processing, embeddings, indexing)
- Speed matters more than absolute reliability ✅ (document processing isn't financial transactions)

### 3. Simpler Architecture

**Current (Redis):**
```
┌─────────────┐
│   Backend   │
│   (API)     │
└─────┬───────┘
      │
      ▼
┌─────────────┐    ┌──────────────┐
│    Redis    │───→│    Celery    │
│             │    │    Workers   │
│ - Broker    │    │              │
│ - Cache     │    │ - Process    │
│ - Drafts    │    │ - Embed      │
│ - Results   │    │ - Index      │
└─────────────┘    └──────────────┘

Services: 1 (Redis)
Connections: Simple
Failure points: 1
Memory: ~512MB
```

**With RabbitMQ (Unnecessary):**
```
┌─────────────┐
│   Backend   │
│   (API)     │
└─────┬───┬───┘
      │   │
      ▼   ▼
┌─────────┐  ┌─────────────┐    ┌──────────────┐
│  Redis  │  │  RabbitMQ   │───→│    Celery    │
│         │  │             │    │    Workers   │
│ - Cache │  │ - Broker    │    │              │
│ - Drafts│  │ - Queues    │    │ - Process    │
│ - Results│ │             │    │ - Embed      │
└─────────┘  └─────────────┘    │ - Index      │
                                 └──────────────┘

Services: 2 (Redis + RabbitMQ)
Connections: Complex
Failure points: 2
Memory: ~2GB (Redis 512MB + RabbitMQ 1.5GB)
```

**Verdict:** Doubled complexity for zero benefit.

---

## When to Use RabbitMQ vs Redis

### Use RabbitMQ When:

1. **Very High Volume**
   - Millions of messages per day
   - 1,000+ messages/second sustained
   - Example: Financial trading systems, IoT sensor networks

2. **Complex Routing Needed**
   - Topic-based routing (e.g., `payments.*.verified`)
   - Header-based routing (e.g., `priority=high`)
   - Fanout patterns (broadcast to multiple consumers)
   - Example: Multi-tenant notification systems

3. **Absolute Reliability Required**
   - Messages must survive server crashes
   - Guaranteed delivery with acknowledgments
   - No message loss acceptable
   - Example: Banking transactions, order processing

4. **Message Priority Queues**
   - Strict ordering with priorities
   - Need to process high-priority messages first
   - Example: Emergency alerts, VIP customer requests

5. **Advanced Features Needed**
   - Dead letter queues (failed message handling)
   - Delayed/scheduled messages
   - Message TTL with custom policies
   - Federation across data centers

### Use Redis When:

1. **Moderate Volume** ✅ **← Your Case**
   - Thousands to hundreds of thousands messages/day
   - <100 messages/second
   - Example: Document processing, background jobs, email sending

2. **Simple Queue Patterns** ✅ **← Your Case**
   - Basic FIFO queues (first in, first out)
   - No complex routing needed
   - Example: Task queues, job processing

3. **Speed Over Absolute Reliability** ✅ **← Your Case**
   - In-memory = ultra-fast (<1ms latency)
   - Acceptable to lose messages on rare Redis crash
   - Not financial/critical data
   - Example: Analytics, caching, document processing

4. **Already Using Redis** ✅ **← Your Case**
   - Redis for caching/sessions
   - Simplify infrastructure
   - One service, multiple uses

5. **Lower Operational Overhead** ✅ **← Your Case**
   - Smaller team
   - Less DevOps resources
   - Example: Startups, small teams, MVPs

---

## Technical Comparison

### Performance

| Metric | Redis | RabbitMQ | Your Needs |
|--------|-------|----------|------------|
| **Throughput** | 50,000+ msg/s | 10,000-20,000 msg/s | ~10 msg/s |
| **Latency** | <1ms | 1-5ms | <100ms OK |
| **Memory** | 512MB | 1-2GB | Minimize |
| **CPU** | Low | Medium | CPU for embeddings |

**Winner for your case:** Redis (faster, less resources)

### Reliability

| Feature | Redis | RabbitMQ | Your Needs |
|---------|-------|----------|------------|
| **Persistence** | Optional (AOF/RDB) | Built-in | Not critical |
| **Acknowledgments** | Via Celery | Native | Celery handles it |
| **Message Loss Risk** | Low (with persistence) | Very Low | Acceptable |
| **Crash Recovery** | Fast | Medium | Either OK |

**Winner for your case:** Tie (both sufficient)

### Operational Complexity

| Aspect | Redis | RabbitMQ | Your Preference |
|--------|-------|----------|----------------|
| **Setup** | Simple | Medium | Simple |
| **Configuration** | Minimal | Extensive | Minimal |
| **Monitoring** | Basic | Advanced | Basic OK |
| **Debugging** | Easy | Medium | Easy |
| **Scaling** | Vertical | Horizontal | Not needed yet |

**Winner for your case:** Redis (simpler)

---

## How Redis Works as Celery Broker

### Message Flow

```python
1. Backend API
   ├─ User finalizes KB draft
   └─ Queues task:

from app.tasks.kb_pipeline_tasks import process_web_kb_task

result = process_web_kb_task.apply_async(
    kwargs={
        "kb_id": kb_id,
        "pipeline_id": pipeline_id,
        "sources": sources,
        "config": config
    },
    queue="high_priority"  # Or "file_processing", "embeddings", etc.
)

2. Redis (Broker)
   ├─ Stores task in queue: "celery:queue:high_priority"
   ├─ Format: JSON serialized task
   ├─ Data structure: List (LPUSH/BRPOP)
   └─ Persistence: Optional AOF/RDB

3. Celery Worker
   ├─ Polls queue: BRPOP "celery:queue:high_priority"
   ├─ Gets task from Redis
   ├─ Executes: process_web_kb_task()
   └─ Stores result in Redis: "celery-task-meta-{task_id}"

4. Backend API
   ├─ Checks result: result.ready()
   ├─ Gets status from Redis
   └─ Returns to user
```

### How It Handles Failures

**1. Worker Crashes Mid-Task:**
```
Problem: Worker dies while processing document

Redis Solution:
- Task marked as "processing" but no result
- Celery detects timeout (soft_time_limit=540s)
- Task auto-retries (max_retries=3)
- If all retries fail → task marked as FAILURE

Your config (add to celery_config.py):
task_acks_late = True  # Don't ack until task completes
task_reject_on_worker_lost = True  # Requeue if worker dies
```

**2. Redis Crashes:**
```
Problem: Redis server restarts

Redis Solution:
- Enable persistence: appendonly yes (AOF)
- On restart: Replay AOF log → recover messages
- Downtime: ~1-5 seconds
- Messages lost: None (with AOF) or recent ones (with RDB)

Your config (.env):
REDIS_APPENDONLY=yes
REDIS_APPENDFSYNC=everysec  # Balance performance/durability
```

**3. Message Delivery Guarantees:**
```
At-Most-Once: Default Redis (fast, may lose on crash)
At-Least-Once: Redis + AOF + task_acks_late=True ✅ Recommended
Exactly-Once: Not possible (need RabbitMQ + idempotent tasks)

Your case: At-least-once is perfect
- Document processing is idempotent (can retry safely)
- Occasional duplicate is fine (check if already processed)
```

---

## Configuration for Production

### Recommended Redis Config for Celery

**File:** `backend/docker/redis/redis.conf` (create if needed)

```conf
# Persistence (balance performance vs durability)
appendonly yes
appendfsync everysec  # Sync every second (1s data loss max)

# Memory management
maxmemory 2gb
maxmemory-policy allkeys-lru  # Evict old keys if full

# Performance
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Celery queue optimization
list-max-ziplist-size -2
list-compress-depth 0
```

**File:** `backend/src/app/core/celery_config.py` (update existing)

```python
# Celery + Redis Configuration
broker_url = 'redis://redis:6379/0'
result_backend = 'redis://redis:6379/1'

# Reliability
task_acks_late = True  # ✅ Acknowledge after completion
task_reject_on_worker_lost = True  # ✅ Requeue on worker crash
result_expires = 3600  # Results expire after 1 hour

# Performance
broker_connection_retry_on_startup = True
broker_transport_options = {
    'visibility_timeout': 3600,  # 1 hour task timeout
    'fanout_prefix': True,
    'fanout_patterns': True,
}

# Queues (use existing pattern)
task_routes = {
    'tasks.kb_pipeline_tasks.process_web_kb_task': {
        'queue': 'high_priority'
    },
    'tasks.embedding_tasks.*': {
        'queue': 'embeddings'
    },
    'tasks.indexing_tasks.*': {
        'queue': 'indexing'
    },
}

# Worker optimization (CPU-focused)
worker_prefetch_multiplier = 1  # Fair distribution
worker_max_tasks_per_child = 100  # Prevent memory leaks
worker_disable_rate_limits = True
```

### Docker Compose (Update Existing)

**File:** `backend/docker-compose.dev.yml`

```yaml
# Update existing Redis service
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --appendonly yes
    --appendfsync everysec
    --maxmemory 2gb
    --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
  # ... rest of config
```

---

## Migration from Redis to RabbitMQ (If Ever Needed)

**When would you need to migrate?**

1. Volume exceeds 1M messages/day (you're at 1K-5K)
2. Need complex routing (you have simple queues)
3. Need guaranteed delivery with ACKs (Redis + AOF is sufficient)

**How easy is migration?**

```python
# BEFORE (Redis):
CELERY_BROKER_URL = 'redis://redis:6379/0'

# AFTER (RabbitMQ):
CELERY_BROKER_URL = 'amqp://admin:password@rabbitmq:5672/'

# That's it! Celery abstracts the broker
# No code changes needed in tasks or application
```

**Migration steps:**
1. Deploy RabbitMQ container
2. Update `CELERY_BROKER_URL` environment variable
3. Restart Celery workers
4. Test with sample tasks
5. Remove Redis from broker role (keep for cache)

**Downtime:** ~5 minutes (with proper blue-green deployment)

---

## Real-World Example: Your Document Processing

### Current Flow (Redis)

```python
# 1. User finalizes KB draft
@router.post("/{draft_id}/finalize")
async def finalize_draft(draft_id: str):
    # Create KB in database
    kb = create_kb(draft_id)

    # Queue background task
    result = process_web_kb_task.apply_async(
        kwargs={
            "kb_id": str(kb.id),
            "pipeline_id": pipeline_id,
            "sources": sources,
            "config": config
        },
        queue="high_priority"
    )

    # ↑ This sends JSON message to Redis:
    # Key: "celery:queue:high_priority"
    # Value: {
    #   "task": "process_web_kb_task",
    #   "args": [],
    #   "kwargs": {...},
    #   "id": "task-uuid"
    # }

    return {"pipeline_id": pipeline_id}

# 2. Redis stores message (in-memory, <1ms)
# 3. Celery worker polls Redis (BRPOP, blocking)
# 4. Worker gets message and executes task
# 5. Worker stores result in Redis
# 6. Frontend polls for status
```

**Performance:**
- Queue latency: <1ms
- Worker pickup: <100ms
- Total overhead: <200ms
- Message loss risk: Very low (with AOF)

**This is perfect for your use case!**

---

## Monitoring (Redis as Broker)

### Check Queue Depths

```bash
# Connect to Redis
docker exec -it privexbot-redis redis-cli

# Check queue depth
LLEN celery:queue:high_priority
LLEN celery:queue:file_processing
LLEN celery:queue:embeddings

# Check pending tasks
KEYS celery-task-meta-*
```

### Monitor with Flower

```python
# Flower (already in your setup) shows:
- Active tasks
- Task history
- Worker status
- Queue depths
- Task rates

# Access: http://localhost:5555
```

### Alerts

```python
# Add to monitoring (Prometheus/Grafana):
- Queue depth > 100 → Alert (backlog building)
- Task failure rate > 5% → Alert (something wrong)
- Worker offline → Critical alert
```

---

## Final Recommendation

### For PrivexBot Document Processing:

✅ **Use Redis** (what you have)
- Simpler architecture
- Lower resource usage
- Faster performance
- Sufficient reliability
- Already configured
- Proven in production

❌ **Don't add RabbitMQ** (overkill)
- Unnecessary complexity
- Higher resource usage
- No real benefit at your scale
- More to maintain

### Future Decision Point:

**Revisit RabbitMQ if:**
- Volume exceeds 100,000 docs/day (100x your current target)
- Need complex routing patterns
- Processing financial/critical transactions
- Need message priority queues
- Multiple teams/services sharing queues

**Until then:** Redis is perfect.

---

## Summary Table

| Criteria | Redis | RabbitMQ | Your Needs | Winner |
|----------|-------|----------|------------|--------|
| **Volume** | Up to 100K msg/day | Millions/day | 1K-5K/day | Redis |
| **Latency** | <1ms | 1-5ms | <100ms OK | Redis |
| **Memory** | 512MB | 1-2GB | Minimize | Redis |
| **Complexity** | Low | Medium | Low | Redis |
| **Reliability** | High (with AOF) | Very High | High OK | Tie |
| **Setup** | ✅ Already done | ❌ Need to add | Simple | Redis |
| **Cost** | $0 (existing) | +$50/month | Minimize | Redis |

**Final Score: Redis wins 6-0-1**

---

**Decision:** Stick with **Redis** as Celery broker
**Confidence:** Very High
**Review:** In 6-12 months or if volume grows 100x

---

**Document Version:** 1.0
**Last Updated:** 2025-12-15
**Status:** Production Recommendation