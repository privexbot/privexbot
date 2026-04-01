# Local Development Setup
> Get the full PrivexBot stack running on your machine.
> All commands verified from `scripts/docker/dev.sh`, `docker-compose.dev.yml`, and `frontend/.env.dev.example`.

---

## Prerequisites

Install these before anything else:

| Tool | Version | Install |
|---|---|---|
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |
| Docker Compose | Included in Docker Desktop | — |
| Git | Any recent | `brew install git` (Mac) or OS package manager |
| Node.js | 20+ | https://nodejs.org or `brew install node` |

Verify you have everything:
```bash
docker --version        # Docker version 24+
docker compose version  # Docker Compose version v2+
git --version           # git version 2+
node --version          # v20+
npm --version           # 10+
```

---

## Backend Setup

The entire backend (FastAPI + PostgreSQL + Redis + Qdrant + Tika + MinIO + Celery) runs in Docker.

### Step 1 — Clone the repository

```bash
git clone <repo-url> privexbot
cd privexbot/backend
```

### Step 2 — Check the dev env file

The file `.env.dev` is already committed with safe dev-only secrets. You do not need to create it. Just verify it exists:

```bash
ls -la .env.dev
```

If it's missing (e.g., you're on a clean checkout), copy from the example:
```bash
cp .env.example .env.dev
# Then fill in required values — ask the team for the SecretAI credentials
```

### Step 3 — Start all services

```bash
./scripts/docker/dev.sh up
```

This starts **9 containers**:

| Container | Purpose | Host Port |
|---|---|---|
| `privexbot-backend-dev` | FastAPI API server (hot reload) | **8000** |
| `privexbot-postgres-dev` | PostgreSQL 16 + pgvector | **5434** |
| `privexbot-redis-dev` | Redis 7 (cache, drafts, Celery broker) | **6380** |
| `privexbot-qdrant-dev` | Qdrant vector DB | **6335** (HTTP), **6336** (gRPC) |
| `privexbot-tika-dev` | Apache Tika (PDF/Word/Excel parsing + OCR) | **9998** |
| `privexbot-minio-dev` | MinIO object storage (file uploads) | **9000** (S3), **9001** (console) |
| `privexbot-celery-dev` | Celery worker (embeddings, crawling, indexing) | — |
| `privexbot-celery-beat-dev` | Celery Beat (scheduled tasks) | — |
| `privexbot-flower-dev` | Celery monitoring UI | **5555** |

**Important:** The backend container waits for PostgreSQL, Redis, Qdrant, Tika, and MinIO to be healthy before starting. On first run, Tika and MinIO take 30–60 seconds to initialize. Wait until you see `Uvicorn running on http://0.0.0.0:8000` in the logs.

### Step 4 — Verify backend is running

Open your browser or curl:

```bash
curl http://localhost:8000/health
# Expected: {"status": "healthy"}
```

Then open the interactive API docs: **http://localhost:8000/api/docs**

### What happens on startup (automatic)

The `scripts/docker-entrypoint.sh` runs automatically:
1. Checks current Alembic migration version
2. Runs `alembic upgrade head` to apply any pending migrations
3. Installs Playwright browsers if missing (needed for web crawling)
4. Starts `uvicorn` with `--reload` watching `/app/src`

You do **not** need to run migrations manually — they run on every container start.

---

## Frontend Setup

The frontend is a plain React/Vite app run locally (not in Docker).

### Step 1 — Install dependencies

```bash
cd ../frontend   # from the backend/ directory, go to frontend/
npm ci --legacy-peer-deps
```

`--legacy-peer-deps` is required because of peer dependency conflicts between React 19 and some packages.

### Step 2 — Configure environment

```bash
cp .env.dev.example .env.dev
```

