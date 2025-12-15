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

import { Node } from 'reactflow';
import { X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  const renderConfigFields = () => {
    switch (selectedNode.type) {
      case 'llm':
        return (
          <>
            <div>
              <Label htmlFor="model">Model</Label>
              <Select
                value={selectedNode.data.model || 'gpt-4'}
                onValueChange={(value) => updateData('model', value)}
              >
                <SelectTrigger id="model" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="prompt">Prompt Template</Label>
              <Textarea
                id="prompt"
                value={selectedNode.data.prompt || ''}
                onChange={(e) => updateData('prompt', e.target.value)}
                placeholder="Enter your prompt..."
                className="mt-2 font-mono text-sm"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="temperature">
                Temperature: {selectedNode.data.temperature?.toFixed(1) || '0.7'}
              </Label>
              <input
                id="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={selectedNode.data.temperature || 0.7}
                onChange={(e) => updateData('temperature', parseFloat(e.target.value))}
                className="w-full mt-2"
              />
            </div>

            <div>
              <Label htmlFor="max-tokens">Max Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                value={selectedNode.data.max_tokens || ''}
                onChange={(e) => updateData('max_tokens', parseInt(e.target.value))}
                placeholder="2000"
                className="mt-2"
              />
            </div>
          </>
        );

      case 'kb':
        return (
          <>
            <div>
              <Label htmlFor="kb-id">Knowledge Base</Label>
              <Input
                id="kb-id"
                value={selectedNode.data.kb_id || ''}
                onChange={(e) => updateData('kb_id', e.target.value)}
                placeholder="KB ID"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="top-k">Top K Results</Label>
              <Input
                id="top-k"
                type="number"
                value={selectedNode.data.top_k || 5}
                onChange={(e) => updateData('top_k', parseInt(e.target.value))}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="threshold">Similarity Threshold</Label>
              <input
                id="threshold"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={selectedNode.data.similarity_threshold || 0.7}
                onChange={(e) =>
                  updateData('similarity_threshold', parseFloat(e.target.value))
                }
                className="w-full mt-2"
              />
              <div className="text-xs text-muted-foreground mt-1">
                {selectedNode.data.similarity_threshold?.toFixed(2) || '0.70'}
              </div>
            </div>
          </>
        );

      case 'condition':
        return (
          <>
            <div>
              <Label htmlFor="condition-type">Condition Type</Label>
              <Select
                value={selectedNode.data.condition_type || 'contains'}
                onValueChange={(value) => updateData('condition_type', value)}
              >
                <SelectTrigger id="condition-type" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="regex">Regex Match</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="variable">Variable</Label>
              <Input
                id="variable"
                value={selectedNode.data.variable || ''}
                onChange={(e) => updateData('variable', e.target.value)}
                placeholder="e.g., user_input"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="condition">Condition</Label>
              <Textarea
                id="condition"
                value={selectedNode.data.condition || ''}
                onChange={(e) => updateData('condition', e.target.value)}
                placeholder="Condition expression..."
                className="mt-2 font-mono text-sm"
                rows={3}
              />
            </div>
          </>
        );

      case 'http':
        return (
          <>
            <div>
              <Label htmlFor="method">HTTP Method</Label>
              <Select
                value={selectedNode.data.method || 'GET'}
                onValueChange={(value) => updateData('method', value)}
              >
                <SelectTrigger id="method" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={selectedNode.data.url || ''}
                onChange={(e) => updateData('url', e.target.value)}
                placeholder="https://api.example.com/endpoint"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="body">Request Body (JSON)</Label>
              <Textarea
                id="body"
                value={
                  typeof selectedNode.data.body === 'string'
                    ? selectedNode.data.body
                    : JSON.stringify(selectedNode.data.body || {}, null, 2)
                }
                onChange={(e) => {
                  try {
                    updateData('body', JSON.parse(e.target.value));
                  } catch {
                    updateData('body', e.target.value);
                  }
                }}
                placeholder='{\n  "key": "value"\n}'
                className="mt-2 font-mono text-sm"
                rows={4}
              />
            </div>
          </>
        );

      case 'variable':
        return (
          <>
            <div>
              <Label htmlFor="var-name">Variable Name</Label>
              <Input
                id="var-name"
                value={selectedNode.data.variable_name || ''}
                onChange={(e) => updateData('variable_name', e.target.value)}
                placeholder="my_variable"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="operation">Operation</Label>
              <Select
                value={selectedNode.data.operation || 'set'}
                onValueChange={(value) => updateData('operation', value)}
              >
                <SelectTrigger id="operation" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set</SelectItem>
                  <SelectItem value="append">Append</SelectItem>
                  <SelectItem value="increment">Increment</SelectItem>
                  <SelectItem value="transform">Transform</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={selectedNode.data.value || ''}
                onChange={(e) => updateData('value', e.target.value)}
                placeholder="Value or expression"
                className="mt-2"
              />
            </div>
          </>
        );

      case 'code':
        return (
          <>
            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                value={selectedNode.data.language || 'python'}
                onValueChange={(value) => updateData('language', value)}
              >
                <SelectTrigger id="language" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="code">Code</Label>
              <Textarea
                id="code"
                value={selectedNode.data.code || ''}
                onChange={(e) => updateData('code', e.target.value)}
                placeholder="# Write your code here..."
                className="mt-2 font-mono text-sm"
                rows={8}
              />
            </div>

            <div>
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                value={selectedNode.data.timeout || 5}
                onChange={(e) => updateData('timeout', parseInt(e.target.value))}
                className="mt-2"
              />
            </div>
          </>
        );

      case 'response':
        return (
          <>
            <div>
              <Label htmlFor="response-template">Response Template</Label>
              <Textarea
                id="response-template"
                value={selectedNode.data.response_template || ''}
                onChange={(e) => updateData('response_template', e.target.value)}
                placeholder="Your response template..."
                className="mt-2"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="format">Format</Label>
              <Select
                value={selectedNode.data.format || 'text'}
                onValueChange={(value) => updateData('format', value)}
              >
                <SelectTrigger id="format" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Plain Text</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      default:
        return <p className="text-sm text-muted-foreground">No configuration available</p>;
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
