# Frontend Components - Complete Implementation

All required chatbot and chatflow components have been successfully created.

---

## ✅ Chatbot Components (`/src/components/chatbot/`)

### 1. **ChatbotSettingsForm.tsx**

**Purpose**: Reusable form fields for chatbot configuration

**Features**:

- Basic info fields (name, description, greeting)
- AI configuration (model selection, temperature slider, max tokens)
- Lead capture toggle
- Integrated with React Hook Form
- Zod validation support
- Responsive layout

**Props**:

```typescript
interface ChatbotSettingsFormProps {
  register: UseFormRegister<ChatbotFormData>;
  errors: FieldErrors<ChatbotFormData>;
  watch: (name: keyof ChatbotFormData) => any;
  setValue: (name: keyof ChatbotFormData, value: any) => void;
}
```

**Usage**:

```tsx
<ChatbotSettingsForm
  register={register}
  errors={errors}
  watch={watch}
  setValue={setValue}
/>
```

---

### 2. **SystemPromptEditor.tsx**

**Purpose**: Rich text editor for system prompts with templates

**Features**:

- Monaco Editor integration for code-like editing experience
- 5 pre-built prompt templates:
  - Customer Support
  - Sales Assistant
  - Technical Support
  - Lead Qualifier
  - FAQ Assistant
- Variable insertion shortcuts:
  - `{user_name}`
  - `{company_name}`
  - `{product_name}`
  - `{current_date}`
  - `{conversation_history}`
- Template selection dropdown
- Tips and best practices
- Syntax highlighting
- Dark theme

**Props**:

```typescript
interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}
```

**Usage**:

```tsx
<SystemPromptEditor
  value={systemPrompt}
  onChange={setSystemPrompt}
  error={errors.system_prompt?.message}
/>
```

**Dependencies**:

- `@monaco-editor/react`

---

### 3. **KnowledgeBaseSelector.tsx**

**Purpose**: Select and manage knowledge base attachments

**Features**:

- Fetch and display all available KBs
- Search/filter KBs by name or description
- Visual selection with Switch components
- KB statistics display (documents, chunks, model)
- Select All / Deselect All functionality
- Inline "Create KB" button
- Empty state with CTA
- Highlights selected KBs with primary color
- RAG explanation when KBs are selected

**Props**:

```typescript
interface KnowledgeBaseSelectorProps {
  selectedKBs: string[];
  onChange: (selectedIds: string[]) => void;
}
```

**Usage**:

```tsx
<KnowledgeBaseSelector
  selectedKBs={selectedKnowledgeBases}
  onChange={setSelectedKnowledgeBases}
/>
```

**Backend Integration**:

- `GET /knowledge-bases/` - Fetch available KBs

---

## ✅ Chatflow Components (`/src/components/chatflow/`)

### 1. **ReactFlowCanvas.tsx**

**Purpose**: Main ReactFlow wrapper with custom node types

**Features**:

- ReactFlow integration
- Custom node types registration
- Background with dots pattern
- Controls (zoom, fit view)
- MiniMap with color-coded nodes
- Click handlers for nodes and pane
- Responsive design

**Props**:

```typescript
interface ReactFlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onPaneClick?: () => void;
  children?: React.ReactNode;
}
```

**Usage**:

```tsx
<ReactFlowCanvas
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onNodeClick={handleNodeClick}
>
  {/* Optional children like panels */}
</ReactFlowCanvas>
```

---

### 2. **NodePalette.tsx**

**Purpose**: Categorized palette for adding nodes

**Features**:

- 7 node types organized by category:
  - **AI**: LLM
  - **Data**: Knowledge Base
  - **Logic**: Condition, Variable, Code
  - **Integration**: HTTP Request
  - **Output**: Response
- Click to add nodes
- Node descriptions
- Visual icons
- Category grouping

**Props**:

```typescript
interface NodePaletteProps {
  onAddNode: (type: string) => void;
}
```

**Usage**:

```tsx
<NodePalette onAddNode={addNode} />
```

---

### 3. **NodeConfigPanel.tsx**

**Purpose**: Dynamic configuration panel for selected node

**Features**:

- Type-specific configuration fields
- Real-time node updates
- Node deletion
- Per-node-type forms:
  - **LLM**: Model, prompt, temperature, max tokens
  - **KB**: KB selection, top K, similarity threshold
  - **Condition**: Type, variable, condition expression
  - **HTTP**: Method, URL, body
  - **Variable**: Name, operation, value
  - **Code**: Language, code editor, timeout
  - **Response**: Template, format
- Node metadata display (type, ID)
- Delete node button

