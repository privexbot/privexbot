/**
 * KB Analytics Page
 *
 * View knowledge base metrics and analytics with workspace validation
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Database,
  FileText,
  Search,
  Clock,
  Users,
  AlertCircle,
  RefreshCw,
  Download
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { KnowledgeBase, KBStats } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import kbClient from '@/lib/kb-client';

interface AnalyticsData {
  overview: {
    total_queries: number;
    avg_response_time: number;
    successful_queries: number;
    failed_queries: number;
  };
  usage: {
    daily_queries: Array<{ date: string; count: number }>;
    top_queries: Array<{ query: string; count: number; avg_score: number }>;
    query_types: Array<{ type: string; count: number }>;
  };
  performance: {
    avg_retrieval_time: number;
    chunk_hit_rate: number;
    embedding_quality_score: number;
    index_health: number;
  };
  content: {
    chunk_distribution: Array<{ size_range: string; count: number }>;
    content_types: Array<{ type: string; count: number; size_mb: number }>;
    processing_stats: {
      total_processed: number;
      avg_processing_time: number;
      processing_errors: number;
    };
  };
}

export default function KBAnalyticsPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, hasPermission } = useApp();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [stats, setStats] = useState<KBStats | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    if (!kbId || !currentWorkspace) return;

    setIsLoading(true);
    try {
      // First get KB data to check status
      const kbData = await kbClient.kb.get(kbId);

      // Only get stats if KB is ready (processing completed)
      let statsData = null;
      if (kbData.status === 'ready') {
        statsData = await kbClient.kb.getStats(kbId);
      }

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
            description: 'You do not have permission to view analytics for this knowledge base',
            variant: 'destructive'
          });
        }
        navigate('/knowledge-bases');
        return;
      }

      setKb(kbData);
      setStats(statsData);

      // Only build analytics if we have stats (KB is ready)
      if (statsData) {
        // Build analytics from available real KB stats data
        setAnalyticsData({
        overview: {
          total_queries: 0, // Not available yet - will be 0 until backend provides this
          avg_response_time: 0, // Not available yet
          successful_queries: 0, // Not available yet
          failed_queries: 0 // Not available yet
        },
        usage: {
          daily_queries: [], // Not available yet - will be empty until backend provides this
          top_queries: [], // Not available yet
          query_types: [] // Not available yet
        },
        performance: {
          avg_retrieval_time: 0, // Not available yet
          chunk_hit_rate: 0, // Not available yet
          embedding_quality_score: 0, // Not available yet
          index_health: 100 // Assume healthy if KB is ready
        },
        content: {
          chunk_distribution: [
            {
              size_range: `~${typeof statsData.avg_chunk_size === 'number' ? statsData.avg_chunk_size : 0} chars avg`,
              count: typeof statsData.chunks === 'number' ? statsData.chunks : (typeof statsData.chunks === 'object' && (statsData.chunks as any)?.total ? (statsData.chunks as any).total : 0)
            }
          ],
          content_types: [
            {
              type: "All Documents",
              count: typeof statsData.documents === 'number' ? statsData.documents : (typeof statsData.documents === 'object' && (statsData.documents as any)?.total ? (statsData.documents as any).total : 0),
              size_mb: Math.round(((typeof statsData.total_size_bytes === 'number' ? statsData.total_size_bytes : 0) || 0) / (1024 * 1024) * 100) / 100
            }
          ],
          processing_stats: {
            total_processed: typeof statsData.documents === 'number' ? statsData.documents : (typeof statsData.documents === 'object' && (statsData.documents as any)?.total ? (statsData.documents as any).total : 0),
            avg_processing_time: 0, // Not available yet
            processing_errors: 0 // Not available yet
          }
        }
      });
      } else {
        // KB is still processing, clear any previous analytics data
        setAnalyticsData(null);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast({
      title: 'Success',
      description: 'Analytics data refreshed successfully',
    });
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  useEffect(() => {
    if (kbId && currentWorkspace) {
      loadData();
    }
  }, [kbId, currentWorkspace]);

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
  if (!hasPermission('kb:view')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You do not have permission to view this knowledge base.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Show processing state if KB is not ready yet
  if (kb && kb.status === 'processing') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Processing Knowledge Base</h3>
              <p className="text-muted-foreground">
                Your knowledge base is being processed. Analytics will be available once processing is complete.
              </p>
              <Button
                variant="outline"
                onClick={loadData}
                disabled={isRefreshing}
                className="mt-4"
              >
                {isRefreshing ? 'Checking...' : 'Check Status'}
              </Button>
            </div>
          </div>
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
              <h1 className="text-2xl font-semibold">Analytics</h1>
              <p className="text-muted-foreground">{kb?.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{typeof stats?.documents === 'number' ? stats.documents : (typeof stats?.documents === 'object' && (stats.documents as any)?.total ? (stats.documents as any).total : 0)}</div>
                  <div className="text-sm text-muted-foreground">Documents</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{typeof stats?.chunks === 'number' ? stats.chunks : (typeof stats?.chunks === 'object' && (stats.chunks as any)?.total ? (stats.chunks as any).total : 0)}</div>
                  <div className="text-sm text-muted-foreground">Chunks</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold">{analyticsData?.overview.total_queries || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Queries</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {analyticsData?.performance.chunk_hit_rate || 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">Hit Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Response Times</CardTitle>
                  <CardDescription>
                    Average query response and retrieval performance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Average Response Time</span>
                      <span>{analyticsData?.overview.avg_response_time || 0}ms</span>
                    </div>
                    <Progress value={Math.min((analyticsData?.overview.avg_response_time || 0) / 5, 100)} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Average Retrieval Time</span>
                      <span>{analyticsData?.performance.avg_retrieval_time || 0}ms</span>
                    </div>
                    <Progress value={Math.min((analyticsData?.performance.avg_retrieval_time || 0) / 2, 100)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quality Metrics</CardTitle>
                  <CardDescription>
                    Embedding and retrieval quality scores
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Embedding Quality</span>
                      <span>{analyticsData?.performance.embedding_quality_score || 0}%</span>
                    </div>
                    <Progress value={analyticsData?.performance.embedding_quality_score || 0} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Chunk Hit Rate</span>
                      <span>{analyticsData?.performance.chunk_hit_rate || 0}%</span>
                    </div>
                    <Progress value={analyticsData?.performance.chunk_hit_rate || 0} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Queries</CardTitle>
                  <CardDescription>
                    Most frequently asked questions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData?.usage.top_queries.map((query, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{query.query}</div>
                          <div className="text-xs text-muted-foreground">
                            Relevance: {(query.avg_score * 100).toFixed(1)}%
                          </div>
                        </div>
                        <Badge variant="outline">{query.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Query Types</CardTitle>
                  <CardDescription>
                    Distribution of query categories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData?.usage.query_types.map((type, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{type.type}</span>
                        <div className="flex items-center space-x-2">
                          <Progress
                            value={(type.count / (analyticsData?.overview.total_queries || 1)) * 100}
                            className="w-20 h-2"
                          />
                          <span className="text-sm font-medium w-8">{type.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Content Types</CardTitle>
                  <CardDescription>
                    Distribution of document types
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData?.content.content_types.map((type, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{type.type}</div>
                          <div className="text-xs text-muted-foreground">
                            {type.size_mb}MB
                          </div>
                        </div>
                        <Badge variant="outline">{type.count} docs</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Chunk Distribution</CardTitle>
                  <CardDescription>
                    Size distribution of text chunks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData?.content.chunk_distribution.map((range, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{range.size_range}</span>
                        <div className="flex items-center space-x-2">
                          <Progress
                            value={(range.count / (typeof stats?.chunks === 'number' ? stats.chunks : (typeof stats?.chunks === 'object' && (stats.chunks as any)?.total ? (stats.chunks as any).total : 1)) || 1) * 100}
                            className="w-20 h-2"
                          />
                          <span className="text-sm font-medium w-12">{range.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  System Health
                </CardTitle>
                <CardDescription>
                  Overall knowledge base health and performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Index Health</span>
                      <span>{analyticsData?.performance.index_health || 0}%</span>
                    </div>
                    <Progress value={analyticsData?.performance.index_health || 0} />
                    <div className="text-xs text-muted-foreground">Vector index optimization status</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Query Success Rate</span>
                      <span>
                        {analyticsData?.overview.successful_queries && analyticsData?.overview.total_queries
                          ? Math.round((analyticsData.overview.successful_queries / analyticsData.overview.total_queries) * 100)
                          : 0}%
                      </span>
                    </div>
                    <Progress
                      value={
                        analyticsData?.overview.successful_queries && analyticsData?.overview.total_queries
                          ? (analyticsData.overview.successful_queries / analyticsData.overview.total_queries) * 100
                          : 0
                      }
                    />
                    <div className="text-xs text-muted-foreground">Successful vs failed queries</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Storage Efficiency</span>
                      <span>
                        {(typeof stats?.total_size_bytes === 'number' && stats?.total_size_bytes)
                          ? Math.round(((typeof stats?.chunks === 'number' ? stats.chunks : (typeof stats?.chunks === 'object' && (stats.chunks as any)?.total ? (stats.chunks as any).total : 0)) / (stats.total_size_bytes / 1024)) * 100)
                          : 0}%
                      </span>
                    </div>
                    <Progress
                      value={
                        (typeof stats?.total_size_bytes === 'number' && stats?.total_size_bytes)
                          ? Math.min(((typeof stats?.chunks === 'number' ? stats.chunks : (typeof stats?.chunks === 'object' && (stats.chunks as any)?.total ? (stats.chunks as any).total : 0)) / (stats.total_size_bytes / 1024)) * 100, 100)
                          : 0
                      }
                    />
                    <div className="text-xs text-muted-foreground">Chunks per KB ratio</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium mb-2">Processing Stats</div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>Documents processed: {analyticsData?.content.processing_stats.total_processed || 0}</div>
                      <div>Avg processing time: {analyticsData?.content.processing_stats.avg_processing_time || 0}s</div>
                      <div>Processing errors: {analyticsData?.content.processing_stats.processing_errors || 0}</div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium mb-2">Storage Info</div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>Total size: {formatBytes((typeof stats?.total_size_bytes === 'number' ? stats.total_size_bytes : 0) || 0)}</div>
                      <div>Avg chunk size: {(typeof stats?.avg_chunk_size === 'number' ? stats.avg_chunk_size : 0) || 0} chars</div>
                      <div>Last updated: {new Date((typeof stats?.last_updated === 'string' ? stats.last_updated : '') || '').toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}