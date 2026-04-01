# Frontend Architecture
> For frontend interns. Understand the React app structure without reading every file.
> All facts verified from `frontend/src/` — no assumptions.

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 19.1.1 | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite | 7.1.7 | Dev server (HMR) + build tool |
| React Router | 6.21.3 | Client-side routing |
| Zustand | — | Feature-level state management |
| TanStack Query | 5.17.19 | Server state caching (lists, pagination) |
| ReactFlow | 11.10.4 | Visual node editor (chatflow builder) |
| Radix UI | — | Accessible UI primitives (dialogs, selects, etc.) |
| Tailwind CSS | — | Utility-first CSS |
| Framer Motion | — | Animations |
| React Hook Form | — | Form state + validation |
| Zod | — | Schema validation |
| Axios | — | HTTP client with interceptors |
| Lucide React | — | Icons |

---

## App Entry Flow

```
frontend/src/main.tsx
  └── <App />  (from src/components/App/App.tsx)
        └── <QueryClientProvider client={queryClient}>     TanStack Query
              └── <ThemeProvider>                           Dark/light mode
                    └── <AuthProvider>                      JWT + user state
                          └── <AppProvider>                 Org/workspace context
                                └── <BrowserRouter>         React Router
                                      └── <Routes>          All route definitions
                                            ├── /            LandingPage (public)
                                            ├── /login       LoginPage (public)
                                            ├── /dashboard   → <ProtectedRoute>
                                            ├── /chatbots/*  → <ProtectedRoute>
                                            ├── /knowledge-bases/*  → <ProtectedRoute>
                                            └── ...          (50+ more routes)
```

`<ProtectedRoute>` checks `isAuthenticated` from `AuthContext`. If false, redirects to `/login`.

`<Toaster />` from shadcn/ui is also mounted at the App level — provides toast notifications app-wide.

---

## Directory Structure

```
src/
├── main.tsx                    React entry point
├── components/
│   ├── App/
│   │   └── App.tsx             Router + provider stack
│   ├── auth/
│   │   ├── ProtectedRoute.tsx  Guards authenticated routes
│   │   └── StaffRoute.tsx      Guards admin-only routes
│   ├── layout/
│   │   ├── AdminLayout.tsx     Admin panel layout
│   │   └── MainMenu.tsx        Sidebar navigation links
│   ├── chatflow/
│   │   ├── ReactFlowCanvas.tsx     ReactFlow canvas + node types registry
│   │   ├── NodePalette.tsx         Draggable node list (categorized)
│   │   ├── NodeConfigPanel.tsx     Right panel: node config form (switch on type)
│   │   ├── nodes/                  Visual node components (14 files)
│   │   │   ├── LLMNode.tsx
│   │   │   ├── ConditionNode.tsx
│   │   │   ├── KnowledgeBaseNode.tsx
│   │   │   ├── EmailNode.tsx
│   │   │   ├── WebhookNode.tsx
│   │   │   ├── HandoffNode.tsx
│   │   │   ├── LeadCaptureNode.tsx
│   │   │   ├── MemoryNode.tsx
│   │   │   ├── DatabaseNode.tsx
│   │   │   └── ...
│   │   └── configs/                Node config forms (per type)
│   │       ├── EmailNodeConfig.tsx
│   │       ├── WebhookNodeConfig.tsx
│   │       ├── HandoffNodeConfig.tsx
│   │       ├── LeadCaptureNodeConfig.tsx
│   │       └── NotificationNodeConfig.tsx
│   ├── kb/                     Knowledge base UI components
│   ├── shared/                 Reusable components (CredentialSelector, etc.)
│   ├── ui/                     shadcn/ui base components
│   └── ...
├── pages/                      Route page components (~52 pages)
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── ChatflowBuilder.tsx     Main chatflow builder page
│   ├── StudioPage.tsx          Bot testing/chat UI
│   ├── Credentials.tsx         Credential management
│   ├── chatbots/               Simple chatbot CRUD pages
│   │   ├── create.tsx
│   │   ├── detail.tsx
│   │   └── edit.tsx
│   ├── knowledge-bases/        KB management pages (10 sub-pages)
│   │   ├── index.tsx           KB list
│   │   ├── create.tsx          KB wizard
│   │   ├── detail.tsx
│   │   ├── documents.tsx
│   │   └── ...
│   ├── leads/                  Lead management
│   └── admin/                  Admin panel pages
├── api/                        API call modules (one per domain)
│   ├── auth.ts                 Auth endpoints
│   ├── chatbot.ts              Chatbot CRUD
│   ├── chatflow.ts             Chatflow CRUD + execution
│   └── ...
├── lib/
│   ├── api-client.ts           Axios instance + interceptors (token injection, refresh)
│   └── kb-client.ts            KB-specific API client
├── contexts/
│   ├── AuthContext.tsx          isAuthenticated, user, login, logout
│   ├── AppContext.tsx           currentOrg, currentWorkspace, switching
│   └── ThemeContext.tsx         Dark/light mode
├── store/                      Zustand stores
│   ├── chatbot-store.ts
│   ├── kb-store.ts
│   ├── draft-store.ts
│   └── workspace-store.ts
├── types/                      TypeScript interfaces (mirroring backend models)
├── config/
│   └── env.ts                  Reads VITE_* env vars (dual-mode dev/prod)
└── hooks/                      Custom React hooks
```

