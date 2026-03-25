/**
 * Live Chunking Preview Component
 *
 * Allows users to preview how their approved content will be chunked
 * with different strategies and configurations in real-time
 */

import { useState, useEffect, useMemo, useRef } from 'react';
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
import axios from 'axios';
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

interface ChunkingDecision {
  strategy: string;
  chunk_size: number;
  chunk_overlap: number;
  user_preference: boolean;
  adaptive_suggestion: string;
  reasoning: string;
}

interface SourcePreview {
  source_id: string;
  source_name: string;
  chunks: ChunkPreview[];
  metrics: PreviewMetrics;
  original_content?: string;
  chunking_decision?: ChunkingDecision;
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

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

    // Cancel any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const requestId = ++requestIdRef.current;

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
      let chunkingDecision: ChunkingDecision | undefined;

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
              enable_enhanced_metadata: chunkingConfig.enable_enhanced_metadata,
              title: currentDraft.name || 'Combined Sources',
              max_chunks: maxChunks
            },
            signal
          );

          allChunks = response.chunks.map((chunk: any) => ({
            ...chunk,
            source_info: `Combined from ${sourceNames.length} sources`
          }));

          combinedMetrics = response.metrics;
          chunkingDecision = response.chunking_decision;

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
                enable_enhanced_metadata: chunkingConfig.enable_enhanced_metadata,
                title: sourceName,
                max_chunks: maxChunks
              },
              signal
            );

            // Use chunking_decision from last response
            chunkingDecision = response.chunking_decision;

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
        original_content: originalContentForPreview, // Store combined content for no chunking display
        chunking_decision: chunkingDecision
      };

      setPreviews(prev => new Map(prev).set(`combined-${currentStrategy}`, preview));

    } catch (error) {
      // Silently ignore cancelled requests (user switched strategy before completion)
      if (axios.isCancel(error)) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to load preview:', error);
      toast({
        title: "Preview Failed",
        description: "Failed to generate chunking preview",
        variant: "destructive"
      });
    } finally {
      // Only clear loading if this is still the active request
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
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

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

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
      <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
          <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-manrope">
            <Eye className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            Live Chunking Preview
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope text-base leading-relaxed">
            See how your approved content will be chunked with current settings
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:p-6">
          {approvedSources.length === 0 ? (
            <Alert className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-700 dark:text-amber-300 font-manrope">
                No approved content available. Please approve content in the previous step to preview chunking.
              </AlertDescription>
            </Alert>
          ) : (
            // Show combined preview info for all strategies
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 font-manrope">
                    {isNoChunking
                      ? 'Combined Content from All Sources'
                      : 'All Sources Preview'
                    }
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-manrope mt-1">
                    {isNoChunking
                      ? `${approvedSources.length} sources combined into a single document`
                      : `Showing chunks from all ${approvedSources.length} sources (matches final KB structure)`
                    }
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <Badge
                    className={`w-fit font-manrope ${isNoChunking
                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700"
                      : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700"
                    }`}
                  >
                    {isNoChunking ? 'No Chunking - Full Document' : 'Multi-Source Chunking'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadCombinedPreview()}
                    disabled={loading}
                    className="bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-manrope"
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
        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
            <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-manrope">
              <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <span className="truncate">Chunk Preview - {currentPreview.source_name}</span>
            </CardTitle>

            {/* Special Message for No Chunking */}
            {isNoChunking && (
              <Alert className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <AlertDescription className="text-purple-700 dark:text-purple-300 font-manrope">
                  <strong className="font-semibold">Full Content Mode:</strong> Content will be indexed as a single document without chunking.
                  Best for small content (&lt;2000 chars) to maintain complete context.
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            {/* Preview Content */}
            <div className="space-y-4">
              {/* Metrics Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-manrope">
                      {isNoChunking ? 1 : currentPreview.metrics.total_chunks.toLocaleString()}
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-manrope font-medium">
                      {isNoChunking ? 'Document' : 'Total Chunks'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-manrope">
                      {isNoChunking
                        ? (currentPreview.original_content?.length || 0).toLocaleString()
                        : Math.round(currentPreview.metrics.avg_chunk_size).toLocaleString()
                      }
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300 font-manrope font-medium">
                      {isNoChunking ? 'Total Chars' : 'Avg Chunk Size'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                  <CardContent className="p-4 text-center">
                    <div className={cn("text-2xl font-bold font-manrope", getSpeedColor(currentPreview.metrics.retrieval_speed))}>
                      {currentPreview.metrics.retrieval_speed}
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-manrope font-medium">Retrieval Speed</p>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
                  <CardContent className="p-4 text-center">
                    <div className={cn("text-2xl font-bold font-manrope", getQualityColor(currentPreview.metrics.context_quality))}>
                      {currentPreview.metrics.context_quality}
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 font-manrope font-medium">Context Quality</p>
                  </CardContent>
                </Card>
              </div>

              {/* Chunking Decision Info - Shows what adaptive logic was applied */}
              {currentPreview.chunking_decision && !isNoChunking && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-blue-900 dark:text-blue-100 font-manrope">
                          Chunking Decision
                        </span>
                        {currentPreview.chunking_decision.user_preference ? (
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 text-xs font-manrope">
                            User Config
                          </Badge>
                        ) : (
                          <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 text-xs font-manrope">
                            Adaptive
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="p-2 bg-white dark:bg-gray-800/50 rounded-lg border border-blue-100 dark:border-blue-800">
                          <span className="text-gray-500 dark:text-gray-400 font-manrope text-xs">Strategy</span>
                          <div className="font-semibold text-blue-700 dark:text-blue-300 font-manrope">
                            {currentPreview.chunking_decision.strategy}
                          </div>
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-800/50 rounded-lg border border-blue-100 dark:border-blue-800">
                          <span className="text-gray-500 dark:text-gray-400 font-manrope text-xs">Chunk Size</span>
                          <div className="font-semibold text-blue-700 dark:text-blue-300 font-manrope">
                            {currentPreview.chunking_decision.chunk_size} chars
                          </div>
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-800/50 rounded-lg border border-blue-100 dark:border-blue-800">
                          <span className="text-gray-500 dark:text-gray-400 font-manrope text-xs">Overlap</span>
                          <div className="font-semibold text-blue-700 dark:text-blue-300 font-manrope">
                            {currentPreview.chunking_decision.chunk_overlap} chars
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-manrope leading-relaxed">
                        <span className="font-medium">Reasoning:</span> {currentPreview.chunking_decision.reasoning}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Chunk Preview Controls */}
              {!isNoChunking && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-600">
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-manrope font-medium">
                    Showing {chunksShown.toLocaleString()} of {totalChunks.toLocaleString()} chunks
                  </div>
                  {previewLimited && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={showAllChunks}
                      disabled={loading}
                      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Show All {totalChunks.toLocaleString()} Chunks
                    </Button>
                  )}
                </div>
              )}

              {/* Chunks Preview */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-900 dark:text-white font-manrope text-lg">
                    {isNoChunking ? 'Full Content Preview' : 'Chunk Preview'}
                  </h3>
                  <Badge
                    className="w-fit bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 font-manrope"
                    variant="outline"
                  >
                    {isNoChunking ? 'No Chunking' : `${chunkingConfig.strategy} strategy`}
                  </Badge>
                </div>

                <ScrollArea className="h-[400px] bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="space-y-3">
                    {isNoChunking ? (
                      // Show full content for no chunking
                      <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                        <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800/50 dark:to-blue-900/20 rounded-t-xl border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-manrope font-medium">
                              Full Document
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyChunkContent(currentPreview.original_content || '', 'full')}
                              className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                            >
                              {copiedChunk === 'full' ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-manrope">
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
                            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                              <CollapsibleTrigger className="w-full">
                                <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-t-xl border-b border-gray-200 dark:border-gray-700 hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-all duration-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="text-gray-600 dark:text-gray-400">
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </div>
                                      <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-manrope font-medium">
                                        Chunk {chunk.index + 1}
                                      </Badge>
                                      {chunk.source_info && (
                                        <Badge
                                          variant="outline"
                                          className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 font-manrope font-medium"
                                        >
                                          {chunk.source_info}
                                        </Badge>
                                      )}
                                      {chunk.has_overlap && (
                                        <Badge
                                          variant="outline"
                                          className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-600 font-manrope font-medium"
                                        >
                                          Has Overlap
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                                        {chunk.char_count} chars • {chunk.token_count} tokens
                                      </span>
                                      <div
                                        className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer transition-colors text-blue-600 dark:text-blue-400"
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
                                <CardContent className="p-4">
                                  {chunk.overlap_content && (
                                    <Alert className="mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                                      <AlertDescription className="text-xs text-amber-700 dark:text-amber-300 font-manrope">
                                        <strong className="font-semibold">Overlap from previous chunk:</strong>
                                        <p className="mt-1 italic text-amber-600 dark:text-amber-400 leading-relaxed">
                                          {chunk.overlap_content}
                                        </p>
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-manrope">
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
                <Alert className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl shadow-sm">
                  <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <AlertDescription className="text-indigo-900 dark:text-indigo-100">
                    <div className="space-y-3">
                      <p className="font-semibold text-lg text-indigo-900 dark:text-indigo-100 font-manrope">
                        Performance Predictions
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          <span className="text-gray-600 dark:text-gray-400 font-manrope font-medium">Embedding Cost:</span>
                          <div className="font-semibold text-indigo-700 dark:text-indigo-300 font-manrope mt-1">
                            ${currentPreview.metrics.estimated_cost.toFixed(4)}
                          </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          <span className="text-gray-600 dark:text-gray-400 font-manrope font-medium">Search Latency:</span>
                          <div className="font-semibold text-indigo-700 dark:text-indigo-300 font-manrope mt-1">
                            {currentPreview.metrics.retrieval_speed === 'fast' ? '<50ms' :
                             currentPreview.metrics.retrieval_speed === 'moderate' ? '50-150ms' : '>150ms'}
                          </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          <span className="text-gray-600 dark:text-gray-400 font-manrope font-medium">Context Window Usage:</span>
                          <div className="font-semibold text-indigo-700 dark:text-indigo-300 font-manrope mt-1">
                            {isNoChunking
                              ? '100%'
                              : `${Math.round((currentPreview.metrics.avg_chunk_size / chunkingConfig.chunk_size) * 100)}%`
                            }
                          </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          <span className="text-gray-600 dark:text-gray-400 font-manrope font-medium">Overlap Efficiency:</span>
                          <div className="font-semibold text-indigo-700 dark:text-indigo-300 font-manrope mt-1">
                            {isNoChunking ? 'N/A' : `${chunkingConfig.chunk_overlap}/${chunkingConfig.chunk_size} (${Math.round((chunkingConfig.chunk_overlap / chunkingConfig.chunk_size) * 100)}%)`}
                          </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          <span className="text-gray-600 dark:text-gray-400 font-manrope font-medium">Strategy Efficiency:</span>
                          <div className="font-semibold text-indigo-700 dark:text-indigo-300 font-manrope mt-1">
                            {chunkingConfig.strategy === 'adaptive' ? 'Dynamic' :
                             chunkingConfig.strategy === 'hybrid' ? 'Multi-method' :
                             chunkingConfig.strategy === 'custom' ? 'User-defined' :
                             chunkingConfig.strategy === 'recursive' ? 'Structured' : 'Standard'}
                          </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          <span className="text-gray-600 dark:text-gray-400 font-manrope font-medium">Chunk Size Target:</span>
                          <div className="font-semibold text-indigo-700 dark:text-indigo-300 font-manrope mt-1">
                            {isNoChunking ? 'Full content' : `${chunkingConfig.chunk_size} chars`}
                          </div>
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