/**
 * Model & Vector Store Configuration Component
 *
 * Configure embedding models and vector database settings for optimal retrieval
 */

import { useState } from 'react';
import { Database, Cpu, Zap, Info, Settings, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useKBStore } from '@/store/kb-store';
import {
  VectorStoreProvider,
  DistanceMetric,
  IndexType,
  ModelConfig,
  QdrantConfig,
  HNSWConfig,
  ChunkingStrategy,
  IndexingMethod
} from '@/types/knowledge-base';

export function KBModelConfig() {
  const { modelConfig, updateModelConfig, draftSources, chunkingConfig } = useKBStore();
  const [activePreset, setActivePreset] = useState('production');

  // Default Qdrant configuration
  const defaultQdrantConfig: QdrantConfig = {
    collection_naming: 'kb_{kb_id}',
    distance_metric: DistanceMetric.COSINE,
    index_type: IndexType.HNSW,
    vector_size: 384,
    hnsw_config: {
      m: 16,
      ef_construct: 100,
    },
    batch_size: 100,
    indexing_threshold: 10000
  };

  const defaultModelConfig: ModelConfig = {
    embedding: {
      provider: 'local',
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      batch_size: 32
    },
    vector_store: {
      provider: VectorStoreProvider.QDRANT,
      settings: defaultQdrantConfig
    },
    indexing_method: IndexingMethod.BALANCED
  };

  const currentConfig = modelConfig || defaultModelConfig;

  const presets = [
    {
      id: 'development',
      name: 'Development',
      description: 'Fast indexing, basic performance',
      icon: '🚀',
      config: {
        ...defaultModelConfig,
        vector_store: {
          ...defaultModelConfig.vector_store,
          settings: {
            ...defaultQdrantConfig,
            batch_size: 50,
            indexing_threshold: 1000,
            hnsw_config: {
              m: 8,
              ef_construct: 50
            }
          }
        },
        indexing_method: IndexingMethod.FAST
      },
      benefits: ['Fast setup', 'Quick testing'],
      tradeoffs: ['Lower search quality']
    },
    {
      id: 'production',
      name: 'Production',
      description: 'Balanced performance and quality',
      icon: '⚖️',
      config: defaultModelConfig,
      benefits: ['Optimal balance', 'Proven settings'],
      tradeoffs: ['Standard performance']
    },
    {
      id: 'high_performance',
      name: 'High Performance',
      description: 'Maximum search quality and speed',
      icon: '🏆',
      config: {
        ...defaultModelConfig,
        vector_store: {
          ...defaultModelConfig.vector_store,
          settings: {
            ...defaultQdrantConfig,
            batch_size: 200,
            indexing_threshold: 50000,
            hnsw_config: {
              m: 32,
              ef_construct: 200
            }
          }
        },
        indexing_method: IndexingMethod.HIGH_QUALITY
      },
      benefits: ['Highest quality', 'Fastest search'],
      tradeoffs: ['Higher memory usage', 'Slower indexing']
    }
  ];

  const vectorStoreProviders = [
    {
      id: VectorStoreProvider.QDRANT,
      name: 'Qdrant',
      description: 'Self-hosted, high-performance vector database',
      icon: '🔵',
      status: 'active',
      features: [
        'HNSW indexing for fast similarity search',
        'Creates one collection per KB: kb_{kb_id}',
        'Cosine distance metric by default',
        'Batch upsert capability (100 chunks at a time)',
        'Stores content and metadata in payload'
      ]
    }
  ];

  const distanceMetrics = [
    {
      value: DistanceMetric.COSINE,
      name: 'Cosine',
      description: 'Best for text embeddings (default)',
      icon: '📐'
    },
    {
      value: DistanceMetric.EUCLIDEAN,
      name: 'Euclidean',
      description: 'Good for normalized vectors',
      icon: '📏'
    },
    {
      value: DistanceMetric.DOT_PRODUCT,
      name: 'Dot Product',
      description: 'Fast computation, normalized vectors',
      icon: '⚡'
    }
  ];

  const handlePresetSelect = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setActivePreset(presetId);
      updateModelConfig(preset.config);
    }
  };

  const handleConfigChange = (section: string, field: string, value: any) => {
    const newConfig = { ...currentConfig };

    if (section === 'embedding') {
      newConfig.embedding = { ...newConfig.embedding, [field]: value };
    } else if (section === 'vector_store') {
      const settings = newConfig.vector_store.settings as QdrantConfig;
      if (field.startsWith('hnsw_')) {
        const hnswField = field.replace('hnsw_', '');
        newConfig.vector_store = {
          ...newConfig.vector_store,
          settings: {
            ...settings,
            hnsw_config: { ...settings.hnsw_config, [hnswField]: value }
          }
        };
      } else {
        newConfig.vector_store = {
          ...newConfig.vector_store,
          settings: { ...settings, [field]: value }
        };
      }
    }

    updateModelConfig(newConfig);
    setActivePreset('custom');
  };

  const handleIndexingMethodChange = (indexingMethod: IndexingMethod) => {
    // Update the model config with the new indexing method
    const updatedConfig = {
      ...modelConfig,
      indexing_method: indexingMethod,
    };
    updateModelConfig(updatedConfig);
    setActivePreset('custom');
  };

  const getStorageEstimate = () => {
    if (!chunkingConfig || draftSources.length === 0) {
      return {
        chunks: 0,
        vectorStorage: 0,
        metadataStorage: 0,
        totalStorage: 0
      };
    }

    // For NO_CHUNKING strategy, each source becomes one chunk
    if (chunkingConfig.strategy === ChunkingStrategy.NO_CHUNKING) {
      const chunks = draftSources.length;
      const vectorSize = currentConfig.embedding.dimensions;
      const vectorStorage = chunks * vectorSize * 4; // 4 bytes per float
      const avgMetadataPerChunk = 150; // Estimated metadata per chunk (source info, etc.)
      const metadataStorage = chunks * avgMetadataPerChunk;

      return {
        chunks,
        vectorStorage: Math.round(vectorStorage / 1024 / 1024 * 100) / 100, // MB
        metadataStorage: Math.round(metadataStorage / 1024 * 100) / 100, // KB
        totalStorage: Math.round((vectorStorage + metadataStorage) / 1024 / 1024 * 100) / 100 // MB
      };
    }

    // Calculate actual content from preview pages
    let totalContent = 0;
    draftSources.forEach(source => {
      const pages = (source as any).metadata?.previewPages || [];
      if (pages.length > 0) {
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

    if (totalContent === 0) {
      return {
        chunks: 0,
        vectorStorage: 0,
        metadataStorage: 0,
        totalStorage: 0
      };
    }

    // Use actual chunking configuration for calculation
    const effectiveChunkSize = chunkingConfig.chunk_size - chunkingConfig.chunk_overlap;
    const chunks = Math.max(1, Math.ceil(totalContent / effectiveChunkSize));

    const vectorSize = currentConfig.embedding.dimensions;
    const vectorStorage = chunks * vectorSize * 4; // 4 bytes per float

    // Calculate metadata storage based on actual chunk count and content
    const avgMetadataPerChunk = 120 + Math.min(200, totalContent / chunks * 0.1); // Base metadata + proportional to content
    const metadataStorage = chunks * avgMetadataPerChunk;

    return {
      chunks,
      vectorStorage: Math.round(vectorStorage / 1024 / 1024 * 100) / 100, // MB
      metadataStorage: Math.round(metadataStorage / 1024 * 100) / 100, // KB
      totalStorage: Math.round((vectorStorage + metadataStorage) / 1024 / 1024 * 100) / 100 // MB
    };
  };

  const storageEstimate = getStorageEstimate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
          <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-manrope">
            <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            Model & Vector Store Configuration
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope text-base leading-relaxed">
            Configure embedding models and vector database settings for optimal search performance
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 p-4 sm:p-6">
          {/* Presets */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-semibold text-gray-900 dark:text-white font-manrope">Choose a Configuration Preset</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                Select a pre-configured setup optimized for different use cases
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {presets.map((preset) => (
                <Card
                  key={preset.id}
                  className={`cursor-pointer transition-all duration-300 border rounded-xl shadow-sm hover:shadow-md transform hover:scale-[1.02] ${
                    activePreset === preset.id
                      ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                      : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  onClick={() => handlePresetSelect(preset.id)}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="text-center space-y-3">
                      <span className="text-2xl sm:text-3xl">{preset.icon}</span>
                      <div className="space-y-2">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white font-manrope">{preset.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">{preset.description}</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          {preset.benefits.map((benefit, index) => (
                            <Badge key={index} className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 font-manrope font-medium">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                        {preset.tradeoffs && preset.tradeoffs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            {preset.tradeoffs.map((tradeoff, index) => (
                              <Badge key={index} variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-600 font-manrope font-medium">
                                {tradeoff}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          {/* Detailed Configuration */}
          <Tabs defaultValue="vector_store" className="space-y-6">
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-1">
              <TabsList className="grid w-full grid-cols-3 bg-transparent gap-1">
                <TabsTrigger
                  value="vector_store"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm border-0 rounded-lg font-manrope font-medium transition-all duration-200"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Vector Database
                </TabsTrigger>
                <TabsTrigger
                  value="embedding"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm border-0 rounded-lg font-manrope font-medium transition-all duration-200"
                >
                  <Cpu className="h-4 w-4 mr-2" />
                  Embedding Model
                </TabsTrigger>
                <TabsTrigger
                  value="performance"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm border-0 rounded-lg font-manrope font-medium transition-all duration-200"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Performance
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Vector Store Configuration */}
            <TabsContent value="vector_store" className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-lg font-semibold text-gray-900 dark:text-white font-manrope">Vector Store Provider</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                      Select the vector database that will store and search your embeddings
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 max-w-2xl">
                    {vectorStoreProviders.map((provider) => {
                      const isActive = provider.id === currentConfig.vector_store.provider;
                      const isAvailable = provider.status === 'active';

                      return (
                        <Card
                          key={provider.id}
                          className={`cursor-pointer transition-all duration-300 border rounded-xl shadow-sm hover:shadow-md ${
                            !isAvailable ? 'opacity-60 cursor-not-allowed' : ''
                          } ${
                            isActive
                              ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                              : isAvailable
                              ? 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              : 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700'
                          }`}
                          onClick={() => isAvailable && handleConfigChange('vector_store', 'provider', provider.id)}
                        >
                          <CardContent className="p-4 sm:p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="text-xl flex-shrink-0">{provider.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-lg text-gray-900 dark:text-white font-manrope">{provider.name}</h3>
                                  {isActive && <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">{provider.description}</p>
                              </div>
                            </div>

                            <div className="space-y-2 mb-4">
                              {provider.features.map((feature, index) => (
                                <div key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 font-manrope">
                                  <div className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full flex-shrink-0"></div>
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>

                            {provider.status === 'coming_soon' && (
                              <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-manrope font-medium">
                                Coming Soon
                              </Badge>
                            )}
                            {isActive && (
                              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 font-manrope font-medium">
                                Active
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Qdrant Specific Configuration */}
                {currentConfig.vector_store.provider === VectorStoreProvider.QDRANT && (
                  <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700 rounded-xl shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-lg font-bold text-blue-900 dark:text-blue-100 font-manrope">
                        <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        Qdrant Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <Label className="text-base font-semibold text-blue-900 dark:text-blue-100 font-manrope">Distance Metric</Label>
                            <RadioGroup
                              value={(currentConfig.vector_store.settings as QdrantConfig).distance_metric}
                              onValueChange={(value) => handleConfigChange('vector_store', 'distance_metric', value)}
                              className="space-y-3"
                            >
                              {distanceMetrics.map((metric) => (
                                <div key={metric.value} className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800/50 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                  <RadioGroupItem value={metric.value} id={metric.value} />
                                  <Label htmlFor={metric.value} className="text-sm font-manrope cursor-pointer flex-1">
                                    <span className="text-lg mr-2">{metric.icon}</span>
                                    <span className="font-semibold text-blue-900 dark:text-blue-100">{metric.name}</span>
                                    <span className="text-blue-700 dark:text-blue-300"> - {metric.description}</span>
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="bg-white dark:bg-gray-800/50 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
                            <div className="space-y-4">
                              <Label className="text-base font-semibold text-blue-900 dark:text-blue-100 font-manrope">Batch Size</Label>
                              <Slider
                                value={[(currentConfig.vector_store.settings as QdrantConfig).batch_size]}
                                onValueChange={([value]) => handleConfigChange('vector_store', 'batch_size', value)}
                                max={500}
                                min={10}
                                step={10}
                                className="w-full"
                              />
                              <div className="flex justify-between text-sm text-blue-700 dark:text-blue-300 font-manrope">
                                <span>Current: <strong>{(currentConfig.vector_store.settings as QdrantConfig).batch_size}</strong> chunks per batch</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-gray-800/50 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Label className="text-base font-semibold text-blue-900 dark:text-blue-100 font-manrope">HNSW M Parameter</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-sm">Higher values = better search quality, more memory usage</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Slider
                                value={[(currentConfig.vector_store.settings as QdrantConfig).hnsw_config.m]}
                                onValueChange={([value]) => handleConfigChange('vector_store', 'hnsw_m', value)}
                                max={64}
                                min={4}
                                step={4}
                                className="w-full"
                              />
                              <div className="flex justify-between text-sm text-blue-700 dark:text-blue-300 font-manrope">
                                <span>Current: <strong>{(currentConfig.vector_store.settings as QdrantConfig).hnsw_config.m}</strong> connections per node</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Embedding Model Configuration */}
            <TabsContent value="embedding" className="space-y-6">
              <div className="space-y-6">
                <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl shadow-sm">
                  <Cpu className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-900 dark:text-green-100">
                    <div className="space-y-3">
                      <p className="font-semibold text-lg text-green-900 dark:text-green-100 font-manrope">Current Embedding Setup</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-green-100 dark:border-green-800">
                            <div className="text-sm font-manrope">
                              <span className="text-green-700 dark:text-green-300 font-medium">Provider:</span>
                              <div className="font-semibold text-green-800 dark:text-green-200 mt-1">Local (all-MiniLM-L6-v2)</div>
                            </div>
                          </div>
                          <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-green-100 dark:border-green-800">
                            <div className="text-sm font-manrope">
                              <span className="text-green-700 dark:text-green-300 font-medium">Dimensions:</span>
                              <div className="font-semibold text-green-800 dark:text-green-200 mt-1">384</div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-green-100 dark:border-green-800">
                            <div className="text-sm font-manrope">
                              <span className="text-green-700 dark:text-green-300 font-medium">Performance:</span>
                              <div className="font-semibold text-green-800 dark:text-green-200 mt-1">~500 embeddings/second</div>
                            </div>
                          </div>
                          <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-green-100 dark:border-green-800">
                            <div className="text-sm font-manrope">
                              <span className="text-green-700 dark:text-green-300 font-medium">Privacy:</span>
                              <div className="font-semibold text-green-800 dark:text-green-200 mt-1">Fully local processing</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-gray-900 dark:text-white font-manrope">
                        Embedding Provider
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Select disabled value="local">
                        <SelectTrigger className="bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 rounded-lg font-manrope">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                          <SelectItem value="local" className="font-manrope">
                            <div className="flex items-center gap-2">
                              <span className="text-green-600 dark:text-green-400">🔒</span>
                              Local (Privacy-focused)
                            </div>
                          </SelectItem>
                          <SelectItem value="openai" disabled className="font-manrope opacity-50">
                            <div className="flex items-center gap-2">
                              <span>🔮</span>
                              OpenAI (Coming Soon)
                            </div>
                          </SelectItem>
                          <SelectItem value="huggingface" disabled className="font-manrope opacity-50">
                            <div className="flex items-center gap-2">
                              <span>🤗</span>
                              Hugging Face (Coming Soon)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                        Local processing ensures your data never leaves your infrastructure
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-gray-900 dark:text-white font-manrope">
                        Batch Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <Label className="text-base font-semibold text-gray-900 dark:text-white font-manrope">Batch Size</Label>
                        <Slider
                          value={[currentConfig.embedding.batch_size]}
                          onValueChange={([value]) => handleConfigChange('embedding', 'batch_size', value)}
                          max={128}
                          min={8}
                          step={8}
                          className="w-full"
                        />
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 font-manrope">
                          <span>Current: <strong>{currentConfig.embedding.batch_size}</strong> texts per batch</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                            Higher batch sizes process more texts at once but use more memory
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Performance Configuration */}
            <TabsContent value="performance" className="space-y-6">
              <div className="space-y-6">
                {/* Processing Quality Configuration */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-lg font-semibold flex items-center gap-3 text-gray-900 dark:text-white font-manrope">
                      <Zap className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                      Processing Quality
                    </Label>
                    <p className="text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                      Control the trade-off between processing speed and result quality
                    </p>
                  </div>

                  <RadioGroup
                    value={modelConfig?.indexing_method || IndexingMethod.BALANCED}
                    onValueChange={(value) => handleIndexingMethodChange(value as IndexingMethod)}
                    className="space-y-4"
                  >
                    <Card className={`cursor-pointer transition-all duration-300 border rounded-xl shadow-sm hover:shadow-md ${
                      (modelConfig?.indexing_method || IndexingMethod.BALANCED) === IndexingMethod.FAST
                        ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}>
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center space-x-4">
                          <RadioGroupItem value={IndexingMethod.FAST} />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg flex-shrink-0">🚀</span>
                              <Label htmlFor={IndexingMethod.FAST} className="text-lg font-bold cursor-pointer text-gray-900 dark:text-white font-manrope">
                                Fast Processing
                              </Label>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                              Quick processing, lower quality. Good for testing and development.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 font-manrope font-medium">
                                Large batches (64)
                              </Badge>
                              <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-manrope font-medium">
                                Fast parsing
                              </Badge>
                              <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 font-manrope font-medium">
                                High concurrency
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={`cursor-pointer transition-all duration-300 border rounded-xl shadow-sm hover:shadow-md ${
                      (modelConfig?.indexing_method || IndexingMethod.BALANCED) === IndexingMethod.BALANCED
                        ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}>
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center space-x-4">
                          <RadioGroupItem value={IndexingMethod.BALANCED} />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg flex-shrink-0">⚖️</span>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={IndexingMethod.BALANCED} className="text-lg font-bold cursor-pointer text-gray-900 dark:text-white font-manrope">
                                  Balanced Processing
                                </Label>
                                <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-manrope font-medium">
                                  Recommended
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                              Good balance between speed and quality. Ideal for most use cases.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700 font-manrope font-medium">
                                Medium batches (32)
                              </Badge>
                              <Badge className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 font-manrope font-medium">
                                Auto parsing
                              </Badge>
                              <Badge className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700 font-manrope font-medium">
                                Moderate concurrency
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={`cursor-pointer transition-all duration-300 border rounded-xl shadow-sm hover:shadow-md ${
                      (modelConfig?.indexing_method || IndexingMethod.BALANCED) === IndexingMethod.HIGH_QUALITY
                        ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}>
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center space-x-4">
                          <RadioGroupItem value={IndexingMethod.HIGH_QUALITY} />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg flex-shrink-0">🏆</span>
                              <Label htmlFor={IndexingMethod.HIGH_QUALITY} className="text-lg font-bold cursor-pointer text-gray-900 dark:text-white font-manrope">
                                High Quality Processing
                              </Label>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                              Slower processing, highest quality. Best for production and accuracy.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 font-manrope font-medium">
                                Small batches (16)
                              </Badge>
                              <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-manrope font-medium">
                                Hi-res parsing
                              </Badge>
                              <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 font-manrope font-medium">
                                Careful processing
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </RadioGroup>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Storage Estimate */}
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg font-bold text-indigo-900 dark:text-indigo-100 font-manrope">
                <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                Storage Estimation
              </CardTitle>
              <p className="text-sm text-indigo-700 dark:text-indigo-300 font-manrope">
                Estimated storage requirements based on your current configuration
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800/50 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-manrope mb-1">
                    {storageEstimate.chunks.toLocaleString()}
                  </div>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 font-manrope font-medium">
                    Estimated Chunks
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800/50 border border-blue-100 dark:border-blue-800 rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-manrope mb-1">
                    {storageEstimate.vectorStorage}
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-manrope font-medium">
                    Vector Storage (MB)
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800/50 border border-green-100 dark:border-green-800 rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-manrope mb-1">
                    {storageEstimate.metadataStorage}
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 font-manrope font-medium">
                    Metadata Storage (KB)
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800/50 border border-purple-100 dark:border-purple-800 rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-manrope mb-1">
                    {storageEstimate.totalStorage}
                  </div>
                  <p className="text-sm text-purple-700 dark:text-purple-300 font-manrope font-medium">
                    Total Storage (MB)
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800/50 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4">
                <div className="text-sm text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
                  <p className="font-semibold mb-2">💡 Storage Notes:</p>
                  <ul className="space-y-1 list-none">
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-500 dark:text-indigo-400">•</span>
                      Estimates based on {currentConfig.embedding.dimensions}-dimensional embeddings
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-500 dark:text-indigo-400">•</span>
                      Vector storage scales with chunk count and embedding dimensions
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-500 dark:text-indigo-400">•</span>
                      Metadata includes source information, timestamps, and content references
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reset Button */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
              Need to start over? Reset all settings to production defaults
            </div>
            <Button
              variant="outline"
              onClick={() => handlePresetSelect('production')}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope font-medium shadow-sm transition-all duration-200"
            >
              <Settings className="h-4 w-4 mr-2" />
              Reset to Production Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}