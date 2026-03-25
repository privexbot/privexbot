# Quick Start Guide
## Self-Hosted Document Processing Implementation

**Last Updated:** 2025-12-15
**Estimated Setup Time:** 2-4 hours

---

## 📚 Documentation Index

This directory contains complete documentation for implementing 100% open-source, self-hosted document processing for PrivexBot.

### Core Documentation

1. **[00_QUICK_START.md](./00_QUICK_START.md)** *(this file)* - Quick start guide and overview
2. **[01_SELF_HOSTED_DOCUMENT_PROCESSING_ARCHITECTURE.md](./01_SELF_HOSTED_DOCUMENT_PROCESSING_ARCHITECTURE.md)** - Complete architecture specification
3. **[02_DOCKER_SETUP_GUIDE.md](./02_DOCKER_SETUP_GUIDE.md)** - Docker configuration and deployment
4. **[BACKEND_ARCHITECTURE_ANALYSIS.md](./BACKEND_ARCHITECTURE_ANALYSIS.md)** - Deep backend code analysis
5. **[DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md](./DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md)** - Original implementation plan

---

## 🎯 What You'll Get

### Supported Features

✅ **15+ Document Formats**
- PDF (digital + scanned with OCR)
- Office: DOCX, XLSX, PPTX
- Web: HTML, XML, MD
- Text: TXT, CSV, TSV
- Images: JPG, PNG, TIFF, BMP (with OCR)
- OpenDocument: ODT, ODS, ODP
- E-books: EPUB
- Email: EML, MSG

✅ **100% Open-Source Stack**
- NO external API calls
- NO vendor lock-in
- NO monthly fees (except hosting)
- Complete data privacy

✅ **Production-Ready Performance**
- 100+ documents/hour (single worker)
- < 5 seconds per document (100 pages)
- Horizontal scaling (add workers)
- 4.5x CPU speedup (OpenVINO optimization)

✅ **Enterprise Features**
- Multi-queue architecture (RabbitMQ)
- Real-time progress tracking
- Table extraction from PDFs
- Multilingual OCR support
- Vector search (Qdrant)
- Draft-first workflow

---

## 🚀 Quick Start (30 Minutes)

### Prerequisites

```bash
# Required
- Docker 24+ installed
- Docker Compose 2.20+ installed
- 16GB+ RAM available
- 50GB+ disk space

# Check versions
docker --version
docker compose version
```

### Step 1: Setup Environment (5 minutes)

```bash
# 1. Navigate to backend directory
cd /path/to/privexbot/backend

# 2. Copy environment template
cp .env.example .env

# 3. Generate secrets
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "REDIS_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "RABBITMQ_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "FLOWER_PASSWORD=$(openssl rand -base64 32)" >> .env

# 4. Edit .env with your specific values
nano .env
```

### Step 2: Launch Services (10 minutes)

```bash
# 1. Start all services
docker compose up -d

# 2. Watch startup logs
docker compose logs -f

# 3. Wait for all services to be healthy (Ctrl+C when done)
# You should see: "Started", "healthy", "ready" messages

# 4. Verify all services running
docker compose ps
```

### Step 3: Initialize Database (2 minutes)

```bash
# Run database migrations
docker compose exec backend alembic upgrade head

# Verify migration success
docker compose exec backend alembic current
```

### Step 4: Download ML Models (10 minutes)

```bash
# Download sentence-transformers model (one-time, ~500MB)
docker compose exec celery-embeddings python3 -c "
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
print('Model downloaded successfully!')
"

# Verify model cached
docker compose exec celery-embeddings ls -lah /app/.cache/huggingface
```

### Step 5: Verify Installation (3 minutes)

```bash
# 1. Check API health
curl http://localhost:8000/health

# Should return: {"status": "healthy"}

# 2. Check Tika server
curl http://localhost:9998/tika

# Should return: "This is Tika Server..."

# 3. Access monitoring dashboards
# Flower (Celery): http://localhost:5555
# RabbitMQ UI: http://localhost:15672 (admin / your_rabbitmq_password)
# API Docs: http://localhost:8000/api/docs
```

### Step 6: Test Document Upload (5 minutes)

