/**
 * IndexingConfigPanel - Configure indexing and embedding settings
 *
 * WHY:
 * - Embedding model selection
 * - Vector DB configuration
 * - Index optimization
 *
 * HOW:
 * - Model dropdown
 * - Dimension settings
 * - Distance metrics
 */

import { Zap } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface IndexingConfig {
  embedding_model: string;
  distance_metric: 'cosine' | 'euclidean' | 'dot_product';
  enable_hybrid_search: boolean;
  enable_reranking: boolean;
}

interface IndexingConfigPanelProps {
  config: IndexingConfig;
  onChange: (config: IndexingConfig) => void;
}

const EMBEDDING_MODELS = [
  {
    value: 'text-embedding-ada-002',
    label: 'OpenAI Ada 002',
    dimensions: 1536,
    cost: '$',
    speed: 'Fast',
    quality: 'Good',
  },
  {
    value: 'text-embedding-3-small',
    label: 'OpenAI Embedding 3 Small',
    dimensions: 1536,
    cost: '$',
    speed: 'Very Fast',
    quality: 'Good',
  },
  {
    value: 'text-embedding-3-large',
    label: 'OpenAI Embedding 3 Large',
    dimensions: 3072,
    cost: '$$',
    speed: 'Fast',
    quality: 'Excellent',
  },
  {
    value: 'cohere-embed-english-v3.0',
    label: 'Cohere English v3',
    dimensions: 1024,
    cost: '$',
    speed: 'Fast',
    quality: 'Excellent',
  },
  {
    value: 'voyage-02',
    label: 'Voyage AI v2',
    dimensions: 1024,
    cost: '$',
    speed: 'Very Fast',
    quality: 'Excellent',
  },
];

const DISTANCE_METRICS = [
  {
    value: 'cosine',
    label: 'Cosine Similarity',
    description: 'Best for most use cases (default)',
  },
  {
    value: 'euclidean',
    label: 'Euclidean Distance',
    description: 'Good for magnitude-sensitive data',
  },
  {
    value: 'dot_product',
    label: 'Dot Product',
    description: 'Fast, but vectors must be normalized',
  },
];

export default function IndexingConfigPanel({ config, onChange }: IndexingConfigPanelProps) {
  const updateConfig = (updates: Partial<IndexingConfig>) => {
    onChange({ ...config, ...updates });
  };

  const selectedModel = EMBEDDING_MODELS.find((m) => m.value === config.embedding_model);
  const selectedMetric = DISTANCE_METRICS.find((m) => m.value === config.distance_metric);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 sm:p-6">
        <h3 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-3 text-gray-900 dark:text-white font-manrope">
          <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          Indexing Configuration
        </h3>
        <p className="text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
          Configure embedding model and search optimization
        </p>
      </div>

      {/* Embedding Model */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <Label htmlFor="embedding-model" className="text-lg font-semibold text-gray-900 dark:text-white font-manrope block mb-3">Embedding Model</Label>
        <Select
          value={config.embedding_model}
          onValueChange={(value) => updateConfig({ embedding_model: value })}
        >
          <SelectTrigger id="embedding-model" className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm font-manrope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            {EMBEDDING_MODELS.map((model) => (
              <SelectItem key={model.value} value={model.value} className="font-manrope">
                <div className="flex items-center justify-between w-full">
                  <span>{model.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                    {model.cost} • {model.speed}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedModel && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-blue-600 dark:text-blue-400 text-xs font-medium font-manrope mb-1">Dimensions</p>
                <p className="font-bold text-blue-800 dark:text-blue-200 font-manrope">{selectedModel.dimensions}</p>
              </div>
              <div className="text-center">
                <p className="text-blue-600 dark:text-blue-400 text-xs font-medium font-manrope mb-1">Cost</p>
                <p className="font-bold text-blue-800 dark:text-blue-200 font-manrope">{selectedModel.cost}</p>
              </div>
              <div className="text-center">
                <p className="text-blue-600 dark:text-blue-400 text-xs font-medium font-manrope mb-1">Quality</p>
                <p className="font-bold text-blue-800 dark:text-blue-200 font-manrope">{selectedModel.quality}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Distance Metric */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <Label htmlFor="distance-metric" className="text-lg font-semibold text-gray-900 dark:text-white font-manrope block mb-3">Distance Metric</Label>
        <Select
          value={config.distance_metric}
          onValueChange={(value: any) => updateConfig({ distance_metric: value })}
        >
          <SelectTrigger id="distance-metric" className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm font-manrope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            {DISTANCE_METRICS.map((metric) => (
              <SelectItem key={metric.value} value={metric.value} className="font-manrope">
                {metric.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedMetric && (
          <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed mt-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
            {selectedMetric.description}
          </p>
        )}
      </div>

      {/* Hybrid Search */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="hybrid-search" className="text-lg font-semibold text-gray-900 dark:text-white font-manrope flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-lg flex items-center justify-center">
                <span className="text-xs">🔍</span>
              </div>
              Enable Hybrid Search
            </Label>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
              Combine vector search with keyword search for better results
            </p>
          </div>
          <Switch
            id="hybrid-search"
            checked={config.enable_hybrid_search}
            onCheckedChange={(checked) => updateConfig({ enable_hybrid_search: checked })}
          />
        </div>
      </div>

      {/* Performance Impact */}
      <div className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border border-cyan-200 dark:border-cyan-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <h4 className="text-lg font-bold text-cyan-900 dark:text-cyan-100 font-manrope mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
            <span className="text-lg">📊</span>
          </div>
          Performance Impact
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800/50 border border-cyan-100 dark:border-cyan-800 rounded-xl p-4 text-center shadow-sm">
            <div className="text-cyan-600 dark:text-cyan-400 text-sm font-medium font-manrope mb-1">Indexing Speed</div>
            <div className="text-xl font-bold text-cyan-800 dark:text-cyan-200 font-manrope">
              {selectedModel?.speed || 'Fast'}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800/50 border border-cyan-100 dark:border-cyan-800 rounded-xl p-4 text-center shadow-sm">
            <div className="text-cyan-600 dark:text-cyan-400 text-sm font-medium font-manrope mb-1">Search Latency</div>
            <div className="text-xl font-bold text-cyan-800 dark:text-cyan-200 font-manrope">
              ~50ms
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800/50 border border-cyan-100 dark:border-cyan-800 rounded-xl p-4 text-center shadow-sm">
            <div className="text-cyan-600 dark:text-cyan-400 text-sm font-medium font-manrope mb-1">Search Quality</div>
            <div className="text-xl font-bold text-cyan-800 dark:text-cyan-200 font-manrope">
              {config.enable_hybrid_search ? 'Very Good' : 'Good'}
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <p className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 font-manrope mb-3">
          💡 <strong>Recommendations</strong>
        </p>
        <ul className="space-y-2 list-none">
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Use OpenAI Embedding 3 Large for best quality
          </li>
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Cosine similarity works well for most cases
          </li>
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Enable hybrid search for complex queries
          </li>
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Reranking improves accuracy but adds latency
          </li>
        </ul>
      </div>
    </div>
  );
}
