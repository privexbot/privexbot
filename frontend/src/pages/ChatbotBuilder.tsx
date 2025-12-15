/**
 * ChatbotBuilder - Form-based chatbot builder with draft mode
 *
 * WHY:
 * - User-friendly chatbot creation
 * - Auto-save drafts (500ms debounce)
 * - Knowledge base integration
 * - Multi-channel deployment
 *
 * HOW:
 * - React Hook Form + Zod validation
 * - Draft API (/chatbots/drafts)
 * - Auto-save hook
 * - Step-by-step workflow
 *
 * DEPENDENCIES:
 * - react-hook-form
 * - zod
 * - @tanstack/react-query
 * - @tiptap/react (for rich text prompt editor)
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, Save, Sparkles, Database, Settings, Rocket } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient, { handleApiError } from '@/lib/api-client';

// Validation schema
const chatbotSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  system_prompt: z.string().min(10, 'System prompt must be at least 10 characters'),
  model: z.enum(['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet']),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().min(100).max(4000).optional(),
  knowledge_bases: z.array(z.string()).default([]),
  enable_lead_capture: z.boolean().default(false),
  greeting_message: z.string().optional(),
});

type ChatbotFormData = z.infer<typeof chatbotSchema>;

export default function ChatbotBuilder() {
  const { draftId } = useParams<{ draftId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState('basic');

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ChatbotFormData>({
    resolver: zodResolver(chatbotSchema),
    defaultValues: {
      temperature: 0.7,
      model: 'gpt-4',
      knowledge_bases: [],
      enable_lead_capture: false,
    },
  });

  // Watch form changes for auto-save
  const formData = watch();

  // Create or load draft
  const { data: draft, isLoading: loadingDraft } = useQuery({
    queryKey: ['chatbot-draft', draftId],
    queryFn: async () => {
      if (draftId) {
        // Load existing draft
        const response = await apiClient.get(`/chatbots/drafts/${draftId}`);
        return response.data;
      } else {
        // Create new draft
        const response = await apiClient.post('/chatbots/drafts', {
          workspace_id: currentWorkspace?.id,
          initial_data: {
            name: 'Untitled Chatbot',
            system_prompt: 'You are a helpful AI assistant.',
            model: 'gpt-4',
            temperature: 0.7,
          },
        });

        // Redirect to draft URL
        navigate(`/chatbots/builder/${response.data.draft_id}`, { replace: true });
        return response.data;
      }
    },
    enabled: !!currentWorkspace,
  });

  // Load draft data into form
  useEffect(() => {
    if (draft?.data) {
      Object.entries(draft.data).forEach(([key, value]) => {
        setValue(key as any, value);
      });
    }
  }, [draft, setValue]);

  // Auto-save hook
  const { save, isSaving, lastSaved, isDirty } = useAutoSave({
    draftId: draftId || '',
    draftType: 'chatbot',
    endpoint: '/chatbots/drafts',
  });

  // Auto-save on form change
  useEffect(() => {
    if (draftId && formData) {
      save(formData);
    }
  }, [formData, draftId, save]);

  // Fetch available knowledge bases
  const { data: knowledgeBases } = useQuery({
    queryKey: ['knowledge-bases', currentWorkspace?.id],
    queryFn: async () => {
      const response = await apiClient.get('/knowledge-bases/', {
        params: { workspace_id: currentWorkspace?.id },
      });
      return response.data.items;
    },
    enabled: !!currentWorkspace,
  });

  // Finalize mutation (deploy)
  const finalizeMutation = useMutation({
    mutationFn: async (deploymentConfig: any) => {
      const response = await apiClient.post(`/chatbots/drafts/${draftId}/finalize`, deploymentConfig);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Chatbot deployed successfully!',
        description: `Chatbot ID: ${data.chatbot_id}`,
      });
      navigate(`/chatbots/${data.chatbot_id}`);
    },
    onError: (error) => {
      toast({
        title: 'Deployment failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  // Test chatbot
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');

  const testMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiClient.post(`/chatbots/${draft?.entity_id || draftId}/test`, {
        message,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setTestResponse(data.response);
    },
  });

  if (loadingDraft) {
    return <div className="flex items-center justify-center h-screen">Loading draft...</div>;
  }

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Chatbot Builder</h1>
            <p className="text-muted-foreground">
              {isDirty ? (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4 animate-pulse" />
                  {isSaving ? 'Saving...' : 'Unsaved changes'}
                </span>
              ) : lastSaved ? (
                `Last saved ${new Date(lastSaved).toLocaleTimeString()}`
              ) : (
                'Draft auto-saved'
              )}
            </p>
          </div>
        </div>

        <Button
          onClick={() => finalizeMutation.mutate({ channels: ['website'] })}
          disabled={finalizeMutation.isPending}
          size="lg"
        >
          <Rocket className="w-4 h-4 mr-2" />
          Deploy Chatbot
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="ai">AI Configuration</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="test">Test & Deploy</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-6 mt-6">
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Basic Information</h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Chatbot Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g., Customer Support Bot"
                  className="mt-2"
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Describe what this chatbot does..."
                  className="mt-2"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="greeting">Greeting Message</Label>
                <Input
                  id="greeting"
                  {...register('greeting_message')}
                  placeholder="Hi! How can I help you today?"
                  className="mt-2"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="lead-capture">Enable Lead Capture</Label>
                  <p className="text-sm text-muted-foreground">
                    Capture user information during conversations
                  </p>
                </div>
                <Switch
                  id="lead-capture"
                  checked={watch('enable_lead_capture')}
                  onCheckedChange={(checked) => setValue('enable_lead_capture', checked)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* AI Configuration Tab */}
        <TabsContent value="ai" className="space-y-6 mt-6">
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI Model Configuration
            </h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="model">AI Model *</Label>
                <Select value={watch('model')} onValueChange={(value) => setValue('model', value as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4 (Most Capable)</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo (Faster)</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Cost Effective)</SelectItem>
                    <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                    <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="system-prompt">System Prompt *</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Define your chatbot's personality and behavior
                </p>
                <Textarea
                  id="system-prompt"
                  {...register('system_prompt')}
                  placeholder="You are a helpful customer support assistant for..."
                  className="mt-2 font-mono"
                  rows={8}
                />
                {errors.system_prompt && (
                  <p className="text-sm text-destructive mt-1">{errors.system_prompt.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="temperature">
                    Temperature: {watch('temperature')?.toFixed(1) || '0.7'}
                  </Label>
                  <input
                    id="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    {...register('temperature', { valueAsNumber: true })}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher = more creative, Lower = more focused
                  </p>
                </div>

                <div>
                  <Label htmlFor="max-tokens">Max Tokens (Optional)</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    {...register('max_tokens', { valueAsNumber: true })}
                    placeholder="2000"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="space-y-6 mt-6">
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Knowledge Base Integration
            </h3>

            <p className="text-sm text-muted-foreground mb-4">
              Connect knowledge bases to enable RAG (Retrieval-Augmented Generation)
            </p>

            <div className="space-y-3">
              {knowledgeBases?.map((kb: any) => (
                <div
                  key={kb.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition"
                >
                  <div>
                    <h4 className="font-medium">{kb.name}</h4>
                    <p className="text-sm text-muted-foreground">{kb.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {kb.total_documents || 0} documents • {kb.total_chunks || 0} chunks
                    </p>
                  </div>
                  <Switch
                    checked={watch('knowledge_bases')?.includes(kb.id)}
                    onCheckedChange={(checked) => {
                      const current = watch('knowledge_bases') || [];
                      if (checked) {
                        setValue('knowledge_bases', [...current, kb.id]);
                      } else {
                        setValue('knowledge_bases', current.filter((id) => id !== kb.id));
                      }
                    }}
                  />
                </div>
              ))}

              {(!knowledgeBases || knowledgeBases.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No knowledge bases found</p>
                  <Button variant="link" onClick={() => navigate('/knowledge-bases/create')}>
                    Create your first knowledge base →
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Test & Deploy Tab */}
        <TabsContent value="test" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Test Chat */}
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Test Chatbot</h3>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="test-message">Test Message</Label>
                  <Textarea
                    id="test-message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Type a message to test..."
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <Button
                  onClick={() => testMutation.mutate(testMessage)}
                  disabled={!testMessage || testMutation.isPending}
                  className="w-full"
                >
                  {testMutation.isPending ? 'Testing...' : 'Send Test Message'}
                </Button>

                {testResponse && (
                  <div className="mt-4 p-4 bg-accent rounded-lg">
                    <p className="text-sm font-medium mb-2">Response:</p>
                    <p className="text-sm">{testResponse}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Deploy */}
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">Deployment Options</h3>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Deploy your chatbot to multiple channels
                </p>

                <Button
                  onClick={() => navigate(`/deployments/${draftId}`)}
                  variant="outline"
                  className="w-full"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Deployment Channels
                </Button>

                <Button
                  onClick={() =>
                    finalizeMutation.mutate({
                      channels: ['website'],
                      allowed_domains: ['*'],
                    })
                  }
                  disabled={finalizeMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  {finalizeMutation.isPending ? 'Deploying...' : 'Deploy to Website'}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
