/**
 * KB Edit Settings Page
 *
 * Edit knowledge base configuration with workspace validation
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ArrowLeft, Save, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { KnowledgeBase, ChunkingConfig, EmbeddingConfig, VectorStoreConfig } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import kbClient from '@/lib/kb-client';
import { KBChunkingConfig } from '@/components/kb/KBChunkingConfig';

export default function KBEditPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, hasPermission } = useApp();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    context: 'both' as any,
  });

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
      const kbData = await kbClient.kb.get(kbId);

      // Workspace validation - ensure KB belongs to current workspace
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
            description: 'You do not have permission to edit this knowledge base',
            variant: 'destructive'
          });
        }
        navigate('/knowledge-bases');
        return;
      }

      setKb(kbData);
      setFormData({
        name: kbData.name,
        description: kbData.description || '',
        context: kbData.context,
      });
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!kbId || !kb) return;

    setIsSaving(true);
    try {
      const updates = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        context: formData.context,
      };

      const updatedKb = await kbClient.kb.update(kbId, updates);
      setKb(updatedKb);
      setHasUnsavedChanges(false);

      toast({
        title: 'Success',
        description: 'Knowledge base settings updated successfully',
      });
    } catch (error) {
      console.error('Failed to update KB:', error);
      toast({
        title: 'Error',
        description: 'Failed to update knowledge base settings',
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

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
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
              <h1 className="text-2xl font-semibold">Edit Settings</h1>
              <p className="text-muted-foreground">{kb?.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {hasUnsavedChanges && (
              <span className="text-sm text-orange-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                Unsaved changes
              </span>
            )}
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

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="chunking">Chunking</TabsTrigger>
            <TabsTrigger value="embedding">Embedding</TabsTrigger>
            <TabsTrigger value="vector">Vector Store</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Basic knowledge base configuration and metadata
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Knowledge base name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe what this knowledge base contains..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="context">Usage Context</Label>
                  <Select value={formData.context} onValueChange={(value) => handleInputChange('context', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select usage context" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chatbot">Chatbot Only</SelectItem>
                      <SelectItem value="chatflow">Chatflow Only</SelectItem>
                      <SelectItem value="both">Both Chatbot & Chatflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* KB Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center space-x-2">
                    {kb?.status === 'ready' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm capitalize">{kb?.status}</span>
                  </div>
                </div>

                {/* Workspace Info */}
                <div className="space-y-2">
                  <Label>Workspace</Label>
                  <div className="text-sm text-muted-foreground">{currentWorkspace?.name}</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chunking Configuration */}
          <TabsContent value="chunking" className="space-y-6">
            {kb && <KBChunkingConfig />}
          </TabsContent>

          {/* Embedding Configuration */}
          <TabsContent value="embedding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Embedding Configuration</CardTitle>
                <CardDescription>
                  Configure how text is converted to vector embeddings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Embedding configuration changes require reindexing the knowledge base.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Embedding Model</Label>
                  <div className="text-sm text-muted-foreground">
                    Current: {kb?.embedding_config?.model || 'all-MiniLM-L6-v2'}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Device</Label>
                  <div className="text-sm text-muted-foreground">
                    Current: {kb?.embedding_config?.device || 'cpu'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vector Store Configuration */}
          <TabsContent value="vector" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Vector Store Configuration</CardTitle>
                <CardDescription>
                  Configure where and how vectors are stored and searched
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <div className="text-sm text-muted-foreground">
                    Current: {kb?.vector_store_config?.provider || 'qdrant'}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Distance Metric</Label>
                  <div className="text-sm text-muted-foreground">
                    Current: {kb?.vector_store_config?.distance_metric || 'cosine'}
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