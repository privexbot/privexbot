/**
 * Knowledge Bases - Main Overview Page
 *
 * Central hub for all KB management features and operations
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  BookOpen,
  Plus,
  Search,
  MoreHorizontal,
  Settings,
  RefreshCw,
  FileText,
  Eye,
  Trash2,
  Activity,
  Database,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useKBStore } from '@/store/kb-store';
import { KBStatus, KBContext } from '@/types/knowledge-base';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { KBStatsCard } from '@/components/kb/KBStatsCard';
import { KBProcessingStatus } from '@/components/kb/KBProcessingStatus';
import { ComingSoonBadge } from '@/components/ui/coming-soon-badge';

export default function KnowledgeBasesPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedContext, setSelectedContext] = useState<string>('all');
  const [deleteKBId, setDeleteKBId] = useState<string | null>(null);

  const {
    kbs,
    isLoadingList,
    listError,
    activePipelines,
    fetchKBs,
    deleteKB,
    clearListError
  } = useKBStore();

  // Load KBs on mount and filter changes
  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchFilters = {
      workspace_id: currentWorkspace.id,
      status: selectedStatus === 'all' ? undefined : selectedStatus as KBStatus,
      context: selectedContext === 'all' ? undefined : selectedContext as KBContext,
    };

    fetchKBs(fetchFilters);
  }, [currentWorkspace, selectedStatus, selectedContext, fetchKBs]);

  // Filter KBs by search query
  const filteredKBs = kbs.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get processing KBs
  const processingKBs = kbs.filter(kb =>
    kb.status === KBStatus.PROCESSING || kb.status === KBStatus.REINDEXING
  );

  // Calculate stats
  const stats = {
    total: kbs.length,
    ready: kbs.filter(kb => kb.status === KBStatus.READY).length,
    processing: processingKBs.length,
    failed: kbs.filter(kb => kb.status === KBStatus.FAILED).length,
    totalDocuments: kbs.reduce((sum, kb) => sum + (kb.stats?.documents || 0), 0),
    totalChunks: kbs.reduce((sum, kb) => sum + (kb.stats?.chunks || 0), 0)
  };

  const handleCreateKB = () => {
    navigate('/knowledge-bases/create');
  };

  const handleViewKB = (kbId: string) => {
    navigate(`/knowledge-bases/${kbId}`);
  };

  const handleEditKB = (kbId: string) => {
    navigate(`/knowledge-bases/${kbId}/edit`);
  };

  const handleRechunkKB = (kbId: string) => {
    navigate(`/knowledge-bases/${kbId}/rechunk`);
  };

  const handleDeleteKB = async (kbId: string) => {
    try {
      await deleteKB(kbId);
      toast({
        title: 'Knowledge Base Deleted',
        description: 'The knowledge base has been deleted successfully',
      });
      setDeleteKBId(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete knowledge base';
      toast({
        title: 'Delete Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: KBStatus) => {
    switch (status) {
      case KBStatus.READY:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case KBStatus.PROCESSING:
      case KBStatus.REINDEXING:
        return <Clock className="h-4 w-4 text-blue-500" />;
      case KBStatus.FAILED:
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: KBStatus) => {
    const variants = {
      [KBStatus.READY]: 'default',
      [KBStatus.PROCESSING]: 'secondary',
      [KBStatus.REINDEXING]: 'secondary',
      [KBStatus.FAILED]: 'destructive',
      [KBStatus.DRAFT]: 'outline'
    } as const;

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (listError) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {listError}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => { clearListError(); fetchKBs(); }}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Bases</h1>
          <p className="text-muted-foreground mt-1">
            Manage AI knowledge sources in <span className="font-medium">{currentWorkspace?.name || 'your workspace'}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => fetchKBs()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreateKB}>
            <Plus className="h-4 w-4 mr-2" />
            Create Knowledge Base
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KBStatsCard
          title="Total KBs"
          value={stats.total}
          icon={<Database className="h-4 w-4" />}
          trend={stats.total > 0 ? `+${stats.ready} ready` : undefined}
        />
        <KBStatsCard
          title="Documents"
          value={stats.totalDocuments}
          icon={<FileText className="h-4 w-4" />}
          trend={stats.totalDocuments > 0 ? 'Across all KBs' : undefined}
        />
        <KBStatsCard
          title="Chunks"
          value={stats.totalChunks}
          icon={<Activity className="h-4 w-4" />}
          trend={stats.totalChunks > 0 ? 'Ready for queries' : undefined}
        />
        <KBStatsCard
          title="Processing"
          value={stats.processing}
          icon={<Clock className="h-4 w-4" />}
          variant={stats.processing > 0 ? 'warning' : 'default'}
          trend={stats.processing > 0 ? 'In progress' : 'All complete'}
        />
      </div>

      {/* Processing Status */}
      {processingKBs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Processing Status
            </CardTitle>
            <CardDescription>
              Knowledge bases currently being processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {processingKBs.map(kb => (
                <KBProcessingStatus
                  key={kb.id}
                  kb={kb}
                  pipelineStatus={activePipelines[`pipeline_${kb.id}`]}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Management</CardTitle>
          <CardDescription>
            View, edit, and manage your knowledge bases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 justify-between">
              <TabsList>
                <TabsTrigger value="all">All KBs ({stats.total})</TabsTrigger>
                <TabsTrigger value="ready">Ready ({stats.ready})</TabsTrigger>
                <TabsTrigger value="processing">Processing ({stats.processing})</TabsTrigger>
                <TabsTrigger value="failed">Failed ({stats.failed})</TabsTrigger>
              </TabsList>

              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search knowledge bases..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedContext} onValueChange={setSelectedContext}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Context" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Context</SelectItem>
                    <SelectItem value="chatbot">Chatbot</SelectItem>
                    <SelectItem value="chatflow">Chatflow</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="all" className="space-y-4">
              {isLoadingList ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredKBs.length > 0 ? (
                <div className="grid gap-4">
                  {filteredKBs.map((kb) => (
                    <Card key={kb.id} className="transition-colors hover:bg-accent/50">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <BookOpen className="h-5 w-5 text-muted-foreground" />
                              <h3 className="font-semibold text-lg">{kb.name}</h3>
                              {getStatusBadge(kb.status)}
                            </div>

                            {kb.description && (
                              <p className="text-sm text-muted-foreground mb-3">
                                {kb.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                {kb.stats?.documents || 0} documents
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity className="h-4 w-4" />
                                {kb.stats?.chunks || 0} chunks
                              </span>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(kb.status)}
                                {kb.status}
                              </span>
                              <span>
                                Updated {new Date(kb.updated_at || kb.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewKB(kb.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditKB(kb.id)}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Edit Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRechunkKB(kb.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Re-chunk
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/knowledge-bases/${kb.id}/documents`)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Manage Documents
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/knowledge-bases/${kb.id}/analytics`)}>
                                  <TrendingUp className="h-4 w-4 mr-2" />
                                  Analytics
                                  <ComingSoonBadge className="ml-2" />
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteKBId(kb.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Knowledge Bases Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first knowledge base to start building intelligent chatbots
                    </p>
                    <Button onClick={handleCreateKB}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Knowledge Base
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ready" className="space-y-4">
              {isLoadingList ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : kbs.filter(kb => kb.status === KBStatus.READY).length > 0 ? (
                <div className="grid gap-4">
                  {kbs.filter(kb => kb.status === KBStatus.READY).map((kb) => (
                    <Card key={kb.id} className="transition-colors hover:bg-accent/50">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <BookOpen className="h-5 w-5 text-muted-foreground" />
                              <h3 className="font-semibold text-lg">{kb.name}</h3>
                              {getStatusBadge(kb.status)}
                            </div>

                            {kb.description && (
                              <p className="text-sm text-muted-foreground mb-3">
                                {kb.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                {kb.stats?.documents || 0} documents
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity className="h-4 w-4" />
                                {kb.stats?.chunks || 0} chunks
                              </span>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(kb.status)}
                                {kb.status}
                              </span>
                              <span>
                                Updated {new Date(kb.updated_at || kb.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewKB(kb.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditKB(kb.id)}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Edit Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRechunkKB(kb.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Re-chunk
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/knowledge-bases/${kb.id}/documents`)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Manage Documents
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/knowledge-bases/${kb.id}/analytics`)}>
                                  <TrendingUp className="h-4 w-4 mr-2" />
                                  Analytics
                                  <ComingSoonBadge className="ml-2" />
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteKBId(kb.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No ready knowledge bases found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="processing" className="space-y-4">
              {isLoadingList ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : processingKBs.length > 0 ? (
                <div className="grid gap-4">
                  {processingKBs.map((kb) => (
                    <Card key={kb.id} className="transition-colors hover:bg-accent/50">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <BookOpen className="h-5 w-5 text-muted-foreground" />
                              <h3 className="font-semibold text-lg">{kb.name}</h3>
                              {getStatusBadge(kb.status)}
                            </div>

                            {kb.description && (
                              <p className="text-sm text-muted-foreground mb-3">
                                {kb.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                {kb.stats?.documents || 0} documents
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity className="h-4 w-4" />
                                {kb.stats?.chunks || 0} chunks
                              </span>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(kb.status)}
                                {kb.status}
                              </span>
                              <span>
                                Updated {new Date(kb.updated_at || kb.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/knowledge-bases/${kb.id}/processing?pipeline=${kb.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Progress
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditKB(kb.id)}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Edit Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteKBId(kb.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No processing knowledge bases found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="failed" className="space-y-4">
              {isLoadingList ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : kbs.filter(kb => kb.status === KBStatus.FAILED).length > 0 ? (
                <div className="grid gap-4">
                  {kbs.filter(kb => kb.status === KBStatus.FAILED).map((kb) => (
                    <Card key={kb.id} className="transition-colors hover:bg-accent/50">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <BookOpen className="h-5 w-5 text-muted-foreground" />
                              <h3 className="font-semibold text-lg">{kb.name}</h3>
                              {getStatusBadge(kb.status)}
                            </div>

                            {kb.description && (
                              <p className="text-sm text-muted-foreground mb-3">
                                {kb.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                {kb.stats?.documents || 0} documents
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity className="h-4 w-4" />
                                {kb.stats?.chunks || 0} chunks
                              </span>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(kb.status)}
                                {kb.status}
                              </span>
                              <span>
                                Updated {new Date(kb.updated_at || kb.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewKB(kb.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditKB(kb.id)}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Edit Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRechunkKB(kb.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Retry Processing
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteKBId(kb.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No failed knowledge bases found</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteKBId} onOpenChange={() => setDeleteKBId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Knowledge Base?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the knowledge base
              and all its associated documents and chunks.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteKBId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteKBId && handleDeleteKB(deleteKBId)}
            >
              Delete Knowledge Base
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}