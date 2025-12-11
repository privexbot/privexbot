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
    },
    {
      id: VectorStoreProvider.FAISS,
      name: 'FAISS',
      description: 'Facebook AI Similarity Search (Coming Soon)',
      icon: '🔶',
      status: 'coming_soon',
      features: [
        'GPU acceleration support',
        'Multiple index types (IVF, HNSW, PQ)',
        'Memory-efficient for large datasets',
        'Fast approximate search'
      ]
    },
    {
      id: VectorStoreProvider.WEAVIATE,
      name: 'Weaviate',
      description: 'Cloud-native vector database (Coming Soon)',
      icon: '🔷',
      status: 'coming_soon',
      features: [
        'GraphQL API',
        'Multi-modal search capabilities',
        'Automatic schema inference',
        'Built-in machine learning'
      ]
    },
    {
      id: VectorStoreProvider.PINECONE,
      name: 'Pinecone',
      description: 'Managed vector database service (Coming Soon)',
      icon: '🔺',
      status: 'coming_soon',
      features: [
        'Fully managed service',
        'Real-time updates',
        'Metadata filtering',
        'High availability'
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Model & Vector Store Configuration
          </CardTitle>
          <CardDescription>
            Configure embedding models and vector database settings for optimal search performance
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Presets */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Choose a Configuration Preset</Label>
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

          <Separator />

          {/* Detailed Configuration */}
          <Tabs defaultValue="vector_store" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="vector_store">Vector Database</TabsTrigger>
              <TabsTrigger value="embedding">Embedding Model</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            {/* Vector Store Configuration */}
            <TabsContent value="vector_store" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base font-medium">Vector Store Provider</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vectorStoreProviders.map((provider) => {
                      const isActive = provider.id === currentConfig.vector_store.provider;
                      const isAvailable = provider.status === 'active';

                      return (
                        <Card
                          key={provider.id}
                          className={`cursor-pointer transition-all ${
                            isActive
                              ? 'ring-2 ring-primary bg-primary/5'
                              : isAvailable
                              ? 'hover:bg-gray-50'
                              : 'opacity-60'
                          }`}
                          onClick={() => isAvailable && handleConfigChange('vector_store', 'provider', provider.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="text-2xl">{provider.icon}</div>
                              <div>
                                <h3 className="font-medium">{provider.name}</h3>
                                <p className="text-sm text-gray-600">{provider.description}</p>
                              </div>
                              {isActive && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                            </div>

                            <div className="space-y-1">
                              {provider.features.map((feature, index) => (
                                <div key={index} className="text-xs text-gray-500 flex items-center gap-1">
                                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                  {feature}
                                </div>
                              ))}
                            </div>

                            {provider.status === 'coming_soon' && (
                              <Badge variant="outline" className="mt-2">Coming Soon</Badge>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Qdrant Specific Configuration */}
                {currentConfig.vector_store.provider === VectorStoreProvider.QDRANT && (
                  <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900">Qdrant Configuration</h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Distance Metric</Label>
                        <RadioGroup
                          value={(currentConfig.vector_store.settings as QdrantConfig).distance_metric}
                          onValueChange={(value) => handleConfigChange('vector_store', 'distance_metric', value)}
                          className="flex flex-col space-y-2"
                        >
                          {distanceMetrics.map((metric) => (
                            <div key={metric.value} className="flex items-center space-x-2">
                              <RadioGroupItem value={metric.value} id={metric.value} />
                              <Label htmlFor={metric.value} className="text-sm">
                                {metric.icon} {metric.name} - {metric.description}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Batch Size</Label>
                          <Slider
                            value={[(currentConfig.vector_store.settings as QdrantConfig).batch_size]}
                            onValueChange={([value]) => handleConfigChange('vector_store', 'batch_size', value)}
                            max={500}
                            min={10}
                            step={10}
                            className="w-full"
                          />
                          <div className="text-xs text-gray-500">
                            Current: {(currentConfig.vector_store.settings as QdrantConfig).batch_size} chunks per batch
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>HNSW M Parameter</Label>
                          <Slider
                            value={[(currentConfig.vector_store.settings as QdrantConfig).hnsw_config.m]}
                            onValueChange={([value]) => handleConfigChange('vector_store', 'hnsw_m', value)}
                            max={64}
                            min={4}
                            step={4}
                            className="w-full"
                          />
                          <div className="text-xs text-gray-500">
                            Current: {(currentConfig.vector_store.settings as QdrantConfig).hnsw_config.m} connections per node
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Embedding Model Configuration */}
            <TabsContent value="embedding" className="space-y-4">
              <div className="space-y-4">
                <Alert>
                  <Cpu className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">Current Embedding Setup</p>
                      <div className="text-sm space-y-1">
                        <div><strong>Provider:</strong> Local (all-MiniLM-L6-v2)</div>
                        <div><strong>Dimensions:</strong> 384</div>
                        <div><strong>Performance:</strong> ~500 embeddings/second</div>
                        <div><strong>Privacy:</strong> Fully local processing</div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Embedding Provider</Label>
                    <Select disabled value="local">
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local (Privacy-focused)</SelectItem>
                        <SelectItem value="openai" disabled>OpenAI (Coming Soon)</SelectItem>
                        <SelectItem value="huggingface" disabled>Hugging Face (Coming Soon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Batch Size</Label>
                    <Slider
                      value={[currentConfig.embedding.batch_size]}
                      onValueChange={([value]) => handleConfigChange('embedding', 'batch_size', value)}
                      max={128}
                      min={8}
                      step={8}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500">
                      Current: {currentConfig.embedding.batch_size} texts per batch
                    </div>
                  </div>
                </div>

              </div>
            </TabsContent>

            {/* Performance Configuration */}
            <TabsContent value="performance" className="space-y-4">
              <div className="space-y-6">
                {/* Processing Quality Configuration */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Processing Quality
                    </Label>
                    <p className="text-sm text-gray-600">
                      Control the trade-off between processing speed and result quality
                    </p>
                  </div>

                  <RadioGroup
                    value={modelConfig?.indexing_method || IndexingMethod.BALANCED}
                    onValueChange={(value) => handleIndexingMethodChange(value as IndexingMethod)}
                    className="grid grid-cols-1 gap-4"
                  >
                    <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-gray-50">
                      <RadioGroupItem value={IndexingMethod.FAST} />
                      <div className="flex-1">
                        <Label htmlFor={IndexingMethod.FAST} className="font-medium cursor-pointer">
                          Fast Processing
                        </Label>
                        <p className="text-sm text-gray-600">
                          Quick processing, lower quality. Good for testing and development.
                        </p>
                        <div className="text-xs text-gray-500 mt-1">
                          Large batches (64), fast parsing, high concurrency
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-gray-50 bg-blue-50 border-blue-200">
                      <RadioGroupItem value={IndexingMethod.BALANCED} />
                      <div className="flex-1">
                        <Label htmlFor={IndexingMethod.BALANCED} className="font-medium cursor-pointer">
                          Balanced Processing <Badge variant="secondary">Recommended</Badge>
                        </Label>
                        <p className="text-sm text-gray-600">
                          Good balance between speed and quality. Ideal for most use cases.
                        </p>
                        <div className="text-xs text-gray-500 mt-1">
                          Medium batches (32), auto parsing, moderate concurrency
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-gray-50">
                      <RadioGroupItem value={IndexingMethod.HIGH_QUALITY} />
                      <div className="flex-1">
                        <Label htmlFor={IndexingMethod.HIGH_QUALITY} className="font-medium cursor-pointer">
                          High Quality Processing
                        </Label>
                        <p className="text-sm text-gray-600">
                          Slower processing, highest quality. Best for production and accuracy.
                        </p>
                        <div className="text-xs text-gray-500 mt-1">
                          Small batches (16), hi-res parsing, careful processing
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

              </div>
            </TabsContent>
          </Tabs>

          {/* Storage Estimate */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Storage Estimation</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Estimated Chunks:</span>
                    <span className="ml-2 font-medium">{storageEstimate.chunks.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Vector Storage:</span>
                    <span className="ml-2 font-medium">{storageEstimate.vectorStorage} MB</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Metadata Storage:</span>
                    <span className="ml-2 font-medium">{storageEstimate.metadataStorage} KB</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Storage:</span>
                    <span className="ml-2 font-medium">{storageEstimate.totalStorage} MB</span>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Reset Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => handlePresetSelect('production')}
            >
              Reset to Production Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}