/**
 * KBEmbeddingSettings - Editable embedding configuration for existing KBs
 *
 * WHY: Allow users to change embedding model after KB creation
 * HOW: Edit config and trigger reindex when model changes
 *
 * BACKEND ALIGNMENT: Uses exact models and parameters from embedding_service_local.py
 * NOTE: Only local sentence-transformers models are supported (no OpenAI/external APIs)
 */

import { useState, useEffect } from 'react';
import {
  Cpu,
  AlertTriangle,
  Info,
  Server,
  Gauge
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmbeddingConfig } from '@/types/knowledge-base';

interface KBEmbeddingSettingsProps {
  config: EmbeddingConfig | null;
  onChange: (config: EmbeddingConfig) => void;
  hasChanges: boolean;
}

/**
 * Backend-supported embedding models (from embedding_service_local.py SUPPORTED_MODELS)
 * These are all local sentence-transformers models - no external API required
 */
const EMBEDDING_MODELS = [
  {
    value: 'all-MiniLM-L6-v2',
    label: 'all-MiniLM-L6-v2',
    dimensions: 384,
    maxSeqLength: 256,
    speed: 'fast',
    quality: 'good',
    sizeMb: 90,
    description: 'Fast, good quality - recommended for most use cases',
    recommended: true
  },
  {
    value: 'all-MiniLM-L12-v2',
    label: 'all-MiniLM-L12-v2',
    dimensions: 384,
    maxSeqLength: 256,
    speed: 'medium',
    quality: 'better',
    sizeMb: 120,
    description: 'Medium speed, better quality than L6',
    recommended: false
  },
  {
    value: 'all-mpnet-base-v2',
    label: 'all-mpnet-base-v2',
    dimensions: 768,
    maxSeqLength: 384,
    speed: 'slow',
    quality: 'best',
    sizeMb: 420,
    description: 'Highest quality - for quality-critical applications',
    recommended: false
  },
  {
    value: 'paraphrase-multilingual-MiniLM-L12-v2',
    label: 'Multilingual MiniLM',
    dimensions: 384,
    maxSeqLength: 128,
    speed: 'medium',
    quality: 'good',
    sizeMb: 470,
    description: 'Supports 50+ languages - for non-English content',
    recommended: false
  },
];

/**
 * Processing device - CPU only
 *
 * BACKEND REALITY: multi_model_embedding_service in embedding_service_local.py
 * hardcodes device="cpu" at line 521. GPU/CUDA is not currently implemented
 * in the pipeline, so we don't offer it as an option.
 */

export function KBEmbeddingSettings({
  config,
  onChange,
  hasChanges
}: KBEmbeddingSettingsProps) {
  // Default config matching backend EmbeddingConfig defaults
  const [localConfig, setLocalConfig] = useState<EmbeddingConfig>({
    model: 'all-MiniLM-L6-v2',
    device: 'cpu',
    batch_size: 32,
    normalize: true,
  });

  // Sync with prop config
  useEffect(() => {
    if (config) {
      setLocalConfig({
        model: config.model || 'all-MiniLM-L6-v2',
        device: config.device || 'cpu',
        batch_size: config.batch_size || 32,
        normalize: config.normalize ?? true,
      });
    }
  }, [config]);

  const handleChange = (field: keyof EmbeddingConfig, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const selectedModel = EMBEDDING_MODELS.find(m => m.value === localConfig.model);

  const getSpeedBadgeColor = (speed: string) => {
    switch (speed) {
      case 'fast': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'slow': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getQualityBadgeColor = (quality: string) => {
    switch (quality) {
      case 'best': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'better': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'good': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Alert */}
      {hasChanges && (
        <Alert className="border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-700 dark:text-amber-300 font-manrope">
            <strong>Important:</strong> Changing the embedding model will regenerate ALL vectors.
            This is a resource-intensive operation and may take several minutes.
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-b border-cyan-200 dark:border-cyan-700 rounded-t-xl p-6">
          <div className="flex items-center gap-3">
            <Cpu className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            <div>
              <CardTitle className="text-xl font-bold text-cyan-900 dark:text-cyan-100 font-manrope">
                Embedding Configuration
              </CardTitle>
              <CardDescription className="text-cyan-700 dark:text-cyan-300 font-manrope mt-1">
                Configure how content is converted to vector embeddings (local models only)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Info about local models */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <Info className="h-4 w-4 text-blue-500 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300 font-manrope">
              All embedding models run locally using sentence-transformers. No external API calls or costs.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
              Embedding Model
            </Label>
            <Select
              value={localConfig.model}
              onValueChange={(value) => handleChange('model', value)}
            >
              <SelectTrigger className="font-manrope">
                <SelectValue placeholder="Select embedding model" />
              </SelectTrigger>
              <SelectContent>
                {EMBEDDING_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value} className="font-manrope">
                    <div className="flex flex-col py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.label}</span>
                        {model.recommended && (
                          <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-700">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{model.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Model Details */}
            {selectedModel && (
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className={`font-manrope ${getSpeedBadgeColor(selectedModel.speed)}`}>
                  <Gauge className="h-3 w-3 mr-1" />
                  {selectedModel.speed}
                </Badge>
                <Badge variant="outline" className={`font-manrope ${getQualityBadgeColor(selectedModel.quality)}`}>
                  Quality: {selectedModel.quality}
                </Badge>
                <Badge variant="outline" className="font-manrope">
                  {selectedModel.dimensions} dimensions
                </Badge>
                <Badge variant="outline" className="font-manrope text-xs">
                  ~{selectedModel.sizeMb}MB
                </Badge>
              </div>
            )}
          </div>

          {/* Processing Device - CPU Only (fixed) */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
              Processing Device
            </Label>
            <div className="p-4 rounded-xl border-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-800">
                  <Server className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="font-semibold font-manrope text-cyan-700 dark:text-cyan-300">
                    CPU
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Local sentence-transformers processing (~100 chunks/sec)
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
              Embeddings are generated locally using CPU. No external API calls.
            </p>
          </div>

          {/* Batch Size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                Batch Size
              </Label>
              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400 font-manrope">
                {localConfig.batch_size}
              </span>
            </div>
            <Slider
              value={[localConfig.batch_size || 32]}
              onValueChange={(value) => handleChange('batch_size', value[0])}
              min={8}
              max={128}
              step={8}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-manrope">
              <span>8 (low memory)</span>
              <span>128 (high throughput)</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
              Higher batch sizes are faster but use more memory (default: 32)
            </p>
          </div>

          {/* Normalize Embeddings */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                  Normalize Embeddings
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                  Normalize vectors to unit length for cosine similarity
                </p>
              </div>
            </div>
            <Switch
              checked={localConfig.normalize}
              onCheckedChange={(checked) => handleChange('normalize', checked)}
            />
          </div>

          {/* Current Config Summary */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope mb-2">
              Configuration Summary
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Model:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {selectedModel?.label || localConfig.model}
              </div>
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Dimensions:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {selectedModel?.dimensions || 384}
              </div>
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Device:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium uppercase">
                {localConfig.device}
              </div>
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Batch Size:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {localConfig.batch_size}
              </div>
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Normalize:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {localConfig.normalize ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
