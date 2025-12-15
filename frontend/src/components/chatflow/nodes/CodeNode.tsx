/**
 * CodeNode - Execute custom code
 *
 * Runs Python/JavaScript code in the workflow
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Code } from 'lucide-react';

export interface CodeNodeData {
  label: string;
  language?: 'python' | 'javascript';
  code?: string;
  timeout?: number;
}

function CodeNode({ data, selected }: NodeProps<CodeNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-gray-700 to-gray-900 text-white border-2 transition-all ${
        selected ? 'border-gray-600 shadow-xl scale-105' : 'border-gray-700'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Code className="w-5 h-5" />
        <div className="font-bold text-sm">Code Execution</div>
      </div>

      <div className="text-sm opacity-90 mb-2">
        {data.label || 'Execute Code'}
      </div>

      <div className="text-xs opacity-75 space-y-1">
        {data.language && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-black/40">
              {data.language.toUpperCase()}
            </span>
          </div>
        )}
        {data.code && (
          <div className="font-mono text-xs bg-black/20 px-2 py-1 rounded line-clamp-2">
            {data.code}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(CodeNode);
