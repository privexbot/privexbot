/**
 * KnowledgeBaseNode - Knowledge base retrieval node
 *
 * Retrieves relevant documents from a knowledge base
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Database, Search } from 'lucide-react';

export interface KnowledgeBaseNodeData {
  label: string;
  kb_id?: string;
  kb_name?: string;
  top_k?: number;
  similarity_threshold?: number;
}

function KnowledgeBaseNode({ data, selected }: NodeProps<KnowledgeBaseNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-2 transition-all ${
        selected ? 'border-blue-700 shadow-xl scale-105' : 'border-blue-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Database className="w-5 h-5" />
        <div className="font-bold text-sm">Knowledge Base</div>
      </div>

      <div className="text-sm opacity-90 mb-2">
        {data.label || 'Retrieve Context'}
      </div>

      <div className="text-xs opacity-75 space-y-0.5">
        {data.kb_name && (
          <div className="flex items-center gap-1">
            <Search className="w-3 h-3" />
            {data.kb_name}
          </div>
        )}
        {data.top_k && (
          <div>Top {data.top_k} results</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(KnowledgeBaseNode);
