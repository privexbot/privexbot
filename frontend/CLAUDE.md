# PrivexBot Frontend

## Overview
React 19 + TypeScript + Vite. Tailwind CSS + shadcn/ui. React Flow for chatflow visual editor. React Query for data fetching.

## Chatflow Builder Architecture

### File: `src/pages/ChatflowBuilder.tsx`
The main visual workflow editor. Contains:
- Inline node visual components (BaseNode wrapper + type-specific styling)
- NODE_CATEGORIES defining the drag palette (4 categories, 17 node types)
- nodeTypes mapping for React Flow (17 entries)
- renderNodeConfig() switch with config panels for all node types
- Auto-save to draft (1s debounce), validation, deploy flow

### Node Data Flow
```
User edits config panel -> debounced onChange (300ms) ->
  handleNodeConfigChange() -> updates node.data.config ->
  auto-save mutation (1s) -> PATCH /chatflows/drafts/{id}
```

Config is stored at `node.data.config` in React Flow's node data structure.
The backend reads it via `node.get("data", {}).get("config", ...)`.

### Node Types (17 total, 4 categories)

**Flow Control**: trigger, condition, loop, response
**AI & Knowledge**: llm, kb, memory
**Data & Integration**: http, variable, code, database
**Actions & Automation**: webhook, email, notification, handoff, lead_capture, calendly

### Config Components
Located in `src/components/chatflow/configs/`. Each exports a named function component:
```typescript
interface Props {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}
```
Pattern: useState for each field -> useCallback emitChange -> useEffect with 300ms debounce.

### Visual Node Components
Defined inline in ChatflowBuilder.tsx using BaseNode wrapper. Each has:
- Gradient background with icon
- Input/output handles (trigger: no input, response: no output, condition: 2 outputs)
- Label display

### Deploy Flow
1. Validate: trigger node exists, response node exists, no disconnected nodes
2. Open ChannelSelector dialog (6 channels: website, telegram, discord, slack, whatsapp, zapier)
3. Call `chatflowDraftApi.finalize(draftId, {channels})` -- nodes/edges already saved in draft
4. Navigate to Studio page

### Validation
- `useDraftValidation.ts`: Client-side checks for trigger node (type="trigger"), response node, orphaned nodes
- `ChatflowBuilder.validateWorkflow()`: Same checks inline, displayed as error banner

## File Structure
```
src/
  pages/
    ChatflowBuilder.tsx   # Main visual editor (all nodes defined here)
    StudioPage.tsx         # Chatflows listing/dashboard
  components/
    chatflow/
      configs/            # 16 config panel components (one per configurable node)
      nodes/              # Standalone node components (unused by builder, kept for reference)
      ReactFlowCanvas.tsx # Alternative canvas component (not used by builder)
      NodePalette.tsx     # Alternative palette (not used by builder)
      NodeConfigPanel.tsx # Alternative config routing (not used by builder)
  api/
    chatflow.ts           # API client (draft + deployed endpoints)
  hooks/
    useAutoSave.ts        # Debounced draft saving
    useDraftValidation.ts # Pre-deploy validation
    useDraftPreview.ts    # Live testing
```

## Key Conventions
- Config panel components use named exports: `export function FooNodeConfig({...})`
- Debounce pattern: 300ms for config changes, 1000ms for auto-save
- All UI components from shadcn/ui (`@/components/ui/`)
- Icons from lucide-react
- API calls via `@/lib/api-client` (axios instance with auth interceptor)
