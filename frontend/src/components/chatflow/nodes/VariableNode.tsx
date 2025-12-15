/**
 * VariableNode - Set or transform variables
 *
 * Stores values in variables for use in the workflow
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Variable } from 'lucide-react';

export interface VariableNodeData {
  label: string;
  variable_name?: string;
  operation?: 'set' | 'append' | 'increment' | 'transform';
  value?: any;
}

function VariableNode({ data, selected }: NodeProps<VariableNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-2 transition-all ${
        selected ? 'border-indigo-700 shadow-xl scale-105' : 'border-indigo-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Variable className="w-5 h-5" />
        <div className="font-bold text-sm">Variable</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'Set Value'}</div>

      {data.variable_name && (
        <div className="text-xs opacity-75 space-y-1">
          <div className="font-mono bg-black/20 px-2 py-1 rounded">
            {data.variable_name}
          </div>
          {data.operation && (
            <div className="text-xs opacity-60">
              Operation: {data.operation}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(VariableNode);
