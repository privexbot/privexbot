/**
 * NodeConfigPanel - Configuration panel for selected node
 *
 * WHY:
 * - Edit node properties
 * - Type-specific fields
 * - Real-time updates
 *
 * HOW:
 * - Dynamic form based on node type
 * - Immediate updates to node data
 * - Validation
 */

import { useCallback } from 'react';
import { Node } from 'reactflow';
import { X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// Node configuration components
import { LLMNodeConfig } from './configs/LLMNodeConfig';
import { KBNodeConfig } from './configs/KBNodeConfig';
import { ConditionNodeConfig } from './configs/ConditionNodeConfig';
import { HTTPNodeConfig } from './configs/HTTPNodeConfig';
import { VariableNodeConfig } from './configs/VariableNodeConfig';
import { CodeNodeConfig } from './configs/CodeNodeConfig';
import { MemoryNodeConfig } from './configs/MemoryNodeConfig';
import { DatabaseNodeConfig } from './configs/DatabaseNodeConfig';
import { WebhookNodeConfig } from './configs/WebhookNodeConfig';
import { EmailNodeConfig } from './configs/EmailNodeConfig';
import { NotificationNodeConfig } from './configs/NotificationNodeConfig';
import { HandoffNodeConfig } from './configs/HandoffNodeConfig';
import { LeadCaptureNodeConfig } from './configs/LeadCaptureNodeConfig';
import { CalendlyNodeConfig } from './configs/CalendlyNodeConfig';

interface NodeConfigPanelProps {
  selectedNode: Node | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<Node>) => void;
  onDeleteNode: (nodeId: string) => void;
}

export default function NodeConfigPanel({
  selectedNode,
  onClose,
  onUpdateNode,
  onDeleteNode,
}: NodeConfigPanelProps) {
  if (!selectedNode) return null;

  const updateData = (key: string, value: any) => {
    onUpdateNode(selectedNode.id, {
      data: { ...selectedNode.data, [key]: value },
    });
  };

  const updateLabel = (label: string) => {
    updateData('label', label);
  };

  // Handler for config component changes - updates node.data.config
  const handleConfigChange = useCallback((newConfig: Record<string, unknown>) => {
    onUpdateNode(selectedNode.id, {
      data: { ...selectedNode.data, config: newConfig },
    });
  }, [selectedNode.id, selectedNode.data, onUpdateNode]);

  const renderConfigFields = () => {
    const config = (selectedNode.data.config || {}) as Record<string, unknown>;

    switch (selectedNode.type) {
      case 'llm':
        return <LLMNodeConfig config={config} onChange={handleConfigChange} />;

      case 'kb':
        return <KBNodeConfig config={config} onChange={handleConfigChange} />;

      case 'condition':
        return <ConditionNodeConfig config={config} onChange={handleConfigChange} />;

      case 'http':
      case 'http_request':
        return <HTTPNodeConfig config={config} onChange={handleConfigChange} />;

      case 'variable':
        return <VariableNodeConfig config={config} onChange={handleConfigChange} />;

      case 'code':
        return <CodeNodeConfig config={config} onChange={handleConfigChange} />;

      case 'memory':
        return <MemoryNodeConfig config={config} onChange={handleConfigChange} />;

      case 'database':
        return <DatabaseNodeConfig config={config} onChange={handleConfigChange} />;

      case 'webhook':
        return <WebhookNodeConfig config={config} onChange={handleConfigChange} />;

      case 'email':
        return <EmailNodeConfig config={config} onChange={handleConfigChange} />;

      case 'notification':
        return <NotificationNodeConfig config={config} onChange={handleConfigChange} />;

      case 'handoff':
        return <HandoffNodeConfig config={config} onChange={handleConfigChange} />;

      case 'lead_capture':
        return <LeadCaptureNodeConfig config={config} onChange={handleConfigChange} />;

      case 'calendly':
        return <CalendlyNodeConfig config={config} onChange={handleConfigChange} />;

      case 'trigger':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              The trigger node starts the chatflow when a message is received.
            </p>
            <p className="text-xs text-muted-foreground">
              No additional configuration required.
            </p>
          </div>
        );

      case 'response':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              The response node sends the final message back to the user.
            </p>
            <p className="text-xs text-muted-foreground">
              Uses the output from the previous node as the response.
            </p>
          </div>
        );

      case 'loop':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              The loop node iterates over an array and processes each item.
            </p>
            <p className="text-xs text-muted-foreground">
              Configuration coming soon.
            </p>
          </div>
        );

      default:
        return <p className="text-sm text-muted-foreground">No configuration available for this node type.</p>;
    }
  };

  return (
    <div className="border-l bg-background h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Node Configuration</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <Label htmlFor="node-label">Node Label</Label>
          <Input
            id="node-label"
            value={selectedNode.data.label || ''}
            onChange={(e) => updateLabel(e.target.value)}
            placeholder="Enter label..."
            className="mt-2"
          />
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div>Type: <span className="font-mono">{selectedNode.type}</span></div>
          <div>ID: <span className="font-mono">{selectedNode.id}</span></div>
        </div>

        <div className="border-t pt-4">
          {renderConfigFields()}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            onDeleteNode(selectedNode.id);
            onClose();
          }}
          className="w-full"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Node
        </Button>
      </div>
    </div>
  );
}
