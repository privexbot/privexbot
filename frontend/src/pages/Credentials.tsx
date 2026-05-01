/**
 * Credentials - Manage API credentials and integrations
 *
 * WHY:
 * - Store OAuth tokens securely
 * - Manage third-party integrations
 * - Test credential validity
 * - Sync cloud sources
 *
 * HOW:
 * - React Query for CRUD
 * - OAuth callback handling
 * - Test connection functionality
 * - Masked credential display
 *
 * DEPENDENCIES:
 * - @tanstack/react-query
 * - react-router-dom
 * - lucide-react
 * - @/config/env
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Key,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { config } from '@/config/env';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';
import apiClient, { handleApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Credential {
  id: string;
  name: string;
  credential_type: string;  // api_key, oauth2, etc. (auth mechanism)
  provider?: string;        // openai, telegram, discord, etc. (service name)
  is_active: boolean;       // Whether credential is active
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

const CREDENTIAL_TYPES = [
  { value: 'openai', label: 'OpenAI API Key', icon: '🤖', requiresOAuth: false, requiresDatabase: false },
  { value: 'notion', label: 'Notion', icon: '📝', requiresOAuth: true, requiresDatabase: false },
  // The backend's `google` provider already requests Drive + Docs + Sheets
  // readonly scopes (see credentials.py:505), so the credential row stored is
  // `provider="google"`. We keep the "Google Drive" label here for UX clarity.
  { value: 'google', label: 'Google Drive', icon: '📁', requiresOAuth: true, requiresDatabase: false },
  { value: 'slack', label: 'Slack', icon: '💬', requiresOAuth: true, requiresDatabase: false },
  { value: 'telegram', label: 'Telegram Bot', icon: '✈️', requiresOAuth: false, requiresDatabase: false },
  { value: 'discord', label: 'Discord Bot', icon: '🎮', requiresOAuth: false, requiresDatabase: false },
  { value: 'whatsapp', label: 'WhatsApp Business', icon: '💬', requiresOAuth: false, requiresDatabase: false },
  { value: 'google_gmail', label: 'Gmail', icon: '📧', requiresOAuth: true, requiresDatabase: false },
  { value: 'calendly', label: 'Calendly', icon: '📅', requiresOAuth: true, requiresDatabase: false },
  { value: 'database', label: 'Database', icon: '🗄️', requiresOAuth: false, requiresDatabase: true },
  { value: 'smtp', label: 'SMTP Email Server', icon: '📨', requiresOAuth: false, requiresDatabase: false },
];

// ========================================
// EMPTY STATE COMPONENT
// ========================================

function EmptyState({ onAddCredential }: { onAddCredential: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <Key className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-2">
        No Credentials Yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400 font-manrope mb-6 max-w-md mx-auto">
        Add your first API credential to start integrating services with your chatbots
      </p>
      <Button
        onClick={onAddCredential}
        className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Your First Credential
      </Button>
    </motion.div>
  );
}

// ========================================
// CREDENTIAL CARD COMPONENT
// ========================================

interface CredentialCardProps {
  credential: Credential;
  onTest: (id: string) => void;
  onToggleShow: (id: string) => void;
  onDelete: (id: string) => void;
  showSecret: boolean;
  isTesting: boolean;
  index: number;
}

function CredentialCard({
  credential,
  onTest,
  onToggleShow,
  onDelete,
  showSecret,
  isTesting,
  index,
}: CredentialCardProps) {
  // Find type by provider (service name), not credential_type (auth mechanism)
  const type = CREDENTIAL_TYPES.find((t) => t.value === credential.provider);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Left: Icon + Details */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Provider emoji — bare, no colored chrome */}
              <span
                className="text-3xl flex-shrink-0 leading-none"
                aria-hidden="true"
              >
                {type?.icon || '🔑'}
              </span>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 font-manrope truncate">
                    {credential.name}
                  </h3>
                  {/* Status Badge */}
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                      credential.is_active
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                    )}
                  >
                    {credential.is_active ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    <span className="font-manrope">{credential.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                  {type?.label || credential.provider || 'Unknown'} • Created {new Date(credential.created_at).toLocaleDateString()}
                </p>

                {credential.last_used_at && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-1">
                    Last used: {new Date(credential.last_used_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTest(credential.id)}
                disabled={isTesting}
                className="flex-1 sm:flex-none font-manrope rounded-lg border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">Test</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleShow(credential.id)}
                className="flex-1 sm:flex-none font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">{showSecret ? 'Hide' : 'Show'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(credential.id)}
                className="flex-1 sm:flex-none font-manrope rounded-lg border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Delete</span>
              </Button>
            </div>
          </div>

          {/* Secret Display */}
          {showSecret && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Label className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                API Key / Token
              </Label>
              <div className="mt-1.5 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300 break-all">
                {type?.requiresOAuth ? 'OAuth token (managed securely)' : 'sk-••••••••••••••••'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function Credentials() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useApp();
  const [searchParams] = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Form state - provider is the service (openai, telegram, etc.)
  // credential_type is the auth mechanism (api_key, oauth2, database, smtp)
  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai' as string,
    api_key: '',
    // Database-specific fields
    db_host: '',
    db_port: '5432',
    db_name: '',
    db_username: '',
    db_password: '',
    db_type: 'postgresql',
  });

  // Fetch credentials
  const { data: credentials, isLoading, error } = useQuery({
    queryKey: ['credentials', currentWorkspace?.id],
    queryFn: async () => {
      const response = await apiClient.get('/credentials/', {
        params: { workspace_id: currentWorkspace?.id },
      });
      return response.data.items as Credential[];
    },
    enabled: !!currentWorkspace,
  });

  // Create credential mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const selectedType = CREDENTIAL_TYPES.find((t) => t.value === data.provider);

      let payload;
      if (selectedType?.requiresDatabase) {
        // Database credentials: different type and data shape
        payload = {
          workspace_id: currentWorkspace?.id,
          name: data.name,
          credential_type: 'database',
          provider: 'database',
          data: {
            host: data.db_host,
            port: parseInt(data.db_port) || 5432,
            database: data.db_name,
            username: data.db_username,
            password: data.db_password,
            type: data.db_type,
          },
        };
      } else {
        // API key credentials (OpenAI, Telegram, Discord, etc.)
        payload = {
          workspace_id: currentWorkspace?.id,
          name: data.name,
          credential_type: 'api_key',
          provider: data.provider,
          data: {
            api_key: data.api_key,
          },
        };
      }

      const response = await apiClient.post('/credentials/', payload);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Credential added successfully' });
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setDialogOpen(false);
      setFormData({ name: '', provider: 'openai', api_key: '', db_host: '', db_port: '5432', db_name: '', db_username: '', db_password: '', db_type: 'postgresql' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add credential',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await apiClient.delete(`/credentials/${credentialId}`);
    },
    onSuccess: () => {
      toast({ title: 'Credential deleted' });
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setDeleteDialogOpen(false);
      setCredentialToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  // Test credential mutation
  const testMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      const response = await apiClient.post(`/credentials/${credentialId}/test`);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.is_valid) {
        toast({ title: 'Credential is valid', description: 'Connection successful' });
      } else {
        toast({
          title: 'Credential is invalid',
          description: data.error || 'Connection failed',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
    onError: (error) => {
      toast({
        title: 'Test failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  // OAuth initiation
  // Slack is intentionally NOT in `SUPPORTED_OAUTH_PROVIDERS` on the backend —
  // it uses the shared-bot install flow at `/webhooks/slack/install` and
  // produces a `SlackWorkspaceDeployment`, not a `Credential` row. Other
  // providers go through `/credentials/oauth/authorize`, which is POST-only
  // (the backend needs the Bearer token to seed CSRF + state).
  const initiateOAuth = async (credentialType: string) => {
    if (!currentWorkspace?.id) {
      toast({
        title: 'Workspace not selected',
        description: 'Please select a workspace before connecting credentials.',
        variant: 'destructive',
      });
      return;
    }

    if (credentialType === 'slack') {
      window.location.href = `${config.API_BASE_URL}/webhooks/slack/install`;
      return;
    }

    try {
      const response = await apiClient.post<{ redirect_url: string }>(
        '/credentials/oauth/authorize',
        null,
        {
          params: {
            provider: credentialType,
            workspace_id: currentWorkspace.id,
          },
        },
      );
      const target = response.data?.redirect_url;
      if (!target) {
        throw new Error('Backend returned no redirect URL.');
      }
      window.location.href = target;
    } catch (err) {
      toast({
        title: 'Could not start OAuth flow',
        description: handleApiError(err),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (credentialId: string) => {
    setCredentialToDelete(credentialId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (credentialToDelete) {
      deleteMutation.mutate(credentialToDelete);
    }
  };

  const toggleShowSecret = (credentialId: string) => {
    setShowSecrets((prev) => ({ ...prev, [credentialId]: !prev[credentialId] }));
  };

  const selectedType = CREDENTIAL_TYPES.find((t) => t.value === formData.provider);

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 xl:px-12">
            <Alert
              variant="destructive"
              className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 rounded-xl"
            >
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-700 dark:text-red-300 font-manrope">
                Failed to load credentials. Please try again.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['credentials'] })}
              className="mt-4 font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg"
            >
              Try Again
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-6 sm:space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                API Credentials
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
                Manage integrations and API keys for your chatbots
              </p>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['credentials'] })}
                className="flex-1 sm:flex-none font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1 sm:flex-none font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Add Credential</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
                      <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Add New Credential
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                      Connect a third-party service or add an API key
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 mt-4">
                    {/* Service Type Select */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                        Service Type
                      </Label>
                      <Select
                        value={formData.provider}
                        onValueChange={(value) =>
                          setFormData({ ...formData, provider: value })
                        }
                      >
                        <SelectTrigger className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                          {CREDENTIAL_TYPES.map((type) => (
                            <SelectItem
                              key={type.value}
                              value={type.value}
                              className="font-manrope text-gray-700 dark:text-gray-300"
                            >
                              {type.icon} {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Name Input */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                        Name
                      </Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Production Telegram Bot"
                        className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      />
                    </div>

                    {/* OAuth, Database, or API Key Section */}
                    {selectedType?.requiresOAuth ? (
                      <>
                        <Alert className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <AlertDescription className="text-sm text-blue-700 dark:text-blue-300 font-manrope">
                            This service requires OAuth authentication. You'll be redirected to
                            authorize access.
                          </AlertDescription>
                        </Alert>
                        <Button
                          onClick={() => initiateOAuth(formData.provider)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-manrope"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Connect with {selectedType.label}
                        </Button>
                      </>
                    ) : selectedType?.requiresDatabase ? (
                      <>
                        {/* Database Type */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                            Database Type
                          </Label>
                          <Select
                            value={formData.db_type}
                            onValueChange={(value) => setFormData({ ...formData, db_type: value })}
                          >
                            <SelectTrigger className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                              <SelectItem value="postgresql">PostgreSQL</SelectItem>
                              <SelectItem value="mysql+pymysql">MySQL</SelectItem>
                              <SelectItem value="mssql+pyodbc">SQL Server</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Host & Port */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2 space-y-2">
                            <Label className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">Host</Label>
                            <Input
                              value={formData.db_host}
                              onChange={(e) => setFormData({ ...formData, db_host: e.target.value })}
                              placeholder="db.example.com"
                              className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-mono placeholder:text-gray-400"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">Port</Label>
                            <Input
                              value={formData.db_port}
                              onChange={(e) => setFormData({ ...formData, db_port: e.target.value })}
                              placeholder="5432"
                              className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-mono placeholder:text-gray-400"
                            />
                          </div>
                        </div>

                        {/* Database Name */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">Database Name</Label>
                          <Input
                            value={formData.db_name}
                            onChange={(e) => setFormData({ ...formData, db_name: e.target.value })}
                            placeholder="my_database"
                            className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-mono placeholder:text-gray-400"
                          />
                        </div>

                        {/* Username & Password */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">Username</Label>
                            <Input
                              value={formData.db_username}
                              onChange={(e) => setFormData({ ...formData, db_username: e.target.value })}
                              placeholder="db_user"
                              className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-mono placeholder:text-gray-400"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">Password</Label>
                            <Input
                              type="password"
                              value={formData.db_password}
                              onChange={(e) => setFormData({ ...formData, db_password: e.target.value })}
                              placeholder="********"
                              className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-mono placeholder:text-gray-400"
                            />
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            onClick={() => createMutation.mutate(formData)}
                            disabled={!formData.name || !formData.db_host || !formData.db_name || !formData.db_username || !formData.db_password || createMutation.isPending}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-manrope"
                          >
                            {createMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Testing & Adding...
                              </>
                            ) : (
                              'Add Database Credential'
                            )}
                          </Button>
                        </DialogFooter>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                            API Key / Bot Token
                          </Label>
                          <Input
                            type="password"
                            value={formData.api_key}
                            onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                            placeholder="Enter your API key or bot token..."
                            className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-mono placeholder:text-gray-400 dark:placeholder:text-gray-500"
                          />
                        </div>

                        <DialogFooter>
                          <Button
                            onClick={() => createMutation.mutate(formData)}
                            disabled={!formData.name || !formData.api_key || createMutation.isPending}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-manrope"
                          >
                            {createMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              'Add Credential'
                            )}
                          </Button>
                        </DialogFooter>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* OAuth Callback Success */}
          {searchParams.get('oauth') === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Alert className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-700 dark:text-green-300 font-manrope">
                  Successfully connected! Your credential has been saved.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && (!credentials || credentials.length === 0) && (
            <EmptyState onAddCredential={() => setDialogOpen(true)} />
          )}

          {/* Credentials List */}
          {!isLoading && credentials && credentials.length > 0 && (
            <div className="space-y-4">
              {credentials.map((credential, index) => (
                <CredentialCard
                  key={credential.id}
                  credential={credential}
                  onTest={(id) => testMutation.mutate(id)}
                  onToggleShow={toggleShowSecret}
                  onDelete={handleDelete}
                  showSecret={showSecrets[credential.id] || false}
                  isTesting={testMutation.isPending}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Credential
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              This will permanently delete this credential. Any integrations using this credential
              will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-manrope rounded-lg"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
