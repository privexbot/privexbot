/**
 * Chatbot Detail Page
 *
 * Shows detailed view of a deployed chatbot with configuration, test panel, and embed code
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeft,
  Bot,
  Settings,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  CheckCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  XCircle,
  MessageSquare,
  Users,
  Zap,
  Code,
  Send,
  Copy,
  ExternalLink,
  Pause,
  Play,
  Database,
  Sparkles,
  BarChart2,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Eye,
  MousePointer,
  Key,
  RotateCcw,
  Globe,
  Plus,
  Phone,
  Link2,
  QrCode,
  Check,
  EyeOff,
  Edit2,
  X,
  Loader2,
} from 'lucide-react';
import { chatbotApi } from '@/api/chatbot';
import { credentialApi } from '@/api/credentials';
import { discordApi, type GuildDeployment, type DiscordChannel } from '@/api/discord';
import { workspaceApi } from '@/api/workspace';
import { useApp } from '@/contexts/AppContext';
import type { Chatbot, ChatMessage, ChatbotAnalytics, APIKeyInfo } from '@/types/chatbot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatbotDetailPage() {
  const { chatbotId } = useParams<{ chatbotId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace, currentOrganization, workspaces } = useApp();

  // Get initial tab from URL parameter, default to 'overview'
  const initialTab = searchParams.get('tab') ?? 'overview';
  const validTabs = ['overview', 'test', 'embed', 'deployment', 'hosted-page', 'settings', 'analytics'];
  const defaultTab = validTabs.includes(initialTab) ? initialTab : 'overview';

  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [embedCodeCopied, setEmbedCodeCopied] = useState(false);

  // Test chat state
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [testSessionId, setTestSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<ChatbotAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(7);

  // API Key state
  const [apiKeys, setApiKeys] = useState<APIKeyInfo[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [deleteKeyDialogOpen, setDeleteKeyDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<APIKeyInfo | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [newApiKeyCopied, setNewApiKeyCopied] = useState(false);

  // Metrics refresh state
  const [metricsRefreshing, setMetricsRefreshing] = useState(false);

  // Telegram channel state
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramConnecting, setTelegramConnecting] = useState(false);

  // Discord channel state (shared bot architecture)
  const [discordModalOpen, setDiscordModalOpen] = useState(false);
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const [discordGuilds, setDiscordGuilds] = useState<GuildDeployment[]>([]);
  const [discordInviteUrl, setDiscordInviteUrl] = useState<string | null>(null);

  // Discord channel configuration state
  const [channelConfigModalOpen, setChannelConfigModalOpen] = useState(false);
  const [channelConfigGuild, setChannelConfigGuild] = useState<GuildDeployment | null>(null);
  const [availableChannels, setAvailableChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsSaving, setChannelsSaving] = useState(false);

  // Chatbot slug editing state
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isUpdatingSlug, setIsUpdatingSlug] = useState(false);

  // Workspace slug editing state
  const [isEditingWorkspaceSlug, setIsEditingWorkspaceSlug] = useState(false);
  const [workspaceSlugInput, setWorkspaceSlugInput] = useState('');
  const [workspaceSlugError, setWorkspaceSlugError] = useState<string | null>(null);
  const [isUpdatingWorkspaceSlug, setIsUpdatingWorkspaceSlug] = useState(false);

  useEffect(() => {
    if (chatbotId && currentWorkspace) {
      void loadChatbotData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId, currentWorkspace]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [testMessages]);

  const loadChatbotData = async () => {
    if (!chatbotId || !currentWorkspace) return;

    setIsLoading(true);
    try {
      const data = await chatbotApi.get(chatbotId);

      // Verify chatbot belongs to current workspace
      if (data.workspace_id !== currentWorkspace.id) {
        const chatbotWorkspace = workspaces.find(ws => ws.id === data.workspace_id);

        if (chatbotWorkspace) {
          toast({
            title: 'Wrong Workspace',
            description: `This chatbot belongs to "${chatbotWorkspace.name}". Please switch to that workspace.`,
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to view this chatbot',
            variant: 'destructive'
          });
        }
        navigate('/chatbots');
        return;
      }

      setChatbot(data);

      // Add greeting as first message if available
      const greeting = data.prompt_config.messages?.greeting;
      if (greeting && testMessages.length === 0) {
        setTestMessages([{
          id: 'greeting',
          role: 'assistant',
          content: greeting,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (error) {
      console.error('Failed to load chatbot:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chatbot details',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!chatbotId || !chatbot) return;

    try {
      await chatbotApi.archive(chatbotId);
      toast({
        title: 'Success',
        description: `Chatbot "${chatbot.name}" has been archived`,
      });
      setArchiveDialogOpen(false);
      navigate('/chatbots');
    } catch (error) {
      console.error('Failed to archive chatbot:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive chatbot',
        variant: 'destructive'
      });
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'paused') => {
    if (!chatbotId || !chatbot) return;

    try {
      const result = await chatbotApi.updateStatus(chatbotId, newStatus);

      // Update local state
      setChatbot(prev => prev ? { ...prev, status: result.new_status as Chatbot['status'] } : null);

      toast({
        title: newStatus === 'active' ? 'Chatbot Activated' : 'Chatbot Paused',
        description: newStatus === 'active'
          ? `"${chatbot.name}" is now live and accepting messages`
          : `"${chatbot.name}" has been paused and won't respond to new messages`,
      });
    } catch (error) {
      console.error('Failed to update chatbot status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  const handleTestMessage = async () => {
    if (!testInput.trim() || !chatbotId || isTestLoading) return;

    const userMessage: ChatMessage = {
      id: `user_${String(Date.now())}`,
      role: 'user',
      content: testInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setTestMessages(prev => [...prev, userMessage]);
    setTestInput('');
    setIsTestLoading(true);

    try {
      const response = await chatbotApi.test(chatbotId, {
        message: userMessage.content,
        session_id: testSessionId ?? undefined,
      });

      const assistantMessage: ChatMessage = {
        id: response.message_id,
        role: 'assistant',
        content: response.response,
        sources: response.sources,
        timestamp: new Date().toISOString(),
      };

      setTestMessages(prev => [...prev, assistantMessage]);
      setTestSessionId(response.session_id);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response';
      toast({
        title: 'Test Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'archived':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'paused':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'archived':
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const getEmbedCode = () => {
    if (!chatbot) return '';

    const apiUrl = String(import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1');
    const widgetUrl = String(import.meta.env.VITE_WIDGET_URL ?? 'http://localhost:9000/widget.js');
    const color = chatbot.branding_config.primary_color ?? '#6366f1';
    const position = chatbot.branding_config.position ?? 'bottom-right';
    const greeting = chatbot.prompt_config.messages?.greeting ?? 'Hello! How can I help you?';
    const botName = chatbot.branding_config.chat_title ?? chatbot.name;

    return `<script src="${widgetUrl}"></script>
<script>
  pb('init', {
    id: '${chatbot.id}',
    apiKey: 'YOUR_API_KEY', // Replace with your API key
    options: {
      baseURL: '${apiUrl}',
      position: '${position}',
      color: '${color}',
      greeting: '${greeting}',
      botName: '${botName}'
    }
  });
</script>`;
  };

  const copyEmbedCode = () => {
    void navigator.clipboard.writeText(getEmbedCode());
    setEmbedCodeCopied(true);
    setTimeout(() => { setEmbedCodeCopied(false); }, 2000);
    toast({
      title: 'Copied!',
      description: 'Embed code copied to clipboard',
    });
  };

  const loadAnalytics = async () => {
    if (!chatbotId || analyticsLoading) return;

    setAnalyticsLoading(true);
    try {
      const data = await chatbotApi.getAnalytics(chatbotId, analyticsDays);
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive'
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Load analytics when tab is selected or days change
  useEffect(() => {
    if (activeTab === 'analytics' && chatbotId) {
      void loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, analyticsDays, chatbotId]);

  // Load API keys when embed tab is selected
  useEffect(() => {
    if (activeTab === 'embed' && chatbotId) {
      void loadApiKeys();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, chatbotId]);

  const loadApiKeys = async () => {
    if (!chatbotId || apiKeysLoading) return;

    setApiKeysLoading(true);
    try {
      const keys = await chatbotApi.listApiKeys(chatbotId);
      setApiKeys(keys);
    } catch (error) {
      console.error('Failed to load API keys:', error);
      // Don't show error toast - might be a new chatbot without keys
    } finally {
      setApiKeysLoading(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!chatbotId) return;

    try {
      const result = await chatbotApi.regenerateApiKey(chatbotId);
      setNewApiKey(result.api_key);
      // Reload keys to show the new key prefix
      await loadApiKeys();
      toast({
        title: 'API Key Regenerated',
        description: 'Your new API key has been generated. Save it now!',
      });
    } catch (error) {
      console.error('Failed to regenerate API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate API key',
        variant: 'destructive'
      });
    }
  };

  const confirmDeleteApiKey = (key: APIKeyInfo) => {
    setKeyToDelete(key);
    setDeleteKeyDialogOpen(true);
  };

  const handleDeleteApiKey = async () => {
    if (!chatbotId || !keyToDelete) return;

    try {
      await chatbotApi.deleteApiKey(chatbotId, keyToDelete.id);
      // Reload keys to reflect the change
      await loadApiKeys();
      setDeleteKeyDialogOpen(false);
      setKeyToDelete(null);
      toast({
        title: 'API Key Deleted',
        description: 'The API key has been permanently deleted.',
      });
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive'
      });
    }
  };

  const copyNewApiKey = () => {
    if (newApiKey) {
      void navigator.clipboard.writeText(newApiKey);
      setNewApiKeyCopied(true);
      setTimeout(() => { setNewApiKeyCopied(false); }, 2000);
      toast({
        title: 'Copied!',
        description: 'API key copied to clipboard',
      });
    }
  };

  const handleRefreshMetrics = async () => {
    if (!chatbotId || metricsRefreshing) return;

    setMetricsRefreshing(true);
    try {
      const result = await chatbotApi.refreshMetrics(chatbotId);

      // Update the local chatbot state with new metrics
      setChatbot(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cached_metrics: {
            ...prev.cached_metrics,
            total_conversations: result.cached_metrics.total_conversations,
            total_messages: result.cached_metrics.total_messages,
            avg_messages_per_session: result.cached_metrics.avg_messages_per_session,
            active_sessions: result.cached_metrics.active_sessions,
            last_updated: result.cached_metrics.last_updated,
          }
        };
      });

      toast({
        title: 'Metrics Refreshed',
        description: 'Dashboard statistics have been updated.',
      });
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh metrics',
        variant: 'destructive'
      });
    } finally {
      setMetricsRefreshing(false);
    }
  };

  // Slug validation constants
  const RESERVED_SLUGS = ['api', 'admin', 'public', 'chat', 'auth', 'login', 'logout', 'signup', 'register', 'settings', 'dashboard', 'webhook', 'webhooks'];

  const validateSlug = (slug: string): string | null => {
    if (!slug || slug.trim() === '') {
      return 'Slug cannot be empty';
    }
    if (slug.length < 2) {
      return 'Slug must be at least 2 characters';
    }
    if (slug.length > 100) {
      return 'Slug cannot exceed 100 characters';
    }
    // Check pattern: lowercase alphanumeric + hyphens, must start/end with alphanumeric
    const validPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!validPattern.test(slug)) {
      return 'Use only lowercase letters, numbers, and hyphens. Must start and end with a letter or number.';
    }
    // Check for consecutive hyphens
    if (slug.includes('--')) {
      return 'Cannot contain consecutive hyphens';
    }
    // Check reserved words
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
      return `"${slug}" is a reserved word`;
    }
    return null;
  };

  const handleSlugEditStart = () => {
    if (chatbot?.slug) {
      setSlugInput(chatbot.slug);
      setSlugError(null);
      setIsEditingSlug(true);
    }
  };

  const handleSlugEditCancel = () => {
    setIsEditingSlug(false);
    setSlugInput('');
    setSlugError(null);
  };

  const handleSlugInputChange = (value: string) => {
    // Auto-lowercase and strip invalid characters
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlugInput(sanitized);
    setSlugError(null);
  };

  const handleSlugUpdate = async () => {
    if (!chatbotId || !chatbot || isUpdatingSlug) return;

    // Client-side validation
    const error = validateSlug(slugInput);
    if (error) {
      setSlugError(error);
      return;
    }

    // Skip if slug hasn't changed
    if (slugInput === chatbot.slug) {
      setIsEditingSlug(false);
      return;
    }

    setIsUpdatingSlug(true);
    try {
      const result = await chatbotApi.updateSlug(chatbotId, slugInput);

      // Update local state with new slug
      setChatbot(prev => {
        if (!prev) return null;
        return {
          ...prev,
          slug: result.new_slug,
        };
      });

      setIsEditingSlug(false);
      setSlugError(null);

      toast({
        title: 'URL Updated',
        description: result.redirect_active
          ? 'URL updated successfully. Old URLs will redirect to the new one.'
          : 'URL updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update slug:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update URL';

      // Check for specific error types
      if (errorMessage.toLowerCase().includes('already in use') || errorMessage.toLowerCase().includes('already exists')) {
        setSlugError('This slug is already in use. Please choose a different one.');
      } else {
        setSlugError(errorMessage);
      }
    } finally {
      setIsUpdatingSlug(false);
    }
  };

  const handleSlugKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSlugUpdate();
    } else if (e.key === 'Escape') {
      handleSlugEditCancel();
    }
  };

  // Workspace slug editing handlers
  const handleWorkspaceSlugEditStart = () => {
    if (chatbot?.workspace_slug) {
      setWorkspaceSlugInput(chatbot.workspace_slug);
      setWorkspaceSlugError(null);
      setIsEditingWorkspaceSlug(true);
    }
  };

  const handleWorkspaceSlugEditCancel = () => {
    setIsEditingWorkspaceSlug(false);
    setWorkspaceSlugInput('');
    setWorkspaceSlugError(null);
  };

  const handleWorkspaceSlugInputChange = (value: string) => {
    // Auto-lowercase and strip invalid characters
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setWorkspaceSlugInput(sanitized);
    setWorkspaceSlugError(null);
  };

  const handleWorkspaceSlugUpdate = async () => {
    if (!currentOrganization || !currentWorkspace || !chatbot || isUpdatingWorkspaceSlug) return;

    // Client-side validation (reuse same rules)
    const error = validateSlug(workspaceSlugInput);
    if (error) {
      setWorkspaceSlugError(error);
      return;
    }

    // Skip if slug hasn't changed
    if (workspaceSlugInput === chatbot.workspace_slug) {
      setIsEditingWorkspaceSlug(false);
      return;
    }

    setIsUpdatingWorkspaceSlug(true);
    try {
      const result = await workspaceApi.updateSlug(
        currentOrganization.id,
        currentWorkspace.id,
        workspaceSlugInput
      );

      // Update local state with new workspace slug
      setChatbot(prev => {
        if (!prev) return null;
        return {
          ...prev,
          workspace_slug: result.new_slug,
        };
      });

      setIsEditingWorkspaceSlug(false);
      setWorkspaceSlugError(null);

      toast({
        title: 'Workspace URL Updated',
        description: result.redirect_active
          ? 'Workspace URL updated successfully. Old URLs will redirect to the new one.'
          : 'Workspace URL updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update workspace slug:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update workspace URL';

      // Check for specific error types
      if (errorMessage.toLowerCase().includes('already in use') || errorMessage.toLowerCase().includes('already exists')) {
        setWorkspaceSlugError('This workspace slug is already in use. Please choose a different one.');
      } else {
        setWorkspaceSlugError(errorMessage);
      }
    } finally {
      setIsUpdatingWorkspaceSlug(false);
    }
  };

  const handleWorkspaceSlugKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleWorkspaceSlugUpdate();
    } else if (e.key === 'Escape') {
      handleWorkspaceSlugEditCancel();
    }
  };

  const handleConnectTelegram = async (botToken: string) => {
    if (!chatbot || !currentWorkspace) return;

    setTelegramConnecting(true);
    try {
      // 1. Create credential for bot token
      const credential = await credentialApi.create({
        workspace_id: currentWorkspace.id,
        name: `Telegram Bot - ${chatbot.name}`,
        credential_type: 'api_key',
        provider: 'telegram',
        data: { bot_token: botToken }
      });

      // 2. Add Telegram channel to chatbot
      const result = await chatbotApi.addTelegramChannel(
        chatbot.id,
        credential.credential_id
      );

      // 3. Update local state with new telegram config
      setChatbot({
        ...chatbot,
        deployment_config: {
          ...chatbot.deployment_config,
          telegram: {
            status: 'success',
            ...result.telegram
          }
        }
      });

      setTelegramModalOpen(false);
      toast({
        title: 'Telegram Connected',
        description: `Bot: ${result.telegram.bot_username}`,
      });
    } catch (error) {
      console.error('Failed to connect Telegram:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect Telegram bot',
        variant: 'destructive'
      });
    } finally {
      setTelegramConnecting(false);
    }
  };

  // Load Discord guild deployments for this chatbot
  const loadDiscordGuilds = async () => {
    if (!chatbot) return;
    try {
      const guilds = await discordApi.listDeployments(chatbot.id);
      setDiscordGuilds(guilds);
    } catch (error) {
      console.error('Failed to load Discord guilds:', error);
    }
  };

  // Handle Discord server connection
  const handleConnectDiscord = async (guildId: string, guildName: string) => {
    if (!chatbot) return;

    setDiscordConnecting(true);
    try {
      // Deploy chatbot to the Discord guild
      const deployment = await discordApi.deployToGuild({
        chatbot_id: chatbot.id,
        guild_id: guildId,
        guild_name: guildName,
      });

      // Add to local state
      setDiscordGuilds(prev => [...prev, deployment]);
      setDiscordModalOpen(false);

      toast({
        title: 'Discord Server Connected',
        description: `Server "${guildName || guildId}" is now connected to this chatbot`,
      });
    } catch (error) {
      console.error('Failed to connect Discord:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect Discord server',
        variant: 'destructive'
      });
    } finally {
      setDiscordConnecting(false);
    }
  };

  // Handle Discord guild removal
  const handleRemoveDiscordGuild = async (guildId: string) => {
    try {
      await discordApi.removeDeployment(guildId);
      setDiscordGuilds(prev => prev.filter(g => g.guild_id !== guildId));
      toast({
        title: 'Server Disconnected',
        description: 'Discord server has been disconnected from this chatbot',
      });
    } catch (error) {
      console.error('Failed to remove Discord guild:', error);
      toast({
        title: 'Removal Failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect Discord server',
        variant: 'destructive'
      });
    }
  };

  // Open channel configuration modal for a guild
  const openChannelConfig = async (guild: GuildDeployment) => {
    setChannelConfigGuild(guild);
    setSelectedChannelIds(guild.allowed_channel_ids || []);
    setChannelConfigModalOpen(true);
    setChannelsLoading(true);

    try {
      const data = await discordApi.getGuildChannels(guild.guild_id);
      setAvailableChannels(data.channels);
    } catch (error) {
      console.error('Failed to load channels:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Discord channels. The bot may not have access.',
        variant: 'destructive'
      });
      setAvailableChannels([]);
    } finally {
      setChannelsLoading(false);
    }
  };

  // Toggle channel selection
  const handleToggleChannel = (channelId: string) => {
    setSelectedChannelIds(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  // Save channel configuration
  const handleSaveChannelConfig = async () => {
    if (!channelConfigGuild) return;

    setChannelsSaving(true);
    try {
      const updated = await discordApi.updateDeployment(channelConfigGuild.guild_id, {
        allowed_channel_ids: selectedChannelIds
      });

      // Update local state
      setDiscordGuilds(prev => prev.map(g =>
        g.guild_id === channelConfigGuild.guild_id
          ? { ...g, allowed_channel_ids: updated.allowed_channel_ids }
          : g
      ));

      toast({
        title: 'Channels Updated',
        description: selectedChannelIds.length === 0
          ? 'Bot will now respond in all channels'
          : `Bot will respond in ${selectedChannelIds.length} selected channel(s)`,
      });

      setChannelConfigModalOpen(false);
    } catch (error) {
      console.error('Failed to save channel config:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save channel configuration',
        variant: 'destructive'
      });
    } finally {
      setChannelsSaving(false);
    }
  };

  // Load Discord invite URL on mount
  useEffect(() => {
    const loadDiscordInviteUrl = async () => {
      try {
        const data = await discordApi.getInviteUrl();
        setDiscordInviteUrl(data.invite_url);
      } catch {
        // Discord integration may not be configured - that's okay
      }
    };
    void loadDiscordInviteUrl();
  }, []);

  // Load Discord guilds when chatbot changes
  useEffect(() => {
    if (chatbot) {
      void loadDiscordGuilds();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbot?.id]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <RefreshCw className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h3 className="text-lg font-medium">Loading Chatbot</h3>
            <p className="text-muted-foreground">Fetching details...</p>
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
        <div>
          <Button
            variant="ghost"
            onClick={() => { navigate('/chatbots'); }}
            className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-manrope"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chatbots
          </Button>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-4">
                  <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-manrope break-words">
                        {chatbot.name}
                      </h1>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusIcon(chatbot.status)}
                        <Badge className={`border ${getStatusBadgeClass(chatbot.status)} font-manrope`}>
                          {chatbot.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {chatbot.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-base font-manrope leading-relaxed">
                    {chatbot.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400 font-manrope">
                  <span className="bg-gray-100 dark:bg-gray-700/50 px-3 py-1 rounded-lg">
                    Created {new Date(chatbot.created_at).toLocaleDateString()}
                  </span>
                  {chatbot.deployed_at && (
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-lg">
                      Deployed {new Date(chatbot.deployed_at).toLocaleDateString()}
                    </span>
                  )}
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg">
                    {chatbot.ai_config.model}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => { navigate(`/chatbots/${String(chatbotId)}/edit`); }}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600 flex-shrink-0 transition-all duration-200 font-manrope"
                >
                  <Settings className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                  Edit
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600 flex-shrink-0 transition-all duration-200">
                      <MoreHorizontal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="font-manrope bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-xl shadow-lg backdrop-blur-sm min-w-[160px]">
                    <DropdownMenuItem onClick={() => { void loadChatbotData(); }} className="hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200 rounded-lg mx-1 my-1">
                      <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-3" />
                      Refresh
                    </DropdownMenuItem>
                    {chatbot.status === 'active' ? (
                      <DropdownMenuItem
                        onClick={() => { void handleStatusChange('paused'); }}
                        className="hover:bg-amber-50 dark:hover:bg-amber-900/30 text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-300 transition-colors duration-200 rounded-lg mx-1 my-1"
                      >
                        <Pause className="h-4 w-4 text-amber-600 dark:text-amber-400 mr-3" />
                        Pause
                      </DropdownMenuItem>
                    ) : chatbot.status === 'paused' ? (
                      <DropdownMenuItem
                        onClick={() => { void handleStatusChange('active'); }}
                        className="hover:bg-green-50 dark:hover:bg-green-900/30 text-gray-700 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-300 transition-colors duration-200 rounded-lg mx-1 my-1"
                      >
                        <Play className="h-4 w-4 text-green-600 dark:text-green-400 mr-3" />
                        Resume
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => { setArchiveDialogOpen(true); }} className="hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-700 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-300 transition-colors duration-200 rounded-lg mx-1 my-1">
                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400 mr-3" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
              Statistics Overview
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handleRefreshMetrics(); }}
              disabled={metricsRefreshing}
              className="border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${metricsRefreshing ? 'animate-spin' : ''}`} />
              {metricsRefreshing ? 'Refreshing...' : 'Refresh Metrics'}
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 font-manrope">Conversations</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 font-manrope">
                    {chatbot.cached_metrics.total_conversations}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 font-manrope">Messages</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100 font-manrope">
                    {chatbot.cached_metrics.total_messages}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-manrope">Avg Response</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 font-manrope">
                    {chatbot.cached_metrics.avg_response_time_ms
                      ? `${(chatbot.cached_metrics.avg_response_time_ms / 1000).toFixed(1)}s`
                      : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 font-manrope">Knowledge Bases</p>
                  <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 font-manrope">
                    {(chatbot.kb_config.knowledge_bases ?? []).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm w-full justify-start overflow-x-auto">
            <TabsTrigger
              value="overview"
              className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="test"
              className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Test Chat
            </TabsTrigger>
            <TabsTrigger
              value="embed"
              className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <Code className="h-4 w-4 mr-1" />
              Embed Code
            </TabsTrigger>
            <TabsTrigger
              value="deployment"
              className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <Globe className="h-4 w-4 mr-1" />
              Deployment
            </TabsTrigger>
            <TabsTrigger
              value="hosted-page"
              className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <Link2 className="h-4 w-4 mr-1" />
              SecretVM
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              Configuration
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
            >
              <BarChart2 className="h-4 w-4 mr-1" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Configuration */}
              <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-b border-indigo-200 dark:border-indigo-700 rounded-t-xl p-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <CardTitle className="text-lg font-bold text-indigo-900 dark:text-indigo-100 font-manrope">AI Configuration</CardTitle>
                      <CardDescription className="text-indigo-700 dark:text-indigo-300 font-manrope">Model and generation settings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-manrope block mb-1">Model</label>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">{chatbot.ai_config.model}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-manrope block mb-1">Temperature</label>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">{chatbot.ai_config.temperature}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-manrope block mb-1">Max Tokens</label>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">{chatbot.ai_config.max_tokens}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Knowledge Bases */}
              <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200 dark:border-amber-700 rounded-t-xl p-6">
                  <div className="flex items-center gap-3">
                    <Database className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    <div>
                      <CardTitle className="text-lg font-bold text-amber-900 dark:text-amber-100 font-manrope">Knowledge Bases</CardTitle>
                      <CardDescription className="text-amber-700 dark:text-amber-300 font-manrope">Connected knowledge sources</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {(chatbot.kb_config.knowledge_bases ?? []).length > 0 ? (
                    <div className="space-y-3">
                      {(chatbot.kb_config.knowledge_bases ?? []).map((kb, index) => (
                        <div key={kb.kb_id || index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">{kb.name || kb.kb_id}</span>
                          </div>
                          <Badge variant="outline" className={`text-xs ${kb.enabled ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                            {kb.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Database className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">No knowledge bases connected</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Prompt */}
              <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm lg:col-span-2">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-200 dark:border-purple-700 rounded-t-xl p-6">
                  <div className="flex items-center gap-3">
                    <Bot className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    <div>
                      <CardTitle className="text-lg font-bold text-purple-900 dark:text-purple-100 font-manrope">System Prompt</CardTitle>
                      <CardDescription className="text-purple-700 dark:text-purple-300 font-manrope">Base instructions for the AI</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 font-manrope whitespace-pre-wrap">
                      {chatbot.prompt_config.system_prompt}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Test Chat Tab */}
          <TabsContent value="test">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-green-200 dark:border-green-700 rounded-t-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <div>
                      <CardTitle className="text-lg font-bold text-green-900 dark:text-green-100 font-manrope">Test Chat</CardTitle>
                      <CardDescription className="text-green-700 dark:text-green-300 font-manrope">Send test messages to your chatbot</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTestMessages([]);
                      setTestSessionId(null);
                      const greeting = chatbot.prompt_config.messages?.greeting;
                      if (greeting) {
                        setTestMessages([{
                          id: 'greeting',
                          role: 'assistant',
                          content: greeting,
                          timestamp: new Date().toISOString(),
                        }]);
                      }
                    }}
                    className="text-green-700 dark:text-green-300 border-green-200 dark:border-green-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset Chat
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Messages */}
                <div className="h-96 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900/50">
                  <AnimatePresence mode="popLayout">
                    {testMessages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md'
                        }`}>
                          {message.role === 'user' ? (
                            <p className="text-sm font-manrope whitespace-pre-wrap">{message.content}</p>
                          ) : (
                            <div className="text-sm font-manrope prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100 prose-li:text-gray-900 dark:prose-li:text-gray-100 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-700 prose-pre:text-gray-900 dark:prose-pre:text-gray-100 prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-code:text-gray-900 dark:prose-code:text-gray-100 prose-code:px-1 prose-code:rounded prose-pre:whitespace-pre-wrap prose-pre:break-words">
                              <ReactMarkdown>{message.content.replace(/^[ \t]+/gm, '')}</ReactMarkdown>
                            </div>
                          )}
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mb-1">Sources:</p>
                              {/* Deduplicate sources by URL + title */}
                              {Array.from(
                                new Map(
                                  message.sources.map(s => [
                                    `${s.document_url ?? ''}-${s.document_title ?? ''}`,
                                    s
                                  ])
                                ).values()
                              ).map((source, idx) => (
                                <div key={idx} className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded p-1 mt-1">
                                  {source.document_url ? (
                                    <a
                                      href={source.document_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      {source.document_title ?? `Source ${String(idx + 1)}`}
                                    </a>
                                  ) : (
                                    source.document_title ?? `Source ${String(idx + 1)}`
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {isTestLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleTestMessage();
                    }}
                    className="flex gap-3"
                  >
                    <Input
                      value={testInput}
                      onChange={(e) => { setTestInput(e.target.value); }}
                      placeholder="Type a message..."
                      disabled={isTestLoading}
                      className="flex-1 font-manrope"
                    />
                    <Button type="submit" disabled={!testInput.trim() || isTestLoading}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Embed Code Tab */}
          <TabsContent value="embed">
            <div className="space-y-6">
              {/* API Keys Section */}
              <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200 dark:border-amber-700 rounded-t-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Key className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      <div>
                        <CardTitle className="text-lg font-bold text-amber-900 dark:text-amber-100 font-manrope">API Keys</CardTitle>
                        <CardDescription className="text-amber-700 dark:text-amber-300 font-manrope">Manage your chatbot API keys</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => { setRegenerateDialogOpen(true); }}
                      className="border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Regenerate Key
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {/* New API Key Alert (shown after regeneration) */}
                  {newApiKey && (
                    <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200 font-manrope">
                        <div className="space-y-2">
                          <p className="font-semibold">New API Key Generated!</p>
                          <p className="text-sm">Save this key now - it won't be shown again.</p>
                          <div className="flex items-center gap-2 mt-2">
                            <code className="bg-green-100 dark:bg-green-900/50 px-3 py-2 rounded font-mono text-sm flex-1 break-all">
                              {newApiKey}
                            </code>
                            <Button variant="outline" size="sm" onClick={copyNewApiKey}>
                              {newApiKeyCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* API Keys List */}
                  {apiKeysLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
                    </div>
                  ) : apiKeys.length > 0 ? (
                    <div className="space-y-3">
                      {apiKeys.filter(k => k.is_active).map((key) => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <Key className="h-5 w-5 text-amber-600" />
                            <div>
                              <p className="font-mono text-sm text-gray-900 dark:text-gray-100">{key.key_prefix}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Created {new Date(key.created_at).toLocaleDateString()}
                                {key.last_used_at && ` • Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">Active</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { confirmDeleteApiKey(key); }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete API Key"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Key className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">No API keys found</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click "Regenerate Key" to create one</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Embed Code Section */}
              <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border-b border-cyan-200 dark:border-cyan-700 rounded-t-xl p-6">
                  <div className="flex items-center gap-3">
                    <Code className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                    <div>
                      <CardTitle className="text-lg font-bold text-cyan-900 dark:text-cyan-100 font-manrope">Embed Code</CardTitle>
                      <CardDescription className="text-cyan-700 dark:text-cyan-300 font-manrope">Add this chatbot to your website</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200 font-manrope">
                      Replace <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">YOUR_API_KEY</code> with the API key shown above.
                    </AlertDescription>
                  </Alert>

                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                      {getEmbedCode()}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyEmbedCode}
                      className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-gray-100 border-gray-600"
                    >
                      {embedCodeCopied ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={() => window.open(`${String(import.meta.env.VITE_WIDGET_URL ?? 'http://localhost:9000/widget.js').replace('/widget.js', '')}/test.html`, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Test Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Deployment Tab */}
          <TabsContent value="deployment">
            <div className="space-y-6">
              {/* Active Channels */}
              <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-green-200 dark:border-green-700 rounded-t-xl p-6">
                  <div className="flex items-center gap-3">
                    <Globe className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <div>
                      <CardTitle className="text-gray-900 dark:text-gray-100 font-manrope">Active Channels</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">Channels where your chatbot is deployed</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {/* Website Widget - Always Active */}
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div>
                          <p className="font-medium text-green-900 dark:text-green-100 font-manrope">Website Widget</p>
                          <p className="text-xs text-green-600 dark:text-green-400 font-manrope">Embed on your website</p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300">Active</Badge>
                    </div>

                    {/* API Access */}
                    <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                      <div className="flex items-center gap-3">
                        <Code className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="font-medium text-blue-900 dark:text-blue-100 font-manrope">REST API</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-manrope">Programmatic access</p>
                        </div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-300">Active</Badge>
                    </div>

                    {/* SecretVM */}
                    <div className="flex items-center justify-between p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-700">
                      <div className="flex items-center gap-3">
                        <Link2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        <div>
                          <p className="font-medium text-cyan-900 dark:text-cyan-100 font-manrope">SecretVM</p>
                          <p className="text-xs text-cyan-600 dark:text-cyan-400 font-manrope">
                            {chatbot.slug && chatbot.workspace_slug
                              ? `/chat/${chatbot.workspace_slug}/${chatbot.slug}`
                              : 'Direct chat URL'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {chatbot.is_public ? (
                          <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-800/30 dark:text-cyan-300">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Disabled</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setActiveTab('hosted-page'); }}
                          className="text-cyan-600 dark:text-cyan-400"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Show other channels if configured */}
                    {(chatbot.deployment_config.channels ?? []).filter(c => c.enabled && !['website', 'api'].includes(c.type)).map((channel, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-3">
                          {channel.type === 'discord' && <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
                          {channel.type === 'telegram' && <Send className="h-5 w-5 text-blue-500 dark:text-blue-400" />}
                          {channel.type === 'whatsapp' && <Phone className="h-5 w-5 text-green-500 dark:text-green-400" />}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope capitalize">{channel.type}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Connected</p>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300">Active</Badge>
                      </div>
                    ))}

                    {/* Show Telegram if connected (stored separately from channels array) */}
                    {chatbot.deployment_config?.telegram?.status === 'success' && (
                      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center gap-3">
                          <Send className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                          <div>
                            <p className="font-medium text-blue-900 dark:text-blue-100 font-manrope">Telegram</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-manrope">
                              {chatbot.deployment_config.telegram.bot_username}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-300">Active</Badge>
                      </div>
                    )}

                    {/* Show Discord guilds if connected */}
                    {discordGuilds.map((guild) => (
                      <div
                        key={guild.guild_id}
                        className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700"
                      >
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                          <div>
                            <p className="font-medium text-indigo-900 dark:text-indigo-100 font-manrope">Discord</p>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-manrope">
                              {guild.guild_name || guild.guild_id}
                            </p>
                            {guild.allowed_channel_ids.length > 0 && (
                              <p className="text-xs text-indigo-500 dark:text-indigo-500 font-manrope">
                                {guild.allowed_channel_ids.length} channel(s) selected
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={guild.is_active
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-800/30 dark:text-indigo-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400"
                          }>
                            {guild.is_active ? 'Active' : 'Paused'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-indigo-500 hover:text-indigo-700"
                            onClick={() => openChannelConfig(guild)}
                            title="Configure Channels"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
                            onClick={() => handleRemoveDiscordGuild(guild.guild_id)}
                            title="Remove Server"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Add More Channels */}
              <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b border-violet-200 dark:border-violet-700 rounded-t-xl p-6">
                  <div className="flex items-center gap-3">
                    <Plus className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                    <div>
                      <CardTitle className="text-gray-900 dark:text-gray-100 font-manrope">Add Deployment Channels</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">Connect your chatbot to messaging platforms</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Discord */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3 mb-3">
                        <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">Discord</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Add to servers</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope mb-3">Connect your chatbot to Discord servers for community support.</p>
                      {discordGuilds.length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full font-manrope"
                          onClick={() => setDiscordModalOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Server ({discordGuilds.length} connected)
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full font-manrope"
                          onClick={() => setDiscordModalOpen(true)}
                          disabled={!discordInviteUrl}
                        >
                          {discordInviteUrl ? 'Connect Server' : 'Not Configured'}
                        </Button>
                      )}
                    </div>

                    {/* Telegram */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3 mb-3">
                        <Send className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">Telegram</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Telegram bot</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope mb-3">Deploy as a Telegram bot for instant messaging support.</p>
                      {chatbot.deployment_config?.telegram?.status === 'success' ? (
                        <Button variant="outline" size="sm" className="w-full font-manrope" disabled>
                          <Check className="h-4 w-4 mr-2" />
                          Connected
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full font-manrope"
                          onClick={() => setTelegramModalOpen(true)}
                        >
                          Connect Bot
                        </Button>
                      )}
                    </div>

                    {/* WhatsApp */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3 mb-3">
                        <Phone className="h-5 w-5 text-green-500 dark:text-green-400" />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">WhatsApp</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Business API</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope mb-3">Connect via WhatsApp Business API for customer support.</p>
                      <Button variant="outline" size="sm" className="w-full font-manrope" disabled>
                        Coming Soon
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SecretVM Tab - SecretVM Deployment */}
          <TabsContent value="hosted-page">
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
              <CardContent className="p-6 space-y-6">
                {/* Header with Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">SecretVM</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">Public chat page accessible via direct URL</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {chatbot.is_public ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-manrope">
                        <Check className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500 dark:text-gray-400 font-manrope">
                        Disabled
                      </Badge>
                    )}
                  </div>
                </div>

                {/* URL and Actions */}
                {chatbot.slug && chatbot.workspace_slug ? (
                  <div className="space-y-4">
                    {/* Chat URL Header */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Chat URL</span>
                    </div>

                    {/* URL Components (Workspace + Chatbot slugs) */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 space-y-3">
                      {/* Base URL (read-only) */}
                      <div className="font-mono text-sm text-gray-500 dark:text-gray-400">
                        {window.location.origin}/chat/
                      </div>

                      {/* Workspace Slug Row */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-24 font-manrope">Workspace:</span>
                        {isEditingWorkspaceSlug ? (
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={workspaceSlugInput}
                                onChange={(e) => { handleWorkspaceSlugInputChange(e.target.value); }}
                                onKeyDown={handleWorkspaceSlugKeyDown}
                                className={`font-mono text-sm flex-1 ${
                                  workspaceSlugError
                                    ? 'border-red-500 focus-visible:ring-red-500'
                                    : ''
                                }`}
                                placeholder="workspace-slug"
                                autoFocus
                                disabled={isUpdatingWorkspaceSlug}
                              />
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => void handleWorkspaceSlugUpdate()}
                                disabled={isUpdatingWorkspaceSlug || !workspaceSlugInput}
                                className="font-manrope"
                              >
                                {isUpdatingWorkspaceSlug ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Save'
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleWorkspaceSlugEditCancel}
                                disabled={isUpdatingWorkspaceSlug}
                                className="font-manrope"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {workspaceSlugError && (
                              <p className="text-sm text-red-500 font-manrope">{workspaceSlugError}</p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                              Changing workspace URL affects all chatbots in this workspace. Old URLs will redirect.
                            </p>
                          </div>
                        ) : (
                          <>
                            <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{chatbot.workspace_slug}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleWorkspaceSlugEditStart}
                              className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-600"
                              title="Edit workspace URL"
                            >
                              <Edit2 className="h-3 w-3 text-gray-500" />
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Chatbot Slug Row */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-24 font-manrope">Chatbot:</span>
                        {isEditingSlug ? (
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={slugInput}
                                onChange={(e) => { handleSlugInputChange(e.target.value); }}
                                onKeyDown={handleSlugKeyDown}
                                className={`font-mono text-sm flex-1 ${
                                  slugError
                                    ? 'border-red-500 focus-visible:ring-red-500'
                                    : ''
                                }`}
                                placeholder="chatbot-slug"
                                autoFocus
                                disabled={isUpdatingSlug}
                              />
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => void handleSlugUpdate()}
                                disabled={isUpdatingSlug || !slugInput}
                                className="font-manrope"
                              >
                                {isUpdatingSlug ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Save'
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSlugEditCancel}
                                disabled={isUpdatingSlug}
                                className="font-manrope"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {slugError && (
                              <p className="text-sm text-red-500 font-manrope">{slugError}</p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                              Use lowercase letters, numbers, and hyphens. Old URLs will redirect.
                            </p>
                          </div>
                        ) : (
                          <>
                            <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{chatbot.slug}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSlugEditStart}
                              className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-600"
                              title="Edit chatbot URL"
                            >
                              <Edit2 className="h-3 w-3 text-gray-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Full URL Display with Actions */}
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 font-manrope">Full URL:</span>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={`${window.location.origin}/chat/${chatbot.workspace_slug}/${chatbot.slug}`}
                          className="font-mono text-sm bg-gray-50 dark:bg-gray-700/50"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            void navigator.clipboard.writeText(`${window.location.origin}/chat/${String(chatbot.workspace_slug)}/${String(chatbot.slug)}`);
                            toast({
                              title: 'URL Copied',
                              description: 'Chat URL copied to clipboard',
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(`/chat/${String(chatbot.workspace_slug)}/${String(chatbot.slug)}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/chat/${String(chatbot.workspace_slug)}/${String(chatbot.slug)}`;
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
                          const link = document.createElement('a');
                          link.href = qrUrl;
                          link.download = `${String(chatbot.slug)}-qr-code.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          toast({
                            title: 'QR Code Downloaded',
                            description: 'QR code image saved to your downloads',
                          });
                        }}
                        className="font-manrope"
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        Download QR Code
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { navigate(`/chatbots/${String(chatbotId)}/edit`); }}
                        className="font-manrope"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Edit Appearance
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 font-manrope">
                      SecretVM URL will be available after the chatbot is deployed.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Regenerate API Key Confirmation Dialog */}
          <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
            <DialogContent className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-xl shadow-xl max-w-md">
              <DialogHeader className="text-center pb-4">
                <RotateCcw className="w-12 h-12 mx-auto text-amber-600 dark:text-amber-400 mb-4" />
                <DialogTitle className="text-xl font-bold text-amber-900 dark:text-amber-100 font-manrope">Regenerate API Key</DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed mt-3">
                  This will <span className="font-semibold text-amber-700 dark:text-amber-300">permanently delete all existing API keys</span> and create a new one.
                  <br /><br />
                  Any applications using the old key will stop working immediately.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
                <Button
                  variant="outline"
                  onClick={() => { setRegenerateDialogOpen(false); }}
                  className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    void handleRegenerateApiKey();
                    setRegenerateDialogOpen(false);
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800 font-manrope"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Regenerate Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete API Key Confirmation Dialog */}
          <Dialog open={deleteKeyDialogOpen} onOpenChange={setDeleteKeyDialogOpen}>
            <DialogContent className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-xl shadow-xl max-w-md">
              <DialogHeader className="text-center pb-4">
                <Trash2 className="w-12 h-12 mx-auto text-red-600 dark:text-red-400 mb-4" />
                <DialogTitle className="text-xl font-bold text-red-900 dark:text-red-100 font-manrope">Delete API Key</DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed mt-3">
                  Are you sure you want to <span className="font-semibold text-red-700 dark:text-red-300">permanently delete</span> this API key?
                  <br /><br />
                  {keyToDelete && (
                    <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono">
                      {keyToDelete.key_prefix}
                    </code>
                  )}
                  <br /><br />
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    This action is irreversible. Any applications using this key will stop working immediately.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteKeyDialogOpen(false);
                    setKeyToDelete(null);
                  }}
                  className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => { void handleDeleteApiKey(); }}
                  variant="destructive"
                  className="flex-1 font-manrope"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Configuration Tab */}
          <TabsContent value="settings">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b border-violet-200 dark:border-violet-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  <div>
                    <CardTitle className="text-lg font-bold text-violet-900 dark:text-violet-100 font-manrope">Configuration</CardTitle>
                    <CardDescription className="text-violet-700 dark:text-violet-300 font-manrope">Full chatbot configuration details</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope block mb-2">Chatbot ID</label>
                    <p className="font-mono text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded border break-all">{chatbot.id}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope block mb-2">Workspace ID</label>
                    <p className="font-mono text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded border break-all">{chatbot.workspace_id}</p>
                  </div>
                </div>

                {/* Branding */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope mb-3">Branding</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Primary Color</label>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: chatbot.branding_config.primary_color ?? '#6366f1' }}
                        />
                        <span className="text-sm font-mono">{chatbot.branding_config.primary_color ?? '#6366f1'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Position</label>
                      <p className="text-sm font-medium mt-1">{chatbot.branding_config.position ?? 'bottom-right'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Chat Title</label>
                      <p className="text-sm font-medium mt-1">{chatbot.branding_config.chat_title ?? 'Chat with us'}</p>
                    </div>
                  </div>
                </div>

                {/* Deployment Channels */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope mb-3">Deployment Channels</h4>
                  <div className="flex flex-wrap gap-2">
                    {(chatbot.deployment_config.channels ?? []).length > 0 ? (chatbot.deployment_config.channels ?? []).map((channel, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className={channel.enabled
                          ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'
                        }
                      >
                        {channel.type} {channel.enabled ? '✓' : '✗'}
                      </Badge>
                    )) : <span className="text-sm text-gray-500">No channels configured</span>}
                  </div>
                </div>

                {/* Edit Button */}
                <div className="flex justify-end">
                  <Button onClick={() => { navigate(`/chatbots/${String(chatbotId)}/edit`); }}>
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Period Selector */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                  Analytics Overview
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    value={analyticsDays}
                    onChange={(e) => { setAnalyticsDays(Number(e.target.value)); }}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { void loadAnalytics(); }}
                    disabled={analyticsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {analyticsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : analytics ? (
                <>
                  {/* Analytics Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <div>
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 font-manrope">Widget Loads</p>
                            <p className="text-xl font-bold text-blue-900 dark:text-blue-100 font-manrope">
                              {analytics.analytics?.overview.widget_loads ?? 0}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <MousePointer className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <div>
                            <p className="text-xs font-medium text-green-700 dark:text-green-300 font-manrope">Widget Opens</p>
                            <p className="text-xl font-bold text-green-900 dark:text-green-100 font-manrope">
                              {analytics.analytics?.engagement.widget_opens ?? 0}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          <div>
                            <p className="text-xs font-medium text-purple-700 dark:text-purple-300 font-manrope">Conversations</p>
                            <p className="text-xl font-bold text-purple-900 dark:text-purple-100 font-manrope">
                              {analytics.analytics?.overview.total_conversations ?? 0}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300 font-manrope">Engagement Rate</p>
                            <p className="text-xl font-bold text-amber-900 dark:text-amber-100 font-manrope">
                              {((analytics.analytics?.engagement.engagement_rate ?? 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Response Quality Card */}
                  <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-b border-cyan-200 dark:border-cyan-700 rounded-t-xl p-4">
                      <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        <CardTitle className="text-base font-bold text-cyan-900 dark:text-cyan-100 font-manrope">
                          Response Quality
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      {analytics.analytics?.response_quality ? (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                              {analytics.analytics.response_quality.total_responses}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Total Responses</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                              {analytics.analytics.response_quality.successful_responses}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 font-manrope">Successful</p>
                          </div>
                          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                              {analytics.analytics.response_quality.failed_responses}
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400 font-manrope">Failed</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                              {(analytics.analytics.response_quality.success_rate * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 font-manrope">Success Rate</p>
                          </div>
                          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                              {(analytics.analytics.response_quality.error_rate * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400 font-manrope">Error Rate</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <Zap className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500 font-manrope">No response data yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Feedback and Events */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Feedback Summary */}
                    <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
                      <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-b border-green-200 dark:border-green-700 rounded-t-xl p-4">
                        <div className="flex items-center gap-3">
                          <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <CardTitle className="text-base font-bold text-green-900 dark:text-green-100 font-manrope">
                            User Feedback
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        {analytics.feedback && analytics.feedback.total_feedback > 0 ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                  <ThumbsUp className="h-4 w-4" />
                                  <span className="font-semibold">{analytics.feedback.positive}</span>
                                </div>
                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                  <ThumbsDown className="h-4 w-4" />
                                  <span className="font-semibold">{analytics.feedback.negative}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                  {(analytics.feedback.satisfaction_rate * 100).toFixed(0)}%
                                </p>
                                <p className="text-xs text-gray-500">Satisfaction</p>
                              </div>
                            </div>
                            {analytics.feedback.recent_feedback.length > 0 && (
                              <div className="border-t pt-3 mt-3">
                                <p className="text-xs font-medium text-gray-500 mb-2">Recent Comments</p>
                                {analytics.feedback.recent_feedback.slice(0, 3).map((fb, idx) => (
                                  <div key={idx} className="text-sm text-gray-600 dark:text-gray-400 py-1">
                                    {fb.rating === 'positive' ? '👍' : '👎'} {fb.comment ?? fb.message_preview}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <ThumbsUp className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500 font-manrope">No feedback collected yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Event Breakdown */}
                    <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
                      <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b border-violet-200 dark:border-violet-700 rounded-t-xl p-4">
                        <div className="flex items-center gap-3">
                          <BarChart2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                          <CardTitle className="text-base font-bold text-violet-900 dark:text-violet-100 font-manrope">
                            Event Breakdown
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        {analytics.events && Object.keys(analytics.events).length > 0 ? (
                          <div className="space-y-2">
                            {Object.entries(analytics.events).map(([eventType, count]) => (
                              <div key={eventType} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope capitalize">
                                  {eventType.replace(/_/g, ' ')}
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <BarChart2 className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500 font-manrope">No events recorded yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <BarChart2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Analytics Data</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Analytics will appear once your chatbot starts receiving traffic.
                  </p>
                  <Button onClick={() => { void loadAnalytics(); }} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Analytics
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Archive Confirmation Dialog */}
        <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-xl shadow-xl max-w-md">
            <DialogHeader className="text-center pb-4">
              <AlertCircle className="w-12 h-12 mx-auto text-red-600 dark:text-red-400 mb-4" />
              <DialogTitle className="text-xl font-bold text-red-900 dark:text-red-100 font-manrope">Archive Chatbot</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed mt-3">
                Are you sure you want to archive <span className="font-semibold text-red-700 dark:text-red-300">"{chatbot.name}"</span>?
                <br /><br />
                The chatbot will be disabled and won't respond to messages. You can restore it later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => { setArchiveDialogOpen(false); }}
                className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => { void handleArchive(); }}
                className="flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 font-manrope"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Archive Chatbot
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Telegram Configuration Modal */}
        <Dialog open={telegramModalOpen} onOpenChange={setTelegramModalOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-xl shadow-xl max-w-md">
            <DialogHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Send className="h-6 w-6 text-blue-500" />
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 font-manrope">Connect Telegram Bot</DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                    Enter your bot token from @BotFather
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <TelegramConfigForm
              onConnect={handleConnectTelegram}
              isConnecting={telegramConnecting}
            />
          </DialogContent>
        </Dialog>

        {/* Discord Configuration Modal */}
        <Dialog open={discordModalOpen} onOpenChange={setDiscordModalOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-xl shadow-xl max-w-md">
            <DialogHeader className="pb-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-indigo-500" />
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 font-manrope">Connect Discord Server</DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                    Add your chatbot to a Discord server
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <DiscordConfigForm
              inviteUrl={discordInviteUrl}
              onConnect={handleConnectDiscord}
              isConnecting={discordConnecting}
            />
          </DialogContent>
        </Dialog>

        {/* Discord Channel Configuration Modal */}
        <Dialog open={channelConfigModalOpen} onOpenChange={setChannelConfigModalOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-xl shadow-xl max-w-md">
            <DialogHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-indigo-500" />
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                    Channel Settings
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                    {channelConfigGuild?.guild_name || 'Discord Server'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <Alert className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                <AlertDescription className="text-indigo-800 dark:text-indigo-200 text-sm font-manrope">
                  Select which channels the bot should respond in. Leave empty to respond in all channels.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
                  Channels ({selectedChannelIds.length} selected)
                </label>

                {channelsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                  </div>
                ) : availableChannels.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-manrope">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No text channels found</p>
                    <p className="text-xs mt-1">The bot may not have access to view channels</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                    {availableChannels.map((channel) => (
                      <label
                        key={channel.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedChannelIds.includes(channel.id)
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-600'
                            : 'bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedChannelIds.includes(channel.id)}
                          onChange={() => handleToggleChannel(channel.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-gray-500 dark:text-gray-400">#</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                          {channel.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedChannelIds([])}
                  disabled={channelsLoading || selectedChannelIds.length === 0}
                  className="font-manrope"
                >
                  Clear Selection
                </Button>
                <Button
                  onClick={handleSaveChannelConfig}
                  disabled={channelsLoading || channelsSaving}
                  className="font-manrope"
                >
                  {channelsSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Telegram Configuration Form Component
function TelegramConfigForm({
  onConnect,
  isConnecting
}: {
  onConnect: (token: string) => void;
  isConnecting: boolean;
}) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const isValidToken = /^\d+:[A-Za-z0-9_-]+$/.test(token);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Bot Token</label>
        <div className="relative mt-1">
          <Input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456789:ABC-xyz..."
            className="pr-10 font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => setShowToken(!showToken)}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-manrope">
          Get this from{' '}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            @BotFather
          </a>
          {' '}on Telegram
        </p>
      </div>

      <DialogFooter>
        <Button
          onClick={() => onConnect(token)}
          disabled={!isValidToken || isConnecting}
          className="w-full font-manrope"
        >
          {isConnecting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect Bot'
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

// Discord Configuration Form Component
function DiscordConfigForm({
  inviteUrl,
  onConnect,
  isConnecting
}: {
  inviteUrl: string | null;
  onConnect: (guildId: string, guildName: string) => void;
  isConnecting: boolean;
}) {
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [manualGuildId, setManualGuildId] = useState('');
  const [manualGuildName, setManualGuildName] = useState('');
  const [availableGuilds, setAvailableGuilds] = useState<{ guild_id: string; guild_name: string; guild_icon: string | null }[]>([]);
  const [isLoadingGuilds, setIsLoadingGuilds] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch available guilds on mount
  useEffect(() => {
    const fetchGuilds = async () => {
      setIsLoadingGuilds(true);
      setLoadError(null);
      try {
        const response = await discordApi.getAvailableGuilds();
        setAvailableGuilds(response.guilds);
        // Check for error in response (e.g., invalid token, missing config)
        if (response.error) {
          setLoadError(response.error);
          setShowManualEntry(true);
        } else if (response.guilds.length === 0) {
          setShowManualEntry(true);
        }
      } catch (error) {
        console.error('Failed to fetch available guilds:', error);
        setLoadError('Failed to load servers. Please try again.');
        setShowManualEntry(true);
      } finally {
        setIsLoadingGuilds(false);
      }
    };
    fetchGuilds();
  }, []);

  const isValidManualGuildId = manualGuildId.length >= 17 && /^\d+$/.test(manualGuildId);
  const selectedGuild = availableGuilds.find(g => g.guild_id === selectedGuildId);

  const handleConnect = () => {
    if (showManualEntry) {
      onConnect(manualGuildId, manualGuildName);
    } else if (selectedGuild) {
      onConnect(selectedGuild.guild_id, selectedGuild.guild_name);
    }
  };

  const canConnect = showManualEntry ? isValidManualGuildId : !!selectedGuildId;

  return (
    <div className="space-y-4">
      {isLoadingGuilds ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 font-manrope">
            Looking for available servers...
          </span>
        </div>
      ) : availableGuilds.length > 0 && !showManualEntry ? (
        <>
          {/* Auto-detected servers */}
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-800 dark:text-green-200 text-sm font-manrope">
              Found {availableGuilds.length} server{availableGuilds.length > 1 ? 's' : ''} with PrivexBot installed. Select one to connect.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
              Select Server
            </label>
            <div className="space-y-2">
              {availableGuilds.map((guild) => (
                <button
                  key={guild.guild_id}
                  onClick={() => setSelectedGuildId(guild.guild_id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedGuildId === guild.guild_id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                  }`}
                >
                  {guild.guild_icon ? (
                    <img
                      src={guild.guild_icon}
                      alt={guild.guild_name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center">
                      <span className="text-indigo-600 dark:text-indigo-300 font-bold text-lg">
                        {guild.guild_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 dark:text-white font-manrope">
                      {guild.guild_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {guild.guild_id}
                    </p>
                  </div>
                  {selectedGuildId === guild.guild_id && (
                    <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowManualEntry(true)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-manrope"
            >
              Don't see your server? Enter ID manually
            </button>
          </div>

          <DialogFooter>
            <Button
              onClick={handleConnect}
              disabled={!canConnect || isConnecting}
              className="w-full font-manrope"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Server'
              )}
            </Button>
          </DialogFooter>
        </>
      ) : (
        <>
          {/* Manual entry or no guilds found */}
          {loadError ? (
            <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-800 dark:text-red-200 text-sm font-manrope">
                <span className="font-medium">Discord Configuration Error</span>
                <br />
                {loadError}
                <br />
                <a
                  href="https://discord.com/developers/applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1 mt-1"
                >
                  Check Discord Developer Portal <ExternalLink className="h-3 w-3" />
                </a>
                <span className="block mt-2 text-gray-600 dark:text-gray-400">You can still connect manually below.</span>
              </AlertDescription>
            </Alert>
          ) : availableGuilds.length === 0 ? (
            <Alert className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              <AlertDescription className="text-indigo-800 dark:text-indigo-200 text-sm font-manrope">
                No available servers found. Add the bot to a Discord server first, or enter Server ID manually.
              </AlertDescription>
            </Alert>
          ) : (
            <button
              onClick={() => setShowManualEntry(false)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-manrope flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to server list
            </button>
          )}

          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
              Add the PrivexBot to your Discord server, then enter the Server ID below.
            </p>

            {inviteUrl && (
              <Button
                variant="outline"
                className="w-full font-manrope"
                onClick={() => window.open(inviteUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Add Bot to Server
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
              Server ID (Guild ID)
            </label>
            <Input
              type="text"
              value={manualGuildId}
              onChange={(e) => setManualGuildId(e.target.value.replace(/\D/g, ''))}
              placeholder="1234567890123456789"
              className="font-mono"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-manrope">
              Enable Developer Mode in Discord Settings → Right-click server → Copy Server ID
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
              Server Name (Optional)
            </label>
            <Input
              type="text"
              value={manualGuildName}
              onChange={(e) => setManualGuildName(e.target.value)}
              placeholder="My Discord Server"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-manrope">
              For display purposes in the dashboard
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={handleConnect}
              disabled={!canConnect || isConnecting}
              className="w-full font-manrope"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Server'
              )}
            </Button>
          </DialogFooter>
        </>
      )}
    </div>
  );
}
