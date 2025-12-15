/**
 * ConditionNode - Conditional branching node
 *
 * Evaluates conditions and routes flow accordingly
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';

export interface ConditionNodeData {
  label: string;
  condition?: string;
  condition_type?: 'contains' | 'equals' | 'regex' | 'javascript';
  variable?: string;
}

function ConditionNode({ data, selected }: NodeProps<ConditionNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-2 transition-all ${
        selected ? 'border-yellow-700 shadow-xl scale-105' : 'border-yellow-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-5 h-5" />
        <div className="font-bold text-sm">Condition</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'If/Else'}</div>

      {data.condition && (
        <div className="text-xs opacity-75 font-mono bg-black/20 px-2 py-1 rounded">
          {data.condition.length > 30
            ? data.condition.substring(0, 30) + '...'
            : data.condition}
        </div>
      )}

      {/* True branch */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="w-3 h-3"
        style={{ top: '40%', background: '#10b981' }}
      />

      {/* False branch */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="w-3 h-3"
        style={{ top: '60%', background: '#ef4444' }}
      />
    </div>
  );
}

export default memo(ConditionNode);
