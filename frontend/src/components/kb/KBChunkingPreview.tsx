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
  AlertCircle,
  Sparkles,
  BarChart3,
  Copy,
  Check
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  source_info?: string;
  original_source_index?: number;
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
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<Map<string, SourcePreview>>(new Map());
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [copiedChunk, setCopiedChunk] = useState<string | null>(null);
  const [previewLimited, setPreviewLimited] = useState<boolean>(false);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [chunksShown, setChunksShown] = useState<number>(0);

  // Get approved sources with content
  const approvedSources = useMemo(() => {
    return (draftSources as any[]).filter((source: any) => {
      const approvedIndices = source.metadata?.approvedPageIndices || [];
      return approvedIndices.length > 0 && source.metadata?.previewPages;
    });
  }, [draftSources]);

  // Load combined preview for ALL approved sources
  const loadCombinedPreview = async (strategy?: ChunkingStrategy, maxChunks?: number) => {
    if (!currentDraft || approvedSources.length === 0) return;

    setLoading(true);
    try {
      const currentStrategy = strategy || chunkingConfig.strategy;
      const isNoChunkingStrategy = currentStrategy === 'no_chunking' || currentStrategy === 'full_content';

      // For ALL strategies, we need to show what the backend will actually create
      // NO_CHUNKING: Combines all sources into one document
      // OTHER STRATEGIES: Creates separate documents per source/page, but preview should show all

      let allChunks: any[] = [];
      let combinedMetrics: PreviewMetrics = {
        total_chunks: 0,
        avg_chunk_size: 0,
        min_chunk_size: Infinity,
        max_chunk_size: 0,
        total_tokens: 0,
        overlap_percentage: 0,
        estimated_cost: 0,
        retrieval_speed: 'fast',
        context_quality: 'high'
      };
      let originalContentForPreview = '';

      if (isNoChunkingStrategy) {
        // For no_chunking, combine ALL sources into single content (matches backend)
        const allApprovedContent: string[] = [];
        const sourceNames: string[] = [];

        for (const source of approvedSources) {
          const approvedIndices = source.metadata?.approvedPageIndices || [];
          const previewPages = source.metadata?.previewPages || [];

          const sourceContent = approvedIndices
            .map((idx: number) => (previewPages as any[])[idx])
            .filter((page: any) => page)
            .map((page: any) => page.edited_content || page.content || '')
            .join('\n\n');

          if (sourceContent) {
            allApprovedContent.push(sourceContent);
            sourceNames.push(source.url ? new URL(source.url).hostname : 'Source');
          }
        }

        const combinedContent = allApprovedContent.join('\n\n');

        if (combinedContent) {
          const response = await kbClient.draft.previewChunks(
            currentDraft.draft_id,
            {
              source_id: 'combined',
              content: combinedContent,
              strategy: currentStrategy,
              chunk_size: chunkingConfig.chunk_size,
              chunk_overlap: chunkingConfig.chunk_overlap,
              include_metrics: true,
              custom_separators: chunkingConfig.custom_separators,
              max_chunks: maxChunks
            }
          );

          allChunks = response.chunks.map((chunk: any) => ({
            ...chunk,
            source_info: `Combined from ${sourceNames.length} sources`
          }));

          combinedMetrics = response.metrics;

          // Update preview limitation state
          setPreviewLimited(response.preview_limited || false);
          setTotalChunks(response.total_chunks || 0);
          setChunksShown(response.chunks_shown || allChunks.length);
        }

        // Store combined content for display in no chunking mode
        originalContentForPreview = combinedContent;
      } else {
        // For other strategies, show chunks from ALL sources (matches backend behavior)
        for (const source of approvedSources) {
          const approvedIndices = source.metadata?.approvedPageIndices || [];
          const previewPages = source.metadata?.previewPages || [];

          const sourceContent = approvedIndices
            .map((idx: number) => (previewPages as any[])[idx])
            .filter((page: any) => page)
            .map((page: any) => page.edited_content || page.content || '')
            .join('\n\n');

          if (sourceContent) {
            const sourceName = source.url ? new URL(source.url).hostname : 'Source';

            const response = await kbClient.draft.previewChunks(
              currentDraft.draft_id,
              {
                source_id: source.source_id,
                content: sourceContent,
                strategy: currentStrategy,
                chunk_size: chunkingConfig.chunk_size,
                chunk_overlap: chunkingConfig.chunk_overlap,
                include_metrics: true,
                custom_separators: chunkingConfig.custom_separators,
                max_chunks: maxChunks
              }
            );

            // Add source info to each chunk and adjust indices
            const sourceChunks = response.chunks.map((chunk: any, index: number) => ({
              ...chunk,
              index: allChunks.length + index, // Global index
              source_info: sourceName,
              original_source_index: index // Original index within source
            }));

            allChunks.push(...sourceChunks);

            // Update combined metrics
            if (response.metrics) {
              combinedMetrics.total_chunks += response.metrics.total_chunks;
              combinedMetrics.total_tokens += response.metrics.total_tokens;
              combinedMetrics.estimated_cost += response.metrics.estimated_cost;
              combinedMetrics.min_chunk_size = Math.min(combinedMetrics.min_chunk_size, response.metrics.min_chunk_size);
              combinedMetrics.max_chunk_size = Math.max(combinedMetrics.max_chunk_size, response.metrics.max_chunk_size);
            }
          }
        }

        // Calculate final combined metrics
        if (allChunks.length > 0) {
          const chunkSizes = allChunks.map(c => c.char_count || 0);
          combinedMetrics.avg_chunk_size = chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length;
          combinedMetrics.min_chunk_size = combinedMetrics.min_chunk_size === Infinity ? 0 : combinedMetrics.min_chunk_size;

          if (allChunks.length < 10) combinedMetrics.retrieval_speed = 'fast';
          else if (allChunks.length < 50) combinedMetrics.retrieval_speed = 'moderate';
          else combinedMetrics.retrieval_speed = 'slow';

          if (combinedMetrics.avg_chunk_size < 300) combinedMetrics.context_quality = 'low';
          else if (combinedMetrics.avg_chunk_size < 800) combinedMetrics.context_quality = 'medium';
          else combinedMetrics.context_quality = 'high';
        }

        // Update preview limitation state (use the last response's metadata as representative)
        setTotalChunks(combinedMetrics.total_chunks);
        setChunksShown(allChunks.length);
        setPreviewLimited(maxChunks ? allChunks.length >= maxChunks : allChunks.length >= 20);
      }

      const preview: SourcePreview = {
        source_id: 'combined',
        source_name: isNoChunkingStrategy
          ? 'Combined Content from All Sources'
          : `All Sources (${approvedSources.length} sources)`,
        chunks: allChunks,
        metrics: combinedMetrics,
        original_content: originalContentForPreview // Store combined content for no chunking display
      };

      setPreviews(prev => new Map(prev).set(`combined-${currentStrategy}`, preview));

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

  // Expand preview to show all chunks
  const showAllChunks = () => {
    loadCombinedPreview(chunkingConfig.strategy, totalChunks);
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

  // Load combined preview when sources or config changes
  useEffect(() => {
    if (approvedSources.length > 0) {
      loadCombinedPreview();
    }
  }, [approvedSources, chunkingConfig]);

  // Special handling for "no chunking" option
  const isNoChunking = chunkingConfig.strategy === 'no_chunking' || chunkingConfig.strategy === 'full_content';

  // Always show combined preview that matches backend behavior
  const currentPreview = previews.get(`combined-${chunkingConfig.strategy}`);

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
            // Show combined preview info for all strategies
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div>
                  <p className="text-sm font-medium">
                    {isNoChunking
                      ? 'Combined Content from All Sources'
                      : 'All Sources Preview'
                    }
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isNoChunking
                      ? `${approvedSources.length} sources combined into a single document`
                      : `Showing chunks from all ${approvedSources.length} sources (matches final KB structure)`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isNoChunking ? "secondary" : "outline"}>
                    {isNoChunking ? 'No Chunking - Full Document' : 'Multi-Source Chunking'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadCombinedPreview()}
                    disabled={loading}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Refresh Preview
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Combined Preview Content */}
      {currentPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Chunk Preview - {currentPreview.source_name}
            </CardTitle>

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
          </CardHeader>

          <CardContent>
            {/* Preview Content */}
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

              {/* Chunk Preview Controls */}
              {!isNoChunking && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {chunksShown} of {totalChunks} chunks
                  </div>
                  {previewLimited && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={showAllChunks}
                      disabled={loading}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Show All {totalChunks} Chunks
                    </Button>
                  )}
                </div>
              )}

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
                        const chunkId = `combined-${idx}`;
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
                                      {chunk.source_info && (
                                        <Badge variant="outline">{chunk.source_info}</Badge>
                                      )}
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
              {currentPreview.metrics && (
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
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}