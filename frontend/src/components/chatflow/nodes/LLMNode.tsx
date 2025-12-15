/**
 * LLMNode - AI model node for chatflow
 *
 * Represents an LLM generation step in the workflow
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Sparkles, Settings } from 'lucide-react';

export interface LLMNodeData {
  label: string;
  model?: string;
  temperature?: number;
  prompt?: string;
  system_prompt?: string;
  max_tokens?: number;
}

function LLMNode({ data, selected }: NodeProps<LLMNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 transition-all ${
        selected ? 'border-purple-700 shadow-xl scale-105' : 'border-purple-600'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5" />
        <div className="font-bold text-sm">LLM Generation</div>
      </div>

      <div className="text-sm opacity-90 mb-2">{data.label || 'AI Generation'}</div>

      {data.model && (
        <div className="text-xs opacity-75 flex items-center gap-1">
          <Settings className="w-3 h-3" />
          {data.model}
          {data.temperature !== undefined && ` • T: ${data.temperature}`}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(LLMNode);
