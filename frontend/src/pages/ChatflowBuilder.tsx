/**
 * ChatflowBuilder - Visual drag-and-drop workflow editor
 *
 * WHY:
 * - Complex multi-step chatbots
 * - Visual workflow design
 * - Branching logic and conditions
 * - API integrations
 *
 * HOW:
 * - ReactFlow for visual editor
 * - Custom node types
 * - Graph validation
 * - Auto-save drafts
 *
 * DEPENDENCIES:
 * - reactflow
 * - react-hook-form
 * - zod
 * - @tanstack/react-query
 */

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Workflow,
  Save,
  Play,
  AlertCircle,
  Plus,
  Rocket,
  Sparkles,
  Database,
  GitBranch,
  Globe,
  Code,
  MessageSquare,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient, { handleApiError } from '@/lib/api-client';

// Custom Node Types
const nodeTypes: NodeTypes = {
  llm: LLMNode,
  kb: KBNode,
  condition: ConditionNode,
  http: HTTPNode,
  variable: VariableNode,
  code: CodeNode,
  response: ResponseNode,
};

// Node Components
function LLMNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-purple-600">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        <div className="font-bold">LLM</div>
      </div>
      <div className="text-xs mt-1 opacity-90">{data.label || 'AI Generation'}</div>
    </div>
  );
}

function KBNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-2 border-blue-600">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4" />
        <div className="font-bold">Knowledge Base</div>
      </div>
      <div className="text-xs mt-1 opacity-90">{data.label || 'Retrieve Context'}</div>
    </div>
  );
}

function ConditionNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-2 border-yellow-600">
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4" />
        <div className="font-bold">Condition</div>
      </div>
      <div className="text-xs mt-1 opacity-90">{data.label || 'If/Else'}</div>
    </div>
  );
}

function HTTPNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white border-2 border-green-600">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4" />
        <div className="font-bold">HTTP Request</div>
      </div>
      <div className="text-xs mt-1 opacity-90">{data.label || 'API Call'}</div>
    </div>
  );
}

function VariableNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-2 border-indigo-600">
      <div className="flex items-center gap-2">
        <Code className="w-4 h-4" />
        <div className="font-bold">Variable</div>
      </div>
      <div className="text-xs mt-1 opacity-90">{data.label || 'Set Value'}</div>
    </div>
  );
}

function CodeNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-gradient-to-r from-gray-700 to-gray-900 text-white border-2 border-gray-600">
      <div className="flex items-center gap-2">
        <Code className="w-4 h-4" />
        <div className="font-bold">Code</div>
      </div>
      <div className="text-xs mt-1 opacity-90">{data.label || 'Execute Python'}</div>
    </div>
  );
}

function ResponseNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-gradient-to-r from-rose-500 to-red-500 text-white border-2 border-rose-600">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        <div className="font-bold">Response</div>
      </div>
      <div className="text-xs mt-1 opacity-90">{data.label || 'Final Output'}</div>
    </div>
  );
}

export default function ChatflowBuilder() {
  const { draftId } = useParams<{ draftId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspaceStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load or create draft
  const { data: draft, isLoading } = useQuery({
    queryKey: ['chatflow-draft', draftId],
    queryFn: async () => {
      if (draftId) {
        const response = await apiClient.get(`/chatflows/drafts/${draftId}`);
        return response.data;
      } else {
        const response = await apiClient.post('/chatflows/drafts', {
          workspace_id: currentWorkspace?.id,
          initial_data: {
            name: 'Untitled Chatflow',
            nodes: [],
            edges: [],
          },
        });
        navigate(`/chatflows/builder/${response.data.draft_id}`, { replace: true });
        return response.data;
      }
    },
    enabled: !!currentWorkspace,
  });

  // Load nodes and edges from draft
  useEffect(() => {
    if (draft?.data?.nodes) {
      setNodes(draft.data.nodes);
      setEdges(draft.data.edges || []);
    }
  }, [draft, setNodes, setEdges]);

  // Auto-save
  const { save, isSaving, lastSaved } = useAutoSave({
    draftId: draftId || '',
    draftType: 'chatflow',
    endpoint: '/chatflows/drafts',
  });

  // Save nodes and edges on change
  useEffect(() => {
    if (draftId && nodes.length > 0) {
      save({ nodes, edges });
    }
  }, [nodes, edges, draftId, save]);

  // Add edge handler
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // Add node handler
  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: `New ${type}` },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  // Validate graph
  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/chatflows/drafts/${draftId}/validate`, {
        nodes,
        edges,
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.is_valid) {
        toast({ title: 'Chatflow is valid!', description: 'Ready to deploy' });
        setValidationErrors([]);
      } else {
        toast({
          title: 'Validation errors found',
          description: `${data.errors.length} issues detected`,
          variant: 'destructive',
        });
        setValidationErrors(data.errors);
      }
    },
  });

  // Finalize (deploy)
  const finalizeMutation = useMutation({
    mutationFn: async (deploymentConfig: any) => {
      const response = await apiClient.post(`/chatflows/drafts/${draftId}/finalize`, deploymentConfig);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Chatflow deployed!',
        description: `Chatflow ID: ${data.chatflow_id}`,
      });
      navigate(`/chatflows/${data.chatflow_id}`);
    },
    onError: (error) => {
      toast({
        title: 'Deployment failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Workflow className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{draft?.data?.name || 'Untitled Chatflow'}</h1>
            <p className="text-sm text-muted-foreground">
              {isSaving ? (
                <span className="flex items-center gap-1">
                  <Save className="w-3 h-3 animate-pulse" />
                  Saving...
                </span>
              ) : lastSaved ? (
                `Saved ${new Date(lastSaved).toLocaleTimeString()}`
              ) : (
                'Auto-save enabled'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending}
          >
            <Play className="w-4 h-4 mr-2" />
            Validate
          </Button>

          <Button onClick={() => finalizeMutation.mutate({ channels: ['website'] })}>
            <Rocket className="w-4 h-4 mr-2" />
            Deploy
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-destructive/10 border-b border-destructive p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Validation Errors:</p>
              <ul className="text-sm text-destructive/90 mt-1 space-y-1">
                {validationErrors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />

          {/* Node Toolbar */}
          <Panel position="top-left" className="bg-background border rounded-lg shadow-lg p-3">
            <p className="text-xs font-medium mb-2">Add Nodes</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addNode('llm')}>
                <Sparkles className="w-3 h-3 mr-1" />
                LLM
              </Button>
              <Button size="sm" variant="outline" onClick={() => addNode('kb')}>
                <Database className="w-3 h-3 mr-1" />
                KB
              </Button>
              <Button size="sm" variant="outline" onClick={() => addNode('condition')}>
                <GitBranch className="w-3 h-3 mr-1" />
                Condition
              </Button>
              <Button size="sm" variant="outline" onClick={() => addNode('http')}>
                <Globe className="w-3 h-3 mr-1" />
                HTTP
              </Button>
              <Button size="sm" variant="outline" onClick={() => addNode('code')}>
                <Code className="w-3 h-3 mr-1" />
                Code
              </Button>
              <Button size="sm" variant="outline" onClick={() => addNode('response')}>
                <MessageSquare className="w-3 h-3 mr-1" />
                Response
              </Button>
            </div>
          </Panel>

          {/* Stats Panel */}
          <Panel position="bottom-right" className="bg-background border rounded-lg shadow-lg p-3">
            <div className="text-xs space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Nodes:</span>
                <span className="font-medium">{nodes.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Edges:</span>
                <span className="font-medium">{edges.length}</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
