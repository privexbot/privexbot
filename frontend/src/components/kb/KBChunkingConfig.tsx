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
      value: ChunkingStrategy.FULL_CONTENT,
      name: 'No Chunking',
      description: 'Index full content as single document (best for small content)',
      icon: '📄',
      recommended: 'For content < 2000 characters'
    },
    {
      value: ChunkingStrategy.RECURSIVE,
      name: 'Recursive',
      description: 'Recursive text splitting with intelligent boundaries',
      icon: '🔄'
    },
    {
      value: ChunkingStrategy.BY_HEADING,
      name: 'By Heading',
      description: 'Split by document headings and structure',
      icon: '📋'
    },
    {
      value: ChunkingStrategy.SEMANTIC,
      name: 'Semantic',
      description: 'Split by meaning and semantic context',
      icon: '🧠'
    },
    {
      value: ChunkingStrategy.BY_SECTION,
      name: 'By Section',
      description: 'Split by document sections and topics',
      icon: '📑'
    },
    {
      value: ChunkingStrategy.ADAPTIVE,
      name: 'Adaptive',
      description: 'Adaptive chunking based on content type',
      icon: '🎯'
    },
    {
      value: ChunkingStrategy.SENTENCE_BASED,
      name: 'Sentence Based',
      description: 'Split by sentence boundaries',
      icon: '📝'
    },
    {
      value: ChunkingStrategy.PARAGRAPH_BASED,
      name: 'Paragraph Based',
      description: 'Split by natural paragraphs',
      icon: '¶'
    },
    {
      value: ChunkingStrategy.HYBRID,
      name: 'Hybrid',
      description: 'Combines multiple strategies intelligently',
      icon: '⚡'
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

    // For FULL_CONTENT strategy, each source becomes one chunk
    if (chunkingConfig.strategy === ChunkingStrategy.FULL_CONTENT) {
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
    else if (chunkingConfig.strategy === ChunkingStrategy.PARAGRAPH_BASED) score += 10;

    // Size optimization
    if (chunkingConfig.chunk_size >= 256 && chunkingConfig.chunk_size <= 1024) score += 10;

    // Overlap optimization
    const overlapRatio = chunkingConfig.chunk_overlap / chunkingConfig.chunk_size;
    if (overlapRatio >= 0.1 && overlapRatio <= 0.3) score += 10;

    return Math.min(100, score);
  };

  const estimatedChunks = getEstimatedChunks();
  const qualityScore = getQualityScore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Chunking Configuration
        </CardTitle>
        <CardDescription>
          Configure how your content will be split into chunks for optimal retrieval
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Presets */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Choose a Preset</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {presets.map((preset) => (
              <Card
                key={preset.id}
                className={`cursor-pointer transition-all ${
                  activePreset === preset.id
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handlePresetSelect(preset.id)}
              >
                <CardContent className="p-4">
                  <div className="text-center space-y-2">
                    <div className="text-2xl">{preset.icon}</div>
                    <h3 className="font-medium">{preset.name}</h3>
                    <p className="text-sm text-gray-600">{preset.description}</p>

                    <div className="space-y-1">
                      {preset.benefits.map((benefit, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
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
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium">Chunking Strategy</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>How content will be split into meaningful chunks</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <RadioGroup
            value={chunkingConfig.strategy}
            onValueChange={(value) => handleConfigChange('strategy', value)}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {strategies.map((strategy) => (
              <div key={strategy.value} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={strategy.value} id={strategy.value} />
                  <Label htmlFor={strategy.value} className="font-medium">
                    {strategy.icon} {strategy.name}
                  </Label>
                </div>
                <p className="text-xs text-gray-500 ml-6">{strategy.description}</p>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Size Configuration */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Chunk Size</Label>
              <span className="text-sm text-gray-500">{chunkingConfig.chunk_size} characters</span>
            </div>
            <Slider
              value={[chunkingConfig.chunk_size]}
              onValueChange={([value]) => handleConfigChange('chunk_size', value)}
              max={2048}
              min={128}
              step={64}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>128</span>
              <span>2048</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Overlap</Label>
              <span className="text-sm text-gray-500">{chunkingConfig.chunk_overlap} characters</span>
            </div>
            <Slider
              value={[chunkingConfig.chunk_overlap]}
              onValueChange={([value]) => handleConfigChange('chunk_overlap', value)}
              max={512}
              min={0}
              step={25}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>512</span>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Minimum Chunk Size</Label>
            <Input
              type="number"
              value={chunkingConfig.min_chunk_size}
              onChange={(e) => handleConfigChange('min_chunk_size', parseInt(e.target.value) || 50)}
              min="10"
              max="500"
            />
          </div>

          <div className="space-y-2">
            <Label>Maximum Chunk Size</Label>
            <Input
              type="number"
              value={chunkingConfig.max_chunk_size}
              onChange={(e) => handleConfigChange('max_chunk_size', parseInt(e.target.value) || 2048)}
              min="256"
              max="4096"
            />
          </div>
        </div>

        {/* Additional Options */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Additional Options</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preserve-headings"
                checked={chunkingConfig.preserve_headings}
                onCheckedChange={(checked) => handleConfigChange('preserve_headings', checked)}
              />
              <Label htmlFor="preserve-headings" className="text-sm">
                Preserve document headings and structure
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remove-duplicates"
                checked={chunkingConfig.remove_duplicates}
                onCheckedChange={(checked) => handleConfigChange('remove_duplicates', checked)}
              />
              <Label htmlFor="remove-duplicates" className="text-sm">
                Remove duplicate content across chunks
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="smart-splitting"
                checked={chunkingConfig.smart_splitting}
                onCheckedChange={(checked) => handleConfigChange('smart_splitting', checked)}
              />
              <Label htmlFor="smart-splitting" className="text-sm">
                Enable smart splitting for code and tables
              </Label>
            </div>
          </div>
        </div>

        {/* Estimation and Quality */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">Estimated Results</div>
                <div className="text-sm space-y-1">
                  <div>~{estimatedChunks.toLocaleString()} chunks will be created</div>
                  <div>Quality Score: {qualityScore}/100</div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <Alert>
            <Zap className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">Performance Impact</div>
                <div className="text-sm space-y-1">
                  <div>Search speed: {chunkingConfig.chunk_size < 512 ? 'Fast' : 'Moderate'}</div>
                  <div>Context richness: {chunkingConfig.chunk_size > 512 ? 'High' : 'Moderate'}</div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {/* Reset Button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => handlePresetSelect('balanced')}
          >
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}