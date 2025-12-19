/**
 * KBChunkingSettings - Editable chunking configuration for existing KBs
 *
 * WHY: Allow users to reconfigure chunking after KB creation
 * HOW: Edit config and trigger reindex when changes require reprocessing
 *
 * BACKEND ALIGNMENT: Uses exact strategy names and parameters from chunking_service.py
 */

import { useState, useEffect } from 'react';
import {
  Scissors,
  AlertTriangle,
  Info,
  Code,
  FileText,
  Heading,
  Brain,
  Layers,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChunkingConfig } from '@/types/knowledge-base';

interface KBChunkingSettingsProps {
  config: ChunkingConfig | null;
  onChange: (config: ChunkingConfig) => void;
  hasChanges: boolean;
  sourceType?: 'web' | 'file' | 'mixed';
}

/**
 * Normalize strategy value from backend to frontend expected values.
 * Backend accepts aliases (e.g., "by_paragraph" and "paragraph_based" are equivalent)
 * but frontend Select needs exact matches.
 */
const normalizeStrategy = (strategy: string | undefined): string => {
  if (!strategy) return 'recursive';

  // Map backend aliases to frontend values
  const aliasMap: Record<string, string> = {
    'by_paragraph': 'paragraph_based',
    'by_sentence': 'sentence_based',
    'sentence': 'sentence_based',
    'heading': 'by_heading',
    'full_content': 'no_chunking',
  };

  return aliasMap[strategy] || strategy;
};

/**
 * Backend-supported chunking strategies (from chunking_service.py)
 * Strategy strings must match exactly what the backend expects
 */
const CHUNKING_STRATEGIES = [
  {
    value: 'recursive',
    label: 'Recursive',
    description: 'Default - splits text recursively on separators',
    icon: Layers,
    recommended: true
  },
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Auto-selects strategy based on content structure',
    icon: Sparkles,
    recommended: false
  },
  {
    value: 'by_heading',
    label: 'By Heading',
    description: 'Splits on markdown headings (# ## ###)',
    icon: Heading,
    recommended: false
  },
  {
    value: 'paragraph_based',
    label: 'By Paragraph',
    description: 'Splits on paragraph breaks',
    icon: FileText,
    recommended: false
  },
  {
    value: 'sentence_based',
    label: 'By Sentence',
    description: 'Splits on sentence boundaries',
    icon: FileText,
    recommended: false
  },
  {
    value: 'semantic',
    label: 'Semantic',
    description: 'Intelligent splits based on topic changes',
    icon: Brain,
    recommended: false
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Combines multiple strategies for best results',
    icon: Layers,
    recommended: false
  },
  {
    value: 'no_chunking',
    label: 'No Chunking',
    description: 'Keep documents whole (small docs only)',
    icon: FileText,
    recommended: false
  },
];