```bash
# 1. Create test document
echo "This is a test document for PrivexBot knowledge base." > /tmp/test.txt

# 2. Get auth token (you'll need to signup/login first via API docs)
# Visit: http://localhost:8000/api/docs
# Use /auth/signup to create account
# Use /auth/login to get token

# 3. Upload test document (replace YOUR_TOKEN)
curl -X POST "http://localhost:8000/api/v1/kb-drafts/test-draft-id/sources/file" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/tmp/test.txt"

# Should return: {"success": true, "preview": "This is a test document..."}
```

---

## 📖 Implementation Workflow

### Recommended Implementation Order

**Week 1: Infrastructure Setup**
1. ✅ Read architecture documentation (1-2 hours)
2. ✅ Set up Docker environment (2-4 hours)
3. ✅ Deploy all services (1 hour)
4. ✅ Verify health checks (30 minutes)

**Week 2: Core Integration**
5. ✅ Implement file upload API endpoint (4-8 hours)
6. ✅ Integrate Apache Tika service (2-4 hours)
7. ✅ Add format detection (1-2 hours)
8. ✅ Test basic file processing (2-4 hours)

**Week 3: Specialized Processors**
9. ✅ Implement PDF table extraction (pdfplumber) (4-6 hours)
10. ✅ Implement Office document processors (2-4 hours)
11. ✅ Integrate OCR for scanned documents (4-6 hours)
12. ✅ Test all 15+ formats (4-8 hours)

**Week 4: Optimization & Production**
13. ✅ Optimize embedding generation (OpenVINO) (2-4 hours)
14. ✅ Implement Celery pipeline tasks (4-8 hours)
15. ✅ Add monitoring and alerts (2-4 hours)
16. ✅ Load testing and performance tuning (4-8 hours)

**Total Estimated Time:** 40-80 hours (1-2 weeks for experienced dev)

---

## 🎓 Learning Path

### For Beginners

Start with these documents in order:

1. **[BACKEND_ARCHITECTURE_ANALYSIS.md](./BACKEND_ARCHITECTURE_ANALYSIS.md)**
   - Understand existing backend structure
   - Learn what's implemented vs pseudocode
   - Grasp multi-tenancy and auth patterns

2. **[01_SELF_HOSTED_DOCUMENT_PROCESSING_ARCHITECTURE.md](./01_SELF_HOSTED_DOCUMENT_PROCESSING_ARCHITECTURE.md)**
   - Learn the complete architecture
   - Understand technology choices
   - Review format support matrix

3. **[02_DOCKER_SETUP_GUIDE.md](./02_DOCKER_SETUP_GUIDE.md)**
   - Set up Docker environment
   - Deploy all services
   - Configure monitoring

4. **[DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md](./DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md)**
   - Phase-by-phase implementation
   - Code examples
   - Testing strategies

### For Experienced Developers

**Fast Track (4-8 hours):**

1. Skim architecture document (30 min)
2. Deploy Docker setup (1 hour)
3. Implement file upload adapter (2-4 hours)
4. Test all formats (1-2 hours)
5. Production deployment (1 hour)

---

## 🔧 Key Technology Decisions

### Why Apache Tika?

✅ **1000+ format support** (most comprehensive)
✅ **100% open-source** (Apache 2.0, no tricks like Unstructured.io)
✅ **Production-proven** (18+ years, Apache Foundation)
✅ **Docker-ready** (official images)
❌ NOT using Unstructured.io (intentionally crippled open-source version)

### Why RabbitMQ over Redis?

✅ **Reliability** (persistent messaging, acknowledgments)
✅ **Advanced routing** (direct, fanout, topic, headers)
✅ **Production-proven** for critical workflows
❌ NOT using Redis for document processing (better for speed-critical async tasks)

### Why pdfplumber over PyMuPDF?

✅ **Best table extraction** (2024 benchmarks)
✅ **MIT license** (commercially safe)
✅ **Pure Python** (no licensing concerns)
❌ NOT using PyMuPDF (AGPL license = commercial licensing fees)

### Why sentence-transformers over OpenAI API?

✅ **100% self-hosted** (no external API calls)
✅ **4.5x CPU speedup** (OpenVINO int8 quantization)
✅ **Free** (no per-embedding costs)
✅ **Privacy** (data never leaves infrastructure)
❌ NOT using OpenAI embeddings API (privacy concerns + costs)

---

## 📊 Expected Performance

