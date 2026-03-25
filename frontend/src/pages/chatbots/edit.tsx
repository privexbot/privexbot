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
  Palette,
  MessageSquare,
  Lock,
  Unlock,
  Globe,
  UserPlus,
  Info,
  Send,
  Hash,
  Phone,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Database,
  Shield,
} from 'lucide-react';
import { chatbotApi } from '@/api/chatbot';
import { useApp } from '@/contexts/AppContext';
import { useKBStore } from '@/store/kb-store';
import { Switch } from '@/components/ui/switch';
import type { Chatbot, UpdateChatbotDraftRequest, LeadCaptureCustomField, KBAttachment } from '@/types/chatbot';
import type { KBSummary } from '@/types/knowledge-base';
import { AIModel, getModelLabel, LeadCaptureTiming, FieldVisibility, CustomFieldType, DEFAULT_LEAD_CAPTURE_CONFIG } from '@/types/chatbot';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GroundingMode } from '@/types/chatbot';
import { AvatarUpload } from '@/components/shared/AvatarUpload';

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
    secondary_color: '#8b5cf6',
    position: 'bottom-right',
    chat_title: '',
    avatar_url: '',
    font_family: 'Inter',
    bubble_style: 'rounded' as 'rounded' | 'square',
    memory_enabled: true,
    memory_max_messages: 20,
    is_public: true,
    // KB behavior settings (loaded from chatbot config)
    enable_citations: false,
    enable_follow_up_questions: false,
    grounding_mode: GroundingMode.STRICT as string,
    // Lead capture configuration (new multi-platform structure)
    lead_capture_enabled: false,
    lead_capture_timing: LeadCaptureTiming.BEFORE_CHAT as string,
    lead_capture_messages_before_prompt: 3,
    lead_capture_allow_skip: true,
    // Standard fields visibility
    lead_capture_email_visibility: FieldVisibility.REQUIRED as string,
    lead_capture_name_visibility: FieldVisibility.OPTIONAL as string,
    lead_capture_phone_visibility: FieldVisibility.HIDDEN as string,
    // Custom fields
    lead_capture_custom_fields: [] as LeadCaptureCustomField[],
    // Privacy
    lead_capture_require_consent: false,
    lead_capture_consent_message: 'I agree to the collection and processing of my data.',
    lead_capture_auto_capture_notice: 'We collect IP address and browser info for analytics.',
    // Platform settings
    lead_capture_web_enabled: true,
    lead_capture_telegram_enabled: false,
    lead_capture_telegram_prompt_email: false,
    lead_capture_telegram_prompt_phone: false,
    lead_capture_discord_enabled: false,
    lead_capture_discord_prompt_email: false,
    lead_capture_whatsapp_enabled: false,
    lead_capture_whatsapp_prompt_email: false,
  });

  // State for expanded platform sections
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({
    telegram: false,
    discord: false,
    whatsapp: false,
  });

  // State for Knowledge Base management
  const [attachedKBs, setAttachedKBs] = useState<KBAttachment[]>([]);
  const [kbSaving, setKbSaving] = useState(false);

  // Use KB store for loading KBs (handles response format correctly)
  const { kbs: storeKBs, fetchKBs, isLoadingList: kbLoading } = useKBStore();

  // State for custom field modal
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
  const [editingCustomField, setEditingCustomField] = useState<LeadCaptureCustomField | null>(null);
  const [customFieldForm, setCustomFieldForm] = useState({
    name: '',
    label: '',
    type: CustomFieldType.TEXT as string,
    required: false,
    placeholder: '',
    options: '',
  });

  // Validation state for appearance
  const [avatarError, setAvatarError] = useState('');
  const [colorError, setColorError] = useState('');
  const [secondaryColorError, setSecondaryColorError] = useState('');

  // Color presets
  const colorOptions = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#ef4444', label: 'Red' },
    { value: '#6b7280', label: 'Gray' },
  ];

  const isValidHex = (color: string): boolean => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!chatbotId) return;

      setIsLoading(true);
      try {
        const data = await chatbotApi.get(chatbotId);
        setChatbot(data);

        // Deep merge lead capture config with defaults (API may return partial data)
        const apiConfig = data.lead_capture_config;
        const leadConfig = {
          ...DEFAULT_LEAD_CAPTURE_CONFIG,
          ...apiConfig,
          fields: {
            ...DEFAULT_LEAD_CAPTURE_CONFIG.fields,
            ...apiConfig?.fields,
          },
          privacy: {
            ...DEFAULT_LEAD_CAPTURE_CONFIG.privacy,
            ...apiConfig?.privacy,
          },
          /* eslint-disable @typescript-eslint/no-unnecessary-condition -- API may return partial platform configs */
          platforms: {
            web: { ...DEFAULT_LEAD_CAPTURE_CONFIG.platforms.web, ...apiConfig?.platforms?.web },
            telegram: { ...DEFAULT_LEAD_CAPTURE_CONFIG.platforms.telegram, ...apiConfig?.platforms?.telegram },
            discord: { ...DEFAULT_LEAD_CAPTURE_CONFIG.platforms.discord, ...apiConfig?.platforms?.discord },
            whatsapp: { ...DEFAULT_LEAD_CAPTURE_CONFIG.platforms.whatsapp, ...apiConfig?.platforms?.whatsapp },
          },
          /* eslint-enable @typescript-eslint/no-unnecessary-condition */
        };

        // Populate form with existing data
        /* eslint-disable @typescript-eslint/no-unnecessary-condition -- API response may have partial/undefined nested properties */
        setFormData({
          name: data.name ?? '',
          description: data.description ?? '',
          system_prompt: data.prompt_config?.system_prompt ?? '',
          model: (data.ai_config?.model as typeof AIModel[keyof typeof AIModel]) ?? AIModel.SECRET_AI,
          temperature: data.ai_config?.temperature ?? 0.7,
          max_tokens: data.ai_config?.max_tokens ?? 2000,
          greeting: data.prompt_config?.messages?.greeting ?? '',
          primary_color: data.branding_config?.primary_color ?? '#6366f1',
          secondary_color: data.branding_config?.secondary_color ?? '#8b5cf6',
          position: data.branding_config?.position ?? 'bottom-right',
          chat_title: data.branding_config?.chat_title ?? '',
          avatar_url: data.branding_config?.avatar_url ?? '',
          font_family: data.branding_config?.font_family ?? 'Inter',
          bubble_style: (data.branding_config?.bubble_style as 'rounded' | 'square') ?? 'rounded',
          memory_enabled: data.behavior_config?.memory?.enabled ?? true,
          memory_max_messages: data.behavior_config?.memory?.max_messages ?? 20,
          is_public: data.is_public ?? true,
          // KB behavior settings - loaded from stored chatbot config
          enable_citations: data.kb_config?.citation_style ? data.kb_config.citation_style !== 'none' : false,
          enable_follow_up_questions: data.behavior_config?.follow_up_questions ?? false,
          grounding_mode: data.kb_config?.grounding_mode ?? GroundingMode.STRICT,
          // Lead capture configuration (merged with defaults)
          lead_capture_enabled: leadConfig.enabled,
          lead_capture_timing: leadConfig.timing,
          lead_capture_messages_before_prompt: leadConfig.messages_before_prompt ?? 3,
          lead_capture_allow_skip: leadConfig.allow_skip,
          // Standard fields visibility
          lead_capture_email_visibility: leadConfig.fields.email,
          lead_capture_name_visibility: leadConfig.fields.name,
          lead_capture_phone_visibility: leadConfig.fields.phone,
          // Custom fields
          lead_capture_custom_fields: leadConfig.custom_fields ?? [],
          // Privacy
          lead_capture_require_consent: leadConfig.privacy.require_consent,
          lead_capture_consent_message: leadConfig.privacy.consent_message,
          lead_capture_auto_capture_notice: leadConfig.privacy.auto_capture_notice,
          // Platform settings
          lead_capture_web_enabled: leadConfig.platforms.web.enabled,
          lead_capture_telegram_enabled: leadConfig.platforms.telegram.enabled,
          lead_capture_telegram_prompt_email: leadConfig.platforms.telegram.prompt_for_email ?? false,
          lead_capture_telegram_prompt_phone: leadConfig.platforms.telegram.prompt_for_phone ?? false,
          lead_capture_discord_enabled: leadConfig.platforms.discord.enabled,
          lead_capture_discord_prompt_email: leadConfig.platforms.discord.prompt_for_email ?? false,
          lead_capture_whatsapp_enabled: leadConfig.platforms.whatsapp.enabled,
          lead_capture_whatsapp_prompt_email: leadConfig.platforms.whatsapp.prompt_for_email ?? false,
        });
        /* eslint-enable @typescript-eslint/no-unnecessary-condition */
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

    if (chatbotId && currentWorkspace) {
      void loadData();
    }
  }, [chatbotId, currentWorkspace, navigate]);

  // Load attached KBs when chatbot data is loaded
  useEffect(() => {
    const kbs = chatbot?.kb_config.knowledge_bases;
    if (kbs) {
      setAttachedKBs(kbs);
    }
  }, [chatbot]);

  // Load available KBs when KB tab is selected (using store for correct response handling)
  useEffect(() => {
    if (activeTab === 'knowledge-bases' && currentWorkspace?.id) {
      void fetchKBs({ workspace_id: currentWorkspace.id, status: 'ready' });
    }
  }, [activeTab, currentWorkspace?.id, fetchKBs]);

  // Derive available KBs from store (filter out already attached)
  const availableKBs = storeKBs.filter(
    (kb) => !attachedKBs.some((attached) => attached.kb_id === kb.id)
  );

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
          secondary_color: formData.secondary_color,
          position: formData.position as 'bottom-right' | 'bottom-left',
          chat_title: formData.chat_title,
          avatar_url: formData.avatar_url,
          font_family: formData.font_family,
          bubble_style: formData.bubble_style,
        },
        memory: {
          enabled: formData.memory_enabled,
          max_messages: formData.memory_max_messages,
        },
        is_public: formData.is_public,
        grounding_mode: formData.grounding_mode,
        enable_citations: formData.enable_citations,
        enable_follow_up_questions: formData.enable_follow_up_questions,
        lead_capture: {
          enabled: formData.lead_capture_enabled,
          timing: formData.lead_capture_timing as typeof LeadCaptureTiming[keyof typeof LeadCaptureTiming],
          messages_before_prompt: formData.lead_capture_messages_before_prompt,
          fields: {
            email: formData.lead_capture_email_visibility as typeof FieldVisibility[keyof typeof FieldVisibility],
            name: formData.lead_capture_name_visibility as typeof FieldVisibility[keyof typeof FieldVisibility],
            phone: formData.lead_capture_phone_visibility as typeof FieldVisibility[keyof typeof FieldVisibility],
          },
          custom_fields: formData.lead_capture_custom_fields,
          allow_skip: formData.lead_capture_allow_skip,
          privacy: {
            require_consent: formData.lead_capture_require_consent,
            consent_message: formData.lead_capture_consent_message,
            auto_capture_notice: formData.lead_capture_auto_capture_notice,
          },
          platforms: {
            web: { enabled: formData.lead_capture_web_enabled },
            telegram: {
              enabled: formData.lead_capture_telegram_enabled,
              prompt_for_email: formData.lead_capture_telegram_prompt_email,
              prompt_for_phone: formData.lead_capture_telegram_prompt_phone,
            },
            discord: {
              enabled: formData.lead_capture_discord_enabled,
              prompt_for_email: formData.lead_capture_discord_prompt_email,
            },
            whatsapp: {
              enabled: formData.lead_capture_whatsapp_enabled,
              prompt_for_email: formData.lead_capture_whatsapp_prompt_email,
            },
          },
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

  // KB Management Functions
  const handleAttachKB = async (kb: KBSummary) => {
    if (!chatbotId) return;

    const newAttachment: KBAttachment = {
      kb_id: kb.id,
      name: kb.name,
      enabled: true,
      priority: attachedKBs.length + 1,
    };
    const updatedKBs = [...attachedKBs, newAttachment];

    setKbSaving(true);
    try {
      await chatbotApi.updateKBConfig(chatbotId, { knowledge_bases: updatedKBs });

      // Reload chatbot data to confirm save persisted
      const refreshedChatbot = await chatbotApi.get(chatbotId);
      setChatbot(refreshedChatbot);
      setAttachedKBs(refreshedChatbot.kb_config.knowledge_bases || []);

      toast({
        title: 'Knowledge Base Attached',
        description: `${kb.name} has been added to this chatbot`,
      });
    } catch (error) {
      console.error('Failed to attach KB:', error);
      toast({
        title: 'Error',
        description: 'Failed to attach knowledge base',
        variant: 'destructive',
      });
    } finally {
      setKbSaving(false);
    }
  };

  const handleDetachKB = async (kbId: string) => {
    if (!chatbotId) return;

    const updatedKBs = attachedKBs.filter(kb => kb.kb_id !== kbId);

    setKbSaving(true);
    try {
      await chatbotApi.updateKBConfig(chatbotId, { knowledge_bases: updatedKBs });

      // Reload chatbot data to confirm save persisted
      const refreshedChatbot = await chatbotApi.get(chatbotId);
      setChatbot(refreshedChatbot);
      setAttachedKBs(refreshedChatbot.kb_config.knowledge_bases || []);

      toast({
        title: 'Knowledge Base Removed',
        description: 'The knowledge base has been detached from this chatbot',
      });
    } catch (error) {
      console.error('Failed to detach KB:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove knowledge base',
        variant: 'destructive',
      });
    } finally {
      setKbSaving(false);
    }
  };

  const handleToggleKB = async (kbId: string, enabled: boolean) => {
    if (!chatbotId) return;

    const updatedKBs = attachedKBs.map(kb =>
      kb.kb_id === kbId ? { ...kb, enabled } : kb
    );

    setKbSaving(true);
    try {
      await chatbotApi.updateKBConfig(chatbotId, { knowledge_bases: updatedKBs });

      // Reload chatbot data to confirm save persisted
      const refreshedChatbot = await chatbotApi.get(chatbotId);
      setChatbot(refreshedChatbot);
      setAttachedKBs(refreshedChatbot.kb_config.knowledge_bases || []);
    } catch (error) {
      console.error('Failed to toggle KB:', error);
      toast({
        title: 'Error',
        description: 'Failed to update knowledge base',
        variant: 'destructive',
      });
    } finally {
      setKbSaving(false);
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
          <Button className="mt-4" onClick={() => { navigate('/chatbots'); }}>
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
              onClick={() => { navigate(`/chatbots/${chatbotId ?? ''}`); }}
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
          <Button onClick={() => { void handleSave(); }} disabled={isSaving}>
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
              value="knowledge-bases"
              className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Knowledge Bases
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
            <TabsTrigger
              value="leads"
              className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Lead Capture
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
                    onChange={(e) => { setFormData({ ...formData, name: e.target.value }); }}
                    placeholder="My Chatbot"
                    className="font-manrope"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="font-manrope">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => { setFormData({ ...formData, description: e.target.value }); }}
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
                    onChange={(e) => { setFormData({ ...formData, system_prompt: e.target.value }); }}
                    placeholder="You are a helpful assistant..."
                    rows={6}
                    className="font-manrope font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Instructions that define how the AI should behave
                  </p>
                </div>

                {/* Visibility Toggle */}
                <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Label className="font-manrope">Visibility</Label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setFormData({ ...formData, is_public: true }); }}
                      className={`flex-1 font-manrope justify-start gap-3 h-auto py-3 ${
                        formData.is_public
                          ? 'ring-2 ring-green-500 border-green-500 bg-green-50 dark:bg-green-950/30'
                          : ''
                      }`}
                    >
                      <Unlock className={`h-4 w-4 ${formData.is_public ? 'text-green-600' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <p className="font-medium">Public</p>
                        <p className="text-xs text-gray-500">Anyone can access</p>
                      </div>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setFormData({ ...formData, is_public: false }); }}
                      className={`flex-1 font-manrope justify-start gap-3 h-auto py-3 ${
                        !formData.is_public
                          ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                          : ''
                      }`}
                    >
                      <Lock className={`h-4 w-4 ${!formData.is_public ? 'text-amber-600' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <p className="font-medium">Private</p>
                        <p className="text-xs text-gray-500">Requires API key</p>
                      </div>
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Private chatbots require an API key for web access. Webhook channels (Discord, Telegram) use platform access control.
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
                    onValueChange={(value) => { setFormData({ ...formData, model: value as typeof AIModel[keyof typeof AIModel] }); }}
                  >
                    <SelectTrigger className="font-manrope">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AIModel).map(([_key, value]) => (
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
                    onValueChange={(value) => { setFormData({ ...formData, temperature: value[0] }); }}
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
                    onChange={(e) => { setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 2000 }); }}
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
                        onChange={(e) => { setFormData({ ...formData, memory_enabled: e.target.checked }); }}
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
                      onChange={(e) => { setFormData({ ...formData, memory_max_messages: parseInt(e.target.value) || 20 }); }}
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

          {/* Knowledge Bases Tab */}
          <TabsContent value="knowledge-bases">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-teal-200 dark:border-teal-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                  <div>
                    <CardTitle className="text-lg font-bold text-teal-900 dark:text-teal-100 font-manrope">Knowledge Bases</CardTitle>
                    <CardDescription className="text-teal-700 dark:text-teal-300 font-manrope">Attach knowledge bases to enhance your chatbot with relevant information</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Attached Knowledge Bases Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                      Attached Knowledge Bases ({attachedKBs.length})
                    </h3>
                    {kbSaving && (
                      <RefreshCw className="h-4 w-4 animate-spin text-teal-500" />
                    )}
                  </div>

                  {attachedKBs.length === 0 ? (
                    <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-center">
                      <Database className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
                        No knowledge bases attached yet.
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-manrope mt-1">
                        Add a knowledge base below to enhance your chatbot's responses with relevant information.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachedKBs.map((kb) => (
                        <div
                          key={kb.kb_id}
                          className={`flex items-center justify-between p-4 border rounded-xl transition-all ${
                            kb.enabled
                              ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800'
                              : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <Switch
                              checked={kb.enabled}
                              onCheckedChange={(enabled) => { void handleToggleKB(kb.kb_id, enabled); }}
                              disabled={kbSaving}
                            />
                            <div>
                              <span className={`font-medium font-manrope ${kb.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                {kb.name}
                              </span>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                                Priority: {kb.priority} {!kb.enabled && '• Disabled'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { void handleDetachKB(kb.kb_id); }}
                            disabled={kbSaving}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available Knowledge Bases Section */}
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                    Available Knowledge Bases
                  </h3>

                  {kbLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-teal-500" />
                      <span className="ml-2 text-sm text-gray-500 font-manrope">Loading knowledge bases...</span>
                    </div>
                  ) : availableKBs.length === 0 ? (
                    <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
                        {attachedKBs.length > 0
                          ? 'All available knowledge bases are already attached.'
                          : 'No knowledge bases available in this workspace.'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 font-manrope"
                        onClick={() => { navigate('/knowledge-bases/create'); }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create Knowledge Base
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableKBs.map((kb) => (
                        <div
                          key={kb.id}
                          className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-teal-300 dark:hover:border-teal-700 transition-all"
                        >
                          <div>
                            <span className="font-medium text-gray-900 dark:text-gray-100 font-manrope">{kb.name}</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                              {kb.total_documents ?? 0} documents • {kb.total_chunks ?? 0} chunks
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { void handleAttachKB(kb); }}
                            disabled={kbSaving}
                            className="font-manrope text-teal-600 border-teal-300 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-700 dark:hover:bg-teal-950/30"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Attach
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info Alert */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100 font-manrope">How Knowledge Bases Work</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 font-manrope">
                        When a user asks a question, the chatbot searches attached knowledge bases for relevant information
                        and uses it to generate accurate, grounded responses. You can enable/disable individual KBs or
                        set their priority to control search order.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Knowledge Base Behavior Settings */}
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                        Knowledge Base Behavior
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                        Control how the AI uses your knowledge base
                      </p>
                    </div>
                  </div>

                  {/* Citations Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                          Citations & Attributions
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                          Show knowledge base sources in responses
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.enable_citations}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, enable_citations: checked }))
                      }
                    />
                  </div>

                  {/* Follow-up Questions Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                          Follow-up Questions
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                          Suggest related questions after responses
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.enable_follow_up_questions}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, enable_follow_up_questions: checked }))
                      }
                    />
                  </div>

                  {/* Grounding Mode */}
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                        Knowledge Base Usage
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                        Control how strictly the AI uses your knowledge base
                      </p>
                    </div>

                    <RadioGroup
                      value={formData.grounding_mode}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, grounding_mode: value }))
                      }
                      className="space-y-2"
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value={GroundingMode.STRICT} id="edit-grounding-strict" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="edit-grounding-strict" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope cursor-pointer">
                            Strict (Recommended)
                          </Label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                            Only answer from knowledge base. Refuses if information not found.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value={GroundingMode.GUIDED} id="edit-grounding-guided" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="edit-grounding-guided" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope cursor-pointer">
                            Guided
                          </Label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                            Prefers knowledge base but can use general knowledge (with disclosure).
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value={GroundingMode.FLEXIBLE} id="edit-grounding-flexible" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="edit-grounding-flexible" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope cursor-pointer">
                            Flexible
                          </Label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                            Uses knowledge base to enhance responses, freely uses general knowledge.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
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
                    onChange={(e) => { setFormData({ ...formData, greeting: e.target.value }); }}
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
                {/* Chat Title */}
                <div className="space-y-2">
                  <Label htmlFor="chat_title" className="font-manrope">Widget Display Name</Label>
                  <Input
                    id="chat_title"
                    value={formData.chat_title}
                    onChange={(e) => { setFormData({ ...formData, chat_title: e.target.value }); }}
                    placeholder="Chat with us"
                    className="font-manrope"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Title displayed in the chat window header
                  </p>
                </div>

                {/* Avatar Upload */}
                <div className="space-y-2">
                  <Label className="font-manrope">Chatbot Avatar</Label>
                  <div className="flex items-center gap-4">
                    {chatbotId && (
                      <AvatarUpload
                        entityType="chatbots"
                        entityId={chatbotId}
                        currentAvatarUrl={formData.avatar_url || undefined}
                        name={formData.name || "Bot"}
                        size="md"
                        onAvatarChange={(url) => {
                          setFormData({ ...formData, avatar_url: url || '' });
                          setAvatarError('');
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                        Click the avatar to upload an image, or enter a URL below.
                      </p>
                    </div>
                  </div>

                  {/* Secondary: URL text input for external images */}
                  <div className="pt-2">
                    <Label htmlFor="avatar_url" className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                      Or enter URL directly
                    </Label>
                    <Input
                      id="avatar_url"
                      value={formData.avatar_url}
                      onChange={(e) => {
                        setFormData({ ...formData, avatar_url: e.target.value });
                        setAvatarError('');
                      }}
                      placeholder="https://example.com/avatar.png"
                      className={`font-manrope mt-1 ${avatarError ? 'border-red-500' : ''}`}
                    />
                    {avatarError && (
                      <p className="text-sm text-red-500 font-manrope mt-1">{avatarError}</p>
                    )}
                  </div>
                </div>

                {/* Primary Color */}
                <div className="space-y-3">
                  <Label className="font-manrope">Primary Color</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, primary_color: color.value });
                          setColorError('');
                        }}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          formData.primary_color === color.value
                            ? 'ring-2 ring-offset-2 ring-blue-500'
                            : 'border-gray-200 dark:border-gray-600 hover:scale-110'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                  {/* Custom Hex Input */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[200px]">
                      <Input
                        value={formData.primary_color}
                        onChange={(e) => {
                          let color = e.target.value;
                          if (color && !color.startsWith('#')) {
                            color = '#' + color;
                          }
                          setFormData({ ...formData, primary_color: color });
                          if (color && !isValidHex(color) && color.length >= 4) {
                            setColorError('Invalid hex format');
                          } else {
                            setColorError('');
                          }
                        }}
                        placeholder="#3b82f6"
                        className={`font-mono text-sm pl-10 ${colorError ? 'border-red-500' : ''}`}
                      />
                      <div
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-gray-500"
                        style={{ backgroundColor: isValidHex(formData.primary_color) ? formData.primary_color : '#ccc' }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                      Custom hex color
                    </span>
                  </div>
                  {colorError && (
                    <p className="text-sm text-red-500 font-manrope">{colorError}</p>
                  )}
                </div>

                {/* Secondary Color */}
                <div className="space-y-3">
                  <Label className="font-manrope">Secondary Color</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    Used for accents, links, and buttons
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[200px]">
                      <Input
                        value={formData.secondary_color}
                        onChange={(e) => {
                          let color = e.target.value;
                          if (color && !color.startsWith('#')) {
                            color = '#' + color;
                          }
                          setFormData({ ...formData, secondary_color: color });
                          if (color && !isValidHex(color) && color.length >= 4) {
                            setSecondaryColorError('Invalid hex format');
                          } else {
                            setSecondaryColorError('');
                          }
                        }}
                        placeholder="#8b5cf6"
                        className={`font-mono text-sm pl-10 ${secondaryColorError ? 'border-red-500' : ''}`}
                      />
                      <div
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-gray-500"
                        style={{ backgroundColor: isValidHex(formData.secondary_color) ? formData.secondary_color : '#ccc' }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                      Hex color
                    </span>
                  </div>
                  {secondaryColorError && (
                    <p className="text-sm text-red-500 font-manrope">{secondaryColorError}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Font Family */}
                  <div className="space-y-2">
                    <Label className="font-manrope">Font Family</Label>
                    <Select
                      value={formData.font_family}
                      onValueChange={(value) => { setFormData({ ...formData, font_family: value }); }}
                    >
                      <SelectTrigger className="font-manrope">
                        <SelectValue placeholder="Select font" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inter" className="font-manrope">Inter (Recommended)</SelectItem>
                        <SelectItem value="System" className="font-manrope">System Default</SelectItem>
                        <SelectItem value="Monospace" className="font-manrope">Monospace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Widget Position */}
                  <div className="space-y-2">
                    <Label className="font-manrope">Widget Position</Label>
                    <Select
                      value={formData.position}
                      onValueChange={(value) => { setFormData({ ...formData, position: value }); }}
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

                {/* Bubble Style */}
                <div className="space-y-3">
                  <Label className="font-manrope">Bubble Style</Label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setFormData({ ...formData, bubble_style: 'rounded' }); }}
                      className={`flex-1 ${formData.bubble_style === 'rounded' ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      Rounded
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setFormData({ ...formData, bubble_style: 'square' }); }}
                      className={`flex-1 ${formData.bubble_style === 'square' ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      Square
                    </Button>
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope mb-3">Preview</p>
                  <div className="relative h-24 bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
                    <div
                      className={`absolute bottom-3 w-14 h-14 flex items-center justify-center shadow-lg cursor-pointer transition-all hover:scale-110 overflow-hidden ${
                        formData.bubble_style === 'rounded' ? 'rounded-full' : 'rounded-lg'
                      } ${formData.position === 'bottom-right' ? 'right-3' : 'left-3'}`}
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      {formData.avatar_url ? (
                        <img
                          src={formData.avatar_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <MessageSquare className="h-6 w-6 text-white" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lead Capture Tab */}
          <TabsContent value="leads">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border-b border-cyan-200 dark:border-cyan-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <UserPlus className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                  <div>
                    <CardTitle className="text-lg font-bold text-cyan-900 dark:text-cyan-100 font-manrope">Lead Capture</CardTitle>
                    <CardDescription className="text-cyan-700 dark:text-cyan-300 font-manrope">Collect visitor information across all platforms</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                  <div>
                    <Label className="font-manrope font-medium">Enable Lead Capture</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope mt-1">
                      Collect visitor information from enabled platforms
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.lead_capture_enabled}
                      onChange={(e) => { setFormData({ ...formData, lead_capture_enabled: e.target.checked }); }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
                  </label>
                </div>

                {/* Timing Selection */}
                <div className={`space-y-4 ${!formData.lead_capture_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Label className="font-manrope">When to Collect Information</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setFormData({ ...formData, lead_capture_timing: LeadCaptureTiming.BEFORE_CHAT }); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.lead_capture_timing === LeadCaptureTiming.BEFORE_CHAT
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">Before Chat</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-manrope">Form shows before user can chat</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormData({ ...formData, lead_capture_timing: LeadCaptureTiming.AFTER_N_MESSAGES }); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.lead_capture_timing === LeadCaptureTiming.AFTER_N_MESSAGES
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">After N Messages</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-manrope">Form shows after user sends N messages</p>
                    </button>
                  </div>

                  {/* Messages before prompt slider */}
                  {formData.lead_capture_timing === LeadCaptureTiming.AFTER_N_MESSAGES && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="font-manrope text-sm">Messages before prompt: {formData.lead_capture_messages_before_prompt}</Label>
                      </div>
                      <Slider
                        value={[formData.lead_capture_messages_before_prompt]}
                        onValueChange={(value) => { setFormData({ ...formData, lead_capture_messages_before_prompt: value[0] }); }}
                        min={1}
                        max={10}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>1</span>
                        <span>5</span>
                        <span>10</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Standard Fields Configuration */}
                <div className={`space-y-4 ${!formData.lead_capture_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Label className="font-manrope">Standard Fields (Web Form)</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope -mt-2">
                    Configure which fields appear on the web lead form
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Email Field */}
                    <div className="space-y-2">
                      <Label className="font-manrope text-sm flex items-center gap-2">
                        <Send className="h-4 w-4 text-gray-400" />
                        Email
                      </Label>
                      <Select
                        value={formData.lead_capture_email_visibility}
                        onValueChange={(value) => { setFormData({ ...formData, lead_capture_email_visibility: value }); }}
                      >
                        <SelectTrigger className="font-manrope">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FieldVisibility.REQUIRED} className="font-manrope">Required</SelectItem>
                          <SelectItem value={FieldVisibility.OPTIONAL} className="font-manrope">Optional</SelectItem>
                          <SelectItem value={FieldVisibility.HIDDEN} className="font-manrope">Hidden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Name Field */}
                    <div className="space-y-2">
                      <Label className="font-manrope text-sm flex items-center gap-2">
                        <Hash className="h-4 w-4 text-gray-400" />
                        Name
                      </Label>
                      <Select
                        value={formData.lead_capture_name_visibility}
                        onValueChange={(value) => { setFormData({ ...formData, lead_capture_name_visibility: value }); }}
                      >
                        <SelectTrigger className="font-manrope">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FieldVisibility.REQUIRED} className="font-manrope">Required</SelectItem>
                          <SelectItem value={FieldVisibility.OPTIONAL} className="font-manrope">Optional</SelectItem>
                          <SelectItem value={FieldVisibility.HIDDEN} className="font-manrope">Hidden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Phone Field */}
                    <div className="space-y-2">
                      <Label className="font-manrope text-sm flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        Phone
                      </Label>
                      <Select
                        value={formData.lead_capture_phone_visibility}
                        onValueChange={(value) => { setFormData({ ...formData, lead_capture_phone_visibility: value }); }}
                      >
                        <SelectTrigger className="font-manrope">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FieldVisibility.REQUIRED} className="font-manrope">Required</SelectItem>
                          <SelectItem value={FieldVisibility.OPTIONAL} className="font-manrope">Optional</SelectItem>
                          <SelectItem value={FieldVisibility.HIDDEN} className="font-manrope">Hidden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Custom Fields */}
                <div className={`space-y-4 ${!formData.lead_capture_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-manrope">Custom Fields</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-manrope">
                        Add additional fields to collect specific information
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCustomField(null);
                        setCustomFieldForm({ name: '', label: '', type: CustomFieldType.TEXT, required: false, placeholder: '', options: '' });
                        setShowCustomFieldModal(true);
                      }}
                      className="font-manrope"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Field
                    </Button>
                  </div>

                  {/* Custom Fields List */}
                  {formData.lead_capture_custom_fields.length > 0 ? (
                    <div className="space-y-2">
                      {formData.lead_capture_custom_fields.map((field, index) => (
                        <div key={field.id || index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="font-manrope text-gray-900 dark:text-gray-100">{field.label}</span>
                            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded font-manrope">
                              {field.type}
                            </span>
                            {field.required && (
                              <span className="text-xs bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded font-manrope">
                                Required
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newFields = formData.lead_capture_custom_fields.filter((_, i) => i !== index);
                              setFormData({ ...formData, lead_capture_custom_fields: newFields });
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
                        No custom fields added yet
                      </p>
                    </div>
                  )}
                </div>

                {/* Platform Settings */}
                <div className={`space-y-4 ${!formData.lead_capture_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Label className="font-manrope">Platform Settings</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope -mt-2">
                    Enable lead capture per platform and configure prompts
                  </p>

                  {/* Web Platform */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">Web (Widget + Public Page)</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Uses form with fields configured above</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.lead_capture_web_enabled}
                          onChange={(e) => { setFormData({ ...formData, lead_capture_web_enabled: e.target.checked }); }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope pl-8">
                      Auto-captures: IP, location, browser, referrer, language
                    </p>
                  </div>

                  {/* Telegram Platform */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Send className="h-5 w-5 text-sky-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">Telegram</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Auto-captures: user_id, username, name</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setExpandedPlatforms({ ...expandedPlatforms, telegram: !expandedPlatforms.telegram }); }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          {expandedPlatforms.telegram ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.lead_capture_telegram_enabled}
                            onChange={(e) => { setFormData({ ...formData, lead_capture_telegram_enabled: e.target.checked }); }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 dark:peer-focus:ring-sky-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-sky-600"></div>
                        </label>
                      </div>
                    </div>
                    {expandedPlatforms.telegram && formData.lead_capture_telegram_enabled && (
                      <div className="pl-8 space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.lead_capture_telegram_prompt_email}
                            onChange={(e) => { setFormData({ ...formData, lead_capture_telegram_prompt_email: e.target.checked }); }}
                            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span className="text-sm font-manrope text-gray-700 dark:text-gray-300">Prompt for email in conversation</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.lead_capture_telegram_prompt_phone}
                            onChange={(e) => { setFormData({ ...formData, lead_capture_telegram_prompt_phone: e.target.checked }); }}
                            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span className="text-sm font-manrope text-gray-700 dark:text-gray-300">Prompt for phone in conversation</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Discord Platform */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-5 w-5 text-indigo-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">Discord</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Auto-captures: user_id, username, guild context</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setExpandedPlatforms({ ...expandedPlatforms, discord: !expandedPlatforms.discord }); }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          {expandedPlatforms.discord ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.lead_capture_discord_enabled}
                            onChange={(e) => { setFormData({ ...formData, lead_capture_discord_enabled: e.target.checked }); }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>
                    {expandedPlatforms.discord && formData.lead_capture_discord_enabled && (
                      <div className="pl-8 space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.lead_capture_discord_prompt_email}
                            onChange={(e) => { setFormData({ ...formData, lead_capture_discord_prompt_email: e.target.checked }); }}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-manrope text-gray-700 dark:text-gray-300">Prompt for email in conversation</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* WhatsApp Platform */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">WhatsApp</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Auto-captures: verified phone, wa_id, profile name</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setExpandedPlatforms({ ...expandedPlatforms, whatsapp: !expandedPlatforms.whatsapp }); }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          {expandedPlatforms.whatsapp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.lead_capture_whatsapp_enabled}
                            onChange={(e) => { setFormData({ ...formData, lead_capture_whatsapp_enabled: e.target.checked }); }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                        </label>
                      </div>
                    </div>
                    {expandedPlatforms.whatsapp && formData.lead_capture_whatsapp_enabled && (
                      <div className="pl-8 space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.lead_capture_whatsapp_prompt_email}
                            onChange={(e) => { setFormData({ ...formData, lead_capture_whatsapp_prompt_email: e.target.checked }); }}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm font-manrope text-gray-700 dark:text-gray-300">Prompt for email in conversation</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Skip Option */}
                <div className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl ${!formData.lead_capture_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div>
                    <Label className="font-manrope font-medium">Allow Users to Skip (Web only)</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope mt-1">
                      Let users skip the lead form and chat without providing info
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.lead_capture_allow_skip}
                      onChange={(e) => { setFormData({ ...formData, lead_capture_allow_skip: e.target.checked }); }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
                  </label>
                </div>

                {/* Privacy & Consent */}
                <div className={`space-y-4 ${!formData.lead_capture_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Label className="font-manrope">Privacy & Consent</Label>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                    <div>
                      <Label className="font-manrope font-medium">Require Explicit Consent (GDPR)</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope mt-1">
                        User must agree before submitting their data
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lead_capture_require_consent}
                        onChange={(e) => { setFormData({ ...formData, lead_capture_require_consent: e.target.checked }); }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
                    </label>
                  </div>

                  {formData.lead_capture_require_consent && (
                    <div className="space-y-2">
                      <Label htmlFor="consent_message" className="font-manrope">Consent Message</Label>
                      <Textarea
                        id="consent_message"
                        value={formData.lead_capture_consent_message}
                        onChange={(e) => { setFormData({ ...formData, lead_capture_consent_message: e.target.value }); }}
                        placeholder="I agree to the collection and processing of my data."
                        rows={2}
                        className="font-manrope"
                      />
                    </div>
                  )}
                </div>

                {/* Auto-Capture Info */}
                <div className={`p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 ${!formData.lead_capture_enabled ? 'opacity-50' : ''}`}>
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100 font-manrope">Automatically Captured Data</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 font-manrope">
                        Each platform captures specific data transparently. Web: IP, location, browser, referrer.
                        Messaging platforms: user identifiers, usernames, and platform-specific metadata.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Field Modal */}
            {showCustomFieldModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white font-manrope mb-4">
                    {editingCustomField ? 'Edit Custom Field' : 'Add Custom Field'}
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-manrope">Field Name (internal)</Label>
                      <Input
                        value={customFieldForm.name}
                        onChange={(e) => { setCustomFieldForm({ ...customFieldForm, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }); }}
                        placeholder="company_name"
                        className="font-manrope"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-manrope">Label (displayed)</Label>
                      <Input
                        value={customFieldForm.label}
                        onChange={(e) => { setCustomFieldForm({ ...customFieldForm, label: e.target.value }); }}
                        placeholder="Company Name"
                        className="font-manrope"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-manrope">Field Type</Label>
                      <Select
                        value={customFieldForm.type}
                        onValueChange={(value) => { setCustomFieldForm({ ...customFieldForm, type: value }); }}
                      >
                        <SelectTrigger className="font-manrope">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CustomFieldType.TEXT} className="font-manrope">Text</SelectItem>
                          <SelectItem value={CustomFieldType.EMAIL} className="font-manrope">Email</SelectItem>
                          <SelectItem value={CustomFieldType.PHONE} className="font-manrope">Phone</SelectItem>
                          <SelectItem value={CustomFieldType.SELECT} className="font-manrope">Select (Dropdown)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {customFieldForm.type === CustomFieldType.SELECT && (
                      <div className="space-y-2">
                        <Label className="font-manrope">Options (comma-separated)</Label>
                        <Input
                          value={customFieldForm.options}
                          onChange={(e) => { setCustomFieldForm({ ...customFieldForm, options: e.target.value }); }}
                          placeholder="Option 1, Option 2, Option 3"
                          className="font-manrope"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="font-manrope">Placeholder</Label>
                      <Input
                        value={customFieldForm.placeholder}
                        onChange={(e) => { setCustomFieldForm({ ...customFieldForm, placeholder: e.target.value }); }}
                        placeholder="Enter your company name"
                        className="font-manrope"
                      />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customFieldForm.required}
                        onChange={(e) => { setCustomFieldForm({ ...customFieldForm, required: e.target.checked }); }}
                        className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-sm font-manrope text-gray-700 dark:text-gray-300">Required field</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setShowCustomFieldModal(false); }}
                      className="font-manrope"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (customFieldForm.name && customFieldForm.label) {
                          const newField: LeadCaptureCustomField = {
                            id: editingCustomField?.id ?? `cf_${String(Date.now())}`,
                            name: customFieldForm.name,
                            label: customFieldForm.label,
                            type: customFieldForm.type as typeof CustomFieldType[keyof typeof CustomFieldType],
                            required: customFieldForm.required,
                            placeholder: customFieldForm.placeholder || undefined,
                            options: customFieldForm.type === CustomFieldType.SELECT
                              ? customFieldForm.options.split(',').map(o => o.trim()).filter(Boolean)
                              : undefined,
                          };
                          if (editingCustomField) {
                            const newFields = formData.lead_capture_custom_fields.map(f =>
                              f.id === editingCustomField.id ? newField : f
                            );
                            setFormData({ ...formData, lead_capture_custom_fields: newFields });
                          } else {
                            setFormData({
                              ...formData,
                              lead_capture_custom_fields: [...formData.lead_capture_custom_fields, newField]
                            });
                          }
                          setShowCustomFieldModal(false);
                        }
                      }}
                      className="font-manrope"
                    >
                      {editingCustomField ? 'Save Changes' : 'Add Field'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