export function KBChunkingSettings({
  config,
  onChange,
  hasChanges,
  sourceType: _sourceType = 'mixed' // Reserved for future source-type specific tips
}: KBChunkingSettingsProps) {
  // Note: _sourceType is available for future use (e.g., different recommendations for web vs file sources)
  void _sourceType;
  // Default config matching backend ChunkingConfig defaults
  const [localConfig, setLocalConfig] = useState<ChunkingConfig>({
    strategy: 'recursive' as any,
    chunk_size: 1000,
    chunk_overlap: 200,
    preserve_code_blocks: true,
    enable_enhanced_metadata: true,
  });

  // Sync with prop config
  useEffect(() => {
    console.log('[KBChunkingSettings] Config prop received:', config);
    if (config) {
      // Normalize strategy to handle backend aliases (e.g., "by_paragraph" -> "paragraph_based")
      const normalizedStrategy = normalizeStrategy(config.strategy);
      console.log('[KBChunkingSettings] Normalized strategy:', config.strategy, '->', normalizedStrategy);

      const newLocalConfig = {
        strategy: normalizedStrategy as any,
        chunk_size: config.chunk_size || 1000,
        chunk_overlap: config.chunk_overlap || 200,
        preserve_code_blocks: config.preserve_code_blocks ?? true,
        enable_enhanced_metadata: config.enable_enhanced_metadata ?? true,
        semantic_threshold: config.semantic_threshold,
        custom_separators: config.custom_separators,
      };
      console.log('[KBChunkingSettings] Setting localConfig:', newLocalConfig);
      setLocalConfig(newLocalConfig);
    }
  }, [config]);

  const handleChange = (field: keyof ChunkingConfig, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const selectedStrategy = CHUNKING_STRATEGIES.find(s => s.value === localConfig.strategy);
  const StrategyIcon = selectedStrategy?.icon || Layers;

  // Check if strategy supports size configuration
  const supportsChunkSize = localConfig.strategy !== 'no_chunking' && localConfig.strategy !== 'full_content';

  return (
    <div className="space-y-6">
      {/* Warning Alert */}
      {hasChanges && (
        <Alert className="border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-700 dark:text-amber-300 font-manrope">
            <strong>Note:</strong> Changing chunking configuration will trigger a full reindex.
            All existing chunks will be regenerated with the new settings.
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-200 dark:border-purple-700 rounded-t-xl p-6">
          <div className="flex items-center gap-3">
            <Scissors className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            <div>
              <CardTitle className="text-xl font-bold text-purple-900 dark:text-purple-100 font-manrope">
                Chunking Configuration
              </CardTitle>
              <CardDescription className="text-purple-700 dark:text-purple-300 font-manrope mt-1">
                Configure how content is split into searchable chunks
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Strategy Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
              Chunking Strategy
            </Label>
            <Select
              value={localConfig.strategy as string}
              onValueChange={(value) => handleChange('strategy', value)}
            >
              <SelectTrigger className="font-manrope">
                <div className="flex items-center gap-2">
                  <StrategyIcon className="h-4 w-4 text-purple-500" />
                  <SelectValue placeholder="Select strategy" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {CHUNKING_STRATEGIES.map((strategy) => {
                  const Icon = strategy.icon;
                  return (
                    <SelectItem key={strategy.value} value={strategy.value} className="font-manrope">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-purple-500" />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {strategy.label}
                            {strategy.recommended && (
                              <span className="ml-2 text-xs text-green-600 dark:text-green-400">(Recommended)</span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{strategy.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Strategy-specific tip */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <Info className="h-4 w-4 text-blue-500 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300 font-manrope">
                {localConfig.strategy === 'by_heading' && (
                  <>Best for documentation with clear heading structure. Preserves context within sections.</>
                )}
                {localConfig.strategy === 'semantic' && (
                  <>Detects topic changes to find natural content boundaries. Better for prose.</>
                )}
                {localConfig.strategy === 'recursive' && (
                  <>Versatile default that works well for most content types.</>
                )}
                {localConfig.strategy === 'adaptive' && (
                  <>Analyzes content structure and auto-selects the best strategy.</>
                )}
                {(localConfig.strategy === 'no_chunking' || localConfig.strategy === 'full_content') && (
                  <>Keeps documents whole. Only use for small documents under 2000 characters.</>
                )}
                {localConfig.strategy === 'paragraph_based' && (
                  <>Splits on paragraph breaks. Good for well-structured text.</>
                )}
                {localConfig.strategy === 'sentence_based' && (
                  <>Fine-grained splitting on sentences. May lose context between chunks.</>
                )}
                {localConfig.strategy === 'hybrid' && (
                  <>Combines heading-aware and recursive strategies for best results.</>
                )}
              </p>
            </div>
          </div>

          {/* Chunk Size */}
          {supportsChunkSize && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                  Chunk Size (characters)
                </Label>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400 font-manrope">
                  {localConfig.chunk_size}
                </span>
              </div>
              <Slider
                value={[localConfig.chunk_size]}
                onValueChange={(value) => handleChange('chunk_size', value[0])}
                min={200}
                max={4000}
                step={100}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-manrope">
                <span>200 (precise)</span>
                <span>4000 (contextual)</span>
              </div>
            </div>
          )}

          {/* Chunk Overlap */}
          {supportsChunkSize && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                  Chunk Overlap (characters)
                </Label>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400 font-manrope">
                  {localConfig.chunk_overlap}
                </span>
              </div>
              <Slider
                value={[localConfig.chunk_overlap]}
                onValueChange={(value) => handleChange('chunk_overlap', value[0])}
                min={0}
                max={Math.min(500, Math.floor(localConfig.chunk_size / 2))}
                step={25}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-manrope">
                <span>0 (no overlap)</span>
                <span>{Math.min(500, Math.floor(localConfig.chunk_size / 2))} (max)</span>
              </div>
            </div>
          )}

          {/* Semantic Threshold (only for semantic strategy) */}
          {localConfig.strategy === 'semantic' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                  Semantic Threshold
                </Label>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400 font-manrope">
                  {(localConfig.semantic_threshold || 0.65).toFixed(2)}
                </span>
              </div>
              <Slider
                value={[localConfig.semantic_threshold || 0.65]}
                onValueChange={(value) => handleChange('semantic_threshold', value[0])}
                min={0.3}
                max={0.9}
                step={0.05}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Lower values create more splits at topic boundaries (default: 0.65)
              </p>
            </div>
          )}

          {/* Toggle Options */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* Preserve Code Blocks */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Code className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                    Preserve Code Blocks
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Keep code blocks intact instead of splitting them
                  </p>
                </div>
              </div>
              <Switch
                checked={localConfig.preserve_code_blocks}
                onCheckedChange={(checked) => handleChange('preserve_code_blocks', checked)}
              />
            </div>

            {/* Enhanced Metadata */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                    Enhanced Metadata
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Include context_before, context_after, and parent_heading
                  </p>
                </div>
              </div>
              <Switch
                checked={localConfig.enable_enhanced_metadata}
                onCheckedChange={(checked) => handleChange('enable_enhanced_metadata', checked)}
              />
            </div>
          </div>

          {/* Current Config Summary */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope mb-2">
              Configuration Summary
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Strategy:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {selectedStrategy?.label || localConfig.strategy}
              </div>
              {supportsChunkSize && (
                <>
                  <div className="text-gray-500 dark:text-gray-400 font-manrope">Chunk Size:</div>
                  <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                    {localConfig.chunk_size} characters
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 font-manrope">Overlap:</div>
                  <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                    {localConfig.chunk_overlap} characters
                  </div>
                </>
              )}
              <div className="text-gray-500 dark:text-gray-400 font-manrope">Code Blocks:</div>
              <div className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
                {localConfig.preserve_code_blocks ? 'Preserved' : 'Split'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
