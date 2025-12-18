/**
 * Chunking Configuration Component
 *
 * Configure document chunking and embedding settings
 */

import { useState } from 'react';
import { Settings, Zap, HelpCircle, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useKBStore } from '@/store/kb-store';
import { ChunkingStrategy, ChunkingConfig } from '@/types/knowledge-base';

interface KBChunkingConfigProps {
  onConfigChange?: (config: ChunkingConfig) => void;
}

export function KBChunkingConfig({ onConfigChange }: KBChunkingConfigProps) {
  const { chunkingConfig, updateChunkingConfig, draftSources } = useKBStore();
  const [activePreset, setActivePreset] = useState('balanced');

  const presets = [
    {
      id: 'precise',
      name: 'Precise',
      description: 'Small chunks for precise retrieval',
      icon: '🎯',
      config: {
        strategy: ChunkingStrategy.SEMANTIC,
        chunk_size: 256,
        chunk_overlap: 50,
        min_chunk_size: 50,
        max_chunk_size: 512
      },
      benefits: ['High precision', 'Detailed answers'],
      tradeoffs: ['More chunks', 'Higher cost']
    },
    {
      id: 'balanced',
      name: 'Balanced',
      description: 'Good balance of context and precision',
      icon: '⚖️',
      config: {
        strategy: ChunkingStrategy.BY_HEADING,
        chunk_size: 512,
        chunk_overlap: 100,
        min_chunk_size: 100,
        max_chunk_size: 1024
      },
      benefits: ['Balanced approach', 'Good for most use cases'],
      tradeoffs: ['Good compromise']
    },
    {
      id: 'contextual',
      name: 'Contextual',
      description: 'Larger chunks for more context',
      icon: '📚',
      config: {
        strategy: ChunkingStrategy.HYBRID,
        chunk_size: 1024,
        chunk_overlap: 200,
        min_chunk_size: 200,
        max_chunk_size: 2048
      },
      benefits: ['Rich context', 'Comprehensive answers'],
      tradeoffs: ['Less precise', 'Fewer chunks']
    }
  ];

  const strategies = [
    {
      value: ChunkingStrategy.NO_CHUNKING,
      name: 'No Chunking',
      description: 'Keep content as complete documents',
      icon: '📋',
      recommended: 'For small documents or precise control'
    },
    {
      value: ChunkingStrategy.BY_SENTENCE,
      name: 'By Sentence',
      description: 'Split on sentence boundaries',
      icon: '📝',
      recommended: 'For precise retrieval'
    },
    {
      value: ChunkingStrategy.BY_PARAGRAPH,
      name: 'By Paragraph',
      description: 'Split on paragraph breaks',
      icon: '¶',
      recommended: 'For natural text flow'
    },
    {
      value: ChunkingStrategy.BY_HEADING,
      name: 'By Heading',
      description: 'Split by markdown headings and structure',
      icon: '📋',
      recommended: 'For structured documents'
    },
    {
      value: ChunkingStrategy.SEMANTIC,
      name: 'Semantic',
      description: 'Split on meaning boundaries using AI',
      icon: '🧠',
      recommended: 'For intelligent chunking'
    },
    {
      value: ChunkingStrategy.ADAPTIVE,
      name: 'Adaptive',
      description: 'Dynamic chunking based on content type',
      icon: '🎯',
      recommended: 'For mixed content types'
    },
    {
      value: ChunkingStrategy.HYBRID,
      name: 'Hybrid',
      description: 'Combines multiple strategies intelligently',
      icon: '⚡',
      recommended: 'For best results'
    },
    {
      value: ChunkingStrategy.CUSTOM,
      name: 'Custom',
      description: 'User-defined separators',
      icon: '🔧',
      recommended: 'For specific formats'
    },
    {
      value: ChunkingStrategy.RECURSIVE,
      name: 'Recursive',
      description: 'Recursive text splitting with intelligent boundaries',
      icon: '🔄',
      recommended: 'Default general-purpose method'
    }
  ];

  const handlePresetSelect = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setActivePreset(presetId);
      const newConfig = { ...chunkingConfig, ...preset.config };
      updateChunkingConfig(preset.config);
      // Notify parent component to update stepper state
      onConfigChange?.(newConfig);
    }
  };

  const handleConfigChange = (field: string, value: any) => {
    const newConfig = { ...chunkingConfig, [field]: value };
    updateChunkingConfig({ [field]: value });
    setActivePreset('custom');
    // Notify parent component to update stepper state
    onConfigChange?.(newConfig);
  };

  const getEstimatedChunks = () => {
    if (draftSources.length === 0) return 0;

    // For NO_CHUNKING strategy, each source becomes one chunk
    if (chunkingConfig.strategy === ChunkingStrategy.NO_CHUNKING) {
      return draftSources.length;
    }

    // Calculate actual content from preview pages for accurate estimation
    let totalContent = 0;
    draftSources.forEach(source => {
      const pages = (source as any).metadata?.previewPages || [];
      if (pages.length > 0) {
        // Use actual page content from previews
        pages.forEach((page: any) => {
          const content = page.edited_content || page.content || '';
          totalContent += content.length;
        });
      } else {
        // Fallback estimates when no preview data available
        if (source.type === 'text') {
          totalContent += (source as any).content?.length || 0;
        } else if (source.type === 'web') {
          totalContent += 5000; // Estimated average page size
        } else if (source.type === 'file') {
          totalContent += (source as any).file_size ? (source as any).file_size / 2 : 10000; // Rough text extraction estimate
        }
      }
    });

    if (totalContent === 0) return 0;

    // Calculate chunks based on strategy and size
    const avgChunkSize = chunkingConfig.chunk_size - chunkingConfig.chunk_overlap;
    return Math.max(1, Math.ceil(totalContent / avgChunkSize));
  };

  const getQualityScore = () => {
    let score = 70; // Base score

    // Strategy bonus
    if (chunkingConfig.strategy === ChunkingStrategy.SEMANTIC) score += 20;
    else if (chunkingConfig.strategy === ChunkingStrategy.HYBRID) score += 25;
    else if (chunkingConfig.strategy === ChunkingStrategy.BY_HEADING) score += 15;
    else if (chunkingConfig.strategy === ChunkingStrategy.ADAPTIVE) score += 18;
    else if (chunkingConfig.strategy === ChunkingStrategy.BY_PARAGRAPH) score += 10;

    // Size optimization
    if (chunkingConfig.chunk_size >= 256 && chunkingConfig.chunk_size <= 1024) score += 10;

    // Overlap optimization
    const overlapRatio = chunkingConfig.chunk_overlap / chunkingConfig.chunk_size;
    if (overlapRatio >= 0.1 && overlapRatio <= 0.3) score += 10;

    return Math.min(100, score);
  };

  // Strategy-specific options renderer
  const renderStrategyOptions = () => {
    switch (chunkingConfig.strategy) {
      case ChunkingStrategy.NO_CHUNKING:
        return (
          <Alert className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-700 dark:text-amber-300 font-manrope">
              Content will be stored as complete documents without chunking.
              No additional configuration needed.
            </AlertDescription>
          </Alert>
        );

      case ChunkingStrategy.SEMANTIC:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300 font-manrope font-medium">Semantic Similarity Threshold</Label>
              <Slider
                value={[chunkingConfig.semantic_threshold || 0.7]}
                onValueChange={([value]) => handleConfigChange('semantic_threshold', value)}
                min={0.1} max={1.0} step={0.1}
                className="mt-3"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-manrope">
                Current: {chunkingConfig.semantic_threshold || 0.7} - Higher values = more similar chunks
              </p>
            </div>
          </div>
        );

      case ChunkingStrategy.CUSTOM:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300 font-manrope font-medium">Custom Separators (one per line)</Label>
              <Textarea
                value={chunkingConfig.custom_separators?.join('\n') || ''}
                onChange={(e) => handleConfigChange('custom_separators',
                  e.target.value.split('\n').filter(s => s.trim()))}
                placeholder={`\\n\\n\n---\n===\n<!-- split -->\n### \n## `}
                className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-manrope"
                rows={6}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-manrope">
                Enter separators that will be used to split your content into chunks
              </p>
            </div>
          </div>
        );

      default:
        // Standard chunk size and overlap controls for other strategies
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300 font-manrope font-medium">Chunk Size (characters)</Label>
              <Slider
                value={[chunkingConfig.chunk_size]}
                onValueChange={([value]) => handleConfigChange('chunk_size', value)}
                min={100} max={4000} step={100}
                className="mt-3"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-manrope">
                Current: {chunkingConfig.chunk_size} characters
              </p>
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300 font-manrope font-medium">Chunk Overlap (characters)</Label>
              <Slider
                value={[chunkingConfig.chunk_overlap]}
                onValueChange={([value]) => handleConfigChange('chunk_overlap', value)}
                min={0} max={500} step={50}
                className="mt-3"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-manrope">
                Current: {chunkingConfig.chunk_overlap} characters
              </p>
            </div>
          </div>
        );
    }
  };

  const estimatedChunks = getEstimatedChunks();
  const qualityScore = getQualityScore();

  return (
    <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
        <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-manrope">
          <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          Chunking Configuration
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope text-base leading-relaxed">
          Configure how your content will be split into chunks for optimal retrieval
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 p-4 sm:p-6">
        {/* Presets */}
        <div className="space-y-4">
          <Label className="text-base font-bold text-gray-900 dark:text-white font-manrope">Choose a Preset</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {presets.map((preset) => (
              <Card
                key={preset.id}
                className={`cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md rounded-xl border ${
                  activePreset === preset.id
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800'
                }`}
                onClick={() => handlePresetSelect(preset.id)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="text-center space-y-3">
                    <span className="text-2xl">{preset.icon}</span>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white font-manrope">{preset.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">{preset.description}</p>

                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {preset.benefits.map((benefit, index) => (
                        <Badge
                          key={index}
                          className="text-xs bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-manrope"
                          variant="outline"
                        >
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Strategy Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-base font-bold text-gray-900 dark:text-white font-manrope">Chunking Strategy</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                  <p className="font-manrope">How content will be split into meaningful chunks</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <RadioGroup
            value={chunkingConfig.strategy}
            onValueChange={(value) => handleConfigChange('strategy', value)}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {strategies.map((strategy) => (
              <div
                key={strategy.value}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem
                    value={strategy.value}
                    id={strategy.value}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={strategy.value}
                      className="font-semibold text-gray-900 dark:text-white font-manrope cursor-pointer flex items-center gap-2"
                    >
                      <span>{strategy.icon}</span>
                      <span>{strategy.name}</span>
                    </Label>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope mt-1 leading-relaxed">
                      {strategy.description}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-manrope font-medium mt-1">
                      {strategy.recommended}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Strategy-Specific Configuration */}
        <div className="space-y-4">
          <Label className="text-base font-bold text-gray-900 dark:text-white font-manrope">Strategy Configuration</Label>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
            {renderStrategyOptions()}
          </div>
        </div>

        {/* Advanced Settings - Hidden for NO_CHUNKING */}
        {chunkingConfig.strategy !== ChunkingStrategy.NO_CHUNKING && (
          <div className="space-y-4">
            <Label className="text-base font-bold text-gray-900 dark:text-white font-manrope">Advanced Settings</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300 font-manrope font-medium">Minimum Chunk Size</Label>
                <Input
                  type="number"
                  value={chunkingConfig.min_chunk_size}
                  onChange={(e) => handleConfigChange('min_chunk_size', parseInt(e.target.value) || 50)}
                  min="10"
                  max="500"
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-manrope"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300 font-manrope font-medium">Maximum Chunk Size</Label>
                <Input
                  type="number"
                  value={chunkingConfig.max_chunk_size}
                  onChange={(e) => handleConfigChange('max_chunk_size', parseInt(e.target.value) || 2048)}
                  min="256"
                  max="4096"
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-manrope"
                />
              </div>
            </div>
          </div>
        )}

        {/* Processing Options */}
        <div className="space-y-4">
          <Label className="text-base font-bold text-gray-900 dark:text-white font-manrope">Processing Options</Label>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600 space-y-4">
            {/* Preserve Code Blocks - Backend IMPLEMENTED: Protects code blocks from being split during chunking */}
            <div className="flex items-center space-x-3">
              <Checkbox
                id="preserve-code-blocks"
                checked={chunkingConfig.preserve_code_blocks ?? true}
                onCheckedChange={(checked) => handleConfigChange('preserve_code_blocks', checked)}
              />
              <div className="flex-1">
                <Label htmlFor="preserve-code-blocks" className="text-sm text-gray-700 dark:text-gray-300 font-manrope cursor-pointer">
                  Preserve code blocks and formatting
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-0.5">
                  Keep code blocks intact during chunking to maintain readability
                </p>
              </div>
            </div>

            {/* Enable Enhanced Metadata - Backend supported */}
            {chunkingConfig.strategy !== ChunkingStrategy.NO_CHUNKING && (
              <div className="flex items-start space-x-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                <Checkbox
                  id="enable-enhanced-metadata"
                  checked={chunkingConfig.enable_enhanced_metadata ?? false}
                  onCheckedChange={(checked) => handleConfigChange('enable_enhanced_metadata', checked)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor="enable-enhanced-metadata" className="text-sm text-gray-700 dark:text-gray-300 font-manrope cursor-pointer flex items-center gap-2">
                    Enable enhanced chunk metadata
                    <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 text-xs font-manrope">
                      Advanced
                    </Badge>
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-1 leading-relaxed">
                    Adds rich metadata to each chunk including context from surrounding chunks, parent headings, and document structure analysis. Improves retrieval quality but increases processing time.
                  </p>
                  {chunkingConfig.enable_enhanced_metadata && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-manrope">
                        <strong>Enhanced metadata includes:</strong> context_before, context_after, parent_heading, document_analysis
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Estimation and Quality */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-bold text-blue-900 dark:text-blue-100 font-manrope">Estimated Results</div>
                <div className="text-sm space-y-1 text-blue-700 dark:text-blue-300 font-manrope">
                  <div>~{estimatedChunks.toLocaleString()} chunks will be created</div>
                  <div>Quality Score: {qualityScore}/100</div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <Alert className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl">
            <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-bold text-green-900 dark:text-green-100 font-manrope">Performance Impact</div>
                <div className="text-sm space-y-1 text-green-700 dark:text-green-300 font-manrope">
                  {chunkingConfig.strategy === ChunkingStrategy.NO_CHUNKING ? (
                    <>
                      <div>Search speed: Depends on document size</div>
                      <div>Context richness: Maximum (full documents)</div>
                    </>
                  ) : (
                    <>
                      <div>Search speed: {chunkingConfig.chunk_size < 512 ? 'Fast' : 'Moderate'}</div>
                      <div>Context richness: {chunkingConfig.chunk_size > 512 ? 'High' : 'Moderate'}</div>
                    </>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {/* Reset Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
          <Button
            variant="outline"
            onClick={() => handlePresetSelect('balanced')}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
          >
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}