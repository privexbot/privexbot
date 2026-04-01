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

import { Sparkles, Database, GitBranch, Globe, Code, MessageSquare, Variable, Send, Mail, Bell, UserCheck, UserPlus, Brain, HardDrive, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NodeType {
  type: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: 'AI' | 'Data' | 'Logic' | 'Integration' | 'Action' | 'Output';
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
    type: 'memory',
    label: 'Memory',
    icon: <Brain className="w-4 h-4" />,
    description: 'Retrieve chat history',
    category: 'Data',
  },
  {
    type: 'database',
    label: 'Database',
    icon: <HardDrive className="w-4 h-4" />,
    description: 'Query SQL database',
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
    type: 'webhook',
    label: 'Webhook',
    icon: <Send className="w-4 h-4" />,
    description: 'Send data to external systems',
    category: 'Action',
  },
  {
    type: 'email',
    label: 'Send Email',
    icon: <Mail className="w-4 h-4" />,
    description: 'Send email via SMTP or Gmail',
    category: 'Action',
  },
  {
    type: 'notification',
    label: 'Notification',
    icon: <Bell className="w-4 h-4" />,
    description: 'Notify via Slack, Discord, Teams',
    category: 'Action',
  },
  {
    type: 'handoff',
    label: 'Human Handoff',
    icon: <UserCheck className="w-4 h-4" />,
    description: 'Escalate to human agent',
    category: 'Action',
  },
  {
    type: 'lead_capture',
    label: 'Lead Capture',
    icon: <UserPlus className="w-4 h-4" />,
    description: 'Collect and store lead data',
    category: 'Action',
  },
  {
    type: 'calendly',
    label: 'Calendly',
    icon: <Calendar className="w-4 h-4" />,
    description: 'Share booking links via Calendly',
    category: 'Integration',
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