**Props**:

```typescript
interface NodeConfigPanelProps {
  selectedNode: Node | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<Node>) => void;
  onDeleteNode: (nodeId: string) => void;
}
```

**Usage**:

```tsx
<NodeConfigPanel
  selectedNode={selectedNode}
  onClose={() => setSelectedNode(null)}
  onUpdateNode={updateNode}
  onDeleteNode={deleteNode}
/>
```

---

### 4. **VariableInspector.tsx**

**Purpose**: Debug and inspect workflow variables

**Features**:

- Display all current variables
- Type detection and color coding:
  - String: Green
  - Number: Blue
  - Boolean: Purple
  - Object: Orange
  - Array: Yellow
  - Null/Undefined: Gray
- Expand/collapse complex values
- Copy to clipboard
- JSON formatting for objects/arrays
- Refresh functionality
- Empty state message
- Variable count

**Props**:

```typescript
interface VariableInspectorProps {
  variables?: Record<string, any>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}
```

**Usage**:

```tsx
<VariableInspector
  variables={workflowVariables}
  onRefresh={refreshVariables}
  isRefreshing={isRefreshing}
/>
```

---

## ✅ Custom Node Components (`/src/components/chatflow/nodes/`)

All nodes follow a consistent pattern with:

- Gradient backgrounds
- Selection highlighting (scale + border)
- Input/output handles
- Type-specific icons
- Configurable data display
- Memo optimization

### 1. **LLMNode.tsx**

- **Color**: Purple to Pink gradient
- **Icon**: Sparkles
- **Handles**: Top (input), Bottom (output)
- **Data**: Model, temperature, prompt

### 2. **KnowledgeBaseNode.tsx**

- **Color**: Blue to Cyan gradient
- **Icon**: Database
- **Handles**: Top (input), Bottom (output)
- **Data**: KB name, top K results

### 3. **ConditionNode.tsx**

- **Color**: Yellow to Orange gradient
- **Icon**: GitBranch
- **Handles**: Top (input), Right x2 (true/false outputs)
- **Data**: Condition expression, type
- **Special**: Dual output handles (green for true, red for false)

### 4. **HTTPRequestNode.tsx**

- **Color**: Green to Emerald gradient
- **Icon**: Globe
- **Handles**: Top (input), Bottom (output)
- **Data**: HTTP method, URL
- **Special**: Color-coded method badges

### 5. **VariableNode.tsx**

- **Color**: Indigo to Purple gradient
- **Icon**: Variable
- **Handles**: Top (input), Bottom (output)
- **Data**: Variable name, operation

### 6. **CodeNode.tsx**

- **Color**: Gray gradient
- **Icon**: Code
- **Handles**: Top (input), Bottom (output)
- **Data**: Language (Python/JavaScript), code snippet

### 7. **ResponseNode.tsx**

- **Color**: Rose to Red gradient
- **Icon**: MessageSquare
- **Handles**: Top (input) only
- **Data**: Response template, format
- **Special**: Terminal node (no output handle)

---

## Component Integration Example

### Using Chatbot Components in a Page

```tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import ChatbotSettingsForm from "@/components/chatbot/ChatbotSettingsForm";
import SystemPromptEditor from "@/components/chatbot/SystemPromptEditor";
import KnowledgeBaseSelector from "@/components/chatbot/KnowledgeBaseSelector";

function MyChatbotPage() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedKBs, setSelectedKBs] = useState<string[]>([]);

  return (
    <Tabs>
      <TabsContent value="basic">
        <ChatbotSettingsForm
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
        />
      </TabsContent>

      <TabsContent value="prompt">
        <SystemPromptEditor value={systemPrompt} onChange={setSystemPrompt} />
      </TabsContent>

      <TabsContent value="knowledge">
        <KnowledgeBaseSelector
          selectedKBs={selectedKBs}
          onChange={setSelectedKBs}
        />
      </TabsContent>
    </Tabs>
  );
}
```

### Using Chatflow Components in a Page

