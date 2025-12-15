/**
 * ChunkConfigPanel - Configure chunking settings
 *
 * WHY:
 * - Optimize chunk size
 * - Control overlap
 * - Strategy selection
 *
 * HOW:
 * - Strategy dropdown
 * - Size/overlap sliders
 * - Preview impact
 */

import { Settings, BarChart3 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ChunkConfig {
  strategy: 'recursive' | 'sentence' | 'token' | 'semantic';
  chunk_size: number;
  chunk_overlap: number;
  separator?: string;
}

interface ChunkConfigPanelProps {
  config: ChunkConfig;
  onChange: (config: ChunkConfig) => void;
}

const STRATEGIES = [
  {
    value: 'recursive',
    label: 'Recursive (Recommended)',
    description: 'Splits text recursively by paragraphs, sentences, then words',
  },
  {
    value: 'sentence',
    label: 'Sentence-based',
    description: 'Splits at sentence boundaries for natural breaks',
  },
  {
    value: 'token',
    label: 'Token-based',
    description: 'Splits by token count, good for exact control',
  },
  {
    value: 'semantic',
    label: 'Semantic (Advanced)',
    description: 'AI-powered semantic chunking for optimal context',
  },
];

export default function ChunkConfigPanel({ config, onChange }: ChunkConfigPanelProps) {
  const updateConfig = (updates: Partial<ChunkConfig>) => {
    onChange({ ...config, ...updates });
  };

  const selectedStrategy = STRATEGIES.find((s) => s.value === config.strategy);

  // Calculate estimated chunks (rough estimate)
  const estimateChunks = (totalChars: number) => {
    const effectiveSize = config.chunk_size - config.chunk_overlap;
    return Math.ceil(totalChars / effectiveSize);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 sm:p-6">
        <h3 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-3 text-gray-900 dark:text-white font-manrope">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          Chunking Configuration
        </h3>
        <p className="text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
          Configure how documents are split into chunks for indexing
        </p>
      </div>

      {/* Strategy */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <Label htmlFor="strategy" className="text-lg font-semibold text-gray-900 dark:text-white font-manrope">
          Chunking Strategy
        </Label>
        <Select
          value={config.strategy}
          onValueChange={(value: any) => updateConfig({ strategy: value })}
        >
          <SelectTrigger id="strategy" className="mt-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm font-manrope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            {STRATEGIES.map((strategy) => (
              <SelectItem key={strategy.value} value={strategy.value} className="font-manrope">
                {strategy.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedStrategy && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-manrope leading-relaxed">
            {selectedStrategy.description}
          </p>
        )}
      </div>

      {/* Chunk Size */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <Label htmlFor="chunk-size" className="text-lg font-semibold text-gray-900 dark:text-white font-manrope">
            Chunk Size (characters)
          </Label>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400 font-manrope bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg">
            {config.chunk_size}
          </span>
        </div>
        <input
          id="chunk-size"
          type="range"
          min="100"
          max="4000"
          step="100"
          value={config.chunk_size}
          onChange={(e) => updateConfig({ chunk_size: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-2 font-manrope">
          <span>Small (100)</span>
          <span>Large (4000)</span>
        </div>
        <div className="mt-3 p-3 rounded-lg">
          {config.chunk_size < 500 && (
            <p className="text-sm text-amber-700 dark:text-amber-300 font-manrope bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
              ⚠️ Very small chunks may lose context
            </p>
          )}
          {config.chunk_size >= 500 && config.chunk_size <= 2000 && (
            <p className="text-sm text-green-700 dark:text-green-300 font-manrope bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
              ✓ Recommended size
            </p>
          )}
          {config.chunk_size > 2000 && (
            <p className="text-sm text-red-700 dark:text-red-300 font-manrope bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3">
              ⚠️ Large chunks may reduce search accuracy
            </p>
          )}
        </div>
      </div>

      {/* Chunk Overlap */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <Label htmlFor="chunk-overlap" className="text-lg font-semibold text-gray-900 dark:text-white font-manrope">
            Chunk Overlap (characters)
          </Label>
          <span className="text-lg font-bold text-green-600 dark:text-green-400 font-manrope bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-lg">
            {config.chunk_overlap}
          </span>
        </div>
        <input
          id="chunk-overlap"
          type="range"
          min="0"
          max="500"
          step="50"
          value={config.chunk_overlap}
          onChange={(e) => updateConfig({ chunk_overlap: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-2 font-manrope">
          <span>No overlap (0)</span>
          <span>Max (500)</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 font-manrope leading-relaxed bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
          Overlap prevents context loss at chunk boundaries
        </p>
      </div>

      {/* Custom Separator (conditional) */}
      {config.strategy === 'recursive' && (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
          <Label htmlFor="separator" className="text-lg font-semibold text-gray-900 dark:text-white font-manrope">
            Custom Separator (Optional)
          </Label>
          <Input
            id="separator"
            value={config.separator || ''}
            onChange={(e) => updateConfig({ separator: e.target.value })}
            placeholder="e.g., \n\n (double newline)"
            className="mt-3 font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm font-manrope"
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-manrope leading-relaxed">
            Leave empty for default separators
          </p>
        </div>
      )}

      {/* Stats Card */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 sm:p-6 shadow-lg">
        <h4 className="text-xl font-bold mb-4 text-purple-900 dark:text-purple-100 font-manrope flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          Impact Summary
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-purple-100 dark:border-purple-800 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400 font-manrope font-medium mb-2">Effective Size</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 font-manrope">
              {config.chunk_size - config.chunk_overlap}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">chars</p>
          </div>
          <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-purple-100 dark:border-purple-800 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400 font-manrope font-medium mb-2">Overlap Ratio</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 font-manrope">
              {((config.chunk_overlap / config.chunk_size) * 100).toFixed(0)}%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-purple-100 dark:border-purple-800 shadow-sm md:col-span-2 lg:col-span-1">
            <p className="text-gray-600 dark:text-gray-400 font-manrope font-medium mb-2">Estimated chunks (10K doc)</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 font-manrope">{estimateChunks(10000)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">chunks</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <p className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 font-manrope mb-3">
          💡 <strong>Best Practices</strong>
        </p>
        <ul className="text-sm space-y-2 list-none">
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Use 1000-2000 chars for most documentation
          </li>
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Add 10-20% overlap to preserve context
          </li>
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Smaller chunks = more precise search
          </li>
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Larger chunks = better context retention
          </li>
        </ul>
      </div>
    </div>
  );
}
