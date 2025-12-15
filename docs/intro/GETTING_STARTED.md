# Getting Started with PrivexBot

This guide will walk you through setting up PrivexBot locally and creating your first AI chatbot.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [First-Time Setup](#first-time-setup)
- [Running Locally](#running-locally)
- [Creating Your First Chatbot](#creating-your-first-chatbot)
- [Testing Your Chatbot](#testing-your-chatbot)
- [Next Steps](#next-steps)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Docker** (20.10+) & **Docker Compose** (2.0+)
  - [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - Verify: `docker --version` and `docker compose version`

- **Node.js** (20+) - For local frontend development
  - [Download Node.js](https://nodejs.org/)
  - Verify: `node --version`

- **Python** (3.11+) - For local backend development
  - [Download Python](https://www.python.org/downloads/)
  - Verify: `python --version`

- **Git** - For cloning the repository
  - Verify: `git --version`

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 10 GB free space
- OS: macOS, Linux, or Windows with WSL2

**Recommended:**
- CPU: 4+ cores
- RAM: 8+ GB
- Disk: 20+ GB free space
- SSD storage

---

## Installation

### 1. Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/yourusername/privexbot.git

# Or clone via SSH
git clone git@github.com:yourusername/privexbot.git

# Navigate to project directory
cd privexbot
```

### 2. Environment Configuration

```bash
# Copy environment templates
cp .env.example .env

# Edit environment file
nano .env  # or use your preferred editor
```

**Key environment variables to configure:**

```env
# Database
POSTGRES_DB=privexbot
POSTGRES_USER=privexbot
POSTGRES_PASSWORD=your_secure_password  # Change this!
DATABASE_URL=postgresql://privexbot:your_secure_password@postgres:5432/privexbot

# Redis
REDIS_URL=redis://redis:6379/0

# Backend
SECRET_KEY=your_super_secret_key_change_this  # Generate with: openssl rand -hex 32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Frontend
VITE_API_BASE_URL=http://localhost:8000/api/v1

# AI Configuration (Optional for testing)
OPENAI_API_KEY=sk-...  # Your OpenAI API key
SECRET_AI_API_KEY=...  # Your Secret AI API key
```

---

## First-Time Setup

### Option 1: Docker Setup (Recommended for Quick Start)

```bash
# Build and start all services
docker compose up -d

# Wait for services to be ready (usually 30-60 seconds)
docker compose logs -f

# Press Ctrl+C once you see "Application startup complete"
```

**Services will start:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Option 2: Native Development Setup

**Backend Setup:**
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements/dev.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

**Frontend Setup** (in a new terminal):
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

**Widget Setup** (optional):
```bash
cd widget

# Install dependencies
npm install

# Build widget
npm run build
```

---

## Running Locally

### Start All Services

```bash
# Start services in background
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v
```

### Individual Service Management

```bash
# Start only frontend
docker compose up frontend

# Start only backend
docker compose up backend

# Restart a service
docker compose restart frontend

# View service logs
docker compose logs -f backend
```

### Verify Services

```bash
# Check service health
docker compose ps

# Expected output:
# NAME                    SERVICE    STATUS       PORTS
# privexbot-frontend      frontend   Up (healthy) 0.0.0.0:3000->3000/tcp
# privexbot-backend       backend    Up (healthy) 0.0.0.0:8000->8000/tcp
# privexbot-postgres      postgres   Up           0.0.0.0:5432->5432/tcp
# privexbot-redis         redis      Up           0.0.0.0:6379->6379/tcp
```

---

## Creating Your First Chatbot

### Step 1: Access the Dashboard

1. Open your browser: http://localhost:3000
2. You should see the PrivexBot login page

### Step 2: Create Account

1. Click **"Sign Up"**
2. Choose authentication method:
   - **Email** (traditional username/password)
   - **MetaMask** (Ethereum wallet)
   - **Phantom** (Solana wallet)
   - **Keplr** (Cosmos wallet)
3. Complete registration

### Step 3: Create Organization & Workspace

After logging in:

1. Create your **Organization**:
   - Name: "My Company"
   - Slug: "my-company" (for URLs)

2. Create your **Workspace**:
   - Name: "Production"
   - This is where your chatbots will live

### Step 4: Create a Simple Chatbot

1. Click **"Create Chatbot"** from dashboard
2. Choose **"Simple Chatbot"** (form-based)
3. Fill in basic information:
   ```
   Name: Customer Support Bot
   Description: Helps customers with common questions
   ```

4. Configure AI settings:
   ```
   Model: GPT-4 (or your preferred model)
   Temperature: 0.7
   Max Tokens: 1000
   System Prompt: "You are a helpful customer support assistant..."
   ```

5. (Optional) Add a Knowledge Base:
   - Click **"Add Knowledge Base"**
   - Upload PDF, Word docs, or paste text
   - Wait for processing

6. Customize widget appearance:
   ```
   Position: Bottom Right
   Color: #6366f1 (blue)
   Greeting: "Hi! How can I help you today?"
   ```

7. Select deployment channels:
   - ☑ Website Widget
   - ☐ Telegram
   - ☐ Discord
   - ☐ WhatsApp

8. Click **"Deploy"**

### Step 5: Get Embed Code

After deployment, you'll see:

```html
<!-- Copy this code -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'pb', 'http://localhost:8000/api/v1/widget.js'));

  pb('init', {
    id: 'your-chatbot-id',
    options: {
      position: 'bottom-right',
      color: '#6366f1'
    }
  });
</script>
```

---

## Testing Your Chatbot

### Method 1: Preview in Dashboard

1. In the chatbot builder, click **"Live Preview"**
2. Test chat interface appears
3. Send messages and verify responses

### Method 2: Test with HTML File

Create a test file `test-chatbot.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test PrivexBot Widget</title>
</head>
<body>
    <h1>Testing PrivexBot</h1>
    <p>The chatbot should appear in the bottom-right corner.</p>

    <!-- Paste your embed code here -->
    <script>
      (function(w,d,s,o,f,js,fjs){
        w['PrivexBot']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
        js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
        js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
      }(window, document, 'script', 'pb', 'http://localhost:8000/api/v1/widget.js'));

      pb('init', {
        id: 'your-chatbot-id',
        options: {
          position: 'bottom-right',
          color: '#6366f1'
        }
      });
    </script>
</body>
</html>
```

Open in browser:
```bash
open test-chatbot.html  # macOS
xdg-open test-chatbot.html  # Linux
start test-chatbot.html  # Windows
```

### Method 3: Test via API

```bash
# Send a test message via API
curl -X POST http://localhost:8000/api/v1/chatbots/your-chatbot-id/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, how can you help me?",
    "session_id": "test-session-123"
  }'
```

---

## Next Steps

### Explore Advanced Features

1. **Create a Chatflow** (Visual Workflow):
   - Click **"Create Chatflow"**
   - Drag and drop nodes (LLM, Condition, HTTP Request, etc.)
   - Create complex multi-step conversations

2. **Build a Knowledge Base**:
   - Import multiple documents
   - Scrape websites
   - Connect Google Docs/Notion
   - Configure chunking and indexing

3. **Enable Lead Capture**:
   - Configure lead form fields
   - Set timing (before/during/after chat)
   - View captured leads in dashboard

4. **Deploy to Multiple Channels**:
   - Set up Telegram bot
   - Configure Discord webhook
   - Enable WhatsApp Business
   - Create Zapier integration

### Customize Your Bot

1. **Improve System Prompt**:
   ```
   You are a customer support assistant for Acme Corp.

   Your role:
   - Answer questions about products
   - Help with order tracking
   - Resolve common issues

   Tone: Friendly, professional, concise

   If you don't know the answer, say:
   "I don't have that information, but I can connect you with a human agent."
   ```

2. **Add More Knowledge**:
   - Upload FAQs
   - Import product documentation
   - Scrape support articles

3. **Configure Advanced Settings**:
   - Adjust temperature for creativity
   - Set max tokens for response length
   - Enable/disable function calling
   - Configure context window

### Learn More

- **[Architecture Overview](./ARCHITECTURE.md)** - Understand how it works
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Deploy to production
- **[API Reference](./API_REFERENCE.md)** - API documentation
- **[Widget Guide](./widget/README.md)** - Embed widget customization

---

## Troubleshooting

### Common Issues

#### Docker containers not starting

```bash
# Check Docker status
docker ps -a

# View error logs
docker compose logs backend

# Common fix: Remove and rebuild
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

#### Database migration errors

```bash
# Reset database (WARNING: Deletes all data!)
docker compose down -v
docker compose up -d postgres
docker compose exec backend alembic upgrade head
```

#### Frontend not connecting to backend

1. Check `.env` file has correct `VITE_API_BASE_URL`
2. Verify backend is running: http://localhost:8000/docs
3. Check browser console for CORS errors

#### Widget not appearing on test page

1. Check browser console for errors
2. Verify widget.js loads: http://localhost:8000/api/v1/widget.js
3. Ensure chatbot ID is correct
4. Check CORS configuration in backend

### Port Conflicts

If ports 3000, 8000, 5432, or 6379 are already in use:

**Option 1: Change ports in docker-compose.yml**
```yaml
services:
  frontend:
    ports:
      - "3001:3000"  # Change local port to 3001
```

**Option 2: Stop conflicting services**
```bash
# Find what's using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill the process
kill -9 <PID>
```

### Getting Help

- **GitHub Issues**: https://github.com/yourusername/privexbot/issues
- **Discord Community**: https://discord.gg/privexbot
- **Documentation**: ./docs/

---

## Summary Checklist

- [ ] Installed prerequisites (Docker, Node.js, Python)
- [ ] Cloned repository
- [ ] Configured environment variables
- [ ] Started services with `docker compose up -d`
- [ ] Accessed dashboard at http://localhost:3000
- [ ] Created account and organization
- [ ] Created first chatbot
- [ ] Tested chatbot widget
- [ ] Explored dashboard features

**Congratulations! You're now ready to build powerful AI chatbots with PrivexBot! 🎉**

---

**Next:** [Deploy to Production](./DEPLOYMENT_GUIDE.md) | [Learn Architecture](./ARCHITECTURE.md)
