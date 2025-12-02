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

    fetchKbDetails();

    // Start polling for pipeline status
    setIsPolling(true);
    startPipelinePolling(pipelineId, (status) => {
      if (status.status === 'completed' || status.status === 'failed') {
        setIsPolling(false);
        stopPipelinePolling(pipelineId);
        // Refresh KB details when pipeline completes/fails
        fetchKbDetails();
      }
    });

    // Cleanup on unmount
    return () => {
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
    try {
      const result = await kbClient.kb.retryProcessing(kbId);
      navigate(`/knowledge-bases/${kbId}/pipeline-monitor?pipeline=${result.pipeline_id}`);
    } catch (error) {
      console.error('Failed to retry pipeline:', error);
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
      if (stage === 'parsing' && stats.pages_scraped > 0) return 'completed';
      if (stage === 'chunking' && stats.chunks_created > 0) return 'completed';
      if (stage === 'embedding' && stats.embeddings_generated > 0) return 'completed';
      if (stage === 'indexing' && stats.vectors_indexed > 0) return 'completed';
    }

    return 'pending';
  };

  const getProgressPercentage = () => {
    if (!currentStatus || !currentStatus.progress) return 0;
    return currentStatus.progress.percent || 0;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
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
      case 'running':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={handleBackToList}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Bases
          </Button>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Processing Knowledge Base
            </h1>
            <p className="text-muted-foreground">
              Monitor the progress of your knowledge base processing pipeline
            </p>
          </div>
        </div>

        {/* Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pipeline Status</CardTitle>
                <CardDescription>
                  {currentStatus ? `Pipeline ID: ${pipelineId}` : 'Loading pipeline status...'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(currentStatus?.status)}>
                  {currentStatus?.status || 'Loading'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isPolling}
                >
                  <RefreshCw className={cn("h-4 w-4", isPolling && "animate-spin")} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Overall Progress */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {getProgressPercentage()}%
                  </span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
              </div>

              {/* Statistics */}
              {currentStatus?.stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{currentStatus.stats.pages_discovered}</div>
                    <div className="text-xs text-muted-foreground">Pages Found</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{currentStatus.stats.pages_scraped}</div>
                    <div className="text-xs text-muted-foreground">Pages Scraped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{currentStatus.stats.pages_failed}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{currentStatus.stats.chunks_created}</div>
                    <div className="text-xs text-muted-foreground">Chunks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{currentStatus.stats.embeddings_generated}</div>
                    <div className="text-xs text-muted-foreground">Embeddings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{currentStatus.stats.vectors_indexed}</div>
                    <div className="text-xs text-muted-foreground">Indexed</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Stages */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Processing Stages</CardTitle>
            <CardDescription>
              Track progress through each stage of the pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                      "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                      isActive && "bg-blue-50 border-blue-300",
                      isCompleted && "bg-green-50 border-green-300"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full",
                      isCompleted && "bg-green-500 text-white",
                      isActive && "bg-blue-500 text-white animate-pulse",
                      !isCompleted && !isActive && "bg-gray-200 text-gray-500"
                    )}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : isActive ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="font-medium capitalize">{stage}</div>
                      <div className="text-sm text-muted-foreground">{description}</div>
                    </div>

                    {isActive && (
                      <Badge variant="default" className="animate-pulse">
                        Processing...
                      </Badge>
                    )}
                    {isCompleted && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
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
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Pipeline Failed:</strong> {currentStatus.error}
              {errorRetryCount > 0 && (
                <div className="mt-2 text-sm">
                  Retry attempts: {errorRetryCount}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Completion Alert */}
        {currentStatus?.status === 'completed' && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong className="text-green-900">Processing Complete!</strong>
              <div className="mt-2">
                Your knowledge base has been successfully processed and is ready to use.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {kbDetails?.status === 'failed' && (
            <Button onClick={handleRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Pipeline
            </Button>
          )}
          {currentStatus?.status === 'completed' && (
            <Button onClick={handleViewKB}>
              View Knowledge Base
            </Button>
          )}
        </div>

        {/* Timing Information */}
        {currentStatus && (
          <div className="mt-6 text-sm text-muted-foreground text-center">
            {currentStatus.started_at && (
              <p>Started: {new Date(currentStatus.started_at).toLocaleString()}</p>
            )}
            {currentStatus.completed_at && (
              <p>Completed: {new Date(currentStatus.completed_at).toLocaleString()}</p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}