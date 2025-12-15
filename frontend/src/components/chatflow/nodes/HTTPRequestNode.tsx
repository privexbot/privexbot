/**
 * HTTPRequestNode - HTTP API request node
 *
 * Makes HTTP requests to external APIs
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';

export interface HTTPRequestNodeData {
  label: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}

function HTTPRequestNode({ data, selected }: NodeProps<HTTPRequestNodeData>) {
  const methodColors: Record<string, string> = {
    GET: 'bg-blue-600',
    POST: 'bg-green-600',
    PUT: 'bg-yellow-600',
    DELETE: 'bg-red-600',
    PATCH: 'bg-purple-600',
  };

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white border-2 transition-all ${
        selected ? 'border-green-700 shadow-xl scale-105' : 'border-green-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-5 h-5" />
        <div className="font-bold text-sm">HTTP Request</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'API Call'}</div>

      <div className="text-xs opacity-75 space-y-1">
        {data.method && (
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                methodColors[data.method] || 'bg-gray-600'
              }`}
            >
              {data.method}
            </span>
          </div>
        )}
        {data.url && (
          <div className="font-mono text-xs truncate max-w-[180px]" title={data.url}>
            {data.url}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(HTTPRequestNode);
