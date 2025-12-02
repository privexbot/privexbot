/**
 * KB Rechunk Page
 *
 * Preview and apply rechunking strategies with workspace validation
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ArrowLeft, RefreshCw, Play, AlertCircle, Info, Zap, Eye, Settings } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { KnowledgeBase, ChunkingConfig, ChunkingStrategy } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { useKBStore } from '@/store/kb-store';
import kbClient from '@/lib/kb-client';
import { KBChunkingConfig } from '@/components/kb/KBChunkingConfig';

export default function KBRechunkPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, hasPermission } = useApp();

  // Use KB store for chunking configuration management
  const { chunkingConfig, updateChunkingConfig } = useKBStore();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [reindexProgress, setReindexProgress] = useState(0);

  // Workspace validation
  if (!currentWorkspace) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No workspace selected. Please select a workspace to continue.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  // Permission validation
  if (!hasPermission('kb:edit')) {
    toast({
      title: 'Access Denied',
      description: 'You do not have permission to edit this knowledge base',
      variant: 'destructive'
    });
    navigate('/knowledge-bases');
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You do not have permission to edit this knowledge base.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  useEffect(() => {
    if (kbId) {
      loadKBData();
    }
  }, [kbId]);

  const loadKBData = async () => {
    if (!kbId) return;

    setIsLoading(true);
    try {
      const [kbData, documentsData] = await Promise.all([
        kbClient.kb.get(kbId),
        kbClient.kb.getDocuments(kbId)
      ]);

      // Workspace validation
      if (kbData.workspace_id !== currentWorkspace.id) {
        const kbWorkspace = workspaces.find(ws => ws.id === kbData.workspace_id);
        if (kbWorkspace) {
          toast({
            title: 'Wrong Workspace',
            description: `This knowledge base belongs to "${kbWorkspace.name}". Please switch to that workspace to access it.`,
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to rechunk this knowledge base',
            variant: 'destructive'
          });
        }
        navigate('/knowledge-bases');
        return;
      }

      setKb(kbData);
      setDocuments(Array.isArray(documentsData) ? documentsData : []);

      // Initialize chunking configuration in store with current KB settings
      if (kbData.chunking_config) {
        updateChunkingConfig(kbData.chunking_config);
      }
    } catch (error) {
      console.error('Failed to load KB:', error);
      toast({
        title: 'Error',
        description: 'Failed to load knowledge base details',
        variant: 'destructive'
      });
      navigate('/knowledge-bases');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewRechunk = async () => {
    if (!kbId || !kb) return;

    setIsGeneratingPreview(true);
    try {
      // Use the current chunking config from store (which may have been modified)
      // Map the chunking config to the format expected by the backend
      const previewRequest = {
        strategy: chunkingConfig.strategy,
        chunk_size: chunkingConfig.chunk_size,
        chunk_overlap: chunkingConfig.chunk_overlap,
        sample_documents: documents.length > 0 ? Math.min(3, documents.length) : 3 // Use available documents or default to 3
      };

      const preview = await kbClient.kb.previewRechunk(kbId, previewRequest);
      setPreviewData(preview);

      toast({
        title: 'Preview Generated',
        description: 'Rechunking preview has been generated successfully',
      });
    } catch (error) {
      console.error('Failed to generate preview:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate rechunking preview',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleStartReindex = async () => {
    if (!kbId || !kb) return;

    setIsReindexing(true);
    setReindexProgress(0);
    try {
      // Send the current chunking configuration from the store
      const result = await kbClient.kb.reindex(kbId, {
        chunking_config: chunkingConfig
      });

      // Simulate progress (in real implementation, you'd poll the task status)
      const progressInterval = setInterval(() => {
        setReindexProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 20;
        });
      }, 1000);

      // In real implementation, poll task status here
      setTimeout(() => {
        clearInterval(progressInterval);
        setReindexProgress(100);
        setIsReindexing(false);

        const successMessage = result.configuration_updated
          ? 'Knowledge base has been reindexed with new chunking configuration'
          : 'Knowledge base has been reindexed successfully';

        toast({
          title: 'Reindexing Complete',
          description: successMessage,
        });

        // Refresh KB data
        loadKBData();
      }, 8000);

    } catch (error) {
      console.error('Failed to start reindexing:', error);
      setIsReindexing(false);
      setReindexProgress(0);
      toast({
        title: 'Error',
        description: 'Failed to start reindexing process',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/knowledge-bases/${kbId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to KB
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Rechunk Knowledge Base</h1>
              <p className="text-muted-foreground">{kb?.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handlePreviewRechunk}
              disabled={isGeneratingPreview || isReindexing}
            >
              {isGeneratingPreview ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Preview Changes
            </Button>
            <Button
              onClick={handleStartReindex}
              disabled={isReindexing || !kb}
            >
              {isReindexing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Apply Rechunking
            </Button>
          </div>
        </div>

        {/* Current Configuration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Current Configuration
            </CardTitle>
            <CardDescription>
              Current chunking settings and statistics for this knowledge base
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kb && kb.chunking_config ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Strategy</div>
                    <Badge variant="outline" className="mt-1 capitalize">
                      {kb.chunking_config.strategy?.replace('_', ' ') || 'Not set'}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Chunk Size</div>
                    <div className="mt-1 font-medium">{kb.chunking_config.chunk_size || 'Not set'} chars</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Overlap</div>
                    <div className="mt-1 font-medium">{kb.chunking_config.chunk_overlap || 'Not set'} chars</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Total Chunks</div>
                    <div className="mt-1 font-medium">{kb.stats?.chunks || 0}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No chunking configuration available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reindexing Progress */}
        {isReindexing && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Reindexing in Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={reindexProgress} className="w-full" />
                <div className="text-sm text-muted-foreground">
                  {reindexProgress < 30 && "Parsing documents..."}
                  {reindexProgress >= 30 && reindexProgress < 60 && "Applying new chunking strategy..."}
                  {reindexProgress >= 60 && reindexProgress < 90 && "Generating embeddings..."}
                  {reindexProgress >= 90 && reindexProgress < 100 && "Updating vector index..."}
                  {reindexProgress >= 100 && "Reindexing complete!"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rechunking Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Chunking Strategy
                </CardTitle>
                <CardDescription>
                  Adjust chunking parameters and preview the impact on your knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                {kb && <KBChunkingConfig />}
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Rechunking will regenerate all chunks and embeddings. This process may take several minutes
                depending on the size of your knowledge base and cannot be undone.
              </AlertDescription>
            </Alert>
          </div>

          {/* Preview Panel */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview Results
                </CardTitle>
                <CardDescription>
                  See how your content will be chunked with the new configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                {previewData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm font-medium text-muted-foreground mb-1">New Chunks</div>
                        <div className="text-2xl font-bold text-primary">{previewData.total_chunks || 0}</div>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm font-medium text-muted-foreground mb-1">Change</div>
                        <div className={`text-2xl font-bold ${
                          previewData.chunk_difference > 0 ? 'text-green-600' :
                          previewData.chunk_difference < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {previewData.chunk_difference > 0 ? '+' : ''}{previewData.chunk_difference || 0}
                        </div>
                      </div>
                    </div>

                    {previewData.recommendations && (
                      <Alert>
                        <Zap className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Recommendation:</strong> {previewData.recommendations}
                        </AlertDescription>
                      </Alert>
                    )}

                    {previewData.sample_chunks && previewData.sample_chunks.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Sample Chunks:</div>
                        {previewData.sample_chunks.slice(0, 3).map((chunk: any, index: number) => (
                          <div key={index} className="p-3 border rounded-lg bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
                              <span>Chunk {index + 1}</span>
                              <Badge variant="outline" className="text-xs">
                                {chunk.length || chunk.content?.length || 0} chars
                              </Badge>
                            </div>
                            <div className="text-sm leading-relaxed">
                              {chunk.content || chunk}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-base font-medium mb-2">No Preview Yet</p>
                    <p className="text-sm">Click "Preview Changes" to see how your content will be chunked</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}