---

## State Management (3 Layers)

### Layer 1: React Context (App-wide)

**`AuthContext`** — `src/contexts/AuthContext.tsx`
- `user: UserProfile | null` — the logged-in user
- `isAuthenticated: boolean`
- `isLoading: boolean`
- `emailLogin()`, `walletLogin()`, `logout()`
- Token stored in `localStorage` as `access_token` and `refresh_token`

**`AppContext`** — `src/contexts/AppContext.tsx`
- `currentOrg` — the active organization
- `currentWorkspace` — the active workspace within the org
- `switchOrganization()`, `switchWorkspace()`
- Selection persisted in `localStorage`

Use these contexts from any component:
```typescript
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";

const { user, isAuthenticated } = useAuth();
const { currentWorkspace, currentOrg } = useApp();
```

### Layer 2: Zustand Stores (Feature-specific)

Zustand stores hold UI state that needs to persist across component unmounts but doesn't need to be in a global context.

```typescript
import { useChatbotStore } from "@/store/chatbot-store";
const { selectedChatbot, setSelectedChatbot } = useChatbotStore();
```

### Layer 3: TanStack Query (Server state)

TanStack Query handles fetching, caching, and invalidation for paginated lists and frequently-read data.

```typescript
import { useQuery } from "@tanstack/react-query";

const { data: chatbots, isLoading } = useQuery({
  queryKey: ["chatbots", workspaceId],
  queryFn: () => chatbotApi.list(workspaceId),
});
```

---

## Making API Calls

**Always use `apiClient` from `src/lib/api-client.ts`.** Never create raw `axios` instances.

The `apiClient` automatically:
1. Adds `Authorization: Bearer {token}` to every request (reads from `localStorage`)
2. On 401 response: tries to refresh the token, retries the original request
3. On refresh failure: clears tokens and redirects to `/login`
4. Parses backend error responses (`{detail: "..."}` format) via `handleApiError()`

```typescript
// src/api/chatbot.ts pattern
import { apiClient, handleApiError } from "@/lib/api-client";

export const chatbotApi = {
  list: async (workspaceId: string) => {
    const response = await apiClient.get(`/chatbots?workspace_id=${workspaceId}`);
    return response.data;
  },

  create: async (data: CreateChatbotRequest) => {
    try {
      const response = await apiClient.post("/chatbots", data);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
```

**`src/lib/kb-client.ts`** — a separate client for knowledge base operations that requires different headers or base URLs.

---

## Authentication Flow

```
User opens app
  → AuthContext mounts
  → Reads access_token from localStorage
  → If exists: GET /auth/me to validate + populate user
  → If missing/invalid: isAuthenticated = false → redirect to /login

User logs in
  → POST /auth/login or /auth/wallet-verify
  → Response: { access_token, refresh_token, user }
  → Store tokens in localStorage
  → Set user in AuthContext

Every API request
  → apiClient request interceptor
  → Reads access_token from localStorage
  → Adds Authorization: Bearer {token}

Token expired (401 response)
  → apiClient response interceptor
  → POST /auth/refresh with refresh_token
  → If success: update access_token, retry original request
  → If fail: clear localStorage, redirect to /login
```

---

## Adding a New Page

Step-by-step:

**1. Create the page component**

```typescript
// src/pages/YourNewPage.tsx
import { useApp } from "@/contexts/AppContext";

export function YourNewPage() {
  const { currentWorkspace } = useApp();

  return (
    <div>
      <h1>Your New Page</h1>
    </div>
  );
}
```

