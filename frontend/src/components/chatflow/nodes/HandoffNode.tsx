/**
 * HandoffNode - Human handoff node for chatflow
 *
 * Escalates conversation to a human agent with full context
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UserCheck } from 'lucide-react';

export interface HandoffNodeData {
  label: string;
  method?: 'webhook' | 'email' | 'slack';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  department?: string;
}

const priorityIndicators: Record<string, { color: string; label: string }> = {
  low: { color: 'bg-green-500', label: 'Low' },
  normal: { color: 'bg-yellow-500', label: 'Normal' },
  high: { color: 'bg-orange-500', label: 'High' },
  urgent: { color: 'bg-red-500', label: 'Urgent' },
};

function HandoffNode({ data, selected }: NodeProps<HandoffNodeData>) {
  const priority = priorityIndicators[data.priority || 'normal'];

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-2 transition-all ${
        selected ? 'border-violet-700 shadow-xl scale-105' : 'border-violet-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <UserCheck className="w-5 h-5" />
        <div className="font-bold text-sm">Human Handoff</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'Escalate'}</div>

      <div className="text-xs opacity-75 space-y-1">
        {data.method && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-black/20 capitalize">
              via {data.method}
            </span>
          </div>
        )}
        {priority && (
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${priority.color}`} />
            <span>{priority.label} Priority</span>
          </div>
        )}
        {data.department && (
          <div className="text-xs opacity-60">
            Dept: {data.department}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(HandoffNode);
