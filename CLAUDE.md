# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PrivexBot** is a privacy-focused, multi-tenant SaaS platform for building AI chatbots with RAG-powered knowledge bases. It features dual creation modes (simple form-based and visual workflow builder), multi-channel deployment (web widget, Discord, Telegram, WhatsApp), and runs AI workloads in Secret VM (Trusted Execution Environments) for data privacy.

The project is a monorepo with three packages:
- **Backend**: FastAPI/Python API server with PostgreSQL, Redis, Celery, and Qdrant
- **Frontend**: React 19 + TypeScript admin dashboard with visual workflow builder
- **Widget**: Vanilla JavaScript embeddable chat widget (~50KB)

## Development Commands

### Backend Development

```bash
# Start all backend services (API, PostgreSQL, Redis, Qdrant)
docker compose -f backend/docker-compose.dev.yml up

# Database migrations
docker compose -f backend/docker-compose.dev.yml exec backend-dev alembic upgrade head

# Run integration tests
docker compose -f backend/docker-compose.dev.yml exec backend-dev python scripts/test_integration.py

# Add Python dependencies (uses uv package manager)
cd backend && uv add package-name
```

Backend runs on http://localhost:8000 with API docs at http://localhost:8000/api/docs

### Frontend Development

```bash
cd frontend
npm install
npm run dev          # Start development server on http://localhost:3000
npm run build        # Production build
npm run lint         # Lint code
npm run test         # Run tests
```

### Widget Development

```bash
cd widget
npm install
npm run dev          # Development build with watch
npm run build        # Production minified build
```

## High-Level Architecture

### Multi-Tenant Hierarchy
```
Organization (Company)
  ↓
Workspace (Team/Department)
  ↓
├── Chatbots (Simple Q&A bots)
├── Chatflows (Visual workflow automation)
├── Knowledge Bases (RAG with multiple sources)
└── Credentials (API keys for integrations)
```

### Draft-First Architecture

**CRITICAL**: ALL entities (chatbots, chatflows, knowledge bases) are created in draft mode (Redis) before database persistence.

**Flow**:
1. Create Draft → Redis (24hr TTL)
2. Configure & Preview → Live AI testing without database save
3. Deploy → Save to PostgreSQL + register webhooks
4. Live → Accessible via configured channels

**Why**: Prevents database pollution, enables instant preview, validates before commit.

### Knowledge Base ETL Pipeline

```
Source → Smart Parsing → Intelligent Chunking → Embedding → Vector Store
```

**Supported Sources**:
- File upload (PDF, Word, CSV, JSON, 15+ formats)
- Website scraping (Crawl4AI/Jina fallback)
- Google Docs/Sheets (OAuth integration)
- Notion (API integration)
- Direct text input

**Processing**:
- Uses Celery background tasks with specialized queues
- Real-time status tracking via Redis
- Frontend polls `/api/v1/kb-pipeline/{id}/status` for updates

### Chatbot vs Chatflow

| Aspect | Chatbot | Chatflow |
|--------|---------|----------|
| Creation | Form-based UI | Visual drag-and-drop editor (ReactFlow) |
| Complexity | Simple, linear | Complex branching with conditional logic |
| Database | `chatbots` table | `chatflows` table |
| Deployment | Unified public API | Unified public API |

**IMPORTANT**: Both share the same public API endpoint (`/v1/bots/{bot_id}/chat`) and widget despite different creation methods.

### Multi-Channel Deployment

When deployed, chatbots/chatflows are accessible via:
- Website embed (JavaScript widget or iframe)
- Discord bot (webhook auto-registration)
- Telegram bot (webhook auto-registration)
- WhatsApp Business API
- Zapier webhook (auto-generated)
- Direct REST API

## Key Development Patterns

### Backend Patterns

**Multi-Tenancy**: All database queries MUST filter by organization/workspace:
```python
# Always use dependency injection for tenant context
from app.api.v1.dependencies import get_current_workspace

@router.get("/chatbots")
async def list_chatbots(
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    return db.query(Chatbot).filter(
        Chatbot.workspace_id == workspace.id
    ).all()
```

**Draft Operations**: Always check Redis draft before database:
```python
# Services: draft_service.py, kb_draft_service.py
draft_data = await draft_service.get_draft(draft_id)
if not draft_data:
    # Fall back to database if needed
```

**Background Tasks**: Use Celery for long-running operations:
- Document processing → `tasks/kb_pipeline_tasks.py`
- Web scraping → `web_scraping` queue
- Embeddings → `embeddings` queue

### Frontend Patterns

**API Client Organization**: Multiple specialized API clients:
```typescript
// KB-specific API client with 3-phase architecture
import kbClient from '@/lib/kb-client';

// Draft operations (Phase 1)
await kbClient.draft.create(request);
await kbClient.draft.addWebSources(draftId, sources);

// Management operations (Phase 3)
await kbClient.kb.get(kbId);
await kbClient.kb.retryProcessing(kbId);

// Pipeline monitoring
await kbClient.pipeline.getStatus(pipelineId);
```

