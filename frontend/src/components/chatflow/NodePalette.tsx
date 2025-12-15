/**
 * NodePalette - Draggable node palette for chatflow builder
 *
 * WHY:
 * - Easy node discovery
 * - Drag-and-drop interface
 * - Categorized nodes
 *
 * HOW:
 * - Click to add nodes
 * - Visual categories
 * - Node descriptions
 */

import { Sparkles, Database, GitBranch, Globe, Code, MessageSquare, Variable } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NodeType {
  type: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: 'AI' | 'Data' | 'Logic' | 'Integration' | 'Output';
}

const NODE_TYPES: NodeType[] = [
  {
    type: 'llm',
    label: 'LLM',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Generate text with AI models',
    category: 'AI',
  },
  {
    type: 'kb',
    label: 'Knowledge Base',
    icon: <Database className="w-4 h-4" />,
    description: 'Retrieve from knowledge base',
    category: 'Data',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: <GitBranch className="w-4 h-4" />,
    description: 'Branch based on conditions',
    category: 'Logic',
  },
  {
    type: 'http',
    label: 'HTTP Request',
    icon: <Globe className="w-4 h-4" />,
    description: 'Call external APIs',
    category: 'Integration',
  },
  {
    type: 'variable',
    label: 'Variable',
    icon: <Variable className="w-4 h-4" />,
    description: 'Set or transform variables',
    category: 'Logic',
  },
  {
    type: 'code',
    label: 'Code',
    icon: <Code className="w-4 h-4" />,
    description: 'Execute custom code',
    category: 'Logic',
  },
  {
    type: 'response',
    label: 'Response',
    icon: <MessageSquare className="w-4 h-4" />,
    description: 'Send final response',
    category: 'Output',
  },
];

interface NodePaletteProps {
  onAddNode: (type: string) => void;
}

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  const categories = Array.from(new Set(NODE_TYPES.map((n) => n.category)));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Add Nodes</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Click to add a node to the canvas
        </p>
      </div>

      {categories.map((category) => {
        const categoryNodes = NODE_TYPES.filter((n) => n.category === category);

        return (
          <div key={category}>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">{category}</h4>
            <div className="space-y-2">
              {categoryNodes.map((node) => (
                <Button
                  key={node.type}
                  variant="outline"
                  size="sm"
                  onClick={() => onAddNode(node.type)}
                  className="w-full justify-start text-left h-auto py-2"
                >
                  <div className="flex items-start gap-2 w-full">
                    <div className="mt-0.5">{node.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{node.label}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {node.description}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
