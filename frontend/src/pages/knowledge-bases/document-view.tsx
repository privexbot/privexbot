/**
 * KB Document View Page
 *
 * View detailed information about a specific document
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ArrowLeft, FileText, Download, Edit, Calendar, Database, AlertCircle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { KnowledgeBase, KBDocument } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import kbClient from '@/lib/kb-client';

export default function KBDocumentViewPage() {
  const { kbId, docId } = useParams<{ kbId: string; docId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, hasPermission } = useApp();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [document, setDocument] = useState<KBDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (kbId && docId && currentWorkspace) {
      loadData();
    }
  }, [kbId, docId, currentWorkspace]);

  const loadData = async () => {
    if (!kbId || !docId || !currentWorkspace) return;

    setIsLoading(true);
    try {
      const [kbData, documentData] = await Promise.all([
        kbClient.kb.get(kbId),
        kbClient.kb.getDocument(kbId, docId)
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
            description: 'You do not have permission to view this document',
            variant: 'destructive'
          });
        }
        navigate('/knowledge-bases');
        return;
      }

      setKb(kbData);
      setDocument(documentData);
    } catch (error) {
      console.error('Failed to load document:', error);
      toast({
        title: 'Error',
        description: 'Failed to load document details',
        variant: 'destructive'
      });
      navigate(`/knowledge-bases/${kbId}/documents`);
    } finally {
      setIsLoading(false);
    }
  };

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
              You do not have permission to view this document.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleDownload = async () => {
    if (!document || !kbId) return;

    try {
      // Implementation would depend on backend API
      toast({
        title: 'Info',
        description: 'Download functionality will be implemented when backend API is available',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async () => {
    if (!document || !kbId || !docId) return;

    try {
      await kbClient.kb.deleteDocument(kbId, docId);

      toast({
        title: 'Success',
        description: `Document "${document.name}" has been deleted`,
      });

      navigate(`/knowledge-bases/${kbId}/documents`);
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive'
      });
    } finally {
      setDeleteDialogOpen(false);
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

  if (!document) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Document not found.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/knowledge-bases/${kbId}/documents`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Documents
            </Button>
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <FileText className="h-6 w-6" />
                {document.name}
              </h1>
              <p className="text-muted-foreground">{kb?.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {hasPermission('kb:edit') && (
              <>
                <Button onClick={() => navigate(`/knowledge-bases/${kbId}/documents/${docId}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Document Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm">
                      {document.content || document.content_preview || (document.metadata?.content as string) || 'Content not available'}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {getStatusIcon((document.metadata?.status as string) || 'unknown')}
                  <Badge variant="outline" className="capitalize">
                    {(document.metadata?.status as string) || 'unknown'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Content Type</div>
                  <div className="text-sm">{document.source_type}</div>
                </div>

                {document.size_bytes && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">File Size</div>
                    <div className="text-sm">{formatFileSize(document.size_bytes)}</div>
                  </div>
                )}

                {document.chunk_count && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Chunks</div>
                    <div className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      {document.chunk_count}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Created</div>
                  <div className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(document.created_at).toLocaleDateString()} at{' '}
                    {new Date(document.created_at).toLocaleTimeString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                  <div className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(document.processed_at || document.created_at).toLocaleDateString()} at{' '}
                    {new Date(document.processed_at || document.created_at).toLocaleTimeString()}
                  </div>
                </div>

                {document.url && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Source URL</div>
                      <div className="text-sm break-all">
                        <a
                          href={document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {document.url}
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Document</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{document?.name}"? This action cannot be undone
                and will permanently remove the document from the knowledge base.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}