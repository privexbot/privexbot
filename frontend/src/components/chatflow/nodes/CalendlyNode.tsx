/**
 * CalendlyNode - Calendly scheduling node for chatflow
 *
 * Shares booking links and manages scheduling via Calendly API
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Calendar } from 'lucide-react';

export interface CalendlyNodeData {
  label: string;
  action?: 'get_link' | 'list_events';
  event_type_name?: string;
}

function CalendlyNode({ data, selected }: NodeProps<CalendlyNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-2 transition-all ${
        selected ? 'border-indigo-800 shadow-xl scale-105' : 'border-indigo-700'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Calendar className="w-5 h-5" />
        <div className="font-bold text-sm">Calendly</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'Schedule Meeting'}</div>

      <div className="text-xs opacity-75 space-y-1">
        {data.action && (
          <div>Action: {data.action === 'list_events' ? 'List Events' : 'Get Link'}</div>
        )}
        {data.event_type_name && (
          <div className="truncate max-w-[180px]" title={data.event_type_name}>
            Event: {data.event_type_name}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(CalendlyNode);