**2. Add the route in `App.tsx`**

```typescript
// src/components/App/App.tsx — inside the <Routes> block
import { YourNewPage } from "@/pages/YourNewPage";

// Inside <Routes>:
<Route
  path="/your-new-page"
  element={
    <ProtectedRoute>
      <YourNewPage />
    </ProtectedRoute>
  }
/>
```

**3. Add a link in the sidebar**

```typescript
// src/components/layout/MainMenu.tsx — add a NavLink entry
<NavLink to="/your-new-page">Your New Page</NavLink>
```

---

## Adding a New Chatflow Node (Frontend)

Five places to update:

**1. Create the visual node component**

```typescript
// src/components/chatflow/nodes/YourNode.tsx
// Follow: src/components/chatflow/nodes/EmailNode.tsx

import { Handle, Position } from "reactflow";

export function YourNode({ data }: { data: any }) {
  return (
    <div className="rounded-lg border bg-card p-3 min-w-[180px]">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <YourIcon className="w-4 h-4" />
        <span className="font-medium text-sm">{data.label || "Your Node"}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

**2. Create the config panel**

```typescript
// src/components/chatflow/configs/YourNodeConfig.tsx
// Follow: src/components/chatflow/configs/EmailNodeConfig.tsx
export function YourNodeConfig({ node, onChange }: ConfigProps) {
  // Form fields for this node type's config
}
```

**3. Register the node type in `ReactFlowCanvas.tsx`**

```typescript
// src/components/chatflow/ReactFlowCanvas.tsx
// Add to the nodeTypes object:
import { YourNode } from "./nodes/YourNode";
const nodeTypes = {
  ...existingTypes,
  your_node_type: YourNode,
};
```

**4. Add to `NodePalette.tsx`**

```typescript
// src/components/chatflow/NodePalette.tsx
// Add to NODE_TYPES array:
{
  type: "your_node_type",
  label: "Your Node",
  icon: <YourIcon className="w-4 h-4" />,
  description: "What this node does",
  category: "Integration",  // AI | Data | Logic | Integration | Action | Output
}
```

**5. Add config rendering in `NodeConfigPanel.tsx`**

```typescript
// src/components/chatflow/NodeConfigPanel.tsx
// Add case to the switch/if statement:
import { YourNodeConfig } from "./configs/YourNodeConfig";

// Inside the panel:
if (selectedNode.type === "your_node_type") {
  return <YourNodeConfig node={selectedNode} onChange={handleChange} />;
}
```

---

## Chatflow Builder Architecture

The visual chatflow builder (`pages/ChatflowBuilder.tsx`) uses:

- **ReactFlow** for the drag-and-drop canvas
- **`ReactFlowCanvas.tsx`** — manages the canvas, node types registry, edge routing
- **`NodePalette.tsx`** — left panel, click a node type to add it to the canvas
- **`NodeConfigPanel.tsx`** — right panel, shows config form for the selected node

The chatflow data shape (nodes + edges) is saved as JSON in the `Chatflow.flow_data` column in PostgreSQL.

---

## CredentialSelector Component

`src/components/shared/CredentialSelector.tsx` is a reusable dropdown for selecting credentials.

```typescript
// Usage in any node config panel:
<CredentialSelector
  workspaceId={workspaceId}
  credentialType="smtp"  // filter by type
  value={config.credential_id}
  onChange={(id) => updateConfig({ credential_id: id })}
/>
```

When adding a new credential type (e.g., `"slack_bot"`), add it to the type filter options in `CredentialSelector.tsx`.

---

## Environment Variables

Frontend env vars are in `src/config/env.ts`:

```typescript
// src/config/env.ts
export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  WIDGET_CDN_URL: import.meta.env.VITE_WIDGET_CDN_URL || "http://localhost:9000",
  ENV: import.meta.env.VITE_ENV || "development",
};
```

Always import from `@/config/env` rather than `import.meta.env` directly.

Available env vars (set in `.env.dev`):

| Var | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API URL |
| `VITE_WIDGET_CDN_URL` | `http://localhost:9000` | Widget bundle CDN URL |
| `VITE_ENV` | `development` | Environment name |
| `VITE_ENABLE_DEBUG` | `true` | Enable debug features |
| `VITE_ENABLE_ANALYTICS` | `false` | Enable analytics tracking |
