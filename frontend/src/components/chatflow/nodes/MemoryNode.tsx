/**
 * MemoryNode - Chat history/memory node for chatflow
 *
 * Retrieves conversation history for context-aware responses
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Brain } from 'lucide-react';

export interface MemoryNodeData {
  label: string;
  max_messages?: number;
  format?: 'text' | 'json' | 'structured';
}

function MemoryNode({ data, selected }: NodeProps<MemoryNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white border-2 transition-all ${
        selected ? 'border-pink-700 shadow-xl scale-105' : 'border-pink-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-5 h-5" />
        <div className="font-bold text-sm">Memory</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'Chat Memory'}</div>

      <div className="text-xs opacity-75 space-y-1">
        {data.max_messages && (
          <div>Last {data.max_messages} messages</div>
        )}
        {data.format && (
          <div>Format: {data.format}</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(MemoryNode);
