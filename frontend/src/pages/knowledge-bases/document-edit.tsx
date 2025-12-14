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
      <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-8">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/knowledge-bases/${kbId}/documents/${docId}`)}
            className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-manrope"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Document
          </Button>

          <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <Save className="h-8 w-8 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-manrope">
                    Edit Document
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 font-manrope text-base">
                    Knowledge Base: <span className="font-medium text-orange-700 dark:text-orange-300">{kb?.name}</span>
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 font-manrope text-sm">
                    Document: <span className="font-medium">{document.name}</span>
                  </p>
                  {hasUnsavedChanges && (
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium font-manrope">You have unsaved changes</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/knowledge-bases/${kbId}/documents/${docId}`)}
                  className="font-manrope"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !hasUnsavedChanges}
                  className="font-manrope bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500"
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-200 dark:border-purple-700 rounded-t-xl p-6">
            <div className="flex items-center gap-3">
              <Save className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <CardTitle className="text-xl font-bold text-purple-900 dark:text-purple-100 font-manrope">Edit Document</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="title" className="text-base font-semibold text-gray-900 dark:text-gray-100 font-manrope">Document Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter document title..."
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm font-manrope text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="content" className="text-base font-semibold text-gray-900 dark:text-gray-100 font-manrope">Document Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Enter document content..."
                rows={20}
                className="font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
              />
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-manrope">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Changes to content will trigger re-processing and re-chunking of this document.
                </p>
              </div>
            </div>

            {/* Document Info */}
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
              <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 font-manrope mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                Document Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope mb-1">Content Type</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope">{formatDocumentSourceType(document.content_type || document.source_type)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope mb-1">Created</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope">
                    {document.created_at
                      ? new Date(document.created_at).toLocaleDateString()
                      : 'Not available'}
                  </div>
                </div>
                {document.chunk_count && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope mb-1">Chunks</div>
                    <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope">{document.chunk_count}</div>
                  </div>
                )}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope mb-1">Last Updated</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 font-manrope">
                    {(() => {
                      const lastUpdated = document.updated_at || document.processed_at || document.created_at;
                      return lastUpdated
                        ? new Date(lastUpdated).toLocaleDateString()
                        : 'Not available';
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning Alert */}
        <Alert className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <AlertDescription className="flex-1">
              <strong className="text-yellow-900 dark:text-yellow-100 font-manrope block mb-1">Important Note</strong>
              <div className="text-yellow-800 dark:text-yellow-200 font-manrope leading-relaxed">
                Editing this document will update its content in the knowledge base. The document will be
                re-processed and re-chunked automatically after saving.
              </div>
            </AlertDescription>
          </div>
        </Alert>
      </div>
    </DashboardLayout>
  );
}