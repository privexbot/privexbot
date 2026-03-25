/**
 * EmailNode - Send email node for chatflow
 *
 * Sends emails via SMTP as part of workflow automation
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Mail } from 'lucide-react';

export interface EmailNodeData {
  label: string;
  to?: string;
  subject?: string;
  body_type?: 'html' | 'text';
}

function EmailNode({ data, selected }: NodeProps<EmailNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 text-white border-2 transition-all ${
        selected ? 'border-sky-700 shadow-xl scale-105' : 'border-sky-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-5 h-5" />
        <div className="font-bold text-sm">Send Email</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'Email'}</div>

      <div className="text-xs opacity-75 space-y-1">
        {data.to && (
          <div className="truncate max-w-[180px]" title={data.to}>
            To: {data.to}
          </div>
        )}
        {data.subject && (
          <div className="truncate max-w-[180px]" title={data.subject}>
            Subject: {data.subject}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(EmailNode);
