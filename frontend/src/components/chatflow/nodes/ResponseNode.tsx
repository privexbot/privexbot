/**
 * ResponseNode - Final response node
 *
 * Outputs the final response to the user
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';

export interface ResponseNodeData {
  label: string;
  response_template?: string;
  format?: 'text' | 'markdown' | 'html';
}

function ResponseNode({ data, selected }: NodeProps<ResponseNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-rose-500 to-red-500 text-white border-2 transition-all ${
        selected ? 'border-rose-700 shadow-xl scale-105' : 'border-rose-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="w-5 h-5" />
        <div className="font-bold text-sm">Response</div>
      </div>

      <div className="text-sm opacity-90 mb-2">
        {data.label || 'Final Output'}
      </div>

      {data.response_template && (
        <div className="text-xs opacity-75 bg-black/20 px-2 py-1 rounded line-clamp-2">
          {data.response_template}
        </div>
      )}

      {data.format && data.format !== 'text' && (
        <div className="text-xs opacity-60 mt-1">
          Format: {data.format}
        </div>
      )}
    </div>
  );
}

export default memo(ResponseNode);