```tsx
import { useState } from "react";
import { useNodesState, useEdgesState } from "reactflow";
import ReactFlowCanvas from "@/components/chatflow/ReactFlowCanvas";
import NodePalette from "@/components/chatflow/NodePalette";
import NodeConfigPanel from "@/components/chatflow/NodeConfigPanel";
import VariableInspector from "@/components/chatflow/VariableInspector";

function MyChatflowPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [variables, setVariables] = useState({});

  const addNode = (type: string) => {
    const newNode = {
      id: `${type}_${Date.now()}`,
      type,
      position: { x: 100, y: 100 },
      data: { label: `New ${type}` },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div className="flex h-screen">
      {/* Left Sidebar */}
      <div className="w-64 border-r p-4">
        <NodePalette onAddNode={addNode} />
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(conn) => setEdges((eds) => addEdge(conn, eds))}
          onNodeClick={(e, node) => setSelectedNode(node)}
        />
      </div>

      {/* Right Sidebar - Config */}
      {selectedNode && (
        <div className="w-80">
          <NodeConfigPanel
            selectedNode={selectedNode}
            onClose={() => setSelectedNode(null)}
            onUpdateNode={(id, updates) => {
              setNodes((nds) =>
                nds.map((n) => (n.id === id ? { ...n, ...updates } : n))
              );
            }}
            onDeleteNode={(id) => {
              setNodes((nds) => nds.filter((n) => n.id !== id));
            }}
          />
        </div>
      )}

      {/* Right Sidebar - Variables */}
      <div className="w-80 border-l">
        <VariableInspector variables={variables} />
      </div>
    </div>
  );
}
```

---

## Dependencies

All components use these shared dependencies:

```bash
# Core
npm install react-hook-form @hookform/resolvers zod

# ReactFlow (for chatflow components)
npm install reactflow

# Monaco Editor (for SystemPromptEditor)
npm install @monaco-editor/react

# UI components (shadcn/ui)
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-switch @radix-ui/react-label

# Icons
npm install lucide-react

# State management
npm install @tanstack/react-query zustand
```

---

## File Structure

```
/frontend/src/
├── components/
│   ├── chatbot/
│   │   ├── ChatbotSettingsForm.tsx       #
│   │   ├── SystemPromptEditor.tsx        #
│   │   └── KnowledgeBaseSelector.tsx     #
│   │
│   └── chatflow/
│       ├── ReactFlowCanvas.tsx           #
│       ├── NodePalette.tsx               #
│       ├── NodeConfigPanel.tsx           #
│       ├── VariableInspector.tsx         #
│       │
│       └── nodes/
│           ├── LLMNode.tsx               #
│           ├── KnowledgeBaseNode.tsx     #
│           ├── ConditionNode.tsx         #
│           ├── HTTPRequestNode.tsx       #
│           ├── VariableNode.tsx          #
│           ├── CodeNode.tsx              #
│           └── ResponseNode.tsx          #
```

---

## Design Patterns

### 1. **Composition**

Components are designed to be composed together:

- ChatbotSettingsForm + SystemPromptEditor + KnowledgeBaseSelector = Complete chatbot builder
- ReactFlowCanvas + NodePalette + NodeConfigPanel = Complete chatflow builder

### 2. **Prop Drilling Alternative**

- Use React Hook Form's methods (register, watch, setValue) passed as props
- Avoids deep prop drilling while maintaining type safety

### 3. **Memoization**

- All node components use `memo()` for performance
- Prevents unnecessary re-renders during dragging

### 4. **Type Safety**

- Full TypeScript support
- Interface definitions for all props
- Type-safe data structures for nodes

### 5. **Accessibility**

- Proper label associations
- Keyboard navigation support (via shadcn/ui)
- ARIA attributes where needed

---

## Testing Recommendations

### Unit Tests

```typescript
// ChatbotSettingsForm.test.tsx
import { render, screen } from "@testing-library/react";
import ChatbotSettingsForm from "./ChatbotSettingsForm";

test("renders all form fields", () => {
  const mockRegister = jest.fn();
  render(
    <ChatbotSettingsForm
      register={mockRegister}
      errors={{}}
      watch={jest.fn()}
      setValue={jest.fn()}
    />
  );

  expect(screen.getByLabelText(/chatbot name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/ai model/i)).toBeInTheDocument();
});
```

### Integration Tests

```typescript
// NodePalette.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import NodePalette from "./NodePalette";

test("adds node when clicked", () => {
  const mockAddNode = jest.fn();
  render(<NodePalette onAddNode={mockAddNode} />);

  fireEvent.click(screen.getByText(/LLM/i));
  expect(mockAddNode).toHaveBeenCalledWith("llm");
});
```

---

## Status: ✅ COMPLETE

All chatbot and chatflow components are production-ready with:

- Full TypeScript implementation
- Consistent design patterns
- Proper error handling
- Accessibility features
- Performance optimizations (memo, useCallback)
- Beautiful UI with Tailwind CSS
- Integration with React Hook Form, ReactFlow, and Monaco Editor

These components can be directly integrated into the pages created earlier (ChatbotBuilder.tsx, ChatflowBuilder.tsx).
