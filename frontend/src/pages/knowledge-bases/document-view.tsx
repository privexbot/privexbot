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
import { KnowledgeBase, KBDocument, formatDocumentSourceType, formatDocumentSource } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  /**
   * Check if document can be edited
   * File upload documents cannot be edited since content is in Qdrant only
   */
  const canEditDocument = (): boolean => {
    if (!document) return false;
    if (document.source_type === 'file_upload') return false;
    if ((document as any).processing_metadata?.chunk_storage_location === 'qdrant_only') return false;
    return true;
  };

  /**
   * Check if document can be downloaded
   * File upload documents cannot be downloaded since content is in Qdrant only (not PostgreSQL)
   */
  const canDownloadDocument = (): boolean => {
    if (!document) return false;
    if (document.source_type === 'file_upload') return false;
    if ((document as any).processing_metadata?.chunk_storage_location === 'qdrant_only') return false;
    return true;
  };

  const handleDownload = async (format: 'txt' | 'md' | 'json') => {
    if (!document || !kbId || !docId) return;

    try {
      const blob = await kbClient.kb.downloadDocument(kbId, docId, format);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;

      // Generate filename
      const safeName = document.name.replace(/[^a-zA-Z0-9._\- ]/g, '').trim() || 'document';
      a.download = `${safeName}.${format}`;

      // Trigger download
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Download Started',
        description: `Downloading ${document.name} as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
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
      <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-8">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/knowledge-bases/${kbId}/documents`)}
            className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-manrope"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-manrope break-words">
                    {document.name}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 font-manrope text-base">
                    Knowledge Base: <span className="font-medium text-blue-700 dark:text-blue-300">{kb?.name}</span>
                  </p>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(document.status || 'pending')}
                    <Badge variant="outline" className="capitalize font-manrope">
                      {document.status || 'pending'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {canDownloadDocument() ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="font-manrope">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleDownload('txt')} className="font-manrope cursor-pointer">
                        <FileText className="h-4 w-4 mr-2" />
                        Plain Text (.txt)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload('md')} className="font-manrope cursor-pointer">
                        <FileText className="h-4 w-4 mr-2" />
                        Markdown (.md)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload('json')} className="font-manrope cursor-pointer">
                        <Database className="h-4 w-4 mr-2" />
                        JSON (.json)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button variant="outline" disabled className="font-manrope text-gray-400 dark:text-gray-500 cursor-not-allowed">
                    <Download className="h-4 w-4 mr-2" />
                    Download (File Upload)
                  </Button>
                )}
                {hasPermission('kb:edit') && (
                  <>
                    {canEditDocument() ? (
                      <Button onClick={() => navigate(`/knowledge-bases/${kbId}/documents/${docId}/edit`)} className="font-manrope">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    ) : (
                      <Button variant="outline" disabled className="font-manrope text-gray-400 dark:text-gray-500 cursor-not-allowed">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit (File Upload)
                      </Button>
                    )}
                    <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="font-manrope">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Document Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-b border-emerald-200 dark:border-emerald-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-xl font-bold text-emerald-900 dark:text-emerald-100 font-manrope">Document Content</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed overflow-x-auto">
                    {document.content || document.content_preview || (document.metadata?.content as string) || 'Content not available'}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-200 dark:border-purple-700 rounded-t-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <CardTitle className="text-lg font-bold text-purple-900 dark:text-purple-100 font-manrope">Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(document.status || 'pending')}
                  <Badge variant="outline" className="capitalize font-manrope">
                    {document.status || 'pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border-b border-cyan-200 dark:border-cyan-700 rounded-t-xl p-4">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  <CardTitle className="text-lg font-bold text-cyan-900 dark:text-cyan-100 font-manrope">Document Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 font-manrope">Content Type</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope">{formatDocumentSourceType(document.content_type || document.source_type)}</div>
                </div>

                {document.size_bytes && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 space-y-2">
                    <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 font-manrope">File Size</div>
                    <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope">{formatFileSize(document.size_bytes)}</div>
                  </div>
                )}

                {document.chunk_count && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 space-y-2">
                    <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 font-manrope">Chunks</div>
                    <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope flex items-center gap-2">
                      <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      {document.chunk_count}
                    </div>
                  </div>
                )}

                <Separator className="border-gray-200 dark:border-gray-600" />

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 font-manrope">Created</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    {document.created_at
                      ? `${new Date(document.created_at).toLocaleDateString()} at ${new Date(document.created_at).toLocaleTimeString()}`
                      : 'Not available'}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 font-manrope">Last Updated</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    {(() => {
                      const lastUpdated = document.updated_at || document.processed_at || document.created_at;
                      return lastUpdated
                        ? `${new Date(lastUpdated).toLocaleDateString()} at ${new Date(lastUpdated).toLocaleTimeString()}`
                        : 'Not available';
                    })()}
                  </div>
                </div>

                <Separator className="border-gray-200 dark:border-gray-600" />

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 font-manrope">Source</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope break-all">
                    {document.url ? (
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                      >
                        {document.url}
                      </a>
                    ) : (
                      <span>
                        {formatDocumentSource(document.source_type, null, document.source_metadata)}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-xl shadow-xl max-w-md">
            <DialogHeader className="text-center pb-4">
              <AlertCircle className="w-12 h-12 mx-auto text-red-600 dark:text-red-400 mb-4" />
              <DialogTitle className="text-xl font-bold text-red-900 dark:text-red-100 font-manrope">Delete Document</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed mt-3">
                Are you sure you want to delete <span className="font-semibold text-red-700 dark:text-red-300">"{document?.name}"</span>?
                <br /><br />
                This action <span className="font-semibold">cannot be undone</span> and will permanently remove the document from the knowledge base.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 font-manrope"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}