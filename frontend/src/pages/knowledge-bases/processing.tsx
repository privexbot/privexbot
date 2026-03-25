/**
 * Knowledge Base Processing Status Page
 *
 * Monitors pipeline processing progress with real-time updates
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  AlertCircle,
  Brain,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useKBStore } from "@/store/kb-store";
import {
  PipelineStatusResponse,
  PipelineStatus,
  PipelineStage,
} from "@/types/knowledge-base";

export default function KBProcessingPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pipelineId = searchParams.get("pipeline");

  const [pipelineStatus, setPipelineStatus] =
    useState<PipelineStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { fetchPipelineStatus } = useKBStore();

  // Fetch pipeline status
  const loadPipelineStatus = useCallback(async () => {
    if (!pipelineId || !kbId) {
      setError("Invalid pipeline or knowledge base ID");
      setIsLoading(false);
      return;
    }

    try {
      const status = await fetchPipelineStatus(pipelineId);
      setPipelineStatus(status);

      // Stop auto-refresh if completed or failed
      if (
        status.status === PipelineStatus.COMPLETED ||
        status.status === PipelineStatus.FAILED ||
        status.status === PipelineStatus.CANCELLED
      ) {
        setAutoRefresh(false);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch pipeline status:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load processing status";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [pipelineId, kbId, fetchPipelineStatus]);

  // Auto-refresh pipeline status
  useEffect(() => {
    loadPipelineStatus();

    if (autoRefresh) {
      const interval = setInterval(() => {
        loadPipelineStatus();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [pipelineId, kbId, autoRefresh, loadPipelineStatus]);

  // Get status icon
  const getStatusIcon = (status: PipelineStatus) => {
    switch (status) {
      case PipelineStatus.COMPLETED:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case PipelineStatus.FAILED:
      case PipelineStatus.CANCELLED:
        return <XCircle className="h-5 w-5 text-red-500" />;
      case PipelineStatus.RUNNING:
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case PipelineStatus.QUEUED:
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  // Get status badge color
  const getStatusColor = (status: PipelineStatus) => {
    switch (status) {
      case PipelineStatus.COMPLETED:
        return "default";
      case PipelineStatus.FAILED:
      case PipelineStatus.CANCELLED:
        return "destructive";
      case PipelineStatus.RUNNING:
        return "default";
      case PipelineStatus.QUEUED:
      default:
        return "secondary";
    }
  };

  // Get stage display name
  const getStageDisplayName = (stage: PipelineStage) => {
    switch (stage) {
      case PipelineStage.SCRAPING:
        return "Scraping Content";
      case PipelineStage.PARSING:
        return "Parsing Documents";
      case PipelineStage.CHUNKING:
        return "Creating Chunks";
      case PipelineStage.EMBEDDING:
        return "Generating Embeddings";
      case PipelineStage.INDEXING:
        return "Building Search Index";
      default:
        return "Processing";
    }
  };

  // Format time duration
  const formatDuration = (start?: string, end?: string) => {
    if (!start) return '--';

    const startTime = new Date(start).getTime();
    if (isNaN(startTime)) return '--';

    const endTime = end ? new Date(end).getTime() : Date.now();
    if (isNaN(endTime)) return '--';

    const duration = Math.floor((endTime - startTime) / 1000);

    if (duration < 0) return '--';
    if (duration < 60) return `${duration}s`;
    if (duration < 3600)
      return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor(
      (duration % 3600) / 60
    )}m`;
  };

  const handleRetry = () => {
    setAutoRefresh(true);
    loadPipelineStatus();
  };

  const handleViewKB = () => {
    navigate(`/knowledge-bases/${kbId}`);
  };

  const handleBackToList = () => {
    navigate("/knowledge-bases");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h3 className="text-lg font-medium">Loading Processing Status</h3>
            <p className="text-muted-foreground">
              Fetching pipeline information...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !pipelineStatus) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || "Failed to load processing status"}
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={handleBackToList}>
            Back to Knowledge Bases
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const progress = pipelineStatus.progress?.percent || 0;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={handleBackToList} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Bases
          </Button>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">
                Processing Knowledge Base
              </h1>
              <p className="text-muted-foreground">
                Pipeline ID: {pipelineId}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {getStatusIcon(pipelineStatus.status)}
              <Badge
                variant={getStatusColor(pipelineStatus.status) as "default" | "destructive" | "outline" | "secondary"}
                className="text-lg px-4 py-2"
              >
                {pipelineStatus.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Overall Progress
            </CardTitle>
            <CardDescription>
              Current stage: {getStageDisplayName(pipelineStatus.progress?.current_step || 'initializing')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{Math.round(progress)}% Complete</span>
              <span>{pipelineStatus.message || "Processing..."}</span>
            </div>

            {/* Progress Details */}
            {pipelineStatus.progress?.current_page && pipelineStatus.progress?.total_pages && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Pages: </span>
                  <span className="font-medium">
                    {pipelineStatus.progress?.current_page} of {pipelineStatus.progress?.total_pages}
                  </span>
                </div>
                {pipelineStatus.progress?.current_document && pipelineStatus.progress?.total_documents && (
                  <div>
                    <span className="text-muted-foreground">Documents: </span>
                    <span className="font-medium">
                      {pipelineStatus.progress?.current_document} of {pipelineStatus.progress?.total_documents}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Timing Info */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-sm text-muted-foreground">Started</p>
                <p className="font-medium">
                  {pipelineStatus.started_at
                    ? (new Date(pipelineStatus.started_at).getTime()
                      ? new Date(pipelineStatus.started_at).toLocaleTimeString()
                      : '--')
                    : '--'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">
                  {formatDuration(
                    pipelineStatus.started_at,
                    pipelineStatus.completed_at
                  )}
                </p>
              </div>
              {pipelineStatus.completed_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-medium">
                    {new Date(pipelineStatus.completed_at).getTime()
                      ? new Date(pipelineStatus.completed_at).toLocaleTimeString()
                      : '--'
                    }
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistics - Source-type aware labels */}
        {pipelineStatus.stats && (() => {
          // Determine labels based on source type
          const sourceType = pipelineStatus.stats.source_type || 'web_scraping';
          const isFileUpload = sourceType === 'file_upload';
          const isMixed = sourceType === 'mixed';

          // Dynamic labels based on source type
          const discoveredLabel = isFileUpload ? 'Docs Added' : isMixed ? 'Sources' : 'Pages Discovered';
          const processedLabel = isFileUpload ? 'Docs Parsed' : isMixed ? 'Processed' : 'Pages Scraped';
          const failedLabel = isFileUpload ? 'Docs Failed' : 'Pages Failed';

          return (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Processing Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {pipelineStatus.stats.pages_discovered}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {discoveredLabel}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {pipelineStatus.stats.pages_scraped}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {processedLabel}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {pipelineStatus.stats.pages_failed}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {failedLabel}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {pipelineStatus.stats.chunks_created}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Chunks Created
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {pipelineStatus.stats.embeddings_generated}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Embeddings Generated
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {pipelineStatus.stats.vectors_indexed}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Vectors Indexed
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Error Display */}
        {pipelineStatus.error && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Processing Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertDescription>{pipelineStatus.error}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleRetry} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>

          <div className="space-x-3">
            {pipelineStatus.status === PipelineStatus.FAILED && (
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry Processing
              </Button>
            )}

            {pipelineStatus.status === PipelineStatus.COMPLETED && (
              <Button onClick={handleViewKB}>View Knowledge Base</Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}