The default `.env.dev` is ready for local development. Key variable:
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WIDGET_CDN_URL=http://localhost:9000
VITE_ENV=development
```

No changes needed unless you run the backend on a different port.

### Step 3 — Start the dev server

```bash
npm run dev
```

Vite starts a dev server at **http://localhost:5173** with Hot Module Replacement (HMR). Code changes in `src/` appear instantly in the browser without a full page reload.

### Step 4 — Verify frontend is running

Open **http://localhost:5173** — you should see the PrivexBot login page.

---

## Widget Setup (Optional)

The widget (`widget/`) is only needed if you're working on the embeddable chat bubble. It is already built at `widget/build/widget.js` — you don't need to rebuild it unless you change the widget source.

```bash
cd ../widget
npm install
npm run dev
# Starts webpack dev server on port 9000 (conflicts with MinIO — stop MinIO first if needed)
```

---

## Dev Commands Reference

All backend commands go through `./scripts/docker/dev.sh` (run from `backend/`):

| Command | What it does |
|---|---|
| `./scripts/docker/dev.sh up` | Start all containers (foreground, see all logs) |
| `./scripts/docker/dev.sh down` | Stop all containers (data preserved) |
| `./scripts/docker/dev.sh status` | Show container status + all URLs |
| `./scripts/docker/dev.sh logs` | Follow all container logs |
| `./scripts/docker/dev.sh logs backend` | Follow only the FastAPI server logs |
| `./scripts/docker/dev.sh logs celery` | Follow only Celery worker logs |
| `./scripts/docker/dev.sh restart backend` | Hot-restart just the API server |
| `./scripts/docker/dev.sh restart celery` | Restart the Celery worker |
| `./scripts/docker/dev.sh shell` | Open bash shell inside the backend container |
| `./scripts/docker/dev.sh db` | Open `psql` shell in PostgreSQL (`privexbot_dev` database) |
| `./scripts/docker/dev.sh migrate` | Run `alembic upgrade head` manually |
| `./scripts/docker/dev.sh build` | Rebuild the backend Docker image |
| `./scripts/docker/dev.sh --no-cache build` | Force-rebuild without Docker layer cache |
| `./scripts/docker/dev.sh clean` | **DESTRUCTIVE**: Removes all containers + volumes (deletes all data) |

---

## Local URLs Summary

| URL | Purpose |
|---|---|
| http://localhost:8000/api/docs | Swagger UI — interactive API docs |
| http://localhost:8000/api/redoc | ReDoc API docs (alternative reader) |
| http://localhost:8000/health | Health check |
| http://localhost:5173 | Frontend dashboard |
| http://localhost:6335/dashboard | Qdrant vector DB browser |
| http://localhost:9001 | MinIO web console (user: `privexbot`, pass: `privexbot_dev_storage`) |
| http://localhost:5555 | Flower Celery monitor (user: `admin`, pass: `admin123`) |
| localhost:5434 | PostgreSQL direct access (user: `privexbot`, pass: `privexbot_dev`, db: `privexbot_dev`) |
| localhost:6380 | Redis direct access |

---

## Common Issues and Solutions

| Issue | Symptom | Fix |
|---|---|---|
| Port 8000 already in use | Backend fails to start: `address already in use` | `lsof -ti:8000 \| xargs kill` |
| Port 5434 conflict | PostgreSQL health check fails | Change `5434:5432` mapping in `docker-compose.dev.yml` |
| Tika takes too long | Backend waits forever on startup | First-run only — Tika image is ~1GB and initializes slowly. Wait 60s. |
| Alembic revision not found | Migration fails: `Can't locate revision` | `./scripts/docker/dev.sh shell` → `cd /app/src && alembic stamp head` then restart |
| Playwright browsers missing | Web crawl tasks fail | Run `./scripts/docker/dev.sh shell` → `python -m playwright install chromium` |
| HuggingFace model download | First KB operation is very slow | First use only — model (~470MB) downloads to Docker volume `huggingface_cache` |
| Redis connection refused | Frontend gets 500 on draft save | Ensure Redis container is running: `./scripts/docker/dev.sh status` |
| npm install fails | `ERESOLVE unable to resolve dependency tree` | Use `npm ci --legacy-peer-deps` (React 19 peer dep conflicts) |
| Frontend shows blank page | White screen, no error | Check `VITE_API_BASE_URL` in `.env.dev` — must be `http://localhost:8000/api/v1` |
| CORS error in browser | Network tab shows CORS blocked | Backend must be running; `.env.dev` `BACKEND_CORS_ORIGINS` must include `http://localhost:5173` |

---

## Verify Your Full Stack

After both backend and frontend are running, test the full flow:

1. Open http://localhost:5173 — login page appears
2. Register a new account (or use test credentials from `.env.dev`)
3. Open http://localhost:8000/api/docs — Swagger UI loads with all routes
4. Open http://localhost:6335/dashboard — Qdrant shows 0 collections (empty on first run)
5. Open http://localhost:9001 — MinIO console shows empty storage

If all 5 load correctly, your local environment is fully operational.

---

## Next Steps

- Read `02-backend-architecture.md` to understand the FastAPI codebase structure
- Read `03-frontend-architecture.md` to understand the React app structure
- Bookmark `05-common-tasks.md` as a daily reference card