### Single Worker Throughput

| Document Type | Processing Time | Throughput (docs/hour) |
|---------------|----------------|------------------------|
| TXT/MD/CSV | <1 second | 200+ |
| DOCX/XLSX | 1-3 seconds | 100-150 |
| PDF (digital, 100 pages) | 3-5 seconds | 60-100 |
| PDF (scanned, 100 pages) | 10-30 seconds (OCR) | 20-40 |
| Images (OCR) | 2-5 seconds | 80-120 |

### Scalability

```
3 workers:  300+ docs/hour
5 workers:  500+ docs/hour
10 workers: 1000+ docs/hour
```

### Resource Requirements

**Minimum (Development):**
- CPU: 4 cores
- RAM: 8GB
- Disk: 20GB

**Recommended (Production):**
- CPU: 8 cores (Intel Xeon / AMD EPYC)
- RAM: 32GB
- Disk: 500GB SSD

**Optional (GPU Acceleration for OCR):**
- GPU: Nvidia T4 / L4
- VRAM: 8GB+
- Speedup: 3-5x for OCR tasks

---

## 🛠️ Troubleshooting Quick Reference

### Service Won't Start

```bash
# Check logs
docker compose logs <service-name>

# Check resource usage
docker stats

# Restart service
docker compose restart <service-name>

# Full restart
docker compose down && docker compose up -d
```

### Database Connection Error

```bash
# Verify PostgreSQL running
docker compose ps postgres

# Test connection
docker compose exec postgres psql -U privexbot -d privexbot -c "SELECT 1"

# Reset database (CAUTION: deletes data)
docker compose down -v postgres
docker compose up -d postgres
```

### Celery Workers Not Processing

```bash
# Check worker logs
docker compose logs celery-file-processing

# Check queue depth
docker compose exec rabbitmq rabbitmqctl list_queues

# Restart workers
docker compose restart celery-file-processing celery-embeddings celery-indexing
```

### Out of Memory

```bash
# Check memory usage
docker stats

# Reduce worker concurrency in docker-compose.yml:
command: >
  celery -A src.app.tasks.celery_worker worker
    --concurrency=2  # Reduce from 4 to 2

# Increase swap (Linux)
sudo swapon --show
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Tika Timeout Errors

```bash
# Increase Java heap size in docker-compose.yml:
environment:
  JAVA_OPTS: "-Xms4g -Xmx8g"  # Increase from 2g/4g

