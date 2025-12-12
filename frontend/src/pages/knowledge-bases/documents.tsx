/**
 * KB Documents Management Page
 *
 * Manage documents within a knowledge base with workspace validation
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeft,
  FileText,
  Upload,
  Trash2,
  Edit,
  Eye,
  Search,
  Plus,
  MoreHorizontal,
  AlertCircle,
  CheckCircle,
  Clock,
  Download
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { KnowledgeBase, KBDocument, formatDocumentSourceType, formatDocumentSource } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import kbClient from '@/lib/kb-client';

export default function KBDocumentsPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, hasPermission } = useApp();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textDocumentData, setTextDocumentData] = useState<{
    title: string;
    content: string;
  }>({
    title: '',
    content: ''
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; title: string } | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    if (!kbId || !currentWorkspace) return;

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
            description: 'You do not have permission to view this knowledge base',
            variant: 'destructive'
          });
        }
        navigate('/knowledge-bases');
        return;
      }

      setKb(kbData);
      setDocuments(Array.isArray(documentsData) ? documentsData : []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load knowledge base data',
        variant: 'destructive'
      });
      navigate('/knowledge-bases');
    } finally {
      setIsLoading(false);
    }
  }, [kbId, currentWorkspace, workspaces, navigate]);

  useEffect(() => {
    if (kbId) {
      loadData();
    }
  }, [kbId, loadData]);

  // Poll for document status updates
  useEffect(() => {
    const hasProcessingDocs = documents.some(doc =>
      (doc.metadata?.status as string) === 'processing' || doc.status === 'processing'
    );

    if (hasProcessingDocs && !pollingInterval) {
      const interval = setInterval(() => {
        loadData();
      }, 3000); // Poll every 3 seconds
      setPollingInterval(interval);
    } else if (!hasProcessingDocs && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [documents, pollingInterval, loadData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

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
    toast({
      title: 'Access Denied',
      description: 'You do not have permission to view this knowledge base',
      variant: 'destructive'
    });
    navigate('/knowledge-bases');
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

  const handleFileUpload = async () => {
    if (!selectedFile || !kbId) return;

    setIsUploading(true);
    try {
      const newDocument = await kbClient.kb.uploadDocument(kbId, selectedFile);
      setDocuments(prev => [newDocument, ...(Array.isArray(prev) ? prev : [])]);
      setUploadDialogOpen(false);
      setSelectedFile(null);

      toast({
        title: 'Success',
        description: 'Document uploaded successfully. Processing...',
      });

      // Start polling immediately if document is in processing state
      if (newDocument.status === 'processing') {
        setTimeout(() => loadData(), 2000); // First poll after 2 seconds
      }
    } catch (error: any) {
      console.error('Failed to upload document:', error);

      let errorMessage = 'Failed to upload document';
      if (error.message.includes('too large')) {
        errorMessage = 'File is too large (max 10MB)';
      } else if (error.message.includes('format')) {
        errorMessage = 'Unsupported file format. Please use Text, Markdown, CSV, or JSON files.';
      } else if (error.message.includes('limit reached')) {
        errorMessage = 'Document limit reached for this knowledge base';
      } else if (error.message.includes('Access denied')) {
        errorMessage = 'You do not have permission to add documents to this knowledge base';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateTextDocument = async () => {
    if (!textDocumentData.title.trim() || !textDocumentData.content.trim() || !kbId) return;

    setIsUploading(true);
    try {
      const documentData = {
        name: textDocumentData.title.trim(),
        content: textDocumentData.content.trim(),
        source_type: 'text_input'
      };

      const newDocument = await kbClient.kb.createDocument(kbId, documentData);
      setDocuments(prev => [newDocument, ...(Array.isArray(prev) ? prev : [])]);
      setTextDialogOpen(false);
      setTextDocumentData({
        title: '',
        content: ''
      });

      toast({
        title: 'Success',
        description: 'Document created successfully. Processing...',
      });

      // Start polling immediately if document is in processing state
      if (newDocument.status === 'processing') {
        setTimeout(() => loadData(), 2000); // First poll after 2 seconds
      }
    } catch (error: any) {
      console.error('Failed to create document:', error);

      let errorMessage = 'Failed to create text document';
      if (error.message.includes('50 characters')) {
        errorMessage = 'Content must be at least 50 characters long';
      } else if (error.message.includes('too large')) {
        errorMessage = 'Content is too large (max 10MB)';
      } else if (error.message.includes('limit reached')) {
        errorMessage = 'Document limit reached for this knowledge base';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = (docId: string, title: string) => {
    setDocumentToDelete({ id: docId, title });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete || !kbId) return;

    try {
      await kbClient.kb.deleteDocument(kbId, documentToDelete.id);
      setDocuments(prev => Array.isArray(prev) ? prev.filter(doc => doc.id !== documentToDelete.id) : []);

      toast({
        title: 'Success',
        description: `Document "${documentToDelete.title}" has been deleted`,
      });
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive'
      });
    } finally {
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const filteredDocuments = Array.isArray(documents)
    ? documents.filter(doc =>
        (doc.name || doc.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.source_type || doc.content_type || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

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
              <h1 className="text-2xl font-semibold">Documents</h1>
              <p className="text-muted-foreground">{kb?.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {hasPermission('kb:edit') && (
              <>
                <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Text
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Text Document</DialogTitle>
                      <DialogDescription>
                        Add a text document directly to the knowledge base
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                          id="title"
                          placeholder="Document title"
                          value={textDocumentData.title}
                          onChange={(e) => setTextDocumentData(prev => ({
                            ...prev,
                            title: e.target.value
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="content">Content</Label>
                          <span className={`text-sm ${textDocumentData.content.length < 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {textDocumentData.content.length}/50 min
                          </span>
                        </div>
                        <Textarea
                          id="content"
                          placeholder="Enter the document content (minimum 50 characters)..."
                          rows={10}
                          value={textDocumentData.content}
                          onChange={(e) => setTextDocumentData(prev => ({
                            ...prev,
                            content: e.target.value
                          }))}
                          className={textDocumentData.content.length > 0 && textDocumentData.content.length < 50 ? 'border-destructive' : ''}
                        />
                        {textDocumentData.content.length > 0 && textDocumentData.content.length < 50 && (
                          <p className="text-sm text-destructive">Content must be at least 50 characters long</p>
                        )}
                      </div>


                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setTextDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateTextDocument}
                          disabled={isUploading || !textDocumentData.title.trim() || !textDocumentData.content.trim() || textDocumentData.content.length < 50}
                        >
                          {isUploading ? 'Creating...' : 'Create Document'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Document</DialogTitle>
                      <DialogDescription>
                        Upload a file to add to the knowledge base. Supported formats: Text, Markdown, CSV, JSON (max 10MB)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="file">Select File</Label>
                        <Input
                          id="file"
                          type="file"
                          accept=".txt,.md,.csv,.json"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                        <p className="text-sm text-muted-foreground">
                          Supported formats: Text (.txt), Markdown (.md), CSV (.csv), JSON (.json). Files will be automatically processed and chunked for optimal search performance.
                        </p>
                      </div>
                      {selectedFile && (
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-medium">{selectedFile.name}</span>
                            <Badge variant="outline">{formatFileSize(selectedFile.size)}</Badge>
                          </div>
                        </div>
                      )}


                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleFileUpload}
                          disabled={isUploading || !selectedFile}
                        >
                          {isUploading ? 'Uploading...' : 'Upload'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="outline">
            {filteredDocuments.length} of {documents.length} documents
          </Badge>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          {filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  {documents.length === 0 ? 'No documents yet' : 'No documents match your search'}
                </h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {documents.length === 0
                    ? 'Upload files or create text documents to get started with your knowledge base.'
                    : 'Try adjusting your search terms or browse all documents.'
                  }
                </p>
                {documents.length === 0 && hasPermission('kb:edit') && (
                  <div className="flex space-x-2 mt-4">
                    <Button variant="outline" onClick={() => setTextDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Text
                    </Button>
                    <Button onClick={() => setUploadDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredDocuments.map((document) => (
              <Card key={document.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getStatusIcon((document.metadata?.status as string) || 'unknown')}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-lg">{document.name || document.title}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                          <span>{formatDocumentSourceType(document.source_type || document.content_type)}</span>
                          {document.size_bytes && (
                            <span>{formatFileSize(document.size_bytes)}</span>
                          )}
                          {document.chunk_count ? (
                            <span>{document.chunk_count} chunks</span>
                          ) : (
                            ((document.metadata?.status as string) === 'processing' || document.status === 'processing') && (
                              <span className="text-amber-600">Processing...</span>
                            )
                          )}
                          <span>
                            Added {new Date(document.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          Source: {formatDocumentSource(document.source_type, document.url, document.source_metadata)}
                        </div>
                      </div>
                    </div>

                    {hasPermission('kb:edit') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => navigate(`/knowledge-bases/${kbId}/documents/${document.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => navigate(`/knowledge-bases/${kbId}/documents/${document.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteClick(document.id, document.name || document.title || 'Untitled Document')}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Document</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{documentToDelete?.title}"? This action cannot be undone
                and will permanently remove the document from the knowledge base.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Delete Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}