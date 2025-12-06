/**
 * Live Chunking Preview Component
 *
 * Allows users to preview how their approved content will be chunked
 * with different strategies and configurations in real-time
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
  Sparkles,
  BarChart3,
  Copy,
  Check
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useKBStore } from '@/store/kb-store';
import kbClient from '@/lib/kb-client';
import { ChunkingStrategy } from '@/types/knowledge-base';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ChunkPreview {
  content: string;
  index: number;
  token_count: number;
  char_count: number;
  has_overlap: boolean;
  overlap_content?: string;
}

interface PreviewMetrics {
  total_chunks: number;
  avg_chunk_size: number;
  min_chunk_size: number;
  max_chunk_size: number;
  total_tokens: number;
  overlap_percentage: number;
  estimated_cost: number;
  retrieval_speed: 'fast' | 'moderate' | 'slow';
  context_quality: 'low' | 'medium' | 'high';
}

interface SourcePreview {
  source_id: string;
  source_name: string;
  chunks: ChunkPreview[];
  metrics: PreviewMetrics;
  original_content?: string;
}

export function KBChunkingPreview() {
  const {
    currentDraft,
    draftSources,
    chunkingConfig
  } = useKBStore();

  const { toast } = useToast();
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<Map<string, SourcePreview>>(new Map());
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [copiedChunk, setCopiedChunk] = useState<string | null>(null);

  // Get approved sources with content
  const approvedSources = useMemo(() => {
    return (draftSources as any[]).filter((source: any) => {
      const approvedIndices = source.metadata?.approvedPageIndices || [];
      return approvedIndices.length > 0 && source.metadata?.previewPages;
    });
  }, [draftSources]);

  // Load preview for selected source
  const loadPreview = async (sourceId: string, strategy?: ChunkingStrategy) => {
    if (!currentDraft) return;

    setLoading(true);
    try {
      const source = approvedSources.find(s => s.source_id === sourceId);
      if (!source) return;

      // Get approved pages content
      const approvedIndices = source.metadata?.approvedPageIndices || [];
      const previewPages = source.metadata?.previewPages || [];

      const approvedContent = approvedIndices
        .map((idx: number) => (previewPages as any[])[idx])
        .filter((page: any) => page)
        .map((page: any) => page.edited_content || page.content || '')
        .join('\n\n');

      if (!approvedContent) {
        toast({
          title: "No Content",
          description: "No approved content found for this source",
          variant: "destructive"
        });
        return;
      }

      // Call backend preview endpoint
      const response = await kbClient.draft.previewChunks(
        currentDraft.draft_id,
        {
          source_id: sourceId,
          content: approvedContent,
          strategy: strategy || chunkingConfig.strategy,
          chunk_size: chunkingConfig.chunk_size,
          chunk_overlap: chunkingConfig.chunk_overlap,
          include_metrics: true,
          custom_separators: chunkingConfig.custom_separators
        }
      );

      const preview: SourcePreview = {
        source_id: sourceId,
        source_name: source.url || source.metadata?.title || 'Unknown Source',
        chunks: response.chunks,
        metrics: response.metrics,
        original_content: approvedContent
      };

      setPreviews(prev => new Map(prev).set(`${sourceId}-${strategy || chunkingConfig.strategy}`, preview));

    } catch (error) {
      console.error('Failed to load preview:', error);
      toast({
        title: "Preview Failed",
        description: "Failed to generate chunking preview",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle chunk expansion
  const toggleChunkExpansion = (chunkId: string) => {
    setExpandedChunks(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  // Copy chunk content
  const copyChunkContent = async (content: string, chunkId: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedChunk(chunkId);
    setTimeout(() => setCopiedChunk(null), 2000);
  };

  // Get quality indicator color
  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get speed indicator color
  const getSpeedColor = (speed: string) => {
    switch (speed) {
      case 'fast': return 'text-green-600';
      case 'moderate': return 'text-yellow-600';
      case 'slow': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Auto-select first source
  useEffect(() => {
    if (approvedSources.length > 0 && !selectedSource) {
      setSelectedSource(approvedSources[0].source_id);
    }
  }, [approvedSources, selectedSource]);

  // Load preview when source or config changes
  useEffect(() => {
    if (selectedSource) {
      loadPreview(selectedSource);
    }
  }, [selectedSource, chunkingConfig]);

  const currentPreview = selectedSource
    ? previews.get(`${selectedSource}-${chunkingConfig.strategy}`)
    : null;

  // Special handling for "no chunking" option
  const isNoChunking = chunkingConfig.strategy === 'no_chunking';

  return (
    <div className="space-y-6">
      {/* Source Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Live Chunking Preview
          </CardTitle>
          <CardDescription>
            See how your approved content will be chunked with current settings
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {approvedSources.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No approved content available. Please approve content in the previous step to preview chunking.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Source Tabs */}
              <Tabs value={selectedSource} onValueChange={setSelectedSource}>
                <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Math.min(approvedSources.length, 3)}, 1fr)` }}>
                  {approvedSources.map(source => (
                    <TabsTrigger key={source.source_id} value={source.source_id}>
                      <FileText className="h-4 w-4 mr-2" />
                      {source.url ? new URL(source.url).hostname : 'Source'}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {approvedSources.map(source => (
                  <TabsContent key={source.source_id} value={source.source_id} className="space-y-4">
                    {/* Source Info */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{source.url || 'Unknown Source'}</p>
                        <p className="text-xs text-gray-500">
                          {(source as any).metadata?.approvedPageIndices?.length || 0} approved pages
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadPreview(source.source_id)}
                        disabled={loading}
                      >
                        {loading ? 'Loading...' : 'Refresh Preview'}
                      </Button>
                    </div>

                    {/* Special Message for No Chunking */}
                    {isNoChunking && (
                      <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Full Content Mode:</strong> Content will be indexed as a single document without chunking.
                          Best for small content (&lt;2000 chars) to maintain complete context.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Preview Content */}
                    {currentPreview && currentPreview.source_id === source.source_id && (
                      <div className="space-y-4">
                        {/* Metrics Overview */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card>
                            <CardContent className="p-4">
                              <div className="text-2xl font-bold">
                                {isNoChunking ? 1 : currentPreview.metrics.total_chunks}
                              </div>
                              <p className="text-xs text-gray-500">
                                {isNoChunking ? 'Document' : 'Total Chunks'}
                              </p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-4">
                              <div className="text-2xl font-bold">
                                {isNoChunking
                                  ? currentPreview.original_content?.length || 0
                                  : Math.round(currentPreview.metrics.avg_chunk_size)
                                }
                              </div>
                              <p className="text-xs text-gray-500">
                                {isNoChunking ? 'Total Chars' : 'Avg Chunk Size'}
                              </p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-4">
                              <div className={cn("text-2xl font-bold", getSpeedColor(currentPreview.metrics.retrieval_speed))}>
                                {currentPreview.metrics.retrieval_speed}
                              </div>
                              <p className="text-xs text-gray-500">Retrieval Speed</p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-4">
                              <div className={cn("text-2xl font-bold", getQualityColor(currentPreview.metrics.context_quality))}>
                                {currentPreview.metrics.context_quality}
                              </div>
                              <p className="text-xs text-gray-500">Context Quality</p>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Chunks Preview */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">
                              {isNoChunking ? 'Full Content Preview' : 'Chunk Preview'}
                            </h3>
                            <Badge variant="secondary">
                              {isNoChunking ? 'No Chunking' : `${chunkingConfig.strategy} strategy`}
                            </Badge>
                          </div>

                          <ScrollArea className="h-[400px] border rounded-lg p-4">
                            <div className="space-y-3">
                              {isNoChunking ? (
                                // Show full content for no chunking
                                <Card>
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                      <Badge>Full Document</Badge>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyChunkContent(currentPreview.original_content || '', 'full')}
                                      >
                                        {copiedChunk === 'full' ? (
                                          <Check className="h-3 w-3" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    <p className="text-sm whitespace-pre-wrap">
                                      {currentPreview.original_content}
                                    </p>
                                  </CardContent>
                                </Card>
                              ) : (
                                // Show chunks for chunking strategies
                                currentPreview.chunks.map((chunk, idx) => {
                                  const chunkId = `${source.source_id}-${idx}`;
                                  const isExpanded = expandedChunks.has(chunkId);

                                  return (
                                    <Collapsible
                                      key={idx}
                                      open={isExpanded}
                                      onOpenChange={() => toggleChunkExpansion(chunkId)}
                                    >
                                      <Card>
                                        <CollapsibleTrigger className="w-full">
                                          <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                {isExpanded ? (
                                                  <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4" />
                                                )}
                                                <Badge>Chunk {chunk.index + 1}</Badge>
                                                {chunk.has_overlap && (
                                                  <Badge variant="outline">Has Overlap</Badge>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">
                                                  {chunk.char_count} chars • {chunk.token_count} tokens
                                                </span>
                                                <div
                                                  className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-100 cursor-pointer transition-colors"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyChunkContent(chunk.content, chunkId);
                                                  }}
                                                >
                                                  {copiedChunk === chunkId ? (
                                                    <Check className="h-3 w-3" />
                                                  ) : (
                                                    <Copy className="h-3 w-3" />
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </CardHeader>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                          <CardContent>
                                            {chunk.overlap_content && (
                                              <Alert className="mb-3">
                                                <AlertDescription className="text-xs">
                                                  <strong>Overlap from previous chunk:</strong>
                                                  <p className="mt-1 italic text-gray-600">
                                                    {chunk.overlap_content}
                                                  </p>
                                                </AlertDescription>
                                              </Alert>
                                            )}
                                            <p className="text-sm whitespace-pre-wrap">
                                              {chunk.content}
                                            </p>
                                          </CardContent>
                                        </CollapsibleContent>
                                      </Card>
                                    </Collapsible>
                                  );
                                })
                              )}
                            </div>
                          </ScrollArea>
                        </div>

                        {/* Performance Predictions */}
                        <Alert>
                          <BarChart3 className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-2">
                              <p className="font-medium">Performance Predictions</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-500">Embedding Cost:</span>
                                  <span className="ml-2 font-medium">
                                    ${currentPreview.metrics.estimated_cost.toFixed(4)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Search Latency:</span>
                                  <span className="ml-2 font-medium">
                                    {currentPreview.metrics.retrieval_speed === 'fast' ? '<50ms' :
                                     currentPreview.metrics.retrieval_speed === 'moderate' ? '50-150ms' : '>150ms'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Context Window Usage:</span>
                                  <span className="ml-2 font-medium">
                                    {isNoChunking
                                      ? '100%'
                                      : `${Math.round((currentPreview.metrics.avg_chunk_size / chunkingConfig.chunk_size) * 100)}%`
                                    }
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Overlap Efficiency:</span>
                                  <span className="ml-2 font-medium">
                                    {isNoChunking ? 'N/A' : `${chunkingConfig.chunk_overlap}/${chunkingConfig.chunk_size} (${Math.round((chunkingConfig.chunk_overlap / chunkingConfig.chunk_size) * 100)}%)`}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Strategy Efficiency:</span>
                                  <span className="ml-2 font-medium">
                                    {chunkingConfig.strategy === 'adaptive' ? 'Dynamic' :
                                     chunkingConfig.strategy === 'hybrid' ? 'Multi-method' :
                                     chunkingConfig.strategy === 'custom' ? 'User-defined' :
                                     chunkingConfig.strategy === 'recursive' ? 'Structured' : 'Standard'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Chunk Size Target:</span>
                                  <span className="ml-2 font-medium">
                                    {isNoChunking ? 'Full content' : `${chunkingConfig.chunk_size} chars`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}