/**
 * KB Edit Settings Page
 *
 * WHY: Allow users to configure existing KBs with full control
 * HOW: 4 tabs (General, Chunking, Embedding, Vector Store) with reindex on config changes
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeft,
  Save,
  Settings,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Loader2,
  Scissors,
  Cpu,
  Database,
  Info
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import {
  KnowledgeBase,
  ChunkingConfig,
  EmbeddingConfig,
  VectorStoreConfig
} from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import kbClient from '@/lib/kb-client';
import { KBChunkingSettings } from '@/components/kb/KBChunkingSettings';
import { KBEmbeddingSettings } from '@/components/kb/KBEmbeddingSettings';
import { KBVectorStoreSettings } from '@/components/kb/KBVectorStoreSettings';

type ConfigChanges = {
  chunking: boolean;
  embedding: boolean;
  vectorStore: boolean;
};

export default function KBEditPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, hasPermission } = useApp();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [showReindexDialog, setShowReindexDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    context: 'both' as any,
  });

  // Config states
  const [chunkingConfig, setChunkingConfig] = useState<ChunkingConfig | null>(null);
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig | null>(null);
  const [vectorStoreConfig, setVectorStoreConfig] = useState<Partial<VectorStoreConfig> | null>(null);

  // Track changes
  const [hasGeneralChanges, setHasGeneralChanges] = useState(false);
  const [configChanges, setConfigChanges] = useState<ConfigChanges>({
    chunking: false,
    embedding: false,
    vectorStore: false,
  });

  const hasConfigChanges = configChanges.chunking || configChanges.embedding || configChanges.vectorStore;
  const hasAnyChanges = hasGeneralChanges || hasConfigChanges;

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

      // Set config states
      // NOTE: Backend returns chunking_config inside 'config' dict, not at top level
      // Check config.chunking_config first, then fall back to chunking_config for compatibility
      const chunkingCfg = kbData.config?.chunking_config || kbData.chunking_config || null;
      console.log('[KB Edit] Loaded chunking config:', chunkingCfg);
      setChunkingConfig(chunkingCfg);
      setEmbeddingConfig(kbData.embedding_config || null);
      setVectorStoreConfig(kbData.vector_store_config || null);

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
    setHasGeneralChanges(true);
  };

  const handleChunkingChange = (config: ChunkingConfig) => {
    setChunkingConfig(config);
    setConfigChanges(prev => ({ ...prev, chunking: true }));
  };

  const handleEmbeddingChange = (config: EmbeddingConfig) => {
    setEmbeddingConfig(config);
    setConfigChanges(prev => ({ ...prev, embedding: true }));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleVectorStoreChange = (config: any) => {
    setVectorStoreConfig(config);
    setConfigChanges(prev => ({ ...prev, vectorStore: true }));
  };

  const handleSaveGeneral = async () => {
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
      setHasGeneralChanges(false);

      toast({
        title: 'Settings Saved',
        description: 'General settings updated successfully',
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

  const handleSaveAndReindex = async () => {
    if (!kbId || !kb) return;

    setIsReindexing(true);
    setShowReindexDialog(false);

    try {
      // Build config update object
      const configUpdate: any = {};

      if (configChanges.chunking && chunkingConfig) {
        configUpdate.chunking_config = chunkingConfig;
      }
      if (configChanges.embedding && embeddingConfig) {
        configUpdate.embedding_config = embeddingConfig;
      }
      if (configChanges.vectorStore && vectorStoreConfig) {
        configUpdate.vector_store_config = vectorStoreConfig;
      }

      // Call reindex with new config
      const result = await kbClient.kb.reindex(kbId, configUpdate);

      // Reset change tracking
      setConfigChanges({
        chunking: false,
        embedding: false,
        vectorStore: false,
      });

      toast({
        title: 'Reindex Started',
        description: result.message || 'Knowledge base is being reindexed with new settings',
      });

      // Reload KB data to get updated config
      await loadKBData();

    } catch (error: any) {
      console.error('Failed to reindex KB:', error);
      toast({
        title: 'Reindex Failed',
        description: error.message || 'Failed to start reindex. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsReindexing(false);
    }
  };

  const getSourceType = (): 'web' | 'file' | 'mixed' => {
    if (!kb?.sources) return 'mixed';
    const hasWeb = kb.sources.some(s => s.type === 'web');
    const hasFile = kb.sources.some(s => s.type === 'file');
    if (hasWeb && hasFile) return 'mixed';
    if (hasWeb) return 'web';
    if (hasFile) return 'file';
    return 'mixed';
  };

  const getChangeSummary = () => {
    const changes: string[] = [];
    if (configChanges.chunking) changes.push('Chunking');
    if (configChanges.embedding) changes.push('Embedding');
    if (configChanges.vectorStore) changes.push('Vector Store');
    return changes;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground font-manrope">Loading settings...</p>
          </div>
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
              className="font-manrope"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to KB
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                Settings
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope flex items-center gap-2">
                {kb?.name}
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    kb?.status === 'ready'
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700'
                      : kb?.status === 'processing'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700'
                      : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-700'
                  }`}
                >
                  {kb?.status}
                </Badge>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {hasAnyChanges && (
              <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center font-manrope">
                <AlertCircle className="h-4 w-4 mr-1" />
                Unsaved changes
              </span>
            )}

            {hasGeneralChanges && !hasConfigChanges && (
              <Button
                onClick={handleSaveGeneral}
                disabled={isSaving}
                className="font-manrope"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            )}

            {hasConfigChanges && (
              <Button
                onClick={() => setShowReindexDialog(true)}
                disabled={isReindexing || kb?.status === 'processing' || kb?.can_reindex === false}
                className="font-manrope bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                title={kb?.can_reindex === false ? "Rechunking not available for file upload KBs" : undefined}
              >
                {isReindexing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Save & Reindex
              </Button>
            )}
          </div>
        </div>

        {/* Processing Warning */}
        {kb?.status === 'processing' && (
          <Alert className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-200 font-manrope">
              Processing in Progress
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300 font-manrope">
              This knowledge base is currently being processed. Configuration changes cannot be applied until processing completes.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <TabsTrigger
              value="general"
              className="font-manrope data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg"
            >
              <Settings className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger
              value="chunking"
              disabled={kb?.can_reindex === false}
              className="font-manrope data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg relative disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Scissors className="h-4 w-4 mr-2" />
              Chunking
              {configChanges.chunking && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="embedding"
              disabled={kb?.can_reindex === false}
              className="font-manrope data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg relative disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Cpu className="h-4 w-4 mr-2" />
              Embedding
              {configChanges.embedding && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="vector"
              disabled={kb?.can_reindex === false}
              className="font-manrope data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 rounded-lg relative disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Database className="h-4 w-4 mr-2" />
              Vector Store
              {configChanges.vectorStore && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                      General Settings
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope mt-1">
                      Basic knowledge base configuration and metadata
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Knowledge base name"
                    className="font-manrope"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe what this knowledge base contains..."
                    rows={3}
                    className="font-manrope"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="context" className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                    Usage Context
                  </Label>
                  <Select value={formData.context} onValueChange={(value) => handleInputChange('context', value)}>
                    <SelectTrigger className="font-manrope">
                      <SelectValue placeholder="Select usage context" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chatbot" className="font-manrope">Chatbot Only</SelectItem>
                      <SelectItem value="chatflow" className="font-manrope">Chatflow Only</SelectItem>
                      <SelectItem value="both" className="font-manrope">Both Chatbot & Chatflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* KB Info */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Status</Label>
                    <div className="flex items-center space-x-2">
                      {kb?.status === 'ready' ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : kb?.status === 'processing' ? (
                        <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      )}
                      <span className="text-sm capitalize font-manrope text-gray-900 dark:text-gray-100">{kb?.status}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Workspace</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-manrope">{currentWorkspace?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Documents</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-manrope">
                      {kb?.stats?.documents || kb?.total_documents || 0}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Chunks</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-manrope">
                      {kb?.stats?.chunks || kb?.total_chunks || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chunking Configuration */}
          <TabsContent value="chunking" className="space-y-6">
            <KBChunkingSettings
              config={chunkingConfig}
              onChange={handleChunkingChange}
              hasChanges={configChanges.chunking}
              sourceType={getSourceType()}
            />
          </TabsContent>

          {/* Embedding Configuration */}
          <TabsContent value="embedding" className="space-y-6">
            <KBEmbeddingSettings
              config={embeddingConfig}
              onChange={handleEmbeddingChange}
              hasChanges={configChanges.embedding}
            />
          </TabsContent>

          {/* Vector Store Configuration */}
          <TabsContent value="vector" className="space-y-6">
            <KBVectorStoreSettings
              config={vectorStoreConfig as VectorStoreConfig | null}
              onChange={handleVectorStoreChange}
              hasChanges={configChanges.vectorStore}
              isLocked={true}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Reindex Confirmation Dialog */}
      <Dialog open={showReindexDialog} onOpenChange={setShowReindexDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-manrope flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-purple-600" />
              Confirm Reindex
            </DialogTitle>
            <DialogDescription className="font-manrope">
              You're about to save configuration changes and reindex the knowledge base.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                Changes to apply:
              </p>
              <ul className="space-y-1">
                {getChangeSummary().map((change) => (
                  <li key={change} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-manrope">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {change} Configuration
                  </li>
                ))}
              </ul>
            </div>

            <Alert className="border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-700 dark:text-amber-300 font-manrope text-sm">
                This will regenerate all chunks and embeddings. The process may take several minutes
                depending on the amount of content.
              </AlertDescription>
            </Alert>

          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowReindexDialog(false)}
              className="font-manrope"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAndReindex}
              disabled={isReindexing}
              className="font-manrope bg-purple-600 hover:bg-purple-700"
            >
              {isReindexing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Confirm & Reindex
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