**State Management Patterns**:
- **Zustand**: Global state with immutable updates (CRITICAL: never mutate state directly)
```typescript
// CORRECT: Immutable updates
set((state) => ({
  ...state,
  draftSources: [...state.draftSources, newSource]
}));

// WRONG: Direct mutation (causes errors)
state.draftSources.push(newSource); // TypeError: Cannot assign to read only property
```

- **Single Source of Truth**: Always prioritize edited_content over content
```typescript
const content = page.edited_content || page.content || '';
```

**Error Handling Patterns**:
```typescript
// API error handling with user-friendly messages
try {
  await kbClient.kb.retryProcessing(kbId);
} catch (error) {
  // Use Coming Soon messages for unimplemented features
  if (error.message.includes("not yet implemented")) {
    setError("📄 Feature Coming Soon!");
  } else {
    setError(error.message);
  }
}
```

**Form Validation**: React Hook Form + Zod schemas

**Component Patterns**:
- Avoid button nesting (HTML validation errors)
- Use proper TypeScript interfaces for type safety
- Null safety for optional chaining

## Testing Requirements

### Backend
- Run integration tests: `docker compose -f backend/docker-compose.dev.yml exec backend-dev python scripts/test_integration.py`
- Verify test setup: `docker compose -f backend/docker-compose.dev.yml exec backend-dev bash scripts/verify_test_setup.sh`

### Frontend
- Run tests: `cd frontend && npm run test`
- E2E tests: `cd frontend && npm run test:e2e`

## Knowledge Base Implementation Patterns (CRITICAL)

### API Strategy Matching
**CRITICAL**: Frontend and backend must use identical strategy names:
```typescript
// CORRECT: Use 'hybrid_search' (matches backend)
retrieval_config: {
  strategy: 'hybrid_search',
  top_k: modelConfig.performance.max_results,
  score_threshold: 0.7,
  rerank_enabled: false,
}

// WRONG: Using 'hybrid' (causes API errors)
strategy: 'hybrid' // Backend doesn't recognize this
```

### Chunking Configuration Patterns
```typescript
// Handle "no chunking" strategy correctly
const getEstimatedChunks = () => {
  // For FULL_CONTENT strategy, each source becomes one chunk
  if (chunkingConfig.strategy === ChunkingStrategy.FULL_CONTENT) {
    return draftSources.length;
  }

  // Calculate based on actual content, not hardcoded values
  let totalContent = 0;
  draftSources.forEach(source => {
    const pages = source.metadata?.previewPages || [];
    pages.forEach(page => {
      const content = page.edited_content || page.content || '';
      totalContent += content.length;
    });
  });

  const avgChunkSize = chunkingConfig.chunk_size - chunkingConfig.chunk_overlap;
  return Math.max(1, Math.ceil(totalContent / avgChunkSize));
};
```

### Retry Implementation Pattern
```typescript
// Check actual KB status, not pipeline status
const [kbDetails, setKbDetails] = useState<KnowledgeBase | null>(null);

// Retry only shows when KB is actually failed
{kbDetails?.status === 'failed' && (
  <Button onClick={handleRetry} variant="outline">
    <RefreshCw className="h-4 w-4 mr-2" />
    Retry Pipeline
  </Button>
)}
```

## Frontend Architecture

### Technology Stack
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom theme colors + shadcn/ui components
- **UI Components**: Radix UI (accessible, unstyled primitives)
- **State Management**: Zustand with immer middleware for immutability
- **Forms**: React Hook Form + Zod validation
- **Routing**: React Router v6
- **Animations**: Framer Motion
- **API Client**: Axios with specialized client modules

### Component Architecture

#### Directory Structure
```
frontend/src/
├── api/                  # API client modules
│   ├── schemas/         # Zod schemas for API validation
│   └── *.ts            # Domain-specific API clients
├── components/
│   ├── ui/             # Reusable shadcn/ui components
│   ├── landing/        # Landing page sections
│   ├── auth/           # Authentication components
│   ├── kb/             # Knowledge base components
│   ├── shared/         # Shared components (Container, etc.)
│   └── workspace/      # Workspace management
├── contexts/           # React Context providers
│   ├── ThemeContext    # Dark/light mode management
│   ├── AuthContext     # Authentication state
│   └── AppContext      # Global app state
├── hooks/              # Custom React hooks
├── lib/                # Utilities and clients
│   ├── schemas/        # Reusable Zod schemas
│   ├── api-client.ts   # Base API client
│   ├── kb-client.ts    # KB-specific client
│   └── utils.ts        # Helper functions
├── pages/              # Page components (route handlers)
├── store/              # Zustand stores
│   ├── kb-store.ts     # Knowledge base state
│   ├── draft-store.ts  # Draft management
│   └── workspace-store.ts
├── styles/             # Global CSS
└── types/              # TypeScript type definitions
```

### Theming System

The app uses a dual theming approach:
1. **CSS Variables**: Define colors in HSL format for dynamic theming
2. **Tailwind Classes**: Apply theme-aware classes like `dark:text-white`

