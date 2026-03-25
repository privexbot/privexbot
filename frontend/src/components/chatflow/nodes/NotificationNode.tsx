/**
 * NotificationNode - Team notification node for chatflow
 *
 * Posts messages to Slack, Discord, or Microsoft Teams channels
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Bell } from 'lucide-react';

export interface NotificationNodeData {
  label: string;
  channel?: 'slack' | 'discord' | 'teams' | 'custom';
  urgency?: 'info' | 'warning' | 'alert';
  title?: string;
}

const channelLabels: Record<string, string> = {
  slack: 'Slack',
  discord: 'Discord',
  teams: 'Teams',
  custom: 'Custom',
};

const urgencyColors: Record<string, string> = {
  info: 'bg-blue-600',
  warning: 'bg-yellow-600',
  alert: 'bg-red-600',
};

function NotificationNode({ data, selected }: NodeProps<NotificationNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-2 transition-all ${
        selected ? 'border-teal-700 shadow-xl scale-105' : 'border-teal-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-5 h-5" />
        <div className="font-bold text-sm">Notification</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'Notify Team'}</div>

      <div className="text-xs opacity-75 space-y-1">
        {data.channel && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-black/20">
              {channelLabels[data.channel] || data.channel}
            </span>
          </div>
        )}
        {data.urgency && data.urgency !== 'info' && (
          <div className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${urgencyColors[data.urgency] || ''}`}
            />
            <span className="capitalize">{data.urgency}</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(NotificationNode);
