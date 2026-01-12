/**
 * Chatbot Edit Page
 *
 * Edit deployed chatbot configuration
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeft,
  Bot,
  Save,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Database,
  Palette,
  MessageSquare,
} from 'lucide-react';
import { chatbotApi } from '@/api/chatbot';
import { useApp } from '@/contexts/AppContext';
import type { Chatbot, UpdateChatbotDraftRequest, KBAttachment } from '@/types/chatbot';
import { AIModel, getModelLabel, PersonaTone } from '@/types/chatbot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ChatbotEditPage() {
  const { chatbotId } = useParams<{ chatbotId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useApp();

  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    model: AIModel.SECRET_AI as string,
    temperature: 0.7,
    max_tokens: 2000,
    greeting: '',
    primary_color: '#6366f1',
    position: 'bottom-right',
    chat_title: '',
    memory_enabled: true,
    memory_max_messages: 20,
  });

  useEffect(() => {
    if (chatbotId && currentWorkspace) {
      loadChatbotData();
    }
  }, [chatbotId, currentWorkspace]);

  const loadChatbotData = async () => {
    if (!chatbotId) return;

    setIsLoading(true);
    try {
      const data = await chatbotApi.get(chatbotId);
      setChatbot(data);

      // Populate form with existing data
      setFormData({
        name: data.name || '',
        description: data.description || '',
        system_prompt: data.prompt_config?.system_prompt || '',
        model: (data.ai_config?.model as typeof AIModel[keyof typeof AIModel]) || AIModel.SECRET_AI,
        temperature: data.ai_config?.temperature ?? 0.7,
        max_tokens: data.ai_config?.max_tokens || 2000,
        greeting: data.prompt_config?.messages?.greeting || '',
        primary_color: data.branding_config?.primary_color || '#6366f1',
        position: data.branding_config?.position || 'bottom-right',
        chat_title: data.branding_config?.chat_title || '',
        memory_enabled: data.behavior_config?.memory?.enabled ?? true,
        memory_max_messages: data.behavior_config?.memory?.max_messages || 20,
      });
    } catch (error) {
      console.error('Failed to load chatbot:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chatbot details',
        variant: 'destructive'
      });
      navigate('/chatbots');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!chatbotId || !chatbot) return;

    setIsSaving(true);
    try {
      const updateData: UpdateChatbotDraftRequest = {
        name: formData.name,
        description: formData.description,
        system_prompt: formData.system_prompt,
        model: formData.model,
        temperature: formData.temperature,
        max_tokens: formData.max_tokens,
        messages: {
          greeting: formData.greeting,
        },
        appearance: {
          primary_color: formData.primary_color,
          position: formData.position as 'bottom-right' | 'bottom-left',
          chat_title: formData.chat_title,
        },
        memory: {
          enabled: formData.memory_enabled,
          max_messages: formData.memory_max_messages,
        },
      };

      await chatbotApi.update(chatbotId, updateData);

      toast({
        title: 'Success',
        description: 'Chatbot updated successfully',
      });

      navigate(`/chatbots/${chatbotId}`);
    } catch (error) {
      console.error('Failed to update chatbot:', error);
      toast({
        title: 'Error',
        description: 'Failed to update chatbot',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <RefreshCw className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h3 className="text-lg font-medium">Loading Chatbot</h3>
            <p className="text-muted-foreground">Fetching configuration...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!chatbot) {
    return (
      <DashboardLayout>
        <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Chatbot not found or you don't have access to it.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => navigate('/chatbots')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chatbots
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(`/chatbots/${chatbotId}`)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-manrope"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-manrope">
                Edit {chatbot.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                Update chatbot configuration
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Edit Form */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <TabsTrigger
              value="basic"
              className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <Bot className="h-4 w-4 mr-2" />
              Basic Info
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI Config
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-200 dark:border-blue-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-100 font-manrope">Basic Information</CardTitle>
                    <CardDescription className="text-blue-700 dark:text-blue-300 font-manrope">Chatbot name and description</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-manrope">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Chatbot"
                    className="font-manrope"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="font-manrope">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="A helpful assistant for customer support..."
                    rows={3}
                    className="font-manrope"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system_prompt" className="font-manrope">System Prompt</Label>
                  <Textarea
                    id="system_prompt"
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    placeholder="You are a helpful assistant..."
                    rows={6}
                    className="font-manrope font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Instructions that define how the AI should behave
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Config Tab */}
          <TabsContent value="ai">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-200 dark:border-purple-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  <div>
                    <CardTitle className="text-lg font-bold text-purple-900 dark:text-purple-100 font-manrope">AI Configuration</CardTitle>
                    <CardDescription className="text-purple-700 dark:text-purple-300 font-manrope">Model and generation settings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="model" className="font-manrope">AI Model</Label>
                  <Select
                    value={formData.model}
                    onValueChange={(value) => setFormData({ ...formData, model: value as typeof AIModel[keyof typeof AIModel] })}
                  >
                    <SelectTrigger className="font-manrope">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AIModel).map(([key, value]) => (
                        <SelectItem key={value} value={value} className="font-manrope">
                          {getModelLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-manrope">Temperature: {formData.temperature.toFixed(1)}</Label>
                  </div>
                  <Slider
                    value={[formData.temperature]}
                    onValueChange={(value) => setFormData({ ...formData, temperature: value[0] })}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Lower values make responses more focused, higher values more creative
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_tokens" className="font-manrope">Max Tokens</Label>
                  <Input
                    id="max_tokens"
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 2000 })}
                    min={100}
                    max={8000}
                    className="font-manrope"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Maximum length of AI responses (100-8000)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-manrope flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.memory_enabled}
                        onChange={(e) => setFormData({ ...formData, memory_enabled: e.target.checked })}
                        className="rounded"
                      />
                      Enable Conversation Memory
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memory_max" className="font-manrope">Max Messages to Remember</Label>
                    <Input
                      id="memory_max"
                      type="number"
                      value={formData.memory_max_messages}
                      onChange={(e) => setFormData({ ...formData, memory_max_messages: parseInt(e.target.value) || 20 })}
                      min={5}
                      max={100}
                      disabled={!formData.memory_enabled}
                      className="font-manrope"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-green-200 dark:border-green-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                  <div>
                    <CardTitle className="text-lg font-bold text-green-900 dark:text-green-100 font-manrope">Custom Messages</CardTitle>
                    <CardDescription className="text-green-700 dark:text-green-300 font-manrope">Greeting and fallback messages</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="greeting" className="font-manrope">Greeting Message</Label>
                  <Textarea
                    id="greeting"
                    value={formData.greeting}
                    onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                    placeholder="Hello! How can I help you today?"
                    rows={2}
                    className="font-manrope"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    First message shown when user opens the chat
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200 dark:border-amber-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <Palette className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  <div>
                    <CardTitle className="text-lg font-bold text-amber-900 dark:text-amber-100 font-manrope">Widget Appearance</CardTitle>
                    <CardDescription className="text-amber-700 dark:text-amber-300 font-manrope">Customize the chat widget look</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="primary_color" className="font-manrope">Primary Color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        id="primary_color"
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        className="w-12 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        placeholder="#6366f1"
                        className="font-mono flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="position" className="font-manrope">Widget Position</Label>
                    <Select
                      value={formData.position}
                      onValueChange={(value) => setFormData({ ...formData, position: value })}
                    >
                      <SelectTrigger className="font-manrope">
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right" className="font-manrope">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left" className="font-manrope">Bottom Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chat_title" className="font-manrope">Chat Title</Label>
                  <Input
                    id="chat_title"
                    value={formData.chat_title}
                    onChange={(e) => setFormData({ ...formData, chat_title: e.target.value })}
                    placeholder="Chat with us"
                    className="font-manrope"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Title displayed in the chat window header
                  </p>
                </div>

                {/* Preview */}
                <div className="mt-6 p-6 bg-gray-100 dark:bg-gray-900 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope mb-4">Preview</p>
                  <div className="flex justify-end">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110"
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button (Bottom) */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate(`/chatbots/${chatbotId}`)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