# Restart Tika
docker compose restart tika-server
```

---

## 📈 Monitoring URLs

Once deployed, access these monitoring dashboards:

| Service | URL | Credentials |
|---------|-----|-------------|
| **API Documentation** | http://localhost:8000/api/docs | None (public) |
| **Flower (Celery)** | http://localhost:5555 | admin / FLOWER_PASSWORD |
| **RabbitMQ Management** | http://localhost:15672 | admin / RABBITMQ_PASSWORD |
| **Qdrant Dashboard** | http://localhost:6333/dashboard | None (public) |
| **Backend API** | http://localhost:8000 | JWT token required |

---

## 🔒 Security Checklist

Before production deployment:

- [ ] Change all default passwords in `.env`
- [ ] Use strong `SECRET_KEY` (generate with `openssl rand -hex 32`)
- [ ] Enable HTTPS (reverse proxy with Nginx/Caddy)
- [ ] Restrict RabbitMQ/Flower/Qdrant to internal network
- [ ] Set up firewall rules
- [ ] Enable virus scanning (optional: ClamAV integration)
- [ ] Implement rate limiting on API endpoints
- [ ] Set up automated backups (PostgreSQL, Qdrant)
- [ ] Configure log rotation
- [ ] Enable monitoring alerts (Prometheus + Grafana)

---

## 💰 Cost Comparison

### Self-Hosted (Recommended)

**Monthly Costs:**
- Cloud server (8 cores, 32GB RAM): **$200-400/month**
- OR On-premises hardware (amortized): **$50-100/month**
- Storage: **$25-50/month**
- Bandwidth: **$20-100/month**
- **TOTAL: $250-550/month** (cloud) or **$95-250/month** (on-prem)

**Per-Document Cost (at 10,000 docs/month):**
- **$0.025-0.055 per document**

### Cloud API Alternative (Unstructured.io)

**Monthly Costs:**
- API pricing: **$0.10-0.50 per document**
- 10,000 documents: **$1,000-5,000/month**
- Privacy concerns: ⚠️ **Data leaves infrastructure**

**Verdict:** Self-hosted is **3-10x cheaper** at scale + privacy-preserving

---

## 📞 Support & Resources

### Documentation

- **Architecture**: [01_SELF_HOSTED_DOCUMENT_PROCESSING_ARCHITECTURE.md](./01_SELF_HOSTED_DOCUMENT_PROCESSING_ARCHITECTURE.md)
- **Docker Setup**: [02_DOCKER_SETUP_GUIDE.md](./02_DOCKER_SETUP_GUIDE.md)
- **Backend Analysis**: [BACKEND_ARCHITECTURE_ANALYSIS.md](./BACKEND_ARCHITECTURE_ANALYSIS.md)
- **Implementation Plan**: [DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md](./DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md)

### External Resources

- **Apache Tika**: https://tika.apache.org/
- **sentence-transformers**: https://www.sbert.net/
- **Qdrant**: https://qdrant.tech/documentation/
- **Celery**: https://docs.celeryq.dev/
- **RabbitMQ**: https://www.rabbitmq.com/documentation.html
- **FastAPI**: https://fastapi.tiangolo.com/

### Community

- GitHub Issues: Create issue in PrivexBot repository
- Stack Overflow: Tag with `apache-tika`, `sentence-transformers`, `fastapi`
- Discord: Join PrivexBot community (if available)

---

## 🎯 Success Metrics

Track these metrics to measure success:

**Performance:**
- [ ] Processing time < 5 seconds for 100-page PDF
- [ ] Throughput > 100 docs/hour (single worker)
- [ ] API latency < 200ms (p95)
- [ ] Queue depth < 50 tasks (normal operation)

**Reliability:**
- [ ] Uptime > 99.9%
- [ ] Error rate < 1%
- [ ] Successful pipeline completion > 95%

**Cost:**
- [ ] Monthly hosting cost < $500
- [ ] Per-document cost < $0.05
- [ ] Zero external API costs

---

## 🚢 Deployment Checklist

### Pre-Deployment

- [ ] All documentation read and understood
- [ ] Docker environment set up and tested
- [ ] All services running locally
- [ ] Basic file upload tested
- [ ] ML models downloaded and cached
- [ ] Monitoring dashboards accessible

### Deployment

- [ ] Production `.env` configured
- [ ] Docker images built
- [ ] All services deployed
- [ ] Database migrations applied
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Alerts set up

### Post-Deployment

- [ ] Load testing completed
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Backup strategy implemented
- [ ] Documentation updated
- [ ] Team training completed

---

## 🎉 Next Steps

1. **Read the architecture document** to understand the complete system
2. **Set up Docker environment** following the detailed guide
3. **Implement core services** as outlined in the implementation plan
4. **Test thoroughly** with all supported formats
5. **Deploy to production** following the deployment checklist
6. **Monitor and optimize** using the performance guide

**Estimated time to production-ready:** 1-2 weeks for experienced developer

---

## 📝 Document Versions

| Document | Version | Last Updated | Status |
|----------|---------|--------------|--------|
| 00_QUICK_START.md | 1.0 | 2025-12-15 | ✅ Complete |
| 01_SELF_HOSTED_DOCUMENT_PROCESSING_ARCHITECTURE.md | 1.0 | 2025-12-15 | ✅ Complete |
| 02_DOCKER_SETUP_GUIDE.md | 1.0 | 2025-12-15 | ✅ Complete |
| BACKEND_ARCHITECTURE_ANALYSIS.md | 1.0 | 2025-12-15 | ✅ Complete |
| DOCUMENT_PROCESSING_IMPLEMENTATION_PLAN.md | 1.0 | 2025-12-15 | ✅ Complete |

---

**Ready to get started?** → Begin with [01_SELF_HOSTED_DOCUMENT_PROCESSING_ARCHITECTURE.md](./01_SELF_HOSTED_DOCUMENT_PROCESSING_ARCHITECTURE.md)

**Questions?** → Check the [Troubleshooting](#-troubleshooting-quick-reference) section or review the detailed documentation.

**Good luck building your self-hosted document processing system!** 🚀