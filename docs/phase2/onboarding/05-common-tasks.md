# Common Tasks — Quick Reference
> "How do I..." answers for daily development work.
> All commands verified from actual scripts and source files.

---

## Backend Tasks

### How do I start the backend?

```bash
cd backend
./scripts/docker/dev.sh up
```

Wait for `Uvicorn running on http://0.0.0.0:8000` in the logs. All 9 containers start together.

---

### How do I see what's happening in the backend?

```bash
# All logs (all containers):
./scripts/docker/dev.sh logs

# Just the FastAPI server:
./scripts/docker/dev.sh logs backend

# Just Celery worker:
./scripts/docker/dev.sh logs celery

# Just a specific container (raw Docker):
docker logs privexbot-backend-dev -f
```

---

### How do I test an endpoint?

1. Open http://localhost:8000/api/docs (Swagger UI)
2. Click "Authorize" in the top right — paste your JWT token
3. Find the endpoint, click "Try it out", fill in params, click "Execute"

Or use curl:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/v1/chatbots?org_id=ORG_ID&workspace_id=WS_ID
```

---

### How do I add an environment variable?

1. Add to `src/app/core/config.py`:
```python
class Settings(BaseSettings):
    MY_NEW_VAR: str = Field(default="default_value", description="What it does")
```

2. Add to `.env.dev` for local dev:
```
MY_NEW_VAR=local_value
```

3. Add to `.env.example` so production knows it needs this:
```
MY_NEW_VAR=
```

4. Restart the backend:
```bash
./scripts/docker/dev.sh restart backend
```

5. Use it anywhere:
```python
from app.core.config import settings
value = settings.MY_NEW_VAR
```

---

### How do I inspect the database?

```bash
./scripts/docker/dev.sh db
# Opens psql in the privexbot_dev database

# Useful psql commands:
\dt               # List all tables
\d chatbots       # Describe table structure
SELECT * FROM chatbots LIMIT 5;
\q                # Exit psql
```

---

### How do I run a database migration?

```bash
# Generate migration from model changes:
./scripts/docker/dev.sh shell
# Inside container:
cd /app/src
alembic revision --autogenerate -m "describe_your_change"
exit

# Apply migrations:
./scripts/docker/dev.sh migrate
```

---

### How do I clear all Redis data?

```bash
docker exec privexbot-redis-dev redis-cli FLUSHDB
```

This clears drafts, sessions, and Celery state. **Be careful in shared environments.**

To clear only draft keys:
```bash
docker exec privexbot-redis-dev redis-cli --scan --pattern "draft:*" | xargs docker exec privexbot-redis-dev redis-cli DEL
```

---

### How do I run a one-off Python script?

```bash
./scripts/docker/dev.sh shell
# Inside the container (has full app context):
cd /app/src
python -c "
from app.db.session import get_db
from app.models.user import User
db = next(get_db())
users = db.query(User).all()
print(len(users), 'users')
"
exit
```

---

### How do I debug a Celery task?

Check Celery logs:
```bash
./scripts/docker/dev.sh logs celery
```

Check task status via Flower UI at http://localhost:5555 (admin/admin123).

To run a task manually from a Python shell:
```bash
./scripts/docker/dev.sh shell
cd /app/src
python -c "
from app.tasks.celery_worker import your_task
result = your_task.delay(arg1, arg2)
print(result.id)
"
```

---

### How do I check Qdrant (vector database) collections?

Open http://localhost:6335/dashboard

Or use the REST API:
```bash
curl http://localhost:6335/collections
```

---

### How do I rebuild the backend container?

Needed when you update `pyproject.toml` or the Dockerfile:
```bash
./scripts/docker/dev.sh build
./scripts/docker/dev.sh restart backend
```

With Docker cache busting (needed after updating pip packages):
```bash
./scripts/docker/dev.sh --no-cache build
```

---

### How do I check service health?

```bash
./scripts/docker/dev.sh status

