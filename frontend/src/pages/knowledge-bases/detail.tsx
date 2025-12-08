/**
 * Knowledge Base Detail Page
 *
 * Shows detailed view of a specific knowledge base with documents, chunks, and management options
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeft,
  FileText,
  Database,
  Settings,
  Trash2,
  RefreshCw,
  Download,
  Search,
  Filter,
  BookOpen,
  Eye,
  Edit,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle
} from 'lucide-react';
import kbClient from '@/lib/kb-client';
import { useApp } from '@/contexts/AppContext';
import { KnowledgeBase, KBDocument } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

export default function KBDetailPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, hasPermission, workspaces, switchWorkspace } = useApp();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [chunks, setChunks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);


  useEffect(() => {
    if (kbId && currentWorkspace) {
      loadKBData();
    }
  }, [kbId, currentWorkspace]);

  const loadKBData = async () => {
    if (!kbId || !currentWorkspace) return;

    setIsLoading(true);
    try {
      // Load KB details
      const kbData = await kbClient.kb.get(kbId);

      // Verify KB belongs to current workspace
      if (kbData.workspace_id !== currentWorkspace.id) {
        // Check if user has access to the KB's workspace
        const kbWorkspace = workspaces.find(ws => ws.id === kbData.workspace_id);

        if (kbWorkspace) {
          // User has access to the workspace, suggest switching
          toast({
            title: 'Wrong Workspace',
            description: `This knowledge base belongs to "${kbWorkspace.name}". Please switch to that workspace to access it.`,
            variant: 'destructive'
          });
        } else {
          // User doesn't have access to the workspace
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to view this knowledge base',
            variant: 'destructive'
          });
        }
        navigate('/knowledge-bases');
        return;
      }

      setKb(kbData);

      // Load documents and chunks in parallel
      const [documentsData, chunksData] = await Promise.all([
        kbClient.kb.getDocuments(kbId),
        kbClient.kb.getChunks(kbId)
      ]);


      setDocuments(documentsData || []);
      setChunks(chunksData || []);
    } catch (error) {
      console.error('Failed to load KB data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load knowledge base details',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKB = async () => {
    if (!kbId || !kb) return;

    try {
      await kbClient.kb.delete(kbId);
      toast({
        title: 'Success',
        description: `Knowledge base "${kb.name}" has been deleted`,
      });
      setDeleteDialogOpen(false);
      navigate('/knowledge-bases');
    } catch (error) {
      console.error('Failed to delete KB:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete knowledge base',
        variant: 'destructive'
      });
      setDeleteDialogOpen(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'draft':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ready: "default",
      processing: "secondary",
      failed: "destructive",
      draft: "outline"
    };
    return variants[status] || "outline";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <RefreshCw className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h3 className="text-lg font-medium">Loading Knowledge Base</h3>
            <p className="text-muted-foreground">Fetching details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!kb) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Knowledge base not found or you don't have access to it.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => navigate('/knowledge-bases')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Bases
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/knowledge-bases')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Bases
          </Button>

          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">{kb.name}</h1>
                <div className="flex items-center gap-2">
                  {getStatusIcon(kb.status)}
                  <Badge variant={getStatusBadge(kb.status)}>
                    {kb.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              {kb.description && (
                <p className="text-muted-foreground text-lg">{kb.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Created {new Date(kb.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>{Array.isArray(documents) ? documents.length : (kb as any).total_documents || 0} documents</span>
                <span>•</span>
                <span>{Array.isArray(chunks) ? chunks.length : (kb as any).total_chunks || 0} chunks</span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setActiveTab('settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={loadKBData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                  <span className="text-red-500">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-2xl font-bold">
                  {Array.isArray(documents) ? documents.length : (kb as any).total_documents || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Chunks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-green-500" />
                <span className="text-2xl font-bold">
                  {Array.isArray(chunks) ? chunks.length : (kb as any).total_chunks || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Words
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-purple-500" />
                <span className="text-2xl font-bold">
                  {Array.isArray(documents)
                    ? documents.reduce((acc, doc) => acc + ((doc as any).word_count || 0), 0).toLocaleString()
                    : '0'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Chunk Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-orange-500" />
                <span className="text-2xl font-bold">
                  {Array.isArray(chunks) && chunks.length > 0
                    ? Math.round(chunks.reduce((acc, chunk) => acc + (chunk.character_count || 0), 0) / chunks.length)
                    : 0
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="chunks">Chunks</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Base Information</CardTitle>
                  <CardDescription>
                    Basic information and configuration details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">ID</label>
                      <p className="font-mono text-sm">{kb.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Context</label>
                      <p className="capitalize">{kb.context || 'both'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Chunking Strategy</label>
                      <p className="capitalize">
                        {((kb as any).config?.chunking_config?.strategy ||
                          (kb as any).chunking_config?.strategy ||
                          (kb as any).config?.chunking?.strategy ||
                          'by_heading'
                        ).replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                      <p>{kb.updated_at ? new Date(kb.updated_at).toLocaleString() : 'Never'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>
                  Documents ({Array.isArray(documents) ? documents.length : (kb as any).total_documents || 0})
                </CardTitle>
                <CardDescription>
                  All documents in this knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!Array.isArray(documents) || documents.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                    <p className="text-muted-foreground">
                      Documents will appear here after processing
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(documents) && documents.map((doc) => (
                      <div key={doc.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <h4 className="font-medium">{(doc as any).name || doc.title}</h4>
                              <Badge variant="outline">{(doc as any).source_type || 'unknown'}</Badge>
                              <div className="flex items-center gap-1">
                                {getStatusIcon((doc as any).status || 'unknown')}
                                <Badge variant={getStatusBadge((doc as any).status || 'unknown')} className="text-xs">
                                  {(doc as any).status || 'unknown'}
                                </Badge>
                              </div>
                            </div>
                            {(doc as any).url && (
                              <p className="text-sm text-muted-foreground mb-2">
                                Source: <a href={(doc as any).url || '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {(doc as any).url || '#'}
                                </a>
                              </p>
                            )}
                            {(doc as any).content_preview && (
                              <p className="text-sm text-muted-foreground mb-2">{(doc as any).content_preview || 'No preview available'}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{(doc as any).word_count || 0} words</span>
                              <span>•</span>
                              <span>{doc.chunk_count || 0} chunks</span>
                              <span>•</span>
                              <span>{new Date(doc.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => navigate(`/knowledge-bases/${kbId}/documents/${doc.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Content
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => navigate(`/knowledge-bases/${kbId}/documents/${doc.id}/edit`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chunks">
            <Card>
              <CardHeader>
                <CardTitle>
                  Chunks ({Array.isArray(chunks) ? chunks.length : (kb as any).total_chunks || 0})
                </CardTitle>
                <CardDescription>
                  Text chunks used for search and retrieval
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!Array.isArray(chunks) || chunks.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No chunks yet</h3>
                    <p className="text-muted-foreground">
                      Chunks will appear here after document processing
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(chunks) && chunks.slice(0, 20).map((chunk, index) => (
                      <div key={chunk.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">Chunk {chunk.position || index + 1}</span>
                            {chunk.document_name && (
                              <Badge variant="outline" className="text-xs">
                                {chunk.document_name}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {chunk.character_count || 0} chars
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                    {Array.isArray(chunks) && chunks.length > 20 && (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground">
                          Showing first 20 chunks of {Array.isArray(chunks) ? chunks.length : 0} total
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Base Settings</CardTitle>
                <CardDescription>
                  Configuration and management options
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-4">Chunking Configuration</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="font-medium text-muted-foreground">Strategy</label>
                        <p className="capitalize">
                          {((kb as any).config?.chunking_config?.strategy ||
                            (kb as any).chunking_config?.strategy ||
                            (kb as any).config?.chunking?.strategy ||
                            'by_heading'
                          ).replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-muted-foreground">Chunk Size</label>
                        <p>
                          {(kb as any).config?.chunking_config?.chunk_size ||
                           (kb as any).chunking_config?.chunk_size ||
                           (kb as any).config?.chunking?.chunk_size ||
                           '1000'} characters
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-muted-foreground">Chunk Overlap</label>
                        <p>
                          {(kb as any).config?.chunking_config?.chunk_overlap ||
                           (kb as any).chunking_config?.chunk_overlap ||
                           (kb as any).config?.chunking?.chunk_overlap ||
                           '200'} characters
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-muted-foreground">Preserve Headings</label>
                        <p>
                          {((kb as any).config?.chunking_config?.preserve_headings ||
                            (kb as any).chunking_config?.preserve_headings ||
                            (kb as any).config?.chunking?.preserve_headings) ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-4">Model Configuration</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="font-medium text-muted-foreground">Embedding Model</label>
                        <p>
                          {(kb as any).config?.embedding?.model ||
                           kb.embedding_config?.model ||
                           'all-MiniLM-L6-v2'}
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-muted-foreground">Vector Store</label>
                        <p>
                          {(kb as any).config?.vector_store?.provider ||
                           kb.vector_store_config?.provider ||
                           'qdrant'}
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-muted-foreground">Indexing Method</label>
                        <p className="capitalize">
                          {((kb as any).indexing_method || 'high_quality').replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-muted-foreground">Context</label>
                        <p className="capitalize">{kb.context || 'both'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-4 text-red-600">Danger Zone</h4>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium">Delete Knowledge Base</h5>
                            <p className="text-sm text-muted-foreground">
                              This will permanently delete this knowledge base and all its data
                            </p>
                          </div>
                          <Button variant="destructive" onClick={handleDeleteKB}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Knowledge Base</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{kb?.name}"? This action cannot be undone
                and will permanently remove the knowledge base and all its data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteKB}>
                Delete Knowledge Base
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}