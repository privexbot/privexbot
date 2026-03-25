/**
 * DatabaseNode - SQL database query node for chatflow
 *
 * Executes parameterized SQL queries against connected databases
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Database } from 'lucide-react';

export interface DatabaseNodeData {
  label: string;
  operation?: 'query' | 'insert' | 'update' | 'delete';
  query?: string;
}

function DatabaseNode({ data, selected }: NodeProps<DatabaseNodeData>) {
  const opColors: Record<string, string> = {
    query: 'bg-blue-100 text-blue-800',
    insert: 'bg-green-100 text-green-800',
    update: 'bg-yellow-100 text-yellow-800',
    delete: 'bg-red-100 text-red-800',
  };

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-2 transition-all ${
        selected ? 'border-emerald-700 shadow-xl scale-105' : 'border-emerald-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Database className="w-5 h-5" />
        <div className="font-bold text-sm">Database</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'SQL Query'}</div>

      <div className="text-xs opacity-75 space-y-1">
        {data.operation && (
          <div>
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${opColors[data.operation] || ''}`}>
              {data.operation.toUpperCase()}
            </span>
          </div>
        )}
        {data.query && (
          <div className="truncate max-w-[180px] font-mono" title={data.query}>
            {data.query}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(DatabaseNode);
