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

    // Client-side validation based on KB type
    const formats = getSupportedFormats();
    const maxSizeBytes = isFileUploadOnlyKB() ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

    // Validate file size
    if (selectedFile.size > maxSizeBytes) {
      toast({
        title: 'Error',
        description: `File is too large. Maximum size: ${formats.maxSize}`,
        variant: 'destructive'
      });
      return;
    }

    // Validate file extension
    const fileExtension = selectedFile.name.toLowerCase().split('.').pop() || '';
    const allowedExtensions = formats.accept.split(',').map(ext => ext.replace('.', ''));

    if (!allowedExtensions.includes(fileExtension)) {
      toast({
        title: 'Error',
        description: `Unsupported file format (.${fileExtension}). ${formats.hint.split('.')[0]}.`,
        variant: 'destructive'
      });
      return;
    }

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
        errorMessage = `File is too large (max ${formats.maxSize})`;
      } else if (error.message.includes('format')) {
        errorMessage = isFileUploadOnlyKB()
          ? 'Unsupported file format. This knowledge base supports PDF, Word, Excel, and more.'
          : 'Unsupported file format. Please use Text, Markdown, CSV, or JSON files.';
      } else if (error.message.includes('Tika')) {
        errorMessage = 'File parsing failed. The file may be corrupted or password-protected.';
      } else if (error.message.includes('limit reached')) {
        errorMessage = 'Document limit reached for this knowledge base';
      } else if (error.message.includes('Access denied')) {
        errorMessage = 'You do not have permission to add documents to this knowledge base';
      } else if (error.message) {
        errorMessage = error.message;
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

  /**
   * Check if this KB is a file-upload-only KB
   * Used to restrict adding text documents and editing
   */
  const isFileUploadOnlyKB = (): boolean => {
    if (!Array.isArray(documents) || documents.length === 0) return false;
    return documents.every((doc: KBDocument) => doc.source_type === 'file_upload');
  };

  /**
   * Check if a document can be edited
   * File upload documents cannot be edited since content is in Qdrant only
   */
  const canEditDocument = (doc: KBDocument): boolean => {
    if (doc.source_type === 'file_upload') return false;
    if ((doc as any).processing_metadata?.chunk_storage_location === 'qdrant_only') return false;
    return true;
  };

  /**
   * Get supported file formats based on KB type
   * - File Upload KBs: Robust formats via Tika (PDF, Word, etc.)
   * - Web URL KBs: Simple text formats only
   */
  const getSupportedFormats = () => {
    if (isFileUploadOnlyKB()) {
      return {
        accept: '.pdf,.doc,.docx,.txt,.md,.csv,.json,.xlsx,.xls,.pptx,.ppt,.rtf,.odt,.html,.htm,.xml',
        description: 'PDF, Word, Excel, PowerPoint, Text, Markdown, CSV, JSON, and more',
        hint: 'Supported formats: PDF (.pdf), Word (.doc, .docx), Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt), Text (.txt), Markdown (.md), CSV (.csv), JSON (.json), RTF (.rtf), HTML (.html), XML (.xml). Files are parsed using Apache Tika for accurate text extraction.',
        maxSize: '50MB'
      };
    }
    return {
      accept: '.txt,.md,.csv,.json',
      description: 'Text, Markdown, CSV, JSON',
      hint: 'Supported formats: Text (.txt), Markdown (.md), CSV (.csv), JSON (.json). For more file formats like PDF or Word documents, create a new knowledge base using the file upload option.',
      maxSize: '10MB'
    };
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
      <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-8">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/knowledge-bases/${kbId}`)}
            className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-manrope"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Base
          </Button>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <FileText className="h-8 w-8 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-manrope">
                    Documents
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 font-manrope text-base">
                    Knowledge Base: <span className="font-medium text-purple-700 dark:text-purple-300">{kb?.name}</span>
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 font-manrope text-sm">
                    Manage your document collection and content sources
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {hasPermission('kb:edit') && (
                  <>
                    {/* Only show Add Text button for non-file-upload KBs */}
                    {!isFileUploadOnlyKB() && (
                      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="font-manrope">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Text
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                        <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
                          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white font-manrope flex items-center gap-2">
                            <Plus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            Create Text Document
                          </DialogTitle>
                          <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                            Add a text document directly to the knowledge base
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 pt-4">
                          <div className="space-y-3">
                            <Label htmlFor="title" className="text-base font-semibold text-gray-900 dark:text-gray-100 font-manrope">Document Title</Label>
                            <Input
                              id="title"
                              placeholder="Enter document title..."
                              value={textDocumentData.title}
                              onChange={(e) => setTextDocumentData(prev => ({
                                ...prev,
                                title: e.target.value
                              }))}
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm font-manrope text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="content" className="text-base font-semibold text-gray-900 dark:text-gray-100 font-manrope">Content</Label>
                              <span className={`text-sm font-manrope ${textDocumentData.content.length < 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                {textDocumentData.content.length}/50 min
                              </span>
                            </div>
                            <Textarea
                              id="content"
                              placeholder="Enter the document content (minimum 50 characters)..."
                              rows={12}
                              value={textDocumentData.content}
                              onChange={(e) => setTextDocumentData(prev => ({
                                ...prev,
                                content: e.target.value
                              }))}
                              className={`font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent ${textDocumentData.content.length > 0 && textDocumentData.content.length < 50 ? 'border-red-300 dark:border-red-600' : ''}`}
                            />
                            {textDocumentData.content.length > 0 && textDocumentData.content.length < 50 && (
                              <p className="text-sm text-red-600 dark:text-red-400 font-manrope">Content must be at least 50 characters long</p>
                            )}
                          </div>

                          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button variant="outline" onClick={() => setTextDialogOpen(false)} className="font-manrope">
                              Cancel
                            </Button>
                            <Button
                              onClick={handleCreateTextDocument}
                              disabled={isUploading || !textDocumentData.title.trim() || !textDocumentData.content.trim() || textDocumentData.content.length < 50}
                              className="font-manrope bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500"
                            >
                              {isUploading ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Create Document
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    )}

                    <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="font-manrope bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload File
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                        <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
                          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white font-manrope flex items-center gap-2">
                            <Upload className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            Upload Document
                          </DialogTitle>
                          <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                            Upload a file to add to the knowledge base. Supported formats: {getSupportedFormats().description} (max {getSupportedFormats().maxSize})
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 pt-4">
                          <div className="space-y-3">
                            <Label htmlFor="file" className="text-base font-semibold text-gray-900 dark:text-gray-100 font-manrope">Select File</Label>
                            <Input
                              id="file"
                              type="file"
                              accept={getSupportedFormats().accept}
                              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm font-manrope text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
                            />
                            <div className={`${isFileUploadOnlyKB() ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700' : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'} border rounded-lg p-3`}>
                              <p className={`text-sm ${isFileUploadOnlyKB() ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'} font-manrope leading-relaxed`}>
                                {getSupportedFormats().hint}
                              </p>
                            </div>
                          </div>
                          {selectedFile && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-green-900 dark:text-green-100 font-manrope truncate">{selectedFile.name}</p>
                                  <p className="text-sm text-green-700 dark:text-green-300 font-manrope">{formatFileSize(selectedFile.size)}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} className="font-manrope">
                              Cancel
                            </Button>
                            <Button
                              onClick={handleFileUpload}
                              disabled={isUploading || !selectedFile}
                              className="font-manrope bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500"
                            >
                              {isUploading ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                  </DialogContent>
                </Dialog>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm font-manrope text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
              />
            </div>
            <Badge variant="outline" className="font-manrope">
              {filteredDocuments.length} of {documents.length} documents
            </Badge>
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-6">
          {filteredDocuments.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="h-16 w-16 text-gray-400 dark:text-gray-500 mb-6" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-manrope mb-3">
                  {documents.length === 0 ? 'No documents yet' : 'No documents match your search'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 font-manrope text-center max-w-md leading-relaxed">
                  {documents.length === 0
                    ? 'Upload files or create text documents to get started with your knowledge base.'
                    : 'Try adjusting your search terms or browse all documents.'
                  }
                </p>
                {documents.length === 0 && hasPermission('kb:edit') && (
                  <div className="flex flex-wrap gap-3 mt-6">
                    {/* Only show Add Text button for non-file-upload KBs */}
                    {!isFileUploadOnlyKB() && (
                      <Button variant="outline" onClick={() => setTextDialogOpen(true)} className="font-manrope">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Text
                      </Button>
                    )}
                    <Button onClick={() => setUploadDialogOpen(true)} className="font-manrope bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredDocuments.map((document) => (
              <Card key={document.id} className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {getStatusIcon((document.metadata?.status as string) || 'unknown')}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 font-manrope leading-tight">
                          {document.name || document.title}
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 font-manrope mb-1">Type</div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                              {formatDocumentSourceType(document.source_type || document.content_type)}
                            </div>
                          </div>

                          {document.size_bytes && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 font-manrope mb-1">Size</div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                                {formatFileSize(document.size_bytes)}
                              </div>
                            </div>
                          )}

                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 font-manrope mb-1">Status</div>
                            <div className="text-sm font-medium font-manrope">
                              {document.chunk_count ? (
                                <span className="text-green-700 dark:text-green-400">{document.chunk_count} chunks</span>
                              ) : (
                                ((document.metadata?.status as string) === 'processing' || document.status === 'processing') ? (
                                  <span className="text-amber-600 dark:text-amber-400">Processing...</span>
                                ) : (
                                  <span className="text-gray-600 dark:text-gray-400">Ready</span>
                                )
                              )}
                            </div>
                          </div>

                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 font-manrope mb-1">Added</div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                              {new Date(document.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                          <div className="text-xs font-medium text-blue-700 dark:text-blue-300 font-manrope mb-1">Source</div>
                          <div className="text-sm text-blue-800 dark:text-blue-200 font-manrope">
                            {formatDocumentSource(document.source_type, document.url, document.source_metadata)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {hasPermission('kb:edit') && (
                      <div className="flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                            <DropdownMenuItem
                              onSelect={() => navigate(`/knowledge-bases/${kbId}/documents/${document.id}`)}
                              className="font-manrope hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            >
                              <Eye className="h-4 w-4 mr-3 text-blue-600 dark:text-blue-400" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="font-manrope hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <Download className="h-4 w-4 mr-3 text-green-600 dark:text-green-400" />
                              Download
                            </DropdownMenuItem>
                            {canEditDocument(document) ? (
                              <DropdownMenuItem
                                onSelect={() => navigate(`/knowledge-bases/${kbId}/documents/${document.id}/edit`)}
                                className="font-manrope hover:bg-gray-50 dark:hover:bg-gray-700/50"
                              >
                                <Edit className="h-4 w-4 mr-3 text-orange-600 dark:text-orange-400" />
                                Edit
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled
                                className="font-manrope text-gray-400 dark:text-gray-500 cursor-not-allowed"
                              >
                                <Edit className="h-4 w-4 mr-3 text-gray-400 dark:text-gray-500" />
                                Edit (File Upload)
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400 font-manrope hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => handleDeleteClick(document.id, document.name || document.title || 'Untitled Document')}
                            >
                              <Trash2 className="h-4 w-4 mr-3" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
            <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white font-manrope flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                Delete Document
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                Are you sure you want to delete "<span className="font-medium text-gray-900 dark:text-gray-100">{documentToDelete?.title}</span>"? This action cannot be undone
                and will permanently remove the document from the knowledge base.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4 border-t border-gray-200 dark:border-gray-700 gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                className="font-manrope"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                className="font-manrope bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}