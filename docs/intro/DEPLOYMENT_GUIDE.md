# 🚀 PrivexBot Production Deployment Guide

**Complete guide for deploying PrivexBot frontend to a Virtual Machine using Docker Hub**

---

## 📋 Table of Contents

1. [How Production Build Works (Beginner Level)](#how-production-build-works)
2. [Why Localhost Doesn't Work in Production](#why-localhost-doesnt-work)
3. [Environment Configuration Strategy](#environment-configuration-strategy)
4. [Docker Hub Deployment Workflow](#docker-hub-deployment-workflow)
5. [VM Deployment Step-by-Step](#vm-deployment-step-by-step)
6. [Frontend-Backend Communication](#frontend-backend-communication)
7. [Security Best Practices](#security-best-practices)
8. [Different Deployment Scenarios](#deployment-scenarios)
9. [Troubleshooting](#troubleshooting)

---

## 🎓 How Production Build Works (Beginner Level)

### **The Two-Stage Process**

```
┌─────────────────────────────────────────────────────────┐
│  STAGE 1: BUILD (Temporary Container)                  │
│  ────────────────────────────────────────────────────   │
│                                                         │
│  Input:  React + TypeScript source code                │
│  Tools:  Node.js, npm, Vite, TypeScript compiler       │
│  Size:   ~1.2 GB                                        │
│                                                         │
│  Process:                                               │
│  1. npm ci --legacy-peer-deps                          │
│     └─→ Installs 390 packages                          │
│                                                         │
│  2. npm run build (vite build)                         │
│     ├─→ TypeScript → JavaScript                        │
│     ├─→ JSX → Optimized JS                             │
│     ├─→ CSS → Minified CSS                             │
│     ├─→ Images → Optimized                             │
│     ├─→ Code splitting                                 │
│     ├─→ Tree shaking (remove unused code)              │
│     └─→ Creates /dist folder                           │
│                                                         │
│  Output: /dist (216 KB JS, 35 KB CSS, index.html)     │
│                                                         │
│  ❌ This container is THROWN AWAY after build!          │
└─────────────────────────────────────────────────────────┘
                            ↓
                    Copy /dist only
                            ↓
┌─────────────────────────────────────────────────────────┐
│  STAGE 2: PRODUCTION (Final Container)                 │
│  ────────────────────────────────────────────────────   │
│                                                         │
│  Input:  Just the /dist folder                         │
│  Tools:  Nginx web server (40 MB)                      │
│  Size:   49 MB total                                    │
│                                                         │
│  Contains:                                              │
│  ✅ Nginx (web server)                                  │
│  ✅ Built static files (/dist)                          │
│  ✅ nginx.conf (configuration)                          │
│  ✅ docker-entrypoint.sh (startup script)              │
│                                                         │
│  Does NOT contain:                                      │
│  ❌ Node.js                                              │
│  ❌ npm                                                  │
│  ❌ Source code (.tsx, .ts files)                       │
│  ❌ package.json                                         │
│  ❌ Build tools                                          │
│                                                         │
│  ✅ This container is DEPLOYED to production!           │
└─────────────────────────────────────────────────────────┘
```

### **What Nginx Does:**

Nginx is like a **restaurant waiter**:

1. **Client (browser) requests**: `GET /` or `GET /assets/index-abc123.js`
2. **Nginx finds the file**: Looks in `/usr/share/nginx/html/`
3. **Nginx serves the file**: Returns HTML, JS, or CSS
4. **Nginx adds headers**: Caching, compression, security headers

**Key Point**: The frontend is **STATIC FILES**. It's NOT a Node.js server running!

---

## 🚨 Why Localhost Doesn't Work in Production

### **The Problem Explained**

```
SCENARIO 1: Hardcoded localhost in code
─────────────────────────────────────────

Your Code:
  fetch('http://localhost:8000/api/chatbots')

What Happens:
  ┌─────────────────────────┐
  │  User's Browser         │
  │  (Chrome on laptop)     │
  │                         │
  │  Tries to connect to:   │
  │  localhost:8000         │
  │         │               │
  │         ↓               │
  │  ❌ "localhost" means    │
  │     THIS COMPUTER       │
  │     (user's laptop)     │
  │                         │
  │  Backend is NOT running │
  │  on user's laptop!      │
  └─────────────────────────┘

Result: ❌ Connection refused / No backend found
```

```
SCENARIO 2: Hardcoded production URL in code
─────────────────────────────────────────────

Your Code:
  fetch('https://api.privexbot.com/api/chatbots')

What Happens in Different Environments:

Development (localhost):
  ❌ Points to production API (not local backend)
  ❌ Can't test locally

Staging (staging.company.com):
  ❌ Points to production API (not staging backend)
  ❌ Can't test staging changes

Production (app.company.com):
  ✅ Works! But only by coincidence
```

### **The Real Solution: Runtime Configuration**

```
┌─────────────────────────────────────────────────────────┐
│  HOW IT WORKS: Runtime Configuration                   │
│  ────────────────────────────────────────────────────   │
│                                                         │
│  1. Build Docker Image (ONCE)                          │
│     Contains placeholder: __API_BASE_URL__             │
│                                                         │
│  2. Push to Docker Hub                                 │
│     Image ID: yourorg/privexbot-frontend:v1.0.0       │
│                                                         │
│  3. Deploy to Development                              │
│     docker run -e API_BASE_URL=http://localhost:8000  │
│     Placeholder replaced with: http://localhost:8000   │
│                                                         │
│  4. Deploy to Staging (SAME IMAGE!)                    │
│     docker run -e API_BASE_URL=https://staging-api... │
│     Placeholder replaced with: https://staging-api...  │
│                                                         │
│  5. Deploy to Production (SAME IMAGE!)                 │
│     docker run -e API_BASE_URL=https://api.company... │
│     Placeholder replaced with: https://api.company...  │
│                                                         │
│  ✅ ONE IMAGE works everywhere!                         │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ Environment Configuration Strategy

### **How Our Setup Works**

We use **Runtime Configuration** instead of **Build-time Configuration**:

```javascript
// ❌ BAD: Build-time (baked into JavaScript)
const API_URL = "https://api.privexbot.com"; // Can't change without rebuild!

// ✅ GOOD: Runtime (loaded from config.js)
const API_URL = window.ENV_CONFIG.API_BASE_URL; // Changes per environment!
```

### **The Flow:**

```
1. Docker Container Starts
   ├─→ Runs docker-entrypoint.sh
   │
2. Entrypoint Script Runs
   ├─→ Reads environment variables:
   │   - API_BASE_URL=https://your-api.com
   │   - WIDGET_CDN_URL=https://your-cdn.com
   │
3. Injects into config.js
   ├─→ Replaces __API_BASE_URL__ with https://your-api.com
   ├─→ Replaces __WIDGET_CDN_URL__ with https://your-cdn.com
   │
4. Starts Nginx
   ├─→ Serves index.html
   │
5. Browser Loads Page
   ├─→ Loads index.html
   ├─→ Loads <script src="/config.js"></script>
   ├─→ Sets window.ENV_CONFIG = { API_BASE_URL: "https://your-api.com" }
   │
6. React App Starts
   ├─→ Imports { config } from '@/config/env'
   ├─→ config.API_BASE_URL returns window.ENV_CONFIG.API_BASE_URL
   │
7. API Calls Work
   ├─→ axios.create({ baseURL: config.API_BASE_URL })
   └─→ fetch(`${config.API_BASE_URL}/chatbots`)
```

---

## 🐳 Docker Hub Deployment Workflow

### **Step 1: Build the Image**

```bash
# Navigate to project root
cd /path/to/privexbot

# Build production image
docker compose -f docker-compose.prod.yml build frontend

# Result: privexbot/frontend:latest (49 MB)
```

### **Step 2: Tag for Docker Hub**

```bash
# Tag image with your Docker Hub username
docker tag privexbot/frontend:latest yourusername/privexbot-frontend:v1.0.0
docker tag privexbot/frontend:latest yourusername/privexbot-frontend:latest

# Example:
docker tag privexbot/frontend:latest johndoe/privexbot-frontend:v1.0.0
docker tag privexbot/frontend:latest johndoe/privexbot-frontend:latest
```

### **Step 3: Login to Docker Hub**

```bash
# Login (enter password when prompted)
docker login

# Or with username
docker login -u yourusername
```

### **Step 4: Push to Docker Hub**

```bash
# Push both tags
docker push yourusername/privexbot-frontend:v1.0.0
docker push yourusername/privexbot-frontend:latest

# This uploads the 49 MB image to Docker Hub
# Takes 1-2 minutes on good internet
```

### **Step 5: Verify on Docker Hub**

Visit: `https://hub.docker.com/r/yourusername/privexbot-frontend`

You should see:

- Image size: 49 MB
- Tags: latest, v1.0.0
- Last pushed: Just now

---

## 🖥️ VM Deployment Step-by-Step

### **Prerequisites on VM**

```bash
# 1. SSH into your VM
ssh user@your-vm-ip-address

# 2. Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Verify Docker works
docker --version
docker compose version
```

### **Deployment Option 1: Using docker run (Simple)**

```bash
# Pull the image from Docker Hub
docker pull yourusername/privexbot-frontend:latest

# Run the container with environment variables
docker run -d \
  --name privexbot-frontend \
  --restart unless-stopped \
  -p 80:80 \
  -e API_BASE_URL=https://your-backend-api.com/api/v1 \
  -e WIDGET_CDN_URL=https://your-widget-cdn.com \
  -e ENVIRONMENT=production \
  yourusername/privexbot-frontend:latest

# Check if running
docker ps

# Check logs
docker logs privexbot-frontend

# You should see:
# 🚀 PrivexBot Frontend - Production Container Starting...
# 📝 Injecting runtime configuration...
#    API_BASE_URL: https://your-backend-api.com/api/v1
#    WIDGET_CDN_URL: https://your-widget-cdn.com
#    ENVIRONMENT: production
# ✅ Configuration injected successfully
# 🌐 Starting Nginx...
```

### **Deployment Option 2: Using Docker Compose (Recommended)**

Create this file on your VM:

```bash
# On VM, create docker-compose.yml
nano docker-compose.yml
```

```yaml
# docker-compose.yml
version: "3.8"

services:
  frontend:
    image: yourusername/privexbot-frontend:latest
    container_name: privexbot-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    environment:
      # ⚠️ CHANGE THESE FOR YOUR DEPLOYMENT!
      - API_BASE_URL=https://your-backend-api.com/api/v1
      - WIDGET_CDN_URL=https://your-widget-cdn.com
      - ENVIRONMENT=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

```bash
# Start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f frontend

# Stop services
docker compose down
```

### **Accessing Your Frontend**

If your VM has public IP `123.45.67.89`:

- Frontend: `http://123.45.67.89`
- Health check: `http://123.45.67.89/health`

**For custom domain** (e.g., `app.yourcompany.com`):

1. Point DNS A record to VM IP
2. Wait for DNS propagation (5-60 minutes)
3. Access: `http://app.yourcompany.com`

---

## 🔗 Frontend-Backend Communication

### **Understanding the Architecture**

```
┌─────────────────────────────────────────────────────────┐
│  USER'S BROWSER                                         │
│  ────────────────────────────────────────────────────   │
│                                                         │
│  1. Visits: https://app.company.com                    │
│     ├─→ Browser requests HTML from frontend            │
│     │                                                   │
│  2. Loads Frontend (React App)                         │
│     ├─→ Downloads index.html                           │
│     ├─→ Downloads /config.js                           │
│     │   └─→ window.ENV_CONFIG.API_BASE_URL set         │
│     ├─→ Downloads JavaScript bundles                   │
│     └─→ React app starts                               │
│                                                         │
│  3. User Clicks "Create Chatbot"                       │
│     ├─→ React makes API call:                          │
│     │   fetch(`${config.API_BASE_URL}/chatbots`)      │
│     │   = fetch('https://api.company.com/api/v1/...')  │
│     │                                                   │
│     └─→ Browser makes request DIRECTLY to backend:     │
│         https://api.company.com/api/v1/chatbots       │
│                                                         │
│  ⚠️ IMPORTANT: Browser → Backend (NOT Frontend → Backend)│
└─────────────────────────────────────────────────────────┘
              ↓                          ↓
    ┌──────────────────┐      ┌──────────────────┐
    │  Frontend        │      │  Backend         │
    │  Container       │      │  Container       │
    │  ─────────────── │      │  ─────────────── │
    │  Nginx           │      │  FastAPI         │
    │  Serves HTML/JS  │      │  Handles API     │
    │  Port 80         │      │  Port 8000       │
    └──────────────────┘      └──────────────────┘
         VM Server                VM Server
    (or separate VM)         (or separate VM)
```

### **Common Communication Patterns**

#### **Pattern 1: Both on Same VM (Simple)**

```
VM IP: 123.45.67.89

Frontend Container:
  - Port 80 exposed
  - Accessible at: http://123.45.67.89

Backend Container:
  - Port 8000 exposed
  - Accessible at: http://123.45.67.89:8000

Environment Variable:
  API_BASE_URL=http://123.45.67.89:8000/api/v1

User Flow:
  Browser → http://123.45.67.89 → Frontend
  Browser → http://123.45.67.89:8000/api/v1/chatbots → Backend
```

#### **Pattern 2: Different VMs (Scalable)**

```
Frontend VM: 123.45.67.89
Backend VM: 98.76.54.32

Frontend Container:
  - Port 80 exposed
  - Accessible at: http://123.45.67.89

Backend Container:
  - Port 8000 exposed
  - Accessible at: http://98.76.54.32:8000

Environment Variable:
  API_BASE_URL=http://98.76.54.32:8000/api/v1

User Flow:
  Browser → http://123.45.67.89 → Frontend
  Browser → http://98.76.54.32:8000/api/v1/chatbots → Backend
```

#### **Pattern 3: With Custom Domains (Professional)**

```
Frontend: app.company.com (→ 123.45.67.89:80)
Backend:  api.company.com (→ 98.76.54.32:8000)

Environment Variable:
  API_BASE_URL=https://api.company.com/api/v1

User Flow:
  Browser → https://app.company.com → Frontend
  Browser → https://api.company.com/api/v1/chatbots → Backend
```

#### **Pattern 4: With Nginx Reverse Proxy (Best)**

```
All traffic goes through Nginx reverse proxy on port 80/443

Nginx on VM:
  ├─→ app.company.com/* → Frontend Container (port 3000)
  └─→ app.company.com/api/* → Backend Container (port 8000)

Environment Variable:
  API_BASE_URL=/api/v1  (relative URL!)

User Flow:
  Browser → https://app.company.com → Nginx → Frontend
  Browser → https://app.company.com/api/v1/chatbots → Nginx → Backend

Benefits:
  ✅ Single domain
  ✅ No CORS issues
  ✅ Easier SSL/TLS
  ✅ Better security
```

---

## 🔒 Security Best Practices

### **1. NEVER Expose Backend Directly**

```
❌ BAD:
Frontend: https://app.company.com
Backend:  http://123.45.67.89:8000 (IP + port exposed!)

Risks:
- Backend IP visible to everyone
- No SSL/TLS on backend
- Easy to DDoS
- Harder to change infrastructure

✅ GOOD:
Frontend: https://app.company.com
Backend:  https://api.company.com (domain + SSL)
```

### **2. Use HTTPS Everywhere**

```bash
# Install Certbot on VM (for free SSL from Let's Encrypt)
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d app.company.com -d api.company.com

# Auto-renewal is set up automatically
```

### **3. Enable CORS Properly**

Backend (FastAPI) should allow frontend domain:

```python
# backend/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.company.com",  # Production
        "https://staging.company.com",  # Staging
        "http://localhost:5173",  # Development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### **4. Use Environment Variables for Secrets**

```bash
# ❌ NEVER hardcode secrets in code or Dockerfile
API_KEY=abc123

# ✅ Pass via environment variables
docker run -e API_KEY=abc123 ...

# ✅ Or use .env file (never commit to git!)
docker run --env-file .env ...
```

### **5. Run as Non-Root User**

Already done in our setup! Container runs as `nginx` user, not `root`.

### **6. Keep Images Updated**

```bash
# Pull latest image
docker pull yourusername/privexbot-frontend:latest

# Recreate container
docker compose up -d --force-recreate
```

---

## 📊 Different Deployment Scenarios

### **Scenario 1: Local Testing**

```yaml
# .env.local
API_BASE_URL=http://localhost:8000/api/v1
WIDGET_CDN_URL=http://localhost:8080
ENVIRONMENT=development
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.local up
```

### **Scenario 2: Staging Environment**

```yaml
# .env.staging
API_BASE_URL=https://staging-api.company.com/api/v1
WIDGET_CDN_URL=https://staging-cdn.company.com
ENVIRONMENT=staging
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d
```

### **Scenario 3: Production**

```yaml
# .env.production
API_BASE_URL=https://api.company.com/api/v1
WIDGET_CDN_URL=https://cdn.company.com
ENVIRONMENT=production
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### **Scenario 4: Multiple Customers (SaaS)**

```yaml
# Customer A
docker run -e API_BASE_URL=https://customerA-api.company.com ...

# Customer B
docker run -e API_BASE_URL=https://customerB-api.company.com ...
```

---

## 🐛 Troubleshooting

### **Problem 1: Frontend can't connect to backend**

**Symptoms:**

- Browser console shows: `Failed to fetch` or `Network Error`
- API calls fail

**Diagnosis:**

```bash
# 1. Check frontend config
docker exec privexbot-frontend cat /usr/share/nginx/html/config.js

# Should show actual URLs, NOT __API_BASE_URL__

# 2. Test from VM
curl http://backend-url/api/v1/health

# 3. Check from browser (F12 → Network tab)
# See what URL is being called
```

**Solutions:**

- Verify `API_BASE_URL` environment variable is set correctly
- Ensure backend is accessible from browser (not just from VM)
- Check CORS settings on backend
- Verify firewall rules allow traffic

### **Problem 2: Container keeps restarting**

**Diagnosis:**

```bash
docker logs privexbot-frontend
```

**Common Causes:**

- Nginx configuration error → Check logs
- Permission issues → Fixed in our setup
- Port already in use → Change FRONTEND_PORT

### **Problem 3: Changes not reflecting**

**Cause:** Using cached image

**Solution:**

```bash
# Pull latest image
docker compose pull frontend

# Force recreate
docker compose up -d --force-recreate frontend
```

### **Problem 4: CORS errors**

**Symptoms:**

- Browser console: `CORS policy blocked`

**Solution:**
Backend must allow frontend origin:

```python
allow_origins=["https://app.company.com"]
```

---

## ✅ Deployment Checklist

### **Before Deploying:**

- [ ] Backend is deployed and accessible
- [ ] Backend has CORS configured for frontend domain
- [ ] Frontend Docker image built and pushed to Docker Hub
- [ ] Environment variables prepared (API_BASE_URL, etc.)
- [ ] VM has Docker installed
- [ ] Domain DNS pointed to VM IP (if using domain)
- [ ] SSL certificates ready (if using HTTPS)

### **During Deployment:**

- [ ] Pull image from Docker Hub
- [ ] Set environment variables correctly
- [ ] Start container
- [ ] Check container is running: `docker ps`
- [ ] Check logs: `docker logs privexbot-frontend`
- [ ] Test health endpoint: `curl http://vm-ip/health`
- [ ] Test in browser

### **After Deployment:**

- [ ] Frontend loads in browser
- [ ] API calls work (check Network tab)
- [ ] Authentication works
- [ ] Create test chatbot
- [ ] Monitor logs for errors
- [ ] Set up monitoring/alerting

---

## 🎯 Quick Reference Commands

```bash
# Build
docker compose -f docker-compose.prod.yml build frontend

# Tag for Docker Hub
docker tag privexbot/frontend:latest yourusername/privexbot-frontend:v1.0.0

# Push to Docker Hub
docker push yourusername/privexbot-frontend:v1.0.0

# Pull on VM
docker pull yourusername/privexbot-frontend:v1.0.0

# Run on VM
docker run -d \
  --name privexbot-frontend \
  -p 80:80 \
  -e API_BASE_URL=https://your-api.com/api/v1 \
  yourusername/privexbot-frontend:v1.0.0

# Check status
docker ps
docker logs privexbot-frontend

# Update deployment
docker pull yourusername/privexbot-frontend:latest
docker stop privexbot-frontend
docker rm privexbot-frontend
# ... run command again with new image
```

---

**Need Help?** Check logs first: `docker logs privexbot-frontend`
