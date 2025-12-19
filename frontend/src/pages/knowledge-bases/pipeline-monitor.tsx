/**
 * Pipeline Monitoring Page
 *
 * Phase 3: Real-time monitoring of KB processing pipeline
 * Shows progress of scraping, chunking, embedding, and indexing
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useKBStore } from '@/store/kb-store';
import kbClient from '@/lib/kb-client';
import type { KnowledgeBase } from '@/types/knowledge-base';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Database,
  FileSearch,
  Brain,
  Cpu,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PipelineStatusResponse } from '@/types/knowledge-base';

const STAGE_ICONS = {
  scraping: FileSearch,
  parsing: Clock,
  chunking: Database,
  embedding: Brain,
  indexing: Cpu,
};

const STAGE_DESCRIPTIONS = {
  scraping: 'Extracting content from web sources',
  parsing: 'Processing and cleaning content',
  chunking: 'Splitting content into searchable chunks',
  embedding: 'Generating AI embeddings',
  indexing: 'Storing in vector database',
};

export default function PipelineMonitorPage() {
  const { kbId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pipelineId = searchParams.get('pipeline');

  const {
    activePipelines,
    startPipelinePolling,
    stopPipelinePolling,
    fetchPipelineStatus,
  } = useKBStore();

  const [isPolling, setIsPolling] = useState(false);
  const [errorRetryCount, setErrorRetryCount] = useState(0);
  const [kbDetails, setKbDetails] = useState<KnowledgeBase | null>(null);
  const [retryStatus, setRetryStatus] = useState<{
    can_retry: boolean;
    reason: string;
    kb_status: string;
    pipeline_status: string | null;
    pipeline_age_seconds: number | null;
    is_stale: boolean;
    stale_threshold_seconds: number;
    retry_available_in_seconds: number | null;
  } | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const currentStatus = pipelineId ? activePipelines[pipelineId] : null;

  useEffect(() => {
    if (!kbId || !pipelineId) {
      navigate('/knowledge-bases');
      return;
    }

    // Fetch KB details to check actual KB status
    const fetchKbDetails = async () => {
      try {
        const kb = await kbClient.kb.get(kbId);
        setKbDetails(kb);
      } catch (error) {
        console.error('Failed to fetch KB details:', error);
      }
    };

    // Fetch retry status to check if KB can be retried (handles stale queued pipelines)
    const fetchRetryStatus = async () => {
      try {
        const status = await kbClient.kb.getRetryStatus(kbId);
        setRetryStatus(status);
      } catch (error) {
        console.error('Failed to fetch retry status:', error);
      }
    };

    fetchKbDetails();
    fetchRetryStatus();

    // Poll retry status every 10 seconds to detect stale pipelines
    const retryStatusInterval = setInterval(fetchRetryStatus, 10000);

    // Start polling for pipeline status
    setIsPolling(true);
    startPipelinePolling(pipelineId, (status) => {
      if (status.status === 'completed' || status.status === 'failed') {
        setIsPolling(false);
        stopPipelinePolling(pipelineId);
        // Refresh KB details and retry status when pipeline completes/fails
        fetchKbDetails();
        fetchRetryStatus();
      }
    });

    // Cleanup on unmount
    return () => {
      clearInterval(retryStatusInterval);
      if (pipelineId) {
        stopPipelinePolling(pipelineId);
      }
    };
  }, [kbId, pipelineId, startPipelinePolling, stopPipelinePolling, navigate]);

  const handleRefresh = async () => {
    if (!pipelineId) return;
    try {
      await fetchPipelineStatus(pipelineId);
      setErrorRetryCount(0);
    } catch (error) {
      setErrorRetryCount(prev => prev + 1);
    }
  };

  const handleViewKB = () => {
    navigate(`/knowledge-bases/${kbId}`);
  };

  const handleRetry = async () => {
    if (!kbId) return;

    setRetryLoading(true);
    try {
      const result = await kbClient.kb.retryProcessing(kbId);

      // Show enhanced retry information if available
      if (result.enhanced_retry) {
        console.log('✅ Enhanced retry initiated:', {
          kb_name: result.kb_name,
          backup_id: result.backup_id,
          cleanup_stats: result.cleanup_stats,
          retry_features: result.retry_features
        });

        // Log cleanup statistics for debugging
        if (result.cleanup_stats) {
          const stats = result.cleanup_stats;
          console.log('🧹 State cleanup completed:', {
            chunks_deleted: stats.chunks_deleted,
            documents_updated: stats.documents_updated,
            qdrant_vectors_deleted: stats.qdrant_vectors_deleted,
            errors: stats.errors
          });
        }
      }

      // Navigate to monitor the new pipeline
      navigate(`/knowledge-bases/${kbId}/pipeline-monitor?pipeline=${result.pipeline_id}`, {
        state: {
          retryInfo: result.enhanced_retry ? {
            isEnhancedRetry: true,
            backupId: result.backup_id,
            retryFeatures: result.retry_features,
            cleanupStats: result.cleanup_stats,
            kbName: result.kb_name
          } : null
        }
      });

    } catch (error: any) {
      console.error('❌ Failed to retry pipeline:', error);

      // Show user-friendly error message
      const errorMessage = error.message || 'Unknown error occurred during retry';

      // You could add a toast notification here if you have a toast system
      alert(`Failed to retry pipeline: ${errorMessage}`);
    } finally {
      setRetryLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!pipelineId) return;

    // Confirm before cancelling
    const confirmed = confirm(
      'Are you sure you want to cancel this pipeline? This will stop all processing and the KB will need to be recreated or retried.'
    );
    if (!confirmed) return;

    setCancelLoading(true);
    try {
      await kbClient.pipeline.cancel(pipelineId);

      // Stop polling since pipeline is cancelled
      stopPipelinePolling(pipelineId);
      setIsPolling(false);

      // Refresh status to show cancelled state
      await fetchPipelineStatus(pipelineId);

      // Refresh KB details and retry status
      if (kbId) {
        const kb = await kbClient.kb.get(kbId);
        setKbDetails(kb);
        const status = await kbClient.kb.getRetryStatus(kbId);
        setRetryStatus(status);
      }

      console.log('✅ Pipeline cancelled successfully');
    } catch (error: any) {
      console.error('❌ Failed to cancel pipeline:', error);
      alert(`Failed to cancel pipeline: ${error.message || 'Unknown error'}`);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleBackToList = () => {
    navigate('/knowledge-bases');
  };

  const getStageStatus = (stage: string) => {
    if (!currentStatus) return 'pending';
    if (currentStatus.progress?.current_step === stage) return 'active';

    // Check if this stage is completed based on stats
    const stats = currentStatus.stats;
    if (stats) {
      if (stage === 'scraping' && stats.pages_scraped > 0) return 'completed';
      if (stage === 'parsing' && stats.pages_scraped > 0 && stats.pages_scraped >= (stats.pages_discovered || 1)) return 'completed';
      if (stage === 'chunking' && stats.chunks_created > 0) return 'completed';
      if (stage === 'embedding' && stats.embeddings_generated > 0) return 'completed';
      if (stage === 'indexing' && stats.vectors_indexed > 0) return 'completed';
    }

    return 'pending';
  };

  const getProgressPercentage = () => {
    // Try to use backend-provided percentage first
    if (currentStatus?.progress?.percent !== undefined && currentStatus.progress.percent > 0) {
      return currentStatus.progress.percent;
    }

    // Fallback: Calculate progress based on completed stages
    if (!currentStatus) return 0;

    const stages = ['scraping', 'parsing', 'chunking', 'embedding', 'indexing'];
    let completedStages = 0;
    let activeStageProgress = 0;

    // Count completed stages
    stages.forEach((stage) => {
      const status = getStageStatus(stage);
      if (status === 'completed') {
        completedStages++;
      } else if (status === 'active') {
        // Add partial progress for active stage
        const stats = currentStatus.stats;
        if (stats && stage === 'scraping' && stats.pages_discovered > 0) {
          activeStageProgress = Math.min(0.8, stats.pages_scraped / stats.pages_discovered * 0.9);
        } else if (stats && stage === 'chunking' && stats.pages_scraped > 0) {
          // Estimate chunking progress based on scraped pages
          activeStageProgress = 0.5; // Default to 50% for active chunking
        } else if (stats && stage === 'embedding' && stats.chunks_created > 0) {
          // Estimate embedding progress
          activeStageProgress = 0.3; // Default to 30% for active embedding
        } else {
          activeStageProgress = 0.2; // Default to 20% for any active stage
        }
      }
    });

    // Each stage is worth 20% (100% / 5 stages)
    const baseProgress = (completedStages / stages.length) * 100;
    const activeProgress = (activeStageProgress / stages.length) * 100;

    return Math.min(100, Math.round(baseProgress + activeProgress));
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'cancelled':
        return 'text-amber-600';
      case 'running':
      case 'processing':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBadgeVariant = (status?: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'completed':
        return 'default'; // Using default instead of 'success'
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'outline'; // Use outline for cancelled
      case 'running':
      case 'processing':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <DashboardLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-8">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={handleBackToList}
            className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-manrope"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Bases
          </Button>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <Cpu className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-manrope">
                  Processing Knowledge Base
                </h1>
                <p className="text-gray-600 dark:text-gray-400 font-manrope text-base leading-relaxed">
                  Monitor the progress of your knowledge base processing pipeline
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <CardTitle className="text-gray-900 dark:text-white font-manrope text-xl">Pipeline Status</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                    {currentStatus ? `Pipeline ID: ${pipelineId}` : 'Loading pipeline status...'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={getStatusBadgeVariant(currentStatus?.status)} className="font-manrope font-medium">
                  {currentStatus?.status || 'Loading'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isPolling}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
                >
                  <RefreshCw className={cn("h-4 w-4", isPolling && "animate-spin")} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Overall Progress */}
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-base font-semibold text-gray-900 dark:text-white font-manrope">Overall Progress</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400 font-manrope bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg">
                    {getProgressPercentage()}%
                  </span>
                </div>
                <Progress value={getProgressPercentage()} className="h-3 bg-gray-200 dark:bg-gray-700" />
              </div>

              {/* Statistics - Source-type aware labels */}
              {currentStatus?.stats && (() => {
                // Determine labels based on source type
                const sourceType = currentStatus.stats.source_type || 'web_scraping';
                const isFileUpload = sourceType === 'file_upload';
                const isMixed = sourceType === 'mixed';

                // Dynamic labels based on source type
                const discoveredLabel = isFileUpload ? 'Docs Added' : isMixed ? 'Sources' : 'Pages Found';
                const processedLabel = isFileUpload ? 'Docs Parsed' : isMixed ? 'Processed' : 'Pages Scraped';
                const failedLabel = 'Failed';

                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
                    <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center shadow-sm">
                      <div className="text-2xl font-bold text-gray-700 dark:text-gray-300 font-manrope">{currentStatus.stats.pages_discovered}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope mt-1">{discoveredLabel}</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-center shadow-sm">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-manrope">{currentStatus.stats.pages_scraped}</div>
                      <div className="text-xs text-blue-700 dark:text-blue-300 font-manrope mt-1">{processedLabel}</div>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/30 border border-red-200 dark:border-red-700 rounded-xl p-4 text-center shadow-sm">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-manrope">{currentStatus.stats.pages_failed}</div>
                      <div className="text-xs text-red-700 dark:text-red-300 font-manrope mt-1">{failedLabel}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700 rounded-xl p-4 text-center shadow-sm">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-manrope">{currentStatus.stats.chunks_created}</div>
                      <div className="text-xs text-purple-700 dark:text-purple-300 font-manrope mt-1">Chunks</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 text-center shadow-sm">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 font-manrope">{currentStatus.stats.embeddings_generated}</div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-300 font-manrope mt-1">Embeddings</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-xl p-4 text-center shadow-sm">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-manrope">{currentStatus.stats.vectors_indexed}</div>
                      <div className="text-xs text-green-700 dark:text-green-300 font-manrope mt-1">Indexed</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Stages */}
        <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
            <div className="flex items-center gap-4">
              <Cpu className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <CardTitle className="text-gray-900 dark:text-white font-manrope text-xl">Processing Stages</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                  Track progress through each stage of the pipeline
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4">
              {Object.entries(STAGE_DESCRIPTIONS).map(([stage, description]) => {
                const Icon = STAGE_ICONS[stage as keyof typeof STAGE_ICONS];
                const status = getStageStatus(stage);
                const isActive = status === 'active';
                const isCompleted = status === 'completed';

                return (
                  <div
                    key={stage}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 shadow-sm",
                      isActive && "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700 shadow-md",
                      isCompleted && "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700",
                      !isActive && !isCompleted && "bg-white dark:bg-gray-800/30 border-gray-200 dark:border-gray-700"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-xl shadow-sm",
                      isCompleted && "bg-gradient-to-br from-green-500 to-emerald-600 text-white",
                      isActive && "bg-gradient-to-br from-blue-500 to-indigo-600 text-white animate-pulse",
                      !isCompleted && !isActive && "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-500 dark:text-gray-400"
                    )}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : isActive ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className={cn(
                        "font-semibold capitalize text-lg font-manrope",
                        isCompleted && "text-green-900 dark:text-green-100",
                        isActive && "text-blue-900 dark:text-blue-100",
                        !isActive && !isCompleted && "text-gray-900 dark:text-gray-100"
                      )}>{stage}</div>
                      <div className={cn(
                        "text-sm font-manrope",
                        isCompleted && "text-green-700 dark:text-green-300",
                        isActive && "text-blue-700 dark:text-blue-300",
                        !isActive && !isCompleted && "text-gray-600 dark:text-gray-400"
                      )}>{description}</div>
                    </div>

                    {isActive && (
                      <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 animate-pulse font-manrope">
                        Processing...
                      </Badge>
                    )}
                    {isCompleted && (
                      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 font-manrope">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {currentStatus?.status === 'failed' && currentStatus.error && (
          <Alert className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-700 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <AlertDescription className="flex-1">
                <strong className="text-red-900 dark:text-red-100 font-manrope">Pipeline Failed:</strong>
                <div className="text-red-800 dark:text-red-200 font-manrope mt-1">{currentStatus.error}</div>
                {errorRetryCount > 0 && (
                  <div className="mt-3 text-sm text-red-700 dark:text-red-300 font-manrope bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                    Retry attempts: {errorRetryCount}
                  </div>
                )}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Completion Alert */}
        {currentStatus?.status === 'completed' && (
          <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <AlertDescription className="flex-1">
                <strong className="text-green-900 dark:text-green-100 font-manrope">Processing Complete!</strong>
                <div className="text-green-800 dark:text-green-200 font-manrope mt-1">
                  Your knowledge base has been successfully processed and is ready to use.
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Cancelled Alert */}
        {currentStatus?.status === 'cancelled' && (
          <Alert className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <AlertDescription className="flex-1">
                <strong className="text-amber-900 dark:text-amber-100 font-manrope">Pipeline Cancelled</strong>
                <div className="text-amber-800 dark:text-amber-200 font-manrope mt-1">
                  The pipeline was cancelled by user request. You can retry processing using the Retry button.
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Actions */}
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
          {/* Stale Pipeline Warning */}
          {retryStatus?.is_stale && retryStatus?.pipeline_status === 'queued' && (
            <Alert className="mb-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <AlertDescription className="flex-1">
                  <strong className="text-amber-900 dark:text-amber-100 font-manrope">Pipeline Stuck in Queue</strong>
                  <div className="text-amber-800 dark:text-amber-200 font-manrope mt-1">
                    {retryStatus.reason}
                  </div>
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Retry Available Soon Message */}
          {retryStatus && !retryStatus.can_retry && retryStatus.retry_available_in_seconds && retryStatus.retry_available_in_seconds > 0 && (
            <Alert className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <AlertDescription className="flex-1">
                  <strong className="text-blue-900 dark:text-blue-100 font-manrope">Waiting for Pipeline</strong>
                  <div className="text-blue-800 dark:text-blue-200 font-manrope mt-1">
                    Retry will be available in {retryStatus.retry_available_in_seconds}s if pipeline doesn't start
                  </div>
                </AlertDescription>
              </div>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            {/* Cancel button - only show when pipeline is actively running or queued */}
            {currentStatus && ['running', 'queued', 'processing'].includes(currentStatus.status) && (
              <Button
                onClick={handleCancel}
                disabled={cancelLoading}
                variant="outline"
                className="bg-white dark:bg-gray-800 border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 font-manrope font-medium shadow-sm transition-all duration-200 rounded-lg"
              >
                {cancelLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Cancel Pipeline
              </Button>
            )}
            {retryStatus?.can_retry && (
              <Button
                onClick={handleRetry}
                disabled={retryLoading}
                variant="outline"
                className={cn(
                  "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope font-medium shadow-sm transition-all duration-200 rounded-lg",
                  retryStatus.is_stale && "border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                )}
              >
                {retryLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {retryStatus.is_stale ? 'Retry Stale Pipeline' : 'Retry Pipeline'}
              </Button>
            )}
            {currentStatus?.status === 'completed' && (
              <Button
                onClick={handleViewKB}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 text-white font-manrope font-medium shadow-sm hover:shadow-md transition-all duration-200 rounded-lg"
              >
                View Knowledge Base
              </Button>
            )}
          </div>
        </div>

        {/* Timing Information */}
        {currentStatus && (
          <div className="mt-6 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center shadow-sm">
            <div className="space-y-2 text-sm font-manrope">
              {currentStatus.started_at && (
                <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span><strong>Started:</strong> {new Date(currentStatus.started_at).toLocaleString()}</span>
                </div>
              )}
              {currentStatus.completed_at && (
                <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span><strong>Completed:</strong> {new Date(currentStatus.completed_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}