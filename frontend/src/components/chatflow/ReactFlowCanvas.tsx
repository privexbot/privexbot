/**
 * ReactFlowCanvas - Main chatflow canvas component
 *
 * WHY:
 * - Centralized ReactFlow configuration
 * - Reusable across pages
 * - Consistent node types
 *
 * HOW:
 * - ReactFlow wrapper
 * - Custom node types
 * - Background and controls
 */

import { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Node,
  Edge,
  Connection,
  NodeTypes,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import LLMNode from './nodes/LLMNode';
import KnowledgeBaseNode from './nodes/KnowledgeBaseNode';
import ConditionNode from './nodes/ConditionNode';
import HTTPRequestNode from './nodes/HTTPRequestNode';
import VariableNode from './nodes/VariableNode';
import CodeNode from './nodes/CodeNode';
import ResponseNode from './nodes/ResponseNode';
import WebhookNode from './nodes/WebhookNode';
import EmailNode from './nodes/EmailNode';
import NotificationNode from './nodes/NotificationNode';
import HandoffNode from './nodes/HandoffNode';
import LeadCaptureNode from './nodes/LeadCaptureNode';
import MemoryNode from './nodes/MemoryNode';
import DatabaseNode from './nodes/DatabaseNode';
import CalendlyNode from './nodes/CalendlyNode';

const nodeTypes: NodeTypes = {
  llm: LLMNode,
  kb: KnowledgeBaseNode,
  condition: ConditionNode,
  http: HTTPRequestNode,
  variable: VariableNode,
  code: CodeNode,
  response: ResponseNode,
  webhook: WebhookNode,
  email: EmailNode,
  notification: NotificationNode,
  handoff: HandoffNode,
  lead_capture: LeadCaptureNode,
  memory: MemoryNode,
  database: DatabaseNode,
  calendly: CalendlyNode,
};

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

export default function ReactFlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  children,
}: ReactFlowCanvasProps) {
  const handleConnect = useCallback(
    (connection: Connection) => {
      onConnect(connection);
    },
    [onConnect]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          className="bg-muted/20"
        />
        <Controls className="bg-background border shadow-md" />
        <MiniMap
          className="bg-background border shadow-md"
          nodeColor={(node) => {
            const colors: Record<string, string> = {
              llm: '#a855f7',
              kb: '#3b82f6',
              condition: '#f59e0b',
              http: '#10b981',
              variable: '#6366f1',
              code: '#6b7280',
              response: '#ef4444',
              webhook: '#f97316',
              email: '#0ea5e9',
              notification: '#14b8a6',
              handoff: '#8b5cf6',
              lead_capture: '#22c55e',
              memory: '#ec4899',
              database: '#10b981',
            };
            return colors[node.type || 'default'] || '#999';
          }}
        />
        {children}
      </ReactFlow>
    </div>
  );
}
