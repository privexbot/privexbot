/**
 * WebhookNode - Outbound webhook node for chatflow
 *
 * Sends data to external systems (Zapier, Make, n8n, custom)
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Send } from 'lucide-react';

export interface WebhookNodeData {
  label: string;
  url?: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  fire_and_forget?: boolean;
}

function WebhookNode({ data, selected }: NodeProps<WebhookNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white border-2 transition-all ${
        selected ? 'border-orange-700 shadow-xl scale-105' : 'border-orange-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Send className="w-5 h-5" />
        <div className="font-bold text-sm">Webhook</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'Send Data'}</div>

      <div className="text-xs opacity-75 space-y-1">
        {data.method && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-black/20">
              {data.method}
            </span>
          </div>
        )}
        {data.url && (
          <div className="font-mono text-xs truncate max-w-[180px]" title={data.url}>
            {data.url}
          </div>
        )}
        {data.fire_and_forget && (
          <div className="text-xs opacity-60">Fire & Forget</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(WebhookNode);
