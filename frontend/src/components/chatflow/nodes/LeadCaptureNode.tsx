/**
 * LeadCaptureNode - Lead capture node for chatflow
 *
 * Collects, validates, and stores lead data from conversations
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UserPlus } from 'lucide-react';

export interface LeadCaptureNodeData {
  label: string;
  fields?: Array<{ name: string; required?: boolean }>;
  store_internally?: boolean;
  crm_webhook_url?: string;
}

function LeadCaptureNode({ data, selected }: NodeProps<LeadCaptureNodeData>) {
  const fieldCount = data.fields?.length || 0;
  const hasCrm = !!data.crm_webhook_url;

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white border-2 transition-all ${
        selected ? 'border-emerald-700 shadow-xl scale-105' : 'border-emerald-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <UserPlus className="w-5 h-5" />
        <div className="font-bold text-sm">Lead Capture</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'Capture Lead'}</div>

      <div className="text-xs opacity-75 space-y-1">
        {fieldCount > 0 && (
          <div>{fieldCount} field{fieldCount !== 1 ? 's' : ''} configured</div>
        )}
        {data.fields && data.fields.length > 0 && (
          <div className="font-mono text-xs bg-black/20 px-2 py-1 rounded">
            {data.fields.slice(0, 3).map((f) => f.name).join(', ')}
            {data.fields.length > 3 ? '...' : ''}
          </div>
        )}
        {hasCrm && (
          <div className="text-xs opacity-60">+ CRM sync</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(LeadCaptureNode);