# Or individual health checks:
curl http://localhost:8000/health      # Backend
curl http://localhost:6335/healthz     # Qdrant
redis-cli -p 6380 ping                # Redis → PONG
```

---

## Frontend Tasks

### How do I start the frontend?

```bash
cd frontend
npm run dev
# Vite dev server at http://localhost:5173
```

---

### How do I add a toast notification?

```typescript
import { useToast } from "@/components/ui/use-toast";

function MyComponent() {
  const { toast } = useToast();

  const handleAction = () => {
    toast({
      title: "Success",
      description: "Your changes were saved.",
    });
    // or: variant: "destructive" for error toasts
  };
}
```

---

### How do I make an API call?

Always use `apiClient` from `@/lib/api-client`:

```typescript
import { apiClient, handleApiError } from "@/lib/api-client";

// Inside a component or API module:
try {
  const response = await apiClient.get(`/chatbots?workspace_id=${workspaceId}`);
  return response.data;
} catch (error) {
  const message = handleApiError(error);
  toast({ title: "Error", description: message, variant: "destructive" });
}
```

---

### How do I get the current workspace/org?

```typescript
import { useApp } from "@/contexts/AppContext";

function MyComponent() {
  const { currentWorkspace, currentOrg } = useApp();
  // currentWorkspace.id, currentOrg.id
}
```

---

### How do I check API call details in the browser?

1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by `localhost:8000`
4. Look at Request/Response headers and body

---

### How do I add a new Zustand store?

Copy the pattern from an existing store:

```typescript
// src/store/your-feature-store.ts
import { create } from "zustand";

interface YourFeatureStore {
  items: Item[];
  setItems: (items: Item[]) => void;
  selectedItem: Item | null;
  setSelectedItem: (item: Item | null) => void;
}

export const useYourFeatureStore = create<YourFeatureStore>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  selectedItem: null,
  setSelectedItem: (selectedItem) => set({ selectedItem }),
}));
```

---

### How do I add a new credential type to the UI?

1. Add the type string to the credential type options in `src/components/shared/CredentialSelector.tsx`
2. If it has a unique form, create a form component in `src/components/credentials/`
3. Add a case to the credentials create/edit page (`src/pages/Credentials.tsx`)
4. On the backend, add the type to `CredentialType` enum in `src/app/models/credential.py`

---

### How do I test a chatflow locally?

1. Build a chatflow in the dashboard at http://localhost:5173
2. Deploy it (click Deploy)
3. Open the bot's detail page → "Test" tab → type a message
4. Or use the API directly:
```bash
curl -X POST http://localhost:8000/api/v1/public/bots/BOT_ID/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"message": "Hello", "session_id": "test_session_1"}'
```

---

### How do I understand why the frontend is showing stale data?

TanStack Query caches responses for 5 minutes (staleTime in `App.tsx`). To force a refetch:

```typescript
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();
// Invalidate a specific query:
queryClient.invalidateQueries({ queryKey: ["chatbots", workspaceId] });
// Invalidate everything:
queryClient.clear();
```

---

### How do I run a production build locally?

```bash
cd frontend
npm run build
# Output: frontend/dist/
# Preview the build:
npm run preview  # Vite preview server at http://localhost:4173
```

---

## Workflow Tips

### First time on a new feature

1. Read the relevant feature doc in `docs/phase2/features/` if one exists
2. Read the existing implementation you'll be modifying (don't assume)
3. Check if there's a similar existing implementation to follow as a pattern
4. Make a small change, restart backend, verify it works before continuing

### When something breaks

1. Check logs first: `./scripts/docker/dev.sh logs backend`
2. Check if the backend is healthy: `curl http://localhost:8000/health`
3. Check if migrations are up to date: `./scripts/docker/dev.sh migrate`
4. Check Redis is running: `./scripts/docker/dev.sh status`
5. When in doubt: `./scripts/docker/dev.sh restart backend`

### After pulling new code

```bash
# Backend: rebuild if pyproject.toml changed
./scripts/docker/dev.sh build
./scripts/docker/dev.sh migrate
./scripts/docker/dev.sh restart backend

# Frontend: reinstall if package.json changed
cd frontend
npm ci --legacy-peer-deps
```
