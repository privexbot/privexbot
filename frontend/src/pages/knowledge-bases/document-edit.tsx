/**
 * KB Document Edit Page
 *
 * Edit document content and metadata
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ArrowLeft, Save, Eye, AlertCircle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { KnowledgeBase, KBDocument, formatDocumentSourceType } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import kbClient from '@/lib/kb-client';

export default function KBDocumentEditPage() {
  const { kbId, docId } = useParams<{ kbId: string; docId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, hasPermission } = useApp();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [document, setDocument] = useState<KBDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

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
            description: 'You do not have permission to edit this document',
            variant: 'destructive'
          });
        }
        navigate('/knowledge-bases');
        return;
      }

      setKb(kbData);
      setDocument(documentData);
      setFormData({
        title: documentData.name,
        content: documentData.content || documentData.content_preview || ''
      });
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
  if (!hasPermission('kb:edit')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You do not have permission to edit this document.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!document || !kbId || !docId) return;

    setIsSaving(true);
    try {
      const updates = {
        name: formData.title.trim(),
        content: formData.content.trim()
      };

      const updatedDocument = await kbClient.kb.updateDocument(kbId, docId, updates);
      setDocument(updatedDocument);
      setHasUnsavedChanges(false);

      toast({
        title: 'Success',
        description: 'Document updated successfully',
      });
    } catch (error) {
      console.error('Failed to update document:', error);
      toast({
        title: 'Error',
        description: 'Failed to update document',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
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
      <div className="px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl p-6 lg:p-8 shadow-xl border border-white/20 dark:border-gray-700/20 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/knowledge-bases/${kbId}/documents/${docId}`)}
                  className="self-start"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Document
                </Button>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-semibold font-manrope text-gray-900 dark:text-gray-100">Edit Document</h1>
                  <p className="text-muted-foreground font-manrope">{kb?.name}</p>
                </div>
              </div>

              {/* Mobile: Horizontal scrolling action buttons */}
              <div className="lg:hidden">
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
                  {hasUnsavedChanges && (
                    <span className="text-sm text-orange-600 flex items-center flex-shrink-0">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Unsaved changes
                    </span>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/knowledge-bases/${kbId}/documents/${docId}`)}
                    className="flex-shrink-0"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className="flex-shrink-0">
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>

              {/* Desktop: Standard action buttons */}
              <div className="hidden lg:flex items-center space-x-2">
                {hasUnsavedChanges && (
                  <span className="text-sm text-orange-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Unsaved changes
                  </span>
                )}
                <Button
                  variant="outline"
                  onClick={() => navigate(`/knowledge-bases/${kbId}/documents/${docId}`)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}>
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>

        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>Document Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Document title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Document content..."
                rows={20}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Changes to content will trigger re-processing and re-chunking of this document.
              </p>
            </div>

            {/* Document Info */}
            <div className="border-t pt-4 text-sm text-muted-foreground">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Content Type:</strong> {formatDocumentSourceType(document.content_type || document.source_type)}
                </div>
                <div>
                  <strong>Created:</strong> {
                    document.created_at
                      ? new Date(document.created_at).toLocaleDateString()
                      : 'Not available'
                  }
                </div>
                {document.chunk_count && (
                  <div>
                    <strong>Chunks:</strong> {document.chunk_count}
                  </div>
                )}
                <div>
                  <strong>Last Updated:</strong> {
                    (() => {
                      const lastUpdated = document.updated_at || document.processed_at || document.created_at;
                      return lastUpdated
                        ? new Date(lastUpdated).toLocaleDateString()
                        : 'Not available';
                    })()
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

            {/* Warning */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Editing this document will update its content in the knowledge base. The document will be
                re-processed and re-chunked automatically after saving.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}