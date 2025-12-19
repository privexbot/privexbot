/**
 * KBVectorStoreSettings - Vector store configuration for existing KBs
 *
 * WHY: Allow users to view and adjust vector store settings
 * HOW: Display current config with limited editability
 *
 * BACKEND ALIGNMENT: Uses exact parameters from qdrant_service.py
 * NOTE: Only Qdrant is implemented - provider is locked after KB creation
 */

import { useState, useEffect } from 'react';
import {
  Database,
  AlertTriangle,
  Info,
  Lock,
  Settings2,
  Gauge
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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

interface VectorStoreSettingsConfig {
  provider?: string;
  distance_metric?: string;
  vector_size?: number;
  hnsw_m?: number;
  ef_construct?: number;
  batch_size?: number;
}

interface KBVectorStoreSettingsProps {
  config: VectorStoreSettingsConfig | null;
  onChange: (config: VectorStoreSettingsConfig) => void;
  hasChanges: boolean;
  isLocked?: boolean; // Whether vector store settings are locked (can't change provider after creation)
}

/**
 * Backend-supported distance metrics (from qdrant_service.py)
 * Note: Qdrant uses capitalized names: "Cosine", "Dot", "Euclid"
 */
const DISTANCE_METRICS = [
  {
    value: 'Cosine',
    label: 'Cosine Similarity',
    description: 'Best for normalized embeddings (default)',
    recommended: true
  },
  {
    value: 'Dot',
    label: 'Dot Product',
    description: 'Inner product - fastest for normalized vectors',
    recommended: false
  },
  {
    value: 'Euclid',
    label: 'Euclidean Distance',
    description: 'L2 distance - good for dense embeddings',
    recommended: false
  },
];

export function KBVectorStoreSettings({
  config,
  onChange,
  hasChanges,
  isLocked: _isLocked = true // Vector store provider is locked after KB creation
}: KBVectorStoreSettingsProps) {
  // Note: _isLocked indicates provider cannot be changed - UI already reflects this with "Locked" badge
  void _isLocked;
  // Default config matching Qdrant defaults
  const [localConfig, setLocalConfig] = useState<VectorStoreSettingsConfig>({
    provider: 'qdrant',
    distance_metric: 'Cosine',
    vector_size: 384,
    hnsw_m: 16,
    ef_construct: 100,
    batch_size: 100,
  });

  // Sync with prop config
  useEffect(() => {
    if (config) {
      setLocalConfig({
        provider: config.provider || 'qdrant',
        distance_metric: config.distance_metric || 'Cosine',
        vector_size: config.vector_size || 384,
        hnsw_m: config.hnsw_m || 16,
        ef_construct: config.ef_construct || 100,
        batch_size: config.batch_size || 100,
      });
    }
  }, [config]);

  const handleChange = (field: keyof VectorStoreSettingsConfig, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  return (
    <div className="space-y-6">
      {/* Warning Alert */}
      {hasChanges && (
        <Alert className="border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-700 dark:text-amber-300 font-manrope">
            <strong>Note:</strong> Changing vector store settings requires recreating the collection.
            All vectors will be re-indexed.
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-b border-emerald-200 dark:border-emerald-700 rounded-t-xl p-6">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <CardTitle className="text-xl font-bold text-emerald-900 dark:text-emerald-100 font-manrope">
                Vector Store Configuration
              </CardTitle>
              <CardDescription className="text-emerald-700 dark:text-emerald-300 font-manrope mt-1">
                Configure how vectors are stored and searched in Qdrant
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Provider Display (Locked) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                Vector Database
              </Label>
              <Badge variant="outline" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Locked
              </Badge>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
                <Database className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                  Qdrant
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
                  Self-hosted vector database with HNSW indexing
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <Info className="h-4 w-4 text-blue-500 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300 font-manrope">
                Qdrant runs locally in Docker. No external API calls or data sharing.
              </p>
            </div>
          </div>

          {/* Distance Metric */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
              Distance Metric
            </Label>
            <Select
              value={localConfig.distance_metric}
              onValueChange={(value) => handleChange('distance_metric', value)}
            >
              <SelectTrigger className="font-manrope">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-emerald-500" />
                  <SelectValue placeholder="Select distance metric" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {DISTANCE_METRICS.map((metric) => (
                  <SelectItem key={metric.value} value={metric.value} className="font-manrope">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {metric.label}
                        {metric.recommended && (
                          <span className="ml-2 text-xs text-green-600 dark:text-green-400">(Recommended)</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{metric.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* HNSW Parameters */}
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              HNSW Index Parameters
            </h4>

            {/* M Parameter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                  M (connections per node)
                </Label>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-manrope">
                  {localConfig.hnsw_m}
                </span>
              </div>
              <Slider
                value={[localConfig.hnsw_m || 16]}
                onValueChange={(value) => handleChange('hnsw_m', value[0])}
                min={4}
                max={64}
                step={4}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Higher = better recall, more memory. Default: 16
              </p>
            </div>

            {/* EF Construct */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                  EF Construct (build accuracy)
                </Label>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-manrope">
                  {localConfig.ef_construct}
                </span>
              </div>
              <Slider
                value={[localConfig.ef_construct || 100]}
                onValueChange={(value) => handleChange('ef_construct', value[0])}
                min={50}
                max={500}
                step={50}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Higher = better index quality, slower build. Default: 100
              </p>
            </div>
          </div>

          {/* Current Config Summary */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope mb-2">
              Configuration Summary
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Provider:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                Qdrant
              </div>
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Index Type:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                HNSW
              </div>
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Distance:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {localConfig.distance_metric}
              </div>
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Vector Size:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {localConfig.vector_size}
              </div>
              <div className="text-gray-500 dark:text-gray-400 font-manrope">HNSW M:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {localConfig.hnsw_m}
              </div>
              <div className="text-gray-500 dark:text-gray-400 font-manrope">EF Construct:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {localConfig.ef_construct}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