Theme colors are defined in:
- `tailwind.config.js`: Brand colors and scales
- `src/styles/index.css`: CSS variables for light/dark modes

#### Color Palette
```javascript
// Primary brand colors
primary: "#3b82f6"      // Blue
secondary: "#8b5cf6"    // Purple
accent: "#06b6d4"       // Cyan
success: "#22c55e"      // Green
error: "#ef4444"        // Red
warning: "#f59e0b"      // Amber
```

### State Management Patterns

#### Zustand Store Pattern
```typescript
// ALWAYS use immutable updates with immer
set((state) => {
  state.property = newValue; // ✅ Immer handles immutability
});

// NEVER mutate state directly outside immer
state.array.push(item); // ❌ Will cause TypeError
```

#### Context Providers Hierarchy
```tsx
<ThemeProvider>
  <AuthProvider>
    <AppProvider>
      <Router>
        {/* App content */}
      </Router>
    </AppProvider>
  </AuthProvider>
</ThemeProvider>
```

### Authentication Flow

1. **Email/Password**: Traditional signup/login with JWT tokens
2. **Wallet Authentication**: Support for MetaMask (EVM), Phantom (Solana), Keplr (Cosmos)
3. **Token Management**: Stored in localStorage with expiry tracking
4. **Protected Routes**: Using `ProtectedRoute` wrapper component

### Form Validation Pattern

All forms use React Hook Form + Zod:
```typescript
// Define schema
const schema = z.object({
  email: emailSchema,
  name: nameSchema("Organization name")
});

// Use in component
const form = useForm({
  resolver: zodResolver(schema)
});
```

### API Client Architecture

Multiple specialized API clients for different domains:
- `api-client.ts`: Base client with interceptors
- `kb-client.ts`: Knowledge base operations (3-phase architecture)
- `content-enhancement-client.ts`: AI content operations

#### Error Handling Pattern
```typescript
try {
  await apiClient.operation();
} catch (error) {
  // User-friendly error messages
  const message = error.response?.data?.detail || "Operation failed";
  setError(message);
}
```

### Component Patterns

#### Reusable UI Components (shadcn/ui)
- Located in `components/ui/`
- Built on Radix UI primitives
- Styled with Tailwind + CVA (class-variance-authority)
- Examples: Button, Input, Card, Dialog, Toast

#### Page Components
- Located in `pages/`
- Handle routing and data fetching
- Compose smaller components
- Examples: LandingPage, DashboardPage, KnowledgeBasesPage

#### Landing Page Architecture
```tsx
// Modular section components
<LandingPage>
  <Header />
  <Hero />
  <ValuePropositions />
  <ProductOverview />
  <Features />
  <Testimonials />
  <Pricing />
  <CaseStudies />
  <FinalCTA />
  <Footer />
</LandingPage>
```

### Dark Mode Implementation

1. **ThemeContext**: Manages theme state (light/dark/system)
2. **Document Class**: Applies `dark` class to `<html>`
3. **Tailwind Dark Variants**: Use `dark:` prefix for dark mode styles
4. **Contrast Compliance**: Ensure WCAG AA contrast ratios

Example:
```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
```

### TypeScript Patterns

#### Type Safety
- Strict mode enabled
- All API responses typed
- Zod schemas for runtime validation
- Discriminated unions for complex states

#### Common Types Location
- `types/auth.ts`: Authentication types
- `types/knowledge-base.ts`: KB domain types
- `api/schemas/*.schema.ts`: API contract schemas

## Common Tasks

### Adding a New API Endpoint
1. Define Pydantic schema in `backend/src/app/schemas/`
2. Create route in `backend/src/app/api/v1/routes/`
3. Register router in `backend/src/app/main.py`
4. Add tenant filtering with workspace/organization dependencies
5. Test via Swagger UI at http://localhost:8000/api/docs

### Adding a Chatflow Node
1. Create node class in `backend/src/app/chatflow/nodes/` extending `BaseNode`
2. Implement `execute(context)` method
3. Register in `chatflow_executor.py`
4. Add frontend component in `frontend/src/components/chatflow/nodes/`

### Creating Database Migration
1. Modify SQLAlchemy model in `backend/src/app/models/`
2. Generate: `docker compose -f backend/docker-compose.dev.yml exec backend-dev alembic revision --autogenerate -m "description"`
3. Review migration in `backend/src/alembic/versions/`
4. Apply: `docker compose -f backend/docker-compose.dev.yml exec backend-dev alembic upgrade head`

## Environment Configuration

Backend requires `.env` file (see `backend/.env.dev.example`):
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis for drafts/cache
- `QDRANT_URL` - Vector database
- `SECRET_KEY` - JWT signing (generate: `openssl rand -hex 32`)
- `BACKEND_CORS_ORIGINS` - Frontend URLs

Frontend requires `.env` file (see `frontend/.env.example`):
- `VITE_API_URL` - Backend URL
- `VITE_WIDGET_URL` - Widget CDN URL